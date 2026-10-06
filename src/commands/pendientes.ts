import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';

export const data: BotCommand['data'] = new SlashCommandBuilder()
  .setName('pendientes')
  .setDescription('Consulta tus discos pendientes por DM');

export async function execute(...args: Parameters<BotCommand['execute']>): Promise<void> {
  const [interaction] = args;
  await interaction.reply({
    content: 'Función disponible próximamente',
    ephemeral: true,
  });
}
