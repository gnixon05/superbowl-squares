import { Router } from 'express';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// POST /api/games/:id/invite - Creator invites a user by email
router.post('/:id/invite', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can send invitations' });
    }

    // Check if user exists
    const invitedUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);

    // Check for duplicate invitation
    const existing = db.prepare('SELECT id FROM game_invitations WHERE gameId = ? AND invitedEmail = ?').get(gameId, email);
    if (existing) {
      return res.status(400).json({ message: 'User has already been invited' });
    }

    db.prepare(
      'INSERT INTO game_invitations (gameId, invitedEmail, invitedUserId) VALUES (?, ?, ?)'
    ).run(gameId, email, invitedUser?.id || null);

    const invitations = getGameInvitations(gameId);
    res.status(201).json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/games/:id/invite/:inviteId - Creator revokes an invitation
router.delete('/:id/invite/:inviteId', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const inviteId = req.params.inviteId;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can manage invitations' });
    }

    db.prepare('DELETE FROM game_invitations WHERE id = ? AND gameId = ?').run(inviteId, gameId);

    const invitations = getGameInvitations(gameId);
    res.json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/games/:id/invitations - Get all invitations for a game (creator only)
router.get('/:id/invitations', auth, (req, res) => {
  try {
    const gameId = req.params.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can view invitations' });
    }

    const invitations = getGameInvitations(gameId);
    res.json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/accept-invite - User accepts an invitation
router.post('/:id/accept-invite', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;

    const invitation = db.prepare(
      "SELECT * FROM game_invitations WHERE gameId = ? AND invitedEmail = ? AND status = 'pending'"
    ).get(gameId, userEmail);

    if (!invitation) {
      return res.status(404).json({ message: 'No pending invitation found' });
    }

    db.prepare(
      "UPDATE game_invitations SET status = 'accepted', invitedUserId = ? WHERE id = ?"
    ).run(req.user.id, invitation.id);

    res.json({ message: 'Invitation accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/decline-invite - User declines an invitation
router.post('/:id/decline-invite', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;

    const invitation = db.prepare(
      "SELECT * FROM game_invitations WHERE gameId = ? AND invitedEmail = ? AND status = 'pending'"
    ).get(gameId, userEmail);

    if (!invitation) {
      return res.status(404).json({ message: 'No pending invitation found' });
    }

    db.prepare("UPDATE game_invitations SET status = 'declined' WHERE id = ?").run(invitation.id);

    res.json({ message: 'Invitation declined' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/invitations/my-invitations - Get all pending invitations for the current user
router.get('/my-invitations', auth, (req, res) => {
  try {
    const userEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email;

    const invitations = db.prepare(`
      SELECT gi.*, g.name as gameName, g.teamRow, g.teamCol, g.status as gameStatus,
        u.firstName || ' ' || u.lastName as creatorName
      FROM game_invitations gi
      JOIN games g ON gi.gameId = g.id
      JOIN users u ON g.creatorId = u.id
      WHERE gi.invitedEmail = ? AND gi.status = 'pending'
      ORDER BY gi.createdAt DESC
    `).all(userEmail);

    res.json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/request-join - User requests to join a private game
router.post('/:id/request-join', auth, (req, res) => {
  try {
    const gameId = req.params.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status !== 'open') {
      return res.status(400).json({ message: 'Game is no longer accepting new players' });
    }

    // Check if already requested
    const existing = db.prepare('SELECT id FROM game_join_requests WHERE gameId = ? AND userId = ?').get(gameId, req.user.id);
    if (existing) {
      return res.status(400).json({ message: 'You have already requested to join this game' });
    }

    // Check if already has squares in the game
    const hasSquare = db.prepare('SELECT id FROM squares WHERE gameId = ? AND userId = ?').get(gameId, req.user.id);
    if (hasSquare) {
      return res.status(400).json({ message: 'You are already in this game' });
    }

    db.prepare('INSERT INTO game_join_requests (gameId, userId) VALUES (?, ?)').run(gameId, req.user.id);

    res.status(201).json({ message: 'Join request sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/games/:id/join-requests - Get join requests for a game (creator only)
router.get('/:id/join-requests', auth, (req, res) => {
  try {
    const gameId = req.params.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can view join requests' });
    }

    const requests = db.prepare(`
      SELECT jr.*, u.firstName, u.lastName, u.email, u.avatar
      FROM game_join_requests jr
      JOIN users u ON jr.userId = u.id
      WHERE jr.gameId = ?
      ORDER BY jr.createdAt DESC
    `).all(gameId);

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/approve-join/:requestId - Creator approves a join request
router.post('/:id/approve-join/:requestId', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const requestId = req.params.requestId;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can approve join requests' });
    }

    const joinReq = db.prepare(
      "SELECT * FROM game_join_requests WHERE id = ? AND gameId = ? AND status = 'pending'"
    ).get(requestId, gameId);

    if (!joinReq) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    db.prepare("UPDATE game_join_requests SET status = 'approved' WHERE id = ?").run(requestId);

    res.json({ message: 'Join request approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/deny-join/:requestId - Creator denies a join request
router.post('/:id/deny-join/:requestId', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const requestId = req.params.requestId;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can deny join requests' });
    }

    db.prepare("UPDATE game_join_requests SET status = 'denied' WHERE id = ? AND gameId = ?").run(requestId, gameId);

    res.json({ message: 'Join request denied' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

function getGameInvitations(gameId) {
  return db.prepare(`
    SELECT gi.*, u.firstName, u.lastName
    FROM game_invitations gi
    LEFT JOIN users u ON gi.invitedUserId = u.id
    WHERE gi.gameId = ?
    ORDER BY gi.createdAt DESC
  `).all(gameId);
}

export default router;
