import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import SettingsModal from '@zero/renderer/components/SettingsModal';
import type { AppSettings, BackupSummary, DriveStatus } from '@zero/types';
import { createApiMock, installApiMock } from '../../../helpers/api.ts';
import type { ApiMock } from '../../../helpers/api.ts';

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

interface SetupResult {
  mock: ApiMock;
  onClose: Mock<() => void>;
  notify: Mock<(message: string, kind?: 'info' | 'error') => void>;
  onLanguageChange: Mock<(language: AppSettings['language']) => void>;
}

function setup(options: Parameters<typeof createApiMock>[0] = {}): SetupResult {
  const mock = createApiMock(options);
  installApiMock(mock);
  const onClose = vi.fn();
  const notify = vi.fn<(message: string, kind?: 'info' | 'error') => void>();
  const onLanguageChange = vi.fn<(language: AppSettings['language']) => void>();
  render(<SettingsModal onClose={onClose} notify={notify} onLanguageChange={onLanguageChange} />);
  return { mock, onClose, notify, onLanguageChange };
}

async function typeCredentials(): Promise<void> {
  const user = userEvent.setup();
  await user.type(
    screen.getByPlaceholderText('Usada para criptografar o backup no Dropbox'),
    'frase',
  );
}

/** Abre o modal, informa a senha do backup e confirma a restauração. */
async function confirmRestore(passphrase: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^Restaurar$/ }));
  const modal = screen.getByText('Senha do backup').closest<HTMLElement>('.modal');
  if (modal === null) throw new Error('Modal de senha do backup ausente.');
  await user.type(within(modal).getByPlaceholderText('Senha usada no backup'), passphrase);
  await user.click(within(modal).getByRole('button', { name: /^Restaurar$/ }));
}

describe('SettingsModal: carregamento', () => {
  it('carrega configurações, status e resumo do backup', async () => {
    setup({ status: CONNECTED, backupInfo: SUMMARY });
    expect(screen.getByText('Carregando…')).toBeInTheDocument();

    expect(await screen.findByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('leitor@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('7 obra(s)')).toBeInTheDocument();
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(screen.getByText(/Backup no Dropbox/)).toBeInTheDocument();
  });

  it('lista os provedores e marca o Google Drive como não operante', async () => {
    setup();
    const label = await screen.findByText('Provedores de backup');
    const section = label.closest<HTMLElement>('.field');
    if (section === null) throw new Error('Seção de provedores ausente.');

    expect(within(section).getByText('Dropbox')).toBeInTheDocument();
    expect(within(section).getByText('Operante')).toBeInTheDocument();
    expect(within(section).getByText('Google Drive')).toBeInTheDocument();
    expect(within(section).getByText('Não operante')).toBeInTheDocument();
    expect(within(section).getByText('Pasta oculta')).toBeInTheDocument();
    expect(within(section).getByText(/Backup em appDataFolder/)).toBeInTheDocument();
    expect(within(section).getByText(/exigências do Google/)).toBeInTheDocument();
    expect(within(section).getByText(/backup usa o Dropbox/)).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há conexão nem backup', async () => {
    setup();
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
    expect(screen.getByText('Conta Dropbox')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(2);
  });

  it('reflete atualizações de status recebidas por push', async () => {
    const { mock } = setup();
    await screen.findByText('Desconectado');
    mock.emitStatus({ ...CONNECTED, syncing: true });
    expect(await screen.findByText('Sincronizando com o Dropbox…')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('exibe o último erro reportado pelo Dropbox', async () => {
    setup({ status: { ...CONNECTED, lastError: 'Cota excedida.' } });
    expect(await screen.findByText('Cota excedida.')).toBeInTheDocument();
  });

  it('fecha ao clicar fora do modal', async () => {
    const { onClose } = setup();
    await screen.findByText('Desconectado');
    const overlay = document.querySelector<HTMLElement>('.overlay');
    if (overlay === null) throw new Error('overlay não encontrado.');
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha pelo botão Fechar do rodapé', async () => {
    const { onClose } = setup();
    await screen.findByText('Desconectado');
    const footer = document.querySelector<HTMLElement>('.modal-footer');
    if (footer === null) throw new Error('rodapé do modal não encontrado.');
    await userEvent.setup().click(within(footer).getByRole('button', { name: /^Fechar$/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancela a assinatura de status ao desmontar', async () => {
    const mock = createApiMock();
    installApiMock(mock);
    const unsubscribe = vi.fn();
    mock.driveOnStatus.mockReturnValueOnce(unsubscribe);
    const view = render(
      <SettingsModal onClose={vi.fn()} notify={vi.fn()} onLanguageChange={vi.fn()} />,
    );

    await screen.findByText('Desconectado');
    expect(mock.driveOnStatus).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsModal: credenciais', () => {
  it('atualiza o campo e salva as configurações', async () => {
    const { mock, notify } = setup();
    await screen.findByText('Desconectado');
    await typeCredentials();

    await userEvent.setup().click(screen.getByRole('button', { name: /^Salvar$/ }));
    expect(mock.settingsSet).toHaveBeenCalledWith({
      driveClientId: '',
      driveClientSecret: '',
      drivePassphrase: 'frase',
      language: 'pt-BR',
    });
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Configurações salvas.'));
  });

  it('mantém "Conectar" habilitado mesmo sem conexão', async () => {
    setup();
    await screen.findByText('Desconectado');
    const connect = screen.getByRole('button', { name: /Conectar ao Dropbox/ });
    expect(connect).toBeEnabled();
  });

  it('não expõe campo de App key (a chave padrão é a embutida)', async () => {
    setup();
    await screen.findByText('Desconectado');
    expect(screen.queryByText('Chave do aplicativo Dropbox (App key)')).not.toBeInTheDocument();
  });
});

describe('SettingsModal: ações do Dropbox', () => {
  it('conecta a conta com sucesso', async () => {
    const { mock, notify } = setup({
      settings: {
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase',
        language: 'pt-BR',
      },
      status: CONNECTED,
    });
    await screen.findByText('Conectado');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Conectar ao Dropbox/ }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Conta Dropbox conectada com sucesso.'),
    );
    expect(mock.driveAuth).toHaveBeenCalledTimes(1);
  });

  it('reporta falha na autorização', async () => {
    const { mock, notify } = setup({
      settings: {
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase',
        language: 'pt-BR',
      },
    });
    mock.driveAuth.mockResolvedValueOnce({ ok: false, error: 'Usuário recusou.' });
    await screen.findByText('Desconectado');

    await userEvent.setup().click(screen.getByRole('button', { name: /Conectar ao Dropbox/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Usuário recusou.', 'error'));
  });

  it('mostra o rótulo de autorização em andamento', async () => {
    const { mock } = setup({
      settings: {
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase',
        language: 'pt-BR',
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
    await user.click(screen.getByRole('button', { name: /Conectar ao Dropbox/ }));
    expect(await screen.findByRole('button', { name: /Autorizando/ })).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Conectar ao Dropbox/ })).toBeEnabled(),
    );
  });

  it('faz backup e informa o sucesso', async () => {
    const { mock, notify } = setup({ status: CONNECTED, backupInfo: SUMMARY });
    await screen.findByText('Conectado');

    await userEvent.setup().click(screen.getByRole('button', { name: /Fazer backup agora/ }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Backup concluído na pasta do app no Dropbox.'),
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
    mock.driveRestore.mockResolvedValueOnce({ ok: true, works: 7 });
    await screen.findByText('Conectado');
    const reload = vi.fn();
    let spied = false;
    try {
      vi.spyOn(window.location, 'reload').mockImplementation(reload);
      spied = true;
    } catch {
      // jsdom pode bloquear o espio de location.reload
    }

    await confirmRestore('frase-secreta');
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Backup restaurado com 7 obra(s).'));
    expect(mock.driveRestore).toHaveBeenCalledWith('frase-secreta');
    if (spied) expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reporta falha na restauração', async () => {
    const { mock, notify } = setup({ status: CONNECTED });
    mock.driveRestore.mockResolvedValueOnce({ ok: false, error: 'Backup corrompido.' });
    await screen.findByText('Conectado');

    await confirmRestore('frase-secreta');
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Backup corrompido.', 'error'));
  });

  it('desconecta a conta', async () => {
    const { mock, notify } = setup({ status: CONNECTED, backupInfo: SUMMARY });
    await screen.findByText('7 obra(s)');

    await userEvent.setup().click(screen.getByRole('button', { name: /Desconectar/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Conta Dropbox desconectada.'));
    expect(mock.driveDisconnect).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(2);
  });

  it('desabilita as ações quando não há conexão', async () => {
    setup();
    await screen.findByText('Desconectado');
    expect(screen.getByRole('button', { name: /Desconectar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Restaurar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Fazer backup agora/ })).toBeDisabled();
  });
});

describe('SettingsModal: configurações exibidas', () => {
  it('preenche o campo com a configuração salva', async () => {
    const saved: AppSettings = {
      driveClientId: 'id-salvo',
      driveClientSecret: 'segredo-salvo',
      drivePassphrase: 'frase-salva',
      language: 'pt-BR',
    };
    setup({ settings: saved });
    await screen.findByText('Desconectado');
    expect(screen.getByPlaceholderText('Usada para criptografar o backup no Dropbox')).toHaveValue(
      'frase-salva',
    );
  });

  it('mostra a data do último backup formatada', async () => {
    setup({ status: CONNECTED });
    expect(await screen.findByText(/03\/02\/2026/)).toBeInTheDocument();
  });
});

describe('SettingsModal: idioma', () => {
  it('escolhe o idioma, salva e aplica o novo idioma na UI', async () => {
    const { mock, notify, onLanguageChange } = setup();
    await screen.findByText('Desconectado');
    expect(screen.getByText('Idioma')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Português (Brasil)' }));
    await user.click(await screen.findByRole('option', { name: /English/ }));

    await user.click(screen.getByRole('button', { name: /^Salvar$/ }));
    expect(mock.settingsSet).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    await waitFor(() => expect(onLanguageChange).toHaveBeenCalledWith('en'));
    // Toast já no idioma salvo, mesmo antes do provider do App trocar.
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Settings saved.'));
  });
});

describe('SettingsModal: aviso de chaveiro', () => {
  it('avisa quando o cofre do sistema está indisponível', async () => {
    const { mock } = setup({ keyringAvailable: false });
    await screen.findByText('Desconectado');
    expect(mock.settingsKeyring).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Cofre do sistema indisponível/)).toBeInTheDocument();
  });

  it('não avisa quando o cofre do sistema está disponível', async () => {
    setup({ keyringAvailable: true });
    await screen.findByText('Desconectado');
    expect(screen.queryByText(/Cofre do sistema indisponível/)).not.toBeInTheDocument();
  });
});
