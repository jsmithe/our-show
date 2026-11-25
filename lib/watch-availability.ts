import { record, type Show } from './tv.ts';

export const services = ['Prime Video', 'Netflix', 'Paramount+', 'Disney+', 'Hulu'] as const;
export type StreamingService = (typeof services)[number];

export const watchRegion = 'US';
export const watchTtlMs = 6 * 60 * 60 * 1000;
const watchOrigin = 'https://www.themoviedb.org';

export type WatchAvailability = { services: StreamingService[]; link: string | null };
export type WatchResponse = WatchAvailability & { validForMs: number };
export type CurrentWatchAvailability = { availability: WatchAvailability; expiresAt: number };

const starterSeries = new Map([['mock-1', 82728], ['mock-11', 69926]]);

export function parseSeriesId(value: string | null): number | undefined {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return;
  const id = Number(value);
  if (Number.isSafeInteger(id) && String(id) === value) return id;
}

export function watchSeriesId(show: Show): number | undefined {
  if (show.kind === 'channel') return;
  if (show.id.startsWith('tmdb:')) return parseSeriesId(show.id.slice(5));
  return starterSeries.get(show.id);
}

export function validatedWatchLink(value: unknown, seriesId: number): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== watchOrigin || url.username || url.password || url.hash
      || url.search !== '?locale=' + watchRegion) {
      return null;
    }
    const path = decodeURIComponent(url.pathname);
    const match = /^\/tv\/([1-9][0-9]*)(?:-[\p{L}\p{N}_-]+)?\/watch$/u.exec(path);
    return match?.[1] === String(seriesId) ? url.href : null;
  } catch {
    return null;
  }
}

export function readWatchResponse(value: unknown, seriesId: number, startedAt: number, now: number): CurrentWatchAvailability | undefined {
  if (!record(value) || !Array.isArray(value.services) || typeof value.validForMs !== 'number'
    || !Number.isSafeInteger(value.validForMs) || value.validForMs <= 0 || value.validForMs > watchTtlMs) return;
  const expiresAt = startedAt + value.validForMs;
  if (expiresAt <= now) return;
  const listed = value.services;
  return { expiresAt, availability: {
    services: services.filter(service => listed.includes(service)),
    link: validatedWatchLink(value.link, seriesId)
  } };
}

export function watchHint(selected: readonly string[], availability?: WatchAvailability) {
  if (!selected.length) return;
  const matches = services.filter(service => selected.includes(service) && availability?.services.includes(service));
  return { text: matches.length ? 'Listed on ' + matches.join(', ') : 'Availability unknown', matched: matches.length > 0 };
}
