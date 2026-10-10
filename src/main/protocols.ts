import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { protocol } from 'electron';
import { mimeFor, readCoverBuffer } from '@zero/main/library';

/**
 * Scheme da página do app em produção (via `protocol.handle`, no lugar de
 * `file://`, recomendado pela doc atual do Electron) e o scheme das capas.
 *
 * `registerSchemesAsPrivileged` roda na importação do módulo, antes do
 * `app.whenReady` (exigência do Electron); daí o registro ficar no topo.
 */

export const APP_SCHEME = 'chronos';
export const APP_ORIGIN = `${APP_SCHEME}://app`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cover',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/**
 * Serve a capa decifrada da biblioteca. O arquivo em disco é `.enc` (AES-256-GCM
 * com a chave do cofre), então a decifração acontece aqui, a cada requisição:
 * com o cofre fechado ou a capa ilegível, `readCoverBuffer` devolve `null` e a
 * imagem simplesmente não aparece. `basename` no nome segue sendo a barreira
 * de path traversal.
 */
export function registerCoverProtocol(): void {
  protocol.handle('cover', (request) => {
    try {
      const url = new URL(request.url);
      const name = path.basename(decodeURIComponent(url.pathname));
      if (name === '') return new Response('Não encontrado', { status: 404 });
      const buffer = readCoverBuffer(name);
      if (buffer === null) return new Response('Não encontrado', { status: 404 });
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mimeFor(name),
          'Cache-Control': 'max-age=3600',
        },
      });
    } catch {
      return new Response('Erro', { status: 500 });
    }
  });
}

/** Extensão → tipo MIME mínimo para servir a SPA local. */
function rendererMime(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve a SPA empacotada sob o scheme `chronos://`: todo `/assets/...`
 * resolve dentro de `out/renderer`, com path traversal rejeitado por
 * `path.resolve` + prefixo (`/../../../../etc/passwd` cai fora e vira 403;
 * o parser de URL do Chromium normaliza os `..` antes, então o handler
 * enxerga um caminho já relativo).
 */
export function registerAppProtocol(): void {
  const root = path.join(__dirname, '../renderer');
  protocol.handle(APP_SCHEME, (request) => {
    try {
      const u = new URL(request.url);
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      const full = path.resolve(root, rel === '' ? 'index.html' : rel);
      if (!full.startsWith(`${root}${path.sep}`)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return new Response('Não encontrado.', { status: 404 });
      }
      return new Response(new Uint8Array(fs.readFileSync(full)), {
        headers: { 'Content-Type': rendererMime(full) },
      });
    } catch {
      return new Response('Erro', { status: 500 });
    }
  });
}
