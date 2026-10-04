import { app, Menu, shell } from 'electron';
import type { BrowserWindow, ContextMenuParams, MenuItemConstructorOptions } from 'electron';

/**
 * Menu da aplicação.
 *
 * O Electron cria por padrão uma barra de menus ("File Edit View Window Help") no topo da
 * janela no Linux. Aqui a barra é mantida **oculta** (e não removida): os itens continuam
 * registrados, então os atalhos de teclado (Ctrl+C/V, Ctrl+R, zoom, F11…) seguem funcionando
 * enquanto a janela usa decorações nativas do gerenciador de janelas — encaixe em cantos,
 * maximizar, redimensionar e menu de título, como em qualquer outro aplicativo do sistema.
 */

function editItems(): MenuItemConstructorOptions[] {
  return [
    { role: 'undo', label: 'Desfazer' },
    { role: 'redo', label: 'Refazer' },
    { type: 'separator' },
    { role: 'cut', label: 'Recortar' },
    { role: 'copy', label: 'Copiar' },
    { role: 'paste', label: 'Colar' },
    { role: 'delete', label: 'Excluir' },
    { type: 'separator' },
    { role: 'selectAll', label: 'Selecionar tudo' },
  ];
}

function viewItems(isDev: boolean): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [
    { role: 'reload', label: 'Recarregar' },
    { role: 'resetZoom', label: 'Tamanho real' },
    { role: 'zoomOut', label: 'Reduzir' },
    { role: 'zoomIn', label: 'Ampliar' },
    { type: 'separator' },
    { role: 'togglefullscreen', label: 'Tela cheia' },
  ];
  if (isDev) items.push({ role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' });
  return items;
}

/**
 * Template do menu da aplicação. No macOS a barra de menus fica na barra de menus do
 * sistema (comportamento nativo da plataforma), então lá o template usa os roles padrão.
 */
export function applicationMenuTemplate(isDev: boolean): MenuItemConstructorOptions[] {
  if (process.platform === 'darwin') {
    return [
      { role: 'appMenu', label: app.name },
      { role: 'editMenu', label: 'Editar' },
      { role: 'viewMenu', label: 'Exibir' },
      { role: 'windowMenu', label: 'Janela' },
    ];
  }
  return [
    { label: 'Editar', submenu: editItems() },
    { label: 'Exibir', submenu: viewItems(isDev) },
  ];
}

/** Instala o menu da aplicação (fonte dos atalhos globais de teclado). */
export function installApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(applicationMenuTemplate(!app.isPackaged)));
}

/**
 * Esconde a barra de menus da janela sem descartar o menu: a janela passa a ter só o título
 * nativo, e `Alt` revela os menus quando o usuário precisar deles.
 */
export function hideWindowMenuBar(window: BrowserWindow): void {
  if (process.platform === 'darwin') return;
  window.setAutoHideMenuBar(true);
  window.setMenuBarVisibility(false);
}

/** Itens do menu de contexto (clique direito) para o ponto clicado na página. */
export function contextMenuTemplate(
  params: Pick<ContextMenuParams, 'isEditable' | 'selectionText' | 'linkURL'>,
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];

  if (params.isEditable) {
    items.push(...editItems());
  } else if (params.selectionText !== '') {
    items.push(
      { role: 'copy', label: 'Copiar' },
      { type: 'separator' },
      { role: 'selectAll', label: 'Selecionar tudo' },
    );
  }

  const link = params.linkURL;
  if (link !== '') {
    if (items.length > 0) items.push({ type: 'separator' });
    items.push({
      label: 'Abrir link no navegador',
      click: () => {
        void shell.openExternal(link);
      },
    });
  }

  return items;
}

/** Menu de contexto nativo no clique direito (editar, copiar, abrir link). */
export function attachContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    const items = contextMenuTemplate(params);
    if (items.length === 0) return;
    Menu.buildFromTemplate(items).popup({ window });
  });
}
