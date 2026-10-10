import { createVault, destroyVault } from '@zero/main/vault';

/** Perfil barato para a suíte: o cofre de produção usa `KDF_DEFAULTS`. */
export const FAST_KDF = { memoryKiB: 16_384, iterations: 1, parallelism: 1 };
export const PASSWORD = 'uva-preta-42-estrela';

/**
 * Cofre novo e aberto, idempotente: zera a sessão anterior e recria o arquivo
 * na sandbox (`CHRONOS_VAR_LIB`). Toda suíte que grava segredo passa por aqui
 * antes — sem cofre aberto, `saveSettings`/`persistState` lançam `vaultLocked`.
 */
export async function openTestVault(): Promise<void> {
  destroyVault();
  await createVault(PASSWORD, FAST_KDF);
}
