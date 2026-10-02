import { GatewayIntentBits, Partials } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { buildClientOptions, isValidBotEventModule } from '../../src/index.js';

describe('RF-03/RF-04 client options', () => {
  it('pide exactamente los 3 intents no privilegiados', () => {
    const { intents } = buildClientOptions();
    expect(intents).toEqual([
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ]);
  });

  it('no pide intents privilegiados', () => {
    const { intents } = buildClientOptions();
    expect(intents).not.toContain(GatewayIntentBits.MessageContent);
    expect(intents).not.toContain(GatewayIntentBits.GuildMembers);
    expect(intents).not.toContain(GatewayIntentBits.GuildPresences);
  });

  it('registra exactamente los 3 partials', () => {
    const { partials } = buildClientOptions();
    expect(partials).toEqual([Partials.Message, Partials.Reaction, Partials.User]);
  });
});

describe('RF-05 event module guard', () => {
  it('acepta un módulo válido', () => {
    expect(isValidBotEventModule({ name: 'ready', once: true, execute: () => undefined })).toBe(true);
  });

  it.each([[null], [undefined], ['x'], [42], [{}], [{ name: 'a', once: false }], [{ name: 'a', once: 'no', execute: () => undefined }]])(
    'rechaza %j',
    (mod) => {
      expect(isValidBotEventModule(mod)).toBe(false);
    },
  );
});
