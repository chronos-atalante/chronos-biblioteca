import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import Select from '@/components/Select';
import type { SelectOption } from '@/components/Select';

const OPTIONS: SelectOption<'a' | 'b' | 'c'>[] = [
  { value: 'a', label: 'Alpha', color: '#111111' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

function root(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('.select-root');
  if (element === null) throw new Error('select-root não encontrado.');
  return element;
}

describe('Select', () => {
  it('mostra a opção selecionada com o ponto de cor', () => {
    render(<Select value="a" options={OPTIONS} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(document.querySelector('.select-dot')).not.toBeNull();
  });

  it('mostra o placeholder quando o valor não existe nas opções', () => {
    render(<Select value="zz" options={OPTIONS} onChange={() => undefined} placeholder="Escolha" />);
    expect(screen.getByText('Escolha')).toBeInTheDocument();
  });

  it('abre o menu e seleciona uma opção', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: 'a' | 'b' | 'c') => void>();
    render(<Select value="a" options={OPTIONS} onChange={onChange} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /Alpha/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('option', { name: /Gamma/ }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('fecha o menu ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Select value="a" options={OPTIONS} onChange={() => undefined} />
        <button type="button">fora</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('alterna o menu pelo próprio gatilho', async () => {
    const user = userEvent.setup();
    render(<Select value="a" options={OPTIONS} onChange={() => undefined} />);
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navega por teclado e confirma com Enter', () => {
    const onChange = vi.fn<(value: 'a' | 'b' | 'c') => void>();
    const { container } = render(<Select value="a" options={OPTIONS} onChange={onChange} />);

    fireEvent.keyDown(root(container), { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(root(container), { key: 'ArrowDown' });
    fireEvent.keyDown(root(container), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('suporta Home, End, setas e Escape', () => {
    const onChange = vi.fn<(value: 'a' | 'b' | 'c') => void>();
    const { container } = render(<Select value="a" options={OPTIONS} onChange={onChange} />);
    const element = root(container);

    fireEvent.keyDown(element, { key: 'ArrowDown' });
    fireEvent.keyDown(element, { key: 'End' });
    fireEvent.keyDown(element, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('c');

    fireEvent.keyDown(element, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(element, { key: 'Home' });
    fireEvent.keyDown(element, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith('a');

    fireEvent.keyDown(element, { key: 'ArrowDown' });
    fireEvent.keyDown(element, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('fecha o menu ao pressionar Tab e ignorada tecla desconhecida', () => {
    const { container } = render(<Select value="a" options={OPTIONS} onChange={() => undefined} />);
    const element = root(container);

    fireEvent.keyDown(element, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(element, { key: 'a' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(element, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('sem menu aberto, seta para baixo apenas abre', () => {
    const { container } = render(<Select value="a" options={OPTIONS} onChange={() => undefined} />);
    fireEvent.keyDown(root(container), { key: 'ArrowUp' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(root(container), { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('atualiza o item ativo ao passar o mouse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: 'a' | 'b' | 'c') => void>();
    render(<Select value="a" options={OPTIONS} onChange={onChange} />);
    await user.click(screen.getByRole('button'));
    await user.hover(screen.getByRole('option', { name: /Beta/ }));
    fireEvent.click(screen.getByRole('option', { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
