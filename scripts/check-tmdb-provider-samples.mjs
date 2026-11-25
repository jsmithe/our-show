const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('TMDB provider smoke test requires TMDB_READ_ACCESS_TOKEN.');
  process.exit(1);
}

const samples = {
  82728: 'Bluey',
  69926: 'Puffin Rock',
  65047: 'Tumble Leaf',
  57532: 'PAW Patrol',
  40050: 'Daniel Tiger’s Neighborhood',
  107113: 'Only Murders in the Building'
};

async function get(path) {
  const res = await fetch('https://api.themoviedb.org/3/' + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`TMDB returned HTTP ${res.status} for ${path}`);
  return res.json();
}

function region(result) {
  if (!result) return null;
  const offers = {};
  for (const key of ['flatrate', 'rent', 'buy', 'free', 'ads']) {
    if (Array.isArray(result[key])) offers[key] = result[key].map(offer => offer.provider_id);
  }
  const link = typeof result.link === 'string' && /^https:\/\/www\.themoviedb\.org\/tv\/[\w%-]+\/watch\?locale=[A-Z]{2}$/.test(result.link)
    ? result.link : null;
  return { link, ...offers };
}

try {
  const directory = await get('watch/providers/tv?watch_region=US');
  const providers = directory.results.filter(({ provider_name }) =>
    /Netflix|Prime Video|Amazon Video|Disney\+|Hulu|Paramount\+|PBS Kids/i.test(provider_name)
  ).map(({ provider_id, provider_name }) => ({ id: provider_id, name: provider_name }));
  console.log('TMDB_US_DIRECTORY ' + JSON.stringify(providers));
  for (const [id, title] of Object.entries(samples)) {
    const response = await get(`tv/${id}/watch/providers`);
    if (response.id !== Number(id) || !response.results) throw new Error(`Unexpected response for series ${id}`);
    console.log('TMDB_SAMPLE ' + JSON.stringify({ id: Number(id), title, US: region(response.results.US),
      ...(id === '82728' && { GB: region(response.results.GB) }) }));
  }
} catch (error) {
  console.error(error instanceof Error && /^(TMDB returned HTTP |Unexpected response for series )/.test(error.message)
    ? error.message : 'TMDB provider smoke test failed to fetch or parse a response.');
  process.exitCode = 1;
}
