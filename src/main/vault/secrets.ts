import { vaultSession } from '@zero/main/vault/session';
import { deleteSecret, getSecret, setSecret } from '@zero/main/vault/vault';

/**
 * Nomes canônicos dos segredos do app dentro do cofre. Cada consumidor usa
 * só estes nomes (nada de string solta), o que mantém o mapa num lugar só.
 */
export const VAULT_SECRET = {
  /** Tokens OAuth do Dropbox (`drive/state.ts`), JSON da forma `Tokens`. */
  dropboxTokens: 'dropbox.tokens',
  /** Senha de criptografia do backup (`settings.drivePassphrase`). */
  drivePassphrase: 'settings.drivePassphrase',
  /** App key alternativa (`settings.driveClientId`). */
  driveClientId: 'settings.driveClientId',
} as const;

/**
 * Informa se dá para ler e gravar no cofre agora: só com chave na sessão
 * (cofre criado ou desbloqueado nesta execução). Não toca em disco.
 */
export function vaultUnlocked(): boolean {
  return vaultSession.isUnlocked();
}

/** Lê um segredo JSON do cofre; ausente ou inválido → `null` (falha fechada). */
export function readJsonSecret<T>(name: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = getSecret(name);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Grava um segredo JSON no cofre (serialização determinística do objeto). */
export function writeJsonSecret(name: string, value: object): void {
  setSecret(name, JSON.stringify(value));
}

/** Apaga um segredo do cofre (melhor esforço: cofre ilegível não propaga). */
export function clearSecret(name: string): void {
  try {
    deleteSecret(name);
  } catch {
    // sem chave na sessão ou container ilegível: nada a apagar com segurança
  }
}
