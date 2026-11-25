import { tmdbClientKey } from '../../../../lib/tmdb';
import { createWatchProvidersHandler } from '../../../../lib/tmdb-watch-providers';

export const runtime = 'nodejs';

export const GET = createWatchProvidersHandler({
  token: () => process.env.TMDB_READ_ACCESS_TOKEN,
  clientKey: tmdbClientKey
});
