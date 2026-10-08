import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import WorkModal from '@zero/renderer/components/WorkModal';
import { createApiMock, installApiMock } from '../../../helpers/api.ts';
import { makeWork } from '../../../helpers/fixtures.ts';

function setup(
  work = makeWork(),
  isNew = false,
): {
  onClose: Mock<() => void>;
  onSave: Mock<() => Promise<void>>;
  onDelete: Mock<() => Promise<void>>;
} {
  installApiMock(createApiMock());
  const onClose = vi.fn();
  const onSave = vi.fn((): Promise<void> => Promise.resolve());
  const onDelete = vi.fn((): Promise<void> => Promise.resolve());
  render(
    <WorkModal work={work} isNew={isNew} onSave={onSave} onDelete={onDelete} onClose={onClose} />,
  );
  return { onClose, onSave, onDelete };
}

function overlay(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.overlay');
  if (element === null) throw new Error('overlay não encontrado.');
  return element;
}

function modal(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.modal');
  if (element === null) throw new Error('modal não encontrado.');
  return element;
}

function progressInput(): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>('.progress-value');
  if (element === null) throw new Error('input de progresso não encontrado.');
  return element;
}

describe('WorkModal: cabeçalho e fechamento', () => {
  it('identifica uma obra nova', () => {
    setup(makeWork(), true);
    expect(screen.getByRole('heading', { name: 'Nova obra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it('identifica a edição de uma obra existente', () => {
    setup(makeWork(), false);
    expect(screen.getByRole('heading', { name: 'Editar obra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excluir/ })).toBeInTheDocument();
  });

  it('fecha pelo botão, por Cancelar e pelo Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByTitle('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('fecha ao clicar no overlay e ignora cliques dentro do modal', () => {
    const { onClose } = setup();
    fireEvent.mouseDown(modal());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(overlay());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('WorkModal: validação e salvamento', () => {
  it('exige título antes de salvar', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = setup(makeWork({ title: '' }));
    await user.click(screen.getByRole('button', { name: /Salvar/ }));
    expect(screen.getByText('Informe o título da obra.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('salva com o título aparado e fecha', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = setup(makeWork({ title: '  One Piece  ' }));
    await user.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'One Piece', id: 'work-1' }),
    );
  });

  it('mostra o erro devolvido pelo salvamento', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((): Promise<void> => Promise.reject(new Error('Sem espaço na nuvem')));
    const onClose = vi.fn();
    render(
      <WorkModal
        work={makeWork()}
        isNew
        onSave={onSave}
        onDelete={vi.fn((): Promise<void> => Promise.resolve())}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Salvar/ }));
    expect(await screen.findByText('Sem espaço na nuvem')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mostra o estado de salvando e bloqueia os botões', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onSave = vi.fn(async (): Promise<void> => pending);
    render(
      <WorkModal
        work={makeWork()}
        isNew
        onSave={onSave}
        onDelete={vi.fn((): Promise<void> => Promise.resolve())}
        onClose={vi.fn()}
      />,
    );
    const saveButton = screen.getByRole('button', { name: /Salvar/ });
    await user.click(saveButton);
    expect(await screen.findByRole('button', { name: /Salvando/ })).toBeDisabled();
    release();
    await waitFor(() => expect(saveButton).toBeEnabled());
  });
});

describe('WorkModal: campos', () => {
  it('edita título, descrição e marcação', async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(screen.getByPlaceholderText('Ex.: Solo Leveling'));
    await user.type(screen.getByPlaceholderText('Ex.: Solo Leveling'), 'Novo Título');
    await user.clear(screen.getByPlaceholderText('Escreva a descrição da obra…'));
    await user.type(screen.getByPlaceholderText('Escreva a descrição da obra…'), 'Sinopse');
    await user.type(screen.getByPlaceholderText('Cap. 45 / Vol. 3'), 'Vol. 2');

    expect(screen.getByPlaceholderText('Ex.: Solo Leveling')).toHaveValue('Novo Título');
    expect(screen.getByPlaceholderText('Escreva a descrição da obra…')).toHaveValue('Sinopse');
    expect(screen.getByPlaceholderText('Cap. 45 / Vol. 3')).toHaveValue('Vol. 2');
  });

  it('altera o tipo e o status pelos selects', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Webtoon/ }));
    await user.click(screen.getByRole('option', { name: /Mangá/ }));
    expect(screen.getByRole('button', { name: /Mangá/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lendo/ }));
    await user.click(screen.getByRole('option', { name: /Pausado/ }));
    expect(screen.getByRole('button', { name: /Pausado/ })).toBeInTheDocument();
  });

  it('escolhe e limpa a categoria', async () => {
    const user = userEvent.setup();
    setup(makeWork({ category: 'Isekai' }));
    expect(screen.getByRole('button', { name: /Isekai/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Isekai/ }));
    await user.click(screen.getByRole('option', { name: 'Romance' }));
    expect(screen.getByRole('button', { name: /Romance/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Romance/ }));
    await user.click(screen.getByRole('option', { name: 'Nenhuma' }));
    expect(screen.getByRole('button', { name: /Nenhuma/ })).toBeInTheDocument();
  });

  it('filtra as categorias enquanto digita', async () => {
    const user = userEvent.setup();
    setup(makeWork({ category: 'Isekai' }));

    await user.click(screen.getByRole('button', { name: /Isekai/ }));
    const search = screen.getByLabelText('Digite para filtrar…');
    await user.type(search, 'vampir');
    expect(screen.getByRole('option', { name: 'Vampiros' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Romance' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Vampiros' }));
    expect(screen.getByRole('button', { name: /Vampiros/ })).toBeInTheDocument();
  });

  it('normaliza o progresso digitado', () => {
    setup(makeWork({ progress: 10 }));
    const input = progressInput();

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input).toHaveValue(0);

    fireEvent.change(input, { target: { value: '47.6' } });
    expect(input).toHaveValue(48);

    fireEvent.change(input, { target: { value: '-30' } });
    expect(input).toHaveValue(0);
  });

  it('ajusta o progresso com os atalhos e mostra a leitura atual', async () => {
    const user = userEvent.setup();
    setup(makeWork({ progress: 20 }));
    await user.click(screen.getByTitle('Aumentar 10'));
    expect(screen.getByText('Cap. 30')).toBeInTheDocument();

    await user.click(screen.getByTitle('Diminuir 10'));
    expect(screen.getByText('Cap. 20')).toBeInTheDocument();
  });

  it('conclui a obra e volta a marcá-la como lendo ao mudar o progresso', async () => {
    const user = userEvent.setup();
    setup(makeWork({ progress: 20 }));
    await user.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.change(progressInput(), { target: { value: '40' } });
    expect(screen.getByText('Cap. 40')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Concluir/ })).toBeInTheDocument();
  });

  it('zera o progresso e volta para planejado', async () => {
    const user = userEvent.setup();
    setup(makeWork({ progress: 75, status: 'lendo' }));
    await user.click(screen.getByRole('button', { name: /Zerar/ }));
    expect(screen.getByText('Cap. 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Planejado/ })).toBeInTheDocument();
  });
});

describe('WorkModal: capa', () => {
  it('escolhe e remove a capa', async () => {
    const user = userEvent.setup();
    setup(makeWork({ coverFile: '' }), true);
    expect(document.querySelector('.cover-preview img')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Escolher imagem/ }));
    const image = await screen.findByAltText('Prévia da capa');
    expect(image).toHaveAttribute('src', 'cover://app/capa-escolhida.png');

    await user.click(screen.getByRole('button', { name: 'Remover capa' }));
    expect(document.querySelector('.cover-preview img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remover capa' })).not.toBeInTheDocument();
  });
});

describe('WorkModal: exclusão', () => {
  it('pede confirmação antes de excluir', async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = setup(makeWork(), false);
    await user.click(screen.getByRole('button', { name: /Excluir/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirmar exclusão/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirmar exclusão/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1' }));
  });
});
