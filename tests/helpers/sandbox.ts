import fs from 'fs';
import path from 'path';
import { cacheDir, configDir, dataDir } from '@zero/main/library';
import { vaultDir } from '@zero/main/vault';

const SANDBOX_VARS = ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME'] as const;

export type SandboxVar = (typeof SANDBOX_VARS)[number];

export function sandboxPath(name: SandboxVar): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente ${name} não definida pelo setup de teste.`);
  }
  return value;
}

/** Raiz do cofre na sandbox (`CHRONOS_VAR_LIB/.chronos-biblioteca`). */
export function vaultRoot(): string {
  return path.dirname(vaultDir());
}

/** Limpa e recria os diretórios usados pelo app, como o processo main faz no startup. */
export function resetSandbox(): void {
  for (const name of SANDBOX_VARS) {
    fs.rmSync(sandboxPath(name), { recursive: true, force: true });
  }
  // O cofre mora fora do XDG: some junto (mesmo alcance do purge do .deb).
  fs.rmSync(vaultRoot(), { recursive: true, force: true });
  for (const dir of [dataDir(), configDir(), cacheDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
