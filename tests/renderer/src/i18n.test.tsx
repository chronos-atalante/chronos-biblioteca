import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { LANGUAGES, LANGUAGE_LABELS, messages } from '@zero/messages';
import type { Language, Work } from '@zero/types';
import { MessagesProvider, richText, useMessages, useLanguage } from '@zero/renderer/i18n';
import WorkCard from '@zero/renderer/components/WorkCard';

const WORK: Work = {
  id: 'id-1',
  title: 'Solo Leveling',
  synopsis: '',
  type: 'webtoon',
  status: 'lendo',
  progress: 12,
  marker: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

/** Espelha o contexto do App: idioma fixo no provider. */
function Probe(): JSX.Element {
  const m = useMessages();
  const language = useLanguage();
  return (
    <span data-testid="probe">
      {language}:{m.workStatus.lendo}
    </span>
  );
}

describe('richText', () => {
  it('transforma negrito e código em nós React', () => {
    const { container } = render(<div>{richText('use **hoje** com `npm ci`.')}</div>);
    const strong = container.querySelector('strong');
    const code = container.querySelector('code');
    expect(strong?.textContent).toBe('hoje');
    expect(code?.textContent).toBe('npm ci');
    expect(container.textContent).toBe('use hoje com npm ci.');
  });

  it('devolve o texto puro sem marcadores', () => {
    const { container } = render(<div>{richText('sem marcação')}</div>);
    expect(container.textContent).toBe('sem marcação');
    expect(container.querySelector('strong')).toBeNull();
  });
});

describe('contexto de idioma', () => {
  it('usa pt-BR quando o componente está fora do provider (testes isolados)', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('pt-BR:Lendo');
  });

  it('troca as mensagens conforme o idioma do provider', () => {
    render(
      <MessagesProvider language="en">
        <Probe />
      </MessagesProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('en:Reading');
  });

  it('renderiza componentes inteiros no idioma do provider', () => {
    render(
      <MessagesProvider language="en">
        <WorkCard
          work={WORK}
          onOpen={() => undefined}
          onProgress={() => undefined}
          onStatus={() => undefined}
        />
      </MessagesProvider>,
    );
    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByTitle('Increase 1')).toBeInTheDocument();
    expect(screen.getByText('Webtoon')).toBeInTheDocument();
  });
});

describe('catálogo de idiomas', () => {
  it('expõe os idiomas suportados com nome nativo', () => {
    expect([...LANGUAGES]).toEqual(['pt-BR', 'en', 'ko', 'zh-CN', 'ja']);
    expect(LANGUAGE_LABELS['pt-BR']).toBe('Português (Brasil)');
    expect(LANGUAGE_LABELS.en).toBe('English');
    expect(LANGUAGE_LABELS.ko).toBe('한국어');
    expect(LANGUAGE_LABELS['zh-CN']).toBe('简体中文');
    expect(LANGUAGE_LABELS.ja).toBe('日本語');
  });

  it('devolve bundles distintos por idioma com as mesmas chaves', () => {
    const pt = messages('pt-BR');
    const en = messages('en');
    const ko = messages('ko');
    const zhCN = messages('zh-CN');
    const ja = messages('ja');
    expect(en).not.toBe(pt);
    expect(ko).not.toBe(pt);
    expect(zhCN).not.toBe(pt);
    expect(ja).not.toBe(pt);
    expect(Object.keys(en)).toEqual(Object.keys(pt));
    expect(Object.keys(ko)).toEqual(Object.keys(pt));
    expect(Object.keys(zhCN)).toEqual(Object.keys(pt));
    expect(Object.keys(ja)).toEqual(Object.keys(pt));
    const language: Language = 'en';
    expect(messages(language).app.newWork).toBe('New work');
  });

  it('traduz o app para o coreano', () => {
    const ko = messages('ko');
    expect(ko.app.newWork).toBe('새 작품');
    expect(ko.workStatus.lendo).toBe('읽는 중');
    expect(ko.workModal.progressValue(12)).toBe('12화');
    render(
      <MessagesProvider language="ko">
        <Probe />
      </MessagesProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('ko:읽는 중');
  });

  it('traduz o app para o chinês simplificado', () => {
    const zhCN = messages('zh-CN');
    expect(zhCN.app.newWork).toBe('新作品');
    expect(zhCN.workStatus.lendo).toBe('在读');
    expect(zhCN.workModal.progressValue(12)).toBe('第12话');
    render(
      <MessagesProvider language="zh-CN">
        <Probe />
      </MessagesProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('zh-CN:在读');
  });

  it('traduz o app para o japonês', () => {
    const ja = messages('ja');
    expect(ja.app.newWork).toBe('新しい作品');
    expect(ja.workStatus.lendo).toBe('読書中');
    expect(ja.workModal.progressValue(12)).toBe('第12話');
    render(
      <MessagesProvider language="ja">
        <Probe />
      </MessagesProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('ja:読書中');
  });
});
