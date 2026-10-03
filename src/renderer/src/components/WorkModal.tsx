import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Work, WorkStatus, WorkType } from '@shared/types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TYPE_COLORS,
  TYPE_LABELS,
  TYPE_OPTIONS,
  CATEGORIES,
  clampProgress,
  coverUrl,
} from '../constants';
import Select from './Select';
import type { SelectOption } from './Select';

interface WorkModalProps {
  work: Work;
  isNew: boolean;
  onSave: (work: Work) => Promise<void>;
  onDelete: (work: Work) => Promise<void>;
  onClose: () => void;
}

export default function WorkModal({
  work,
  isNew,
  onSave,
  onDelete,
  onClose,
}: WorkModalProps): JSX.Element {
  const [draft, setDraft] = useState<Work>(work);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const patch = (partial: Partial<Work>): void => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  const setProgress = (value: number): void => {
    const progress = clampProgress(value);
    patch({ progress, status: draft.status === 'concluido' ? 'lendo' : draft.status });
  };

  const setStatus = (status: WorkStatus): void => {
    patch({ status });
  };

  const chooseCover = async (): Promise<void> => {
    const file = await window.api.pickCover();
    if (file !== null) patch({ coverFile: file });
  };

  const submit = async (): Promise<void> => {
    const title = draft.title.trim();
    if (title === '') {
      setError('Informe o título da obra.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, title, progress: clampProgress(draft.progress) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const url = coverUrl(draft.coverFile);
  const hasCover = draft.coverFile !== undefined && draft.coverFile !== '';

  const typeOptions: SelectOption<WorkType>[] = TYPE_OPTIONS.map((type) => ({
    value: type,
    label: TYPE_LABELS[type],
    color: TYPE_COLORS[type],
  }));

  const statusOptions: SelectOption<WorkStatus>[] = STATUS_OPTIONS.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
  }));

  const categoryOptions: SelectOption<string>[] = [
    { value: '', label: 'Nenhuma' },
    ...CATEGORIES.map((category) => ({ value: category, label: category })),
  ];

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>{isNew ? 'Nova obra' : 'Editar obra'}</h2>
          <button className="modal-close" onClick={onClose} title="Fechar">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          {error !== null ? <div className="banner error">{error}</div> : null}

          <div className="cover-editor">
            <div className="cover-preview">
              {url !== null ? (
                <img src={url} alt="Prévia da capa" />
              ) : (
                <i className="fa-solid fa-book-open" />
              )}
            </div>
            <div className="cover-tools">
              <p>
                Adicione a imagem da capa da obra (JPG, PNG, WebP…). A imagem é copiada para a
                biblioteca local.
              </p>
              <div className="quick-row">
                <button
                  className="btn small"
                  onClick={() => {
                    void chooseCover();
                  }}
                >
                  <i className="fa-regular fa-image" /> Escolher imagem
                </button>
                {hasCover ? (
                  <button
                    className="btn small ghost"
                    onClick={() => patch({ coverFile: undefined })}
                  >
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
            <label>Descrição</label>
            <textarea
              value={draft.synopsis}
              placeholder="Escreva a descrição da obra..."
              onChange={(event) => patch({ synopsis: event.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Tipo</label>
              <Select
                value={draft.type}
                options={typeOptions}
                onChange={(type) => patch({ type })}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <Select value={draft.status} options={statusOptions} onChange={setStatus} />
            </div>
            <div className="field">
              <label>Categoria</label>
              <Select
                value={draft.category ?? ''}
                options={categoryOptions}
                onChange={(category) => patch({ category: category === '' ? undefined : category })}
              />
            </div>
            <div className="field">
              <label>Marcação (opcional)</label>
              <input
                type="text"
                value={draft.marker ?? ''}
                placeholder="Cap. 45 / Vol. 3"
                onChange={(event) => patch({ marker: event.target.value })}
              />
            </div>
          </div>

          <div className="form-row progress-card">
            <div className="field">
              <label>Progresso da leitura</label>
              <div className="progress-editor">
                <input
                  className="progress-value"
                  type="number"
                  min={0}
                  value={draft.progress}
                  onChange={(event) => setProgress(Number(event.target.value))}
                />
                <button
                  className="btn small"
                  title="Diminuir 10"
                  onClick={() => setProgress(draft.progress - 10)}
                >
                  <i className="fa-solid fa-minus" /> 10
                </button>
                <button
                  className="btn small"
                  title="Aumentar 10"
                  onClick={() => setProgress(draft.progress + 10)}
                >
                  <i className="fa-solid fa-plus" /> 10
                </button>
                <span className="progress-percent">
                  {draft.status === 'concluido' ? '100%' : `Cap. ${draft.progress}`}
                </span>
                <button
                  className="btn small success"
                  onClick={() => patch({ status: 'concluido' })}
                >
                  <i className="fa-solid fa-check" /> Concluir
                </button>
                <button
                  className="btn small ghost"
                  onClick={() => patch({ progress: 0, status: 'planejado' })}
                >
                  <i className="fa-solid fa-rotate-left" /> Zerar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {!isNew ? (
            <button
              className="btn danger"
              onClick={() => {
                void remove();
              }}
              disabled={saving}
            >
              <i
                className={confirmDelete ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-trash'}
              />{' '}
              {confirmDelete ? 'Confirmar exclusão?' : 'Excluir'}
            </button>
          ) : null}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={() => {
              void submit();
            }}
            disabled={saving}
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> Salvando…
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk" /> Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
