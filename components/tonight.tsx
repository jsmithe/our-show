import { useEffect, useRef, useState } from 'react';
import { fitMessage, rankedShows, showById, type Household } from '../lib/household';
import type { Show } from '../lib/tv';
import { readWatchResponse, watchHint, watchSeriesId, type CurrentWatchAvailability } from '../lib/watch-availability';
import { Artwork, Button, CheckChoice, Icon } from './shared';

function useWatchAvailability(seriesId: number | undefined) {
  const [result, setResult] = useState<CurrentWatchAvailability>();

  useEffect(() => {
    if (seriesId === undefined) return;
    let active: AbortController | undefined;
    let timer: number | undefined;
    let expiresAt = 0;

    async function refresh(id: number) {
      const startedAt = Date.now();
      if (active || expiresAt > startedAt) return;
      window.clearTimeout(timer);
      if (expiresAt) setResult(undefined);
      const controller = new AbortController();
      active = controller;
      const deadline = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch('/api/tv/watch-providers?id=' + id, { signal: controller.signal });
        if (!response.ok) return;
        const current = readWatchResponse(await response.json(), id, startedAt, Date.now());
        if (!current || controller.signal.aborted) return;
        expiresAt = current.expiresAt;
        setResult(current);
        timer = window.setTimeout(() => void refresh(id), Math.max(0, expiresAt - Date.now()));
      } catch {
        // Provider failures leave the decision available with an unknown hint.
      } finally {
        window.clearTimeout(deadline);
        active = undefined;
      }
    }

    const resume = () => {
      if (document.visibilityState === 'visible') void refresh(seriesId);
    };
    void refresh(seriesId);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active?.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [seriesId]);

  return result && result.expiresAt > Date.now() ? result.availability : undefined;
}

function Gallery({ show }: { show: Show }) {
  const slides = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const images = show.artwork ?? [];
  if (images.length < 2) return <Artwork show={show} className="hero-art" />;

  const label = (index: number) => `Image ${index + 1} of ${images.length}`;
  return <div role="region" aria-label={show.title + ' artwork'}>
    <div className="slides" ref={slides} onScroll={event => {
      const strip = event.currentTarget;
      const index = Math.round(strip.scrollLeft / strip.clientWidth);
      setActive(Math.min(images.length - 1, Math.max(0, index)));
    }}>
      {images.map(source => <Artwork key={source} show={show} className="hero-art" source={source} />)}
    </div>
    <div className="dots">{images.map((source, index) =>
      <button key={source} type="button" className="dot" aria-label={label(index)} aria-current={index === active}
        onClick={() => {
          const strip = slides.current!;
          strip.scrollTo({
            left: index * strip.clientWidth,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
          });
        }} />
    )}</div>
    <p className="sr-only image-position" role="status">{label(active)}</p>
  </div>;
}

type TonightProps = {
  state: Household;
  onBrowse: () => void;
  onPass: (show: Show) => void;
  onPick: (show: Show) => void;
  onUndo: (show: Show) => void;
  onReopen: () => void;
  onWatching: (id: number, checked: boolean) => void;
};

function TonightDecision({ show, summary, confirmed, selected, seriesId, onPick, onPass, onReopen }:
  Pick<TonightProps, 'onPick' | 'onPass' | 'onReopen'> & {
    show: Show; summary: string; confirmed: boolean; selected: string[]; seriesId?: number;
  }) {
  const availability = useWatchAvailability(seriesId);
  const hint = watchHint(selected, availability);
  const watchLink = confirmed && availability?.link;

  return <>
    <div className="hero-copy">
      <p>{summary}</p>
      <div className="small tonight-meta">
        {show.kind === 'channel' ? 'Saved channel' : show.firstAirYear}
        {hint && <span aria-live="polite">{hint.text}</span>}
      </div>
    </div>
    <div className="actions">{confirmed ? <Button onClick={onReopen}>Reopen decision</Button> : <>
      <Button className="primary" onClick={() => onPick(show)}>Let’s watch</Button>
      <Button onClick={() => onPass(show)}>Not tonight</Button>
    </>}</div>
    {(watchLink || hint?.matched) && <div className="small watch-credit">
      {watchLink && <a className="watch-link" href={watchLink}>Check where to watch</a>}
      <span>Availability data from <a href="https://www.justwatch.com/us">JustWatch</a></span>
      {!!hint?.additional.length && <details>
        <summary>More listed services</summary>
        <p>{hint.additional.join(', ')}</p>
      </details>}
    </div>}
  </>;
}

export default function Tonight({ state, onBrowse, onPass, onPick, onUndo, onReopen, onWatching }: TonightProps) {
  const lastPass = showById(state, state.tonight.passed.at(-1));
  const pick = showById(state, state.tonight.pick);
  const suggestion = rankedShows(state)[0];
  const show = pick ?? suggestion?.show;
  const watching = state.viewers.filter(viewer => state.watching.includes(viewer.id));
  const seriesId = show && (state.services.length > 0 || pick) ? watchSeriesId(show) : undefined;

  return <>
    <h1>Tonight</h1>
    {show ? <article className="hero">
      <Gallery key={show.id} show={show} />
      <h2>{show.title}</h2>
      {/* Keep the watch result and its expiry timer on the same decision card. */}
      <TonightDecision key={show.id + ':' + (seriesId ?? '')} show={show} seriesId={seriesId}
        summary={pick ? 'You picked this for tonight.' : fitMessage(state, suggestion)}
        confirmed={!!pick} selected={state.services} onPick={onPick} onPass={onPass} onReopen={onReopen} />
    </article> : lastPass
      ? <div className="empty"><h2>You’ve seen all tonight’s options</h2><p>Undo a pass to give a show another look.</p></div>
      : <div className="empty">
        <h2>What should we watch?</h2>
        <p>Add a few familiar shows and we’ll help you pick one.</p>
        <Button className="primary" onClick={onBrowse}>Add our shows</Button>
      </div>}
    {!pick && lastPass && <div className="callout">
      <Icon name="check-white" /><strong>Passed on {lastPass.title}</strong>
      <button className="text-button" type="button" onClick={() => onUndo(lastPass)}>Undo</button>
    </div>}
    <details className="watching">
      <summary>Watching: {watching.map(viewer => viewer.name).join(', ')}</summary>
      <fieldset className="choices">
        <legend className="sr-only">Who’s watching tonight?</legend>
        {state.viewers.map(viewer => <CheckChoice key={viewer.id}
          checked={state.watching.includes(viewer.id)}
          disabled={watching.length === 1 && watching[0].id === viewer.id}
          onChange={event => onWatching(viewer.id, event.currentTarget.checked)}>
          {viewer.name}
        </CheckChoice>)}
      </fieldset>
    </details>
  </>;
}
