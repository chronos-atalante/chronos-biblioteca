# Mapa de segurança

O [`SECURITY.md`](../SECURITY.md) da raiz é o texto normativo: proteções já
existentes, riscos aceitos, fora de escopo e como reportar uma falha. Aqui
fica o **mapa**, para quem mexer no código saber onde cada medida mora e o
que ela protege.

## Onde cada medida vive

### Cofre e credenciais

| Medida                                                                    | Arquivo principal                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Acervo cifrado em disco (`library.enc`, `covers/*.enc`)                   | `src/main/store-crypto.ts` (formato `CLIB1`), `src/main/library.ts`                     |
| Chave do acervo derivada da mestra por HKDF, por domínio                  | `src/main/store-crypto.ts`                                                              |
| Leitura do acervo falha fechada (`libraryTampered`, nunca `[]`)           | `src/main/store-crypto.ts` (`readStoreFile`)                                            |
| Portão do acervo: sem cofre aberto, nada é lido nem gravado               | `src/main/library.ts` (`requireVault`)                                                  |
| Sobrescrita segura antes de apagar (`fsync` antes do `unlink`)            | `src/main/shred.ts`                                                                     |
| Destruição do cofre não ressuscita container                              | `src/main/vault/vault.ts` (marca `vaultDestroyed`)                                      |
| Legado em claro e `.tmp` órfãos varridos no boot                          | `src/main/cleanup.ts`                                                                   |
| Apagar o backup na nuvem, com contagem de falha parcial                   | `src/main/drive/backup.ts` (`purgeRemote`)                                              |
| Recusa de senha mestra previsível (antes do Argon2id)                     | `src/main/vault/crypto.ts` (`passwordProblem`)                                          |
| Argon2id (128 MiB), AES-256-GCM e HKDF-SHA512                             | `src/main/vault/crypto.ts`                                                              |
| Container `vault.zkv` fail-closed e faixa do KDF na leitura               | `src/main/vault/container.ts`                                                           |
| Trava exponencial (10 s → 24 h) antes de qualquer derivação               | `src/main/vault/lockout.ts`, `src/main/vault/vault.ts`                                  |
| Chave-mestra só na sessão, auto-lock de 5 min e wipe no quit              | `src/main/vault/session.ts` (wipe chamado por `src/main/index.ts` no `before-quit`)     |
| Auto-lock por ociosidade **real** (atividade da UI, não acesso a segredo) | `src/main/vault/session.ts` (`touch` com throttle), `src/main/index.ts` (`vault:touch`) |
| Segredos com nome canônico (sem string solta)                             | `src/main/vault/secrets.ts`                                                             |
| Cofre fora de `~` em `/var/lib` (raiz `0711` + vault `0700`)              | `build/scripts/after-install.sh`, `build/scripts/biblioteca-setup`                      |
| Reparo da pasta do cofre só com PolicyKit (senha do sistema)              | `src/main/vault/privilege.ts` (`pkexec` + ação no `.policy`)                            |
| Sem cofre não há segredo (falha fechada; nada em claro)                   | `src/main/settings.ts`, `src/main/drive/state.ts`                                       |
| Canais `vault:*` com origem validada e envelope sem lançar                | `src/main/index.ts`                                                                     |

### Backup no Dropbox

| Medida                                                        | Arquivo principal                                        |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| AES-256-GCM do backup com scrypt (`N=2¹⁷`) e formato `WTENC3` | `src/main/drive/crypto.ts`                               |
| Nomes remotos opacos (HMAC-SHA256) + manifesto cifrado        | `src/main/drive/crypto.ts`                               |
| Trava da restauração (só `PassphraseError` conta)             | `src/main/drive/restore-lock.ts`                         |
| OAuth PKCE sem `client_secret` + loopback fixo                | `src/main/drive/oauth.ts`, `src/main/drive/constants.ts` |
| Escopos mínimos, limitados à App folder                       | `src/main/drive/constants.ts`                            |
| Tokens só no cofre, nunca em arquivo em claro/log/repositório | `src/main/drive/state.ts`, `.gitignore`                  |

### Superfície do Electron

| Medida                                                                              | Arquivo principal                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Guarda de origem em todo canal IPC (`assertAppFrame`)                               | `src/main/index.ts`                                                                          |
| Navegação presa ao app, `window.open` negado, permissões web negadas (só clipboard) | `src/main/index.ts`                                                                          |
| Capas por `cover://` com `basename`, decifradas sob demanda                         | `src/main/protocols.ts` (`registerCoverProtocol`), `src/main/library.ts` (`readCoverBuffer`) |
| SPA em produção por `chronos://` (`path.resolve` + prefixo)                         | `src/main/protocols.ts` (`registerAppProtocol`)                                              |
| `shell.openExternal` só para `https:`                                               | `src/main/external.ts` (`openExternalSafe`)                                                  |
| CSP no HTML da interface                                                            | `src/renderer/index.html`                                                                    |
| Preload sandboxed (CommonJS) com `contextIsolation`                                 | `src/preload/index.ts`                                                                       |
| 6 fuses do Electron                                                                 | `package.json` (bloco `build.electronFuses`)                                                 |
| DevTools desligado no app empacotado                                                | `src/main/index.ts` (`devTools: !app.isPackaged`)                                            |

### Dados e distribuição

| Medida                                                                    | Arquivo principal                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| Escrita de JSON atômica (`.tmp` + rename) com `0600` onde há credencial   | `src/main/jsonfile.ts`, `src/main/vault/vault.ts`      |
| Ids de obra seguros (rejeita `..`, `/`, `\`)                              | `src/main/library.ts` (`isValidWorkId`)                |
| Erros do cofre por código (nenhum texto/senha em mensagem)                | `src/main/vault/errors.ts`, `src/messages/`            |
| Ações destrutivas com confirmação em duas etapas na interface             | `src/renderer/src/components/DangerZone.tsx`           |
| Auditoria de dependências a cada `npm run check` (OSV)                    | `package.json`, `.osv-scanner.toml`, `bin/osv-scanner` |
| CodeQL no push/PR                                                         | `.github/workflows/codeql.yml`                         |
| Gate: check + testes antes de qualquer Release                            | `.github/workflows/publish.yml` (job `qualidade`)      |
| `after-pack.cjs` sem mexer em `DT_NEEDED` (lição da 1.1.1)                | `build/after-pack.cjs`                                 |
| Confinamento AppArmor do processo instalado (escrita nos dirs do app e no | `build/apparmor-profile`                               |
| vault em `/var/lib`, deny de credenciais no home, exec só `xdg-open`,     |                                                        |
| rede só `stream`/`dgram`)                                                 |                                                        |
| `purge` de dados + unload do perfil na remoção                            | `build/postrm`                                         |

## Fluxo de confiança

```
Página do app (chronos://) → assertAppFrame → regra de domínio → cofre/drive → arquivo cifrado
                                  ^                              ^                  ^
                                  |                              |                  |
                          só o frame oficial            requireSessionKey    0600 + atômico
```

Nenhuma entrada do renderer passa direto para o disco: o id precisa ser
válido (`isValidWorkId`), o cofre exige chave na sessão (`requireSessionKey`)
e os segredos só existem dentro do container cifrado. O desbloqueio confere a
trava **antes** do Argon2id e valida a integridade do payload antes de adotar
a chave; qualquer anormalidade vira `vaultTampered`/`null` (falha fechada),
nunca conteúdo em claro.

## O que não enfraquecer

- `requireVault` no acervo: sem ele, `loadLibrary` devolveria `[]` com o cofre
  fechado e o próximo salvamento **sobrescreveria** um acervo que existe.
- `readStoreFile` nunca devolvendo lista vazia para arquivo ilegível: o mesmo
  motivo, com o agravante de que o acervo não tem backup local.
- `writeContainer` recusando enquanto `vaultDestroyed` estiver de pé: sem a
  marca, um `setSecret` acidental depois da destruição recria o container pela
  metade e o usuário lê "adulterado" em vez de "destruído".
- `purgeRemote` só zerando os tokens locais com `failed === 0`: zerar antes
  deixa blobs órfãos que o app não tem mais como apagar.
- `assertAppFrame` em todo canal IPC novo; sem ele o domínio do app fica
  acessível a frame de fora.
- CSP do `index.html`, os 6 fuses e `contextIsolation`/`sandbox` do preload.
- `passwordProblem` no main: o medidor do `VaultModal` é só feedback.
- `KDF_LIMITS` na leitura do container (um arquivo adulterado não pode exigir
  CPU/memória ilimitadas) e o fail-closed de `decodeContainer`/`unseal`
  (tag inválida = `null`, jamais texto).
- A chave-mestra só dentro do `VaultSessionManager` (`adopt`/`wipe`): nenhuma
  cópia em variável de módulo ou Buffer que escape do Singleton.
- O gate do `publish.yml` não pode voltar a ser advisory: `build-deb` precisa
  manter `needs: [resolver-versao, qualidade]`.
- `libffmpeg.so` fora da lista do `after-pack.cjs` (o app não abre sem ela).
- `build/apparmor-profile` não pode voltar ao perfil decorativo
  (`flags=(unconfined)`): ele só vale alguma coisa se for restritivo, a
  deny-list de credenciais não pode encolher, e cada regra nova precisa de
  teste em `enforce` (negação legítima no log do kernel é sinal de regra
  faltando, nunca de regra a remover). Ciclo em `docs/build.md`.
- Nenhum `console.log` com senha ou token; erros do cofre via código
  (`VaultErrorCode`) localizado no renderer.
- `.deb` e segredos fora do git (`.gitignore`); assets da Release nunca
  renomeados (o APT resolve por nome exato).

## Ver também

- [`SECURITY.md`](../SECURITY.md) (texto normativo e canal de reporte)
- [`cofre.md`](cofre.md) (formato, KDF, trava e sessão)
- [`credenciais.md`](credenciais.md) (segredos e ciclo de vida)
- [`build.md`](build.md) (fuses, gate e `after-pack`)
