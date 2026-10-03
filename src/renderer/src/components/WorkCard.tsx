import type { JSX } from 'react';
import type { Work } from '@shared/types';
import { STATUS_COLORS, STATUS_LABELS, TYPE_COLORS, TYPE_LABELS, coverUrl } from '../constants';

interface WorkCardProps {
  work: Work;
  onOpen: (work: Work) => void;
  onProgress: (work: Work, progress: number) => void;
  onComplete: (work: Work) => void;
  onReopen: (work: Work) => void;
}

export default function WorkCard({
  work,
  onOpen,
  onProgress,
  onComplete,
  onReopen,
}: WorkCardProps): JSX.Element {
  const url = coverUrl(work.coverFile);
  const done = work.status === 'concluido';
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
          <button
            className="btn small"
            title="Diminuir 10%"
            onClick={() => onProgress(work, work.progress - 10)}
          >
            <i className="fa-solid fa-minus" /> 10
          </button>
          <button
            className="btn small"
            title="Aumentar 10%"
            onClick={() => onProgress(work, work.progress + 10)}
          >
            <i className="fa-solid fa-plus" /> 10
          </button>
          {done ? (
            <button className="btn small ghost" onClick={() => onReopen(work)}>
              <i className="fa-solid fa-rotate-left" /> Reabrir
            </button>
          ) : (
            <button className="btn small success" onClick={() => onComplete(work)}>
              <i className="fa-solid fa-check" /> Concluir
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
