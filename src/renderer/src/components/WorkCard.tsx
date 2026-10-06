import type { JSX } from 'react';
import type { Work, WorkStatus } from '@zero/types';
import { STATUS_COLORS, TYPE_COLORS, coverUrl } from '@zero/renderer/constants';
import { useMessages } from '@zero/renderer/i18n';

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
  const m = useMessages();
  const url = coverUrl(work.coverFile);
  const done = work.status === 'concluido';
  const paused = work.status === 'pausado';
  const cancelled = work.status === 'cancelado';
  const marker = work.marker;

  return (
    <article className="card" onClick={() => onOpen(work)}>
      <div className="cover">
        {url !== null ? (
          <img src={url} alt={m.workCard.coverOf(work.title)} draggable={false} />
        ) : (
          <div className="cover-placeholder">
            <i className="fa-solid fa-book-open" />
          </div>
        )}
        <span className="cover-badge" style={{ color: TYPE_COLORS[work.type] }}>
          {m.workTypes[work.type]}
        </span>
        <span className="cover-status" style={{ color: STATUS_COLORS[work.status] }}>
          {m.workStatus[work.status]}
        </span>
      </div>

      <div className="card-body">
        <div className="card-title">{work.title !== '' ? work.title : m.workCard.untitled}</div>
        {marker !== undefined && marker !== '' ? <div className="card-marker">{marker}</div> : null}
        {work.category !== undefined && work.category !== '' ? (
          <div className="card-category">{work.category}</div>
        ) : null}

        <div className="progress-row">
          <span>{m.workCard.progress}</span>
          <b>{done ? '100%' : m.workCard.progressValue(work.progress)}</b>
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
              title={m.workCard.increase1}
              onClick={() => onProgress(work, work.progress + 1)}
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
            <button
              className="btn small icon-only"
              title={m.workCard.decrease1}
              onClick={() => onProgress(work, work.progress - 1)}
            >
              <i className="fa-solid fa-arrow-down" />
            </button>
          </div>
          {done ? (
            <button
              className="btn small ghost icon-only"
              title={m.workCard.reopen}
              onClick={() => onStatus(work, 'lendo')}
            >
              <i className="fa-solid fa-rotate-left" />
            </button>
          ) : cancelled ? (
            <button
              className="btn small ghost icon-only"
              title={m.workCard.resume}
              onClick={() => onStatus(work, 'lendo')}
            >
              <i className="fa-solid fa-play" />
            </button>
          ) : (
            <>
              <button
                className="btn small success icon-only"
                title={m.workCard.finish}
                onClick={() => onStatus(work, 'concluido')}
              >
                <i className="fa-solid fa-check" />
              </button>
              {paused ? (
                <button
                  className="btn small icon-only"
                  title={m.workCard.resume}
                  onClick={() => onStatus(work, 'lendo')}
                >
                  <i className="fa-solid fa-play" />
                </button>
              ) : (
                <button
                  className="btn small icon-only"
                  title={m.workCard.pause}
                  onClick={() => onStatus(work, 'pausado')}
                >
                  <i className="fa-solid fa-pause" />
                </button>
              )}
              <button
                className="btn small danger icon-only"
                title={m.workCard.cancel}
                onClick={() => onStatus(work, 'cancelado')}
              >
                <i className="fa-solid fa-ban" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
