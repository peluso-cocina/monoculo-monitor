import { Events } from 'discord.js';
import { describe, expect, it } from 'vitest';
import handler from '../../src/events/messageReactionAdd.js';
import { isValidBotEventModule } from '../../src/index.js';

describe('V6 reaction handler wiring', () => {
  it('exporta el contrato BotEvent para MessageReactionAdd no-once', () => {
    expect(handler.name).toBe(Events.MessageReactionAdd);
    expect(handler.once).toBe(false);
    expect(typeof handler.execute).toBe('function');
  });

  it('el loader de SPEC-001 lo acepta', () => {
    expect(isValidBotEventModule(handler)).toBe(true);
  });
});
