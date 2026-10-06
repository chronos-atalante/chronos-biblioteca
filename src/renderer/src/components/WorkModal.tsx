import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Work, WorkStatus, WorkType } from '@zero/types';
import {
  STATUS_COLORS,
  STATUS_OPTIONS,
  TYPE_COLORS,
  TYPE_OPTIONS,
  CATEGORIES,
  clampProgress,
  coverUrl,
} from '@zero/renderer/constants';
import { useMessages } from '@zero/renderer/i18n';
import Select from '@zero/renderer/components/Select';
import type { SelectOption } from '@zero/renderer/components/Select';

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
  const m = useMessages();
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
      setError(m.workModal.titleRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, title, progress: clampProgress(draft.progress) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : m.workModal.saveError);
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
    label: m.workTypes[type],
    color: TYPE_COLORS[type],
  }));

  const statusOptions: SelectOption<WorkStatus>[] = STATUS_OPTIONS.map((status) => ({
    value: status,
    label: m.workStatus[status],
    color: STATUS_COLORS[status],
  }));

  const categoryOptions: SelectOption<string>[] = [
    { value: '', label: m.common.none },
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
          <h2>{isNew ? m.workModal.newTitle : m.workModal.editTitle}</h2>
          <button className="modal-close" onClick={onClose} title={m.common.close}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          {error !== null ? <div className="banner error">{error}</div> : null}

          <div className="cover-editor">
            <div className="cover-preview">
              {url !== null ? (
                <img src={url} alt={m.workModal.coverAlt} />
              ) : (
                <i className="fa-solid fa-book-open" />
              )}
            </div>
            <div className="cover-tools">
              <p>{m.workModal.coverHelp}</p>
              <div className="quick-row">
                <button
                  className="btn small"
                  onClick={() => {
                    void chooseCover();
                  }}
                >
                  <i className="fa-regular fa-image" /> {m.workModal.chooseImage}
                </button>
                {hasCover ? (
                  <button
                    className="btn small ghost"
                    onClick={() => patch({ coverFile: undefined })}
                  >
                    {m.workModal.removeCover}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="field">
            <label>{m.workModal.titleLabel}</label>
            <input
              type="text"
              value={draft.title}
              placeholder={m.workModal.titlePlaceholder}
              autoFocus
              onChange={(event) => patch({ title: event.target.value })}
            />
          </div>

          <div className="field">
            <label>{m.workModal.synopsisLabel}</label>
            <textarea
              value={draft.synopsis}
              placeholder={m.workModal.synopsisPlaceholder}
              onChange={(event) => patch({ synopsis: event.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>{m.workModal.typeLabel}</label>
              <Select
                value={draft.type}
                options={typeOptions}
                onChange={(type) => patch({ type })}
              />
            </div>
            <div className="field">
              <label>{m.workModal.statusLabel}</label>
              <Select value={draft.status} options={statusOptions} onChange={setStatus} />
            </div>
            <div className="field">
              <label>{m.workModal.categoryLabel}</label>
              <Select
                value={draft.category ?? ''}
                options={categoryOptions}
                onChange={(category) => patch({ category: category === '' ? undefined : category })}
                searchable
              />
            </div>
            <div className="field">
              <label>{m.workModal.markerLabel}</label>
              <input
                type="text"
                value={draft.marker ?? ''}
                placeholder={m.workModal.markerPlaceholder}
                onChange={(event) => patch({ marker: event.target.value })}
              />
            </div>
          </div>

          <div className="form-row progress-card">
            <div className="field">
              <label>{m.workModal.progressLabel}</label>
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
                  title={m.workModal.decrease10}
                  onClick={() => setProgress(draft.progress - 10)}
                >
                  <i className="fa-solid fa-minus" /> 10
                </button>
                <button
                  className="btn small"
                  title={m.workModal.increase10}
                  onClick={() => setProgress(draft.progress + 10)}
                >
                  <i className="fa-solid fa-plus" /> 10
                </button>
                <span className="progress-percent">
                  {draft.status === 'concluido'
                    ? '100%'
                    : m.workModal.progressValue(draft.progress)}
                </span>
                <button
                  className="btn small success"
                  onClick={() => patch({ status: 'concluido' })}
                >
                  <i className="fa-solid fa-check" /> {m.workModal.finish}
                </button>
                <button
                  className="btn small ghost"
                  onClick={() => patch({ progress: 0, status: 'planejado' })}
                >
                  <i className="fa-solid fa-rotate-left" /> {m.workModal.reset}
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
              {confirmDelete ? m.workModal.confirmDelete : m.workModal.deleteAction}
            </button>
          ) : null}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            {m.common.cancel}
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
                <i className="fa-solid fa-spinner fa-spin" /> {m.common.saving}
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk" /> {m.common.save}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
