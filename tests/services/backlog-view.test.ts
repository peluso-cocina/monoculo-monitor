import { describe, expect, it } from 'vitest';
import {
  buildFields,
  buildGroupedFields,
  buildSelectOptions,
  clampPage,
  formatPageTitle,
  groupByGenre,
  isAuthorOf,
  makeMarkId,
  makePageId,
  paginate,
  paginateGrouped,
  parseCustomId,
  truncateText,
} from '../../src/services/backlogView.js';
import type { PendingItem } from '../../src/services/backlogView.js';

function item(id: number, over: Partial<PendingItem> = {}): PendingItem {
  return {
    backlogId: id, releaseId: id, artist: `Artista ${id}`, title: `Disco ${id}`,
    url: `https://e.com/${id}`, coverUrl: null, genreRole: id === 1 ? 'Techno' : null, ...over,
  };
}
function many(n: number): PendingItem[] {
  return Array.from({ length: n }, (_, i) => item(i + 1));
}

describe('RF-07 paginate', () => {
  it.each([[0, 1], [1, 1], [25, 1], [26, 2], [50, 2], [51, 3]])('%i ítems → %i páginas', (n, pages) => {
    expect(paginate(many(n), 0).totalPages).toBe(pages);
  });

  it('reparte 26 en 25+1', () => {
    const { pageItems } = paginate(many(26), 1);
    expect(pageItems).toHaveLength(1);
    expect(pageItems[0]?.backlogId).toBe(26);
  });

  it.each([[-1], [99], [NaN]])('recorta página %j a rango válido', (page) => {
    const { page: clamped, totalPages } = paginate(many(26), page);
    expect(clamped).toBeGreaterThanOrEqual(0);
    expect(clamped).toBeLessThan(totalPages);
  });

  it('clampPage lleva al índice válido', () => {
    expect(clampPage(-1, 3)).toBe(0);
    expect(clampPage(9, 3)).toBe(2);
    expect(clampPage(NaN, 3)).toBe(0);
    expect(clampPage(1, 3)).toBe(1);
  });
});

describe('RF-04 builders', () => {
  it('título de página exacto', () => {
    expect(formatPageTitle(0, 3)).toBe('Tus pendientes (página 1 de 3)');
  });

  it('fields con enlace y género', () => {
    const fields = buildFields([item(1)]);
    expect(fields[0]?.name).toBe('1. Artista 1 — Disco 1');
    expect(fields[0]?.value).toContain('[Abrir enlace](https://e.com/1)');
    expect(fields[0]?.value).toContain('Techno');
  });

  it('los ítems van numerados en orden', () => {
    const fields = buildFields([item(1), item(2)]);
    expect(fields[0]?.name?.startsWith('1. ')).toBe(true);
    expect(fields[1]?.name?.startsWith('2. ')).toBe(true);
  });

  it('fields sin artista ni url usan respaldo', () => {
    const fields = buildFields([item(1, { artist: null, url: null, genreRole: null })]);
    expect(fields[0]?.name).toContain('Desconocido');
    expect(fields[0]?.value).not.toContain('Abrir enlace');
  });

  it('opciones con value = id y label truncada', () => {
    const options = buildSelectOptions([item(1, { title: 'x'.repeat(200) })]);
    expect(options[0]?.value).toBe('1');
    expect(options[0]?.label.length).toBeLessThanOrEqual(100);
  });

  it('truncateText recorta exacto', () => {
    expect(truncateText('abcdef', 4)).toBe('abcd');
    expect(truncateText('ab', 4)).toBe('ab');
  });
});

describe('RF-07 customId', () => {
  it('roundtrip mark/page', () => {
    expect(parseCustomId(makeMarkId('u1', 2))).toEqual({ kind: 'mark', userId: 'u1', page: 2 });
    expect(parseCustomId(makePageId('u1', 0))).toEqual({ kind: 'page', userId: 'u1', page: 0 });
  });

  it.each([['xx'], ['bl:mark:u1'], ['bl:zzz:u1:0'], ['bl:mark:u1:NaN'], ['']])('rechaza %j', (id) => {
    expect(parseCustomId(id)).toBeNull();
  });

  it('autoría', () => {
    expect(isAuthorOf({ kind: 'mark', userId: 'u1', page: 0 }, 'u1')).toBe(true);
    expect(isAuthorOf({ kind: 'mark', userId: 'u1', page: 0 }, 'u2')).toBe(false);
  });
});

describe('agrupación por género', () => {
  function genred(id: number, genre: string | null): PendingItem {
    return item(id, { genreRole: genre });
  }

  it('agrupa por orden de aparición y deja Sin género al final', () => {
    const groups = groupByGenre([genred(1, 'House'), genred(2, null), genred(3, 'Techno'), genred(4, 'House')]);
    expect(groups.map((g) => g.genre)).toEqual(['House', 'Techno', null]);
    expect(groups[0]?.items.map((i) => i.backlogId)).toEqual([1, 4]);
  });

  it('cabeceras + numeración continua', () => {
    const fields = buildGroupedFields([genred(1, 'House'), genred(2, null)], 0);
    expect(fields.map((f) => f.name)).toEqual(['\u200b', '1. Artista 1 — Disco 1', '\u200b', '2. Artista 2 — Disco 2']);
    expect(fields.map((f) => f.value)).toEqual(['**House**', expect.stringContaining('Abrir enlace'), '**Sin género**', expect.stringContaining('Abrir enlace')]);
  });

  it('nunca supera 25 fields por página aunque haya muchos géneros', () => {
    const items = Array.from({ length: 30 }, (_, i) => genred(i + 1, `Género ${i + 1}`));
    const first = paginateGrouped(items, 0);
    const fields = buildGroupedFields(first.pageItems, first.startNumber);
    expect(fields.length).toBeLessThanOrEqual(25);
    expect(first.totalPages).toBeGreaterThan(1);
    const second = paginateGrouped(items, 1);
    expect(second.startNumber).toBe(first.pageItems.length);
  });
});
