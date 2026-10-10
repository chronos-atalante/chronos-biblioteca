import fs from 'fs';
import path from 'path';
import type { VaultKdfParams, VaultStatus } from '@zero/types/vault';
import type { VaultContainer } from '@zero/main/vault/container';
import { decodeContainer, encodeContainer, VAULT_VERSION } from '@zero/main/vault/container';
import {
  KDF_DEFAULTS,
  deriveDataKey,
  deriveKek,
  newMasterKey,
  newSalt,
  passwordProblem,
  seal,
  unseal,
} from '@zero/main/vault/crypto';
import { VaultError, isVaultError } from '@zero/main/vault/errors';
import { lockoutState, lockUntilFor } from '@zero/main/vault/lockout';
import { setupVaultDirectory } from '@zero/main/vault/privilege';
import { vaultSession } from '@zero/main/vault/session';

/**
 * Ciclo de vida do cofre: criar, desbloquear, travar e ler/gravar segredos.
 * O container mora em `<cofre>/vault.zkv`; a chave-mestra só existe na
 * sessão (`VaultSessionManager`), nunca em variável de módulo nem em disco.
 *
 * A pasta fica em `/var/lib/.chronos-biblioteca/.vault` (fora de `~`, para
 * sobreviver à limpeza do home do usuário) e é criada no `postinst`; quando
 * o app não tem permissão para criar, `createVault` pede sudo via PolicyKit.
 */

interface VaultPayload {
  version: number;
  secrets: Record<string, string>;
}

/** Diretório do cofre (`/var/lib/.chronos-biblioteca/.vault` por padrão). */
export function vaultDir(): string {
  const override = process.env.CHRONOS_VAULT_DIR;
  if (override !== undefined && override !== '') return override;
  const varLib = process.env.CHRONOS_VAR_LIB;
  const base = varLib !== undefined && varLib !== '' ? varLib : '/var/lib';
  return path.join(base, '.chronos-biblioteca', '.vault');
}

export function vaultPath(): string {
  return path.join(vaultDir(), 'vault.zkv');
}

export function vaultExists(): boolean {
  return fs.existsSync(vaultPath());
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code: unknown = error.code;
  return typeof code === 'string' ? code : undefined;
}

/** `EACCES`/`EPERM`/`EROFS`: dá para resolver pedindo sudo (pkexec). */
export function isVaultDirUnavailable(error: unknown): boolean {
  if (isVaultError(error)) return error.code === 'vaultDirUnavailable';
  const code = errnoCode(error);
  return code === 'EACCES' || code === 'EPERM' || code === 'EROFS';
}

/**
 * Garante a árvore do cofre com `0700`. Sem permissão de escrita lança
 * `VaultError('vaultDirUnavailable')`, que é o sinal para o chamador abrir a
 * caixinha de senha do sistema (`setupVaultDirectory`) e tentar de novo.
 */
export function ensureVaultStructure(): void {
  const dir = vaultDir();
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(dir, 0o700);
  } catch (error) {
    if (isVaultDirUnavailable(error)) throw new VaultError('vaultDirUnavailable');
    throw error;
  }
}

function readContainer(): VaultContainer | null {
  try {
    if (!fs.existsSync(vaultPath())) return null;
    return decodeContainer(fs.readFileSync(vaultPath()));
  } catch {
    return null;
  }
}

function writeContainer(container: VaultContainer): void {
  ensureVaultStructure();
  const file = vaultPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, encodeContainer(container), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * Cria a árvore do cofre. Sem permissão em `/var/lib` (máquina onde o
 * `postinst` não rodou, ou pasta removida pelo usuário), abre a caixinha de
 * senha do sistema e tenta de novo; recusada pelo usuário o código é
 * `vaultAuthCancelled`.
 */
function ensureVaultStructureWithSetup(): void {
  try {
    ensureVaultStructure();
    return;
  } catch (error) {
    if (!isVaultDirUnavailable(error)) throw error;
    const setup = setupVaultDirectory();
    if (setup === 'cancelled') throw new VaultError('vaultAuthCancelled');
    if (setup === 'failed') throw error;
    ensureVaultStructure();
  }
}

function decodePayload(data: Buffer): VaultPayload | null {
  try {
    const parsed: unknown = JSON.parse(data.toString('utf-8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('version' in parsed) || !('secrets' in parsed)) return null;
    const version: unknown = parsed.version;
    const secrets: unknown = parsed.secrets;
    if (typeof version !== 'number') return null;
    if (typeof secrets !== 'object' || secrets === null) return null;
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      if (typeof value !== 'string') return null;
      record[key] = value;
    }
    return { version, secrets: record };
  } catch {
    return null;
  }
}

function requireSessionKey(): Buffer {
  const key = vaultSession.key();
  if (key === null) throw new VaultError('vaultLocked');
  return key;
}

/** Lê e decifra o payload; falha fechada (`null` = container ilegível). */
function readPayload(container: VaultContainer, masterKey: Buffer): Record<string, string> | null {
  const plain = unseal(deriveDataKey(masterKey, container.wrap.salt), container.payload);
  if (plain === null) return null;
  const payload = decodePayload(plain);
  if (payload?.version !== VAULT_VERSION) return null;
  return payload.secrets;
}

export function vaultStatus(): VaultStatus {
  const exists = vaultExists();
  const container = exists ? readContainer() : null;
  return {
    exists,
    unlocked: vaultSession.isUnlocked(),
    attempts: container?.attempts ?? 0,
    lockUntil: container?.lockUntil ?? 0,
  };
}

/** Cria o cofre já desbloqueado. Recusa senha previsível (`vaultWeakPassword`). */
export async function createVault(
  password: string,
  params: VaultKdfParams = KDF_DEFAULTS,
): Promise<VaultStatus> {
  if (vaultExists()) throw new VaultError('vaultExists');
  if (passwordProblem(password) !== null) throw new VaultError('vaultWeakPassword');

  // A criação da estrutura pode tornar visível um cofre que já existia
  // (pasta sem permissão de listagem); rechega antes de escrever por cima.
  ensureVaultStructureWithSetup();
  if (vaultExists()) throw new VaultError('vaultExists');

  const masterKey = newMasterKey();
  const salt = newSalt();
  const kek = await deriveKek(password, salt, params);
  const wrap = { salt, ...seal(kek, masterKey) };
  const payload: VaultPayload = { version: VAULT_VERSION, secrets: {} };
  const sealed = seal(
    deriveDataKey(masterKey, salt),
    Buffer.from(JSON.stringify(payload), 'utf-8'),
  );

  writeContainer({
    version: VAULT_VERSION,
    createdAt: Date.now(),
    kdf: params,
    attempts: 0,
    lockUntil: 0,
    wrap,
    payload: sealed,
  });
  kek.fill(0);
  vaultSession.adopt(masterKey);
  masterKey.fill(0);
  return vaultStatus();
}

/**
 * Desbloqueia com a senha mestra. A trava exponencial é verificada **antes**
 * de qualquer Argon2id; senha errada soma tentativa e regrava o container.
 */
export async function unlockVault(password: string): Promise<VaultStatus> {
  if (!vaultExists()) throw new VaultError('vaultMissing');
  const container = readContainer();
  if (container === null) throw new VaultError('vaultTampered');

  const now = Date.now();
  const lockout = lockoutState(container.lockUntil, now);
  if (lockout.locked) throw new VaultError('vaultLockedOut', lockout.retryInMs);

  const kek = await deriveKek(password, container.wrap.salt, container.kdf);
  const masterKey = unseal(kek, container.wrap);
  kek.fill(0);
  if (masterKey === null) {
    const attempts = container.attempts + 1;
    const lockUntil = lockUntilFor(attempts, now);
    writeContainer({ ...container, attempts, lockUntil });
    throw new VaultError('vaultWrongPassword', lockUntil - now);
  }

  // Confirma que o payload também está íntegro antes de adotar a chave.
  const secrets = readPayload(container, masterKey);
  if (secrets === null) {
    masterKey.fill(0);
    throw new VaultError('vaultTampered');
  }

  if (container.attempts !== 0 || container.lockUntil !== 0) {
    writeContainer({ ...container, attempts: 0, lockUntil: 0 });
  }
  vaultSession.adopt(masterKey);
  masterKey.fill(0);
  return vaultStatus();
}

/** Bloqueia o cofre e zera a chave em memória. */
export function lockVault(): VaultStatus {
  vaultSession.wipe();
  return vaultStatus();
}

/** Segredo salvo, ou `null` se não existir. Exige cofre desbloqueado. */
export function getSecret(name: string): string | null {
  const masterKey = requireSessionKey();
  const container = readContainer();
  if (container === null) throw new VaultError('vaultTampered');
  const secrets = readPayload(container, masterKey);
  if (secrets === null) throw new VaultError('vaultTampered');
  return secrets[name] ?? null;
}

/** Grava (ou sobrescreve) um segredo e re-sella o container. */
export function setSecret(name: string, value: string): void {
  const masterKey = requireSessionKey();
  const container = readContainer();
  if (container === null) throw new VaultError('vaultTampered');
  const secrets = readPayload(container, masterKey);
  if (secrets === null) throw new VaultError('vaultTampered');
  const next: VaultPayload = { version: VAULT_VERSION, secrets: { ...secrets, [name]: value } };
  container.payload = seal(
    deriveDataKey(masterKey, container.wrap.salt),
    Buffer.from(JSON.stringify(next), 'utf-8'),
  );
  writeContainer(container);
}

/** Remove um segredo (remapeado no payload re-selado). */
export function deleteSecret(name: string): void {
  const masterKey = requireSessionKey();
  const container = readContainer();
  if (container === null) throw new VaultError('vaultTampered');
  const secrets = readPayload(container, masterKey);
  if (secrets === null) throw new VaultError('vaultTampered');
  if (!(name in secrets)) return;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(secrets)) {
    if (key !== name) next[key] = value;
  }
  container.payload = seal(
    deriveDataKey(masterKey, container.wrap.salt),
    Buffer.from(JSON.stringify({ version: VAULT_VERSION, secrets: next }), 'utf-8'),
  );
  writeContainer(container);
}

/** Apaga o arquivo do cofre (usado em teste e em reset controlado). */
export function destroyVault(): void {
  vaultSession.wipe();
  const file = vaultPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
