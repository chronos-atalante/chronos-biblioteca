/**
 * Trava exponencial persistida no container do cofre: cada falha de
 * desbloqueio soma uma espera maior, e a espera sobrevive a reinício porque
 * fica em `lockUntil` (campo em claro do cabeçalho).
 */

/** Espera em ms por tentativa errada: 10 s, 30 s, 1 min, 1 h e depois 24 h. */
export const LOCKOUT_DELAYS_MS: readonly number[] = [10_000, 30_000, 60_000, 3_600_000, 86_400_000];

export const LAST_DELAY_MS = LOCKOUT_DELAYS_MS[LOCKOUT_DELAYS_MS.length - 1] ?? 86_400_000;

export interface LockoutState {
  locked: boolean;
  /** Quanto falta da espera (0 quando não está em espera). */
  retryInMs: number;
}

/** Espera aplicada à `attempts`-ésima falha (1ª falha = primeiro da lista). */
export function delayFor(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), LOCKOUT_DELAYS_MS.length) - 1;
  return LOCKOUT_DELAYS_MS[index] ?? LAST_DELAY_MS;
}

/** `lockUntil` resultante da falha que acabou de acontecer. */
export function lockUntilFor(attempts: number, now: number): number {
  return now + delayFor(attempts);
}

/** Estado da trava agora: em espera ou liberado. */
export function lockoutState(lockUntil: number, now: number): LockoutState {
  if (lockUntil > now) return { locked: true, retryInMs: lockUntil - now };
  return { locked: false, retryInMs: 0 };
}
