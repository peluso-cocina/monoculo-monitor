import type Database from 'better-sqlite3';

export interface SaveReactionInput {
  userId: string;
  messageId: string;
  channelId: string;
  authorId: string;
  rawContent: string;
  url: string | null;
  artist: string | null;
  title: string | null;
  coverUrl: string | null;
  genreRole: string | null;
}

export interface SaveReactionResult {
  releaseId: number;
  backlogId: number;
  reopened: boolean;
}

export interface PendingBacklogRow {
  backlogId: number;
  releaseId: number;
  artist: string | null;
  title: string | null;
  url: string | null;
  coverUrl: string | null;
  genreRole: string | null;
  addedAt: string;
}

export function getPendingBacklog(db: Database.Database, userId: string): PendingBacklogRow[] {
  return db
    .prepare(
      `SELECT b.id AS backlogId, b.release_id AS releaseId, r.artist, r.title, r.url,
              r.cover_url AS coverUrl, r.genre_role AS genreRole, b.added_at AS addedAt
         FROM user_backlog b JOIN releases r ON r.id = b.release_id
        WHERE b.user_id = ? AND b.status = 'pending'
        ORDER BY b.added_at DESC, b.id DESC`,
    )
    .all(userId) as PendingBacklogRow[];
}

export function markListened(db: Database.Database, userId: string, backlogIds: number[]): number {
  if (backlogIds.length === 0) return 0;
  const placeholders = backlogIds.map(() => '?').join(',');
  const info = db
    .prepare(
      `UPDATE user_backlog SET status = 'listened', listened_at = datetime('now')
        WHERE user_id = ? AND status = 'pending' AND id IN (${placeholders})`,
    )
    .run(userId, ...backlogIds);
  return Number(info.changes);
}

export function saveReaction(db: Database.Database, input: SaveReactionInput): SaveReactionResult {
  const run = db.transaction((): SaveReactionResult => {
    db.prepare('INSERT OR IGNORE INTO users(id) VALUES(?)').run(input.userId);

    const existingRelease = db
      .prepare(
        'SELECT id FROM releases WHERE message_id = ? OR (url IS NOT NULL AND url = ?) LIMIT 1',
      )
      .get(input.messageId, input.url) as { id: number } | undefined;

    let releaseId: number;
    if (existingRelease) {
      releaseId = existingRelease.id;
    } else {
      const info = db
        .prepare(
          'INSERT INTO releases(message_id, channel_id, author_id, raw_content, url, artist, title, cover_url, genre_role) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .run(
          input.messageId,
          input.channelId,
          input.authorId,
          input.rawContent,
          input.url,
          input.artist,
          input.title,
          input.coverUrl,
          input.genreRole,
        );
      releaseId = Number(info.lastInsertRowid);
    }

    const existingEntry = db
      .prepare('SELECT id, status FROM user_backlog WHERE user_id = ? AND release_id = ?')
      .get(input.userId, releaseId) as { id: number; status: string } | undefined;

    if (existingEntry) {
      const reopened = existingEntry.status !== 'pending';
      if (reopened) {
        db.prepare("UPDATE user_backlog SET status = 'pending', listened_at = NULL WHERE id = ?").run(
          existingEntry.id,
        );
      }
      return { releaseId, backlogId: existingEntry.id, reopened };
    }

    const info = db
      .prepare("INSERT INTO user_backlog(user_id, release_id, status) VALUES(?,?,'pending')")
      .run(input.userId, releaseId);
    return { releaseId, backlogId: Number(info.lastInsertRowid), reopened: false };
  });
  return run();
}
