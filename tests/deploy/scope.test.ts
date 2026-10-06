import { describe, expect, it } from 'vitest';
import {
  classifyDeployError,
  DEPLOY_ERROR_MESSAGES,
  formatDeploySuccess,
  formatUnknownGuildMessage,
  isValidCommandModule,
  parseDeployEnv,
  resolveScope,
} from '../../src/deploy-commands.js';

describe('RF-06 deploy env', () => {
  it('acepta env mínimo válido', () => {
    expect(parseDeployEnv({ DISCORD_TOKEN: 't', CLIENT_ID: '123' })).toEqual({
      ok: true,
      token: 't',
      clientId: '123',
    });
  });

  it('no exige DATABASE_PATH', () => {
    const result = parseDeployEnv({ DISCORD_TOKEN: 't', CLIENT_ID: '123' });
    expect(result.ok).toBe(true);
  });

  it.each([[{}], [{ DISCORD_TOKEN: 't' }], [{ CLIENT_ID: '123' }], [{ DISCORD_TOKEN: '  ', CLIENT_ID: 'abc' }]])(
    'rechaza %j',
    (source) => {
      expect(parseDeployEnv(source).ok).toBe(false);
    },
  );
});

describe('RF-02/RF-03 scope', () => {
  it('GUILD_ID definida → guild', () => {
    expect(resolveScope('123')).toEqual({ kind: 'guild', guildId: '123' });
  });

  it.each([[undefined], [''], ['   ']])('GUILD_ID %j → global', (guildId) => {
    expect(resolveScope(guildId)).toEqual({ kind: 'global' });
  });
});

describe('RF-05 success message', () => {
  it('ámbito servidor exacto', () => {
    expect(formatDeploySuccess(1, { kind: 'guild', guildId: '123' })).toBe(
      'Comandos registrados: 1 (ámbito: servidor 123)',
    );
  });

  it('ámbito global exacto', () => {
    expect(formatDeploySuccess(2, { kind: 'global' })).toBe('Comandos registrados: 2 (ámbito: global)');
  });
});

describe('command module guard', () => {
  it('acepta { data, execute } válido', () => {
    expect(isValidCommandModule({ data: { toJSON: () => ({}) }, execute: () => undefined })).toBe(true);
  });

  it.each([[null], [{}], [{ data: {} }], [{ execute: () => undefined }]])('rechaza %j', (mod) => {
    expect(isValidCommandModule(mod)).toBe(false);
  });
});

describe('deploy error classifier', () => {
  it.each([
    [{ status: 401 }, 'auth'],
    [{ status: 403 }, 'auth'],
    [{ status: 404 }, 'unknown-guild'],
    [{ status: 429 }, 'rate-limited'],
    [new Error('fetch failed'), 'network'],
    [new Error('getaddrinfo ENOTFOUND discord.com'), 'network'],
    [new Error('boom'), 'unknown'],
  ])('clasifica %j como %s', (error, expected) => {
    expect(classifyDeployError(error)).toBe(expected);
  });

  it('mensajes fijos en español', () => {
    expect(DEPLOY_ERROR_MESSAGES.auth).toBe(
      'Registro de comandos fallido: token inválido o sin autorización',
    );
    expect(DEPLOY_ERROR_MESSAGES['rate-limited']).toBe(
      'Registro de comandos fallido: límite de Discord excedido, reintenta en unos minutos',
    );
    expect(DEPLOY_ERROR_MESSAGES.network).toBe(
      'Registro de comandos fallido: sin conexión con la API de Discord',
    );
    expect(formatUnknownGuildMessage('123')).toBe(
      'Registro de comandos fallido: el bot no está en el servidor 123 o falta el scope applications.commands',
    );
  });
});
