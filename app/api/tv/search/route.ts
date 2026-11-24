import { createSearchHandler } from '../../../../lib/tmdb';

export const runtime = 'nodejs';

export const GET = createSearchHandler({
  token: () => process.env.TMDB_READ_ACCESS_TOKEN,
  // Vercel overwrites this header at its edge. Off Vercel all callers share a local limit.
  clientKey: request => process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) || 'unknown'
    : 'local'
});
