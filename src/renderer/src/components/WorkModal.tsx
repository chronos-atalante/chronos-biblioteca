import { useEffect, useState } from 'react'
import type { Work, WorkStatus, WorkType } from '@shared/types'
import {
  STATUS_LABELS,
  TYPE_LABELS,
  coverUrl,
  clampProgress
} from '../constants'
import { STATUS_OPTIONS, TYPE_OPTIONS } from '../constants'

interface WorkModalProps {
  work: Work
  isNew: boolean
  onSave: (work: Work) => Promise<void>
  onDelete: (work: Work) => Promise<void>
  onClose: () => void
}

export default function WorkModal({ work, isNew, onSave, onDelete, onClose }: WorkModalProps) {
  const [draft, setDraft] = useState<Work>(work)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patch = (partial: Partial<Work>): void => setDraft((current) => ({ ...current, ...partial }))

  const setProgress = (value: number): void => {
    const progress = clampProgress(value)
    patch(
      progress >= 100
        ? { progress, status: 'concluido' }
        : { progress, status: draft.status === 'concluido' ? 'lendo' : draft.status }
    )
  }

  const setStatus = (status: WorkStatus): void => {
    if (status === 'concluido') patch({ status, progress: 100 })
    else patch({ status })
  }

  const chooseCover = async (): Promise<void> => {
    const file = await window.api.pickCover()
    if (file) patch({ coverFile: file })
  }

  const submit = async (): Promise<void> => {
    if (!draft.title.trim()) {
      setError('Informe o título da obra.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...draft, title: draft.title.trim(), progress: clampProgress(draft.progress) })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    try {
      await onDelete(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const url = coverUrl(draft.coverFile)

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isNew ? 'Nova obra' : 'Editar obra'}</h2>
          <button className="modal-close" onClick={onClose} title="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error ? <div className="banner error">{error}</div> : null}

          <div className="cover-editor">
            <div className="cover-preview">
              {url ? <img src={url} alt="Prévia da capa" /> : <span>📖</span>}
            </div>
            <div className="cover-tools">
              <p>Adicione a imagem da capa da obra (JPG, PNG, WebP…). A imagem é copiada para a biblioteca local.</p>
              <div className="quick-row">
                <button className="btn small" onClick={() => void chooseCover()}>
                  Escolher imagem
                </button>
                {draft.coverFile ? (
                  <button className="btn small ghost" onClick={() => patch({ coverFile: undefined })}>
                    Remover capa
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="field">
            <label>Título</label>
            <input
              type="text"
              value={draft.title}
              placeholder="Ex.: Solo Leveling"
              autoFocus
              onChange={(event) => patch({ title: event.target.value })}
            />
          </div>

          <div className="field">
            <label>Sinopse</label>
            <textarea
              value={draft.synopsis}
              placeholder="Escreva a sinopse da obra..."
              onChange={(event) => patch({ synopsis: event.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Tipo</label>
              <select
                value={draft.type}
                onChange={(event) => patch({ type: event.target.value as WorkType })}
              >
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={draft.status} onChange={(event) => setStatus(event.target.value as WorkStatus)}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Marcação (opcional)</label>
              <input
                type="text"
                value={draft.marker || ''}
                placeholder="Cap. 45 / Vol. 3"
                onChange={(event) => patch({ marker: event.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Progresso da leitura</label>
            <div className="progress-editor">
              <input
                type="range"
                min={0}
                max={100}
                value={draft.progress}
                onChange={(event) => setProgress(Number(event.target.value))}
              />
              <input
                className="progress-value"
                type="number"
                min={0}
                max={100}
                value={draft.progress}
                onChange={(event) => setProgress(Number(event.target.value))}
              />
              <span className="progress-percent">{draft.progress}%</span>
            </div>
            <div className="quick-row">
              <button className="btn small" onClick={() => setProgress(draft.progress - 10)}>
                −10%
              </button>
              <button className="btn small" onClick={() => setProgress(draft.progress + 10)}>
                +10%
              </button>
              <button className="btn small success" onClick={() => patch({ progress: 100, status: 'concluido' })}>
                Marcar como concluído
              </button>
              <button className="btn small ghost" onClick={() => patch({ progress: 0, status: 'planejado' })}>
                Zerar
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {!isNew ? (
            <button className={`btn danger${confirmDelete ? ' attention' : ''}`} onClick={() => void remove()} disabled={saving}>
              {confirmDelete ? 'Confirmar exclusão?' : 'Excluir'}
            </button>
          ) : null}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
