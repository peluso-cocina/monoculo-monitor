import { describe, expect, it, vi } from 'vitest';
import {
  decodeEntities,
  extractRelease,
  extractYouTubeRelease,
  isPlaylistUrl,
  isYouTubeUrl,
  normalizeHost,
  parseYouTubeMeta,
  stripTopicSuffix,
} from '../../src/services/metadataService.js';
import type { FetchFn } from '../../src/services/metadataService.js';

describe('RF-01 YouTube host detection', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'www.youtube.com'],
    ['https://YOUTUBE.COM/watch?v=abc', 'youtube.com'],
    ['https://m.youtube.com/watch?v=abc', 'm.youtube.com'],
    ['https://music.youtube.com/watch?v=abc', 'music.youtube.com'],
    ['https://youtu.be/abc', 'youtu.be'],
    ['https://youtube.com:443/watch', 'youtube.com'],
    ['https://youtube.com./watch', 'youtube.com'],
  ])('normalizeHost(%j) → %j', (url, expected) => {
    expect(normalizeHost(url)).toBe(expected);
  });

  it.each([
    ['https://www.youtube.com/watch?v=abc'],
    ['https://youtube.com/watch?v=abc'],
    ['https://m.youtube.com/watch?v=abc'],
    ['https://music.youtube.com/watch?v=abc'],
    ['https://youtu.be/abc'],
    ['https://www.youtu.be/abc'],
    ['https://YOUTUBE.COM/shorts/x'],
  ])('isYouTubeUrl(%j) es true', (url) => {
    expect(isYouTubeUrl(url)).toBe(true);
  });

  it.each([
    ['https://tienda.com/disco'],
    ['https://notyoutube.com/watch'],
    ['https://youtube.com.evil.com/watch'],
    ['https://evilyoutu.be/watch'],
    ['nota-url'],
    [''],
  ])('isYouTubeUrl(%j) es false', (url) => {
    expect(isYouTubeUrl(url)).toBe(false);
  });
});

describe('RF-03 playlist detection', () => {
  it.each([
    ['https://www.youtube.com/playlist?list=PLabc'],
    ['https://www.youtube.com/watch?v=abc&list=PLabc'],
    ['https://youtu.be/abc?list=PLabc'],
    ['https://music.youtube.com/playlist?list=PLabc'],
  ])('isPlaylistUrl(%j) es true', (url) => {
    expect(isPlaylistUrl(url)).toBe(true);
  });

  it.each([
    ['https://www.youtube.com/watch?v=abc'],
    ['https://youtu.be/abc'],
    ['nota-url'],
  ])('isPlaylistUrl(%j) es false', (url) => {
    expect(isPlaylistUrl(url)).toBe(false);
  });
});

describe('RF-02 topic suffix and entities', () => {
  it.each([
    ['Ashenspire - Topic', 'Ashenspire'],
    ['Ashenspire', 'Ashenspire'],
    ['X - Topic Extra', 'X - Topic Extra'],
    ['x - topic', 'x - topic'],
    ['  Padded - Topic  ', 'Padded'],
  ])('stripTopicSuffix(%j) → %j', (input, expected) => {
    expect(stripTopicSuffix(input)).toBe(expected);
  });

  it.each([
    ['Rock &amp; Roll', 'Rock & Roll'],
    ['A &lt; B &gt; C', 'A < B > C'],
    ['&#39;quoted&#39;', "'quoted'"],
    ['&#65;BC', 'ABC'],
    ['  espacios  ', 'espacios'],
    ['sin nada &unknown;', 'sin nada &unknown;'],
  ])('decodeEntities(%j) → %j', (input, expected) => {
    expect(decodeEntities(input)).toBe(expected);
  });
});

describe('RF-02/RF-03 parseYouTubeMeta', () => {
  const json = {
    title: 'Hollow Ground',
    author_name: 'Ashenspire - Topic',
    thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
  };

  it('vídeo normal', () => {
    expect(parseYouTubeMeta(json, 'https://youtu.be/abc', false)).toEqual({
      title: 'Hollow Ground', artist: 'Ashenspire',
      coverUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg', url: 'https://youtu.be/abc',
    });
  });

  it('modo playlist fuerza artist nulo aunque haya autor', () => {
    const meta = parseYouTubeMeta(json, 'https://youtube.com/playlist?list=PL', true);
    expect(meta?.artist).toBeNull();
    expect(meta?.title).toBe('Hollow Ground');
  });

  it('sin título descarta todo', () => {
    expect(parseYouTubeMeta({ ...json, title: '  ' }, 'https://u', false)).toBeNull();
    expect(parseYouTubeMeta({ author_name: 'X' }, 'https://u', false)).toBeNull();
    expect(parseYouTubeMeta(null, 'https://u', false)).toBeNull();
    expect(parseYouTubeMeta('texto', 'https://u', false)).toBeNull();
  });

  it('autor o miniatura ausentes quedan nulos', () => {
    expect(parseYouTubeMeta({ title: 'T' }, 'https://u', false)).toEqual({
      title: 'T', artist: null, coverUrl: null, url: 'https://u',
    });
  });
});

describe('RF-04/RF-05 youtube download and delegation', () => {
  const oembed = JSON.stringify({
    title: 'Sesión Histórica',
    author_name: 'Canal - Topic',
    thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
  });
  const okFetch: FetchFn = async () => ({
    url: 'https://www.youtube.com/oembed', status: 200, ok: true,
    header: () => 'application/json', text: () => Promise.resolve(oembed),
  });

  it('descarga oEmbed y parsea', async () => {
    expect(await extractYouTubeRelease('https://youtu.be/x', okFetch)).toEqual({
      title: 'Sesión Histórica', artist: 'Canal',
      coverUrl: 'https://i.ytimg.com/vi/x/hqdefault.jpg', url: 'https://youtu.be/x',
    });
  });

  it('llama al endpoint oEmbed con la URL codificada', async () => {
    const spy = vi.fn(okFetch);
    await extractYouTubeRelease('https://youtu.be/x?t=30', spy);
    const calledUrl = String(spy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('oembed');
    expect(calledUrl).toContain(encodeURIComponent('https://youtu.be/x?t=30'));
  });

  it('404 devuelve nulo', async () => {
    const notFound: FetchFn = async () => ({
      url: '', status: 404, ok: false, header: () => null, text: () => Promise.resolve(''),
    });
    expect(await extractYouTubeRelease('https://youtu.be/x', notFound)).toBeNull();
  });

  it('JSON inválido devuelve nulo', async () => {
    const bad: FetchFn = async () => ({
      url: '', status: 200, ok: true, header: () => 'text/html',
      text: () => Promise.resolve('<html>no json</html>'),
    });
    expect(await extractYouTubeRelease('https://youtu.be/x', bad)).toBeNull();
  });

  it('timeout simulado devuelve nulo rápido', async () => {
    const hanging: FetchFn = (_url, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const start = Date.now();
    expect(await extractYouTubeRelease('https://youtu.be/x', hanging, 50)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
  }, 5000);

  it('extractRelease delega YouTube a oEmbed y no al scraper', async () => {
    const spy = vi.fn(okFetch);
    const meta = await extractRelease('https://youtu.be/x', spy);
    expect(meta?.artist).toBe('Canal');
    expect(String(spy.mock.calls[0]?.[0] ?? '')).toContain('oembed');
  });

  it('extractRelease mantiene el scraper para no-YouTube', async () => {
    const page: FetchFn = async (url) => ({
      url, status: 200, ok: true, header: () => 'text/html',
      text: () => Promise.resolve('<html><head><meta property="og:title" content="D"/></head></html>'),
    });
    const spy = vi.fn(page);
    const meta = await extractRelease('https://tienda.com/d', spy);
    expect(meta?.title).toBe('D');
    expect(String(spy.mock.calls[0]?.[0] ?? '')).not.toContain('oembed');
  });
});
