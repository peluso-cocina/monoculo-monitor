// Shared contracts for SPEC-001. Identifiers and comments in English (constitution P6).

import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface EnvConfig {
  discordToken: string;
  clientId: string;
  databasePath: string;
  guildId?: string;
}

export interface BotEvent {
  name: string;
  once: boolean;
  execute: (...args: unknown[]) => void | Promise<void>;
}

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export type DeployScope = { kind: 'guild'; guildId: string } | { kind: 'global' };
