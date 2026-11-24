import catalog from './sample-catalog.json' with { type: 'json' };
import { isTmdbImage, record, type Show } from './tv.ts';

export const legacyKey = 'our-show-v1';
export const storageKey = 'our-show-v2';
export const services = ['Prime Video', 'Netflix', 'Paramount+', 'Disney+'];
export const preferences = { unknown: 'Unknown', love: 'Love it', okay: 'It’s okay', dislike: 'No thanks' };
export const watchStates = { unknown: 'Unknown', started: 'Started', finished: 'Finished' };

export type Preference = keyof typeof preferences;
export type Progress = keyof typeof watchStates;
export type Viewer = { id: number; name: string };
export type ShelfEntry = {
  preferences: Record<number, Preference>;
  progress: Record<number, Progress>;
};
export type Household = {
  onboarding: 'browse' | 'done';
  services: string[];
  viewers: Viewer[];
  nextViewer: number;
  watching: number[];
  shelf: Record<string, ShelfEntry>;
  titles: Record<string, Show>;
  tonight: { day: string; passed: string[]; pick: string | null };
};

const sampleShows: Show[] = catalog.map(({ kind, artwork, ...show }) => ({
  ...show,
  kind: kind === 'channel' ? 'channel' : undefined,
  artwork: artwork?.map(path => path.replace(/^\./, ''))
}));
const sampleById = new Map(sampleShows.map(show => [show.id, show]));
export const starterShows = ['mock-1', 'mock-11', 'mock-12', 'mock-3']
  .map(id => sampleById.get(id)!);
const titleId = /^(?:mock-\d+|sample-[a-z0-9-]+|tmdb:[1-9]\d*|manual:[a-f0-9]{32})$/;

export function localDay(now = new Date()): string {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join('-');
}

export function emptyHousehold(day = localDay()): Household {
  return {
    onboarding: 'browse',
    services: [],
    viewers: [{ id: 1, name: 'Viewer 1' }, { id: 2, name: 'Viewer 2' }],
    nextViewer: 3,
    watching: [1, 2],
    shelf: {},
    titles: {},
    tonight: { day, passed: [], pick: null }
  };
}

export function forLocalDay(state: Household, day = localDay()): Household {
  if (state.tonight.day === day) return state;
  return { ...state, tonight: { day, passed: [], pick: null } };
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function viewer(value: unknown): value is Viewer {
  return record(value) && typeof value.id === 'number' && Number.isSafeInteger(value.id)
    && value.id > 0 && typeof value.name === 'string' && !!value.name.trim();
}

function entry(value: unknown): value is ShelfEntry {
  return record(value) && record(value.preferences) && record(value.progress)
    && Object.values(value.preferences).every(item => typeof item === 'string' && Object.hasOwn(preferences, item))
    && Object.values(value.progress).every(item => typeof item === 'string' && Object.hasOwn(watchStates, item));
}

function storedTitle(id: string, value: unknown): boolean {
  return (id.startsWith('tmdb:') || id.startsWith('manual:')) && titleId.test(id)
    && record(value) && value.id === id
    && typeof value.title === 'string' && !!value.title.trim() && value.title.length <= 200
    && (value.firstAirYear === undefined || (typeof value.firstAirYear === 'string' && /^\d{4}$/.test(value.firstAirYear)))
    && (value.overview === undefined || (typeof value.overview === 'string' && value.overview.length <= 2000))
    && (value.artwork === undefined || (strings(value.artwork) && value.artwork.length <= 2 && value.artwork.every(isTmdbImage)))
    && value.service === undefined && value.kind === undefined;
}

/** Read the deployed POC's record or the current format without mutating either. */
export function decodeHousehold(raw: string, day = localDay()): Household | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!record(parsed) || typeof parsed.onboarding !== 'string' || !['services', 'browse', 'done'].includes(parsed.onboarding)
      || !strings(parsed.services) || !Array.isArray(parsed.viewers) || !parsed.viewers.length
      || !parsed.viewers.every(viewer) || !Number.isSafeInteger(parsed.nextViewer)
      || !Array.isArray(parsed.watching) || !parsed.watching.length || !record(parsed.shelf)
      || !Object.entries(parsed.shelf).every(([id, value]) => titleId.test(id) && entry(value))
      || !record(parsed.tonight) || typeof parsed.tonight.day !== 'string'
      || !strings(parsed.tonight.passed) || !parsed.tonight.passed.every(id => Object.hasOwn(parsed.shelf as object, id))
      || (parsed.tonight.pick !== null && (typeof parsed.tonight.pick !== 'string' || !Object.hasOwn(parsed.shelf, parsed.tonight.pick)))) {
      return null;
    }

    const viewers = parsed.viewers as Viewer[];
    const viewerIds = new Set(viewers.map(item => item.id));
    if (viewers.length !== viewerIds.size || !viewers.every(item => item.id < Number(parsed.nextViewer))
      || !parsed.watching.every(id => viewerIds.has(id)) || new Set(parsed.watching).size !== parsed.watching.length) {
      return null;
    }

    const titles = parsed.titles === undefined ? {} : parsed.titles;
    if (!record(titles) || !Object.entries(titles).every(([id, value]) => storedTitle(id, value))
      || !Object.keys(parsed.shelf).every(id => sampleById.has(id) || Object.hasOwn(titles, id))) return null;
    const onboarding = parsed.onboarding === 'done' ? 'done' : 'browse';
    return forLocalDay({ ...parsed, onboarding, titles } as Household, day);
  } catch {
    return null;
  }
}

export function loadHousehold(storage: Pick<Storage, 'getItem'>, day = localDay()) {
  const current = storage.getItem(storageKey);
  const raw = current ?? storage.getItem(legacyKey);
  if (raw === null) return { state: emptyHousehold(day), unreadable: false };
  const state = decodeHousehold(raw, day);
  return { state: state ?? emptyHousehold(day), unreadable: !state };
}

export function showById(state: Household, id: string | null | undefined): Show | undefined {
  if (!id) return undefined;
  return sampleById.get(id) ?? state.titles[id];
}

export function shelfShows(state: Household): Show[] {
  return [...sampleShows, ...Object.values(state.titles)].filter(show => Object.hasOwn(state.shelf, show.id));
}

function normalizedTitle(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function findSavedShow(state: Household, show: Show): Show | undefined {
  if (Object.hasOwn(state.shelf, show.id)) return showById(state, show.id);
  if (show.kind === 'channel') return undefined;

  // External IDs distinguish remakes. For entries without one, compare the title and known year.
  return shelfShows(state).find(saved =>
    saved.kind !== 'channel' && !(show.id.startsWith('tmdb:') && saved.id.startsWith('tmdb:'))
    && normalizedTitle(saved.title) === normalizedTitle(show.title)
    && (!saved.firstAirYear || !show.firstAirYear || saved.firstAirYear === show.firstAirYear)
  );
}

export function addShow(state: Household, show: Show): Household {
  if (findSavedShow(state, show)) return state;
  return {
    ...state,
    titles: sampleById.has(show.id) ? state.titles : { ...state.titles, [show.id]: show },
    shelf: { ...state.shelf, [show.id]: { preferences: {}, progress: {} } }
  };
}

export function manualShow(title: string): Show | null {
  const cleaned = title.trim().replace(/\s+/gu, ' ');
  if (!cleaned || cleaned.length > 120) return null;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { id: 'manual:' + id, title: cleaned };
}

export function removeShow(state: Household, id: string): Household {
  const { [id]: removedEntry, ...shelf } = state.shelf;
  const { [id]: removedTitle, ...titles } = state.titles;
  return {
    ...state, titles, shelf,
    tonight: {
      ...state.tonight,
      pick: state.tonight.pick === id ? null : state.tonight.pick,
      passed: state.tonight.passed.filter(passed => passed !== id)
    }
  };
}

export function removeViewer(state: Household, id: number): Household {
  if (state.viewers.length <= 1) return state;
  const viewers = state.viewers.filter(viewer => viewer.id !== id);
  const watching = state.watching.filter(viewer => viewer !== id);
  const shelf = Object.fromEntries(Object.entries(state.shelf).map(([key, saved]) => {
    const { [id]: removedPreference, ...preferences } = saved.preferences;
    const { [id]: removedProgress, ...progress } = saved.progress;
    return [key, { preferences, progress }];
  }));
  return { ...state, viewers, shelf, watching: watching.length ? watching : [viewers[0].id] };
}

function fit(state: Household, show: Show) {
  const values = state.watching.map(id => state.shelf[show.id].preferences[id] ?? 'unknown');
  return {
    show,
    dislikes: values.filter(value => value === 'dislike').length,
    unknowns: values.filter(value => value === 'unknown').length,
    loves: values.filter(value => value === 'love').length
  };
}

export function rankedShows(state: Household) {
  const matchesService = (show: Show) => !!show.service && state.services.includes(show.service);
  return shelfShows(state).filter(show => !state.tonight.passed.includes(show.id))
    .map(show => fit(state, show))
    .sort((a, b) => a.dislikes - b.dislikes || a.unknowns - b.unknowns || b.loves - a.loves
      || Number(matchesService(b.show)) - Number(matchesService(a.show)));
}

export function fitMessage(state: Household, { show, dislikes, unknowns, loves }: ReturnType<typeof fit>) {
  const count = state.watching.length;
  if (dislikes === count) return count === 1 ? 'This viewer usually passes.' : 'Everyone watching usually passes.';
  if (dislikes) return count === 2 && loves === 1
    ? 'One loves it. One usually passes.'
    : `${dislikes} of ${count} viewers usually pass.`;
  if (unknowns) return unknowns === count ? 'A familiar pick. Preferences are still open.'
    : `${unknowns} of ${count} preferences still unknown.`;
  if (loves === count) return count === 1 ? 'A favorite for this viewer.' : 'Everyone watching loves it.';
  if (state.watching.every(id => state.shelf[show.id].progress[id] === 'finished')) return count === 1
    ? 'A familiar rewatch.' : 'A familiar rewatch everyone is okay with.';
  return count === 1 ? 'This viewer is okay with it.' : 'Everyone watching is okay with this pick.';
}

type Decision = { action: 'pass' | 'confirm'; id: string } | { action: 'undo' | 'reopen' };

export function changeDecision(state: Household, decision: Decision, day = localDay()): Household {
  const current = forLocalDay(state, day);
  if (current !== state) return current; // The visible options belonged to yesterday.
  const { tonight } = state;
  if (decision.action === 'reopen') return { ...state, tonight: { ...tonight, pick: null } };
  if (tonight.pick) return state;
  if (decision.action === 'undo') {
    return { ...state, tonight: { ...tonight, passed: tonight.passed.slice(0, -1) } };
  }
  if (!('id' in decision) || !Object.hasOwn(state.shelf, decision.id) || tonight.passed.includes(decision.id)) return state;
  return {
    ...state,
    tonight: decision.action === 'pass'
      ? { ...tonight, passed: [...tonight.passed, decision.id] }
      : { ...tonight, pick: decision.id }
  };
}
