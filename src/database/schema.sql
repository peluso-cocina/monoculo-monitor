-- Music Backlog Bot — SQLite schema
-- WAL + foreign keys are enabled at runtime in client.ts

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT,
  channel_id TEXT,
  author_id TEXT,
  raw_content TEXT,
  url TEXT,
  artist TEXT,
  title TEXT,
  cover_url TEXT,
  genre_role TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_backlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  release_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'listened')),
  added_at DATETIME NOT NULL DEFAULT (datetime('now')),
  listened_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
  UNIQUE(user_id, release_id)
);

CREATE INDEX IF NOT EXISTS idx_user_backlog_user_status
  ON user_backlog(user_id, status);

CREATE INDEX IF NOT EXISTS idx_releases_message
  ON releases(message_id);
