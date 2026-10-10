/** Janela de ociosidade que zera a chave do cofre (5 minutos). */
export const IDLE_LOCK_MS = 5 * 60_000;

/**
 * Intervalo mínimo entre dois `touch()` vindos do renderer. A atividade do
 * usuário chega a cada movimento de mouse/tecla; sem este piso, a janela de
 * ociosidade viraria uma rajada de IPC.
 */
const TOUCH_THROTTLE_MS = 30_000;

type IdleListener = () => void;

/**
 * `VaultSessionManager` (Singleton): dono único da chave-mestra em memória.
 *
 * A chave só existe aqui: `adopt` copia o buffer para dentro da instância,
 * `wipe` zera os bytes (fill de 0) antes de soltar, e o auto-lock dispara o
 * mesmo `wipe` com um aviso para o ouvinte registrado (o main usa para
 * empurrar o bloqueio ao renderer).
 *
 * **O que conta como atividade**: uso da interface, e não acesso a segredo.
 * Medir o acesso a segredo (como antes) dava o resultado oposto do que o
 * nome promete: quem editava a biblioteca por duas horas tinha o cofre
 * fechado no minuto 5 sem ter feito nada de errado, e uma única leitura de
 * segredo reiniciava a janela inteira. A biblioteca passou a ser cifrada com
 * esta chave, então a ociosidade real é o que protege o acervo.
 */
export class VaultSessionManager {
  private static instance: VaultSessionManager | null = null;
  private masterKey: Buffer | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastTouchAt = 0;
  private idleListener: IdleListener | null = null;

  private constructor() {
    // Singleton: a instância nas só em getInstance().
  }

  public static getInstance(): VaultSessionManager {
    VaultSessionManager.instance ??= new VaultSessionManager();
    return VaultSessionManager.instance;
  }

  /** Adota uma cópia da chave e (re)arma o auto-lock. */
  public adopt(key: Buffer): void {
    this.wipe();
    this.masterKey = Buffer.from(key);
    this.touch();
  }

  /**
   * Chave corrente. Ler a chave **não** conta como atividade do usuário: é o
   * main decryptando para uso interno, e tratá-lo como uso reabria a porta de
   * que o `touch()` público existe para fechar.
   */
  public key(): Buffer | null {
    return this.masterKey;
  }

  public isUnlocked(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Registra atividade do usuário e reinicia a janela de ociosidade.
   * Throttled: atividade real chega várias vezes por segundo.
   */
  public touch(): void {
    if (this.masterKey === null) return;
    const now = Date.now();
    if (now - this.lastTouchAt < TOUCH_THROTTLE_MS && this.timer !== null) return;
    this.lastTouchAt = now;
    this.arm();
  }

  /** Zera a chave em memória e desarma o timer. */
  public wipe(): void {
    this.masterKey?.fill(0);
    this.masterKey = null;
    this.lastTouchAt = 0;
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
