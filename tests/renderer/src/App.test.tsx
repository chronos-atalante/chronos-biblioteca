import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import App from '@zero/renderer/App';
import type { Work } from '@zero/types';
import { createApiMock, installApiMock } from '../../helpers/api.ts';
import type { ApiMock } from '../../helpers/api.ts';
import { makeWork } from '../../helpers/fixtures.ts';

const WORKS: Work[] = [
  makeWork({
    id: 'w-lendo',
    title: 'Solo Leveling',
    status: 'lendo',
    progress: 20,
    updatedAt: '2026-03-01T00:00:00.000Z',
  }),
  makeWork({
    id: 'w-feliz',
    title: 'Tower of God',
    synopsis: 'Bam entra na torre',
    status: 'concluido',
    progress: 100,
    category: 'Ação',
    updatedAt: '2026-03-02T00:00:00.000Z',
  }),
  makeWork({
    id: 'w-plano',
    title: 'Berserk',
    status: 'planejado',
    progress: 0,
    updatedAt: '2026-03-03T00:00:00.000Z',
  }),
  makeWork({
    id: 'w-pausa',
    title: 'Naruto',
    status: 'pausado',
    progress: 50,
    updatedAt: '2026-03-04T00:00:00.000Z',
  }),
];

function setup(works: Work[] = WORKS): { mock: ApiMock; view: RenderResult } {
  const mock = createApiMock({ works });
  installApiMock(mock);
  const view = render(<App />);
  return { mock, view };
}

function statTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.stat')].map((stat) => stat.textContent);
}

function cardOf(title: string): HTMLElement {
  const element = screen.getByText(title).closest('article');
  if (element === null) throw new Error(`Card de "${title}" não encontrado.`);
  return element;
}

describe('App: carregamento e estatísticas', () => {
  it('mostra o estado de carregamento até a biblioteca chegar', async () => {
    const mock = createApiMock({ works: WORKS });
    let release: (works: Work[]) => void = () => undefined;
    mock.libraryGet.mockReturnValueOnce(
      new Promise<Work[]>((resolve) => {
        release = resolve;
      }),
    );
    installApiMock(mock);
    render(<App />);

    expect(screen.getByText('Carregando biblioteca…')).toBeInTheDocument();
    release(WORKS);
    expect(await screen.findByText(/4 obra\(s\)/)).toBeInTheDocument();
    expect(screen.queryByText('Carregando biblioteca…')).not.toBeInTheDocument();
  });

  it('calcula o resumo por status e a média', async () => {
    const { view } = setup();
    await screen.findByText(/4 obra\(s\)/);
    const stats = statTexts(view.container);
    expect(stats[0]).toBe('4Total de obras');
    expect(stats[1]).toBe('1Lendo');
    expect(stats[2]).toBe('1Concluídas');
    expect(stats[3]).toBe('1Planejadas');
    expect(stats[4]).toBe('1Pausadas');
    expect(stats[5]).toBe('0Canceladas');
    expect(stats[6]).toBe('25%Progresso médio');
  });

  it('mostra a mensagem de biblioteca vazia com atalho para a primeira obra', async () => {
    setup([]);
    expect(await screen.findByText('Sua biblioteca está vazia')).toBeInTheDocument();
    expect(
      screen.getByText('Adicione sua primeira obra: capa, título e acompanhe o progresso.'),
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: /Adicionar primeira obra/ }));
    expect(screen.getByRole('heading', { name: 'Nova obra' })).toBeInTheDocument();
  });

  it('ordena as obras da mais recente para a mais antiga', async () => {
    setup();
    await screen.findByText(/4 obra\(s\)/);
    const titles = [...document.querySelectorAll('.card-title')].map((node) => node.textContent);
    expect(titles).toEqual(['Naruto', 'Berserk', 'Tower of God', 'Solo Leveling']);
  });
});

describe('App: busca e filtros', () => {
  it('filtra por título', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.type(screen.getByPlaceholderText('Buscar por título…'), 'naruto');
    expect(screen.getByText('Naruto')).toBeInTheDocument();
    expect(screen.queryByText('Berserk')).not.toBeInTheDocument();
    expect(screen.getByText(/1 obra\(s\)/)).toBeInTheDocument();
  });

  it('filtra por sinopse e categoria', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);
    const search = (): HTMLElement => screen.getByPlaceholderText('Buscar por título…');

    await user.type(search(), 'torre');
    expect(screen.getByText('Tower of God')).toBeInTheDocument();
    expect(screen.queryByText('Naruto')).not.toBeInTheDocument();

    await user.clear(search());
    await user.type(search(), 'ação');
    expect(screen.getByText('Tower of God')).toBeInTheDocument();
    expect(screen.queryByText('Solo Leveling')).not.toBeInTheDocument();
  });

  it('filtra por status pelos atalhos do cabeçalho', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(screen.getByRole('button', { name: 'Concluídos' }));
    expect(screen.getByText('Tower of God')).toBeInTheDocument();
    expect(screen.queryByText('Solo Leveling')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pausados' }));
    expect(screen.getByText('Naruto')).toBeInTheDocument();
    expect(screen.queryByText('Tower of God')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelados' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('mostra a mensagem de nada encontrado quando o filtro não casa', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.type(screen.getByPlaceholderText('Buscar por título…'), 'inexistente');
    expect(screen.getByText('Nenhuma obra encontrada')).toBeInTheDocument();
    expect(screen.getByText('Tente outro filtro ou termo de busca.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Adicionar primeira obra/ }),
    ).not.toBeInTheDocument();
  });
});

describe('App: ações nas obras', () => {
  it('salva o novo progresso após o debounce', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Solo Leveling')).getByTitle('Aumentar 1'));
    expect(within(cardOf('Solo Leveling')).getByText('Cap. 21')).toBeInTheDocument();

    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-lendo', progress: 21 }),
    );
  });

  it('reverte o progresso com o atalho de diminuir', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Naruto')).getByTitle('Diminuir 1'));
    expect(within(cardOf('Naruto')).getByText('Cap. 49')).toBeInTheDocument();

    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-pausa', progress: 49 }),
    );
  });

  it('avisa quando o salvamento automático falha', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    mock.librarySave.mockRejectedValueOnce(new Error('disco cheio'));
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Solo Leveling')).getByTitle('Aumentar 1'));
    expect(await screen.findByText('Não foi possível salvar a obra.')).toBeInTheDocument();
  });

  it('conclui uma obra pelo card', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Solo Leveling')).getByRole('button', { name: /Concluir/ }));
    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-lendo', status: 'concluido' }),
    );
  });

  it('pausa uma obra pelo card', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Solo Leveling')).getByRole('button', { name: /Pausar/ }));
    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-lendo', status: 'pausado' }),
    );
  });

  it('cancela uma obra pelo card', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Solo Leveling')).getByRole('button', { name: /Cancelar/ }));
    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-lendo', status: 'cancelado' }),
    );
  });

  it('reabre uma obra concluída', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(within(cardOf('Tower of God')).getByRole('button', { name: /Reabrir/ }));
    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-feliz', status: 'lendo' }),
    );
  });
});

describe('App: modais', () => {
  it('abre as atribuições pelo botão do cabeçalho', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(screen.getByRole('button', { name: /Atribuições/ }));
    expect(screen.getByRole('dialog', { name: 'Atribuições' })).toBeInTheDocument();
  });

  it('abre as doações pelo botão do cabeçalho', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(screen.getByRole('button', { name: /^Doar$/ }));
    expect(screen.getByRole('dialog', { name: 'Doações' })).toBeInTheDocument();
  });

  it('abre a configuração pelo botão de engrenagem', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(screen.getByTitle('Configurações'));
    expect(screen.getByRole('heading', { name: /Configurações/ })).toBeInTheDocument();
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
  });

  it('cria uma obra pelo cabeçalho e confirma com toast', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(screen.getByRole('button', { name: /Nova obra/ }));
    await user.type(screen.getByPlaceholderText('Ex.: Solo Leveling'), 'Obra Recém-criada');
    await user.click(screen.getByRole('button', { name: /Salvar/ }));

    await waitFor(() => expect(mock.librarySave).toHaveBeenCalledTimes(1));
    expect(mock.librarySave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Obra Recém-criada' }),
    );
    expect(await screen.findByText('Obra salva.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nova obra' })).not.toBeInTheDocument();
  });

  it('edita e exclui uma obra existente', async () => {
    const user = userEvent.setup();
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);

    await user.click(screen.getByText('Berserk'));
    expect(screen.getByRole('heading', { name: 'Editar obra' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Excluir/ }));
    await user.click(screen.getByRole('button', { name: /Confirmar exclusão/ }));

    await waitFor(() => expect(mock.libraryRemove).toHaveBeenCalledWith('w-plano'));
    expect(await screen.findByText('Obra removida.')).toBeInTheDocument();
  });
});

describe('App: status do Dropbox', () => {
  it('reflete conexão, sincronização e desconexão no cabeçalho', async () => {
    const { mock } = setup();
    await screen.findByText(/4 obra\(s\)/);
    expect(screen.getByTitle('Configurações do backup no Dropbox')).toHaveTextContent(
      'Dropbox off',
    );

    mock.emitStatus({
      connected: true,
      syncing: false,
      lastSync: null,
      lastError: null,
      accountEmail: 'leitor@exemplo.com',
    });
    expect(await screen.findByText('Dropbox conectado')).toBeInTheDocument();

    mock.emitStatus({
      connected: true,
      syncing: true,
      lastSync: null,
      lastError: null,
      accountEmail: 'leitor@exemplo.com',
    });
    expect(await screen.findByText('Sincronizando…')).toBeInTheDocument();
  });

  it('descada a assinatura de status ao desmontar', async () => {
    const mock = createApiMock({ works: WORKS });
    const unsubscribe = vi.fn();
    mock.driveOnStatus.mockReturnValueOnce(unsubscribe);
    installApiMock(mock);
    const view = render(<App />);

    await screen.findByText(/4 obra\(s\)/);
    expect(mock.driveOnStatus).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
