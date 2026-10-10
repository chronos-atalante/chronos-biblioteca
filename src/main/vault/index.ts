export {
  createVault,
  deleteSecret,
  destroyVault,
  ensureVaultStructure,
  getSecret,
  isVaultDestroyed,
  isVaultDirUnavailable,
  lockVault,
  setSecret,
  unlockVault,
  vaultDir,
  vaultExists,
  vaultPath,
  vaultStatus,
} from '@zero/main/vault/vault';
export { VaultError, isVaultError } from '@zero/main/vault/errors';
export { setupVaultDirectory } from '@zero/main/vault/privilege';
export type { VaultSetupResult } from '@zero/main/vault/privilege';
export { IDLE_LOCK_MS, vaultSession } from '@zero/main/vault/session';
export { KDF_DEFAULTS, passwordProblem } from '@zero/main/vault/crypto';
export { LOCKOUT_DELAYS_MS, lockoutState } from '@zero/main/vault/lockout';
