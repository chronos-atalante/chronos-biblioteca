# Como contribuir

Obrigado por querer ajudar o **Chronos Biblioteca**! Este guia resume o fluxo.
As regras detalhadas para agentes e contribuidores estão em [`AGENTS.md`](AGENTS.md).

## 1. Preparar o ambiente

- **Node.js 22+** e **npm** (o app roda em Electron 44).
- Linux Mint 22.x (alvo do `.deb`); outros Linux funcionam para desenvolver.

```bash
npm install
npm run dev     # abre o app com hot reload
```

## 2. Scripts importantes

| Comando                  | Quando usar                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `npm run dev`            | desenvolver com recarregamento automático                              |
| `npm test`               | rodar a suíte Vitest                                                   |
| `npm run check`          | **obrigatório antes de commitar** (tipos + lint + formato + auditoria) |
| `npm run clean`          | apagar a pasta `out/` (build anterior)                                 |
| `npm run build`          | compilar main/preload/renderer                                         |
| `npm run dist`           | gerar o `.deb` em `release/`                                           |
| `npm run security:audit` | auditoria de vulnerabilidades (OSV Scanner)                            |

## 3. Convenções de código (resumo)

- **Imports em `src/` sempre por alias** `@zero/*` (`@zero/types`, `@zero/main/*`,
  `@zero/preload/*`, `@zero/renderer/*`) — nunca caminho relativo entre pastas.
  O mapa vive em `tsconfig.base.json` e é espelhado em `electron.vite.config.mts`,
  `vitest.config.mts` e `src/node.loader.ts`.
- **Arquivos `index` só como barrel**, exceto os entrypoints exigidos pelo
  Electron (`src/main/index.ts`, `src/preload/index.ts`).
- **Sem `any`**, sem casts desnecessários; prefira tipos bem definidos e
  `unknown` + validação nas fronteiras (JSON, IPC, rede).
- **Arquivos com ~500 linhas devem ser quebrados** em módulos/componentes.
- Rode `node --import ./src/node.loader.ts <arquivo.ts>` para executar um `.ts`
  direto no Node com os aliases resolvidos.

## 4. Dependências

- Só licenças permissivas aprovadas pela OSI (ver lista em `AGENTS.md`); **nada
  de GPL/AGPL/LGPL** em dependências obrigatórias.
- Confira a licença **antes** de instalar e prefira o que já existe no projeto.

## 5. Documentação junto com o código

Toda mudança de comportamento, fluxo, configuração, mensagens ou dependências
**atualiza `README.md` e/ou `docs/*.md` na mesma mudança** — nunca depois.
Guias novos vão em `docs/`; o `README.md` é o índice. Mudanças voltadas ao
usuário ganham entrada em [`CHANGELOG.md`](CHANGELOG.md).

## 6. Testes

- Testes em `tests/**/*.test.{ts,tsx}` (Vitest + jsdom); alvos de cobertura em
  `vitest.config.mts`.
- Correção de bug vem acompanhada de teste que reproduz o problema.
- Mantenha os arquivos de teste abaixo de ~500 linhas (extraia helpers para
  `tests/helpers/`).

## 7. Segurança

- Nunca commite segredos, tokens ou `drive-tokens.json` (já cobertos pelo
  `.gitignore`).
- Vulnerabilidades de dependências: rode `npm run security:audit`; ignores só
  com justificativa e data de revisão em `.osv-scanner.toml`.
- Achou uma falha? **Não abra issue pública** — siga [`SECURITY.md`](SECURITY.md).

## 8. Enviar a mudança

1. Crie um branch a partir da `main`: `git checkout -b minha-mudanca`.
2. Faça commits pequenos, com mensagens claras em pt-BR.
3. Rode `npm run check` e `npm test` (tudo verde).
4. Abra o PR descrevendo **o quê**, **por quê** e **como testar**.

## 9. Commits e lançamentos automáticos

Os lançamentos são automáticos via GitHub Actions — **sem token manual e sem
bump manual de versão**:

- Use [Conventional Commits](https://www.conventionalcommits.org/) em pt-BR no
  título do commit vindo da `developer` para a `main`:
  - `feat: ...` → nova funcionalidade (sobe `MINOR`, ex.: 1.0.2 → 1.1.0);
  - `fix: ...` → correção de bug (sobe `PATCH`, ex.: 1.0.2 → 1.0.3);
  - `docs: ...`, `test: ...`, `chore: ...`, `refactor: ...` → sem lançamento.
- Ao mesclar na `main`, o bot **release-please** abre o PR `chore: release x.y.z`
  (bump em `package.json` + entrada no `CHANGELOG.md`). **Mesclar esse PR**
  cria a tag `vx.y.z` e a GitHub Release.
- O workflow **Publicar .deb** então compila (`npm run dist`), anexa o `.deb`
  à Release e dispara o redeploy da landing (via Deploy Hook).
- Atalho: `git push origin v1.2.3` numa tag também publica (a Release é criada
  com notas geradas). Use só em exceção — o fluxo normal é via PR do bot.

## 10. Publicar no APT (único passo manual por release)

O `.deb` chega aos usuários via repositório APT público
(`https://chronos-atalante.github.io/repo-apt/`, repo `repo-apt` + GitHub
Pages) e via botão de download da landing (que lê a versão do `Packages`
público). Depois que a Release com o `.deb` existir:

```bash
bin/publicar-apt 1.2.3 /caminho/do/repo-apt   # reprepro + commit + push
```

Pré-requisitos uma única vez: `sudo apt install reprepro gh && gh auth login.
O GitHub Pages serve a nova versão em ~1 min, sem tocar na landing.
