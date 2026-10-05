export interface Attribution {
  name: string;
  license: string;
  description: string;
  url: string;
}

export const ATTRIBUTIONS: Attribution[] = [
  {
    name: 'React',
    license: 'MIT',
    description: 'Biblioteca de interface usada em todas as telas do app.',
    url: 'https://react.dev',
  },
  {
    name: 'React DOM',
    license: 'MIT',
    description: 'Renderização do React no renderer do Electron.',
    url: 'https://react.dev',
  },
  {
    name: 'Font Awesome Free',
    license: 'MIT (código) · OFL-1.1 (fontes) · CC-BY-4.0 (ícones)',
    description: 'Ícones da interface (busca, cards, modais e cabeçalho).',
    url: 'https://fontawesome.com',
  },
  {
    name: 'Electron',
    license: 'MIT',
    description: 'Empacota o app desktop para Linux (main + renderer).',
    url: 'https://www.electronjs.org',
  },
  {
    name: 'electron-vite',
    license: 'MIT',
    description: 'Build e dev-server do main, preload e renderer.',
    url: 'https://electron-vite.org',
  },
  {
    name: 'electron-builder',
    license: 'MIT',
    description: 'Gera o pacote .deb distribuído no Linux Mint.',
    url: 'https://www.electron.build',
  },
  {
    name: 'Vite',
    license: 'MIT',
    description: 'Bundler e servidor de desenvolvimento do renderer.',
    url: 'https://vite.dev',
  },
  {
    name: '@vitejs/plugin-react',
    license: 'MIT',
    description: 'Suporte a React e Fast Refresh no Vite.',
    url: 'https://github.com/vitejs/vite-plugin-react',
  },
  {
    name: 'TypeScript',
    license: 'Apache-2.0',
    description: 'Tipagem estrita de todo o projeto (strict + noUncheckedIndexedAccess).',
    url: 'https://www.typescriptlang.org',
  },
  {
    name: 'Vitest',
    license: 'MIT',
    description: 'Suíte de testes unitários e de componentes.',
    url: 'https://vitest.dev',
  },
  {
    name: '@vitest/coverage-v8',
    license: 'MIT',
    description: 'Relatórios de cobertura dos testes.',
    url: 'https://vitest.dev/guide/coverage',
  },
  {
    name: 'jsdom',
    license: 'MIT',
    description: 'DOM simulado para os testes do renderer.',
    url: 'https://github.com/jsdom/jsdom',
  },
  {
    name: '@testing-library/react',
    license: 'MIT',
    description: 'Renderização e consultas nos testes de componentes.',
    url: 'https://testing-library.com/react',
  },
  {
    name: '@testing-library/jest-dom',
    license: 'MIT',
    description: 'Matchers de DOM (toBeInTheDocument) nos testes.',
    url: 'https://github.com/testing-library/jest-dom',
  },
  {
    name: '@testing-library/user-event',
    license: 'MIT',
    description: 'Simula cliques e digitação nos testes de UI.',
    url: 'https://github.com/testing-library/user-event',
  },
  {
    name: 'ESLint',
    license: 'MIT',
    description: 'Lint rigoroso (strictTypeChecked + stylisticTypeChecked).',
    url: 'https://eslint.org',
  },
  {
    name: '@eslint/js',
    license: 'MIT',
    description: 'Configurações base recomendadas do ESLint.',
    url: 'https://eslint.org',
  },
  {
    name: 'typescript-eslint',
    license: 'MIT',
    description: 'Integração do ESLint com análise de tipos do TypeScript.',
    url: 'https://typescript-eslint.io',
  },
  {
    name: 'eslint-plugin-react-hooks',
    license: 'MIT',
    description: 'Regras de hooks (rules-of-hooks + exhaustive-deps).',
    url: 'https://react.dev',
  },
  {
    name: 'eslint-config-prettier',
    license: 'MIT',
    description: 'Desliga regras do ESLint que conflitam com o Prettier.',
    url: 'https://github.com/prettier/eslint-config-prettier',
  },
  {
    name: 'Prettier',
    license: 'MIT',
    description: 'Formatação consistente do código.',
    url: 'https://prettier.io',
  },
  {
    name: 'globals',
    license: 'MIT',
    description: 'Definições de globais (browser, node) para o ESLint.',
    url: 'https://github.com/sindresorhus/globals',
  },
  {
    name: 'rimraf',
    license: 'BlueOak-1.0.0',
    description: 'Limpeza da pasta out/ antes de cada build.',
    url: 'https://github.com/isaacs/rimraf',
  },
  {
    name: '@types/node',
    license: 'MIT',
    description: 'Tipos do Node para o processo main e scripts.',
    url: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
  },
  {
    name: '@types/react',
    license: 'MIT',
    description: 'Tipos do React para o renderer.',
    url: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
  },
  {
    name: '@types/react-dom',
    license: 'MIT',
    description: 'Tipos do React DOM para o renderer.',
    url: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
  },
];
