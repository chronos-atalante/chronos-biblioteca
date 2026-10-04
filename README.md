# Chronos Biblioteca

Aplicativo desktop (Electron + TypeScript + React) para anotar o progresso das suas leituras de
**webtoons, manhwas, manhuas, mangás e livros**: capa da obra, título, descrição, barra de
progresso
em porcentagem e marcação de conclusão — com **backup manual no Google Drive** em um espaço
oculto.

Feito para **Linux Mint 22.3 (Zena)** e distribuído como pacote **`.deb`**.

---

## Recursos

- **Biblioteca em grade** com capa, título, tipo (webtoon/manhwa/manhua/mangá/livro), status
  (planejado, lendo, pausado, concluído, cancelado) e progresso.
- **Capa da obra**: escolha uma imagem JPG/PNG/WebP do disco — ela é copiada para a biblioteca
  local e servida pelo protocolo interno `cover://`.
- **Título e descrição** livres, além de uma marcação opcional (`Cap. 45`, `Vol. 3`).
- **Barra de progresso** no card com setas `↑` / `↓` (ajuste de 1 em 1) e botões de status
  contextuais — **Concluir**, **Pausar**/**Retomar** e **Cancelar** — todos em uma única linha e
  compactos (só ícone, com a ação no tooltip); no modal de edição, campo numérico direto,
  `−10` / `+10`, **concluir** e **zerar**.
- **Busca** por título ou descrição e **filtros** por status (Lendo, Planejados, Pausados,
  Concluídos, Cancelados); o contador e o progresso médio do cabeçalho acompanham o que está
  sendo exibido, e o bloco de estatísticas continua mostrando o total da biblioteca.
- **Backup no Google Drive**: espaço **oculto `appDataFolder`** (invisível na interface do
  Drive), OAuth direto no app com **credenciais embutidas** (sem configuração prévia), arquivos
  sempre **criptografados**, com **Fazer backup agora**, **Restaurar** (pede a senha) e
  **Desconectar**.
- **Janela nativa sem barra de menus**: sem botões File/Edit/View no topo (menu da
  aplicação removido por completo); decorações do gerenciador de janelas (encaixe em cantos
  para dividir a tela, maximizar/fechar) e `F11` alterna tela cheia.
- Tema escuro com fundo preto (`#000`) e paleta sólida azul; ícones **Font Awesome**.

---

## Instalação

```bash
# gere o pacote (uma vez)
npm install
npm run dist

# instale
sudo apt install ./release/chronos-biblioteca_1.0.0_amd64.deb
```

O aplicativo aparece no menu do sistema como **Chronos Biblioteca**.

- Executável: `/opt/Chronos Biblioteca/chronos-biblioteca` (alternativa
  `/usr/bin/chronos-biblioteca`)
- Ícone instalado em `/usr/share/icons/hicolor/512x512/apps/chronos-biblioteca.png`
- Dados: `~/.config/chronos-biblioteca/` (`library.json`, `covers/`, `settings.json`,
  `drive-tokens.json`)

---

## Comandos de desenvolvimento

| Comando                  | O que faz                                          |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`            | Sobe o app em modo desenvolvimento (hot reload)    |
| `npm run typecheck`      | `tsc --noEmit` nos projetos node, web e testes     |
| `npm run lint`           | ESLint rigoroso (type-aware) em todo o repositório |
| `npm run lint:fix`       | ESLint com correção automática                     |
| `npm run format`         | Formata tudo com Prettier                          |
| `npm run format:check`   | Verifica a formatação (CI)                         |
| `npm test`               | Roda a suíte Vitest (`tests/**/*.test.{ts,tsx}`)   |
| `npm run security:audit` | Auditoria de vulnerabilidades via OSV Scanner      |
| `npm run check`          | `typecheck` + `lint` + `format:check` + auditoria  |
| `npm run clean`          | Apaga `out/` (build anterior) com rimraf           |
| `npm run build`          | Limpa + compila main/preload/renderer              |
| `npm run dist`           | Build + gera o `.deb` com electron-builder         |

---

## Qualidade de código

O projeto roda com o máximo de rigor disponível:

**TypeScript (`tsconfig.base.json`)**

```jsonc
"strict": true,
"module": "nodenext",                // ESM em src/ (src/package.json "type": "module")
"allowImportingTsExtensions": true,  // noEmit: permite candidatos de paths com .ts/.tsx
"noUncheckedIndexedAccess": true,   // acesso a índice vira T | undefined
"exactOptionalPropertyTypes": true, // opcional ≠ undefined explícito
"noImplicitReturns": true,
"noImplicitOverride": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"allowUnreachableCode": false,
"verbatimModuleSyntax": true        // imports de tipo obrigatoriamente `import type`
```

**ESLint (`eslint.config.mjs`)**

- `typescript-eslint` nos perfis **`strictTypeChecked`** + **`stylisticTypeChecked`** (analisa
  tipos reais, não só sintaxe).
- Regras extras sempre em **`error`**: `no-floating-promises`, `no-misused-promises`,
  `no-unsafe-*` (assignment/argument/call/member-access/return), `no-unnecessary-condition`,
  `strict-boolean-expressions` (sem coerção implícita: `if (str)` é proibido, use
  `str === ''`), `explicit-function-return-type`, `explicit-member-accessibility`,
  `require-await`, `switch-exhaustiveness-check`, `no-deprecated` etc.
- `eslint-plugin-react-hooks` com `rules-of-hooks` e `exhaustive-deps` em `error`.
- `eslint-config-prettier` desliga apenas o que conflita com a formatação.

**Prettier (`.prettierrc.json`)** — 100 colunas, aspas simples, ponto e vírgula, vírgula final,
2 espaços. Rode `npm run check` antes de commitar.

---

## Imports e aliases

Dentro de `src/` **não existe import relativo**: todo módulo é referenciado por um alias ESM
`@zero/*`. O mapa é declarado uma única vez em `tsconfig.base.json` e espelhado nos três
resolvers que o projeto usa (build, testes e Node puro):

| Alias              | Alvo                  | Onde é resolvido                                        |
| ------------------ | --------------------- | ------------------------------------------------------- |
| `@zero/types`      | `src/types/` (barrel) | `electron.vite.config.mts`, `vitest.config.mts`, loader |
| `@zero/types/*`    | `src/types/*`         | `tsconfig.base.json`                                    |
| `@zero/main/*`     | `src/main/*`          | `electron.vite.config.mts`, `vitest.config.mts`, loader |
| `@zero/preload/*`  | `src/preload/*`       | `electron.vite.config.mts`, `vitest.config.mts`, loader |
| `@zero/renderer/*` | `src/renderer/src/*`  | `electron.vite.config.mts`, `vitest.config.mts`, loader |

- **Build** (`npm run dev` / `npm run build`): electron-vite (Vite) resolve os aliases.
- **Testes** (`npm test`): vitest resolve os mesmos aliases.
- Com `module: nodenext`, os candidatos de `paths` em `tsconfig.base.json` declaram a extensão
  (`.ts` / `.tsx` / `index.tsx`); `allowImportingTsExtensions: true` (que exige `noEmit`) é o
  que permite isso sem erro de import.
- **Node puro** (sem bundler): o loader `src/node.loader.ts` registra hooks de resolução com
  `module.registerHooks()` — hooks **síncronos, na mesma thread** (estáveis desde o
  Node 22.15/23.5). O caminho antigo, `module.register()` com hooks assíncronos em thread
  separada (o antigo `--experimental-loader`), está **deprecado** desde o Node 25.9.

```bash
# roda um arquivo .ts direto, com os aliases @zero/* funcionando
node --import ./src/node.loader.ts caminho/para/arquivo.ts
```

O loader só precisa dos aliases: o Node já remove as anotações de tipo dos `.ts` sozinho.
`src/package.json` **e a raiz** declaram `"type": "module"`: o Node lê `src/` como ESM e o
electron-vite emite `out/main/index.js` (ESM). O preload sai como **CommonJS**
(`out/preload/index.cjs`), porque o Electron roda preload **sandboxed** como script simples, sem
loader ESM — por isso `electron.vite.config.mts` fixa `format: 'cjs'` no build de `preload`.
`preloadScript()` em `src/main/index.ts` resolve `index.cjs`, `index.mjs` ou `index.js` nessa
ordem.

---

## Arquitetura

```mermaid
flowchart TD
    subgraph RENDERER["Renderer — React + Vite (src/renderer)"]
        UI1["App.tsx — busca, filtros, estatísticas"]
        UI2["WorkCard — capa, progresso, concluir/pausar/cancelar"]
        UI3["WorkModal — formulário da obra"]
        UI4["SettingsModal — credenciais e backup"]
        BRIDGE["window.api (contextBridge)"]
        UI1 --> UI2
        UI1 --> UI3
        UI1 --> UI4
        UI2 --> BRIDGE
        UI3 --> BRIDGE
        UI4 --> BRIDGE
    end

    subgraph MAIN["Main — Electron (src/main)"]
        IDX["index.ts — janela, IPC, protocolo cover:, F11"]
        LIB["library.ts — library.json + capas"]
        SET["settings.ts — credenciais e senha do backup"]
        DRV["drive/ — OAuth, REST, backup, migração"]
    end

    subgraph STORAGE["Persistência"]
        LOKAL[("~/.config/chronos-biblioteca/<br/>library.json · covers/ · settings.json · drive-tokens.json")]
        DRIVE[("Google Drive · espaço oculto appDataFolder")]
    end

    BRIDGE -->|"ipcRenderer.invoke"| IDX
    IDX --> LIB --> LOKAL
    IDX --> SET --> LOKAL
    IDX --> DRV
    DRV <-->|"HTTPS (fetch) · scopes drive.appdata + drive.file"| DRIVE
    IDX -.->|"cover://imagens-da-capa"| UI1
```

### Estados de uma obra

```mermaid
stateDiagram-v2
    [*] --> planejado
    planejado --> concluido: "Concluir"
    planejado --> pausado: "Pausar"
    planejado --> cancelado: "Cancelar"
    lendo --> concluido: "Concluir"
    lendo --> pausado: "Pausar"
    lendo --> cancelado: "Cancelar"
    pausado --> lendo: "Retomar"
    pausado --> concluido: "Concluir"
    pausado --> cancelado: "Cancelar"
    cancelado --> lendo: "Retomar"
    concluido --> lendo: "Reabrir"
```

Os botões do card mostram as transições válidas para o status atual (uma obra `cancelada` só
oferece **Retomar**; uma `concluída`, só **Reabrir**). No modal de edição, o Select de **Status**
permite ir de qualquer estado para qualquer outro, e **Zerar** volta o progresso para 0 e o status
para `planejado`. Mexer no progresso de uma obra `concluída` a devolve para `lendo`.

Progresso e status são independentes: marcar `concluido` **não** altera o número salvo — o card
apenas passa a exibir `100%` (use **Zerar** no modal para voltar a 0).

### Fluxo do progresso (anotação contínua)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant C as Card/Modal (UI)
    participant A as App.tsx (estado)
    participant M as Main (library.ts)
    participant D as library.json

    U->>C: setas ↑/↓ (+1/−1) no card · −10/+10 no modal
    C->>A: onProgress(obra, valor)
    A->>A: clamp >= 0 (sem limite superior) + atualiza a UI na hora
    A->>M: save (debounce de 450 ms)
    M->>D: escrita atômica (.tmp → rename)
    M-->>A: lista atualizada de obras
```

---

## Estrutura do projeto

```
Webtoons/
├── build/
│   ├── icon.png              # ícone 512×512 usado no .deb
│   └── make-icon.py          # gerador do ícone (PIL)
├── docs/
│   └── google-drive.md       # guia do backup + diagramas
├── src/
│   ├── main/                 # processo main (Electron)
│   │   ├── index.ts          # janela, IPC, protocolo cover://, F11 em tela cheia
│   │   ├── library.ts        # library.json + cópia/limpeza de capas
│   │   ├── settings.ts       # credenciais OAuth
│   │   └── drive/            # OAuth, Drive REST, backup/restauração
│   │       ├── index.ts      # barrel da API pública (authorize, backupNow…)
│   │       ├── constants.ts  # escopos, credenciais embutidas, appDataFolder
│   │       ├── state.ts      # tokens, status e listener
│   │       ├── oauth.ts      # autorização (PKCE) + refresh do token
│   │       ├── rest.ts       # chamadas REST do Drive (appDataFolder)
│   │       ├── json.ts       # leitura tipada de corpos JSON (`parseJson`)
│   │       ├── migrate.ts    # migração da pasta legada .webtoons-backup
│   │       ├── crypto.ts     # AES-256-GCM do backup
│   │       └── backup.ts     # backup, restauração e desconexão
│   ├── preload/index.ts      # contextBridge (window.api)
│   ├── renderer/             # React + Vite
│   │   ├── index.html        # CSP com scheme cover:
│   │   └── src/              # App, componentes, style/styles.css
│   ├── types/                # tipos compartilhados main ↔ renderer (@zero/types)
│   │   ├── index.ts          # barrel (arquivo index só como barrel)
│   │   ├── work.ts           # Work, WorkType, WorkStatus
│   │   ├── settings.ts       # AppSettings
│   │   ├── drive.ts          # DriveStatus, BackupSummary
│   │   └── api.ts            # ElectronApi (contrato do preload)
│   ├── node.loader.ts        # hooks module.registerHooks() dos aliases @zero/*
│   └── package.json          # "type": "module" (Node executa src/ direto)
├── tests/
│   ├── main/                 # drive-auth, drive-backup, drive-info (<500 linhas cada)
│   ├── helpers/              # fixtures, sandbox, drive (FakeDrive + stubFetch)
│   └── mocks/                # mock do electron para o Vitest
├── eslint.config.mjs
├── .prettierrc.json
├── tsconfig*.json
└── electron.vite.config.mts
```

---

## Empacotamento (.deb)

```mermaid
flowchart LR
    SRC["src/"] --> TSC["tsc --noEmit<br/>(strict)"]
    SRC --> ESL["ESLint<br/>strictTypeChecked"]
    SRC --> PRT["Prettier --check"]
    TSC --> VITE["electron-vite build"]
    ESL --> VITE
    PRT --> VITE
    VITE --> EB["electron-builder --linux deb"]
    ICON["build/icon.png"] --> EB
    EB --> DEB[("release/<br/>chronos-biblioteca_1.0.0_amd64.deb")]
```

Detalhes da configuração (campo `build` do `package.json`):

- Alvo exclusivo `deb`, `executableName: chronos-biblioteca`
- `desktopName` + `syncDesktopName` para o `StartupWMClass` casar com a janela (associação
  correta no menu/ALT+TAB do Mint)
- Ícone empacotado em `usr/share/icons/hicolor/512x512/apps/`
- `homepage` no `package.json` é um **placeholder** (`https://example.com/chronos-biblioteca`):
  o alvo `deb` do electron-builder exige uma URL no campo `Homepage:` do controle do pacote e o
  projeto não está no GitHub
- `postinst` do electron-builder cuida do AppArmor (Ubuntu/Mint 24+) e do `chrome-sandbox`

---

## Backup no Google Drive

Fluxo resumido (passo a passo completo em [`docs/google-drive.md`](docs/google-drive.md)):

1. ⚙ → defina a **senha de criptografia do backup** (obrigatória). As credenciais OAuth já vêm
   **embutidas** no app — não é preciso criar nada no Google Cloud Console (os campos de
   Client ID/Secret são opcionais, para quem tem projeto próprio).
2. **Conectar ao Drive** → janela do navegador → consentimento → tokens guardados localmente em
   `drive-tokens.json` (PKCE + loopback em `127.0.0.1`).
3. **Fazer backup agora** → `library.json` + capas, **sempre criptografadas** (AES-256-GCM), no
   espaço **oculto `appDataFolder`** — invisível na interface do Drive e acessível só por este
   app (escopos `drive.appdata` + `drive.file`).
4. **Restaurar** → pede a **senha de criptografia**, baixa o backup e substitui a biblioteca
   local.
5. **Migração automática**: backups antigos na pasta `.webtoons-backup` são movidos para o
   `appDataFolder` e a pasta antiga é apagada após a primeira conexão.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant App as App Electron
    participant G as accounts.google.com
    participant D as Google Drive

    U->>App: Configurações → Conectar ao Drive
    App->>G: abre o navegador (PKCE + scopes drive.appdata + drive.file)
    G->>U: tela de consentimento
    U->>G: aprova
    G-->>App: redirect http://127.0.0.1:port/callback?code=...
    App->>G: POST /oauth2/token (code + code_verifier)
    G-->>App: access_token + refresh_token
    App->>App: grava drive-tokens.json
    App->>D: migração: pasta legada .webtoons-backup → appDataFolder

    U->>App: Fazer backup agora
    App->>App: criptografa library.json + capas (AES-256-GCM)
    App->>D: upload para o espaço oculto appDataFolder
    App->>D: apaga arquivos remotos órfãos
    D-->>App: ok
    App-->>U: "Backup concluído"

    U->>App: Restaurar
    App-->>U: pede a senha de criptografia
    App->>D: baixa os arquivos e decifra
    App-->>U: "Backup restaurado"
```

---

## Ícone

`build/icon.png` (512×512, gerado por `build/make-icon.py` — livro aberto + barra de progresso
sobre fundo azul sólido). É ele que vira o ícone do pacote `.deb` e do lançador de menu. Para
regenerar:

```bash
python3 build/make-icon.py
```

---

## Documentação

Guias e referências (tudo em pt-BR):

| Documento                                      | Conteúdo                                              |
| ---------------------------------------------- | ----------------------------------------------------- |
| [`docs/google-drive.md`](docs/google-drive.md) | Guia do backup: OAuth, criptografia, troubleshooting  |
| [`docs/api.md`](docs/api.md)                   | Referência da API interna (`window.api` + canais IPC) |
| [`docs/openapi.yaml`](docs/openapi.yaml)       | Mesma API em OpenAPI 3.1 (abre em Swagger UI/Redoc)   |
| [`CHANGELOG.md`](CHANGELOG.md)                 | Histórico de mudanças por versão                      |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)           | Como contribuir (ambiente, scripts, convenções)       |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)     | Código de conduta da comunidade                       |
| [`SECURITY.md`](SECURITY.md)                   | Política de segurança e como reportar falhas          |

---

## Licença

[MIT](LICENSE) — ver o texto integral em [`LICENSE`](LICENSE).
