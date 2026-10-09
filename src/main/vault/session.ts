/** Janela de ociosidade que zera a chave do cofre (5 minutos). */
export const IDLE_LOCK_MS = 5 * 60_000;

type IdleListener = () => void;

/**
 * `VaultSessionManager` (Singleton): dono único da chave-mestra em memória.
 *
 * A chave só existe aqui: `adopt` copia o buffer para dentro da instância,
 * `wipe` zera os bytes (fill de 0) antes de soltar, e o auto-lock de 5 minutos
 * dispara o mesmo `wipe` com um aviso para o ouvinte registrado (o main usa
 * para empurrar o bloqueio ao renderer).
 */
export class VaultSessionManager {
  private static instance: VaultSessionManager | null = null;
  private masterKey: Buffer | null = null;
  private timer: NodeJS.Timeout | null = null;
  private idleListener: IdleListener | null = null;

  private constructor() {
    // Singleton: a instância nasce só em getInstance().
  }

  public static getInstance(): VaultSessionManager {
    VaultSessionManager.instance ??= new VaultSessionManager();
    return VaultSessionManager.instance;
  }

  /** Adota uma cópia da chave e (re)arma o auto-lock. */
  public adopt(key: Buffer): void {
    this.wipe();
    this.masterKey = Buffer.from(key);
    this.arm();
  }

  /** Chave corrente (toca o timer de ociosidade); `null` se bloqueado. */
  public key(): Buffer | null {
    if (this.masterKey !== null) this.touch();
    return this.masterKey;
  }

  public isUnlocked(): boolean {
    return this.masterKey !== null;
  }

  /** Reinicia a janela de ociosidade. */
  public touch(): void {
    if (this.masterKey !== null) this.arm();
  }

  /** Zera a chave em memória e desarma o timer. */
  public wipe(): void {
    this.masterKey?.fill(0);
    this.masterKey = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Ouvinte chamado quando o auto-lock derruba a sessão. */
  public onAutoLock(listener: IdleListener): void {
    this.idleListener = listener;
  }

  /** Encerra a sessão (chamado no `before-quit`). */
  public dispose(): void {
    this.wipe();
    this.idleListener = null;
  }

  private arm(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.wipe();
      this.idleListener?.();
    }, IDLE_LOCK_MS);
  }
}

/** Instância única do gerenciador de sessão do cofre. */
export const vaultSession = VaultSessionManager.getInstance();
