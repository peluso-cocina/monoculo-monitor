import { describe, expect, it, vi } from 'vitest';
import {
  extractRelease,
  extractSoundCloudRelease,
  isSoundCloudSet,
  isSoundCloudUrl,
  parseSoundCloudMeta,
} from '../../src/services/metadataService.js';
import type { FetchFn } from '../../src/services/metadataService.js';

describe('RF-01 SoundCloud host detection', () => {
  it.each([
    ['https://soundcloud.com/cuenta/track'],
    ['https://www.soundcloud.com/cuenta/track'],
    ['https://m.soundcloud.com/cuenta/track'],
    ['https://on.soundcloud.com/abc123'],
    ['https://SOUNDCLOUD.COM/cuenta'],
    ['https://soundcloud.com:443/cuenta'],
  ])('isSoundCloudUrl(%j) es true', (url) => {
    expect(isSoundCloudUrl(url)).toBe(true);
  });

  it.each([
    ['https://tienda.com/disco'],
    ['https://soundcloud.com.evil.com/x'],
    ['https://notsoundcloud.com/x'],
    ['https://youtu.be/abc'],
    ['nota-url'],
    [''],
  ])('isSoundCloudUrl(%j) es false', (url) => {
    expect(isSoundCloudUrl(url)).toBe(false);
  });
});

describe('RF-03 SoundCloud set detection', () => {
  it.each([
    ['https://soundcloud.com/cuenta/sets/nombre'],
    ['https://soundcloud.com/cuenta/sets/nombre/track'],
    ['https://m.soundcloud.com/cuenta/sets/nombre'],
  ])('isSoundCloudSet(%j) es true', (url) => {
    expect(isSoundCloudSet(url)).toBe(true);
  });

  it.each([
    ['https://soundcloud.com/cuenta/track'],
    ['https://soundcloud.com/cuenta'],
    ['https://soundcloud.com/cuenta/likes'],
    ['nota-url'],
  ])('isSoundCloudSet(%j) es false', (url) => {
    expect(isSoundCloudSet(url)).toBe(false);
  });
});

describe('RF-02/RF-03 parseSoundCloudMeta', () => {
  const json = {
    title: 'Midnight Session',
    author_name: 'DJ Colectivo',
    thumbnail_url: 'https://i1.sndcdn.com/artworks-x.jpg',
  };

  it('track normal con cuenta tal cual', () => {
    expect(parseSoundCloudMeta(json, 'https://soundcloud.com/c/tr', false)).toEqual({
      title: 'Midnight Session', artist: 'DJ Colectivo',
      coverUrl: 'https://i1.sndcdn.com/artworks-x.jpg', url: 'https://soundcloud.com/c/tr',
    });
  });

  it('modo set fuerza artist nulo aunque haya autor', () => {
    const meta = parseSoundCloudMeta(json, 'https://soundcloud.com/c/sets/s', true);
    expect(meta?.artist).toBeNull();
    expect(meta?.title).toBe('Midnight Session');
  });

  it('sin título descarta todo', () => {
    expect(parseSoundCloudMeta({ ...json, title: '  ' }, 'https://u', false)).toBeNull();
    expect(parseSoundCloudMeta({ author_name: 'X' }, 'https://u', false)).toBeNull();
    expect(parseSoundCloudMeta(null, 'https://u', false)).toBeNull();
  });

  it('autor o artwork ausentes quedan nulos', () => {
    expect(parseSoundCloudMeta({ title: 'T' }, 'https://u', false)).toEqual({
      title: 'T', artist: null, coverUrl: null, url: 'https://u',
    });
  });
});

describe('RF-04/RF-05 soundcloud download and delegation', () => {
  const oembed = JSON.stringify({
    title: 'Midnight Session',
    author_name: 'DJ Colectivo',
    thumbnail_url: 'https://i1.sndcdn.com/artworks-x.jpg',
  });
  const okFetch: FetchFn = async () => ({
    url: 'https://soundcloud.com/oembed', status: 200, ok: true,
    header: () => 'application/json', text: () => Promise.resolve(oembed),
  });

  it('descarga oEmbed y parsea', async () => {
    expect(await extractSoundCloudRelease('https://soundcloud.com/c/tr', okFetch)).toEqual({
      title: 'Midnight Session', artist: 'DJ Colectivo',
      coverUrl: 'https://i1.sndcdn.com/artworks-x.jpg', url: 'https://soundcloud.com/c/tr',
    });
  });

  it('llama al endpoint oEmbed con la URL codificada', async () => {
    const spy = vi.fn(okFetch);
    await extractSoundCloudRelease('https://on.soundcloud.com/abc', spy);
    const calledUrl = String(spy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('soundcloud.com/oembed');
    expect(calledUrl).toContain(encodeURIComponent('https://on.soundcloud.com/abc'));
  });

  it('404 devuelve nulo', async () => {
    const notFound: FetchFn = async () => ({
      url: '', status: 404, ok: false, header: () => null, text: () => Promise.resolve(''),
    });
    expect(await extractSoundCloudRelease('https://soundcloud.com/c/tr', notFound)).toBeNull();
  });

  it('JSON inválido devuelve nulo', async () => {
    const bad: FetchFn = async () => ({
      url: '', status: 200, ok: true, header: () => 'text/html',
      text: () => Promise.resolve('<html>no json</html>'),
    });
    expect(await extractSoundCloudRelease('https://soundcloud.com/c/tr', bad)).toBeNull();
  });

  it('timeout simulado devuelve nulo rápido', async () => {
    const hanging: FetchFn = (_url, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const start = Date.now();
    expect(await extractSoundCloudRelease('https://soundcloud.com/c/tr', hanging, 50)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
  }, 5000);

  it('extractRelease delega SoundCloud a oEmbed', async () => {
    const spy = vi.fn(okFetch);
    const meta = await extractRelease('https://soundcloud.com/c/tr', spy);
    expect(meta?.artist).toBe('DJ Colectivo');
    expect(String(spy.mock.calls[0]?.[0] ?? '')).toContain('soundcloud.com/oembed');
  });

  it('extractRelease mantiene YouTube y OG intactos', async () => {
    const page: FetchFn = async (url) => ({
      url, status: 200, ok: true, header: () => 'application/json',
      text: () =>
        Promise.resolve(JSON.stringify({ title: 'V', author_name: 'C', thumbnail_url: 'https://i/x.jpg' })),
    });
    const spy = vi.fn(page);
    const meta = await extractRelease('https://youtu.be/x', spy);
    expect(meta?.artist).toBe('C');
    expect(String(spy.mock.calls[0]?.[0] ?? '')).toContain('youtube.com/oembed');
  });
});
