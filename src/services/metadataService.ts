import { load } from 'cheerio';
import type { ReleaseMeta } from '../types/index.js';

const URL_PATTERN = /https?:\/\/[^\s<>]+/i;
const BANDCAMP_SUFFIX = 'bandcamp.com';
const BANDCAMP_SEPARATOR = ', by ';

export function extractFirstUrl(content: string, embedUrl?: string | null): string | null {
  const match = URL_PATTERN.exec(content);
  if (match) return match[0];
  if (embedUrl && /^https?:\/\//i.test(embedUrl)) return embedUrl;
  return null;
}

function readMeta($: ReturnType<typeof load>, property: string): string | null {
  const value = $(`meta[property="${property}"]`).first().attr('content')?.trim();
  return value === undefined || value === '' ? null : value;
}

function splitBandcampTitle(ogTitle: string): { title: string; artist: string | null } {
  const cut = ogTitle.lastIndexOf(BANDCAMP_SEPARATOR);
  if (cut < 0) return { title: ogTitle, artist: null };
  return {
    title: ogTitle.slice(0, cut).trim(),
    artist: ogTitle.slice(cut + BANDCAMP_SEPARATOR.length).trim() || null,
  };
}

export function parseMetadata(html: string, pageUrl: string): ReleaseMeta {
  const $ = load(html);
  const ogTitle = readMeta($, 'og:title');
  const coverUrl = readMeta($, 'og:image');
  const url = readMeta($, 'og:url') ?? pageUrl;
  if (ogTitle === null) return { title: null, artist: null, coverUrl, url };
  let hostname = '';
  try {
    hostname = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    hostname = '';
  }
  if (!hostname.endsWith(BANDCAMP_SUFFIX)) return { title: ogTitle, artist: null, coverUrl, url };
  const { title, artist } = splitBandcampTitle(ogTitle);
  return { title, artist, coverUrl, url };
}

export const FETCH_TIMEOUT_MS = 4000;
export const MAX_DOWNLOAD_BYTES = 2_000_000;
export const MAX_HTML_CHARS = 1_000_000;
export const FALLBACK_TITLE_CHARS = 200;

export interface FetchResponseLike {
  readonly url: string;
  readonly status: number;
  readonly ok: boolean;
  header(name: string): string | null;
  text(): Promise<string>;
}

export type FetchFn = (url: string, signal: AbortSignal) => Promise<FetchResponseLike>;

const defaultFetch: FetchFn = (url, signal) =>
  fetch(url, { signal }).then((res) => ({
    url: res.url,
    status: res.status,
    ok: res.ok,
    header: (name: string) => res.headers.get(name),
    text: () => res.text(),
  }));

export async function extractRelease(
  url: string,
  fetchFn: FetchFn = defaultFetch,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<ReleaseMeta | null> {
  if (isYouTubeUrl(url)) return extractYouTubeRelease(url, fetchFn, timeoutMs);
  if (isSoundCloudUrl(url)) return extractSoundCloudRelease(url, fetchFn, timeoutMs);
  try {
    const res = await fetchFn(url, AbortSignal.timeout(timeoutMs));
    if (!res.ok) return null;
    const contentType = res.header('content-type') ?? '';
    if (contentType !== '' && !contentType.includes('text/html')) return null;
    const length = Number(res.header('content-length'));
    if (Number.isFinite(length) && length > MAX_DOWNLOAD_BYTES) return null;
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    const finalUrl = res.url === '' ? url : res.url;
    if (isTidalUrl(url) || isFeatureFmUrl(url)) {
      return parseTidalMeta(html, finalUrl, isPlaylistUrl(url) || isTidalPlaylist(url));
    }
    return parseMetadata(html, finalUrl);
  } catch {
    return null;
  }
}

export function buildFallback(content: string, url: string | null): ReleaseMeta {
  const title = content.slice(0, FALLBACK_TITLE_CHARS);
  return { title: title === '' ? null : title, artist: null, coverUrl: null, url };
}

const YOUTUBE_OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';
const SOUNDCLOUD_OEMBED_ENDPOINT = 'https://soundcloud.com/oembed';

type OEmbedParser = (json: unknown, pageUrl: string, isCollection: boolean) => ReleaseMeta | null;

async function fetchOEmbedMeta(
  endpoint: string,
  url: string,
  parse: OEmbedParser,
  isCollection: boolean,
  fetchFn: FetchFn,
  timeoutMs: number,
): Promise<ReleaseMeta | null> {
  try {
    const res = await fetchFn(
      `${endpoint}?url=${encodeURIComponent(url)}&format=json`,
      AbortSignal.timeout(timeoutMs),
    );
    if (!res.ok) return null;
    const json: unknown = JSON.parse(await res.text());
    return parse(json, url, isCollection);
  } catch {
    return null;
  }
}

export async function extractYouTubeRelease(
  url: string,
  fetchFn: FetchFn = defaultFetch,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<ReleaseMeta | null> {
  return fetchOEmbedMeta(YOUTUBE_OEMBED_ENDPOINT, url, parseYouTubeMeta, isPlaylistUrl(url), fetchFn, timeoutMs);
}

export async function extractSoundCloudRelease(
  url: string,
  fetchFn: FetchFn = defaultFetch,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<ReleaseMeta | null> {
  return fetchOEmbedMeta(
    SOUNDCLOUD_OEMBED_ENDPOINT,
    url,
    parseSoundCloudMeta,
    isSoundCloudSet(url),
    fetchFn,
    timeoutMs,
  );
}

const YOUTUBE_APEX = 'youtube.com';
const YOUTU_BE_APEXES = new Set(['youtu.be', 'www.youtu.be']);

export function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return '';
  }
}

export function isYouTubeUrl(url: string): boolean {
  const host = normalizeHost(url);
  if (host === '') return false;
  if (YOUTU_BE_APEXES.has(host)) return true;
  return host === YOUTUBE_APEX || host.endsWith(`.${YOUTUBE_APEX}`);
}

export function isPlaylistUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('list')) return true;
    return parsed.pathname === '/playlist' || parsed.pathname.startsWith('/playlist/');
  } catch {
    return false;
  }
}

const SOUNDCLOUD_APEX = 'soundcloud.com';

export function isSoundCloudUrl(url: string): boolean {
  const host = normalizeHost(url);
  if (host === '') return false;
  return host === SOUNDCLOUD_APEX || host.endsWith(`.${SOUNDCLOUD_APEX}`);
}

export function isSoundCloudSet(url: string): boolean {
  try {
    return new URL(url).pathname.split('/').includes('sets');
  } catch {
    return false;
  }
}

const TIDAL_APEX = 'tidal.com';
const FEATURE_FM_APEX = 'feature.fm';
const FFM_TO_APEXES = new Set(['ffm.to', 'www.ffm.to']);

export function isTidalUrl(url: string): boolean {
  const host = normalizeHost(url);
  if (host === '') return false;
  return host === TIDAL_APEX || host.endsWith(`.${TIDAL_APEX}`);
}

export function isFeatureFmUrl(url: string): boolean {
  const host = normalizeHost(url);
  if (host === '') return false;
  if (FFM_TO_APEXES.has(host)) return true;
  return host === FEATURE_FM_APEX || host.endsWith(`.${FEATURE_FM_APEX}`);
}

export function isTidalPlaylist(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path === '/playlist' || path.startsWith('/playlist/');
  } catch {
    return false;
  }
}

const TIDAL_DASH_SEPARATOR = ' - ';
const MUSIC_JSON_LD_TYPES = new Set(['MusicAlbum', 'MusicRecording']);

export interface TidalJsonLd {
  title: string;
  artist: string | null;
  coverUrl: string | null;
}

function readJsonLdBlocks($: ReturnType<typeof load>): unknown[] {
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text();
    if (text.trim() === '') return;
    try {
      blocks.push(JSON.parse(text) as unknown);
    } catch {
      // broken block: skip
    }
  });
  return blocks;
}

function flattenJsonLd(block: unknown): Record<string, unknown>[] {
  if (Array.isArray(block)) return block.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null);
  if (typeof block !== 'object' || block === null) return [];
  const record = block as Record<string, unknown>;
  const graph = record['@graph'];
  if (Array.isArray(graph)) {
    return graph.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null);
  }
  return [record];
}

function isMusicBlock(record: Record<string, unknown>): boolean {
  const type = record['@type'];
  if (typeof type === 'string') return MUSIC_JSON_LD_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && MUSIC_JSON_LD_TYPES.has(t));
  return false;
}

function readArtistName(byArtist: unknown): string | null {
  const first = Array.isArray(byArtist) ? byArtist[0] : byArtist;
  if (typeof first !== 'object' || first === null) return null;
  const name = (first as Record<string, unknown>)['name'];
  if (typeof name !== 'string' || name.trim() === '') return null;
  return name.trim();
}

function readImageUrl(image: unknown): string | null {
  if (typeof image !== 'string' || image.trim() === '') return null;
  return image.trim();
}

export function parseTidalJsonLd(html: string): TidalJsonLd | null {
  const $ = load(html);
  for (const block of readJsonLdBlocks($)) {
    for (const record of flattenJsonLd(block)) {
      if (!isMusicBlock(record)) continue;
      const name = record['name'];
      if (typeof name !== 'string' || name.trim() === '') continue;
      return {
        title: name.trim(),
        artist: readArtistName(record['byArtist']),
        coverUrl: readImageUrl(record['image']),
      };
    }
  }
  return null;
}

export function splitDashTitle(ogTitle: string): { title: string; artist: string | null } {
  const cut = ogTitle.lastIndexOf(TIDAL_DASH_SEPARATOR);
  if (cut < 0) return { title: ogTitle, artist: null };
  return {
    title: ogTitle.slice(cut + TIDAL_DASH_SEPARATOR.length).trim(),
    artist: ogTitle.slice(0, cut).trim() || null,
  };
}

export function parseTidalMeta(html: string, pageUrl: string, isPlaylist: boolean): ReleaseMeta | null {
  const $ = load(html);
  const ogUrl = readMeta($, 'og:url') ?? pageUrl;
  const jsonLd = parseTidalJsonLd(html);
  if (jsonLd !== null) {
    return {
      title: jsonLd.title,
      artist: isPlaylist ? null : jsonLd.artist,
      coverUrl: jsonLd.coverUrl,
      url: ogUrl,
    };
  }
  const ogTitle = readMeta($, 'og:title');
  if (ogTitle === null) return null;
  const { title, artist } = splitDashTitle(ogTitle);
  return { title, artist: isPlaylist ? null : artist, coverUrl: readMeta($, 'og:image'), url: ogUrl };
}

const TOPIC_SUFFIX = ' - Topic';

export function stripTopicSuffix(channel: string): string {
  const trimmed = channel.trim();
  if (trimmed.endsWith(TOPIC_SUFFIX)) return trimmed.slice(0, -TOPIC_SUFFIX.length).trim();
  return trimmed;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, entity: string) => {
      if (entity.startsWith('#')) {
        const codePoint = entity.startsWith('#x')
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        return Number.isSafeInteger(codePoint) ? String.fromCodePoint(codePoint) : match;
      }
      return NAMED_ENTITIES[entity] ?? match;
    })
    .trim();
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

type OEmbedArtistPolicy = 'strip-topic' | 'as-is' | 'force-null';

function parseOEmbedMeta(json: unknown, pageUrl: string, policy: OEmbedArtistPolicy): ReleaseMeta | null {
  if (typeof json !== 'object' || json === null) return null;
  const record = json as Record<string, unknown>;
  const rawTitle = readStringField(record, 'title');
  if (rawTitle === null) return null;
  const author = readStringField(record, 'author_name');
  const thumbnail = readStringField(record, 'thumbnail_url');
  const artist =
    policy === 'force-null' || author === null
      ? null
      : policy === 'strip-topic'
        ? stripTopicSuffix(author)
        : author;
  return {
    title: decodeEntities(rawTitle),
    artist,
    coverUrl: thumbnail,
    url: pageUrl,
  };
}

export function parseYouTubeMeta(json: unknown, pageUrl: string, isPlaylist: boolean): ReleaseMeta | null {
  return parseOEmbedMeta(json, pageUrl, isPlaylist ? 'force-null' : 'strip-topic');
}

export function parseSoundCloudMeta(json: unknown, pageUrl: string, isSet: boolean): ReleaseMeta | null {
  return parseOEmbedMeta(json, pageUrl, isSet ? 'force-null' : 'as-is');
}
