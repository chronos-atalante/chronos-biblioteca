import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { VaultContainer } from '@zero/main/vault/container';
import { decodeContainer, encodeContainer } from '@zero/main/vault/container';
import { VaultError, isVaultError } from '@zero/main/vault/errors';
import {
  createVault,
  deleteSecret,
  destroyVault,
  getSecret,
  lockVault,
  setSecret,
  unlockVault,
  vaultExists,
  vaultPath,
  vaultStatus,
} from '@zero/main/vault';
import { resetSandbox } from '../helpers/sandbox.ts';

/** Perfil barato para a suíte: o cofre de produção usa `KDF_DEFAULTS`. */
const FAST_KDF = { memoryKiB: 16_384, iterations: 1, parallelism: 1 };
const PASSWORD = 'uva-preta-42-estrela';

async function catchError(promise: Promise<unknown>): Promise<VaultError> {
  try {
    await promise;
  } catch (error) {
    if (isVaultError(error)) return error;
    throw error;
  }
  throw new Error('esperava um VaultError');
}

function catchSync(run: () => unknown): VaultError {
  try {
    run();
  } catch (error) {
    if (isVaultError(error)) return error;
    throw error;
  }
  throw new Error('esperava um VaultError');
}

/** Regrava o container com a mutação dada (simula tempo passando / estado salvo). */
function patchContainer(mutate: (container: VaultContainer) => void): void {
  const container = decodeContainer(fs.readFileSync(vaultPath()));
  if (container === null) throw new Error('container ilegível');
  mutate(container);
  fs.writeFileSync(vaultPath(), encodeContainer(container), { mode: 0o600 });
}

describe('vault: ciclo de vida do cofre', () => {
  beforeEach(() => {
    resetSandbox();
    destroyVault();
  });

  it('cria o cofre desbloqueado, com arquivo 0600 e diretório 0700', async () => {
    expect(vaultExists()).toBe(false);
    const status = await createVault(PASSWORD, FAST_KDF);
    expect(status).toEqual({ exists: true, unlocked: true, attempts: 0, lockUntil: 0 });
    expect(fs.statSync(vaultPath()).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(vaultPath())).mode & 0o777).toBe(0o700);
  });

  it('recusa senha curta ou previsível na criação', async () => {
    expect((await catchError(createVault('curta12', FAST_KDF))).code).toBe('vaultWeakPassword');
    expect((await catchError(createVault('aaaaaaaaaaaa', FAST_KDF))).code).toBe(
      'vaultWeakPassword',
    );
    expect((await catchError(createVault('abcdefghijkl', FAST_KDF))).code).toBe(
      'vaultWeakPassword',
    );
    expect(vaultExists()).toBe(false);
  });

  it('recusa criar um segundo cofre', async () => {
    await createVault(PASSWORD, FAST_KDF);
    expect((await catchError(createVault(PASSWORD, FAST_KDF))).code).toBe('vaultExists');
  });

  it('guarda, lê e apaga segredos; bloqueio derruba o acesso', async () => {
    await createVault(PASSWORD, FAST_KDF);
    setSecret('dropbox.tokens', 'tok-123');
    setSecret('settings.drivePassphrase', 'frase-de-backup');

    expect(getSecret('dropbox.tokens')).toBe('tok-123');
    expect(getSecret('settings.drivePassphrase')).toBe('frase-de-backup');
    expect(getSecret('inexistente')).toBeNull();

    // Nenhum segredo em claro no disco.
    const raw = fs.readFileSync(vaultPath(), 'utf-8');
    expect(raw).not.toContain('tok-123');
    expect(raw).not.toContain('frase-de-backup');

    expect(lockVault().unlocked).toBe(false);
    expect(catchSync(() => getSecret('dropbox.tokens')).code).toBe('vaultLocked');
    expect(catchSync(() => setSecret('a', 'b')).code).toBe('vaultLocked');

    await unlockVault(PASSWORD);
    expect(getSecret('dropbox.tokens')).toBe('tok-123');

    deleteSecret('dropbox.tokens');
    expect(getSecret('dropbox.tokens')).toBeNull();
    expect(getSecret('settings.drivePassphrase')).toBe('frase-de-backup');
    expect(() => deleteSecret('inexistente')).not.toThrow();
  });

  it('senha errada conta tentativa e aplica a espera de 10 s', async () => {
    await createVault(PASSWORD, FAST_KDF);
    lockVault();

    const wrong = await catchError(unlockVault('senha-errada-xyz'));
    expect(wrong.code).toBe('vaultWrongPassword');
    expect(wrong.retryInMs).toBe(10_000);

    const status = vaultStatus();
    expect(status.attempts).toBe(1);
    expect(status.lockUntil).toBeGreaterThan(Date.now());

    // Durante a espera nem o Argon2id roda: erro de trava com contagem.
    const lockedOut = await catchError(unlockVault(PASSWORD));
    expect(lockedOut.code).toBe('vaultLockedOut');
    expect(lockedOut.retryInMs).toBeGreaterThan(0);
    expect(lockedOut.retryInMs).toBeLessThanOrEqual(10_000);
  });

  it('segunda falha sobe a espera para 30 s e o acerto zera o contador', async () => {
    await createVault(PASSWORD, FAST_KDF);
    lockVault();

    expect((await catchError(unlockVault('senha-errada-xyz'))).retryInMs).toBe(10_000);
    patchContainer((container) => {
      container.lockUntil = 0;
    });
    const second = await catchError(unlockVault('senha-errada-xyz'));
    expect(second.code).toBe('vaultWrongPassword');
    expect(second.retryInMs).toBe(30_000);
    expect(vaultStatus().attempts).toBe(2);

    patchContainer((container) => {
      container.lockUntil = 0;
    });
    await unlockVault(PASSWORD);
    const status = vaultStatus();
    expect(status.unlocked).toBe(true);
    expect(status.attempts).toBe(0);
    expect(status.lockUntil).toBe(0);
  });

  it('a trava e as tentativas sobrevivem a um bloqueio da sessão', async () => {
    await createVault(PASSWORD, FAST_KDF);
    lockVault();
    await catchError(unlockVault('senha-errada-xyz'));
    lockVault();

    const status = vaultStatus();
    expect(status.exists).toBe(true);
    expect(status.unlocked).toBe(false);
    expect(status.attempts).toBe(1);
    expect(status.lockUntil).toBeGreaterThan(Date.now());
  });

  it('payload adulterado derruba o desbloqueio (fail-closed)', async () => {
    await createVault(PASSWORD, FAST_KDF);
    lockVault();

    const buffer = fs.readFileSync(vaultPath());
    const last = buffer.length - 1;
    buffer[last] = (buffer[last] ?? 0) ^ 0xff;
    fs.writeFileSync(vaultPath(), buffer, { mode: 0o600 });

    expect((await catchError(unlockVault(PASSWORD))).code).toBe('vaultTampered');
    expect(vaultStatus().unlocked).toBe(false);
  });

  it('arquivo de lixo no lugar do cofre vira adulterado, não exceção solta', async () => {
    fs.mkdirSync(path.dirname(vaultPath()), { recursive: true, mode: 0o700 });
    fs.writeFileSync(vaultPath(), 'isso não é um cofre', { mode: 0o600 });
    expect((await catchError(unlockVault(PASSWORD))).code).toBe('vaultTampered');
    expect(vaultStatus()).toEqual({ exists: true, unlocked: false, attempts: 0, lockUntil: 0 });
  });

  it('operações sem cofre respondem com o código certo', async () => {
    expect((await catchError(unlockVault(PASSWORD))).code).toBe('vaultMissing');
    expect(catchSync(() => getSecret('x')).code).toBe('vaultLocked');
    expect(vaultStatus()).toEqual({ exists: false, unlocked: false, attempts: 0, lockUntil: 0 });
  });

  it('destroyVault apaga o arquivo e bloqueia a sessão', async () => {
    await createVault(PASSWORD, FAST_KDF);
    expect(vaultExists()).toBe(true);
    destroyVault();
    expect(vaultExists()).toBe(false);
    expect(vaultStatus().unlocked).toBe(false);
  });
});
