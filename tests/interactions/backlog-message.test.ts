import { describe, expect, it } from 'vitest';
import { buildBacklogMessage } from '../../src/interactions/backlog.js';
import type { PendingItem } from '../../src/types/index.js';

function item(id: number): PendingItem {
  return {
    backlogId: id, releaseId: id, artist: `Artista ${id}`, title: `Disco ${id}`,
    url: `https://e.com/${id}`, coverUrl: id === 1 ? 'https://img.com/1.jpg' : null, genreRole: null,
  };
}
function many(n: number): PendingItem[] {
  return Array.from({ length: n }, (_, i) => item(i + 1));
}

describe('W3 backlog message builders', () => {
  it('26 ítems → 25 fields, 25 opciones y 2 filas', () => {
    const message = buildBacklogMessage(many(26), 'u1', 0);
    const json = message.embeds[0]?.toJSON();
    expect(json?.fields).toHaveLength(25);
    expect(json?.title).toBe('Tus pendientes (página 1 de 2)');
    expect(json?.image?.url).toBe('https://img.com/1.jpg');
    expect(message.components).toHaveLength(2);
  });

  it('3 ítems → sin botones de paginación', () => {
    const message = buildBacklogMessage(many(3), 'u1', 0);
    expect(message.components).toHaveLength(1);
    expect(message.embeds[0]?.toJSON().title).toBe('Tus pendientes (página 1 de 1)');
  });

  it('customIds dentro del límite y con el usuario', () => {
    const message = buildBacklogMessage(many(26), 'u1', 1);
    const json = {
      select: message.components[0]?.toJSON(),
      buttons: message.components[1]?.toJSON(),
    };
    const ids: string[] = [
      ...(json.select && 'components' in json.select ? json.select.components.map((c) => ('custom_id' in c ? String(c.custom_id) : '')) : []),
      ...(json.buttons && 'components' in json.buttons ? json.buttons.components.map((c) => ('custom_id' in c ? String(c.custom_id) : '')) : []),
    ];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id.length).toBeLessThanOrEqual(100);
      expect(id).toContain('u1');
    }
  });
});
