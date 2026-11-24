import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addShow, changeDecision, decodeHousehold, emptyHousehold, forLocalDay, legacyKey, loadHousehold,
  localDay, manualShow, rankedShows, removeShow, removeViewer, shelfShows, storageKey
} from '../lib/household.ts';
import type { Show } from '../lib/tv.ts';

const day = '2026-11-24';
const tomorrow = '2026-11-25';
const show: Show = {
  id: 'tmdb:63639', title: 'The Expanse', firstAirYear: '2015', overview: 'A mystery in space.',
  artwork: ['https://image.tmdb.org/t/p/w780/backdrop.jpg']
};
const alternative: Show = { id: 'tmdb:95396', title: 'Severance', firstAirYear: '2022' };

test('fresh households start empty; adding stores metadata and keeps viewers unknown', () => {
  const fresh = emptyHousehold(day);
  assert.deepEqual(shelfShows(fresh), []);
  const added = addShow(fresh, show);
  assert.deepEqual(added.shelf[show.id], { preferences: {}, progress: {} });
  assert.deepEqual(shelfShows(added), [show]);
  assert.equal(addShow(added, { ...show, title: 'Changed title' }), added);
  assert.deepEqual(decodeHousehold(JSON.stringify(added), day), added);
});

test('manual titles survive storage and deduplicate without conflating distinct TMDB IDs', () => {
  assert.equal(manualShow('   '), null);
  assert.equal(manualShow('x'.repeat(121)), null);
  const manual = manualShow('  The   Backyard Show  ')!;
  assert.equal(manual.title, 'The Backyard Show');
  const saved = addShow(addShow(emptyHousehold(day), show), manual);
  assert.equal(addShow(saved, manualShow('THE EXPANSE')!), saved);
  assert.equal(addShow(saved, { id: 'tmdb:7', title: 'the backyard show' }), saved);
  const anotherEdition = addShow(saved, { id: 'tmdb:42', title: show.title, firstAirYear: show.firstAirYear });
  assert.equal(shelfShows(anotherEdition).length, 3);
  assert.deepEqual(decodeHousehold(JSON.stringify(saved), day), saved);
});

test('valid POC data is copied with identities, service choices, preferences, and channels', () => {
  const { titles, ...base } = emptyHousehold(day);
  const old = {
    ...base, onboarding: 'done', services: ['YouTube', 'Netflix'],
    viewers: [{ id: 10, name: 'Sam' }, { id: 31, name: 'Alex' }], nextViewer: 32, watching: [31],
    shelf: {
      'mock-1': { preferences: { 10: 'dislike', 31: 'love' }, progress: { 31: 'finished' } },
      'sample-scishow': { preferences: {}, progress: {} }
    },
    tonight: { day, passed: ['sample-scishow'], pick: 'mock-1' }
  };
  const raw = JSON.stringify(old);
  const backing = new Map([[legacyKey, raw]]);
  const storage = { getItem: (key: string) => backing.get(key) ?? null };
  const loaded = loadHousehold(storage, day);
  assert.equal(loaded.unreadable, false);
  assert.deepEqual(loaded.state, { ...old, titles: {} });
  assert.equal(backing.get(legacyKey), raw);
  assert.equal(shelfShows(loaded.state).find(item => item.id === 'sample-scishow')?.kind, 'channel');
  backing.set(storageKey, JSON.stringify({ ...loaded.state, services: ['Disney+'] }));
  assert.deepEqual(loadHousehold(storage, day).state.services, ['Disney+']);
  assert.equal(backing.get(legacyKey), raw);
});

test('unreadable current records are flagged; invalid backups cannot inject artwork URLs', () => {
  const storage = { getItem: (key: string) => key === storageKey ? '{broken' : null };
  assert.equal(loadHousehold(storage, day).unreadable, true);
  const bad = addShow(emptyHousehold(day), { ...show, artwork: ['https://example.org/img.jpg'] });
  assert.equal(decodeHousehold(JSON.stringify(bad), day), null);
  assert.equal(decodeHousehold(JSON.stringify({ legacy: [] }), day), null);
});

test('ranking favors shared fit, uses the participating viewers, and keeps finished shows eligible', () => {
  let state = addShow(addShow(emptyHousehold(day), show), alternative);
  state.shelf[show.id] = { preferences: { 1: 'love', 2: 'dislike' }, progress: {} };
  state.shelf[alternative.id] = { preferences: { 1: 'okay', 2: 'okay' }, progress: { 1: 'finished', 2: 'finished' } };
  assert.equal(rankedShows(state)[0].show.id, alternative.id);
  assert.equal(rankedShows({ ...state, watching: [1] })[0].show.id, show.id);
  state = addShow(state, manualShow('Unrated Show')!);
  assert.equal(rankedShows(state).at(-1)?.show.id, show.id);
});

test('passes, undo, pick, and reopen survive reload and reset at the next local day', () => {
  const original = addShow(addShow(emptyHousehold(day), show), alternative);
  original.shelf[show.id] = { preferences: { 1: 'love' }, progress: { 2: 'started' } };
  let state = changeDecision(original, { action: 'pass', id: show.id }, day);
  assert.equal(rankedShows(state)[0].show.id, alternative.id);
  state = decodeHousehold(JSON.stringify(state), day)!;
  assert.deepEqual(state.tonight.passed, [show.id]);
  state = changeDecision(state, { action: 'undo' }, day);
  assert.equal(rankedShows(state)[0].show.id, show.id);
  state = changeDecision(state, { action: 'pass', id: alternative.id }, day);
  state = changeDecision(state, { action: 'confirm', id: show.id }, day);
  state = decodeHousehold(JSON.stringify(state), day)!;
  assert.equal(state.tonight.pick, show.id);
  state = changeDecision(state, { action: 'reopen' }, day);
  assert.deepEqual(state.tonight, { day, passed: [alternative.id], pick: null });
  assert.deepEqual(state.shelf, original.shelf);
  assert.deepEqual(forLocalDay(state, tomorrow).tonight, { day: tomorrow, passed: [], pick: null });
  assert.deepEqual(decodeHousehold(JSON.stringify(state), tomorrow)?.shelf, original.shelf);
  assert.deepEqual(changeDecision(state, { action: 'pass', id: show.id }, tomorrow).tonight,
    { day: tomorrow, passed: [], pick: null });
  assert.equal(localDay(new Date(2026, 10, 25, 0, 0)), tomorrow);
});

test('removing a show or viewer clears its associated decision or viewer records', () => {
  const state = addShow(emptyHousehold(day), show);
  state.shelf[show.id] = { preferences: { 1: 'love', 2: 'dislike' }, progress: { 2: 'started' } };
  state.watching = [2];
  const reduced = removeViewer(state, 2);
  assert.deepEqual(reduced.watching, [1]);
  assert.deepEqual(reduced.shelf[show.id], { preferences: { 1: 'love' }, progress: {} });
  const picked = changeDecision(reduced, { action: 'confirm', id: show.id }, day);
  const removed = removeShow(picked, show.id);
  assert.equal(removed.tonight.pick, null);
  assert.deepEqual(removed.titles, {});
  assert.deepEqual(removed.shelf, {});
});
