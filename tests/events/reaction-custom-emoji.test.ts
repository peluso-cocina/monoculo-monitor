import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/database/client.js', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync('src/database/schema.sql', 'utf-8'));
  return { getDatabase: () => db, closeDatabase: () => undefined };
});

async function countBacklog(): Promise<number> {
  const { getDatabase } = await import('../../src/database/client.js');
  const row = getDatabase().prepare('SELECT COUNT(*) AS n FROM user_backlog').get() as { n: number };
  return row.n;
}

function mockReaction(emoji: { name: string | null; id: string | null }) {
  return {
    emoji,
    partial: false,
    message: {
      id: 'msg-bug',
      channelId: 'ch-bug',
      guildId: 'g-bug',
      author: { id: 'author-bug', bot: false },
      partial: false,
      content: 'texto sin url',
      embeds: [],
      mentions: { roles: new Map() },
    },
  };
}

describe('bug: custom emoji must never save (end-to-end handler)', () => {
  it('reacción :escine: custom no crea filas', async () => {
    const { default: handler } = await import('../../src/events/messageReactionAdd.js');
    await (handler.execute as (...a: unknown[]) => Promise<void>)(
      mockReaction({ name: 'escine', id: '123456789' }),
      { id: 'userB', bot: false },
    );
    expect(await countBacklog()).toBe(0);
  });

  it('reacción 📝 unicode sí crea exactamente una fila', async () => {
    const { default: handler } = await import('../../src/events/messageReactionAdd.js');
    await (handler.execute as (...a: unknown[]) => Promise<void>)(
      mockReaction({ name: '📝', id: null }),
      { id: 'userB', bot: false },
    );
    expect(await countBacklog()).toBe(1);
  });
});
