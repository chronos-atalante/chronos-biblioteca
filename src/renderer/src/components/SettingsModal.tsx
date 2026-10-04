import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { AppSettings, BackupSummary, DriveStatus } from '@zero/types';
import { formatDate } from '@zero/renderer/constants';
import RestorePasswordModal from '@zero/renderer/components/RestorePasswordModal';

interface SettingsModalProps {
  onClose: () => void;
  notify: (message: string, kind?: 'info' | 'error') => void;
}

export default function SettingsModal({ onClose, notify }: SettingsModalProps): JSX.Element {
  // driveClientId/Secret seguem no estado por compatibilidade com o backend
  // (fallback para credenciais embutidas), mas não são mais editáveis na UI.
  const [settings, setSettings] = useState<AppSettings>({
    driveClientId: '',
    driveClientSecret: '',
    drivePassphrase: '',
  });
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [info, setInfo] = useState<BackupSummary | null>(null);
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

  useEffect(() => {
    const unsubscribe = window.api.drive.onStatus((next) => setStatus(next));

    const loadInitial = async (): Promise<void> => {
      const [loadedSettings, driveStatus, backupSummary] = await Promise.all([
        window.api.settings.get(),
        window.api.drive.status(),
        window.api.drive.backupInfo(),
      ]);
      setSettings(loadedSettings);
      setStatus(driveStatus);
      setInfo(backupSummary);
      setLoading(false);
    };

    void loadInitial();

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshDriveStatus = async (): Promise<void> => {
    const [driveStatus, backupSummary] = await Promise.all([
      window.api.drive.status(),
      window.api.drive.backupInfo(),
    ]);
    setStatus(driveStatus);
    setInfo(backupSummary);
  };

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
      notify('Configurações salvas.');
    });

  const connect = (): Promise<void> =>
    run('auth', async () => {
      const result = await window.api.drive.auth();
      if (!result.ok) notify(result.error ?? 'Falha na autorização.', 'error');
      else notify('Conta Google conectada com sucesso.');
      await refreshDriveStatus();
    });

  const backup = (): Promise<void> =>
    run('backup', async () => {
      const result = await window.api.drive.backup();
      if (!result.ok) notify(result.error ?? 'Falha no backup.', 'error');
      else notify('Backup concluído na pasta oculta do Drive.');
      await refreshDriveStatus();
    });

  const restore = (passphrase: string): Promise<void> =>
    run('restore', async () => {
      const result = await window.api.drive.restore(passphrase);
      if (!result.ok) notify(result.error ?? 'Falha ao restaurar.', 'error');
      else notify(`Backup restaurado com ${result.works ?? 0} obra(s).`);
      await refreshDriveStatus();
      window.location.reload();
    });

  const disconnect = (): Promise<void> =>
    run('disconnect', async () => {
      setStatus(await window.api.drive.disconnect());
      setInfo(null);
      notify('Conta Google desconectada.');
    });

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
              <i className="fa-solid fa-gear" /> Configurações
            </h2>
            <button className="modal-close" onClick={onClose} title="Fechar">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="modal-body">
            <div className="banner info">
              <strong>Backup no Google Drive.</strong> Sua biblioteca é gravada no espaço{' '}
              <strong>oculto</strong> do Drive (<code>appDataFolder</code>): ele não aparece na
              interface do Google Drive e só é acessível por este aplicativo. Todos os arquivos
              sobem criptografados (AES-256-GCM) — defina a senha de criptografia abaixo antes do
              primeiro backup.
            </div>

            <div className="form-row">
              <div className="field">
                <label>Senha de criptografia do backup</label>
                <input
                  type="password"
                  value={settings.drivePassphrase}
                  placeholder="Usada para criptografar o backup no Drive"
                  disabled={working}
                  onChange={(event) =>
                    setSettings({ ...settings, drivePassphrase: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="drive-meta">
              <div className="stat">
                <b>{connected ? 'Conectado' : 'Desconectado'}</b>
                <span>{status?.accountEmail ?? 'Conta Google'}</span>
              </div>
              <div className="stat">
                <b>{formatDate(status?.lastSync ?? null)}</b>
                <span>Último backup</span>
              </div>
              <div className="stat">
                <b>{info?.works != null ? `${info.works} obra(s)` : '—'}</b>
                <span>No backup do Drive</span>
              </div>
            </div>

            {lastError !== '' ? <div className="banner error">{lastError}</div> : null}
            {syncing ? (
              <div className="banner info">
                <i className="fa-solid fa-spinner fa-spin" /> Sincronizando com o Google Drive…
              </div>
            ) : null}

            {loading ? <div className="help">Carregando…</div> : null}
          </div>

          <div className="modal-footer">
            <button
              className="btn ghost"
              onClick={() => {
                void disconnect();
              }}
              disabled={!connected || working}
              title="Desconecta a conta Google deste aplicativo"
            >
              <i className="fa-solid fa-link-slash" /> Desconectar
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
                  <i className="fa-solid fa-spinner fa-spin" /> Salvando…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" /> Salvar
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
              <i className="fa-brands fa-google" />{' '}
              {busy === 'auth' ? 'Autorizando…' : 'Conectar ao Drive'}
            </button>
            <button
              className="btn"
              onClick={() => setPromptRestore(true)}
              disabled={!connected || working}
              title="Baixa o backup do Drive e substitui a biblioteca atual"
            >
              <i className="fa-solid fa-clock-rotate-left" />{' '}
              {busy === 'restore' ? 'Restaurando…' : 'Restaurar'}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                void backup();
              }}
              disabled={!connected || working}
            >
              <i className="fa-solid fa-cloud-arrow-up" />{' '}
              {busy === 'backup' ? 'Enviando…' : 'Fazer backup agora'}
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
