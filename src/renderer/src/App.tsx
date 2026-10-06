import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { DriveStatus, Language, Work, WorkStatus } from '@zero/types';
import { messages } from '@zero/messages';
import {
  FILTER_OPTIONS,
  STATUS_COLORS,
  clampProgress,
  type StatusFilter,
} from '@zero/renderer/constants';
import { MessagesProvider } from '@zero/renderer/i18n';
import WorkCard from '@zero/renderer/components/WorkCard';
import WorkModal from '@zero/renderer/components/WorkModal';
import SettingsModal from '@zero/renderer/components/SettingsModal';
import AttributionsModal from '@zero/renderer/components/AttributionsModal';
import DonateModal from '@zero/renderer/components/DonateModal';

interface EditingState {
  work: Work;
  isNew: boolean;
}

interface Stats {
  total: number;
  reading: number;
  done: number;
  planned: number;
  paused: number;
  cancelled: number;
  average: number;
}

function blankWork(): Work {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    synopsis: '',
    type: 'webtoon',
    status: 'planejado',
    progress: 0,
    marker: '',
    createdAt: now,
    updatedAt: now,
  };
}

function summarize(list: Work[]): Stats {
  const total = list.length;
  const reading = list.filter((w) => w.status === 'lendo').length;
  const done = list.filter((w) => w.status === 'concluido').length;
  const planned = list.filter((w) => w.status === 'planejado').length;
  const paused = list.filter((w) => w.status === 'pausado').length;
  const cancelled = list.filter((w) => w.status === 'cancelado').length;
  const average = total !== 0 ? Math.round((done / total) * 100) : 0;
  return { total, reading, done, planned, paused, cancelled, average };
}

export default function App(): JSX.Element {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAttributions, setShowAttributions] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);

  const saveTimers = useRef<Map<string, number>>(new Map());
  const toastTimer = useRef<number | undefined>(undefined);

  const m = messages(language);

  const notify = useCallback((message: string, kind: 'info' | 'error' = 'info'): void => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    const [library, status, settings] = await Promise.all([
      window.api.library.get(),
      window.api.drive.status(),
      window.api.settings.get(),
    ]);
    setWorks(library);
    setDrive(status);
    setLanguage(settings.language);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const unsubscribe = window.api.drive.onStatus((status) => setDrive(status));
    return () => {
      unsubscribe();
    };
  }, [reload]);

  const persist = useCallback(async (work: Work): Promise<void> => {
    const saved = await window.api.library.save(work);
    setWorks(saved);
  }, []);

  const scheduleSave = useCallback(
    (work: Work): void => {
      const timers = saveTimers.current;
      const existing = timers.get(work.id);
      if (existing !== undefined) window.clearTimeout(existing);
      const handle = window.setTimeout(() => {
        timers.delete(work.id);
        void persist(work).catch(() => notify(m.app.toastSaveError, 'error'));
      }, 450);
      timers.set(work.id, handle);
    },
    [notify, persist, m],
  );

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
    };
  }, []);

  const updateProgress = useCallback(
    (work: Work, rawProgress: number): void => {
      const progress = clampProgress(rawProgress);
      const next: Work = {
        ...work,
        progress,
        status: work.status === 'concluido' ? 'lendo' : work.status,
        updatedAt: new Date().toISOString(),
      };
      setWorks((current) => current.map((item) => (item.id === next.id ? next : item)));
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const changeStatus = useCallback(
    (work: Work, status: WorkStatus): void => {
      const next: Work = { ...work, status, updatedAt: new Date().toISOString() };
      setWorks((current) => current.map((item) => (item.id === next.id ? next : item)));
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const saveEdited = useCallback(
    async (work: Work): Promise<void> => {
      const saved = await window.api.library.save(work);
      setWorks(saved);
      notify(m.app.toastSaved);
    },
    [notify, m],
  );

  const deleteWork = useCallback(
    async (work: Work): Promise<void> => {
      const saved = await window.api.library.remove(work.id);
      setWorks(saved);
      notify(m.app.toastRemoved);
    },
    [notify, m],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return works
      .filter((work) => (filter === 'todos' ? true : work.status === filter))
      .filter((work) =>
        term === ''
          ? true
          : work.title.toLowerCase().includes(term) ||
            work.synopsis.toLowerCase().includes(term) ||
            (work.category ?? '').toLowerCase().includes(term),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [works, query, filter]);

  const stats: Stats = useMemo(() => summarize(works), [works]);
  const visibleStats: Stats = useMemo(() => summarize(visible), [visible]);

  const driveSyncing = drive?.syncing === true;
  const driveConnected = drive?.connected === true;
  const driveDotClass = driveSyncing ? 'dot busy' : driveConnected ? 'dot on' : 'dot';
  const driveLabel = driveSyncing
    ? m.app.drivePill.syncing
    : driveConnected
      ? m.app.drivePill.connected
      : m.app.drivePill.off;
  const hasWorks = works.length !== 0;

  return (
    <MessagesProvider language={language}>
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-logo">
              <i className="fa-solid fa-book-open" />
            </div>
            <div>
              <h1>Chronos Biblioteca</h1>
              <small>{m.app.headerStats(visibleStats.total, visibleStats.average)}</small>
            </div>
          </div>

          <div className="search">
            <span>
              <i className="fa-solid fa-magnifying-glass" />
            </span>
            <input
              type="text"
              value={query}
              placeholder={m.app.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="filters">
            {FILTER_OPTIONS.map((item) => (
              <button
                key={item}
                className={`chip${filter === item ? ' active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {m.app.filters[item]}
              </button>
            ))}
          </div>

          <div className="header-actions">
            <button
              className="drive-pill"
              onClick={() => setShowSettings(true)}
              title={m.app.openSettingsTitle}
            >
              <span className={driveDotClass} />
              {driveLabel}
            </button>
            <button
              className="btn ghost"
              onClick={() => setShowAttributions(true)}
              title={m.app.openAttributionsTitle}
            >
              <i className="fa-solid fa-clapperboard" /> {m.app.attributionsLabel}
            </button>
            <button
              className="btn ghost"
              onClick={() => setShowDonate(true)}
              title={m.app.openDonateTitle}
            >
              <i className="fa-solid fa-heart" /> {m.app.donateLabel}
            </button>
            <button
              className="btn ghost icon-only"
              onClick={() => setShowSettings(true)}
              title={m.app.settingsTitle}
            >
              <i className="fa-solid fa-gear" />
            </button>
            <button
              className="btn primary"
              onClick={() => setEditing({ work: blankWork(), isNew: true })}
            >
              <i className="fa-solid fa-plus" /> {m.app.newWork}
            </button>
          </div>
        </header>

        <main className="content">
          <div className="summary">
            <div className="stat">
              <b>{stats.total}</b>
              <span>{m.app.stats.total}</span>
            </div>
            <div className="stat">
              <b style={{ color: STATUS_COLORS.lendo }}>{stats.reading}</b>
              <span>{m.app.stats.reading}</span>
            </div>
            <div className="stat">
              <b style={{ color: STATUS_COLORS.concluido }}>{stats.done}</b>
              <span>{m.app.stats.done}</span>
            </div>
            <div className="stat">
              <b style={{ color: STATUS_COLORS.planejado }}>{stats.planned}</b>
              <span>{m.app.stats.planned}</span>
            </div>
            <div className="stat">
              <b style={{ color: STATUS_COLORS.pausado }}>{stats.paused}</b>
              <span>{m.app.stats.paused}</span>
            </div>
            <div className="stat">
              <b style={{ color: STATUS_COLORS.cancelado }}>{stats.cancelled}</b>
              <span>{m.app.stats.cancelled}</span>
            </div>
            <div className="stat">
              <b>{stats.average}%</b>
              <span>{m.app.stats.average}</span>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <i className="fa-solid fa-spinner fa-spin" /> {m.app.loadingLibrary}
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <div className="icon">
                <i className="fa-solid fa-book-open" />
              </div>
              <h3>{hasWorks ? m.app.emptyFoundTitle : m.app.emptyLibraryTitle}</h3>
              <p>{hasWorks ? m.app.emptyFoundText : m.app.emptyLibraryText}</p>
              {!hasWorks ? (
                <button
                  className="btn primary"
                  onClick={() => setEditing({ work: blankWork(), isNew: true })}
                >
                  <i className="fa-solid fa-plus" /> {m.app.addFirstWork}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid">
              {visible.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  onOpen={(item) => setEditing({ work: item, isNew: false })}
                  onProgress={updateProgress}
                  onStatus={changeStatus}
                />
              ))}
            </div>
          )}
        </main>

        {editing !== null ? (
          <WorkModal
            work={editing.work}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
            onSave={saveEdited}
            onDelete={deleteWork}
          />
        ) : null}

        {showSettings ? (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            notify={notify}
            onLanguageChange={setLanguage}
          />
        ) : null}

        {showAttributions ? <AttributionsModal onClose={() => setShowAttributions(false)} /> : null}

        {showDonate ? <DonateModal onClose={() => setShowDonate(false)} /> : null}

        {toast !== null ? (
          <div className={`toast${toast.kind === 'error' ? ' error' : ''}`}>{toast.message}</div>
        ) : null}
      </div>
    </MessagesProvider>
  );
}
