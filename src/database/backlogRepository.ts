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
