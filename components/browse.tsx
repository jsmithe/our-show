import { useEffect, useRef, useState, type FormEvent } from 'react';
import { findSavedShow, manualShow, starterShows, type Household } from '../lib/household';
import type { Show } from '../lib/tv';
import { BackupControls } from './household-settings';
import { Artwork, Button, Icon } from './shared';

type Search = { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; results: Show[] };

export default function Browse({ state, onAdd, onFinish, onRestore }: {
  state: Household;
  onAdd: (show: Show) => void;
  onFinish: () => void;
  onRestore: (file: File) => Promise<string>;
}) {
  const [query, setQuery] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [search, setSearch] = useState<Search>({ status: 'idle' });
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = query.trim();
    active.current?.abort();
    if (title.length < 2) {
      setSearch({ status: 'error', message: 'Enter at least two characters to search.' });
      return;
    }

    const request = new AbortController();
    active.current = request;
    setSearch({ status: 'loading' });
    setManualTitle(current => current || title);
    try {
      const response = await fetch('/api/tv/search?' + new URLSearchParams({ q: title }), { signal: request.signal });
      const data = await response.json();
      if (request.signal.aborted) return;
      if (!response.ok || !Array.isArray(data.results)) {
        setSearch({ status: 'error', message: typeof data.error === 'string' ? data.error : 'TV search is unavailable. Try again or add a show manually.' });
        return;
      }
      setSearch({ status: 'done', results: data.results });
    } catch {
      if (!request.signal.aborted) {
        setSearch({ status: 'error', message: 'TV search couldn’t connect. Try again or add a show manually.' });
      }
    }
  }

  function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const show = manualShow(manualTitle);
    if (!show) {
      setManualMessage('Enter a show title between 1 and 120 characters.');
      return;
    }
    if (findSavedShow(state, show)) {
      setManualMessage(show.title + ' is already on your shelf.');
      return;
    }
    onAdd(show);
    setManualTitle('');
    setManualMessage(show.title + ' was added to your shelf.');
  }

  const status = search.status === 'loading' ? 'Searching for TV shows…'
    : search.status === 'error' ? search.message
    : search.status === 'done' ? (search.results.length
      ? `${search.results.length} TV ${search.results.length === 1 ? 'result' : 'results'}`
      : 'No TV shows found. Try another title or add it manually.')
    : '';

  function addButton(show: Show) {
    const added = !!findSavedShow(state, show);
    return <Button aria-label={(added ? 'Added ' : 'Add ') + show.title} aria-disabled={added}
      onClick={() => { if (!added) onAdd(show); }}>
      <Icon name={added ? 'check' : 'plus'} />{added ? 'Added' : 'Add'}
    </Button>;
  }

  return <>
    <h1>Add our shows</h1>
    <p className="intro">Pick a familiar show below or search for another favorite.</p>
    <form role="search" className="tv-search" onSubmit={submit}>
      <label className="search">
        <Icon name="search" /><span className="sr-only">Search TV shows</span>
        <input type="search" placeholder="Search TV shows" value={query}
          maxLength={120} enterKeyHint="search" onChange={event => {
            setQuery(event.currentTarget.value);
            setManualTitle(event.currentTarget.value);
          }} />
      </label>
      <Button type="submit" className="primary">Search</Button>
    </form>
    <p className="search-status small" role="status">{status}</p>
    <details className="manual-add">
      <summary>Add a show manually</summary>
      <form onSubmit={addManual}>
        <label className="field">TV show title
          <input value={manualTitle} maxLength={120}
            onChange={event => {
              setManualTitle(event.currentTarget.value);
              setManualMessage('');
            }} />
        </label>
        <Button type="submit">Add to shelf</Button>
        <p className="small" role="status">{manualMessage}</p>
      </form>
    </details>
    {search.status === 'done' && search.results.length > 0 && <ul className="search-results" aria-label="Search results">{search.results.map(show =>
      <li className="search-result" key={show.id}>
        <Artwork show={show} className="result-art" source={show.artwork?.at(-1)} />
        <div className="result-copy">
          <h2>{show.title}</h2>
          <p className="small">{show.firstAirYear ? show.firstAirYear + ' · ' : ''}Availability unknown</p>
          {show.overview && <p className="result-overview">{show.overview}</p>}
          {addButton(show)}
        </div>
      </li>
    )}</ul>}
    <section className="starter-shows" aria-labelledby="starter-heading">
      <h2 id="starter-heading">Familiar favorites</h2>
      <ul className="starter-grid">{starterShows.map(show =>
        <li className="starter-card" key={show.id}>
          <Artwork show={show} className="starter-art" />
          <h3>{show.title}</h3>
          {addButton(show)}
        </li>
      )}</ul>
    </section>
    {state.onboarding !== 'done' && <>
      <BackupControls onImport={onRestore} />
      <div className="catalog-footer">
        <Button className="primary wide" onClick={onFinish}>
          {Object.keys(state.shelf).length ? 'Go to Tonight' : 'Continue with an empty shelf'}
        </Button>
      </div>
    </>}
  </>;
}
