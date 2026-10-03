import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { DriveStatus, Work } from '@shared/types';
import { FILTERS, STATUS_COLORS, clampProgress, type StatusFilter } from './constants';
import WorkCard from './components/WorkCard';
import WorkModal from './components/WorkModal';
import SettingsModal from './components/SettingsModal';

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

export default function App(): JSX.Element {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);

  const saveTimers = useRef<Map<string, number>>(new Map());
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string, kind: 'info' | 'error' = 'info'): void => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    const [library, status] = await Promise.all([
      window.api.library.get(),
      window.api.drive.status(),
    ]);
    setWorks(library);
    setDrive(status);
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
        void persist(work).catch(() => notify('Não foi possível salvar a obra.', 'error'));
      }, 450);
      timers.set(work.id, handle);
    },
    [notify, persist],
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

  const complete = useCallback(
    (work: Work): void => {
      const next: Work = { ...work, status: 'concluido', updatedAt: new Date().toISOString() };
      setWorks((current) => current.map((item) => (item.id === next.id ? next : item)));
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const reopen = useCallback(
    (work: Work): void => {
      const next: Work = { ...work, status: 'lendo', updatedAt: new Date().toISOString() };
      setWorks((current) => current.map((item) => (item.id === next.id ? next : item)));
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const saveEdited = useCallback(
    async (work: Work): Promise<void> => {
      const saved = await window.api.library.save(work);
      setWorks(saved);
      notify('Obra salva.');
    },
    [notify],
  );

  const deleteWork = useCallback(
    async (work: Work): Promise<void> => {
      const saved = await window.api.library.remove(work.id);
      setWorks(saved);
      notify('Obra removida.');
    },
    [notify],
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

  const stats: Stats = useMemo(() => {
    const total = works.length;
    const reading = works.filter((w) => w.status === 'lendo').length;
    const done = works.filter((w) => w.status === 'concluido').length;
    const planned = works.filter((w) => w.status === 'planejado').length;
    const paused = works.filter((w) => w.status === 'pausado').length;
    const average = total !== 0 ? Math.round((done / total) * 100) : 0;
    return { total, reading, done, planned, paused, average };
  }, [works]);

  const driveSyncing = drive?.syncing === true;
  const driveConnected = drive?.connected === true;
  const driveDotClass = driveSyncing ? 'dot busy' : driveConnected ? 'dot on' : 'dot';
  const driveLabel = driveSyncing
    ? 'Sincronizando…'
    : driveConnected
      ? 'Drive conectado'
      : 'Drive off';
  const hasWorks = works.length !== 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-logo">
            <i className="fa-solid fa-book-open" />
          </div>
          <div>
            <h1>Webtoons Biblioteca</h1>
            <small>
              {stats.total} obra(s) · progresso médio {stats.average}%
            </small>
          </div>
        </div>

        <div className="search">
          <span>
            <i className="fa-solid fa-magnifying-glass" />
          </span>
          <input
            type="text"
            value={query}
            placeholder="Buscar por título ou sinopse…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              className={`chip${filter === item.value ? ' active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="header-actions">
          <button
            className="drive-pill"
            onClick={() => setShowSettings(true)}
            title="Configurações do backup no Google Drive"
          >
            <span className={driveDotClass} />
            {driveLabel}
          </button>
          <button
            className="btn ghost icon-only"
            onClick={() => setShowSettings(true)}
            title="Configurações"
          >
            <i className="fa-solid fa-gear" />
          </button>
          <button
            className="btn primary"
            onClick={() => setEditing({ work: blankWork(), isNew: true })}
          >
            <i className="fa-solid fa-plus" /> Nova obra
          </button>
        </div>
      </header>

      <main className="content">
        <div className="summary">
          <div className="stat">
            <b>{stats.total}</b>
            <span>Total de obras</span>
          </div>
          <div className="stat">
            <b style={{ color: STATUS_COLORS.lendo }}>{stats.reading}</b>
            <span>Lendo</span>
          </div>
          <div className="stat">
            <b style={{ color: STATUS_COLORS.concluido }}>{stats.done}</b>
            <span>Concluídas</span>
          </div>
          <div className="stat">
            <b style={{ color: STATUS_COLORS.planejado }}>{stats.planned}</b>
            <span>Planejadas</span>
          </div>
          <div className="stat">
            <b style={{ color: STATUS_COLORS.pausado }}>{stats.paused}</b>
            <span>Pausadas</span>
          </div>
          <div className="stat">
            <b>{stats.average}%</b>
            <span>Progresso médio</span>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <i className="fa-solid fa-spinner fa-spin" /> Carregando biblioteca…
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="icon">
              <i className="fa-solid fa-book-open" />
            </div>
            <h3>{hasWorks ? 'Nenhuma obra encontrada' : 'Sua biblioteca está vazia'}</h3>
            <p>
              {hasWorks
                ? 'Tente outro filtro ou termo de busca.'
                : 'Adicione sua primeira obra: capa, título, sinopse e acompanhe o progresso em porcentagem.'}
            </p>
            {!hasWorks ? (
              <button
                className="btn primary"
                onClick={() => setEditing({ work: blankWork(), isNew: true })}
              >
                <i className="fa-solid fa-plus" /> Adicionar primeira obra
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
                onComplete={complete}
                onReopen={reopen}
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
        <SettingsModal onClose={() => setShowSettings(false)} notify={notify} />
      ) : null}

      {toast !== null ? (
        <div className={`toast${toast.kind === 'error' ? ' error' : ''}`}>{toast.message}</div>
      ) : null}
    </div>
  );
}
