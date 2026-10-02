import { describe, expect, it } from 'vitest';
import type { BotEvent, EnvConfig } from '../../src/types/index.js';

describe('T2 type contracts', () => {
  it('EnvConfig holds the validated environment values', () => {
    const config: EnvConfig = {
      discordToken: 'token',
      clientId: '1234567890',
      databasePath: './data/database.sqlite',
    };
    expect(config.discordToken).toBe('token');
    expect(config.guildId).toBeUndefined();
  });

  it('BotEvent matches the dynamic loader contract', () => {
    const event: BotEvent = {
      name: 'ready',
      once: true,
      execute: () => undefined,
    };
    expect(event.name).toBe('ready');
    expect(event.once).toBe(true);
    expect(typeof event.execute).toBe('function');
  });
});
