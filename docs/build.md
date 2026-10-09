# Build, pacote e distribuição

O app é compilado com electron-vite (`main`, `preload` e `renderer`) e
empacotado em `.deb` pelo electron-builder. Nada disso entra no git: `out/`,
`release/` e `*.deb` estão no `.gitignore`.

## Comandos

| Comando                 | O que faz                                                |
| ----------------------- | -------------------------------------------------------- |
| `npm ci`                | dependências (lockfile exato)                            |
| `npm run dev`           | desenvolvimento com hot reload                           |
| `npm run build`         | apaga `out/` e compila os três bundles                   |
| `npm start`             | pré-visualiza o build (`electron-vite preview`)          |
| `npm run dist`          | build + gera o `.deb` em `release/` (precisa `fakeroot`) |
| `npm run dist:dir`      | idem, deixando a árvore descompactada (`--dir`)          |
| `npm run check`         | typecheck + lint + formato + auditoria OSV               |
| `npm test`              | suíte Vitest (`tests/`)                                  |
| `npm run test:coverage` | suíte com cobertura em `coverage/` (limiar de 50%)       |

Pré-requisitos: Node 24 + npm 11 e `fakeroot` no Linux para o `dist`. O binário
`bin/osv-scanner` (usado por `security:audit`) não é versionado; localmente
copie uma release (2.6.0) e no CI ele é baixado pelo próprio workflow.

## Saída do build

| Caminho                 | Conteúdo                                               |
| ----------------------- | ------------------------------------------------------ |
| `out/main/index.js`     | processo principal (bundled pelo Vite em SSR)          |
| `out/preload/index.cjs` | ponte `contextBridge` (CommonJS, exigida pelo sandbox) |
| `out/renderer/`         | HTML, CSS, fontes e JS da interface                    |
| `release/`              | `.deb` e árvore gerada pelo electron-builder           |

Os aliases `@zero/*` são resolvidos na hora do bundle
(`electron.vite.config.mts`), então o pacote não depende do `tsconfig` em
tempo de execução.

## O que vai dentro do `.deb`

Bloco `build` do `package.json`:

| Chave                 | Valor                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `appId`               | `com.chronos.biblioteca`                                             |
| `target`              | `deb` para Linux (categoria Office, executável `chronos-biblioteca`) |
| `asar`                | ligado (o código vive no `app.asar`)                                 |
| `afterPack`           | `build/after-pack.cjs` (slim: locales e SwiftShader removidos)       |
| `deb.appArmorProfile` | `build/apparmor-profile` (perfil AppArmor real, não o decorativo)    |
| `deb.afterRemove`     | `build/postrm` (unload do perfil, alternatives e purge)              |
| `depends`             | GTK 3, libnotify, NSS, xss, xtst, xdg-utils, atspi e uuid            |
| `electronFuses`       | 6 fuses apertados (abaixo)                                           |

### Fuses (`electronFuses`)

| Fuse                                   | Valor   | Por quê                                                   |
| -------------------------------------- | ------- | --------------------------------------------------------- |
| `runAsNode`                            | `false` | não deixar `ELECTRON_RUN_AS_NODE` executar Node           |
| `enableNodeOptionsEnvironmentVariable` | `false` | bloqueia `NODE_OPTIONS` injetado por fora                 |
| `enableNodeCliInspectArguments`        | `false` | inspetor (`--inspect`) desligado                          |
| `enableCookieEncryption`               | `true`  | cookies cifrados no perfil                                |
| `onlyLoadAppFromAsar`                  | `true`  | código só do `app.asar`                                   |
| `grantFileProtocolExtraPrivileges`     | `false` | sem privilégios extra do `file://` (a SPA é `chronos://`) |

### `after-pack.cjs` (slim)

Remove do pacote o que o app não usa: `locales/` além de `pt-BR`, `pt-PT` e
`en-US` (fallback obrigatório do Chromium) e os binários SwiftShader/Vulkan
(sem WebGL). **Nunca** remover `libffmpeg.so`: o binário do Electron declara
`DT_NEEDED` nele e o app não abre sem o arquivo (lição da v1.1.1).

### Perfil AppArmor (`build/apparmor-profile`)

O `postinst` padrão do electron-builder copia o perfil para
`/etc/apparmor.d/chronos-biblioteca` e o carrega, **pulando** (sem falhar) onde
AppArmor é antigo (base < `abi/4.0`, ex.: Mint 22 sobre 22.04) ou ausente. Sem
essa chave, o que o `.deb` embutiria seria o perfil decorativo padrão
(`flags=(unconfined)`, que só dá nome ao processo). O perfil real confina o
processo instalado:

- **escrita** só nos diretórios do app no home (`.config`/`.local/share`/
  `.cache`/`.local/state/chronos-biblioteca` e as marcas legadas);
- **leitura** do home ampla (o seletor de capa abre arquivo de qualquer pasta)
  com deny-list de credenciais (`.ssh`, `.gnupg`, chaveiros, perfis de
  navegador inclusive Brave, cofre/Cookies do Guardinha, `.aws`, `.docker`,
  `.kube`, `.netrc`, `.git-credentials`); os diretórios críticos têm regra de
  dir porque `/**` não cobre o próprio diretório;
- **exec** só do binário do pacote e do `xdg-open` (URLs externas);
- **rede** `inet`/`inet6` em `stream` e `dgram` (HTTPS e DNS do Dropbox) — sem
  sockets crudos; AppArmor clássico não filtra host de destino (aceito no
  `SECURITY.md`);
- base do Electron/GTK (namespaces, capabilities, `/proc`, abstrações X/Wayland,
  dbus e fontes).

O perfil usa as macros `${executable}`/`${sanitizedProductName}`, que o
electron-builder substitui na hora do build. Validação de sintaxe local:

```bash
apparmor_parser --skip-kernel-load --debug build/apparmor-profile
```

**Ciclo de teste em uma máquina real (obrigatório após cada regra nova):**
carregar em modo complain (`sudo apparmor_parser -C -r
/etc/apparmor.d/chronos-biblioteca`), usar o app de ponta a ponta, ler as
negações (`journalctl -k | grep DENIED` ou `/var/log/kern.log`) e repetir até
zerar negações legítimas; só então voltar ao modo enforce
(`sudo apparmor_parser -r /etc/apparmor.d/chronos-biblioteca`). Negação
legítima é sinal de regra faltando, **nunca** de regra a remover. A remoção do
pacote (`postrm` abaixo) descarrega e apaga o perfil.

Dois aprendizados do ciclo real (2026-10-09, Linux Mint 22.3): as regras
`deny` explícitas da deny-list negam **sem** gerar linha no journal — valide
a deny-list com um teste de leitura direto (EACCES), não pelo log; e o
seletor de capa roda no `xdg-desktop-portal` do sistema, fora do confinamento
(a mediação do perfil acontece na leitura que o próprio app faz do arquivo
escolhido). O registro completo do ciclo está no `Doc/ROADMAP.md`.

### `postrm` (after-remove)

Substitui o template padrão (via `deb.afterRemove`; roda pelo `writeConfigFile`,
que resolve os placeholders de nome). No `remove` comum: remove o
`update-alternatives`, **descarrega o perfil AppArmor do kernel** e apaga o
arquivo (sem isso a policy ficaria imposta até o reboot). No `apt purge`,
apaga também os dados do usuário em todos os homes
(`.config`/`.local/share`/`.cache`/`.state/chronos-biblioteca` e as marcas
antigas `Chronos Biblioteca`/`Webtoons Biblioteca`).

## Integridade: check e testes antes do pacote

O gate **não é advisory**: o workflow `publish.yml` só chega ao
`electron-builder` depois de dois jobs verdes.

| Job               | O que roda                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `resolver-versao` | confere `package.json` × Releases; decide se há o que publicar      |
| `qualidade`       | `npm ci` → baixa o OSV Scanner → `npm run check` → `npm test`       |
| `build-deb`       | `needs: [resolver-versao, qualidade]` → build + tag + Release + APT |

Falha de tipo, lint, formato, vulnerabilidade ou teste derruba o run **antes**
de qualquer tag ou asset existir. `resolver-versao` e `qualidade` rodam em
paralelo.

Localmente, o equivalente ao gate é:

```bash
npm ci && npm run check && npm test
```

## Fluxo do `publish.yml`

```mermaid
flowchart TD
    P["push na main (versão nova), tag v*, Release ou dispatch"] --> R["resolver-versao:<br/>package.json × Releases"]
    P --> Q["qualidade: npm run check + npm test<br/>(OSV Scanner baixado no runner)"]
    R -- "publicar = true" --> B["build-deb (needs: os dois)"]
    Q -- verdes --> B
    B --> N["npm run build + electron-builder<br/>(--publish never)"]
    N --> T["tag v&lt;versão&gt; (se não existir)"]
    T --> D["anexa o .deb à Release"]
    D --> A["repo APT flat assinado (GPG):<br/>alias sem versão, Packages(.gz),<br/>Release, Release.gpg, InRelease, public.key"]
    A --> V["dispara o Vercel Deploy Hook<br/>(landing lê releases/latest)"]
```

Detalhes da distribuição (por que o repo APT vive na Release, nomes dos
assets que **nunca** se renomeiam, troubleshooting do GPG):
[`distribuicao-apt.md`](distribuicao-apt.md). A landing nunca versiona
binário: o `fetch-release.mjs` dela lê `releases/latest` no build.

## Ver também

- [`distribuicao-apt.md`](distribuicao-apt.md) (Release + repo APT + landing)
- [`testes.md`](testes.md) (o que o gate de testes cobre)
- [`SECURITY.md`](../SECURITY.md) (fuses, CSP e permissões da sessão)
