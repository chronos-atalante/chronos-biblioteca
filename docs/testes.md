# Testes

Suíte em Vitest com o renderer em jsdom e o processo main em Node. São **30
arquivos** e **356 testes**; a duração gira em torno de 2 minutos porque o
Argon2id do cofre roda de verdade (perfil de 128 MiB) e alguns testes de
backup usam scrypt com custo real.

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

| Arquivo                                 | O que cobre                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `tests/main/index.test.ts`              | Boot (instância única, protocolos, IPC), handlers, `cover://`, ciclo da janela, F11, migração legada |
| `tests/main/index.dev.test.ts`          | Modo desenvolvimento (Vite dev server, ausência em produção)                                         |
| `tests/main/index-vault.test.ts`        | Canais `vault:*` (criar/desbloquear/trava), guarda `assertAppFrame` e auto-lock (`vault:locked`)     |
| `tests/main/library.test.ts`            | `library.json` e capas: XDG, `clampProgress`, roundtrip, restauração, mime, erros resistentes        |
| `tests/main/settings.test.ts`           | `settings.json`: normalização, idioma, App key, senha de backup, caminho do cofre                    |
| `tests/main/vault-crypto.test.ts`       | Argon2id, AES-256-GCM, HKDF, faixa do KDF e regra de força da senha mestra                           |
| `tests/main/vault-container.test.ts`    | Formato do `vault.zkv`: roundtrip, offsets, lixo, truncamento, faixa e fail-closed                   |
| `tests/main/vault-lockout.test.ts`      | Escala da trava (10 s até 24 h) e estado por tentativa                                               |
| `tests/main/vault-session.test.ts`      | Singleton da sessão: `adopt`/`wipe`, zeragem de bytes e repasse do auto-lock                         |
| `tests/main/vault.test.ts`              | Ciclo de vida: criar, senha fraca, desbloquear, senha errada, trava, segredos, adulteração           |
| `tests/main/vault-migration.test.ts`    | Legado → cofre: modo legado intacto, migração de ida, fechado e adulterado (falha fechada)           |
| `tests/main/drive-auth.test.ts`         | Estado do Dropbox, `authorize` (loopback/PKCE), desconexão e refresh                                 |
| `tests/main/drive-backup.test.ts`       | `backupNow`/`restoreNow` ponta a ponta (rede simulada, cifra real)                                   |
| `tests/main/drive-crypto.test.ts`       | Formato `WTENC3`: cifra, nomes opacos, falha com senha errada                                        |
| `tests/main/drive-info.test.ts`         | `backupInfo`, renovação de sessão e retry após 401                                                   |
| `tests/main/drive-provider.test.ts`     | Catálogo de provedores (Dropbox operante, Google Drive oculto)                                       |
| `tests/main/drive-remote-names.test.ts` | Nomes remotos opacos (HMAC-SHA256) e manifesto de cadeia                                             |
| `tests/main/drive-restore-lock.test.ts` | Trava exponencial da restauração (só `PassphraseError` conta)                                        |

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
| `tests/helpers/sandbox.ts`  | `resetSandbox()`/`sandboxPath()`: limpa os diretórios XDG do processo                          |
| `tests/helpers/api.ts`      | `createApiMock()`: fachada `ElectronApi` tipada para os testes de renderer                     |
| `tests/helpers/drive.ts`    | Rede simulada (servidor local) e sessão do Drive pronta para os testes de backup               |
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
  testes que precisam de um disco limpo chamam `resetSandbox()` no `beforeEach`.
  O cofre respeita `CHRONOS_VAULT_DIR` e a maioria dos testes usa KDF barato
  injetável, mas os testes de `vault/crypto` rodam o Argon2id de produção
  (128 MiB) de propósito: não baixe o custo nem aumente o timeout além dos 15 s
  globais (os de backup/restauração declaram 60 s no `describe`).
- **`electron` é mock**: nunca importe o Electron real; o alias já aponta para
  `tests/mocks/electron.ts`. No renderer, use `createApiMock()` para a
  fachada.
- **Imports dos testes**: relativos com extensão (`.ts`/`.tsx`) para os
  helpers locais e alias `@zero/*` para o código sob teste.

## Cobertura

`vitest.config.mts` mede `src/**/*.{ts,tsx}` com o provedor v8 (relatórios em
texto e HTML em `coverage/`) e exige **50%** de linhas, instruções, funções e
ramos. Estado atual (após a Fase 7):

| Métrica    | Global | `src/main/vault/*` |
| ---------- | ------ | ------------------ |
| Statements | 88,2%  | 93,5%              |
| Branches   | 80,7%  | 85,6%              |
| Functions  | 84,3%  | 98,1%              |
| Lines      | 90,7%  | 98,2%              |

Os `*.ts` de tipo puro e o `index.html` ficam de fora (`global.d.ts`,
`src/renderer/index.html`); os bundles de idioma não traduzidos contam pouco
porque a paridade é garantida por teste estrutural, não por execução.

## Ver também

- [`arquitetura.md`](arquitetura.md) (camadas e aliases)
- [`api.md`](api.md) (contrato testado da fachada)
- [`cofre.md`](cofre.md) (KDF barato e `CHRONOS_VAULT_DIR` nos testes)
