import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatMissingEnvMessage, isValidClientId } from './config/env.js';
import type { BotCommand, DeployScope } from './types/index.js';

type EnvSource = Record<string, string | undefined>;

export type DeployEnvResult =
  | { ok: true; token: string; clientId: string }
  | { ok: false; missing: string[] };

function readValue(source: EnvSource, key: string): string | undefined {
  const raw = source[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function parseDeployEnv(source: EnvSource): DeployEnvResult {
  const missing: string[] = [];
  const token = readValue(source, 'DISCORD_TOKEN');
  if (token === undefined) missing.push('DISCORD_TOKEN');
  const clientId = readValue(source, 'CLIENT_ID');
  if (clientId === undefined || !isValidClientId(clientId)) missing.push('CLIENT_ID');
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, token: token as string, clientId: clientId as string };
}

export function resolveScope(guildId: string | undefined): DeployScope {
  const trimmed = guildId?.trim();
  if (trimmed) return { kind: 'guild', guildId: trimmed };
  return { kind: 'global' };
}

export function formatDeploySuccess(count: number, scope: DeployScope): string {
  if (scope.kind === 'guild') return `Comandos registrados: ${count} (ámbito: servidor ${scope.guildId})`;
  return `Comandos registrados: ${count} (ámbito: global)`;
}

export function isValidCommandModule(mod: unknown): mod is BotCommand {
  if (typeof mod !== 'object' || mod === null) return false;
  const candidate = mod as Record<string, unknown>;
  const data = candidate['data'];
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>)['toJSON'] === 'function' &&
    typeof candidate['execute'] === 'function'
  );
}

export type DeployErrorKind = 'auth' | 'unknown-guild' | 'rate-limited' | 'network' | 'unknown';

export const DEPLOY_ERROR_MESSAGES: Record<Exclude<DeployErrorKind, 'unknown-guild'>, string> = {
  auth: 'Registro de comandos fallido: token inválido o sin autorización',
  'rate-limited': 'Registro de comandos fallido: límite de Discord excedido, reintenta en unos minutos',
  network: 'Registro de comandos fallido: sin conexión con la API de Discord',
  unknown: 'Registro de comandos fallido: error desconocido',
};

export function formatUnknownGuildMessage(guildId: string): string {
  return `Registro de comandos fallido: el bot no está en el servidor ${guildId} o falta el scope applications.commands`;
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as Record<string, unknown>)['status'];
  return typeof status === 'number' ? status : undefined;
}

export function classifyDeployError(error: unknown): DeployErrorKind {
  const status = readStatus(error);
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'unknown-guild';
  if (status === 429) return 'rate-limited';
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(message)) return 'network';
  return 'unknown';
}

function resolveCommandsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'commands');
}

export async function collectCommandBodies(): Promise<unknown[]> {
  const dir = resolveCommandsDir();
  const files = (await readdir(dir)).filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'),
  );
  const bodies: unknown[] = [];
  for (const file of files) {
    const imported = (await import(pathToFileURL(join(dir, file)).href)) as {
      default?: unknown;
    };
    const candidate: unknown = imported.default ?? imported;
    if (!isValidCommandModule(candidate)) {
      throw new Error(`Invalid command module: ${file}. Expected { data, execute }.`);
    }
    bodies.push(candidate.data.toJSON());
  }
  return bodies;
}

function reportDeployError(error: unknown, scope: DeployScope): void {
  const kind = classifyDeployError(error);
  if (kind === 'unknown-guild' && scope.kind === 'guild') {
    console.error(formatUnknownGuildMessage(scope.guildId));
  } else if (kind === 'unknown-guild') {
    console.error(DEPLOY_ERROR_MESSAGES.unknown);
  } else {
    console.error(DEPLOY_ERROR_MESSAGES[kind]);
  }
}

async function main(): Promise<void> {
  dotenv.config();
  const envResult = parseDeployEnv(process.env);
  if (!envResult.ok) {
    console.error(formatMissingEnvMessage(envResult.missing));
    process.exit(1);
  }
  const scope = resolveScope(process.env['GUILD_ID']);
  let bodies: unknown[];
  try {
    bodies = await collectCommandBodies();
  } catch (error) {
    console.error(`Módulo de comando inválido: ${(error as Error).message}`);
    process.exit(1);
  }
  if (bodies.length === 0) {
    console.error('Sin comandos que registrar');
    return;
  }
  const rest = new REST().setToken(envResult.token);
  try {
    if (scope.kind === 'guild') {
      await rest.put(Routes.applicationGuildCommands(envResult.clientId, scope.guildId), {
        body: bodies,
      });
    } else {
      await rest.put(Routes.applicationCommands(envResult.clientId), { body: bodies });
    }
  } catch (error: unknown) {
    reportDeployError(error, scope);
    process.exit(1);
  }
  console.log(formatDeploySuccess(bodies.length, scope));
}

const invokedAsMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) void main();
