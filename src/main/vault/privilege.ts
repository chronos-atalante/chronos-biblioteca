import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Resultado do pedido de autenticação para criar/reparar `/var/lib`:
 * - `ok`: o helper terminou com exit 0 (pasta pronta);
 * - `cancelled`: o usuário dispensou a caixinha de senha (pkexec 126);
 * - `failed`: não deu para sequer tentar (sem pkexec, timeout, exit 127).
 */
export type VaultSetupResult = 'ok' | 'cancelled' | 'failed';

function hasVaultOverride(): boolean {
  const dir = process.env.CHRONOS_VAULT_DIR;
  if (dir !== undefined && dir !== '') return true;
  const varLib = process.env.CHRONOS_VAR_LIB;
  return varLib !== undefined && varLib !== '';
}

/**
 * Pede autenticação de administrador para criar/reparar a estrutura de
 * `/var/lib/.chronos-biblioteca` via `pkexec`: a caixinha de senha é a do
 * próprio sistema (PolicyKit/Mint) e o app nunca vê a senha. O alvo é o
 * helper `biblioteca-setup` do pacote, que só cria diretórios fixos.
 *
 * Com override de teste/dev (`CHRONOS_VAULT_DIR`/`CHRONOS_VAR_LIB`) nunca
 * dispara (e devolve `failed`, para o chamador não insistir em loop).
 */
export function setupVaultDirectory(): VaultSetupResult {
  if (hasVaultOverride()) return 'failed';
  try {
    // Electron define process.resourcesPath; em teste/node pode não existir
    const resources = (process as { resourcesPath?: string }).resourcesPath ?? '';
    const helper = path.join(resources, 'biblioteca-setup');
    const result = spawnSync('pkexec', [helper], { timeout: 120_000 });
    if (result.status === 0) return 'ok';
    // 126 = diálogo dispensado; 127 = pkexec recusou/não achou o programa.
    return result.status === 126 ? 'cancelled' : 'failed';
  } catch {
    return 'failed';
  }
}
