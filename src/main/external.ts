import { shell } from 'electron';

/**
 * Abre uma URL externa no navegador do sistema, apenas se for `https:`.
 *
 * Defesa em profundidade para as duas origens de URL:
 * - links do renderer (`setWindowOpenHandler`): a CSP já restringe o renderer
 *   a `'self'`, mas qualquer URL que escape daí (javascript:, file:, data:) é
 *   recusada aqui e nunca chega ao `shell.openExternal`;
 * - a URL de autorização do OAuth, montada pelo próprio app.
 *
 * URL malformada ou de outro protocolo: não abre e devolve `false`.
 */
export function openExternalSafe(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  shell.openExternal(rawUrl).catch((error: unknown) => {
    console.error('Falha ao abrir URL externa:', error);
  });
  return true;
}
