import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSearchHandler } from '../lib/tmdb.ts';

const fakeCredential = 'test-only-credential';
const request = (q: string, init?: RequestInit) =>
  new Request('https://our-show.example/api/tv/search?' + new URLSearchParams({ q }), init);

test('search uses the TV endpoint and returns only normalized public metadata', async () => {
  const search = createSearchHandler({
    token: () => fakeCredential,
    fetcher: async (url, options) => {
      assert.equal(String(url), 'https://api.themoviedb.org/3/search/tv?query=the+expanse&include_adult=false&language=en-US&page=1');
      assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer ' + fakeCredential);
      assert.equal(options?.next?.revalidate, 900);
      assert(options?.signal);
      return Response.json({ results: [
        { id: 63639, name: 'The Expanse', first_air_date: '2015-12-14', overview: 'A mystery in space.',
          poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg', private_field: fakeCredential },
        { id: 63639, name: 'The Expanse', first_air_date: '2015-12-14', overview: 'A mystery in space.',
          poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg' },
        { id: 123, name: 'Unrecognized artwork', poster_path: 'https://example.org/poster.jpg' },
        { id: 8, name: 'Filtered', adult: true },
        { id: 'invalid', name: null }
      ] });
    }
  });
  const res = await search(request(' The   Expanse '));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const json = await res.text();
  assert(!json.includes(fakeCredential));
  assert.deepEqual(JSON.parse(json), { results: [
    { id: 'tmdb:63639', title: 'The Expanse', firstAirYear: '2015', overview: 'A mystery in space.',
      artwork: ['https://image.tmdb.org/t/p/w780/backdrop.jpg', 'https://image.tmdb.org/t/p/w342/poster.jpg'] },
    { id: 'tmdb:123', title: 'Unrecognized artwork' }
  ] });
});

test('invalid and cross-site requests are rejected before any upstream call', async () => {
  const search = createSearchHandler({ token: () => fakeCredential, fetcher: async () => assert.fail('unexpected fetch') });
  for (const input of [' ', 'a', 'a'.repeat(121), 'a\nb']) {
    assert.equal((await search(request(input))).status, 400);
  }
  assert.equal((await search(request('Series', { headers: { 'sec-fetch-site': 'cross-site' } }))).status, 403);
});

test('missing credentials, rate limits, upstream errors, and network failures are safe', async () => {
  const cases: Array<[string | undefined, typeof fetch, number]> = [
    [undefined, async () => assert.fail('TMDB called without credentials'), 503],
    [fakeCredential, async () => new Response(fakeCredential, { status: 401 }), 502],
    [fakeCredential, async () => new Response(fakeCredential, { status: 429, headers: { 'retry-after': '8' } }), 429],
    [fakeCredential, async () => Response.json({ malformed: true }), 502],
    [fakeCredential, async () => new Response('invalid JSON'), 503],
    [fakeCredential, async () => { throw new Error(fakeCredential); }, 503]
  ];
  for (const [token, fetcher, status] of cases) {
    const res = await createSearchHandler({ token: () => token, fetcher })(request('Series'));
    assert.equal(res.status, status);
    if (status === 429) assert.equal(res.headers.get('retry-after'), '8');
    const body = await res.json();
    assert.equal(typeof body.error, 'string');
    assert(!body.error.includes(fakeCredential));
  }
});

test('rate limiting is bounded per client and per instance and resets after a minute', async () => {
  let now = 10;
  let calls = 0;
  const search = createSearchHandler({
    token: () => fakeCredential,
    now: () => now,
    clientKey: req => req.headers.get('x-test-client') ?? 'first',
    fetcher: async () => {
      calls++;
      return Response.json({ results: [] });
    }
  });
  for (let i = 0; i < 20; i++) assert.equal((await search(request('Series'))).status, 200);
  assert.equal((await search(request('Series'))).status, 429);
  for (let i = 0; i < 160; i++) {
    assert.equal((await search(request('Series', { headers: { 'x-test-client': String(i) } }))).status, 200);
  }
  assert.equal((await search(request('Series', { headers: { 'x-test-client': 'new' } }))).status, 429);
  assert.equal(calls, 180);
  now += 60_000;
  assert.deepEqual(await (await search(request('Series'))).json(), { results: [] });
});
