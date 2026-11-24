'use client';

import { useEffect, useRef, useState } from 'react';
import {
  addShow, changeDecision, decodeHousehold, emptyHousehold, findSavedShow, forLocalDay, loadHousehold,
  localDay, removeShow, removeViewer, storageKey, type Household, type Preference, type Progress
} from '../lib/household';
import type { Show } from '../lib/tv';
import Browse from './browse';
import HouseholdSettings from './household-settings';
import { Icon } from './shared';
import Shelf from './shelf';
import Tonight from './tonight';

type Page = 'browse' | 'shelf' | 'settings' | 'tonight';
const storageUnavailable = 'This browser couldn’t save your household. Download a backup to keep your changes.';

export default function OurShow() {
  const [state, setState] = useState<Household>(() => emptyHousehold());
  const [ready, setReady] = useState(false);
  const [canSave, setCanSave] = useState(true);
  const [storageMessage, setStorageMessage] = useState('');
  const [page, setPage] = useState<Page>('browse');
  const [announcement, announce] = useState('');
  const screen = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const { state, unreadable } = loadHousehold(localStorage);
      setState(state);
      setPage(state.onboarding === 'done' ? 'tonight' : state.onboarding);
      if (unreadable) {
        setCanSave(false);
        setStorageMessage('The stored household couldn’t be read. It has been left in place. Restore a household backup to continue saving.');
      }
    } catch {
      setStorageMessage(storageUnavailable);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !canSave) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStorageMessage('');
    } catch {
      setStorageMessage(storageUnavailable);
    }
  }, [state, ready, canSave]);

  useEffect(() => {
    function refreshDay() {
      setState(current => forLocalDay(current));
    }
    window.addEventListener('focus', refreshDay);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      window.removeEventListener('focus', refreshDay);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  }, []);

  function focusScreen() {
    screen.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function open(next: Page) {
    setState(current => forLocalDay(current));
    setPage(next);
    focusScreen();
  }

  function browse() {
    open('browse');
  }

  function finish() {
    setState(current => ({ ...current, onboarding: 'done' }));
    open('tonight');
  }

  function setService(service: string, checked: boolean) {
    setState(current => ({
      ...current,
      services: checked ? [...new Set([...current.services, service])] : current.services.filter(item => item !== service)
    }));
  }

  function add(show: Show) {
    if (findSavedShow(state, show)) return;
    setState(current => addShow(current, show));
    announce(show.title + ' added to your shelf.');
  }

  function decide(decision: Parameters<typeof changeDecision>[1], message: string) {
    setState(current => changeDecision(current, decision));
    if (state.tonight.day === localDay()) announce(message);
    focusScreen();
  }

  function setPreference(show: string, viewer: number, preference: Preference) {
    setState(current => {
      const entry = current.shelf[show];
      return { ...current, shelf: { ...current.shelf, [show]: {
        ...entry, preferences: { ...entry.preferences, [viewer]: preference }
      } } };
    });
  }

  function setProgress(show: string, viewer: number, progress: Progress) {
    setState(current => {
      const entry = current.shelf[show];
      return { ...current, shelf: { ...current.shelf, [show]: {
        ...entry, progress: { ...entry.progress, [viewer]: progress }
      } } };
    });
  }

  async function restore(file: File): Promise<string> {
    if (file.size > 5_000_000) return 'Choose an Our Show JSON backup smaller than 5 MB.';
    const restored = decodeHousehold(await file.text());
    if (!restored) return 'That file is not a valid Our Show household backup.';
    if ((state.onboarding === 'done' || state.services.length > 0 || Object.keys(state.shelf).length > 0 || !canSave)
      && !window.confirm('Replace the household on this browser with this backup?')) return 'The current household was kept.';

    setState(restored);
    setCanSave(true);
    setStorageMessage('');
    setPage(restored.onboarding === 'done' ? 'tonight' : restored.onboarding);
    announce('Household backup restored.');
    focusScreen();
    return 'Household backup restored.';
  }

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'our-show-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const showTabs = ready && state.onboarding === 'done';
  const mainTab = page === 'shelf' || page === 'tonight';
  return <div className="app">
    <header className="masthead">
      <span className="brand"><Icon name="sprout" />Our Show</span>
      <button className="icon-button" type="button" aria-label="Household settings" hidden={!showTabs}
        onClick={() => open('settings')}><Icon name="settings-2" /></button>
    </header>
    <main ref={screen} className={mainTab ? 'main-tab' : undefined} tabIndex={-1}>
      {storageMessage && <p className="storage-message small" role="alert">{storageMessage}</p>}
      {!ready ? <p>Loading Our Show…</p> : {
        browse: <Browse state={state} onAdd={add} onFinish={finish} onRestore={restore} />,
        shelf: <Shelf state={state} onBrowse={browse} onRemove={id => {
          setState(current => removeShow(current, id));
          announce('Removed from your shelf.');
          focusScreen();
        }} onPreference={setPreference} onProgress={setProgress} />,
        settings: <HouseholdSettings state={state} onService={setService}
          onRename={(id, name) => setState(current => ({
            ...current, viewers: current.viewers.map(viewer => viewer.id === id ? { id, name } : viewer)
          }))}
          onAdd={() => setState(current => ({
            ...current,
            viewers: [...current.viewers, { id: current.nextViewer, name: 'Viewer ' + current.nextViewer }],
            watching: [...current.watching, current.nextViewer],
            nextViewer: current.nextViewer + 1
          }))}
          onRemove={id => setState(current => removeViewer(current, id))}
          onDone={() => open('tonight')} onImport={restore} onExport={exportBackup} />,
        tonight: <Tonight state={state} onBrowse={browse}
          onPass={show => decide({ action: 'pass', id: show.id }, 'Passed on ' + show.title + '.')}
          onPick={show => decide({ action: 'confirm', id: show.id }, show.title + ' picked for tonight.')}
          onUndo={show => decide({ action: 'undo' }, 'Restored ' + show.title + '.')}
          onReopen={() => decide({ action: 'reopen' }, 'Tonight’s decision was reopened.')}
          onWatching={(id, checked) => setState(current => ({
            ...current, watching: checked ? [...current.watching, id] : current.watching.filter(viewer => viewer !== id)
          }))} />
      }[page]}
    </main>
    <nav aria-label="Main navigation" hidden={!showTabs}>
      <button type="button" aria-current={page === 'tonight' ? 'page' : undefined} onClick={() => open('tonight')}>
        <Icon name="house" />Tonight
      </button>
      <button type="button" aria-current={page === 'shelf' || page === 'browse' ? 'page' : undefined} onClick={() => open('shelf')}>
        <Icon name="library-big" />Shelf
      </button>
    </nav>
    <p className="sr-only" role="status">{announcement}</p>
  </div>;
}
