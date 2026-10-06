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
  try {
    const res = await fetchFn(url, AbortSignal.timeout(timeoutMs));
    if (!res.ok) return null;
    const contentType = res.header('content-type') ?? '';
    if (contentType !== '' && !contentType.includes('text/html')) return null;
    const length = Number(res.header('content-length'));
    if (Number.isFinite(length) && length > MAX_DOWNLOAD_BYTES) return null;
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    return parseMetadata(html, res.url === '' ? url : res.url);
  } catch {
    return null;
  }
}

export function buildFallback(content: string, url: string | null): ReleaseMeta {
  const title = content.slice(0, FALLBACK_TITLE_CHARS);
  return { title: title === '' ? null : title, artist: null, coverUrl: null, url };
}
