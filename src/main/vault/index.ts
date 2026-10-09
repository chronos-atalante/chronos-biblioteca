export {
  createVault,
  deleteSecret,
  destroyVault,
  getSecret,
  lockVault,
  setSecret,
  unlockVault,
  vaultDir,
  vaultExists,
  vaultPath,
  vaultStatus,
} from '@zero/main/vault/vault';
export { VaultError, isVaultError } from '@zero/main/vault/errors';
export { IDLE_LOCK_MS, vaultSession } from '@zero/main/vault/session';
export { KDF_DEFAULTS, passwordProblem } from '@zero/main/vault/crypto';
export { LOCKOUT_DELAYS_MS, lockoutState } from '@zero/main/vault/lockout';
