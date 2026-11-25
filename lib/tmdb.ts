import { record, tmdbImage, type Show } from './tv.ts';

const searchEndpoint = 'https://api.themoviedb.org/3/search/tv';
const windowMs = 60_000;
const clientLimit = 20;
const instanceLimit = 180;

function normalizeQuery(value: string | null): string | null {
  if (!value || value.length > 120 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const query = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return query.length >= 2 ? query.toLowerCase() : null;
}

function toShow(value: unknown): Show | null {
  if (!record(value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0
    || typeof value.name !== 'string' || !value.name.trim() || value.adult === true) return null;
  const artwork = [tmdbImage(value.backdrop_path, 'w780'), tmdbImage(value.poster_path, 'w342')]
    .filter((url): url is string => !!url);
  const firstAirYear = typeof value.first_air_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.first_air_date)
    ? value.first_air_date.slice(0, 4) : undefined;
  return {
    id: 'tmdb:' + value.id,
    title: value.name.trim().slice(0, 200),
    firstAirYear,
    overview: typeof value.overview === 'string' ? value.overview.trim().slice(0, 2000) : undefined,
    artwork: artwork.length ? artwork : undefined
  };
}

type Options = {
  token: () => string | undefined;
  fetcher?: typeof fetch;
  clientKey?: (request: Request) => string;
  now?: () => number;
};

export function tmdbClientKey(request: Request) {
  // Vercel overwrites this header at its edge. Off Vercel all callers share a local limit.
  return process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) || 'unknown'
    : 'local';
}

export function createTmdbRateLimiter() {
  let windowStart = -Infinity;
  let requests = 0;
  const clients = new Map<string, number>();

  return (key: string, time: number): number | undefined => {
    if (time - windowStart >= windowMs) {
      windowStart = time;
      clients.clear();
      requests = 0;
    }
    const used = clients.get(key) ?? 0;
    if (requests >= instanceLimit || used >= clientLimit) {
      return Math.ceil((windowStart + windowMs - time) / 1000);
    }
    requests++;
    clients.set(key, used + 1);
  };
}

export function createSearchHandler({ token, fetcher, clientKey = () => 'local', now = Date.now }: Options) {
  const rateLimit = createTmdbRateLimiter();

  function reply(body: object, status = 200, retryAfter?: number) {
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (retryAfter !== undefined) headers['Retry-After'] = String(retryAfter);
    return Response.json(body, { status, headers });
  }

  return async function search(request: Request) {
    const query = normalizeQuery(new URL(request.url).searchParams.get('q'));
    if (!query) return reply({ error: 'Enter a TV title between 2 and 120 characters.' }, 400);
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return reply({ error: 'Search is available from Our Show.' }, 403);
    }

    const secret = token()?.trim();
    if (!secret) return reply({ error: 'TV search is unavailable. You can still add a show manually.' }, 503);

    const retryAfter = rateLimit(clientKey(request), now());
    if (retryAfter !== undefined) return reply({ error: 'Too many searches. Try again shortly.' }, 429, retryAfter);

    const url = new URL(searchEndpoint);
    url.search = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', page: '1' }).toString();
    try {
      const response = await (fetcher ?? fetch)(url, {
        headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(6000)
      });
      if (response.status === 429) {
        const limit = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
        return reply({ error: 'TV search is busy. Try again shortly, or add a show manually.' }, 429, limit > 0 ? Math.min(limit, 300) : 60);
      }
      if (!response.ok) return reply({ error: 'TV search is temporarily unavailable. Try again or add a show manually.' }, 502);
      const body: unknown = await response.json();
      if (!record(body) || !Array.isArray(body.results)) {
        return reply({ error: 'TV search returned an unexpected response. Try again or add a show manually.' }, 502);
      }

      const results = body.results.flatMap(value => {
        const show = toShow(value);
        return show ? [show] : [];
      });
      return reply({ results: [...new Map(results.map(show => [show.id, show])).values()].slice(0, 20) });
    } catch {
      return reply({ error: 'TV search couldn’t connect. Try again or add a show manually.' }, 503);
    }
  };
}
