import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWatchProvidersHandler } from '../lib/tmdb-watch-providers.ts';
import { readWatchResponse, validatedWatchLink, watchHint, watchSeriesId, watchTtlMs } from '../lib/watch-availability.ts';

const secret = 'test-only-credential';
const request = (id: number | string, init?: RequestInit) =>
  new Request('https://our-show.example/api/tv/watch-providers?id=' + id, init);
const watchLink = 'https://www.themoviedb.org/tv/82728-bluey/watch?locale=US';
const offers = (...ids: number[]) => ids.map(provider_id => ({ provider_id }));

test('the watch route uses the fixed TV endpoint, U.S. flatrate and verified direct tiers', async () => {
  const handler = createWatchProvidersHandler({
    token: () => secret,
    now: () => 100,
    fetcher: async (url, options) => {
      assert.equal(String(url), 'https://api.themoviedb.org/3/tv/82728/watch/providers');
      assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer ' + secret);
      assert.equal(options?.cache, 'no-store');
      assert.equal(options?.redirect, 'error');
      assert(options?.signal);
      return Response.json({ id: 82728, results: {
        GB: { flatrate: offers(337, 38), link: watchLink.replace('US', 'GB') },
        US: { flatrate: offers(1796, 8, 2100, 9, 15, 2303, 2616, 531, 582, 1853, 293, 613, 10, 175),
          buy: offers(337), link: watchLink, private_field: secret }
      } });
    }
  });
  const response = await handler(request('82728&region=GB'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.status, 200);
  const body = await response.text();
  assert(!body.includes(secret));
  assert.deepEqual(JSON.parse(body), { services: ['Netflix', 'Prime Video', 'Hulu', 'Paramount+'], link: watchLink, validForMs: watchTtlMs });
});

test('non-subscription categories, add-ons, unsupported tiers and a GB-only result yield no match', async () => {
  for (const US of [undefined, { flatrate: offers(10, 582, 293, 1853, 633, 613, 175, 531),
    buy: offers(9, 8), rent: offers(15), free: offers(9), ads: offers(2100, 337) }]) {
    const handler = createWatchProvidersHandler({ token: () => secret, now: () => 100, fetcher: async () => Response.json({
      id: 82728, results: { US, GB: { link: watchLink.replace('US', 'GB'), flatrate: offers(337, 38) } }
    }) });
    assert.deepEqual(await (await handler(request(82728))).json(), { services: [], link: null, validForMs: watchTtlMs });
  }
});

test('Bluey matches Disney+ and the disputed Disney+ Hulu-control listing remains unknown', async () => {
  const handler = createWatchProvidersHandler({ token: () => secret, fetcher: async url => {
    const id = String(url).includes('/82728/') ? 82728 : 107113;
    return Response.json({ id, results: { US: { flatrate: id === 82728 ? offers(337) : offers(337, 15) } } });
  } });
  assert.deepEqual((await (await handler(request(82728))).json()).services, ['Disney+']);
  assert.deepEqual((await (await handler(request(107113))).json()).services, ['Hulu']);
});

test('invalid IDs, duplicate IDs, cross-site requests and missing credentials never fetch', async () => {
  const handler = createWatchProvidersHandler({ token: () => undefined, fetcher: async () => assert.fail('unexpected fetch') });
  for (const id of ['', '0', '01', '-1', '1.5', '1e3', '9007199254740992', '82728%0A', '1&id=2', '%2f..']) {
    assert.equal((await handler(request(id))).status, 400, id);
  }
  assert.equal((await handler(request(82728, { headers: { 'sec-fetch-site': 'cross-site' } }))).status, 403);
  assert.equal((await handler(request(82728))).status, 503);
});

test('timeouts, HTTP errors, malformed responses and mismatched IDs are safe', async () => {
  const cases: Array<[typeof fetch, number]> = [
    [async () => new Response(secret, { status: 429, headers: { 'retry-after': '8' } }), 429],
    [async () => new Response(secret, { status: 401 }), 502],
    [async () => Response.json({ id: 111, results: { US: { flatrate: offers(337) } } }), 502],
    [async () => Response.json({ id: 82728, results: { US: [] } }), 502],
    [async () => Response.json({ id: 82728, results: { US: { flatrate: [...offers(337), { provider_id: '8' }] } } }), 502],
    [async () => Response.json({ id: 82728, results: { US: { flatrate: null } } }), 502],
    [async () => new Response('invalid JSON'), 503],
    [async () => { throw new DOMException(secret, 'TimeoutError'); }, 503]
  ];
  for (const [fetcher, status] of cases) {
    const response = await createWatchProvidersHandler({ token: () => secret, fetcher })(request(82728));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: 'Availability unknown.' });
    if (status === 429) assert.equal(response.headers.get('retry-after'), '8');
  }
});

test('fresh lookups coalesce by ID, cache only current data and discard expired positives on refresh failure', async () => {
  let now = 100;
  let calls = 0;
  let fail = false;
  const handler = createWatchProvidersHandler({ token: () => secret, now: () => now, fetcher: async url => {
    calls++;
    const id = String(url).includes('/82728/') ? 82728 : 69926;
    return fail ? new Response(null, { status: 503 }) : Response.json({ id, results: { US: { flatrate: offers(337) } } });
  } });
  const first = await Promise.all([handler(request(82728)), handler(request(82728))]);
  assert.equal(calls, 1);
  assert.deepEqual(await first[0].json(), await first[1].json());
  await handler(request(69926));
  assert.equal(calls, 2);
  now += watchTtlMs - 1;
  assert.equal((await (await handler(request(82728))).json()).validForMs, 1);
  assert.equal(calls, 2);
  now++;
  fail = true;
  assert.deepEqual(await (await handler(request(82728))).json(), { error: 'Availability unknown.' });
  assert.equal(calls, 3);
  fail = false;
  assert.equal((await (await handler(request(82728))).json()).validForMs, watchTtlMs);
  assert.equal(calls, 4);
});

test('only HTTPS TMDB Watch links for the exact series and explicit U.S. locale are returned', () => {
  assert.equal(validatedWatchLink(watchLink, 82728), watchLink);
  for (const value of ['http://www.themoviedb.org/tv/82728/watch?locale=US',
    watchLink.replace('www.themoviedb.org', 'www.themoviedb.org.evil.example'),
    watchLink.replace('www.themoviedb.org', 'user:pw@www.themoviedb.org'),
    watchLink.replace('www.themoviedb.org', 'www.themoviedb.org:1234'),
    watchLink.replace('US', 'GB'), watchLink.split('?')[0], watchLink + '&locale=GB', watchLink + '#away',
    watchLink.replace('82728', '182728'), watchLink.replace('82728-bluey', '82728-bluey%2F..%2F182728'),
    watchLink.replace('/watch', '/videos'), 'javascript:alert(1)']) {
    assert.equal(validatedWatchLink(value, 82728), null, value);
  }
});

test('Tonight matches local selections, ignores expired or delayed responses and keeps unlinked titles unknown', () => {
  assert.equal(watchSeriesId({ id: 'mock-1', title: 'Bluey' }), 82728);
  assert.equal(watchSeriesId({ id: 'mock-11', title: 'Puffin Rock' }), 69926);
  assert.equal(watchSeriesId({ id: 'tmdb:82728', title: 'Bluey' }), 82728);
  assert.equal(watchSeriesId({ id: 'mock-12', title: 'Hilda' }), undefined);
  assert.equal(watchSeriesId({ id: 'manual:example', title: 'Bluey' }), undefined);
  assert.equal(watchSeriesId({ id: 'sample-scishow', title: 'SciShow Kids', kind: 'channel' }), undefined);

  const response = { services: ['Disney+', 'Hulu', 'Hulu', 'YouTube'], link: watchLink, validForMs: 10 };
  const current = readWatchResponse(response, 82728, 5, 14);
  assert.equal(current?.expiresAt, 15);
  assert.deepEqual(watchHint(['Hulu', 'Hulu', 'YouTube'], current?.availability),
    { text: 'Listed on Hulu', matched: true, additional: [] });
  assert.equal(watchHint([], current?.availability), undefined);
  assert.equal(watchHint(['Netflix'], current?.availability)?.text, 'Availability unknown');
  assert.equal(readWatchResponse(response, 82728, 5, 15), undefined);
  assert.equal(readWatchResponse({ ...response, validForMs: watchTtlMs + 1 }, 82728, 5, 6), undefined);
  assert.equal(watchHint(['Disney+'])?.text, 'Availability unknown');
});

test('a compact multi-service hint retains every additional match for disclosure', () => {
  assert.deepEqual(watchHint(['Netflix', 'Hulu', 'Disney+', 'Prime Video'],
    { services: ['Prime Video', 'Netflix', 'Hulu'], link: null }), {
    text: 'Listed on Prime Video +2 more', matched: true, additional: ['Netflix', 'Hulu']
  });
});
