import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import DonateModal from '@zero/renderer/components/DonateModal';
import { DONATION_LABEL, DONATION_URL } from '@zero/renderer/donations';

function setup(): { onClose: Mock<() => void> } {
  const onClose = vi.fn();
  render(<DonateModal onClose={onClose} />);
  return { onClose };
}

describe('DonateModal: conteúdo', () => {
  it('mostra o texto e o link de doação com destino externo', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Doações' })).toBeInTheDocument();
    expect(screen.getByText(/comunidade otaku/)).toBeInTheDocument();
    expect(screen.getByText(DONATION_LABEL)).toBeInTheDocument();

    const donate = screen.getByRole('link', { name: /Doar agora/ });
    expect(donate).toHaveAttribute('href', DONATION_URL);
    expect(donate).toHaveAttribute('target', '_blank');
  });

  it('copia o link e mostra confirmação', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    const original: Clipboard | undefined = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      setup();
      await user.click(screen.getByRole('button', { name: /Copiar link/ }));
      expect(writeText).toHaveBeenCalledWith(DONATION_URL);
      expect(await screen.findByText('Copiado!')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true });
    }
  });

  it('fecha com Escape e botão Fechar', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole('dialog', { name: 'Doações' });
    await user.click(within(dialog).getByText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
