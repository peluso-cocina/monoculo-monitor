import {
  Events,
  type ButtonInteraction,
  type Interaction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { getDatabase } from '../database/client.js';
import { getPendingBacklog, markListened } from '../database/backlogRepository.js';
import { data as pendientesData, execute as executePendientes } from '../commands/pendientes.js';
import { ALL_DONE_MESSAGE, buildBacklogMessage } from '../interactions/backlog.js';
import { isAuthorOf, paginate, parseCustomId } from '../services/backlogView.js';
import type { BotEvent } from '../types/index.js';

async function refreshDirectMessage(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  userId: string,
  page: number,
  db: Database.Database,
): Promise<void> {
  const items = getPendingBacklog(db, userId);
  if (items.length === 0) {
    await interaction.update({ content: ALL_DONE_MESSAGE, embeds: [], components: [] });
    return;
  }
  const message = buildBacklogMessage(items, userId, page);
  await interaction.update({ embeds: message.embeds, components: message.components });
}

export async function handleMarkSelect(
  interaction: StringSelectMenuInteraction,
  db: Database.Database = getDatabase(),
): Promise<void> {
  try {
    const parsed = parseCustomId(interaction.customId);
    if (parsed === null || parsed.kind !== 'mark' || !isAuthorOf(parsed, interaction.user.id)) return;
    const ids = interaction.values.map(Number).filter((n) => Number.isInteger(n));
    markListened(db, interaction.user.id, ids);
    await refreshDirectMessage(interaction, interaction.user.id, parsed.page, db);
  } catch (error: unknown) {
    console.error(`Mark select failed: ${(error as Error).message}`);
  }
}

export async function handlePageButton(
  interaction: ButtonInteraction,
  db: Database.Database = getDatabase(),
): Promise<void> {
  try {
    const parsed = parseCustomId(interaction.customId);
    if (parsed === null || parsed.kind !== 'page' || !isAuthorOf(parsed, interaction.user.id)) return;
    const { page } = paginate(getPendingBacklog(db, interaction.user.id), parsed.page);
    await refreshDirectMessage(interaction, interaction.user.id, page, db);
  } catch (error: unknown) {
    console.error(`Page button failed: ${(error as Error).message}`);
  }
}

async function route(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === pendientesData.name) await executePendientes(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bl:mark:')) {
      await handleMarkSelect(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('bl:page:')) {
      await handlePageButton(interaction);
    }
  } catch (error: unknown) {
    console.error(`Interaction failed: ${(error as Error).message}`);
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute: (...args: unknown[]): Promise<void> => {
    const [interaction] = args as [Interaction];
    return route(interaction);
  },
} satisfies BotEvent;
