# AGENTS.md: Chronos Biblioteca

Diretrizes para agentes e contribuidores deste repositório. Este arquivo manda
no código daqui; a visão do monorepo (duas partes, versão e distribuição) está
no `AGENTS.md` da raiz. Referências humanas: `README.md` (visão completa) e
`CONTRIBUTING.md` (commits e lançamentos).

## O projeto

App desktop Electron + TypeScript + React (Vite) para anotar progresso de
leituras, com backup criptografado no Dropbox, alvo Linux Mint e distribuição
`.deb`. Versão: `package.json` → `version` é a fonte da verdade.

Camadas (diagrama no `README.md`, seção Arquitetura):

- `src/main/`: janela, IPC, protocolos `cover://` e `chronos://` (`index.ts`),
  persistência (`library.ts`, `settings.ts`) e backup na nuvem (`drive/`).
- `src/messages/`: textos do app em pt-BR (canônico), en, ko e zh-CN (`@zero/messages`);
  guia em `docs/messages.md`.
- `src/preload/`: única ponte da UI; monta e expõe `window.api` tipado.
- `src/renderer/`: React; não acessa disco, rede nem Node direto.
- `src/types/`: contratos compartilhados (`@zero/types`, barrel).

## Arquitetura

- Cada arquivo do `main` responde por um domínio; o renderer só conhece o
  contrato de `window.api` (`docs/api.md`).
- Persistência local em JSON: obras e capas em `~/.local/share/chronos-biblioteca/`
  (`library.json`, `covers/`) e configurações e tokens em
  `~/.config/chronos-biblioteca/` (`settings.json`, `dropbox-tokens.json`); a nuvem
  passa pelo contrato `BackupProvider` (`docs/backup-providers.md`), com o
  Dropbox como único provedor operante (App folder, sem credencial embutida).
- IPC via `ipcRenderer.invoke` e `ipcMain.handle`; canal novo só com tipo em
  `src/types/` e entrada em `docs/api.md`.

## Design patterns

- Fachada: `src/preload/index.ts` monta o objeto `api: ElectronApi` e o
  registra no `contextBridge`; `ipcRenderer` não aparece fora dele.
- Barrel exports: `index.ts` só re-exporta (exceto os entrypoints
  `src/main/index.ts` e `src/preload/index.ts`); exemplo:
  `src/main/drive/index.ts`.
- Módulos de serviço coesos em `src/main/drive/` (`provider`, `oauth`, `rest`,
  `crypto`, `backup`, `state`), um por responsabilidade; os adaptadores de
  provedor ficam em `drive/providers/`.
- Tipagem de domínio por uniões fechadas (`WorkStatus`, `WorkType` em
  `src/types/work.ts`), nunca strings soltas.
- UI composicional: estado no topo (`App.tsx`), cartões e modais
  controlados (`WorkCard`, `WorkModal`, `SettingsModal`).

## Código: regras duras

- Imports dentro de `src/` só pelos aliases ESM `@zero/*` (nenhum caminho
  relativo entre pastas). O mapa é declarado em `tsconfig.base.json` e
  espelhado em `electron.vite.config.mts`, `vitest.config.mts` e
  `src/node.loader.ts`; mudar um alias vale nos quatro. `paths` usam extensão
  explícita (`.ts`/`.tsx`/`index.tsx`) porque o projeto roda com
  `module: nodenext`.
- Arquivos no teto de ~500 linhas; passou disso, extraia módulos.
- Type safety: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitReturns` e
  `verbatimModuleSyntax` (import de tipo sempre `import type`). Sem `any`,
  sem cast gratuito; `unknown` para dado de fora (fetch/JSON validado antes
  de usar).
- Estilo: Prettier com 100 colunas, aspas simples e ponto e vírgula. Não
  desligue regra de lint para passar, corrija o código.
- `console` só `warn`/`error` (regra do ESLint); nenhum `debugger`/`alert`.
- Textos fixos de UI e de mensagem **só em `src/messages/`** (pt-BR é o
  canônico; `en.ts`, `ko.ts` e `zh-CN.ts` devem fechar com `Messages`): no renderer use
  `useMessages()`/`richText()` (`src/renderer/src/i18n.tsx`), no main
  `currentMessages()` (`src/main/i18n.tsx`). Marcadores ricos `**negrito**` e
  `` `código` `` só em string exibida. Nomes de marca, dados por dependência
  (`attributions.ts`, `CATEGORIES`) e logs ficam fora dos bundles; regras e
  lista completas do que não se traduz em `docs/messages.md`.

## Comandos

- `npm run check`: typecheck + lint + format + auditoria OSV. Obrigatório
  antes de concluir qualquer mudança.
- `npm test` (ou `test:coverage`): Vitest em `tests/**`; cobertura mínima de
  50% por métrica. Comportamento novo vem com teste.
- `npm run dev` / `build` / `dist`: desenvolvimento, build, `.deb`.
- `node --import ./src/node.loader.ts <arquivo.ts>`: roda `.ts` direto com
  os aliases `@zero/*`.
- Capture o exit do próprio npm (`npm run check; echo $?`), não o código de
  saída de um `tail`/`grep` no fim do pipe.

## Melhores práticas de desenvolvimento

- Documentação junto com o código: mudou comportamento, fluxo, configuração,
  caminho, mensagem ou dependência → atualize `README.md` e/ou `docs/*` na
  mesma mudança; revise os diagramas Mermaid e as tabelas junto.
- Commits seguem Conventional Commits em pt-BR (`feat:`, `fix:`, `docs:`...):
  o tipo guia o bump de versão e o `CHANGELOG.md`.
- Dependências: só licenças permissivas OSI (MIT, Apache-2.0, BSD, ISC,
  BlueOak-1.0.0); prefira o que já existe e confira a licença antes de
  adicionar.
- Testes: `electron` é mockado em `tests/mocks/electron.ts` e `clearMocks`
  está desligado de propósito no `vitest.config.mts` (não ligar).
- Não versionar build e binário: `out/`, `release/`, `node_modules`, `.deb`.

## Segurança

- `npm run security:audit` limpo antes de concluir; vulnerabilidade sem fix
  upstream só com justificativa e `ignoreUntil` em `.osv-scanner.toml`.
- Nada de credencial no repositório: tokens Dropbox saem do device do
  usuário (OAuth PKCE, sem secret) e os secrets do CI (`GPG_PRIVATE_KEY`,
  `GPG_PASSPHRASE`) vivem só no GitHub.
- Renderer com CSP (schemes `cover:` e `chronos:`) e preload sandboxed (por
  isso ele é CommonJS); não enfraquecer `contextIsolation` nem inserir HTML
  dinâmico. Na produção a SPA é servida por `chronos://` via
  `registerAppProtocol` (substitui `file://`); todo handler IPC valida
  `event.senderFrame` com `assertAppFrame`. Fuses de segurança no electron-
  builder via chave `electronFuses`.
- Backup: cifragem AES-256-GCM com nomes opacos (`docs/dropbox.md`); senha
  e conteúdo nunca em log ou mensagem exibida.
- `.deb` nunca entra no git e a assinatura do repo APT acontece só no
  workflow, a partir dos secrets.

## Distribuição e release (resumo)

- Push na `main` dispara o `publish.yml`: o job **Verificar versão** compara
  `package.json` com as Releases existentes e, se for uma versão nova, cria a
  tag, gera o `.deb`, anexa a ele e ao repo APT flat assinado na GitHub
  Release e notifica o Vercel; a landing lê `releases/latest` no build.
  (Tag `v*` manual, `release: published` e `workflow_dispatch` seguem
  funcionando como gatilhos de reserva.)
- Nunca renomear os assets estáveis da Release (`Packages`, `Packages.gz`,
  `Release`, `Release.gpg`, `InRelease`, `public.key` e o alias
  `chronos-biblioteca_amd64.deb`).
- Passo a passo completo: `docs/distribuicao-apt.md`. Regras do monorepo:
  `AGENTS.md` da raiz.

## Documentação

- Documentação nova vai em `docs/`; o `README.md` é o índice (atualize a
  tabela na mesma mudança).
- Mapa: `docs/api.md` (contrato `window.api`), `docs/dropbox.md` (backup),
  `docs/backup-providers.md` (provedores de nuvem e status do Google Drive),
  `docs/messages.md` (i18n: bundles e regras de tradução),
  `docs/atribuicoes.md` e `docs/doacoes.md` (páginas do app),
  `docs/distribuicao-apt.md` (distribuição APT), `docs/openapi.yaml` (API em
  OpenAPI 3.1).
