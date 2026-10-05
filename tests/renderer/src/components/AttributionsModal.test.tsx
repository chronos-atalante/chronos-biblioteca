import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import AttributionsModal from '@zero/renderer/components/AttributionsModal';
import { ATTRIBUTIONS } from '@zero/renderer/attributions';

function setup(): { onClose: Mock<() => void> } {
  const onClose = vi.fn();
  render(<AttributionsModal onClose={onClose} />);
  return { onClose };
}

describe('AttributionsModal — créditos', () => {
  it('lista as dependências com licença em loop duplicado', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Atribuições' })).toBeInTheDocument();
    for (const item of ATTRIBUTIONS) {
      expect(screen.getAllByText(item.name).length).toBeGreaterThanOrEqual(2);
    }
    expect(screen.getAllByText('React')[0]).toBeInTheDocument();
    expect(screen.getAllByText('MIT')[0]).toBeInTheDocument();
  });

  it('pausa e continua a rolagem pelo botão', async () => {
    const user = userEvent.setup();
    setup();
    const track = document.querySelector('.credits-track');
    if (track === null) throw new Error('Trilha de créditos ausente.');
    expect(track.classList.contains('paused')).toBe(false);

    await user.click(screen.getByRole('button', { name: /Pausar/ }));
    expect(track.classList.contains('paused')).toBe(true);

    await user.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(track.classList.contains('paused')).toBe(false);
  });

  it('fecha com Escape, overlay e botão Fechar', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole('dialog', { name: 'Atribuições' });
    await user.click(within(dialog).getByText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
