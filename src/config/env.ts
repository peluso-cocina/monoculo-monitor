import dotenv from 'dotenv';
import type { EnvConfig } from '../types/index.js';

export const GUILD_WARNING = 'Warning: GUILD_ID not set, guild commands disabled';

type EnvSource = Record<string, string | undefined>;

export function isValidClientId(value: string): boolean {
  return /^\d+$/.test(value);
}

export function formatMissingEnvMessage(names: string[]): string {
  return `Missing required env: ${names.join(',')}`;
}

export type ParseResult =
  | { ok: true; config: EnvConfig; guildWarning: boolean }
  | { ok: false; missing: string[] };

function readValue(source: EnvSource, key: string): string | undefined {
  const raw = source[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function parseEnv(source: EnvSource): ParseResult {
  const missing: string[] = [];

  const discordToken = readValue(source, 'DISCORD_TOKEN');
  if (discordToken === undefined) missing.push('DISCORD_TOKEN');

  const clientId = readValue(source, 'CLIENT_ID');
  if (clientId === undefined || !isValidClientId(clientId)) missing.push('CLIENT_ID');

  const databasePath = readValue(source, 'DATABASE_PATH');
  if (databasePath === undefined) missing.push('DATABASE_PATH');

  if (missing.length > 0) return { ok: false, missing };

  const guildId = readValue(source, 'GUILD_ID');
  return {
    ok: true,
    config: {
      discordToken: discordToken as string,
      clientId: clientId as string,
      databasePath: databasePath as string,
      ...(guildId !== undefined ? { guildId } : {}),
    },
    guildWarning: guildId === undefined,
  };
}

export function loadEnv(): EnvConfig {
  dotenv.config();
  const result = parseEnv(process.env);
  if (!result.ok) {
    console.error(formatMissingEnvMessage(result.missing));
    process.exit(1);
  }
  if (result.guildWarning) console.error(GUILD_WARNING);
  return result.config;
}
