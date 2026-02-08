import { Router } from 'express';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

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
  game.numbersRow = game.numbersRow ? JSON.parse(game.numbersRow) : null;
  game.numbersCol = game.numbersCol ? JSON.parse(game.numbersCol) : null;

  return game;
}

// POST /api/games - Create a new game
router.post('/', auth, (req, res) => {
  try {
    const { name, teamRow, teamCol, isPublic } = req.body;

    if (!name || !teamRow || !teamCol) {
      return res.status(400).json({ message: 'Game name and both team names are required' });
    }

    const gridSize = 5;

    const result = db.prepare(
      'INSERT INTO games (name, creatorId, teamRow, teamCol, gridSize, isPublic) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, req.user.id, teamRow, teamCol, gridSize, isPublic !== false ? 1 : 0);

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

// GET /api/games - List games
router.get('/', auth, (req, res) => {
  try {
    const games = db.prepare(`
      SELECT g.*, u.firstName || ' ' || u.lastName as creatorName,
        (SELECT COUNT(*) FROM squares WHERE gameId = g.id AND userId IS NOT NULL) as claimedSquares,
        (g.gridSize * g.gridSize) as totalSquares
      FROM games g
      JOIN users u ON g.creatorId = u.id
      WHERE g.isPublic = 1 OR g.creatorId = ?
      ORDER BY g.createdAt DESC
    `).all(req.user.id);

    // Parse JSON fields
    for (const game of games) {
      game.numbersRow = game.numbersRow ? JSON.parse(game.numbersRow) : null;
      game.numbersCol = game.numbersCol ? JSON.parse(game.numbersCol) : null;
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
    // Games I created or have squares in
    const games = db.prepare(`
      SELECT DISTINCT g.*, u.firstName || ' ' || u.lastName as creatorName,
        (SELECT COUNT(*) FROM squares WHERE gameId = g.id AND userId IS NOT NULL) as claimedSquares,
        (g.gridSize * g.gridSize) as totalSquares
      FROM games g
      JOIN users u ON g.creatorId = u.id
      LEFT JOIN squares s ON s.gameId = g.id AND s.userId = ?
      WHERE g.creatorId = ? OR s.userId = ?
      ORDER BY g.createdAt DESC
    `).all(req.user.id, req.user.id, req.user.id);

    for (const game of games) {
      game.numbersRow = game.numbersRow ? JSON.parse(game.numbersRow) : null;
      game.numbersCol = game.numbersCol ? JSON.parse(game.numbersCol) : null;
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
      game.numbersRow = game.numbersRow ? JSON.parse(game.numbersRow) : null;
      game.numbersCol = game.numbersCol ? JSON.parse(game.numbersCol) : null;
    }

    const topPlayers = db.prepare(`
      SELECT u.id, u.firstName, u.lastName, u.avatar,
        COUNT(DISTINCT s.gameId) as gamesPlayed,
        (SELECT COUNT(*) FROM games WHERE winner = u.firstName || ' ' || u.lastName AND status = 'completed') as wins
      FROM users u
      JOIN squares s ON s.userId = u.id
      GROUP BY u.id
      ORDER BY wins DESC, gamesPlayed DESC
      LIMIT 10
    `).all();

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
    res.json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/pick - Pick a square
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

    // Only allow the user who picked it or the game creator to unpick
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
      "UPDATE games SET status = 'locked', numbersRow = ?, numbersCol = ?, lockedAt = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(numbersRow), JSON.stringify(numbersCol), gameId);

    const updatedGame = getGameWithSquares(gameId);
    res.json(updatedGame);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/games/:id/complete - Set score and complete the game
router.post('/:id/complete', auth, (req, res) => {
  try {
    const gameId = req.params.id;
    const { rowScore, colScore } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the game creator can complete the game' });
    }

    if (game.status !== 'locked') {
      return res.status(400).json({ message: 'Game must be locked before completing' });
    }

    if (rowScore === undefined || colScore === undefined) {
      return res.status(400).json({ message: 'Both scores are required' });
    }

    // Find the winning square based on last digits of scores
    // Each entry in numbersRow/Col is a pair like [2, 7]
    const numbersRow = JSON.parse(game.numbersRow);
    const numbersCol = JSON.parse(game.numbersCol);
    const rowLastDigit = rowScore % 10;
    const colLastDigit = colScore % 10;

    const winRow = numbersRow.findIndex((pair) => pair.includes(rowLastDigit));
    const winCol = numbersCol.findIndex((pair) => pair.includes(colLastDigit));

    let winnerName = null;
    if (winRow !== -1 && winCol !== -1) {
      const winningSquare = db.prepare(
        'SELECT s.*, u.firstName, u.lastName FROM squares s LEFT JOIN users u ON s.userId = u.id WHERE s.gameId = ? AND s.row = ? AND s.col = ?'
      ).get(gameId, winRow, winCol);
      if (winningSquare && winningSquare.firstName) {
        winnerName = `${winningSquare.firstName} ${winningSquare.lastName}`;
      }
    }

    db.prepare(
      "UPDATE games SET status = 'completed', rowScore = ?, colScore = ?, winner = ?, completedAt = datetime('now') WHERE id = ?"
    ).run(rowScore, colScore, winnerName, gameId);

    const updatedGame = getGameWithSquares(gameId);
    res.json(updatedGame);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
