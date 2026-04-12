import Database from 'better-sqlite3';
import path from 'path';

let db;

function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'social-pvot.db');
    const fs = require('fs');
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeDb(db);
  }
  return db;
}

function initializeDb(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      platform TEXT NOT NULL DEFAULT 'instagram',
      platform_user_id TEXT,
      username TEXT,
      profile_picture TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at INTEGER,
      mode TEXT NOT NULL DEFAULT 'oauth',
      status TEXT NOT NULL DEFAULT 'pending',
      connected_at TEXT DEFAULT (datetime('now')),
      last_fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE(platform, platform_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL DEFAULT 'instagram',
      platform_post_id TEXT,
      account_id INTEGER,
      post_type TEXT DEFAULT 'post',
      media_type TEXT,
      media_url TEXT,
      thumbnail_url TEXT,
      caption TEXT,
      permalink TEXT,
      likes_count INTEGER DEFAULT 0,
      timestamp TEXT,
      source TEXT DEFAULT 'api',
      cached_at TEXT DEFAULT (datetime('now')),
      UNIQUE(platform, platform_post_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      columns INTEGER DEFAULT 4,
      theme TEXT DEFAULT 'dark',
      posts_per_page INTEGER DEFAULT 24
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `);

  // Migrations for old DB schema
  runMigrations(database);
}

function runMigrations(database) {
  // --- Migration: old ig_user_id → platform_user_id (accounts) ---
  try {
    const accountCols = database.pragma("table_info(accounts)");
    const colNames = accountCols.map(c => c.name);

    if (colNames.includes('ig_user_id') && !colNames.includes('platform_user_id')) {
      database.exec(`ALTER TABLE accounts RENAME TO accounts_old;`);
      database.exec(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          platform TEXT NOT NULL DEFAULT 'instagram',
          platform_user_id TEXT,
          username TEXT,
          profile_picture TEXT,
          access_token TEXT,
          refresh_token TEXT,
          token_expires_at INTEGER,
          mode TEXT NOT NULL DEFAULT 'oauth',
          status TEXT NOT NULL DEFAULT 'approved',
          connected_at TEXT DEFAULT (datetime('now')),
          last_fetched_at TEXT DEFAULT (datetime('now')),
          UNIQUE(platform, platform_user_id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
      database.exec(`
        INSERT INTO accounts (platform, platform_user_id, username, profile_picture, access_token, token_expires_at, connected_at, last_fetched_at, mode, status)
        SELECT 'instagram', ig_user_id, username, profile_picture, access_token, token_expires_at, connected_at, last_fetched_at, 'oauth', 'approved'
        FROM accounts_old;
      `);
      database.exec(`DROP TABLE accounts_old;`);
    }
  } catch (e) {
    // Table might not exist yet
  }

  // --- Migration: add mode, status columns if missing ---
  try {
    const accountCols = database.pragma("table_info(accounts)");
    const colNames = accountCols.map(c => c.name);

    if (!colNames.includes('mode')) {
      database.exec(`ALTER TABLE accounts ADD COLUMN mode TEXT NOT NULL DEFAULT 'oauth';`);
    }
    if (!colNames.includes('status')) {
      database.exec(`ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';`);
      // Mark all existing accounts as approved
      database.exec(`UPDATE accounts SET status = 'approved' WHERE status = 'pending';`);
    }
    if (!colNames.includes('user_id')) {
      database.exec(`ALTER TABLE accounts ADD COLUMN user_id INTEGER;`);
    }
  } catch (e) {
    // Columns already exist
  }

  // --- Migration: add source column to posts if missing ---
  try {
    const postCols = database.pragma("table_info(posts)");
    const postColNames = postCols.map(c => c.name);

    if (!postColNames.includes('source')) {
      database.exec(`ALTER TABLE posts ADD COLUMN source TEXT DEFAULT 'api';`);
    }

    // Legacy migration: ig_post_id → platform_post_id
    if (postColNames.includes('ig_post_id') && !postColNames.includes('platform_post_id')) {
      database.exec(`ALTER TABLE posts RENAME TO posts_old;`);
      database.exec(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL DEFAULT 'instagram',
          platform_post_id TEXT,
          account_id INTEGER,
          post_type TEXT DEFAULT 'post',
          media_type TEXT,
          media_url TEXT,
          thumbnail_url TEXT,
          caption TEXT,
          permalink TEXT,
          likes_count INTEGER DEFAULT 0,
          timestamp TEXT,
          source TEXT DEFAULT 'api',
          cached_at TEXT DEFAULT (datetime('now')),
          UNIQUE(platform, platform_post_id),
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        );
      `);
      database.exec(`
        INSERT INTO posts (platform, platform_post_id, account_id, media_type, media_url, thumbnail_url, caption, permalink, timestamp, cached_at, source)
        SELECT 'instagram', ig_post_id, account_id, media_type, media_url, thumbnail_url, caption, permalink, timestamp, cached_at, 'api'
        FROM posts_old;
      `);
      database.exec(`DROP TABLE posts_old;`);
    }
  } catch (e) {
    // Table might not exist yet
  }
}

export default getDb;
