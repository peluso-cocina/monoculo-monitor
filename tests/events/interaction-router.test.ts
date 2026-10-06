import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import handler, { handleMarkSelect, handlePageButton } from '../../src/events/interactionCreate.js';
import { saveReaction } from '../../src/database/backlogRepository.js';
import { ALL_DONE_MESSAGE } from '../../src/interactions/backlog.js';

function openTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/database/schema.sql', 'utf-8'));
  return db;
}

function seed(db: Database.Database, n: number): void {
  for (let i = 1; i <= n; i++) {
    saveReaction(db, {
      userId: 'u1', messageId: `m${i}`, channelId: 'c', authorId: 'a',
      rawContent: 't', url: `https://e.com/${i}`, artist: 'A', title: `T${i}`, coverUrl: null, genreRole: null,
    });
  }
}

function mockSelect(customId: string, userId: string, values: string[]) {
  return {
    customId, user: { id: userId }, values,
    update: vi.fn(async () => undefined),
  } as unknown as StringSelectMenuInteraction & { update: ReturnType<typeof vi.fn> };
}

function mockButton(customId: string, userId: string) {
  return {
    customId, user: { id: userId },
    update: vi.fn(async () => undefined),
  } as unknown as ButtonInteraction & { update: ReturnType<typeof vi.fn> };
}

describe('W5 interaction router shape', () => {
  it('exporta el evento InteractionCreate no-once', async () => {
    const { Events } = await import('discord.js');
    expect(handler.name).toBe(Events.InteractionCreate);
    expect(handler.once).toBe(false);
    expect(typeof handler.execute).toBe('function');
  });
});

describe('W5 mark select', () => {
  it('marca y refresca el DM', async () => {
    const db = openTestDb();
    seed(db, 2);
    const pending = (await import('../../src/database/backlogRepository.js')).getPendingBacklog(db, 'u1');
    const interaction = mockSelect('bl:mark:u1:0', 'u1', [String(pending[0]?.backlogId)]);
    await handleMarkSelect(interaction, db);
    expect(interaction.update).toHaveBeenCalledOnce();
    const arg = interaction.update.mock.calls[0]?.[0] as { embeds: unknown[] };
    expect(arg.embeds).toHaveLength(1);
    expect((await import('../../src/database/backlogRepository.js')).getPendingBacklog(db, 'u1')).toHaveLength(1);
  });

  it('autor ajeno se ignora en silencio', async () => {
    const db = openTestDb();
    seed(db, 1);
    const interaction = mockSelect('bl:mark:u1:0', 'u2', ['1']);
    await handleMarkSelect(interaction, db);
    expect(interaction.update).not.toHaveBeenCalled();
  });

  it('vaciar la lista edita sin componentes', async () => {
    const db = openTestDb();
    seed(db, 1);
    const pending = (await import('../../src/database/backlogRepository.js')).getPendingBacklog(db, 'u1');
    const interaction = mockSelect('bl:mark:u1:0', 'u1', [String(pending[0]?.backlogId)]);
    await handleMarkSelect(interaction, db);
    const arg = interaction.update.mock.calls[0]?.[0] as { content: string; components: unknown[] };
    expect(arg.content).toBe(ALL_DONE_MESSAGE);
    expect(arg.components).toEqual([]);
  });

  it('valores obsoletos reconstruyen sin romper', async () => {
    const db = openTestDb();
    seed(db, 1);
    const interaction = mockSelect('bl:mark:u1:0', 'u1', ['999999', 'no-numérico']);
    await handleMarkSelect(interaction, db);
    expect(interaction.update).toHaveBeenCalledOnce();
  });
});

describe('W5 page buttons', () => {
  it('navega a la página pedida', async () => {
    const db = openTestDb();
    seed(db, 26);
    const interaction = mockButton('bl:page:u1:1', 'u1');
    await handlePageButton(interaction, db);
    const arg = interaction.update.mock.calls[0]?.[0] as { embeds: { toJSON: () => { title: string } }[] };
    expect(arg.embeds[0]?.toJSON().title).toContain('página 2 de 2');
  });

  it('autor ajeno se ignora', async () => {
    const db = openTestDb();
    seed(db, 26);
    const interaction = mockButton('bl:page:u1:1', 'u2');
    await handlePageButton(interaction, db);
    expect(interaction.update).not.toHaveBeenCalled();
  });
});
