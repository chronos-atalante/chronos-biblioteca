# Webtoons Biblioteca

Aplicativo desktop (Electron + TypeScript + React) para anotar o progresso das suas leituras de
**webtoons, manhwas, manhuas, mangás e livros**: capa da obra, título, descrição, barra de
progresso
em porcentagem e marcação de conclusão — com **backup automático-manual no Google Drive** em uma
pasta oculta.

Feito para **Linux Mint 22.3 (Zena)** e distribuído como pacote **`.deb`**.

---

## Recursos

- **Biblioteca em grade** com capa, título, tipo (webtoon/manhwa/manhua/mangá/livro), status e
  progresso.
- **Capa da obra**: escolha uma imagem JPG/PNG/WebP do disco — ela é copiada para a biblioteca
  local e servida pelo protocolo interno `cover://`.
- **Título e descrição** livres, além de uma marcação opcional (`Cap. 45`, `Vol. 3`).
- **Barra de progresso** com botões rápidos `−10` / `+10`, campo numérico direto e **concluir**
  (100%) / **zerar**.
- **Busca** por título ou descrição e **filtros** por status (Lendo, Planejados, Pausados,
  Concluídos) com estatísticas no topo.
- **Backup no Google Drive**: pasta oculta **`.webtoons-backup`**, OAuth direto no app (sem
  servidor intermediário), com **Fazer backup agora**, **Restaurar** e **Desconectar**.
- Tema escuro com fundo preto (`#000`) e paleta sólida azul; ícones **Font Awesome**.

---

## Instalação

```bash
# gere o pacote (uma vez)
npm install
npm run dist

# instale
sudo apt install ./release/webtoons-biblioteca_1.0.0_amd64.deb
```

O aplicativo aparece no menu do sistema como **Webtoons Biblioteca**.

- Executável: `/opt/Webtoons Biblioteca/webtoons-biblioteca` (alternativa
  `/usr/bin/webtoons-biblioteca`)
- Ícone instalado em `/usr/share/icons/hicolor/512x512/apps/webtoons-biblioteca.png`
- Dados: `~/.config/Webtoons Biblioteca/` (`library.json`, `covers/`, `settings.json`,
  `drive-tokens.json`)

---

## Comandos de desenvolvimento

| Comando                | O que faz                                          |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Sobe o app em modo desenvolvimento (hot reload)    |
| `npm run typecheck`    | `tsc --noEmit` nos projetos node e web             |
| `npm run lint`         | ESLint rigoroso (type-aware) em todo o repositório |
| `npm run lint:fix`     | ESLint com correção automática                     |
| `npm run format`       | Formata tudo com Prettier                          |
| `npm run format:check` | Verifica a formatação (CI)                         |
| `npm run check`        | `typecheck` + `lint` + `format:check`              |
| `npm run build`        | Compila main/preload/renderer com electron-vite    |
| `npm run dist`         | Build + gera o `.deb` com electron-builder         |

---

## Qualidade de código

O projeto roda com o máximo de rigor disponível:

**TypeScript (`tsconfig.base.json`)**

```jsonc
"strict": true,
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

## Arquitetura

```mermaid
flowchart TD
    subgraph RENDERER["Renderer — React + Vite (src/renderer)"]
        UI1["App.tsx — busca, filtros, estatísticas"]
        UI2["WorkCard — capa, progresso, concluir/reabrir"]
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
        IDX["index.ts — janela, IPC, protocolo cover:"]
        LIB["library.ts — library.json + capas"]
        SET["settings.ts — Client ID/Secret"]
        DRV["drive.ts — OAuth + Drive REST"]
    end

    subgraph STORAGE["Persistência"]
        LOKAL[("~/.config/Webtoons Biblioteca/<br/>library.json · covers/ · settings.json · drive-tokens.json")]
        DRIVE[("Google Drive · pasta oculta .webtoons-backup")]
    end

    BRIDGE -->|"ipcRenderer.invoke"| IDX
    IDX --> LIB --> LOKAL
    IDX --> SET --> LOKAL
    IDX --> DRV
    DRV <-->|"HTTPS (fetch) · scope drive.file"| DRIVE
    IDX -.->|"cover://imagens-da-capa"| UI1
```

### Estados de uma obra

```mermaid
stateDiagram-v2
    [*] --> planejado
    planejado --> lendo: progresso > 0
    lendo --> pausado: pausar
    pausado --> lendo: retomar
    lendo --> concluido: chegar a 100% ou "Concluir"
    pausado --> concluido: chegar a 100%
    concluido --> lendo: "Reabrir"
```

Regra única e simples no salvamento: **status `concluido` força progresso 100%** (e o slider em
100% marca a obra como concluída).

### Fluxo do progresso (anotação contínua)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant C as Card/Modal (UI)
    participant A as App.tsx (estado)
    participant M as Main (library.ts)
    participant D as library.json

    U->>C: arrasta o slider / +10% / −10%
    C->>A: onProgress(obra, valor)
    A->>A: clamp 0–100 + atualiza a UI na hora
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
│   │   ├── index.ts          # janela, IPC, protocolo cover://
│   │   ├── library.ts        # library.json + cópia/limpeza de capas
│   │   ├── settings.ts       # credenciais OAuth
│   │   └── drive.ts          # OAuth, Drive REST, backup/restauração
│   ├── preload/index.ts      # contextBridge (window.api)
│   ├── renderer/             # React + Vite
│   │   ├── index.html        # CSP com scheme cover:
│   │   └── src/              # App, componentes, styles.css
│   └── shared/types.ts       # tipos compartilhados main ↔ renderer
├── eslint.config.mjs
├── .prettierrc.json
├── tsconfig*.json
└── electron.vite.config.ts
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
    EB --> DEB[("release/<br/>webtoons-biblioteca_1.0.0_amd64.deb")]
```

Detalhes da configuração (campo `build` do `package.json`):

- Alvo exclusivo `deb`, `executableName: webtoons-biblioteca`
- `desktopName` + `syncDesktopName` para o `StartupWMClass` casar com a janela (associação
  correta no menu/ALT+TAB do Mint)
- Ícone empacotado em `usr/share/icons/hicolor/512x512/apps/`
- `postinst` do electron-builder cuida do AppArmor (Ubuntu/Mint 24+) e do `chrome-sandbox`

---

## Backup no Google Drive

Fluxo resumido (passo a passo completo em [`docs/google-drive.md`](docs/google-drive.md)):

1. ⚙ → crie um **ID do cliente OAuth** (tipo _Aplicativo para computador_) no Google Cloud
   Console e cole **Client ID** + **Client Secret** em _Configurações_.
2. **Conectar ao Drive** → janela do navegador → consentimento → tokens guardados localmente em
   `drive-tokens.json`.
3. **Fazer backup agora** → `library.json` + capas sobem para a pasta oculta
   **`.webtoons-backup`** (escopo `drive.file`: o app só enxerga arquivos que ele mesmo criou).
4. **Restaurar** baixa o backup e substitui a biblioteca local.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant App as App Electron
    participant G as accounts.google.com
    participant D as Google Drive

    U->>App: Configurações → Conectar ao Drive
    App->>G: abre o navegador (authorize + scope drive.file)
    G->>U: tela de consentimento
    U->>G: aprova
    G-->>App: redirect http://127.0.0.1:port/callback?code=...
    App->>G: POST /oauth2/token (code)
    G-->>App: access_token + refresh_token
    App->>App: grava drive-tokens.json

    U->>App: Fazer backup agora
    App->>D: procura (ou cria) a pasta .webtoons-backup
    App->>D: upload multipart de library.json + capas
    App->>D: apaga arquivos remotos órfãos
    D-->>App: ok
    App-->>U: "Backup concluído"
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

## Licença

MIT
