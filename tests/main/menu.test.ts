import { describe, expect, it } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { app, Menu, shell } from '../mocks/electron.ts';
import {
  applicationMenuTemplate,
  contextMenuTemplate,
  installApplicationMenu,
} from '@zero/main/menu';

function rolesOf(items: MenuItemConstructorOptions[]): string[] {
  return items.flatMap((item) => {
    const role = item.role ?? '';
    const nested = Array.isArray(item.submenu) ? rolesOf(item.submenu) : [];
    return [role, ...nested].filter((entry) => entry !== '');
  });
}

describe('template do menu da aplicação', () => {
  it('expõe apenas Editar e Exibir no Linux (sem File/Help)', () => {
    expect(applicationMenuTemplate(false).map((item) => item.label)).toEqual(['Editar', 'Exibir']);
  });

  it('guarda os atalhos de edição e de exibição nos roles', () => {
    const roles = rolesOf(applicationMenuTemplate(false));
    expect(roles).toContain('undo');
    expect(roles).toContain('copy');
    expect(roles).toContain('paste');
    expect(roles).toContain('selectAll');
    expect(roles).toContain('reload');
    expect(roles).toContain('zoomIn');
    expect(roles).toContain('togglefullscreen');
  });

  it('oferece ferramentas do desenvolvedor apenas fora do pacote', () => {
    expect(rolesOf(applicationMenuTemplate(true))).toContain('toggleDevTools');
    expect(rolesOf(applicationMenuTemplate(false))).not.toContain('toggleDevTools');
  });

  it('instala o menu da aplicação no início', () => {
    app.isPackaged.mockReturnValueOnce(true);
    installApplicationMenu();
    expect(Menu.setApplicationMenu).toHaveBeenCalledTimes(1);
    expect(Menu.buildFromTemplate).toHaveBeenCalledWith(applicationMenuTemplate(false));
  });
});

describe('menu de contexto', () => {
  it('oferece edição completa em campo editável', () => {
    const roles = rolesOf(
      contextMenuTemplate({ isEditable: true, selectionText: '', linkURL: '' }),
    );
    expect(roles).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll']);
  });

  it('oferece copiar e selecionar tudo quando há seleção sem edição', () => {
    const roles = rolesOf(
      contextMenuTemplate({ isEditable: false, selectionText: 'texto', linkURL: '' }),
    );
    expect(roles).toEqual(['copy', 'selectAll']);
  });

  it('fica vazio sem edição, seleção ou link', () => {
    expect(contextMenuTemplate({ isEditable: false, selectionText: '', linkURL: '' })).toEqual([]);
  });

  it('abre link externo no navegador', () => {
    const items = contextMenuTemplate({
      isEditable: false,
      selectionText: '',
      linkURL: 'https://exemplo.com',
    });
    const open = items.at(-1);
    if (open?.click === undefined) throw new Error('Item de link ausente.');
    expect(open.label).toBe('Abrir link no navegador');
    Reflect.apply(open.click, null, []);
    expect(shell.openExternal).toHaveBeenCalledWith('https://exemplo.com');
  });
});
