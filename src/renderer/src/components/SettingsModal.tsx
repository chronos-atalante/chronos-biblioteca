import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type {
  AppSettings,
  BackupProviderId,
  BackupProviderInfo,
  BackupSummary,
  DriveStatus,
  VaultStatus,
} from '@zero/types';
import { LANGUAGES, LANGUAGE_LABELS, messages } from '@zero/messages';
import { formatDate } from '@zero/renderer/constants';
import { richText, useLanguage, useMessages } from '@zero/renderer/i18n';
import RestorePasswordModal from '@zero/renderer/components/RestorePasswordModal';
import Select from '@zero/renderer/components/Select';
import type { SelectOption } from '@zero/renderer/components/Select';
import VaultModal from '@zero/renderer/components/VaultModal';
import DangerZone from '@zero/renderer/components/DangerZone';

/** Ícone de marca por provedor (catálogo fechado em `BackupProviderId`). */
const PROVIDER_ICONS: Record<BackupProviderId, string> = {
  dropbox: 'fa-brands fa-dropbox',
  'google-drive': 'fa-brands fa-google',
};

interface SettingsModalProps {
  onClose: () => void;
  notify: (message: string, kind?: 'info' | 'error') => void;
  /** Aplica o novo idioma na UI ao salvar (o valor volta do backend normalizado). */
  onLanguageChange: (language: AppSettings['language']) => void;
  /** Recarrega o acervo depois de uma ação destrutiva. */
  onLibraryChanged: () => void;
  /** O cofre sumiu: a janela volta a pedir senha mestra. */
  onVaultDestroyed: () => void;
}

export default function SettingsModal({
  onClose,
  notify,
  onLanguageChange,
  onLibraryChanged,
  onVaultDestroyed,
}: SettingsModalProps): JSX.Element {
  const m = useMessages();
  const language = useLanguage();
  // driveClientId é a App key alternativa (override via cofre, sem campo na
  // UI: a chave padrão é a embutida). Os segredos vêm e vão pelo cofre.
  const [settings, setSettings] = useState<AppSettings>({
    driveClientId: '',
    drivePassphrase: '',
    language: 'pt-BR',
  });
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [info, setInfo] = useState<BackupSummary | null>(null);
  const [providers, setProviders] = useState<BackupProviderInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptRestore, setPromptRestore] = useState(false);
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [vaultPrompt, setVaultPrompt] = useState<'create' | 'unlock' | null>(null);
  // Ação adiada enquanto o cofre está fechado (guardada em ref: não renderiza).
  const pendingVaultAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const refreshDriveStatus = async (): Promise<void> => {
    const [driveStatus, backupSummary] = await Promise.all([
      window.api.drive.status(),
      window.api.drive.backupInfo(),
    ]);
    setStatus(driveStatus);
    setInfo(backupSummary);
  };

  const refreshProviders = async (): Promise<void> => {
    setProviders(await window.api.drive.providers());
  };

  useEffect(() => {
    const unsubscribe = window.api.drive.onStatus((next) => setStatus(next));

    const loadInitial = async (): Promise<void> => {
      const [loadedSettings, driveStatus, backupSummary, providerCatalog, vaultStatus] =
        await Promise.all([
          window.api.settings.get(),
          window.api.drive.status(),
          window.api.drive.backupInfo(),
          window.api.drive.providers(),
          window.api.vault.status(),
        ]);
      setSettings(loadedSettings);
      setStatus(driveStatus);
      setInfo(backupSummary);
      setProviders(providerCatalog);
      setVault(vaultStatus);
      setLoading(false);
    };

    void loadInitial();

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Ponto de passagem dos fluxos que consomem segredos: sem cofre, abre a
   * criação; com cofre existente mas fechado, abre o desbloqueio. Nos dois
   * casos a ação é **adiada** e roda depois, com o cofre aberto (o app não
   * tem modo legado: sem cofre não há backup).
   */
  const ensureVault = async (then: () => void): Promise<void> => {
    const status = await window.api.vault.status();
    setVault(status);
    if (!status.exists || !status.unlocked) {
      pendingVaultAction.current = then;
      setVaultPrompt(status.exists ? 'unlock' : 'create');
      return;
    }
    then();
  };

  const afterVaultPrompt = (): void => {
    setVaultPrompt(null);
    const action = pendingVaultAction.current;
    pendingVaultAction.current = null;
    void window.api.vault.status().then(setVault);
    action?.();
  };

  const closeVault = async (): Promise<void> => {
    setVault(await window.api.vault.lock());
  };

  /**
   * Executa uma ação com o indicador de ocupado. Uma rejeição vira toast de
   * erro (o Electron embrulha rejeição de IPC em
   * `Error invoking remote method 'x': ...`, então o prefixo sai da mensagem).
   */
  const run = async (label: string, task: () => Promise<void>): Promise<void> => {
    setBusy(label);
    try {
      await task();
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const wrapped = /Error invoking remote method '[^']+': (?:Error: )?([\s\S]*)$/.exec(raw);
      notify(wrapped?.[1] ?? raw, 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = (): Promise<void> =>
    ensureVault(() => {
      void run('save', async () => {
        const saved = await window.api.settings.set(settings);
        setSettings(saved);
        onLanguageChange(saved.language);
        // O catálogo e o resumo voltam já no idioma novo (o main relê as config).
        await Promise.all([refreshProviders(), refreshDriveStatus()]);
        // Toast no idioma recém-salvo: o provider muda depois deste retorno.
        notify(messages(saved.language).settings.toastSaved);
      });
    });

  const connect = (): Promise<void> =>
    ensureVault(() => {
      void run('auth', async () => {
        const result = await window.api.drive.auth();
        if (!result.ok) notify(result.error ?? m.settings.toastAuthFailed, 'error');
        else notify(m.settings.toastConnected);
        await refreshDriveStatus();
      });
    });

  const backup = (): Promise<void> =>
    ensureVault(() => {
      void run('backup', async () => {
        const result = await window.api.drive.backup();
        if (!result.ok) notify(result.error ?? m.settings.toastBackupFailed, 'error');
        else notify(m.settings.toastBackupDone);
        await refreshDriveStatus();
      });
    });

  const restore = (passphrase: string): Promise<void> =>
    ensureVault(() => {
      void run('restore', async () => {
        const result = await window.api.drive.restore(passphrase);
        if (!result.ok) notify(result.error ?? m.settings.toastRestoreFailed, 'error');
        else notify(m.settings.toastRestored(result.works ?? 0));
        await refreshDriveStatus();
        window.location.reload();
      });
    });

  const disconnect = (): Promise<void> =>
    ensureVault(() => {
      void run('disconnect', async () => {
        setStatus(await window.api.drive.disconnect());
        setInfo(null);
        notify(m.settings.toastDisconnected);
      });
    });

  const languageOptions: SelectOption<AppSettings['language']>[] = LANGUAGES.map((item) => ({
    value: item,
    label: LANGUAGE_LABELS[item],
  }));

  const connected = status?.connected === true;
  const lastError = status?.lastError ?? '';
  const syncing = status?.syncing === true;
  const working = busy !== null;

  return (
    <>
      <div
        className="overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="modal wide">
          <div className="modal-header">
            <h2>
              <i className="fa-solid fa-gear" /> {m.settings.title}
            </h2>
            <button className="modal-close" onClick={onClose} title={m.common.close}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="modal-body">
            <div className="banner info">
              <strong>{m.settings.bannerTitle}</strong> {richText(m.settings.bannerBody)}
            </div>
            <div className="banner info">
              <i className="fa-solid fa-circle-info" /> {m.settings.translationNotice.text}
            </div>

            <div className="form-row">
              <div className="field">
                <label>{m.settings.languageLabel}</label>
                <Select
                  value={settings.language}
                  options={languageOptions}
                  onChange={(next) => setSettings({ ...settings, language: next })}
                />
              </div>
            </div>

            <div className="field">
              <label>{m.settings.providersLabel}</label>
              <ul className="provider-list">
                {providers.map((provider) => (
                  <li key={provider.id} className="provider-item">
                    <span className="provider-name">
                      <i className={PROVIDER_ICONS[provider.id]} /> {provider.label}
                    </span>
                    {provider.storageHidden ? (
                      <span className="provider-badge hidden">{m.settings.hiddenFolder}</span>
                    ) : null}
                    <span className={provider.operational ? 'provider-badge on' : 'provider-badge'}>
                      {provider.operational ? m.settings.operational : m.settings.notOperational}
                    </span>
                    <span className="help">{m.settings.backupIn(provider.storageTarget)}</span>
                    {provider.unavailableReason !== null ? (
                      <span className="help">{provider.unavailableReason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="form-row">
              <div className="field">
                <label>{m.settings.passphraseLabel}</label>
                <input
                  type="password"
                  value={settings.drivePassphrase}
                  placeholder={m.settings.passphrasePlaceholder}
                  disabled={working}
                  onChange={(event) =>
                    setSettings({ ...settings, drivePassphrase: event.target.value })
                  }
                />
                <div className="vault-row">
                  <span
                    className={`vault-badge${
                      vault === null ? '' : vault.unlocked ? ' open' : vault.exists ? ' closed' : ''
                    }`}
                  >
                    {vault === null
                      ? ''
                      : vault.unlocked
                        ? m.vault.badge.open
                        : vault.exists
                          ? m.vault.badge.closed
                          : m.vault.badge.none}
                  </span>
                  {vault !== null && !vault.exists ? (
                    <button
                      className="btn ghost"
                      onClick={() => setVaultPrompt('create')}
                      disabled={working}
                      title={m.vault.createHint}
                    >
                      <i className="fa-solid fa-vault" /> {m.vault.createAction}
                    </button>
                  ) : null}
                  {vault?.exists === true && !vault.unlocked ? (
                    <button
                      className="btn ghost"
                      onClick={() => setVaultPrompt('unlock')}
                      disabled={working}
                    >
                      <i className="fa-solid fa-unlock" /> {m.vault.unlockAction}
                    </button>
                  ) : null}
                  {vault?.unlocked === true ? (
                    <button
                      className="btn ghost"
                      onClick={() => {
                        void closeVault();
                      }}
                      disabled={working}
                    >
                      <i className="fa-solid fa-lock" /> {m.vault.closeVault}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="drive-meta">
              <div className="stat">
                <b>{connected ? m.settings.connected : m.settings.disconnected}</b>
                <span>{status?.accountEmail ?? m.settings.accountFallback}</span>
              </div>
              <div className="stat">
                <b>{formatDate(status?.lastSync ?? null, language)}</b>
                <span>{m.settings.lastBackup}</span>
              </div>
              <div className="stat">
                <b>{info?.works != null ? m.settings.worksInBackup(info.works) : '-'}</b>
                <span>{m.settings.inDropboxBackup}</span>
              </div>
            </div>

            {lastError !== '' ? <div className="banner error">{lastError}</div> : null}
            {syncing ? (
              <div className="banner info">
                <i className="fa-solid fa-spinner fa-spin" /> {m.settings.syncingBanner}
              </div>
            ) : null}

            <DangerZone
              connected={connected}
              notify={notify}
              onLibraryChanged={onLibraryChanged}
              onVaultDestroyed={onVaultDestroyed}
              onCloudChanged={() => {
                void refreshDriveStatus();
              }}
            />

            {loading ? <div className="help">{m.common.loading}</div> : null}
          </div>

          <div className="modal-footer">
            <button
              className="btn ghost"
              onClick={() => {
                void disconnect();
              }}
              disabled={!connected || working}
              title={m.settings.disconnectTitle}
            >
              <i className="fa-solid fa-link-slash" /> {m.settings.disconnectAction}
            </button>
            <span className="spacer" />
            <button
              className="btn"
              onClick={() => {
                void saveSettings();
              }}
              disabled={working}
            >
              {busy === 'save' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> {m.common.saving}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" /> {m.common.save}
                </>
              )}
            </button>
            <button
              className="btn"
              onClick={() => {
                void connect();
              }}
              disabled={working}
            >
              <i className="fa-brands fa-dropbox" />{' '}
              {busy === 'auth' ? m.settings.authorizing : m.settings.connectAction}
            </button>
            <button
              className="btn"
              onClick={() => setPromptRestore(true)}
              disabled={!connected || working}
              title={m.settings.restoreTitle}
            >
              <i className="fa-solid fa-clock-rotate-left" />{' '}
              {busy === 'restore' ? m.settings.restoring : m.settings.restoreAction}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                void backup();
              }}
              disabled={!connected || working}
            >
              <i className="fa-solid fa-cloud-arrow-up" />{' '}
              {busy === 'backup' ? m.settings.sending : m.settings.backupAction}
            </button>
            <button className="btn ghost" onClick={onClose}>
              <i className="fa-solid fa-xmark" /> {m.common.close}
            </button>
          </div>
        </div>
      </div>

      {promptRestore ? (
        <RestorePasswordModal
          onCancel={() => setPromptRestore(false)}
          onConfirm={(passphrase) => {
            setPromptRestore(false);
            void restore(passphrase);
          }}
        />
      ) : null}

      {vaultPrompt !== null ? (
        <VaultModal
          mode={vaultPrompt}
          onClose={() => {
            setVaultPrompt(null);
            pendingVaultAction.current = null;
          }}
          onUnlocked={afterVaultPrompt}
        />
      ) : null}
    </>
  );
}
