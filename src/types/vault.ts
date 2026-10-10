/** Parâmetros do Argon2id gravados no container do cofre (lidos na leitura). */
export interface VaultKdfParams {
  /** Memória em KiB (16 MiB a 1 GiB na faixa aceita). */
  memoryKiB: number;
  /** Iterações (1 a 8 na faixa aceita). */
  iterations: number;
  /** Threads (1 a 8 na faixa aceita). */
  parallelism: number;
}

/**
 * Códigos de erro do cofre. O núcleo lança `VaultError` com o código; quem
 * expõe o erro ao usuário (IPC/UI) localiza a mensagem no bundle corrente.
 */
export type VaultErrorCode =
  | 'vaultExists'
  | 'vaultMissing'
  | 'vaultLocked'
  | 'vaultLockedOut'
  | 'vaultWrongPassword'
  | 'vaultTampered'
  | 'libraryTampered'
  | 'vaultDestroyed'
  | 'vaultWeakPassword'
  | 'vaultDirUnavailable'
  | 'vaultAuthCancelled';

/** Estado do cofre exposto ao renderer (`window.api.vault.status()`). */
export interface VaultStatus {
  /** O arquivo do cofre existe (ainda que esteja ilegível/adulterado). */
  exists: boolean;
  /** Há chave na sessão (cofre desbloqueado). */
  unlocked: boolean;
  /** Tentativas de desbloqueio erradas consecutivas (0 = nenhuma). */
  attempts: number;
  /** Epoch em ms até quando o desbloqueio está suspenso (0 = sem trava). */
  lockUntil: number;
}

/**
 * Resposta dos canais de cofre: **nunca lançam** (padrão do app). A falha
 * carrega o código para o renderer localizar a mensagem no bundle corrente e
 * `retryInMs` (0 = sem espera) para a contagem regressiva da trava.
 */
export type VaultResult =
  { ok: true; status: VaultStatus } | { ok: false; code: VaultErrorCode; retryInMs: number };
