import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'superbowl_squares.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hasColumn(table, column) {
  const cols = db.pragma(`table_info(${table})`);
  return cols.some((c) => c.name === column);
}

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      creatorId INTEGER NOT NULL,
      teamRow TEXT NOT NULL,
      teamCol TEXT NOT NULL,
      gridSize INTEGER DEFAULT 5,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'locked', 'completed')),
      isPublic INTEGER DEFAULT 1,
      numbersRow TEXT DEFAULT NULL,
      numbersCol TEXT DEFAULT NULL,
      scores TEXT DEFAULT NULL,
      winners TEXT DEFAULT NULL,
      currentQuarter TEXT DEFAULT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      lockedAt TEXT DEFAULT NULL,
      completedAt TEXT DEFAULT NULL,
      FOREIGN KEY (creatorId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS squares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      userId INTEGER DEFAULT NULL,
      claimedAt TEXT DEFAULT NULL,
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(gameId, row, col)
    );

    CREATE TABLE IF NOT EXISTS game_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER NOT NULL,
      invitedEmail TEXT NOT NULL,
      invitedUserId INTEGER DEFAULT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (invitedUserId) REFERENCES users(id),
      UNIQUE(gameId, invitedEmail)
    );

    CREATE TABLE IF NOT EXISTS game_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(gameId, userId)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      amount REAL NOT NULL,
      squareCount INTEGER NOT NULL DEFAULT 1,
      braintreeTransactionId TEXT DEFAULT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'refunded')),
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      quarter TEXT NOT NULL,
      amount REAL NOT NULL,
      braintreeTransactionId TEXT DEFAULT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  // Add payment and invitation columns to games table
  if (!hasColumn('games', 'paymentType')) {
    db.exec("ALTER TABLE games ADD COLUMN paymentType TEXT DEFAULT 'free' CHECK(paymentType IN ('free', 'paid'))");
  }
  if (!hasColumn('games', 'paymentMethod')) {
    db.exec("ALTER TABLE games ADD COLUMN paymentMethod TEXT DEFAULT NULL CHECK(paymentMethod IN ('integrated', 'offline'))");
  }
  if (!hasColumn('games', 'costPerSquare')) {
    db.exec('ALTER TABLE games ADD COLUMN costPerSquare REAL DEFAULT 0');
  }
  if (!hasColumn('games', 'venmoUsername')) {
    db.exec('ALTER TABLE games ADD COLUMN venmoUsername TEXT DEFAULT NULL');
  }

  // Migrate from old single-winner schema to per-quarter schema
  if (!hasColumn('games', 'scores')) {
    db.exec('ALTER TABLE games ADD COLUMN scores TEXT DEFAULT NULL');
  }
  if (!hasColumn('games', 'winners')) {
    db.exec('ALTER TABLE games ADD COLUMN winners TEXT DEFAULT NULL');
  }
  if (!hasColumn('games', 'currentQuarter')) {
    db.exec('ALTER TABLE games ADD COLUMN currentQuarter TEXT DEFAULT NULL');
  }

  // Migrate any existing completed games that used the old columns
  if (hasColumn('games', 'rowScore')) {
    const oldGames = db.prepare(
      "SELECT id, rowScore, colScore, winner FROM games WHERE status = 'completed' AND rowScore IS NOT NULL AND scores IS NULL"
    ).all();
    const update = db.prepare('UPDATE games SET scores = ?, winners = ? WHERE id = ?');
    for (const g of oldGames) {
      const scores = { final: { row: g.rowScore, col: g.colScore } };
      const winners = { final: g.winner };
      update.run(JSON.stringify(scores), JSON.stringify(winners), g.id);
    }
  }
}

export default db;
