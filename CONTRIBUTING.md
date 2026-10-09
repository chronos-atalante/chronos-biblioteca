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
  `@zero/preload/*`, `@zero/renderer/*`); nunca caminho relativo entre pastas.
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
**atualiza `README.md` e/ou `docs/*.md` na mesma mudança**, nunca depois.
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
- Achou uma falha? **Não abra issue pública**: siga [`SECURITY.md`](SECURITY.md).

## 8. Enviar a mudança

1. Crie um branch a partir da `main`: `git checkout -b minha-mudanca`.
2. Faça commits pequenos, com mensagens claras em pt-BR.
3. Rode `npm run check` e `npm test` (tudo verde).
4. Abra o PR pelo formulário do repositório (`.github/pull_request_template.md`),
   descrevendo **o quê**, **por quê** e **como testar**.

## 9. Issues e automações do GitHub

- Issues só pelas templates de `.github/ISSUE_TEMPLATE/` (bug e funcionalidade);
  vulnerabilidade de segurança vai pelo canal privado do `SECURITY.md` (link em
  `.github/ISSUE_TEMPLATE/config.yml`).
- `.github/dependabot.yml` abre PRs toda segunda para dependências (npm) e para
  as versões das GitHub Actions.
- `.github/workflows/codeql.yml` roda o CodeQL em push/PR para `main` e toda
  segunda-feira, complementando o `npm run security:audit`.
- Ao mesclar um PR, `.github/workflows/agradecer.yml` deixa um comentário de
  agradecimento.

## 10. Commits e lançamentos

Use [Conventional Commits](https://www.conventionalcommits.org/) em pt-BR no
título do commit vindo da `developer` para a `main`:

- `feat: ...` → nova funcionalidade (sobe `MINOR`, ex.: 1.0.2 → 1.1.0);
- `fix: ...` → correção de bug (sobe `PATCH`, ex.: 1.0.2 → 1.0.3);
- `docs: ...`, `test: ...`, `chore: ...`, `refactor: ...` → sem lançamento.

Para publicar uma versão (a partir da `main`):

1. Bump em `package.json` → `version` + entrada nova no `CHANGELOG.md`
   (o tipo dos commits desde a última release indica MINOR/PATCH);
2. Commit (`chore: release x.y.z`) e push na `main`;
3. O push dispara o workflow **Publicar .deb**: os jobs **Verificar versão**
   e **Verificar qualidade** (`npm run check` + `npm test`) rodam em
   paralelo; só com os dois verdes o job **Gerar e publicar** compara
   `package.json` com as Releases existentes e, sendo uma versão nova,
   cria a tag `vX.Y.Z`, compila (`npm run dist`), anexa o `.deb`
   **e o repo APT flat assinado** (`Packages`, `Release`, `InRelease`,
   `public.key` + alias `chronos-biblioteca_amd64.deb`) à Release, e dispara
   o redeploy da landing (via Deploy Hook). Requer os secrets
   `GPG_PRIVATE_KEY` (+ `GPG_PASSPHRASE`, se houver) em
   Settings → Secrets → Actions. Push repetido sem bump de versão vira
   execução verde e rápida (nada a publicar);
4. Confira a sincronia das 4 vias (ver `AGENTS.md` da raiz, §2):
   `package.json` ≡ tag ≡ `Packages` (`Version:`) ≡ `release-info.json`
   da landing.

Para reanexar os assets de uma Release que falhou no meio, rode o workflow
na UI (**Run workflow**, `workflow_dispatch`); ele publica de novo sem
conferir a versão. Também dá para empurrar a tag à mão
(`git tag vX.Y.Z && git push origin vX.Y.Z`), que dispara o mesmo workflow.

A landing lê essa Release na API pública e atualiza versão, botão de
download e os comandos APT (`…/releases/latest/download/`, suite `./`);
o `.deb` nunca é versionado no git.

Guia completo do fluxo de distribuição (motivos, passo a passo, lições e
verificação de sanidade): [`docs/distribuicao-apt.md`](docs/distribuicao-apt.md).
