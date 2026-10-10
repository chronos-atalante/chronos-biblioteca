import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DangerZone from '@zero/renderer/components/DangerZone';
import { MessagesProvider } from '@zero/renderer/i18n';
import { createApiMock, installApiMock } from '../../../helpers/api.ts';
import type { ApiMock } from '../../../helpers/api.ts';

/**
 * A zona de risco é a única parte da interface que **apaga dados**, e ela chama
 * o main direto (é o dono do fluxo destrutivo). O teste observa a API
 * mockada, não um callback injetado.
 *
 * O que precisa estar provado é a confirmação em duas etapas: destrutivo sem a
 * segunda etapa é um clique de engano longe demais de ser irreversível.
 */

interface ZoneResult {
  mock: ApiMock;
}

function renderZone(connected = true): ZoneResult {
  const mock = createApiMock();
  installApiMock(mock);
  render(
    <MessagesProvider language="pt-BR">
      <DangerZone
        connected={connected}
        notify={vi.fn()}
        onLibraryChanged={vi.fn()}
        onVaultDestroyed={vi.fn()}
        onCloudChanged={vi.fn()}
      />
    </MessagesProvider>,
  );
  return { mock };
}

/**
 * Abre a confirmação da ação, digita a palavra e confirma. É o caminho
 * completo que a pessoa percorre, então um teste que pula a abertura não
 * estaria provando nada.
 */
async function confirm(action: RegExp, word: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: action }));
  await user.type(screen.getByLabelText(new RegExp(`Digite ${word}`)), word);
  await user.click(screen.getByRole('button', { name: /Confirmar/i }));
}

describe('DangerZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exige a palavra digitada antes de apagar a biblioteca', async () => {
    const { mock } = renderZone();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Apagar biblioteca/i }));
    // Só abrir a confirmação não apaga nada.
    expect(mock.libraryReset).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole('button', { name: /Confirmar/i });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Digite APAGAR/), 'APAGAR');
    expect(confirmButton).toBeEnabled();
  });

  it('apaga a biblioteca só depois da confirmação', async () => {
    const { mock } = renderZone();
    await confirm(/Apagar biblioteca/i, 'APAGAR');
    expect(mock.libraryReset).toHaveBeenCalledTimes(1);
  });

  it('tolera espaço em volta da palavra (copiar e colar não pode falhar)', async () => {
    const { mock } = renderZone();
    await confirm(/Apagar biblioteca/i, 'APAGAR ');
    expect(mock.libraryReset).toHaveBeenCalledTimes(1);
  });

  it('destrói o cofre com a palavra própria dele', async () => {
    const { mock } = renderZone();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Destruir cofre/i }));
    // APAGAR não vale para destruir o cofre: são operações distintas.
    const field = screen.getByLabelText(/Digite DESTRUIR/);
    await user.type(field, 'APAGAR');
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeDisabled();

    await user.clear(field);
    await user.type(field, 'DESTRUIR');
    await user.click(screen.getByRole('button', { name: /Confirmar/i }));

    expect(mock.vaultDestroy).toHaveBeenCalledTimes(1);
    expect(mock.libraryReset).not.toHaveBeenCalled();
  });

  it('cancelar não apaga nada e volta ao estado inicial', async () => {
    const { mock } = renderZone();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Apagar biblioteca/i }));
    await user.type(screen.getByLabelText(/Digite APAGAR/), 'APAGAR');
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));

    expect(mock.libraryReset).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Apagar biblioteca/i })).toBeInTheDocument();
  });

  it('o purge da nuvem fica desabilitado sem conta conectada', () => {
    renderZone(false);
    expect(screen.getByRole('button', { name: /Apagar backup/i })).toBeDisabled();
  });

  it('o purge da nuvem fica disponível com conta conectada', () => {
    renderZone(true);
    expect(screen.getByRole('button', { name: /Apagar backup/i })).toBeEnabled();
  });

  it('o purge da nuvem avisa que não há volta', async () => {
    const { mock } = renderZone();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Apagar backup/i }));
    expect(screen.getByText(/não pode ser recuperado/i)).toBeInTheDocument();
    expect(mock.drivePurge).not.toHaveBeenCalled();
  });

  it('o purge da nuvem usa a palavra APAGAR, não DESTRUIR', async () => {
    const { mock } = renderZone();
    await confirm(/Apagar backup/i, 'APAGAR');
    expect(mock.drivePurge).toHaveBeenCalledTimes(1);
  });
});
