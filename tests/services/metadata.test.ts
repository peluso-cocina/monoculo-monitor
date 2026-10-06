import { describe, expect, it } from 'vitest';
import { buildFallback, extractFirstUrl, extractRelease, parseMetadata } from '../../src/services/metadataService.js';
import type { FetchFn } from '../../src/services/metadataService.js';

function mockFetch(
  respond: (url: string, signal: AbortSignal) => Promise<{ ok: boolean; status: number; headers: Record<string, string>; url: string; body: string }>,
): FetchFn {
  return async (url, signal) => {
    const res = await respond(url, signal);
    return {
      url: res.url,
      status: res.status,
      ok: res.ok,
      header: (name) => res.headers[name.toLowerCase()] ?? null,
      text: () => Promise.resolve(res.body),
    };
  };
}

const htmlHeaders = { 'content-type': 'text/html', 'content-length': '100' };

const og = (title: string, extra = '') =>
  `<html><head><meta property="og:title" content="${title}"/>${extra}</head></html>`;

describe('RF-03 extractFirstUrl', () => {
  it('encuentra la primera URL del texto', () => {
    expect(extractFirstUrl('mira https://a.com/x y https://b.com')).toBe('https://a.com/x');
  });

  it('sin URL en texto usa el embed', () => {
    expect(extractFirstUrl('sin enlaces', 'https://embed.com/y')).toBe('https://embed.com/y');
  });

  it('sin nada devuelve nulo', () => {
    expect(extractFirstUrl('hola')).toBeNull();
    expect(extractFirstUrl('', 'nota-url')).toBeNull();
  });
});

describe('RF-05 parseMetadata', () => {
  it('extrae OG completo', () => {
    const meta = parseMetadata(
      og('Disco', '<meta property="og:image" content="https://i.com/c.jpg"/><meta property="og:url" content="https://p.com/a"/>'),
      'https://p.com/a',
    );
    expect(meta).toEqual({ title: 'Disco', artist: null, coverUrl: 'https://i.com/c.jpg', url: 'https://p.com/a' });
  });

  it('Bandcamp separa artist y title', () => {
    const meta = parseMetadata(og('Hollow Ground, by Ashenspire'), 'https://band.bandcamp.com/album/x');
    expect(meta.title).toBe('Hollow Ground');
    expect(meta.artist).toBe('Ashenspire');
  });

  it('Bandcamp sin patrón deja artist nulo', () => {
    const meta = parseMetadata(og('Solo Título'), 'https://band.bandcamp.com/album/x');
    expect(meta.title).toBe('Solo Título');
    expect(meta.artist).toBeNull();
  });

  it('Bandcamp usa la última ocurrencia de ", by "', () => {
    const meta = parseMetadata(og('By The Way, by Band, by Singer'), 'https://b.bandcamp.com/a');
    expect(meta.title).toBe('By The Way, by Band');
    expect(meta.artist).toBe('Singer');
  });

  it('fuera de Bandcamp nunca hay artist aunque haya ", by "', () => {
    const meta = parseMetadata(og('Cosa, by Alguien'), 'https://tienda.com/disco');
    expect(meta.title).toBe('Cosa, by Alguien');
    expect(meta.artist).toBeNull();
  });

  it('sin og:url usa la URL de página', () => {
    const meta = parseMetadata(og('T'), 'https://final.com/r');
    expect(meta.url).toBe('https://final.com/r');
  });

  it('sin og:title devuelve todo nulo salvo url', () => {
    const meta = parseMetadata('<html><head></head></html>', 'https://p.com');
    expect(meta).toEqual({ title: null, artist: null, coverUrl: null, url: 'https://p.com' });
  });
});

describe('RF-04 extractRelease', () => {
  const page = og('T', '<meta property="og:image" content="https://i.com/c.jpg"/>');

  it('descarga, parsea y usa la URL final tras redirects', async () => {
    const fetchFn = mockFetch(async (url) => ({
      ok: true, status: 200, headers: htmlHeaders, url: 'https://final.com/r', body: page,
    }));
    expect(await extractRelease('https://corta.com/x', fetchFn)).toEqual({
      title: 'T', artist: null, coverUrl: 'https://i.com/c.jpg', url: 'https://final.com/r',
    });
  });

  it('HTTP de error devuelve nulo', async () => {
    const fetchFn = mockFetch(async (url) => ({ ok: false, status: 404, headers: {}, url, body: '' }));
    expect(await extractRelease('https://p.com/404', fetchFn)).toBeNull();
  });

  it('contenido no-HTML devuelve nulo', async () => {
    const fetchFn = mockFetch(async (url) => ({
      ok: true, status: 200, headers: { 'content-type': 'image/jpeg' }, url, body: 'binario',
    }));
    expect(await extractRelease('https://p.com/foto.jpg', fetchFn)).toBeNull();
  });

  it('content-length gigante aborta sin descargar', async () => {
    let downloaded = false;
    const fetchFn = mockFetch(async (url) => {
      downloaded = true;
      return { ok: true, status: 200, headers: { 'content-type': 'text/html', 'content-length': '99999999' }, url, body: page };
    });
    expect(await extractRelease('https://p.com/big', fetchFn)).toBeNull();
    expect(downloaded).toBe(true);
  });

  it('timeout simulado devuelve nulo rápido', async () => {
    const hanging: FetchFn = (_url, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const start = Date.now();
    expect(await extractRelease('https://lenta.com', hanging, 50)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
  }, 5000);
});

describe('RF-06 buildFallback', () => {
  it('recorta el título a 200 caracteres y deja el resto nulo', () => {
    const meta = buildFallback('x'.repeat(300), 'https://p.com/u');
    expect(meta.title?.length).toBe(200);
    expect(meta).toEqual({ title: 'x'.repeat(200), artist: null, coverUrl: null, url: 'https://p.com/u' });
  });

  it('sin url deja url nula', () => {
    expect(buildFallback('texto', null).url).toBeNull();
  });
});
