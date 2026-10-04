import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkCard from '@zero/renderer/components/WorkCard';
import { makeWork } from '../../../helpers/fixtures';

function setup(overrides: Partial<Parameters<typeof WorkCard>[0]> = {}) {
  const props = {
    work: makeWork(),
    onOpen: vi.fn(),
    onProgress: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
  const view = render(<WorkCard {...props} />);
  return { ...props, container: view.container };
}

describe('WorkCard', () => {
  it('renderiza título, tipo, status e progresso', () => {
    setup({
      work: makeWork({ title: 'Tower of God', progress: 42, type: 'manhwa', status: 'lendo' }),
    });
    expect(screen.getByText('Tower of God')).toBeInTheDocument();
    expect(screen.getByText('Manhwa')).toBeInTheDocument();
    expect(screen.getByText('Lendo')).toBeInTheDocument();
    expect(screen.getByText('Cap. 42')).toBeInTheDocument();
  });

  it('usa "Sem título" quando a obra não tem título', () => {
    setup({ work: makeWork({ title: '' }) });
    expect(screen.getByText('Sem título')).toBeInTheDocument();
  });

  it('exibe marcação e categoria quando presentes', () => {
    setup({ work: makeWork({ marker: 'Cap. 45', category: 'Isekai' }) });
    expect(screen.getByText('Cap. 45')).toBeInTheDocument();
    expect(screen.getByText('Isekai')).toBeInTheDocument();
  });

  it('oculta marcação e categoria vazias', () => {
    setup({ work: makeWork({ marker: '', category: '' }) });
    expect(screen.queryByText('Cap. 45')).not.toBeInTheDocument();
    expect(screen.queryByText('Isekai')).not.toBeInTheDocument();
  });

  it('renderiza a capa pelo protocolo cover', () => {
    setup({ work: makeWork({ coverFile: 'capa.png' }) });
    const image = screen.getByAltText('Capa de Solo Leveling');
    expect(image).toHaveAttribute('src', 'cover://app/capa.png');
    expect(image).toHaveAttribute('draggable', 'false');
  });

  it('renderiza o placeholder quando não há capa', () => {
    const { container } = setup();
    expect(container.querySelector('.cover-placeholder')).not.toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('abre a obra ao clicar no card', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText('Solo Leveling'));
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }));
  });

  it('ajusta o progresso em ±1 sem abrir o card', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ progress: 50 }) });
    await user.click(screen.getByTitle('Aumentar 1'));
    expect(props.onProgress).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 51);
    await user.click(screen.getByTitle('Diminuir 1'));
    expect(props.onProgress).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 49);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('oferece "Concluir", "Pausar" e "Cancelar" para obras em andamento', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ status: 'lendo' }) });
    await user.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(props.onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'work-1' }),
      'concluido',
    );
    await user.click(screen.getByRole('button', { name: /Pausar/ }));
    expect(props.onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'work-1' }),
      'pausado',
    );
    await user.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(props.onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'work-1' }),
      'cancelado',
    );
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('troca "Pausar" por "Retomar" quando a obra está pausada', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ status: 'pausado' }) });
    expect(screen.queryByRole('button', { name: /Pausar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retomar/ }));
    expect(props.onStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 'lendo');
    await user.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(props.onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'work-1' }),
      'concluido',
    );
  });

  it('cancelada só oferece "Retomar"', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ status: 'cancelado' }) });
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Concluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retomar/ }));
    expect(props.onStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 'lendo');
  });

  it('marca 100% e oferece reabrir para obras concluídas', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ status: 'concluido', progress: 100 }) });
    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reabrir/ }));
    expect(props.onStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 'lendo');
    expect(screen.queryByRole('button', { name: /Concluir/ })).not.toBeInTheDocument();
  });
});
