import { Router } from 'express';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

const QUARTERS = ['q1', 'q2', 'q3', 'final'];
const QUARTER_LABELS = { q1: 'Q1', q2: 'Q2', q3: 'Q3', final: 'Final' };

function generateNumberPairs(gridSize) {
  // Shuffle all 10 digits then deal them into pairs for each grid position
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  const pairs = [];
  for (let i = 0; i < gridSize; i++) {
    pairs.push([digits[i * 2], digits[i * 2 + 1]].sort((a, b) => a - b));
  }
  return pairs;
}

function findWinner(gameId, numbersRow, numbersCol, rowScore, colScore) {
  const rowLastDigit = rowScore % 10;
  const colLastDigit = colScore % 10;
  const winRow = numbersRow.findIndex((pair) => pair.includes(rowLastDigit));
  const winCol = numbersCol.findIndex((pair) => pair.includes(colLastDigit));

  if (winRow === -1 || winCol === -1) return null;

  const winningSquare = db.prepare(
    'SELECT s.*, u.firstName, u.lastName FROM squares s LEFT JOIN users u ON s.userId = u.id WHERE s.gameId = ? AND s.row = ? AND s.col = ?'
  ).get(gameId, winRow, winCol);

  if (winningSquare && winningSquare.firstName) {
    return `${winningSquare.firstName} ${winningSquare.lastName}`;
  }
  return null;
}

function parseGameJSON(game) {
  game.numbersRow = game.numbersRow ? JSON.parse(game.numbersRow) : null;
  game.numbersCol = game.numbersCol ? JSON.parse(game.numbersCol) : null;
  game.scores = game.scores ? JSON.parse(game.scores) : {};
  game.winners = game.winners ? JSON.parse(game.winners) : {};
  return game;
}

function getGameWithSquares(gameId) {
  const game = db.prepare(`
    SELECT g.*, u.firstName || ' ' || u.lastName as creatorName
    FROM games g
    JOIN users u ON g.creatorId = u.id
    WHERE g.id = ?
  `).get(gameId);

  if (!game) return null;

  const squares = db.prepare(`
    SELECT s.*, u.firstName, u.lastName, u.avatar
    FROM squares s
    LEFT JOIN users u ON s.userId = u.id
    WHERE s.gameId = ?
    ORDER BY s.row, s.col
  `).all(gameId);

  game.squares = squares;
  parseGameJSON(game);

  return game;
}

// POST /api/games - Create a new game
router.post('/', auth, (req, res) => {
  try {
    const { name, teamRow, teamCol, isPublic, paymentType, paymentMethod, costPerSquare, venmoUsername } = req.body;

    if (!name || !teamRow || !teamCol) {
      return res.status(400).json({ message: 'Game name and both team names are required' });
    }

    const gridSize = 5;
    const pType = paymentType === 'paid' ? 'paid' : 'free';
    const pMethod = pType === 'paid' ? (paymentMethod === 'integrated' ? 'integrated' : 'offline') : null;
    const cost = pType === 'paid' ? (parseFloat(costPerSquare) || 0) : 0;
    const venmo = pType === 'paid' && pMethod === 'integrated' ? (venmoUsername || null) : null;

    const result = db.prepare(
      'INSERT INTO games (name, creatorId, teamRow, teamCol, gridSize, isPublic, paymentType, paymentMethod, costPerSquare, venmoUsername) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, req.user.id, teamRow, teamCol, gridSize, isPublic !== false ? 1 : 0, pType, pMethod, cost, venmo);

    // Create empty squares for the grid
    const insertSquare = db.prepare('INSERT INTO squares (gameId, row, col) VALUES (?, ?, ?)');
    const insertMany = db.transaction(() => {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          insertSquare.run(result.lastInsertRowid, r, c);
        }
      }
    });
    insertMany();

    const game = getGameWithSquares(result.lastInsertRowid);
    res.status(201).json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/games - List games (public + games user is invited to or has been approved)
router.get('/', auth, (req, res) => {
  try {
    const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;

    const games = db.prepare(`
      SELECT DISTINCT g.*, u.firstName || ' ' || u.lastName as creatorName,
        (SELECT COUNT(*) FROM squares WHERE gameId = g.id AND userId IS NOT NULL) as claimedSquares,
        (g.gridSize * g.gridSize) as totalSquares
      FROM games g
      JOIN users u ON g.creatorId = u.id
      LEFT JOIN game_invitations gi ON gi.gameId = g.id AND gi.invitedEmail = ? AND gi.status IN ('pending', 'accepted')
      LEFT JOIN game_join_requests jr ON jr.gameId = g.id AND jr.userId = ? AND jr.status = 'approved'
      WHERE g.isPublic = 1 OR g.creatorId = ? OR gi.id IS NOT NULL OR jr.id IS NOT NULL
      ORDER BY g.createdAt DESC
    `).all(userEmail, req.user.id, req.user.id);

    for (const game of games) {
      parseGameJSON(game);
    }

    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/games/my-games
router.get('/my-games', auth, (req, res) => {
  try {
    const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;

    const games = db.prepare(`
      SELECT DISTINCT g.*, u.firstName || ' ' || u.lastName as creatorName,
        (SELECT COUNT(*) FROM squares WHERE gameId = g.id AND userId IS NOT NULL) as claimedSquares,
        (g.gridSize * g.gridSize) as totalSquares
      FROM games g
      JOIN users u ON g.creatorId = u.id
      LEFT JOIN squares s ON s.gameId = g.id AND s.userId = ?
      LEFT JOIN game_invitations gi ON gi.gameId = g.id AND gi.invitedEmail = ? AND gi.status = 'accepted'
      LEFT JOIN game_join_requests jr ON jr.gameId = g.id AND jr.userId = ? AND jr.status = 'approved'
      WHERE g.creatorId = ? OR s.userId = ? OR gi.id IS NOT NULL OR jr.id IS NOT NULL
      ORDER BY g.createdAt DESC
    `).all(req.user.id, userEmail, req.user.id, req.user.id, req.user.id);

    for (const game of games) {
      parseGameJSON(game);
    }

    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/games/stats/all - Get stats across all games
// NOTE: Must be before /:id to avoid matching "stats" as an id
router.get('/stats/all', auth, (req, res) => {
  try {
    const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    const completedGames = db.prepare("SELECT COUNT(*) as count FROM games WHERE status = 'completed'").get().count;
    const activeGames = db.prepare("SELECT COUNT(*) as count FROM games WHERE status IN ('open', 'locked')").get().count;

    const recentCompleted = db.prepare(`
      SELECT g.*, u.firstName || ' ' || u.lastName as creatorName
      FROM games g
      JOIN users u ON g.creatorId = u.id
      WHERE g.status = 'completed'
      ORDER BY g.completedAt DESC
      LIMIT 10
    `).all();

    for (const game of recentCompleted) {
      parseGameJSON(game);
    }

    // Count quarter wins per player from the winners JSON
    // We need to scan all completed games and tally wins from the JSON
    const completedRows = db.prepare(
      "SELECT winners FROM games WHERE status = 'completed' AND winners IS NOT NULL"
    ).all();

    const winCounts = {};
    for (const row of completedRows) {
      const winners = JSON.parse(row.winners);
      for (const q of QUARTERS) {
        if (winners[q]) {
          winCounts[winners[q]] = (winCounts[winners[q]] || 0) + 1;
        }
      }
    }

    // Get user info for top winners
    const allUsers = db.prepare(
      'SELECT u.id, u.firstName, u.lastName, u.avatar, COUNT(DISTINCT s.gameId) as gamesPlayed FROM users u JOIN squares s ON s.userId = u.id GROUP BY u.id'
    ).all();

    const topPlayers = allUsers.map((u) => ({
      ...u,
      wins: winCounts[`${u.firstName} ${u.lastName}`] || 0,
    })).sort((a, b) => b.wins - a.gamesPlayed || b.gamesPlayed - a.gamesPlayed).slice(0, 10);

    // Sort: most wins first, then most games played
    topPlayers.sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed);

    res.json({
      totalGames,
      completedGames,
      activeGames,
      recentCompleted,
      topPlayers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/games/:id
router.get('/:id', auth, (req, res) => {
  try {
    const game = getGameWithSquares(req.params.id);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // For private games, check if user has access
    if (!game.isPublic && game.creatorId !== req.user.id) {
      const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;
      const hasInvite = db.prepare(
        "SELECT id FROM game_invitations WHERE gameId = ? AND invitedEmail = ? AND status IN ('pending', 'accepted')"
      ).get(game.id, userEmail);
      const hasApproval = db.prepare(
        "SELECT id FROM game_join_requests WHERE gameId = ? AND userId = ? AND status = 'approved'"
      ).get(game.id, req.user.id);
      const hasSquare = db.prepare('SELECT id FROM squares WHERE gameId = ? AND userId = ?').get(game.id, req.user.id);

      if (!hasInvite && !hasApproval && !hasSquare) {
        return res.status(403).json({ message: 'You do not have access to this private game' });
      }
    }

    // Include user's access info for the frontend
    const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;
    game.userInvitation = db.prepare(
      "SELECT * FROM game_invitations WHERE gameId = ? AND invitedEmail = ?"
    ).get(game.id, userEmail) || null;
    game.userJoinRequest = db.prepare(
      "SELECT * FROM game_join_requests WHERE gameId = ? AND userId = ?"
    ).get(game.id, req.user.id) || null;

    // Include payment status for the current user
    game.userPayment = db.prepare(
      "SELECT * FROM payments WHERE gameId = ? AND userId = ? AND status = 'completed'"
    ).get(game.id, req.user.id) || null;

    res.json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/pick - Pick a square (adds to pending selections for paid games, or claims directly for free)
router.post('/:id/pick', auth, (req, res) => {
  try {
    const { row, col } = req.body;
    const gameId = req.params.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status !== 'open') {
      return res.status(400).json({ message: 'Game is no longer accepting picks' });
    }

    // For private games, check access
    if (!game.isPublic && game.creatorId !== req.user.id) {
      const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;
      const hasInvite = db.prepare(
        "SELECT id FROM game_invitations WHERE gameId = ? AND invitedEmail = ? AND status = 'accepted'"
      ).get(gameId, userEmail);
      const hasApproval = db.prepare(
        "SELECT id FROM game_join_requests WHERE gameId = ? AND userId = ? AND status = 'approved'"
      ).get(gameId, req.user.id);

      if (!hasInvite && !hasApproval) {
        return res.status(403).json({ message: 'You must be invited or approved to pick squares in this game' });
      }
    }

    const square = db.prepare('SELECT * FROM squares WHERE gameId = ? AND row = ? AND col = ?').get(gameId, row, col);
    if (!square) {
      return res.status(404).json({ message: 'Square not found' });
    }

    if (square.userId) {
      return res.status(400).json({ message: 'Square is already taken' });
    }

    db.prepare(
      "UPDATE squares SET userId = ?, claimedAt = datetime('now') WHERE gameId = ? AND row = ? AND col = ?"
    ).run(req.user.id, gameId, row, col);

    const updatedGame = getGameWithSquares(gameId);
    res.json(updatedGame);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/unpick - Remove pick from a square
router.post('/:id/unpick', auth, (req, res) => {
  try {
    const { row, col } = req.body;
    const gameId = req.params.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status !== 'open') {
      return res.status(400).json({ message: 'Game is locked, cannot remove picks' });
    }

    const square = db.prepare('SELECT * FROM squares WHERE gameId = ? AND row = ? AND col = ?').get(gameId, row, col);
    if (!square) {
      return res.status(404).json({ message: 'Square not found' });
    }

    if (square.userId !== req.user.id && game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to remove this pick' });
    }

    db.prepare(
      'UPDATE squares SET userId = NULL, claimedAt = NULL WHERE gameId = ? AND row = ? AND col = ?'
    ).run(gameId, row, col);

    const updatedGame = getGameWithSquares(gameId);
    res.json(updatedGame);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/lock - Lock the board and generate numbers
router.post('/:id/lock', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can lock the board' });
    }

    if (game.status !== 'open') {
      return res.status(400).json({ message: 'Game is already locked or completed' });
    }

    const numbersRow = generateNumberPairs(game.gridSize);
    const numbersCol = generateNumberPairs(game.gridSize);

    db.prepare(
      "UPDATE games SET status = 'locked', numbersRow = ?, numbersCol = ?, currentQuarter = 'q1', lockedAt = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(numbersRow), JSON.stringify(numbersCol), gameId);

    const updatedGame = getGameWithSquares(gameId);
    res.json(updatedGame);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/score - Enter score for the current quarter
router.post('/:id/score', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const { rowScore, colScore } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can enter scores' });
    }

    if (game.status !== 'locked') {
      return res.status(400).json({ message: 'Game must be locked to enter scores' });
    }

    const currentQuarter = game.currentQuarter;
    if (!currentQuarter || !QUARTERS.includes(currentQuarter)) {
      return res.status(400).json({ message: 'Game scoring is already complete' });
    }

    if (rowScore === undefined || colScore === undefined) {
      return res.status(400).json({ message: 'Both scores are required' });
    }

    const numbersRow = JSON.parse(game.numbersRow);
    const numbersCol = JSON.parse(game.numbersCol);

    // Determine winner for this quarter
    const winnerName = findWinner(gameId, numbersRow, numbersCol, rowScore, colScore);

    // Update scores and winners
    const scores = game.scores ? JSON.parse(game.scores) : {};
    const winners = game.winners ? JSON.parse(game.winners) : {};

    scores[currentQuarter] = { row: rowScore, col: colScore };
    winners[currentQuarter] = winnerName;

    // Advance to next quarter or complete
    const currentIdx = QUARTERS.indexOf(currentQuarter);
    const isLast = currentIdx === QUARTERS.length - 1;
    const nextQuarter = isLast ? null : QUARTERS[currentIdx + 1];

    if (isLast) {
      db.prepare(
        "UPDATE games SET status = 'completed', scores = ?, winners = ?, currentQuarter = NULL, completedAt = datetime('now') WHERE id = ?"
      ).run(JSON.stringify(scores), JSON.stringify(winners), gameId);
    } else {
      db.prepare(
        'UPDATE games SET scores = ?, winners = ?, currentQuarter = ? WHERE id = ?'
      ).run(JSON.stringify(scores), JSON.stringify(winners), nextQuarter, gameId);
    }

    const updatedGame = getGameWithSquares(gameId);
    res.json(updatedGame);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
