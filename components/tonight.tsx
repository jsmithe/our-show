import { useRef, useState } from 'react';
import { fitMessage, rankedShows, showById, type Household } from '../lib/household';
import type { Show } from '../lib/tv';
import { Artwork, Button, CheckChoice, Icon, ShowMeta } from './shared';

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

export default function Tonight({ state, onBrowse, onPass, onPick, onUndo, onReopen, onWatching }: TonightProps) {
  const lastPass = showById(state, state.tonight.passed.at(-1));
  const pick = showById(state, state.tonight.pick);
  const suggestion = rankedShows(state)[0];
  const show = pick ?? suggestion?.show;
  const watching = state.viewers.filter(viewer => state.watching.includes(viewer.id));

  return <>
    <h1>Tonight</h1>
    {show ? <article className="hero">
      <Gallery key={show.id} show={show} />
      <h2>{show.title}</h2>
      <div className="hero-copy">
        <p>{pick ? 'You picked this for tonight.' : fitMessage(state, suggestion)}</p>
        <p className="small"><ShowMeta show={show} /></p>
      </div>
      <div className="actions">{pick ? <Button onClick={onReopen}>Reopen decision</Button> : <>
        <Button className="primary" onClick={() => onPick(show)}>Let’s watch</Button>
        <Button onClick={() => onPass(show)}>Not tonight</Button>
      </>}</div>
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
