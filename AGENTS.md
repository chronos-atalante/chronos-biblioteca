# AGENTS.md

Diretrizes para agentes e contribuidores deste repositório.

## Qualidade de código

- Seguir as melhores práticas de design patterns (separação de responsabilidades, baixo acoplamento, alta coesão).
- Evitar arquivos monolíticos: ao atingir ~500 linhas, refatorar extraindo módulos/componentes.
- Type safety rigoroso: sem `any` implícito, evitar casts; preferir tipos/interfaces bem definidos e `unknown` quando necessário.
- arquivos com nome index devem ser usados apenas para barrels, exceto os entrypoints exigidos pelo bundler/runtime (`src/main/index.ts`, `src/preload/index.ts` — ver `electron.vite.config.mts`), que mantêm o nome por convenção do Electron. Arquivos que nao são barrels nem entrypoints devem receber nomes apropriados para o arquivo.
- Imports dentro de `src/` sempre pelos aliases ESM `@zero/*` (`@zero/types`, `@zero/main/*`, `@zero/preload/*`, `@zero/renderer/*`); nenhum caminho relativo entre pastas. O mapa é declarado em `tsconfig.base.json` e espelhado em `electron.vite.config.mts`, `vitest.config.mts` e `src/node.loader.ts` — mudar um alias vale nos quatro lugares. Os `paths` do `tsconfig` usam extensão explícita (`.ts`/`.tsx`/`index.tsx`) porque o projeto roda com `module: nodenext`; `allowImportingTsExtensions: true` na base é o que permite esses candidatos de `paths` sem erro de import.

## Dependências

- Usar apenas dependências com licenças permissivas aprovadas pela OSI (MIT, Apache-2.0, BSD, ISC, BlueOak-1.0.0). Sem copyleft forte (GPL, AGPL, LGPL em dependências obrigatórias). Licenças de atribuição para fontes, ícones e dados (OFL-1.1, CC-BY-4.0, CC0-1.0) são aceitas apenas para assets — ex.: `@fortawesome/fontawesome-free` (código MIT; fontes OFL-1.1, ícones CC-BY-4.0) e dados transitivos (`caniuse-lite`, `mdn-data`) — nunca para código executado pelo app.
- Antes de adicionar uma dependência, verificar a licença e preferir alternativas já presentes no projeto.

## Comandos

- `npm run check` — typecheck + lint + format + auditoria de segurança (OSV). Deve passar antes de concluir mudanças.
- `npm run security:audit` — verifica vulnerabilidades nas dependências via OSV Scanner.
- `npm run dev` / `npm run build` / `npm run dist` — desenvolvimento, build e empacotamento.
- `node --import ./src/node.loader.ts <arquivo.ts>` — executa um `.ts` direto no Node com os aliases `@zero/*` resolvidos (hooks síncronos via `module.registerHooks()`).

## Documentação

- Manter a documentação alinhada com o código **a cada mudança**: qualquer alteração de comportamento, fluxo, configuração, caminhos, mensagens exibidas ou dependências deve atualizar `README.md` e/ou `docs/*.md` na **mesma** mudança (nunca deixar para depois).
- Ao alterar um documento, revisar também os diagramas Mermaid, as tabelas de sintoma/causa e os exemplos de comando — eles costumam quebrar em silêncio.
- Documentação nova (guias, troubleshooting, arquitetura) vai em `docs/`; manter o `README.md` como índice que aponte para ela.
- Verificação: após `npm run check`, reler os trechos de doc afetados pela mudança.

## Segurança

- Vulnerabilidades sem fix upstream só podem ser ignoradas com justificativa em `.osv-scanner.toml` (com data de revisão).
