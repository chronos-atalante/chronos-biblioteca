import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type {
  AppSettings,
  BackupProviderId,
  BackupProviderInfo,
  BackupSummary,
  DriveStatus,
} from '@zero/types';
import { LANGUAGES, LANGUAGE_LABELS, messages } from '@zero/messages';
import { formatDate } from '@zero/renderer/constants';
import { richText, useLanguage, useMessages } from '@zero/renderer/i18n';
import RestorePasswordModal from '@zero/renderer/components/RestorePasswordModal';
import Select from '@zero/renderer/components/Select';
import type { SelectOption } from '@zero/renderer/components/Select';

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
}

export default function SettingsModal({
  onClose,
  notify,
  onLanguageChange,
}: SettingsModalProps): JSX.Element {
  const m = useMessages();
  const language = useLanguage();
  // driveClientId é a App key alternativa (override via settings.json, sem campo
  // na UI: a chave padrão é a embutida); driveClientSecret é legado e ignorado.
  const [settings, setSettings] = useState<AppSettings>({
    driveClientId: '',
    driveClientSecret: '',
    drivePassphrase: '',
    language: 'pt-BR',
  });
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [info, setInfo] = useState<BackupSummary | null>(null);
  const [providers, setProviders] = useState<BackupProviderInfo[]>([]);
  const [keyring, setKeyring] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptRestore, setPromptRestore] = useState(false);

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
      const [loadedSettings, driveStatus, backupSummary, providerCatalog, keyringAvailable] =
        await Promise.all([
          window.api.settings.get(),
          window.api.drive.status(),
          window.api.drive.backupInfo(),
          window.api.drive.providers(),
          window.api.settings.isKeyringAvailable(),
        ]);
      setSettings(loadedSettings);
      setStatus(driveStatus);
      setInfo(backupSummary);
      setProviders(providerCatalog);
      setKeyring(keyringAvailable);
      setLoading(false);
    };

    void loadInitial();

    return () => {
      unsubscribe();
    };
  }, []);

  const run = async (label: string, task: () => Promise<void>): Promise<void> => {
    setBusy(label);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = (): Promise<void> =>
    run('save', async () => {
      const saved = await window.api.settings.set(settings);
      setSettings(saved);
      onLanguageChange(saved.language);
      // O catálogo e o resumo voltam já no idioma novo (o main relê as config).
      await Promise.all([refreshProviders(), refreshDriveStatus()]);
      // Toast no idioma recém-salvo: o provider muda depois deste retorno.
      notify(messages(saved.language).settings.toastSaved);
    });

  const connect = (): Promise<void> =>
    run('auth', async () => {
      const result = await window.api.drive.auth();
      if (!result.ok) notify(result.error ?? m.settings.toastAuthFailed, 'error');
      else notify(m.settings.toastConnected);
      await refreshDriveStatus();
    });

  const backup = (): Promise<void> =>
    run('backup', async () => {
      const result = await window.api.drive.backup();
      if (!result.ok) notify(result.error ?? m.settings.toastBackupFailed, 'error');
      else notify(m.settings.toastBackupDone);
      await refreshDriveStatus();
    });

  const restore = (passphrase: string): Promise<void> =>
    run('restore', async () => {
      const result = await window.api.drive.restore(passphrase);
      if (!result.ok) notify(result.error ?? m.settings.toastRestoreFailed, 'error');
      else notify(m.settings.toastRestored(result.works ?? 0));
      await refreshDriveStatus();
      window.location.reload();
    });

  const disconnect = (): Promise<void> =>
    run('disconnect', async () => {
      setStatus(await window.api.drive.disconnect());
      setInfo(null);
      notify(m.settings.toastDisconnected);
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
            {keyring === false ? (
              <div className="banner warning">
                <i className="fa-solid fa-triangle-exclamation" /> {m.settings.keyringWarning}
              </div>
            ) : null}

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
    </>
  );
}
