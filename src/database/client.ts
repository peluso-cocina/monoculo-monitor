import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let db: Database.Database | null = null;

function resolveDatabasePath(): string {
  return process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'database.sqlite');
}

function loadSchema(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/database/client.js -> dist/database/schema.sql
  // src/database/client.ts  -> src/database/schema.sql
  const candidates = [
    join(here, 'schema.sql'),
    join(process.cwd(), 'src', 'database', 'schema.sql'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8');
    }
  }
  throw new Error('schema.sql not found');
}

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = resolveDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });

  const instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  instance.exec(loadSchema());

  db = instance;
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
