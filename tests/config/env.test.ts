import { describe, expect, it } from 'vitest';
import { formatMissingEnvMessage, isValidClientId, parseEnv } from '../../src/config/env.js';

const FULL = {
  DISCORD_TOKEN: 'tok',
  CLIENT_ID: '1234567890',
  DATABASE_PATH: './data/database.sqlite',
  GUILD_ID: '0987654321',
};

describe('RF-02 env validator', () => {
  it('acepta un entorno completo', () => {
    const result = parseEnv(FULL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toEqual({
        discordToken: 'tok',
        clientId: '1234567890',
        databasePath: './data/database.sqlite',
        guildId: '0987654321',
      });
      expect(result.guildWarning).toBe(false);
    }
  });

  it.each([['DISCORD_TOKEN'], ['CLIENT_ID'], ['DATABASE_PATH']])('marca ausente %s', (key) => {
    const { [key]: _omitted, ...rest } = FULL;
    const result = parseEnv(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain(key);
  });

  it.each([[''], ['   ']])('trata como ausente el valor %j', (value) => {
    const result = parseEnv({ ...FULL, DISCORD_TOKEN: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain('DISCORD_TOKEN');
  });

  it.each([['abc'], ['12a'], ['-5'], ['1.5']])('rechaza CLIENT_ID %j', (value) => {
    expect(isValidClientId(value)).toBe(false);
    const result = parseEnv({ ...FULL, CLIENT_ID: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain('CLIENT_ID');
  });

  it('acepta CLIENT_ID numérico', () => {
    expect(isValidClientId('1234567890')).toBe(true);
  });

  it('GUILD_ID ausente avisa pero no aborta', () => {
    const { GUILD_ID: _omitted, ...rest } = FULL;
    const result = parseEnv(rest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guildWarning).toBe(true);
      expect(result.config.guildId).toBeUndefined();
    }
  });

  it('mensaje stderr exacto', () => {
    expect(formatMissingEnvMessage(['DISCORD_TOKEN', 'CLIENT_ID'])).toBe(
      'Missing required env: DISCORD_TOKEN,CLIENT_ID',
    );
  });

  it('CLIENT_ID con espacios se trata como ausente', () => {
    const result = parseEnv({ ...FULL, CLIENT_ID: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain('CLIENT_ID');
  });

  it('GUILD_ID vacía avisa pero no aborta', () => {
    const result = parseEnv({ ...FULL, GUILD_ID: '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guildWarning).toBe(true);
      expect(result.config.guildId).toBeUndefined();
    }
  });

  it('el orden de faltantes es estable', () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(['DISCORD_TOKEN', 'CLIENT_ID', 'DATABASE_PATH']);
      expect(formatMissingEnvMessage(result.missing)).toBe(
        'Missing required env: DISCORD_TOKEN,CLIENT_ID,DATABASE_PATH',
      );
    }
  });

  it('recorta espacios en los valores válidos', () => {
    const result = parseEnv({ ...FULL, DISCORD_TOKEN: '  tok  ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.discordToken).toBe('tok');
  });
});
