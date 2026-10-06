import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { saveReaction } from '../../src/database/backlogRepository.js';

function openTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync('src/database/schema.sql', 'utf-8'));
  return db;
}

const BASE = {
  userId: 'u1',
  messageId: 'm1',
  channelId: 'c1',
  authorId: 'a1',
  rawContent: 'mira https://banda.bandcamp.com/album/x',
  url: 'https://banda.bandcamp.com/album/x',
  artist: 'Banda',
  title: 'Disco',
  coverUrl: 'https://img.com/c.jpg',
  genreRole: 'Techno',
};

describe('RF-08 backlog repository', () => {
  it('da de alta usuario, release y entrada pending', () => {
    const db = openTestDb();
    const result = saveReaction(db, BASE);
    expect(result.reopened).toBe(false);
    const row = db.prepare('SELECT status FROM user_backlog WHERE id = ?').get(result.backlogId) as { status: string };
    expect(row.status).toBe('pending');
    const rel = db.prepare('SELECT artist, title, genre_role FROM releases WHERE id = ?').get(result.releaseId) as {
      artist: string; title: string; genre_role: string;
    };
    expect(rel).toEqual({ artist: 'Banda', title: 'Disco', genre_role: 'Techno' });
  });

  it('la misma reacción dos veces no duplica', () => {
    const db = openTestDb();
    const first = saveReaction(db, BASE);
    const second = saveReaction(db, BASE);
    expect(second.releaseId).toBe(first.releaseId);
    expect(second.backlogId).toBe(first.backlogId);
    expect(db.prepare('SELECT COUNT(*) AS n FROM releases').get() as { n: number }).toEqual({ n: 1 });
  });

  it('reabre a pending una entrada listened', () => {
    const db = openTestDb();
    const first = saveReaction(db, BASE);
    db.prepare("UPDATE user_backlog SET status = 'listened', listened_at = datetime('now') WHERE id = ?").run(first.backlogId);
    const second = saveReaction(db, BASE);
    expect(second.reopened).toBe(true);
    const row = db.prepare('SELECT status, listened_at FROM user_backlog WHERE id = ?').get(first.backlogId) as {
      status: string; listened_at: string | null;
    };
    expect(row.status).toBe('pending');
    expect(row.listened_at).toBeNull();
  });

  it('dos usuarios con la misma URL comparten release', () => {
    const db = openTestDb();
    const first = saveReaction(db, BASE);
    const second = saveReaction(db, { ...BASE, userId: 'u2', messageId: 'm2' });
    expect(second.releaseId).toBe(first.releaseId);
    expect(db.prepare('SELECT COUNT(*) AS n FROM releases').get() as { n: number }).toEqual({ n: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM user_backlog').get() as { n: number }).toEqual({ n: 2 });
  });

  it('texto sin URL crea releases separadas', () => {
    const db = openTestDb();
    const plain = { ...BASE, messageId: 'm1', url: null, artist: null, title: 'texto', coverUrl: null };
    const first = saveReaction(db, plain);
    const second = saveReaction(db, { ...plain, messageId: 'm2' });
    expect(second.releaseId).not.toBe(first.releaseId);
  });
});
