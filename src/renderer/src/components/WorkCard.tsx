import type { Work } from '@shared/types'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  coverUrl
} from '../constants'

interface WorkCardProps {
  work: Work
  onOpen: (work: Work) => void
  onProgress: (work: Work, progress: number) => void
  onComplete: (work: Work) => void
  onReopen: (work: Work) => void
}

export default function WorkCard({ work, onOpen, onProgress, onComplete, onReopen }: WorkCardProps) {
  const url = coverUrl(work.coverFile)
  const done = work.status === 'concluido'

  return (
    <article className="card" onClick={() => onOpen(work)}>
      <div className="cover">
        {url ? (
          <img src={url} alt={`Capa de ${work.title}`} draggable={false} />
        ) : (
          <div className="cover-placeholder">📖</div>
        )}
        <span className="cover-badge" style={{ color: TYPE_COLORS[work.type] }}>
          {TYPE_LABELS[work.type]}
        </span>
        <span className="cover-status" style={{ color: STATUS_COLORS[work.status] }}>
          {STATUS_LABELS[work.status]}
        </span>
      </div>

      <div className="card-body">
        <div className="card-title">{work.title || 'Sem título'}</div>
        {work.marker ? <div className="card-marker">{work.marker}</div> : null}

        <div className="progress-row">
          <span>Progresso</span>
          <b>{work.progress}%</b>
        </div>
        <div className="bar">
          <div
            className={`bar-fill${done ? ' done' : ''}`}
            style={{ width: `${work.progress}%` }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={work.progress}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation()
            onProgress(work, Number(event.target.value))
          }}
        />

        <div className="card-actions" onClick={(event) => event.stopPropagation()}>
          <button
            className="btn small"
            title="Diminuir 10%"
            onClick={() => onProgress(work, work.progress - 10)}
          >
            −10
          </button>
          <button
            className="btn small"
            title="Aumentar 10%"
            onClick={() => onProgress(work, work.progress + 10)}
          >
            +10
          </button>
          {done ? (
            <button className="btn small ghost" onClick={() => onReopen(work)}>
              Reabrir
            </button>
          ) : (
            <button className="btn small success" onClick={() => onComplete(work)}>
              Concluir
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
