import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import VaultModal from '@zero/renderer/components/VaultModal';
import { createApiMock, installApiMock } from '../../../helpers/api.ts';
import type { ApiMock } from '../../../helpers/api.ts';

interface SetupResult {
  mock: ApiMock;
  onClose: Mock<() => void>;
  onUnlocked: Mock<() => void>;
}

function setup(): SetupResult {
  const mock = createApiMock();
  installApiMock(mock);
  const onClose = vi.fn<() => void>();
  const onUnlocked = vi.fn<() => void>();
  return { mock, onClose, onUnlocked };
}

describe('VaultModal: criação', () => {
  it('recusa confirmação diferente sem chamar o backend', async () => {
    const { mock, onUnlocked, onClose } = setup();
    render(<VaultModal mode="create" onClose={onClose} onUnlocked={onUnlocked} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Senha mestra'), 'segredo-longo-123');
    await user.type(screen.getByLabelText('Confirmar a senha'), 'outra-senha-456');
    await user.click(screen.getByRole('button', { name: /Criar cofre/ }));

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(mock.vaultCreate).not.toHaveBeenCalled();
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('mostra o medidor de força da senha digitada', async () => {
    const { onClose, onUnlocked } = setup();
    render(<VaultModal mode="create" onClose={onClose} onUnlocked={onUnlocked} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Senha mestra'), 'abc123');
    expect(await screen.findByText('Fraca')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Senha mestra'));
    await user.type(screen.getByLabelText('Senha mestra'), 'casa-azul-7x');
    expect(await screen.findByText('Razoável')).toBeInTheDocument();
  });

  it('cria o cofre com senha válida e avisa o fluxo pendente', async () => {
    const { mock, onUnlocked, onClose } = setup();
    render(<VaultModal mode="create" onClose={onClose} onUnlocked={onUnlocked} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Senha mestra'), 'uva-preta-42-estrela');
    await user.type(screen.getByLabelText('Confirmar a senha'), 'uva-preta-42-estrela');
    await user.click(screen.getByRole('button', { name: /Criar cofre/ }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    expect(mock.vaultCreate).toHaveBeenCalledWith('uva-preta-42-estrela');
  });
});

describe('VaultModal: desbloqueio', () => {
  it('mostra o erro do backend e a espera quando a senha está errada', async () => {
    const { mock, onUnlocked, onClose } = setup();
    render(<VaultModal mode="unlock" onClose={onClose} onUnlocked={onUnlocked} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Senha mestra'), 'errada');
    await user.click(screen.getByRole('button', { name: /Desbloquear/ }));

    expect(await screen.findByText('Senha mestra incorreta.')).toBeInTheDocument();
    expect(await screen.findByText(/Aguarde 10 segundos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Desbloquear/ })).toBeDisabled();
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(mock.vaultUnlock).toHaveBeenCalledWith('errada');
  });

  it('desbloqueia com a senha certa e avisa o fluxo pendente', async () => {
    const { mock, onUnlocked, onClose } = setup();
    render(<VaultModal mode="unlock" onClose={onClose} onUnlocked={onUnlocked} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Senha mestra'), 'certa-longo-123');
    await user.click(screen.getByRole('button', { name: /Desbloquear/ }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    expect(mock.vaultUnlock).toHaveBeenCalledWith('certa-longo-123');
  });
});
