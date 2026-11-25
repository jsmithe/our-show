import { createTmdbRateLimiter } from './tmdb.ts';
import { record } from './tv.ts';
import { parseSeriesId, validatedWatchLink, watchRegion, watchTtlMs, type StreamingService, type WatchAvailability,
  type WatchResponse } from './watch-availability.ts';

const maxCachedSeries = 256;

// Direct tiers confirmed in the authenticated U.S. directory. See the release validation notes.
const verifiedProviderIds = new Map<number, StreamingService>([
  [8, 'Netflix'], [1796, 'Netflix'],
  [9, 'Prime Video'], [2100, 'Prime Video'],
  [337, 'Disney+'],
  [15, 'Hulu'],
  [2303, 'Paramount+'], [2616, 'Paramount+']
]);

// The U.S. Disney+ listing for Only Murders in the Building may require a Hulu subscription.
const disputedMatches = new Map<number, StreamingService>([[107113, 'Disney+']]);

function parseAvailability(body: unknown, seriesId: number): WatchAvailability | null {
  if (!record(body) || body.id !== seriesId || !record(body.results)) return null;
  const region = body.results[watchRegion];
  if (region === undefined) return { services: [], link: null };
  if (!record(region)) return null;

  const flatrate = region.flatrate === undefined ? [] : region.flatrate;
  if (!Array.isArray(flatrate) || !flatrate.every(offer => record(offer) && typeof offer.provider_id === 'number'
    && Number.isSafeInteger(offer.provider_id) && offer.provider_id > 0)) return null;

  const matches = new Set<StreamingService>();
  for (const offer of flatrate) {
    const service = verifiedProviderIds.get(offer.provider_id);
    if (service && service !== disputedMatches.get(seriesId)) matches.add(service);
  }
  return { services: [...matches], link: validatedWatchLink(region.link, seriesId) };
}

type CacheEntry = { availability: WatchAvailability; expiresAt: number };
type Lookup = { entry: CacheEntry } | { status: number; retryAfter?: number };
type Options = {
  token: () => string | undefined;
  fetcher?: typeof fetch;
  clientKey?: (request: Request) => string;
  now?: () => number;
};

export function createWatchProvidersHandler({ token, fetcher, clientKey = () => 'local', now = Date.now }: Options) {
  const cache = new Map<string, CacheEntry>();
  const pending = new Map<string, Promise<Lookup>>();
  const rateLimit = createTmdbRateLimiter();

  function reply(body: WatchResponse | { error: string }, status = 200, retryAfter?: number) {
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (retryAfter !== undefined) headers['Retry-After'] = String(retryAfter);
    return Response.json(body, { status, headers });
  }

  function sendEntry(entry: CacheEntry) {
    const validForMs = entry.expiresAt - now();
    if (validForMs <= 0) return reply({ error: 'Availability unknown.' }, 503);
    return reply({ ...entry.availability, validForMs });
  }

  async function lookup(id: number, secret: string): Promise<Lookup> {
    try {
      const res = await (fetcher ?? fetch)(`https://api.themoviedb.org/3/tv/${id}/watch/providers`, {
        headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5000)
      });
      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
        return { status: 429, retryAfter: retryAfter > 0 ? Math.min(retryAfter, 300) : 60 };
      }
      if (!res.ok) return { status: 502 };
      const availability = parseAvailability(await res.json(), id);
      if (!availability) return { status: 502 };
      return { entry: { availability, expiresAt: now() + watchTtlMs } };
    } catch {
      return { status: 503 };
    }
  }

  return async function watchProviders(request: Request) {
    const ids = new URL(request.url).searchParams.getAll('id');
    const id = ids.length === 1 ? parseSeriesId(ids[0]) : undefined;
    if (!id) return reply({ error: 'Enter a valid TMDB series ID.' }, 400);
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return reply({ error: 'Watch providers are available from Our Show.' }, 403);
    }
    const secret = token()?.trim();
    if (!secret) return reply({ error: 'Availability unknown.' }, 503);

    const key = watchRegion + ':' + id;
    const entry = cache.get(key);
    if (entry && entry.expiresAt > now()) return sendEntry(entry);
    cache.delete(key);

    let active = pending.get(key);
    if (!active) {
      const retryAfter = rateLimit(clientKey(request), now());
      if (retryAfter !== undefined) return reply({ error: 'Availability unknown.' }, 429, retryAfter);

      active = lookup(id, secret).then(result => {
        if ('entry' in result) {
          const oldest = cache.keys().next();
          if (cache.size >= maxCachedSeries && !oldest.done) cache.delete(oldest.value);
          cache.set(key, result.entry);
        }
        return result;
      }).finally(() => pending.delete(key));
      pending.set(key, active);
    }

    const result = await active;
    return 'entry' in result ? sendEntry(result.entry) : reply({ error: 'Availability unknown.' }, result.status, result.retryAfter);
  };
}
