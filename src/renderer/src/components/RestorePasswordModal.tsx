import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

interface RestorePasswordModalProps {
  onConfirm: (passphrase: string) => void;
  onCancel: () => void;
}

export default function RestorePasswordModal({
  onConfirm,
  onCancel,
}: RestorePasswordModalProps): JSX.Element {
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
            <i className="fa-solid fa-key" /> Senha do backup
          </h2>
          <button className="modal-close" onClick={onCancel} title="Fechar">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            Informe a senha de criptografia usada ao <strong>fazer o backup</strong> no Google
            Drive. Ela é obrigatória para decifrar os arquivos baixados.
          </div>

          <div className="field">
            <label>Senha de criptografia</label>
            <input
              ref={inputRef}
              type="password"
              value={passphrase}
              placeholder="Senha usada no backup"
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
            Cancelar
          </button>
          <button className="btn primary" onClick={() => onConfirm(passphrase)}>
            <i className="fa-solid fa-clock-rotate-left" /> Restaurar
          </button>
        </div>
      </div>
    </div>
  );
}
