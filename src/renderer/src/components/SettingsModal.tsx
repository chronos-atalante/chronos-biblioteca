import { useEffect, useState } from 'react'
import type { AppSettings, BackupSummary, DriveStatus } from '@shared/types'
import { formatDate } from '../constants'

interface SettingsModalProps {
  onClose: () => void
  notify: (message: string, kind?: 'info' | 'error') => void
}

export default function SettingsModal({ onClose, notify }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>({ driveClientId: '', driveClientSecret: '' })
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [info, setInfo] = useState<BackupSummary | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    void (async () => {
      const [loadedSettings, driveStatus, backupSummary] = await Promise.all([
        window.api.settings.get(),
        window.api.drive.status(),
        window.api.drive.backupInfo()
      ])
      setSettings(loadedSettings)
      setStatus(driveStatus)
      setInfo(backupSummary)
      setLoading(false)
    })()
    unsubscribe = window.api.drive.onStatus((next) => setStatus(next))
    return () => unsubscribe?.()
  }, [])

  const run = async (label: string, task: () => Promise<void>): Promise<void> => {
    setBusy(label)
    try {
      await task()
    } finally {
      setBusy(null)
    }
  }

  const saveSettings = (): Promise<void> =>
    run('save', async () => {
      const saved = await window.api.settings.set(settings)
      setSettings(saved)
      notify('Configurações salvas.')
    })

  const connect = (): Promise<void> =>
    run('auth', async () => {
      const result = await window.api.drive.auth()
      if (!result.ok) notify(result.error || 'Falha na autorização.', 'error')
      else notify('Conta Google conectada com sucesso.')
      setStatus(await window.api.drive.status())
      setInfo(await window.api.drive.backupInfo())
    })

  const backup = (): Promise<void> =>
    run('backup', async () => {
      const result = await window.api.drive.backup()
      if (!result.ok) notify(result.error || 'Falha no backup.', 'error')
      else notify('Backup concluído na pasta oculta do Drive.')
      setStatus(await window.api.drive.status())
      setInfo(await window.api.drive.backupInfo())
    })

  const restore = (): Promise<void> =>
    run('restore', async () => {
      const result = await window.api.drive.restore()
      if (!result.ok) notify(result.error || 'Falha ao restaurar.', 'error')
      else notify(`Backup restaurado com ${result.works} obra(s).`)
      setStatus(await window.api.drive.status())
      setInfo(await window.api.drive.backupInfo())
      window.location.reload()
    })

  const disconnect = (): Promise<void> =>
    run('disconnect', async () => {
      setStatus(await window.api.drive.disconnect())
      setInfo(null)
      notify('Conta Google desconectada.')
    })

  const hasCreds = Boolean(settings.driveClientId && settings.driveClientSecret)

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-header">
          <h2>Configurações</h2>
          <button className="modal-close" onClick={onClose} title="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="banner info">
            <strong>Backup no Google Drive.</strong> O aplicativo grava sua biblioteca em uma pasta oculta chamada{' '}
            <code>.webtoons-backup</code> na sua conta do Google, usando OAuth direto (sem servidor intermediário).
          </div>

          <div className="field">
            <label>Google OAuth Client ID</label>
            <input
              type="text"
              value={settings.driveClientId}
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              onChange={(event) => setSettings({ ...settings, driveClientId: event.target.value })}
            />
          </div>

          <div className="field">
            <label>Google OAuth Client Secret</label>
            <input
              type="password"
              value={settings.driveClientSecret}
              placeholder="GOCSPX-..."
              onChange={(event) => setSettings({ ...settings, driveClientSecret: event.target.value })}
            />
          </div>

          <div className="help">
            Como obter as credenciais (grátis):
            <ol>
              <li>
                Acesse o <strong>Google Cloud Console</strong> → <strong>Credenciais</strong> →{' '}
                <strong>Criar credenciais</strong> → <strong>ID do cliente OAuth</strong>.
              </li>
              <li>
                Escolha o tipo <strong>Aplicativo para computador</strong> e copie o <strong>ID do cliente</strong> e o{' '}
                <strong>Segredo do cliente</strong>.
              </li>
              <li>Se necessário, publique o app de teste no OAuth consent screen para autorizar sua própria conta.</li>
            </ol>
          </div>

          <div className="drive-meta">
            <div className="stat">
              <b>{status?.connected ? 'Conectado' : 'Desconectado'}</b>
              <span>{status?.accountEmail || 'Conta Google'}</span>
            </div>
            <div className="stat">
              <b>{formatDate(status?.lastSync ?? null)}</b>
              <span>Último backup</span>
            </div>
            <div className="stat">
              <b>{info ? `${info.works} obra(s)` : '—'}</b>
              <span>No backup do Drive</span>
            </div>
          </div>

          {status?.lastError ? <div className="banner error">{status.lastError}</div> : null}
          {status?.syncing ? <div className="banner info">Sincronizando com o Google Drive…</div> : null}

          {loading ? <div className="help">Carregando…</div> : null}
        </div>

        <div className="modal-footer">
          <button className="btn ghost" onClick={() => void disconnect()} disabled={!status?.connected || Boolean(busy)}>
            Desconectar
          </button>
          <span className="spacer" />
          <button className="btn" onClick={() => void saveSettings()} disabled={Boolean(busy)}>
            Salvar credenciais
          </button>
          <button className="btn" onClick={() => void connect()} disabled={!hasCreds || Boolean(busy)}>
            {busy === 'auth' ? 'Autorizando…' : 'Conectar ao Drive'}
          </button>
          <button
            className="btn"
            onClick={() => void restore()}
            disabled={!status?.connected || Boolean(busy)}
            title="Baixa o backup do Drive e substitui a biblioteca atual"
          >
            {busy === 'restore' ? 'Restaurando…' : 'Restaurar'}
          </button>
          <button className="btn primary" onClick={() => void backup()} disabled={!status?.connected || Boolean(busy)}>
            {busy === 'backup' ? 'Enviando…' : 'Fazer backup agora'}
          </button>
        </div>
      </div>
    </div>
  )
}
