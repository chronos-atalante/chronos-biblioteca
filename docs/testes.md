# Testes

Suíte em Vitest com ambiente `jsdom` único (`vitest.config.mts`): o renderer e
também o processo main rodam em `jsdom`, com o `electron` trocado pelo stub de
`tests/mocks/electron.ts`. São **33 arquivos** e **365 testes**; a duração
gira em torno de 2 minutos porque os testes de backup cifram de verdade com
scrypt `N=2^17` (~128 MiB por derivação), enquanto o Argon2id do cofre roda
com o KDF barato dos testes (16 MiB).

## Como rodar

```bash
npm test               # execução única (o que o CI espera)
npm run test:watch     # modo watch
npm run test:coverage  # cobertura em coverage/ (limiar de 50%)
```

O `npm run check` **não** roda os testes: ele cobre typecheck, lint, formato e
auditoria OSV. Rode os dois antes de concluir qualquer mudança.

## Arquivos

### Processo main

| Arquivo                                             | O que cobre                                                                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/main/index.test.ts`                          | Boot (instância única, protocolos, IPC), handlers, `cover://`, ciclo da janela, F11, diretórios XDG                                                        |
| `tests/main/index.dev.test.ts`                      | Modo desenvolvimento (Vite dev server, ausência em produção)                                                                                               |
| `tests/main/index-startup.test.ts`                  | Arranque resiliente: falha de disco em `initDrive` não impede a janela nem o registro de IPC                                                               |
| `tests/main/index-vault.test.ts`                    | Canais `vault:*` (criar/desbloquear/trava), guarda `assertAppFrame` e auto-lock (`vault:locked`)                                                           |
| `tests/main/shred.test.ts`                          | sobrescrita segura: sumiu, bytes intermediários não são o original, symlink não é seguido, pasta vazia                                                     |
| `tests/main/destroy.test.ts`                        | destruição do cofre/acervo, guarda de não ressuscitar, legados em claro, `.tmp` órfãos                                                                     |
| `tests/main/drive-purge.test.ts`                    | `purgeRemote`: apaga tudo, conta falha parcial, não age sem cofre aberto                                                                                   |
| `tests/renderer/src/components/DangerZone.test.tsx` | confirmação em duas etapas das ações destrutivas                                                                                                           |
| `tests/main/jsonfile.test.ts`                       | `writeJsonAtomic`: escrita atômica, `mode` aplicado mesmo com `.tmp` pré-existente                                                                         |
| `tests/main/library.test.ts`                        | acervo cifrado: XDG, `clampProgress`, roundtrip, capa, restauração, mime, cofre fechado, arquivo corrompido                                                |
| `tests/main/settings.test.ts`                       | `settings.json`: idioma no disco, segredos no cofre, normalização e recusa com cofre fechado                                                               |
| `tests/main/vault-crypto.test.ts`                   | Argon2id, AES-256-GCM, HKDF, faixa do KDF e regra de força da senha mestra                                                                                 |
| `tests/main/vault-container.test.ts`                | Formato do `vault.zkv`: roundtrip, offsets, lixo, truncamento, faixa e fail-closed                                                                         |
| `tests/main/vault-lockout.test.ts`                  | Escala da trava (10 s até 24 h) e estado por tentativa                                                                                                     |
| `tests/main/vault-session.test.ts`                  | Singleton da sessão: `adopt`/`wipe`, zeragem de bytes e repasse do auto-lock                                                                               |
| `tests/main/vault.test.ts`                          | Ciclo de vida: criar, senha fraca, desbloquear, senha errada, trava, segredos, adulteração                                                                 |
| `tests/main/vault-secrets.test.ts`                  | Cofre é a única fonte: sem/aberto/fechado/adulterado (falha fechada), sem migração do legado                                                               |
| `tests/main/vault-privilege.test.ts`                | `setupVaultDirectory`: override bloqueia pkexec; exit 0/126/127/throw → ok/cancelled/failed; `isVaultDirUnavailable` e `createVault` sem pkexec no sandbox |
| `tests/main/drive-auth.test.ts`                     | Estado do Dropbox, `authorize` (loopback/PKCE), desconexão e refresh                                                                                       |
| `tests/main/drive-backup.test.ts`                   | `backupNow`/`restoreNow` ponta a ponta (rede simulada, cifra real)                                                                                         |
| `tests/main/drive-crypto.test.ts`                   | Formato `WTENC3`: cifra, nomes opacos, falha com senha errada                                                                                              |
| `tests/main/drive-info.test.ts`                     | `backupInfo`, renovação de sessão e retry após 401                                                                                                         |
| `tests/main/drive-provider.test.ts`                 | Catálogo de provedores (Dropbox operante, Google Drive oculto)                                                                                             |
| `tests/main/drive-remote-names.test.ts`             | Nomes remotos opacos (HMAC-SHA256) e manifesto de cadeia                                                                                                   |
| `tests/main/drive-restore-lock.test.ts`             | Trava exponencial da restauração (só `PassphraseError` conta)                                                                                              |

### Preload, tipos e renderer

| Arquivo                                                    | O que cobre                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tests/preload/index.test.ts`                              | Fachada `window.api`: canais por grupo (`library`/`settings`/`drive`/`vault`) e assinaturas |
| `tests/shared/types.test.ts`                               | Uniões fechadas e guards dos contratos compartilhados                                       |
| `tests/renderer/src/App.test.tsx`                          | Telas: carga, estatísticas, busca/filtros, ações nas obras, modais, status Drive            |
| `tests/renderer/src/components/WorkCard.test.tsx`          | Card: badges, progresso, ações de status                                                    |
| `tests/renderer/src/components/WorkModal.test.tsx`         | Criar/editar obra, validação e exclusão com confirmação                                     |
| `tests/renderer/src/components/SettingsModal.test.tsx`     | Configurações: carga, provedores, senha de backup, ações do Drive, cofre                    |
| `tests/renderer/src/components/VaultModal.test.tsx`        | Cofre: medidor de força, confirmação, erro do backend e sucesso                             |
| `tests/renderer/src/components/Select.test.tsx`            | Select acessível (teclado, `aria`, busca)                                                   |
| `tests/renderer/src/components/AttributionsModal.test.tsx` | Página de Atribuições                                                                       |
| `tests/renderer/src/components/DonateModal.test.tsx`       | Página de Doações                                                                           |
| `tests/renderer/src/constants.test.ts`                     | Opções de filtro, cores, `coverUrl`, `formatDate`, `clampProgress`                          |
| `tests/renderer/src/i18n.test.tsx`                         | `richText()`, contexto de idioma e catálogo de 5 idiomas                                    |

### Apoios

| Arquivo                     | Papel                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `tests/mocks/electron.ts`   | Stub do `electron` aplicado por alias no `vitest.config.mts` (janela, ipcMain, app, shell)     |
| `tests/setup-env.ts`        | Sandbox `HOME`/`XDG_*` temporária por processo (antes de qualquer import)                      |
| `tests/setup.ts`            | `jest-dom`, `cleanup`, `restoreAllMocks`, `unstubAllGlobals` e `useRealTimers` após cada teste |
| `tests/helpers/sandbox.ts`  | `resetSandbox()`/`sandboxPath()`: limpa os diretórios XDG e a árvore do cofre do processo      |
| `tests/helpers/api.ts`      | `createApiMock()`: fachada `ElectronApi` tipada para os testes de renderer                     |
| `tests/helpers/drive.ts`    | Rede simulada (servidor local) e sessão do Drive pronta para os testes de backup               |
| `tests/helpers/vault.ts`    | `openTestVault()`: cofre de teste recriado e aberto (KDF barato)                               |
| `tests/helpers/fixtures.ts` | Fábricas de `Work`/`AppSettings` com defaults válidos                                          |

## Convenções

- **Correção vem com teste**: escreva o teste que reproduz o problema antes de
  corrigir; teste de domínio novo fica perto dos pares (`tests/main/`,
  `tests/renderer/`, `tests/preload/`).
- **Arquivo abaixo de ~500 linhas**: quando passar, extraia helpers para
  `tests/helpers/`.
- **Temporizadores**: `vi.useFakeTimers()` para travas e contagens, com
  `vi.useRealTimers()` no fim (o `setup.ts` já restaura, mas o teste que muda
  o relógio deve devolver).
- **`clearMocks` fica desligado de propósito** no `vitest.config.mts`: o
  registro de IPC e do protocolo acontece no import do `src/main/index.ts` e
  seria apagado antes dos asserts.
- **Sandbox sempre**: escritas caem em diretório temporário (`setup-env.ts`);
  testes que precisam de um disco limpo chamam `resetSandbox()` no
  `beforeEach`, que também apaga a árvore do cofre (`CRONOLOGIA_VAR_LIB` aponta
  para o sandbox, e `CRONOLOGIA_VAULT_DIR` nunca está definido fora do
  `npm run dev`). Cofre de teste se cria com `openTestVault()`
  (`tests/helpers/vault.ts`), que recria o arquivo e deixa a sessão aberta.
  **Todos** os testes de cofre derivam com o KDF barato (`FAST_KDF`, 16 MiB /
  1 iteração): nenhum roda o Argon2id de produção (128 MiB / 3 iterações).
  A faixa aceita é coberta por `kdfParamsInRange`, sem derivar. Quem cifra de verdade é o backup: os
  testes de `drive/*` usam scrypt de custo real (`N=2^17`), por isso os
  `describe` de backup/restauração declaram 60 s (o timeout global é 15 s).
- **`electron` é mock**: nunca importe o Electron real; o alias já aponta para
  `tests/mocks/electron.ts`. No renderer, use `createApiMock()` para a
  fachada.
- **Imports dos testes**: relativos com extensão (`.ts`/`.tsx`) para os
  helpers locais e alias `@zero/*` para o código sob teste.

## Cobertura

`vitest.config.mts` mede `src/**/*.{ts,tsx}` com o provedor v8 (relatórios em
texto e HTML em `coverage/`) e exige **50%** de linhas, instruções, funções e
ramos. Estado atual na 1.9.0 (424 testes em 37 arquivos):

| Métrica    | Global | `src/main/vault/*` |
| ---------- | ------ | ------------------ |
| Statements | 86,8%  | 93,2%              |
| Branches   | 80,9%  | 85,1%              |
| Functions  | 82,8%  | 100%               |
| Lines      | 88,9%  | 98,4%              |

Os módulos de destruição ficaram altos: `shred.ts` 97,7% de linhas,
`store-crypto.ts` 100%, `library.ts` 96,5%, `cleanup.ts` 89,4%. O limiar do
projeto é 50% nas quatro métricas.

Rodar cobertura: `npm run test:coverage`. Um `npm run test -- coverage` **não**
funciona: sem os dois hífens, o Vitest lê `coverage` como filtro de nome de
arquivo e sai com "No test files found".

Os `*.ts` de tipo puro e o `index.html` ficam de fora (`global.d.ts`,
`src/renderer/index.html`); os bundles de idioma não traduzidos contam pouco
porque a paridade é garantida por teste estrutural, não por execução.

## Ver também

- [`arquitetura.md`](arquitetura.md) (camadas e aliases)
- [`api.md`](api.md) (contrato testado da fachada)
- [`cofre.md`](cofre.md) (KDF barato e `CRONOLOGIA_VAULT_DIR` nos testes)
