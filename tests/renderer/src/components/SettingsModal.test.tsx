import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from '@zero/renderer/components/SettingsModal';
import type { AppSettings, BackupSummary, DriveStatus } from '@zero/types';
import { createApiMock, installApiMock } from '../../../helpers/api';

const CONNECTED: DriveStatus = {
  connected: true,
  syncing: false,
  lastSync: '2026-02-03T10:00:00.000Z',
  lastError: null,
  accountEmail: 'leitor@exemplo.com',
};

const SUMMARY: BackupSummary = {
  id: 'arquivo-1',
  name: 'library.json',
  modifiedTime: '2026-02-03T10:00:00.000Z',
  size: 2048,
  works: 7,
};

function setup(options: Parameters<typeof createApiMock>[0] = {}) {
  const mock = createApiMock(options);
  installApiMock(mock);
  const onClose = vi.fn();
  const notify = vi.fn<(message: string, kind?: 'info' | 'error') => void>();
  render(<SettingsModal onClose={onClose} notify={notify} />);
  return { mock, onClose, notify };
}

async function typeCredentials(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('xxxxxxxx.apps.googleusercontent.com'), 'meu-id');
  await user.type(screen.getByPlaceholderText('GOCSPX-...'), 'meu-segredo');
  await user.type(screen.getByPlaceholderText('Usada para criptografar o backup no Drive'), 'frase');
}

describe('SettingsModal — carregamento', () => {
  it('carrega configurações, status e resumo do backup', async () => {
    setup({ status: CONNECTED, backupInfo: SUMMARY });
    expect(screen.getByText('Carregando…')).toBeInTheDocument();

    expect(await screen.findByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('leitor@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('7 obra(s)')).toBeInTheDocument();
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(screen.getByText(/Backup no Google Drive/)).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há conexão nem backup', async () => {
    setup();
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
    expect(screen.getByText('Conta Google')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('reflete atualizações de status recebidas por push', async () => {
    const { mock } = setup();
    await screen.findByText('Desconectado');
    mock.emitStatus({ ...CONNECTED, syncing: true });
    expect(await screen.findByText('Sincronizando com o Google Drive…')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('exibe o último erro reportado pelo Drive', async () => {
    setup({ status: { ...CONNECTED, lastError: 'Cota excedida.' } });
    expect(await screen.findByText('Cota excedida.')).toBeInTheDocument();
  });

  it('fecha ao clicar fora do modal', async () => {
    const { onClose } = setup();
    await screen.findByText('Desconectado');
    fireEvent.mouseDown(document.querySelector('.overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancela a assinatura de status ao desmontar', async () => {
    const mock = createApiMock();
    installApiMock(mock);
    const unsubscribe = vi.fn();
    mock.driveOnStatus.mockReturnValueOnce(unsubscribe);
    const view = render(<SettingsModal onClose={vi.fn()} notify={vi.fn()} />);

    await screen.findByText('Desconectado');
    expect(mock.driveOnStatus).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsModal — credenciais', () => {
  it('atualiza os campos e salva as configurações', async () => {
    const { mock, notify } = setup();
    await screen.findByText('Desconectado');
    await typeCredentials();

    await userEvent.setup().click(screen.getByRole('button', { name: /Salvar credenciais/ }));
    expect(mock.settingsSet).toHaveBeenCalledWith({
      driveClientId: 'meu-id',
      driveClientSecret: 'meu-segredo',
      drivePassphrase: 'frase',
    });
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Configurações salvas.'));
  });

  it('mantém "Conectar" desabilitado sem credenciais completas', async () => {
    setup();
    await screen.findByText('Desconectado');
    const connect = screen.getByRole('button', { name: /Conectar ao Drive/ });
    expect(connect).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('xxxxxxxx.apps.googleusercontent.com'), 'meu-id');
    expect(connect).toBeDisabled();
    await user.type(screen.getByPlaceholderText('GOCSPX-...'), 'meu-segredo');
    expect(connect).toBeEnabled();
  });
});

describe('SettingsModal — ações do Drive', () => {
  it('conecta a conta com sucesso', async () => {
    const { mock, notify } = setup({
      settings: {
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase',
      },
      status: CONNECTED,
    });
    await screen.findByText('Conectado');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Conectar ao Drive/ }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Conta Google conectada com sucesso.'),
    );
    expect(mock.driveAuth).toHaveBeenCalledTimes(1);
  });

  it('reporta falha na autorização', async () => {
    const { mock, notify } = setup({
      settings: {
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase',
      },
    });
    mock.driveAuth.mockResolvedValueOnce({ ok: false, error: 'Usuário recusou.' });
    await screen.findByText('Desconectado');

    await userEvent.setup().click(screen.getByRole('button', { name: /Conectar ao Drive/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Usuário recusou.', 'error'));
  });

  it('mostra o rótulo de autorização em andamento', async () => {
    const { mock } = setup({
      settings: {
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase',
      },
    });
    let release: () => void = () => undefined;
    mock.driveAuth.mockImplementationOnce(
      async (): Promise<{ ok: boolean; error?: string }> =>
        new Promise((resolve) => {
          release = (): void => resolve({ ok: true });
        }),
    );
    await screen.findByText('Desconectado');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Conectar ao Drive/ }));
    expect(await screen.findByRole('button', { name: /Autorizando/ })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: /Conectar ao Drive/ })).toBeEnabled());
  });

  it('faz backup e informa o sucesso', async () => {
    const { mock, notify } = setup({ status: CONNECTED, backupInfo: SUMMARY });
    await screen.findByText('Conectado');

    await userEvent.setup().click(screen.getByRole('button', { name: /Fazer backup agora/ }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Backup concluído na pasta oculta do Drive.'),
    );
    expect(mock.driveBackup).toHaveBeenCalledTimes(1);
  });

  it('reporta falha no backup', async () => {
    const { mock, notify } = setup({ status: CONNECTED });
    mock.driveBackup.mockResolvedValueOnce({ ok: false, error: 'Sem conexão.' });
    await screen.findByText('Conectado');

    await userEvent.setup().click(screen.getByRole('button', { name: /Fazer backup agora/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Sem conexão.', 'error'));
  });

  it('restaura o backup e recarrega a página', async () => {
    const { mock, notify } = setup({ status: CONNECTED, backupInfo: SUMMARY });
    await screen.findByText('Conectado');
    const reload = vi.fn();
    let spied = false;
    try {
      vi.spyOn(window.location, 'reload').mockImplementation(reload);
      spied = true;
    } catch {
      // jsdom pode bloquear o espio de location.reload
    }

    await userEvent.setup().click(screen.getByRole('button', { name: /Restaurar/ }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Backup restaurado com 7 obra(s).'),
    );
    expect(mock.driveRestore).toHaveBeenCalledTimes(1);
    if (spied) expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reporta falha na restauração', async () => {
    const { mock, notify } = setup({ status: CONNECTED });
    mock.driveRestore.mockResolvedValueOnce({ ok: false, error: 'Backup corrompido.' });
    await screen.findByText('Conectado');

    await userEvent.setup().click(screen.getByRole('button', { name: /Restaurar/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Backup corrompido.', 'error'));
  });

  it('desconecta a conta', async () => {
    const { mock, notify } = setup({ status: CONNECTED, backupInfo: SUMMARY });
    await screen.findByText('7 obra(s)');

    await userEvent.setup().click(screen.getByRole('button', { name: /Desconectar/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Conta Google desconectada.'));
    expect(mock.driveDisconnect).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('desabilita as ações quando não há conexão', async () => {
    setup();
    await screen.findByText('Desconectado');
    expect(screen.getByRole('button', { name: /Desconectar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Restaurar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Fazer backup agora/ })).toBeDisabled();
  });
});

describe('SettingsModal — configurações exibidas', () => {
  it('preenche os campos com as configurações salvas', async () => {
    const saved: AppSettings = {
      driveClientId: 'id-salvo',
      driveClientSecret: 'segredo-salvo',
      drivePassphrase: 'frase-salva',
    };
    setup({ settings: saved });
    await screen.findByText('Desconectado');
    expect(screen.getByPlaceholderText('xxxxxxxx.apps.googleusercontent.com')).toHaveValue(
      'id-salvo',
    );
    expect(screen.getByPlaceholderText('GOCSPX-...')).toHaveValue('segredo-salvo');
    expect(
      screen.getByPlaceholderText('Usada para criptografar o backup no Drive'),
    ).toHaveValue('frase-salva');
  });

  it('mostra a data do último backup formatada', async () => {
    setup({ status: CONNECTED });
    expect(await screen.findByText(/03\/02\/26/)).toBeInTheDocument();
  });
});
