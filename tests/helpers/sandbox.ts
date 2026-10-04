import fs from 'fs';
import { cacheDir, configDir, dataDir } from '@zero/main/library';

const SANDBOX_VARS = ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME'] as const;

export type SandboxVar = (typeof SANDBOX_VARS)[number];

export function sandboxPath(name: SandboxVar): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente ${name} não definida pelo setup de teste.`);
  }
  return value;
}

/** Limpa e recria os diretórios usados pelo app, como o processo main faz no startup. */
export function resetSandbox(): void {
  for (const name of SANDBOX_VARS) {
    fs.rmSync(sandboxPath(name), { recursive: true, force: true });
  }
  for (const dir of [dataDir(), configDir(), cacheDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
