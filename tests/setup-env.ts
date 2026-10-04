import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Isola todas as escritas (biblioteca, capas, credenciais, tokens) em um diretório
 * temporário exclusivo deste processo de teste. Precisa rodar antes do import dos
 * módulos sob teste, por isso fica em `setupFiles`.
 */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoons-biblioteca-tests-'));

process.env.XDG_DATA_HOME = path.join(root, 'data');
process.env.XDG_CONFIG_HOME = path.join(root, 'config');
process.env.XDG_CACHE_HOME = path.join(root, 'cache');
process.env.HOME = root;
delete process.env.ELECTRON_RENDERER_URL;

function cleanup(): void {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // melhor esforço: diretório temporário
  }
}

process.once('exit', cleanup);
