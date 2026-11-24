import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { services, type Household } from '../lib/household';
import { Button, CheckChoice } from './shared';

export function ServiceChoices({ selected, onChange }: {
  selected: string[]; onChange: (service: string, checked: boolean) => void;
}) {
  return <fieldset className="choices">
    <legend className="sr-only">Streaming services</legend>
    {services.map(service => <CheckChoice key={service} checked={selected.includes(service)}
      onChange={event => onChange(service, event.currentTarget.checked)}>{service}</CheckChoice>)}
  </fieldset>;
}

export function BackupControls({ onImport, onExport }: {
  onImport: (file: File) => Promise<string>; onExport?: () => void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return <div className="backup-controls">
    {onExport && <button type="button" className="text-button" onClick={onExport}>Download household backup</button>}
    <button type="button" className="text-button" disabled={busy} onClick={() => input.current?.click()}>Restore household backup</button>
    <input ref={input} type="file" accept=".json,application/json" hidden
      onChange={async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        setBusy(true);
        try {
          setMessage(await onImport(file));
        } catch {
          setMessage('The backup couldn’t be read. Choose a valid Our Show JSON file.');
        } finally {
          setBusy(false);
        }
      }} />
    <p className="small" role="status">{message}</p>
  </div>;
}

type SettingsProps = {
  state: Household;
  onService: (service: string, checked: boolean) => void;
  onRename: (id: number, name: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onDone: () => void;
  onImport: (file: File) => Promise<string>;
  onExport: () => void;
};

export default function HouseholdSettings({ state, onService, onRename, onAdd, onRemove, onDone, onImport, onExport }: SettingsProps) {
  const newViewer = useRef<number | null>(null);
  const newestInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (newViewer.current === state.viewers.at(-1)?.id) {
      newestInput.current?.focus();
      newViewer.current = null;
    }
  }, [state.viewers]);

  return <>
    <h1>Household</h1>
    <section className="section">
      <h2>Who watches?</h2>
      <div className="fields">{state.viewers.map((viewer, index) => <div className="viewer-row" key={viewer.id}>
        <label className="field">Viewer {index + 1} name
          <input ref={index === state.viewers.length - 1 ? newestInput : undefined}
            maxLength={36} defaultValue={viewer.name} onBlur={event => {
              const name = event.currentTarget.value.trim() || viewer.name;
              event.currentTarget.value = name;
              if (name !== viewer.name) onRename(viewer.id, name);
            }} />
        </label>
        <button type="button" className="text-button" onClick={() => onRemove(viewer.id)}
          disabled={state.viewers.length === 1}>Remove<span className="sr-only"> {viewer.name}</span></button>
      </div>)}</div>
      <button type="button" className="text-button" onClick={() => {
        newViewer.current = state.nextViewer;
        onAdd();
      }}>Add viewer</button>
    </section>
    <section className="section">
      <h2>Where do you watch?</h2>
      <div className="fields"><ServiceChoices selected={state.services} onChange={onService} /></div>
    </section>
    <section className="section">
      <h2>Household backup</h2>
      <BackupControls onImport={onImport} onExport={onExport} />
    </section>
    <Button className="primary wide" onClick={onDone}>Done</Button>
    <section className="section credits" aria-label="Credits">
      <a href="https://www.themoviedb.org/" aria-label="The Movie Database"><img src="/artwork/tmdb.svg" alt="TMDB" /></a>
      <p className="small">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </section>
  </>;
}
