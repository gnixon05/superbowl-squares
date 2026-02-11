import { Router } from 'express';
import braintree from 'braintree';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// Initialize Braintree gateway (uses env vars)
function getGateway() {
  if (!process.env.BRAINTREE_MERCHANT_ID || !process.env.BRAINTREE_PUBLIC_KEY || !process.env.BRAINTREE_PRIVATE_KEY) {
    return null;
  }
  return new braintree.BraintreeGateway({
    environment: process.env.BRAINTREE_ENVIRONMENT === 'production'
      ? braintree.Environment.Production
      : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
  });
}

// GET /api/payments/client-token - Generate a client token for Braintree Drop-in UI
router.get('/client-token', auth, (req, res) => {
  try {
    const gateway = getGateway();
    if (!gateway) {
      return res.status(503).json({ message: 'Payment processing is not configured' });
    }

    gateway.clientToken.generate({}, (err, response) => {
      if (err) {
        console.error('Braintree client token error:', err);
        return res.status(500).json({ message: 'Failed to generate payment token' });
      }
      res.json({ clientToken: response.clientToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/checkout - Process payment for selected squares
router.post('/checkout', auth, (req, res) => {
  try {
    const { gameId, paymentMethodNonce } = req.body;

    if (!gameId || !paymentMethodNonce) {
      return res.status(400).json({ message: 'Game ID and payment nonce are required' });
    }

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.paymentType !== 'paid' || game.paymentMethod !== 'integrated') {
      return res.status(400).json({ message: 'This game does not use integrated payments' });
    }

    // Count user's unpaid squares in this game
    const userSquares = db.prepare(
      'SELECT COUNT(*) as count FROM squares WHERE gameId = ? AND userId = ?'
    ).get(gameId, req.user.id);

    if (!userSquares || userSquares.count === 0) {
      return res.status(400).json({ message: 'You have no squares to pay for' });
    }

    // Check if already paid
    const existingPayment = db.prepare(
      "SELECT * FROM payments WHERE gameId = ? AND userId = ? AND status = 'completed'"
    ).get(gameId, req.user.id);

    if (existingPayment) {
      return res.status(400).json({ message: 'You have already paid for your squares' });
    }

    const amount = (game.costPerSquare * userSquares.count).toFixed(2);

    const gateway = getGateway();
    if (!gateway) {
      return res.status(503).json({ message: 'Payment processing is not configured' });
    }

    gateway.transaction.sale({
      amount: amount,
      paymentMethodNonce: paymentMethodNonce,
      options: {
        submitForSettlement: true,
      },
    }, (err, result) => {
      if (err) {
        console.error('Braintree transaction error:', err);
        return res.status(500).json({ message: 'Payment processing failed' });
      }

      if (result.success) {
        db.prepare(
          "INSERT INTO payments (gameId, userId, amount, squareCount, braintreeTransactionId, status) VALUES (?, ?, ?, ?, ?, 'completed')"
        ).run(gameId, req.user.id, parseFloat(amount), userSquares.count, result.transaction.id);

        return res.json({
          message: 'Payment successful',
          transactionId: result.transaction.id,
          amount: amount,
        });
      } else {
        return res.status(400).json({
          message: result.message || 'Payment failed',
        });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/payments/game/:id/status - Get payment status for all players in a game
router.get('/game/:id/status', auth, (req, res) => {
  try {
    const gameId = req.params.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Only creator can see all payment statuses
    if (game.creatorId !== req.user.id) {
      // Non-creators can only see their own
      const myPayment = db.prepare(
        "SELECT * FROM payments WHERE gameId = ? AND userId = ? AND status = 'completed'"
      ).get(gameId, req.user.id);
      return res.json({ myPayment: myPayment || null });
    }

    const payments = db.prepare(`
      SELECT p.*, u.firstName, u.lastName, u.email
      FROM payments p
      JOIN users u ON p.userId = u.id
      WHERE p.gameId = ?
      ORDER BY p.createdAt DESC
    `).all(gameId);

    // Get users who have squares but haven't paid
    const unpaidUsers = db.prepare(`
      SELECT DISTINCT u.id, u.firstName, u.lastName, u.email,
        (SELECT COUNT(*) FROM squares WHERE gameId = ? AND userId = u.id) as squareCount
      FROM squares s
      JOIN users u ON s.userId = u.id
      WHERE s.gameId = ? AND s.userId IS NOT NULL
        AND s.userId NOT IN (SELECT userId FROM payments WHERE gameId = ? AND status = 'completed')
    `).all(gameId, gameId, gameId);

    res.json({ payments, unpaidUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/payout - Creator initiates payout to winners
router.post('/payout', auth, (req, res) => {
  try {
    const { gameId, quarter, paypalEmail } = req.body;

    if (!gameId || !quarter) {
      return res.status(400).json({ message: 'Game ID and quarter are required' });
    }

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can initiate payouts' });
    }

    if (game.paymentType !== 'paid' || game.paymentMethod !== 'integrated') {
      return res.status(400).json({ message: 'This game does not use integrated payments' });
    }

    const winners = game.winners ? JSON.parse(game.winners) : {};
    const scores = game.scores ? JSON.parse(game.scores) : {};

    if (!winners[quarter] || !scores[quarter]) {
      return res.status(400).json({ message: `No winner for ${quarter}` });
    }

    // Check if payout already exists
    const existingPayout = db.prepare(
      "SELECT * FROM payouts WHERE gameId = ? AND quarter = ? AND status IN ('completed', 'pending')"
    ).get(gameId, quarter);

    if (existingPayout) {
      return res.status(400).json({ message: `Payout for ${quarter} has already been processed` });
    }

    // Calculate payout amount: total collected for this game divided by number of quarter winners
    const totalCollected = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE gameId = ? AND status = 'completed'"
    ).get(gameId).total;

    // Count how many quarters have winners
    const quarterCount = Object.values(winners).filter(Boolean).length;
    const payoutAmount = quarterCount > 0 ? (totalCollected / quarterCount).toFixed(2) : '0.00';

    // Find the winning user
    const numbersRow = JSON.parse(game.numbersRow);
    const numbersCol = JSON.parse(game.numbersCol);
    const rowLastDigit = scores[quarter].row % 10;
    const colLastDigit = scores[quarter].col % 10;
    const winRow = numbersRow.findIndex((pair) => pair.includes(rowLastDigit));
    const winCol = numbersCol.findIndex((pair) => pair.includes(colLastDigit));

    const winningSquare = db.prepare(
      'SELECT userId FROM squares WHERE gameId = ? AND row = ? AND col = ?'
    ).get(gameId, winRow, winCol);

    if (!winningSquare?.userId) {
      return res.status(400).json({ message: 'Winning square has no user' });
    }

    const gateway = getGateway();

    if (!gateway) {
      // Record payout as pending without Braintree (manual payout)
      db.prepare(
        "INSERT INTO payouts (gameId, userId, quarter, amount, status) VALUES (?, ?, ?, ?, 'pending')"
      ).run(gameId, winningSquare.userId, quarter, parseFloat(payoutAmount));

      return res.json({
        message: `Payout of $${payoutAmount} recorded for ${quarter} (manual distribution required - Braintree not configured)`,
        amount: payoutAmount,
      });
    }

    // For integrated payments with Braintree configured, use Braintree disbursement
    // Note: Braintree Marketplace/PayPal payouts require a sub-merchant account or PayPal payout
    // For simplicity, we record the payout and the creator handles it via Venmo
    db.prepare(
      "INSERT INTO payouts (gameId, userId, quarter, amount, status) VALUES (?, ?, ?, ?, 'completed')"
    ).run(gameId, winningSquare.userId, quarter, parseFloat(payoutAmount));

    return res.json({
      message: `Payout of $${payoutAmount} marked complete for ${quarter}`,
      amount: payoutAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/payments/game/:id/payouts - Get all payouts for a game
router.get('/game/:id/payouts', auth, (req, res) => {
  try {
    const gameId = req.params.id;

    const payouts = db.prepare(`
      SELECT p.*, u.firstName, u.lastName, u.email
      FROM payouts p
      JOIN users u ON p.userId = u.id
      WHERE p.gameId = ?
      ORDER BY p.createdAt DESC
    `).all(gameId);

    res.json(payouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
