import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVault, isVaultDirUnavailable, setupVaultDirectory } from '@zero/main/vault';
import { VaultError } from '@zero/main/vault/errors';
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';
import { FAST_KDF, PASSWORD } from '../helpers/vault.ts';

vi.mock('node:child_process', () => {
  const spawnSync = vi.fn();
  return { spawnSync, default: { spawnSync } };
});

const spawn = vi.mocked(spawnSync);
const env = { ...process.env };

/** Mesma forma que `mockReturnValue` aceita (overload usada pelo `privilege.ts`). */
type SpawnResult = Parameters<typeof spawn.mockReturnValue>[0];

function spawnResult(status: number | null): SpawnResult {
  const out = Buffer.alloc(0);
  return { status, signal: null, pid: 1, output: [null, out, out], stdout: out, stderr: out };
}

beforeEach(() => {
  resetSandbox();
  spawn.mockReset();
});

afterEach(() => {
  for (const name of ['CHRONOS_VAULT_DIR', 'CHRONOS_VAR_LIB'] as const) {
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
  delete (process as { resourcesPath?: string }).resourcesPath;
});

describe('setupVaultDirectory (pkexec)', () => {
  it('nunca dispara pkexec com override de teste/dev', () => {
    process.env.CHRONOS_VAULT_DIR = '/tmp/cofre-de-teste';
    expect(setupVaultDirectory()).toBe('failed');
    expect(spawn).not.toHaveBeenCalled();

    delete process.env.CHRONOS_VAULT_DIR;
    process.env.CHRONOS_VAR_LIB = '/tmp/varlib-de-teste';
    expect(setupVaultDirectory()).toBe('failed');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('chama o helper do pacote com caminho absoluto e devolve ok no exit 0', () => {
    delete process.env.CHRONOS_VAULT_DIR;
    delete process.env.CHRONOS_VAR_LIB;
    (process as { resourcesPath?: string }).resourcesPath = '/opt/Chronos Biblioteca/resources';
    spawn.mockReturnValue(spawnResult(0));

    expect(setupVaultDirectory()).toBe('ok');
    expect(spawn).toHaveBeenCalledTimes(1);
    const [command, args] = spawn.mock.calls[0] ?? [];
    expect(command).toBe('pkexec');
    expect(args).toEqual(['/opt/Chronos Biblioteca/resources/biblioteca-setup']);
  });

  it('126 é o diálogo dispensado (cancelled) e o resto é failed', () => {
    delete process.env.CHRONOS_VAULT_DIR;
    delete process.env.CHRONOS_VAR_LIB;

    spawn.mockReturnValue(spawnResult(126));
    expect(setupVaultDirectory()).toBe('cancelled');

    spawn.mockReturnValue(spawnResult(127));
    expect(setupVaultDirectory()).toBe('failed');

    spawn.mockReturnValue(spawnResult(null));
    expect(setupVaultDirectory()).toBe('failed');
  });

  it('falha (failed) quando o pkexec nem chega a rodar', () => {
    delete process.env.CHRONOS_VAULT_DIR;
    delete process.env.CHRONOS_VAR_LIB;
    spawn.mockImplementation(() => {
      throw new Error('ENOENT: pkexec ausente');
    });
    expect(setupVaultDirectory()).toBe('failed');
  });
});

describe('pasta do cofre indisponível', () => {
  it('isVaultDirUnavailable reconhece EACCES/EPERM/EROFS e o código do cofre', () => {
    expect(isVaultDirUnavailable({ code: 'EACCES' })).toBe(true);
    expect(isVaultDirUnavailable({ code: 'EPERM' })).toBe(true);
    expect(isVaultDirUnavailable({ code: 'EROFS' })).toBe(true);
    expect(isVaultDirUnavailable({ code: 'ENOENT' })).toBe(false);
    expect(isVaultDirUnavailable(new VaultError('vaultDirUnavailable'))).toBe(true);
    expect(isVaultDirUnavailable(new VaultError('vaultLocked'))).toBe(false);
  });

  it('createVault devolve vaultDirUnavailable sem tentar pkexec no sandbox', async () => {
    const base = path.join(sandboxPath('XDG_CONFIG_HOME'), 'somente-leitura');
    const parent = path.join(base, 'pai');
    const dir = path.join(parent, '.vault');
    fs.mkdirSync(base, { recursive: true });
    fs.mkdirSync(parent, { mode: 0o500 });
    process.env.CHRONOS_VAULT_DIR = dir;

    await expect(createVault(PASSWORD, FAST_KDF)).rejects.toMatchObject({
      code: 'vaultDirUnavailable',
    });
    expect(spawn).not.toHaveBeenCalled();
    expect(fs.existsSync(dir)).toBe(false);
  });
});
