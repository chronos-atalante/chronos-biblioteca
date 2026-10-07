/**
 * Trava exponencial para restauração de backup com senha errada.
 *
 * As duas primeiras falhas são livres (erro de digitação acontece); a partir
 * da terceira, cada nova falha aumenta a espera até 15 minutos, para inviabilizar
 * tentativa automática de senha pelo modal.
 *
 * O estado vive só em memória: reiniciar o app zera a trava. Isso é de
 * propósito: quem tem o blob cifrado do Dropbox brute-força fora do app (a
 * trava não ajuda lá); aqui o alvo é a sessão local, com tentativa digitada.
 * Zerar também no sucesso evita punir quem acertou a senha depois de errar.
 */
const FREE_ATTEMPTS = 2;
const PENALTY_DELAYS_SECONDS = [10, 30, 60, 300, 900];

let attempts = 0;
let lockUntil = 0;

/** Segundos até a trava liberar; 0 quando destravado. */
export function restoreLockRemainingSec(): number {
  return Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
}

/** Registra falha de senha e (a partir da 3ª) reforça a trava. */
export function registerRestoreFailure(): void {
  attempts += 1;
  if (attempts <= FREE_ATTEMPTS) return;
  const index = Math.min(attempts - FREE_ATTEMPTS - 1, PENALTY_DELAYS_SECONDS.length - 1);
  const delaySec = PENALTY_DELAYS_SECONDS[index] ?? 10;
  lockUntil = Date.now() + delaySec * 1000;
}

/** Zera tentativas e trava (sucesso ou reinício do processo). */
export function resetRestoreLock(): void {
  attempts = 0;
  lockUntil = 0;
}
