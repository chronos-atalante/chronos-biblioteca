import type { JSX } from 'react';
import type { Work, WorkStatus } from '@zero/types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  coverUrl,
} from '@zero/renderer/constants';

interface WorkCardProps {
  work: Work;
  onOpen: (work: Work) => void;
  onProgress: (work: Work, progress: number) => void;
  onStatus: (work: Work, status: WorkStatus) => void;
}

export default function WorkCard({
  work,
  onOpen,
  onProgress,
  onStatus,
}: WorkCardProps): JSX.Element {
  const url = coverUrl(work.coverFile);
  const done = work.status === 'concluido';
  const paused = work.status === 'pausado';
  const cancelled = work.status === 'cancelado';
  const marker = work.marker;

  return (
    <article className="card" onClick={() => onOpen(work)}>
      <div className="cover">
        {url !== null ? (
          <img src={url} alt={`Capa de ${work.title}`} draggable={false} />
        ) : (
          <div className="cover-placeholder">
            <i className="fa-solid fa-book-open" />
          </div>
        )}
        <span className="cover-badge" style={{ color: TYPE_COLORS[work.type] }}>
          {TYPE_LABELS[work.type]}
        </span>
        <span className="cover-status" style={{ color: STATUS_COLORS[work.status] }}>
          {STATUS_LABELS[work.status]}
        </span>
      </div>

      <div className="card-body">
        <div className="card-title">{work.title !== '' ? work.title : 'Sem título'}</div>
        {marker !== undefined && marker !== '' ? <div className="card-marker">{marker}</div> : null}
        {work.category !== undefined && work.category !== '' ? (
          <div className="card-category">{work.category}</div>
        ) : null}

        <div className="progress-row">
          <span>Progresso</span>
          <b>{done ? '100%' : `Cap. ${work.progress}`}</b>
        </div>
        <div className="bar">
          <div
            className={`bar-fill${done ? ' done' : ' indeterminate'}`}
            style={done ? { width: '100%' } : undefined}
          />
        </div>

        <div className="card-actions" onClick={(event) => event.stopPropagation()}>
          <div className="step-buttons">
            <button
              className="btn small icon-only"
              title="Aumentar 1"
              onClick={() => onProgress(work, work.progress + 1)}
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
            <button
              className="btn small icon-only"
              title="Diminuir 1"
              onClick={() => onProgress(work, work.progress - 1)}
            >
              <i className="fa-solid fa-arrow-down" />
            </button>
          </div>
          {done ? (
            <button className="btn small ghost" onClick={() => onStatus(work, 'lendo')}>
              <i className="fa-solid fa-rotate-left" /> Reabrir
            </button>
          ) : cancelled ? (
            <button className="btn small ghost" onClick={() => onStatus(work, 'lendo')}>
              <i className="fa-solid fa-play" /> Retomar
            </button>
          ) : (
            <>
              <button className="btn small success" onClick={() => onStatus(work, 'concluido')}>
                <i className="fa-solid fa-check" /> Concluir
              </button>
              {paused ? (
                <button className="btn small" onClick={() => onStatus(work, 'lendo')}>
                  <i className="fa-solid fa-play" /> Retomar
                </button>
              ) : (
                <button className="btn small" onClick={() => onStatus(work, 'pausado')}>
                  <i className="fa-solid fa-pause" /> Pausar
                </button>
              )}
              <button className="btn small danger" onClick={() => onStatus(work, 'cancelado')}>
                <i className="fa-solid fa-ban" /> Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
