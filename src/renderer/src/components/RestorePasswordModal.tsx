import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { richText, useMessages } from '@zero/renderer/i18n';

interface RestorePasswordModalProps {
  onConfirm: (passphrase: string) => void;
  onCancel: () => void;
}

export default function RestorePasswordModal({
  onConfirm,
  onCancel,
}: RestorePasswordModalProps): JSX.Element {
  const m = useMessages();
  const [passphrase, setPassphrase] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-key" /> {m.restore.title}
          </h2>
          <button className="modal-close" onClick={onCancel} title={m.common.close}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">{richText(m.restore.banner)}</div>

          <div className="field">
            <label>{m.restore.passphraseLabel}</label>
            <input
              ref={inputRef}
              type="password"
              value={passphrase}
              placeholder={m.restore.passphrasePlaceholder}
              onChange={(event) => setPassphrase(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onConfirm(passphrase);
              }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <span className="spacer" />
          <button className="btn ghost" onClick={onCancel}>
            {m.common.cancel}
          </button>
          <button className="btn primary" onClick={() => onConfirm(passphrase)}>
            <i className="fa-solid fa-clock-rotate-left" /> {m.restore.action}
          </button>
        </div>
      </div>
    </div>
  );
}
