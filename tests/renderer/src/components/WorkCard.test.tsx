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
    onComplete: vi.fn(),
    onReopen: vi.fn(),
    ...overrides,
  };
  render(<WorkCard {...props} />);
  return props;
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

  it('ajusta o progresso em ±10 sem abrir o card', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ progress: 50 }) });
    await user.click(screen.getByTitle('Aumentar 10%'));
    expect(props.onProgress).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 60);
    await user.click(screen.getByTitle('Diminuir 10%'));
    expect(props.onProgress).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }), 40);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('oferece "Concluir" para obras em andamento', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ status: 'lendo' }) });
    await user.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(props.onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }));
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('marca 100% e oferece reabrir para obras concluídas', async () => {
    const user = userEvent.setup();
    const props = setup({ work: makeWork({ status: 'concluido', progress: 100 }) });
    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reabrir/ }));
    expect(props.onReopen).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }));
    expect(props.onComplete).not.toHaveBeenCalled();
  });
});
