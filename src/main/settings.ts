import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  driveClientId: '',
  driveClientSecret: ''
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const file = settingsPath()
    if (!fs.existsSync(file)) return { ...DEFAULTS }
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<AppSettings>
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const next: AppSettings = {
    driveClientId: (settings.driveClientId || '').trim(),
    driveClientSecret: (settings.driveClientSecret || '').trim()
  }
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
