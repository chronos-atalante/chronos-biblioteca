import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { richText, useMessages } from '@zero/renderer/i18n';

type Strength = 'weak' | 'fair' | 'strong';

interface VaultModalProps {
  mode: 'create' | 'unlock';
  onClose: () => void;
  /** Chama quando o cofre ficou desbloqueado (criação ou desbloqueio OK). */
  onUnlocked: () => void;
}

/**
 * Medidor local só para feedback imediato: a autoridade é `passwordProblem`
 * no processo main, que recusa a senha previsível antes do Argon2id.
 */
function strengthOf(password: string): Strength {
  const lower = password.toLowerCase();
  const predictable =
    password.length < 12 ||
    /^(.)\1+$/.test(password) ||
    ['senha', 'password', 'chronos', 'biblioteca', 'qwerty', '123456'].some((word) =>
      lower.includes(word),
    );
  if (predictable) return 'weak';
  return password.length >= 16 ? 'strong' : 'fair';
}

export default function VaultModal({ mode, onClose, onUnlocked }: VaultModalProps): JSX.Element {
  const m = useMessages();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const locked = secondsLeft > 0;
  const canSubmit = !busy && !locked && password !== '' && (mode === 'unlock' || confirm !== '');

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    if (mode === 'create' && password !== confirm) {
      setError(m.vault.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'create'
          ? await window.api.vault.create(password)
          : await window.api.vault.unlock(password);
      if (result.ok) {
        onUnlocked();
        return;
      }
      setError(m.vault.errors[result.code]);
      if (result.retryInMs > 0) setSecondsLeft(Math.ceil(result.retryInMs / 1000));
    } finally {
      setBusy(false);
    }
  };

  const strength = strengthOf(password);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-vault" />{' '}
            {mode === 'create' ? m.vault.createTitle : m.vault.unlockTitle}
          </h2>
          <button className="modal-close" onClick={onClose} title={m.common.close}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            {richText(mode === 'create' ? m.vault.createBody : m.vault.unlockBody)}
          </div>

          <div className="field">
            <label htmlFor="vault-password">{m.vault.passwordLabel}</label>
            <input
              id="vault-password"
              ref={inputRef}
              type="password"
              value={password}
              disabled={busy || locked}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit();
              }}
            />
            {mode === 'create' && password !== '' ? (
              <div className="vault-strength">
                <span className="vault-strength-track">
                  <span className={`vault-strength-bar ${strength}`} />
                </span>
                <span className="help">{m.vault.strength[strength]}</span>
              </div>
            ) : null}
          </div>

          {mode === 'create' ? (
            <div className="field">
              <label htmlFor="vault-confirm">{m.vault.confirmLabel}</label>
              <input
                id="vault-confirm"
                type="password"
                value={confirm}
                disabled={busy || locked}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submit();
                }}
              />
              <span className="help">{m.vault.hint}</span>
            </div>
          ) : null}

          {error !== null ? (
            <div className="banner error">
              <i className="fa-solid fa-triangle-exclamation" /> {error}
            </div>
          ) : null}
          {locked ? (
            <div className="banner warning">
              <i className="fa-solid fa-clock" /> {m.vault.lockout(secondsLeft)}
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            {m.common.cancel}
          </button>
          <button
            className="btn primary"
            onClick={() => {
              void submit();
            }}
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> {m.common.loading}
              </>
            ) : mode === 'create' ? (
              <>
                <i className="fa-solid fa-vault" /> {m.vault.createAction}
              </>
            ) : (
              <>
                <i className="fa-solid fa-unlock" /> {m.vault.unlockAction}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
