import { describe, expect, it, vi } from 'vitest';
import {
  extractRelease,
  isFeatureFmUrl,
  isTidalPlaylist,
  isTidalUrl,
  parseTidalJsonLd,
  parseTidalMeta,
  splitDashTitle,
} from '../../src/services/metadataService.js';
import type { FetchFn } from '../../src/services/metadataService.js';

describe('RF-01 Tidal host detection', () => {
  it.each([
    ['https://tidal.com/album/563888796'],
    ['https://www.tidal.com/album/1'],
    ['https://listen.tidal.com/album/1'],
    ['https://TIDAL.COM/album/1'],
    ['https://tidal.com:443/album/1'],
    ['https://tidal.com./album/1'],
    ['https://tidal.com/track/1'],
  ])('isTidalUrl(%j) es true', (url) => {
    expect(isTidalUrl(url)).toBe(true);
  });

  it.each([
    ['https://tienda.com/disco'],
    ['https://tidal.com.evil.com/album/1'],
    ['https://nottidal.com/album/1'],
    ['https://ffm.to/x'],
    ['nota-url'],
    [''],
  ])('isTidalUrl(%j) es false', (url) => {
    expect(isTidalUrl(url)).toBe(false);
  });
});

describe('RF-01 Feature.fm host detection', () => {
  it.each([
    ['https://ffm.to/somethingworthwaitingfor'],
    ['https://www.ffm.to/x'],
    ['https://feature.fm/x'],
    ['https://go.feature.fm/x'],
    ['https://FEATURE.FM/x'],
  ])('isFeatureFmUrl(%j) es true', (url) => {
    expect(isFeatureFmUrl(url)).toBe(true);
  });

  it.each([
    ['https://orcd.co/x'],
    ['https://feature.fm.evil.com/x'],
    ['https://tidal.com/album/1'],
    ['nota-url'],
  ])('isFeatureFmUrl(%j) es false', (url) => {
    expect(isFeatureFmUrl(url)).toBe(false);
  });
});

describe('RF-05 Tidal playlist detection', () => {
  it.each([
    ['https://tidal.com/playlist/uuid-123'],
    ['https://www.tidal.com/playlist/uuid-123'],
  ])('isTidalPlaylist(%j) es true', (url) => {
    expect(isTidalPlaylist(url)).toBe(true);
  });

  it.each([
    ['https://tidal.com/album/1'],
    ['https://tidal.com/track/1'],
    ['https://tidal.com/artist/1'],
    ['nota-url'],
  ])('isTidalPlaylist(%j) es false', (url) => {
    expect(isTidalPlaylist(url)).toBe(false);
  });
});

const DEAFHEAVEN_HTML = `<html><head>
<meta property="og:title" content="Deafheaven - At Work In The Fields Of The Bomb"/>
<meta property="og:image" content="https://resources.tidal.com/images/f6ad81c8/640x640.jpg"/>
<meta property="og:url" content="https://tidal.com/album/563888796/u"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicAlbum","url":"https://tidal.com/album/563888796","byArtist":[{"@type":"MusicGroup","name":"Deafheaven"}],"image":"https://resources.tidal.com/images/f6ad81c8/640x640.jpg","name":"At Work In The Fields Of The Bomb"}</script>
</head></html>`;

const FRIKO_HTML = `<html><head><title>Friko - Something Worth Waiting For</title>
<meta property="og:title" content="Friko - Something Worth Waiting For"/>
<meta property="og:image" content="https://i.ffmcdn.com/artwork.jpeg"/>
<meta property="og:url" content="https://ffm.to/somethingworthwaitingfor"/>
</head></html>`;

describe('RF-02 parseTidalJsonLd', () => {
  it('byArtist en lista (Deafheaven real)', () => {
    expect(parseTidalJsonLd(DEAFHEAVEN_HTML)).toEqual({
      title: 'At Work In The Fields Of The Bomb', artist: 'Deafheaven',
      coverUrl: 'https://resources.tidal.com/images/f6ad81c8/640x640.jpg',
    });
  });

  it('byArtist como objeto', () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"MusicRecording","name":"Tema","byArtist":{"name":"Solo"},"image":"https://i.com/c.jpg"}</script></head></html>`;
    expect(parseTidalJsonLd(html)).toEqual({ title: 'Tema', artist: 'Solo', coverUrl: 'https://i.com/c.jpg' });
  });

  it('ignora bloques no musicales y devuelve nulo sin música', () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Organization","name":"TIDAL"}</script></head></html>`;
    expect(parseTidalJsonLd(html)).toBeNull();
    expect(parseTidalJsonLd('<html><head></head></html>')).toBeNull();
  });

  it('JSON roto se salta sin romper', () => {
    const html = `<html><head><script type="application/ld+json">no json</script></head></html>`;
    expect(parseTidalJsonLd(html)).toBeNull();
  });
});

describe('RF-03/RF-04 splitDashTitle', () => {
  it.each([
    ['Deafheaven - At Work In The Fields Of The Bomb', 'Deafheaven', 'At Work In The Fields Of The Bomb'],
    ['Friko - Something Worth Waiting For', 'Friko', 'Something Worth Waiting For'],
    ['Jean - Michel - Disco', 'Jean - Michel', 'Disco'],
    ['Solo Título', 'Solo Título', null],
  ])('splitDashTitle(%j)', (input, artist, title) => {
    if (title === null) {
      expect(splitDashTitle(input)).toEqual({ title: input, artist: null });
    } else {
      expect(splitDashTitle(input)).toEqual({ title, artist });
    }
  });
});

describe('RF-02–RF-06 parseTidalMeta', () => {
  it('prefiere JSON-LD sobre OG', () => {
    expect(parseTidalMeta(DEAFHEAVEN_HTML, 'https://tidal.com/album/563888796/u', false)).toEqual({
      title: 'At Work In The Fields Of The Bomb', artist: 'Deafheaven',
      coverUrl: 'https://resources.tidal.com/images/f6ad81c8/640x640.jpg',
      url: 'https://tidal.com/album/563888796/u',
    });
  });

  it('Feature.fm real separa artista y título', () => {
    expect(parseTidalMeta(FRIKO_HTML, 'https://ffm.to/somethingworthwaitingfor', false)).toEqual({
      title: 'Something Worth Waiting For', artist: 'Friko',
      coverUrl: 'https://i.ffmcdn.com/artwork.jpeg', url: 'https://ffm.to/somethingworthwaitingfor',
    });
  });

  it('modo playlist fuerza artist nulo', () => {
    const meta = parseTidalMeta(DEAFHEAVEN_HTML, 'https://tidal.com/playlist/x', true);
    expect(meta?.artist).toBeNull();
    expect(meta?.title).toBe('At Work In The Fields Of The Bomb');
  });

  it('sin metadatos útiles devuelve nulo', () => {
    expect(parseTidalMeta('<html><head><title>Nada</title></head></html>', 'https://tidal.com/album/1', false)).toBeNull();
  });
});

describe('RF-01/RF-05/RF-06 dispatch in extractRelease', () => {
  const htmlFetch: FetchFn = async (url) => ({
    url, status: 200, ok: true, header: () => 'text/html', text: () => Promise.resolve(DEAFHEAVEN_HTML),
  });

  it('URL tidal usa JSON-LD con una sola descarga', async () => {
    const spy = vi.fn(htmlFetch);
    const meta = await extractRelease('https://tidal.com/album/563888796/u', spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(meta).toEqual({
      title: 'At Work In The Fields Of The Bomb', artist: 'Deafheaven',
      coverUrl: 'https://resources.tidal.com/images/f6ad81c8/640x640.jpg',
      url: 'https://tidal.com/album/563888796/u',
    });
  });

  it('URL feature.fm usa split sin tocar Bandcamp/YouTube', async () => {
    const spy = vi.fn(htmlFetch);
    const meta = await extractRelease('https://ffm.to/somethingworthwaitingfor', spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(meta?.artist).toBe('Deafheaven');
  });

  it('Bandcamp no pasa por la vía tidal', async () => {
    const page: FetchFn = async (url) => ({
      url, status: 200, ok: true, header: () => 'text/html',
      text: () => Promise.resolve('<html><head><meta property="og:title" content="A, by B"/></head></html>'),
    });
    const meta = await extractRelease('https://banda.bandcamp.com/album/x', page);
    expect(meta?.artist).toBe('B');
  });

  it('descarga fallida devuelve nulo (el handler aplica fallback)', async () => {
    const fail: FetchFn = async () => ({
      url: '', status: 500, ok: false, header: () => null, text: () => Promise.resolve(''),
    });
    expect(await extractRelease('https://tidal.com/album/1', fail)).toBeNull();
  });
});
