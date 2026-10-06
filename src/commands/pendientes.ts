import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import { getDatabase } from '../database/client.js';
import { getPendingBacklog } from '../database/backlogRepository.js';
import { buildBacklogMessage } from '../interactions/backlog.js';
import type { BotCommand } from '../types/index.js';

export const EMPTY_LIST_MESSAGE = 'No tienes discos pendientes. ¡Lista al día!';
export const DM_BLOCKED_MESSAGE =
  'No pude enviarte el DM: activa los mensajes directos de este servidor en Ajustes > Privacidad y prueba de nuevo.';
export const DM_SENT_MESSAGE = 'Te envié tu lista por mensaje directo. 📬';
export const DM_FAILED_MESSAGE = 'Ocurrió un error al enviar tu lista. Inténtalo de nuevo.';
export const DM_BLOCKED_CODE = 50007;

export const data: BotCommand['data'] = new SlashCommandBuilder()
  .setName('pendientes')
  .setDescription('Consulta tus discos pendientes por DM');

export function isDmBlockedError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth += 1) {
    const record = current as Record<string, unknown>;
    if (record['code'] === DM_BLOCKED_CODE) return true;
    const message = record['message'];
    if (typeof message === 'string' && /50007|cannot send messages to this user/i.test(message)) {
      return true;
    }
    current = record['cause'];
  }
  return false;
}

export async function sendBacklog(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const items = getPendingBacklog(db, interaction.user.id);
  if (items.length === 0) {
    await interaction.editReply(EMPTY_LIST_MESSAGE);
    return;
  }
  const message = buildBacklogMessage(items, interaction.user.id, 0);
  try {
    await interaction.user.send({ embeds: message.embeds, components: message.components });
  } catch (error: unknown) {
    if (isDmBlockedError(error)) await interaction.editReply(DM_BLOCKED_MESSAGE);
    else await interaction.editReply(DM_FAILED_MESSAGE);
    return;
  }
  await interaction.editReply(DM_SENT_MESSAGE);
}

export async function execute(...args: Parameters<BotCommand['execute']>): Promise<void> {
  const [interaction] = args;
  await sendBacklog(interaction, getDatabase());
}
