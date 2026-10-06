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

export interface ReactionPayload {
  messageId: string;
  channelId: string;
  authorId: string;
  userId: string;
  content: string;
  embedUrl: string | null;
  firstRoleName: string | null;
}

export interface ReleaseMeta {
  title: string | null;
  artist: string | null;
  coverUrl: string | null;
  url: string | null;
}

export interface ExtractedRelease {
  meta: ReleaseMeta;
  rawContent: string;
  genreRole: string | null;
}
