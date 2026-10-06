import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { saveReaction } from '../../src/database/backlogRepository.js';
import {
  DM_BLOCKED_MESSAGE,
  DM_FAILED_MESSAGE,
  DM_SENT_MESSAGE,
  EMPTY_LIST_MESSAGE,
  isDmBlockedError,
  sendBacklog,
} from '../../src/commands/pendientes.js';

function openTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/database/schema.sql', 'utf-8'));
  return db;
}

function mockInteraction(sendImpl?: (msg: unknown) => Promise<unknown>) {
  return {
    user: { id: 'u1', send: vi.fn(sendImpl ?? (async () => undefined)) },
    deferReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
  } as unknown as ChatInputCommandInteraction & {
    user: { send: ReturnType<typeof vi.fn> };
    deferReply: ReturnType<typeof vi.fn>;
    editReply: ReturnType<typeof vi.fn>;
  };
}

function seed(db: Database.Database): void {
  saveReaction(db, {
    userId: 'u1', messageId: 'm1', channelId: 'c1', authorId: 'a1',
    rawContent: 't', url: 'https://e.com/1', artist: 'A', title: 'T', coverUrl: null, genreRole: null,
  });
}

describe('W4 pendientes execute', () => {
  it('defer primero y vacío sin DM', async () => {
    const interaction = mockInteraction();
    await sendBacklog(interaction, openTestDb());
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.user.send).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(EMPTY_LIST_MESSAGE);
    expect(EMPTY_LIST_MESSAGE).toBe('No tienes discos pendientes. ¡Lista al día!');
  });

  it('con pendientes envía DM y confirma', async () => {
    const db = openTestDb();
    seed(db);
    const interaction = mockInteraction();
    await sendBacklog(interaction, db);
    expect(interaction.user.send).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledWith(DM_SENT_MESSAGE);
  });

  it('50007 informa sin reintentar', async () => {
    const db = openTestDb();
    seed(db);
    const interaction = mockInteraction(async () => {
      throw { code: 50007 };
    });
    await sendBacklog(interaction, db);
    expect(interaction.editReply).toHaveBeenCalledWith(DM_BLOCKED_MESSAGE);
    expect(interaction.user.send).toHaveBeenCalledTimes(1);
  });

  it('otro error de DM usa mensaje genérico', async () => {
    const db = openTestDb();
    seed(db);
    const interaction = mockInteraction(async () => {
      throw new Error('boom');
    });
    await sendBacklog(interaction, db);
    expect(interaction.editReply).toHaveBeenCalledWith(DM_FAILED_MESSAGE);
  });

  it('isDmBlockedError distingue 50007', () => {
    expect(isDmBlockedError({ code: 50007 })).toBe(true);
    expect(isDmBlockedError({ code: 40001 })).toBe(false);
    expect(isDmBlockedError(new Error('x'))).toBe(false);
  });

  it('isDmBlockedError desenrolla cause y mensaje', () => {
    expect(isDmBlockedError(new Error('send failed', { cause: { code: 50007 } }))).toBe(true);
    expect(isDmBlockedError(new Error('Cannot send messages to this user'))).toBe(true);
    expect(isDmBlockedError(new Error('send failed', { cause: new Error('boom') }))).toBe(false);
  });
});
