// Shared contracts for SPEC-001. Identifiers and comments in English (constitution P6).

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
