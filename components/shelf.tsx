import { preferences, shelfShows, watchStates, type Household, type Preference, type Progress } from '../lib/household';
import { Artwork, Button, Icon, ShowMeta } from './shared';

type ShelfProps = {
  state: Household;
  onBrowse: () => void;
  onRemove: (id: string) => void;
  onPreference: (show: string, viewer: number, value: Preference) => void;
  onProgress: (show: string, viewer: number, value: Progress) => void;
};

export default function Shelf({ state, onBrowse, onRemove, onPreference, onProgress }: ShelfProps) {
  const shows = shelfShows(state);
  return <>
    <h1>Our shelf</h1>
    <p className="intro">Keep the shows you know. Open a title to set everyone’s preferences.</p>
    <Button className="primary wide" onClick={onBrowse}><Icon name="plus" />Add our shows</Button>
    {shows.length ? <div className="shelf-list">{shows.map(show => {
      const entry = state.shelf[show.id];
      return <details className="shelf-title" key={show.id}>
        <summary><span className="preview">
          {show.artwork?.length ? <Artwork show={show} className="shelf-thumb" /> : null}{show.title}
        </span></summary>
        <p className="small"><ShowMeta show={show} /></p>
        <div className="fields">{state.viewers.map(viewer =>
          <fieldset className="viewer-preferences" key={viewer.id}>
            <legend>{viewer.name}</legend>
            <label className="field">Preference
              <select value={entry.preferences[viewer.id] ?? 'unknown'}
                onChange={event => onPreference(show.id, viewer.id, event.currentTarget.value as Preference)}>
                {Object.entries(preferences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">Watch progress
              <select value={entry.progress[viewer.id] ?? 'unknown'}
                onChange={event => onProgress(show.id, viewer.id, event.currentTarget.value as Progress)}>
                {Object.entries(watchStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </fieldset>
        )}</div>
        <button type="button" className="text-button" onClick={() => onRemove(show.id)}>Remove from shelf</button>
      </details>;
    })}</div> : <div className="empty">
      <h2>Your shelf is empty</h2><p>Add a few familiar titles for your next family pick.</p>
    </div>}
  </>;
}
