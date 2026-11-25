import { createSearchHandler, tmdbClientKey } from '../../../../lib/tmdb';

export const runtime = 'nodejs';

export const GET = createSearchHandler({
  token: () => process.env.TMDB_READ_ACCESS_TOKEN,
  clientKey: tmdbClientKey
});
