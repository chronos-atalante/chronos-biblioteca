import type { VaultErrorCode } from '@zero/types/vault';

/**
 * Erro de domínio do cofre. O núcleo lança este erro com o **código**; a
 * mensagem exibida é localizada por quem captura (IPC/UI), então nenhum texto
 * de erro do cofre fica embutido no domínio.
 */
export class VaultError extends Error {
  public readonly code: VaultErrorCode;
  /** Faltando da espera em ms (só para `vaultLockedOut`/`vaultWrongPassword`). */
  public readonly retryInMs: number | null;

  constructor(code: VaultErrorCode, retryInMs: number | null = null) {
    super(code);
    this.name = 'VaultError';
    this.code = code;
    this.retryInMs = retryInMs;
  }
}

export function isVaultError(error: unknown): error is VaultError {
  return error instanceof VaultError;
}
