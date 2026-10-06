import { describe, expect, it } from 'vitest';
import {
  buildReactionPayload,
  isUnknownMessageError,
  shouldProcessReaction,
} from '../../src/events/messageReactionAdd.js';

const GOOD = { userIsBot: false, authorIsBot: false, inGuild: true, emojiName: '📝' };

describe('RF-01 reaction filter', () => {
  it('procesa :memo: de humano en servidor', () => {
    expect(shouldProcessReaction(GOOD)).toBe(true);
  });

  it.each([
    [{ ...GOOD, userIsBot: true }],
    [{ ...GOOD, authorIsBot: true }],
    [{ ...GOOD, inGuild: false }],
    [{ ...GOOD, emojiName: '✅' }],
    [{ ...GOOD, emojiName: null }],
  ])('ignora %j', (input) => {
    expect(shouldProcessReaction(input)).toBe(false);
  });
});

describe('RF-07/RF-09 payload', () => {
  it('toma el primer rol o nulo', () => {
    const base = { messageId: 'm', channelId: 'c', authorId: 'a', content: 't', embedUrl: null };
    expect(buildReactionPayload({ ...base, roleNames: ['Techno', 'House'] }, 'u').firstRoleName).toBe('Techno');
    expect(buildReactionPayload({ ...base, roleNames: [] }, 'u').firstRoleName).toBeNull();
  });
});

describe('RF-02 unknown message', () => {
  it('detecta 10008', () => {
    expect(isUnknownMessageError({ code: 10008 })).toBe(true);
    expect(isUnknownMessageError(new Error('x'))).toBe(false);
    expect(isUnknownMessageError({ code: 50007 })).toBe(false);
  });
});
