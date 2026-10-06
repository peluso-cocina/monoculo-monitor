import { describe, expect, it } from 'vitest';
import type { ExtractedRelease, ReactionPayload, ReleaseMeta } from '../../src/types/index.js';

describe('V1 reaction payload contracts', () => {
  it('ReactionPayload carries plain Discord-free data', () => {
    const payload: ReactionPayload = {
      messageId: 'm1',
      channelId: 'c1',
      authorId: 'a1',
      userId: 'u1',
      content: 'check this https://example.com/x',
      embedUrl: null,
      firstRoleName: 'Techno',
    };
    expect(payload.messageId).toBe('m1');
    expect(payload.firstRoleName).toBe('Techno');
  });

  it('ReleaseMeta and ExtractedRelease allow nulls', () => {
    const meta: ReleaseMeta = { title: 'T', artist: null, coverUrl: null, url: 'https://e.com' };
    const extracted: ExtractedRelease = { meta, rawContent: 'raw', genreRole: null };
    expect(extracted.meta.title).toBe('T');
    expect(extracted.genreRole).toBeNull();
  });
});
