import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Diretórios XDG do app (dados, configuração, cache) e a pasta de capas.
 *
 * Módulo sem dependências de domínio: `settings`, `library` e o i18n precisam
 * localizar arquivos sem se importarem entre si (evita ciclo de imports).
 */
function xdgDir(envVar: string, fallback: string): string {
  const value = process.env[envVar];
  return value !== undefined && value !== '' ? value : path.join(os.homedir(), fallback);
}

export function dataDir(): string {
  return path.join(xdgDir('XDG_DATA_HOME', path.join('.local', 'share')), 'chronos-biblioteca');
}

export function configDir(): string {
  return path.join(xdgDir('XDG_CONFIG_HOME', '.config'), 'chronos-biblioteca');
}

export function cacheDir(): string {
  return path.join(xdgDir('XDG_CACHE_HOME', '.cache'), 'chronos-biblioteca');
}

export function userDataDir(): string {
  return dataDir();
}

export function coversDir(): string {
  const dir = path.join(dataDir(), 'covers');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
