export const PAGE_SIZE = 25;
export const MAX_LABEL_CHARS = 100;
export const MAX_FIELD_NAME_CHARS = 250;
export const MAX_FIELD_VALUE_CHARS = 1024;

export type {
  BacklogPage,
  CustomIdKind,
  ParsedCustomId,
  PendingItem,
} from '../types/index.js';
import type { BacklogPage, CustomIdKind, ParsedCustomId, PendingItem } from '../types/index.js';

export interface EmbedFieldView {
  name: string;
  value: string;
}

export interface SelectOptionView {
  label: string;
  value: string;
  description?: string;
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isInteger(page) || page < 0) return 0;
  if (page > totalPages - 1) return totalPages - 1;
  return page;
}

export function paginate(items: PendingItem[], page: number, perPage: number = PAGE_SIZE): BacklogPage {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safe = clampPage(page, totalPages);
  return { pageItems: items.slice(safe * perPage, safe * perPage + perPage), page: safe, totalPages };
}

export function truncateText(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

export function formatPageTitle(page: number, totalPages: number): string {
  return `Tus pendientes (página ${page + 1} de ${totalPages})`;
}

export function buildFields(items: PendingItem[]): EmbedFieldView[] {
  return items.map((item, index) => {
    const name = truncateText(
      `${index + 1}. ${item.artist ?? 'Desconocido'} — ${item.title ?? 'Sin título'}`,
      MAX_FIELD_NAME_CHARS,
    );
    const lines: string[] = [];
    if (item.url !== null) lines.push(`[Abrir enlace](${item.url})`);
    else lines.push('Sin enlace');
    if (item.genreRole !== null) lines.push(`Género: ${item.genreRole}`);
    return { name, value: truncateText(lines.join('\n'), MAX_FIELD_VALUE_CHARS) };
  });
}

export function buildSelectOptions(items: PendingItem[]): SelectOptionView[] {
  return items.map((item) => {
    const option: SelectOptionView = {
      label: truncateText(`${item.artist ?? 'Desconocido'} — ${item.title ?? 'Sin título'}`, MAX_LABEL_CHARS),
      value: String(item.backlogId),
    };
    if (item.genreRole !== null) option.description = truncateText(item.genreRole, MAX_LABEL_CHARS);
    return option;
  });
}

export function makeMarkId(userId: string, page: number): string {
  return `bl:mark:${userId}:${page}`;
}

export function makePageId(userId: string, page: number): string {
  return `bl:page:${userId}:${page}`;
}

const CUSTOM_ID_PATTERN = /^bl:(mark|page):([^:]+):(\d+)$/;

export function parseCustomId(customId: string): ParsedCustomId | null {
  const match = CUSTOM_ID_PATTERN.exec(customId);
  if (!match) return null;
  const kind = match[1] as CustomIdKind;
  const userId = match[2] as string;
  const page = Number(match[3]);
  if (!Number.isInteger(page)) return null;
  return { kind, userId, page };
}

export function isAuthorOf(parsed: ParsedCustomId, interactionUserId: string): boolean {
  return parsed.userId === interactionUserId;
}

export interface GenreGroup {
  genre: string | null;
  items: PendingItem[];
}

export interface GroupedPage extends BacklogPage {
  startNumber: number;
}

export const MAX_FIELDS_PER_PAGE = 25;
export const NO_GENRE_LABEL = 'Sin género';

export function groupByGenre(items: PendingItem[]): GenreGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, PendingItem[]>();
  for (const item of items) {
    const key = item.genreRole ?? '';
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)?.push(item);
  }
  const groups: GenreGroup[] = order
    .filter((key) => key !== '')
    .map((key) => ({ genre: key, items: buckets.get(key) ?? [] }));
  const ungrouped = buckets.get('') ?? [];
  if (ungrouped.length > 0) groups.push({ genre: null, items: ungrouped });
  return groups;
}

function fieldsFor(groups: GenreGroup[], maxFields: number): { pages: PendingItem[][] } {
  const pages: PendingItem[][] = [[]];
  let used = 0;
  const flat: { genre: string | null; item: PendingItem }[] = [];
  for (const group of groups) for (const item of group.items) flat.push({ genre: group.genre, item });
  let pageGenres = new Set<string | null>();
  for (const entry of flat) {
    let need = 1;
    if (!pageGenres.has(entry.genre)) need += 1;
    if (used + need > maxFields && (pages[pages.length - 1]?.length ?? 0) > 0) {
      pages.push([]);
      used = 0;
      pageGenres = new Set();
      need = 2;
    }
    pages[pages.length - 1]?.push(entry.item);
    pageGenres.add(entry.genre);
    used += need;
  }
  return { pages };
}

export function paginateGrouped(items: PendingItem[], page: number): GroupedPage {
  const { pages } = fieldsFor(groupByGenre(items), MAX_FIELDS_PER_PAGE);
  const totalPages = pages.length;
  const safe = clampPage(page, totalPages);
  const pageItems = pages[safe] ?? [];
  const startNumber = pages.slice(0, safe).reduce((acc, p) => acc + p.length, 0);
  return { pageItems, page: safe, totalPages, startNumber };
}

export function buildGroupedFields(pageItems: PendingItem[], startNumber: number): EmbedFieldView[] {
  const groups = groupByGenre(pageItems);
  const fields: EmbedFieldView[] = [];
  let number = startNumber;
  for (const group of groups) {
    fields.push({ name: '\u200b', value: `**${group.genre ?? NO_GENRE_LABEL}**` });
    for (const item of group.items) {
      number += 1;
      const name = truncateText(
        `${number}. ${item.artist ?? 'Desconocido'} — ${item.title ?? 'Sin título'}`,
        MAX_FIELD_NAME_CHARS,
      );
      const lines: string[] = [];
      if (item.url !== null) lines.push(`[Abrir enlace](${item.url})`);
      else lines.push('Sin enlace');
      fields.push({ name, value: truncateText(lines.join('\n'), MAX_FIELD_VALUE_CHARS) });
    }
  }
  return fields;
}
