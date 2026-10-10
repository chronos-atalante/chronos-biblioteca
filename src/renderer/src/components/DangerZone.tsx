import { useState } from 'react';
import type { JSX } from 'react';
import { useMessages } from '@zero/renderer/i18n';

/**
 * Ações destrutivas: apagar o acervo e destruir o cofre.
 *
 * Ficam em componente próprio porque o `SettingsModal` já está perto do teto
 * de linhas do projeto, e porque as duas operações têm o mesmo formato: duas
 * etapas, com a segunda exigindo uma palavra digitada. Destruir sem
 * confirmação é um clique de engano longe demais de ser irreversível.
 *
 * Nenhuma delas toca o backup na nuvem: isso é operação à parte
 * (`drive:purge`), offercida logo abaixo quando existe conta conectada.
 */

type Pending = 'library' | 'vault' | 'cloud' | null;

interface DangerZoneProps {
  /** `true` quando há conta de nuvem conectada (habilita o purge). */
  connected: boolean;
  notify: (message: string, kind?: 'info' | 'error') => void;
  /** O acervo sumiu: a janela recarrega a grade. */
  onLibraryChanged: () => void;
  /** O cofre sumiu: a janela volta a pedir a senha mestra. */
  onVaultDestroyed: () => void;
  /** A conta foi desconectada (purge bem-sucedido): a janela relê o status. */
  onCloudChanged: () => void;
}

export default function DangerZone({
  connected,
  notify,
  onLibraryChanged,
  onVaultDestroyed,
  onCloudChanged,
}: DangerZoneProps): JSX.Element {
  const m = useMessages();
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  // Palavra de confirmação: cada operação tem a sua. Destruir o cofre e apagar
  // o acervo não são o mesmo botão, então não podem ter a mesma palavra.
  const word = pending === 'vault' ? m.danger.destroyWord : m.danger.resetWord;
  const confirmed = typed.trim().toUpperCase() === word.toUpperCase();

  const ask = (what: Pending): void => {
    setPending(what);
    setTyped('');
  };

  const cancel = (): void => {
    setPending(null);
    setTyped('');
  };

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await action();
      // Fechar sem toast de erro: não foi erro, foi o que o usuário pediu.
      cancel();
    } finally {
      setBusy(false);
    }
  };

  const submit = (): void => {
    if (pending === null || !confirmed || busy) return;
    if (pending === 'library') void run(resetLibrary);
    else if (pending === 'vault') void run(destroyVault);
    else void run(purgeCloud);
  };

  /**
   * Cada ação chama o main e só avisa por toast no caminho que interessa.
   * Apagar o que o usuário pediu não é erro: fechar o painel sem toast é o
   * resultado correto. Falha de verdade vira toast de erro e o painel fica.
   */
  const resetLibrary = async (): Promise<void> => {
    const result = await window.api.library.reset();
    if (!result.ok) {
      notify(result.code === undefined ? m.common.notFound : m.vault.errors[result.code], 'error');
      return;
    }
    notify(m.danger.libraryReset);
    onLibraryChanged();
  };

  const destroyVault = async (): Promise<void> => {
    const result = await window.api.vault.destroy();
    if (!result.ok) {
      notify(m.vault.errors[result.code], 'error');
      return;
    }
    notify(m.danger.vaultDestroyed);
    onVaultDestroyed();
  };

  const purgeCloud = async (): Promise<void> => {
    const result = await window.api.drive.purge();
    if (result.ok) {
      notify(m.danger.cloudPurged);
    } else {
      // Falha parcial mostra a contagem: um "apagado" em falso é pior que erro.
      notify(result.error ?? m.settings.toastPurgeFailed, 'error');
    }
    onCloudChanged();
  };

  return (
    <div className="field">
      <label>{m.danger.zoneLabel}</label>
      <div className="banner warning">
        <i className="fa-solid fa-triangle-exclamation" /> {m.danger.zoneBody}
      </div>

      {pending === null ? (
        <div className="danger-actions">
          <button
            className="btn ghost"
            onClick={() => ask('library')}
            disabled={busy}
            title={m.danger.resetTitle}
          >
            <i className="fa-solid fa-eraser" /> {m.danger.resetAction}
          </button>
          <button
            className="btn ghost"
            onClick={() => ask('cloud')}
            disabled={busy || !connected}
            title={m.danger.purgeTitle}
          >
            <i className="fa-solid fa-cloud-arrow-up" /> {m.danger.purgeAction}
          </button>
          <button
            className="btn ghost"
            onClick={() => ask('vault')}
            disabled={busy}
            title={m.danger.destroyTitle}
          >
            <i className="fa-solid fa-vault" /> {m.danger.destroyAction}
          </button>
        </div>
      ) : (
        <div className="field">
          <div className="banner error">
            <i className="fa-solid fa-triangle-exclamation" />{' '}
            {pending === 'library'
              ? m.danger.resetConfirm
              : pending === 'vault'
                ? m.danger.destroyConfirm
                : m.danger.purgeConfirm}
          </div>
          <label htmlFor="danger-confirm">{m.danger.typeLabel(word)}</label>
          <input
            id="danger-confirm"
            type="text"
            value={typed}
            autoComplete="off"
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
          <div className="vault-row">
            <button className="btn ghost" onClick={cancel} disabled={busy}>
              {m.common.cancel}
            </button>
            <button
              className="btn primary"
              onClick={submit}
              disabled={!confirmed || busy}
              title={m.danger.irreversible}
            >
              {busy ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> {m.common.loading}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-triangle-exclamation" /> {m.danger.confirmAction}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
