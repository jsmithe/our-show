export type Show = {
  id: string;
  title: string;
  firstAirYear?: string;
  overview?: string;
  artwork?: string[];
  service?: string;
  kind?: 'channel';
};

const imageRoot = 'https://image.tmdb.org/t/p/';
const imageFile = /^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i;

export function tmdbImage(path: unknown, size: 'w342' | 'w780'): string | undefined {
  if (typeof path === 'string' && imageFile.test(path)) return imageRoot + size + path;
}

export function isTmdbImage(url: string): boolean {
  const prefix = ['w342', 'w780'].map(size => imageRoot + size).find(prefix => url.startsWith(prefix));
  return prefix !== undefined && imageFile.test(url.slice(prefix.length));
}

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
