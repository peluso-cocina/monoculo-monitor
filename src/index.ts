import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from './config/env.js';
import type { BotEvent } from './types/index.js';

export interface ClientOptions {
  intents: [number, number, number];
  partials: [Partials, Partials, Partials];
}

export function buildClientOptions(): ClientOptions {
  return {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User],
  };
}

export function isValidBotEventModule(mod: unknown): mod is BotEvent {
  if (typeof mod !== 'object' || mod === null) return false;
  const candidate = mod as Record<string, unknown>;
  return (
    typeof candidate['name'] === 'string' &&
    typeof candidate['once'] === 'boolean' &&
    typeof candidate['execute'] === 'function'
  );
}

export type LoginErrorKind = 'invalid-token' | 'disallowed-intents' | 'network' | 'unknown';

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorKind, string> = {
  'invalid-token': 'Discord login failed: invalid token',
  'disallowed-intents':
    'Discord login failed: revisa los intents en el portal de desarrollador',
  network: 'Discord login failed: sin conexión a internet',
  unknown: 'Discord login failed: error desconocido al conectar',
};

export function classifyLoginError(error: unknown): LoginErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  if (/TokenInvalid|invalid token/i.test(message)) return 'invalid-token';
  if (/disallowed intents/i.test(message)) return 'disallowed-intents';
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(message))
    return 'network';
  return 'unknown';
}

function resolveEventsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'events');
}

export async function loadEvents(client: Client): Promise<number> {
  const dir = resolveEventsDir();
  const files = (await readdir(dir)).filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'),
  );
  let count = 0;
  for (const file of files) {
    const imported = (await import(pathToFileURL(join(dir, file)).href)) as {
      default?: unknown;
    };
    const candidate: unknown = imported.default ?? imported;
    if (!isValidBotEventModule(candidate)) {
      throw new Error(`Invalid event module: ${file}. Expected { name, once, execute }.`);
    }
    if (candidate.once) client.once(candidate.name, (...args: unknown[]) => void candidate.execute(...args));
    else client.on(candidate.name, (...args: unknown[]) => void candidate.execute(...args));
    count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const client = new Client(buildClientOptions());
  try {
    await loadEvents(client);
  } catch (error) {
    console.error(`Error loading events: ${(error as Error).message}`);
    process.exit(1);
  }
  try {
    await client.login(env.discordToken);
  } catch (error: unknown) {
    console.error(LOGIN_ERROR_MESSAGES[classifyLoginError(error)]);
    process.exit(1);
  }
}

const invokedAsMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) void main();
