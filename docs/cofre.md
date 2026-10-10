# Cofre de segredos

O cofre guarda os **segredos do próprio app** sob uma senha mestra: tokens do
Dropbox, senha de criptografia do backup e App key alternativa (tabela em
[`credenciais.md`](credenciais.md)). É arquivo local, cifrado com Argon2id +
AES-256-GCM, aberto só enquanto durar a sessão em memória. Não é gerenciador
de senhas do usuário.

## Onde mora

| Item      | Caminho                                         | Permissão               |
| --------- | ----------------------------------------------- | ----------------------- |
| Raiz      | `/var/lib/.chronos-biblioteca/`                 | `0711` `root:root`      |
| Diretório | `/var/lib/.chronos-biblioteca/.vault/`          | `0700` (dono = usuário) |
| Container | `/var/lib/.chronos-biblioteca/.vault/vault.zkv` | `0600`                  |

O cofre fica em `/var/lib`, **fora de `~`**, para sobreviver à limpeza do home
do usuário. A raiz é oculta e sem listagem: navegar ou excluir o topo da árvore
exige sudo. Escrita atômica (`vault.zkv.tmp` + `rename`) e leitura
**fail-closed**: forma inválida, truncamento, parâmetro fora da faixa ou byte a
mais no fim devolvem "adulterado", nunca conteúdo em claro.

## Criação e reparo da pasta

A árvore é criada com permissão de escrita no `/var/lib` só onde ela falta:

1. **Instalação** (`build/scripts/after-install.sh`, roda no `postinst`):
   `install -d -m 0711 root:root /var/lib/.chronos-biblioteca` e
   `install -d -m 0700 <SUDO_UID|PKEXEC_UID> /var/lib/.chronos-biblioteca/.vault`
   (se o instalador não for identificado, o dono sai como root e o app conserta
   no próximo uso).
2. **No app** (`ensureVaultStructure` em `src/main/vault/vault.ts`): gravações
   e criação chamam `ensureVaultStructure()` (`mkdir -p` + `chmod 0700`). Com
   `EACCES`/`EPERM`/`EROFS` o erro vira `vaultDirUnavailable`.
3. **Reparo** (`ensureVaultStructureWithSetup` + `src/main/vault/privilege.ts`):
   na criação do cofre, `vaultDirUnavailable` dispara
   `pkexec <process.resourcesPath>/biblioteca-setup` (helper do `.deb`, só cria
   diretórios fixos, dono vindo de `PKEXEC_UID`) e tenta de novo. O diálogo é o
   do PolicyKit (ação `com.chronos.biblioteca.setup-vault`); `pkexec 126`
   (dispensado) vira `vaultAuthCancelled` e o resto vira `vaultDirUnavailable`
   de novo. O app nunca vê a senha do sistema.

Com `CHRONOS_VAULT_DIR`/`CHRONOS_VAR_LIB` definidas (testes e `npm run dev`)
o pkexec **não dispara**: a sobrescrita já vem com permissão de escrita.

## Formato do container (`vault.zkv`)

Escrito e lido só por `src/main/vault/container.ts` (versão `1`, magic
`CHRONOS1`). Tabela de offsets do **cabeçalho** (45 bytes, big-endian):

| Offset | Tamanho | Campo                    |
| ------ | ------- | ------------------------ |
| `0`    | 8       | magic `CHRONOS1` (ASCII) |
| `8`    | 4       | versão (`1`)             |
| `12`   | 8       | `createdAt` (epoch ms)   |
| `20`   | 4       | KDF `memoryKiB`          |
| `24`   | 4       | KDF `iterations`         |
| `28`   | 4       | KDF `parallelism`        |
| `32`   | 4       | `attempts` (trava)       |
| `36`   | 8       | `lockUntil` (epoch ms)   |
| `44`   | 1       | flags (reservado, `0`)   |

Depois do cabeçalho vêm dois blocos selados (`salt/IV/tag/comprimento/dados`):

| Bloco     | Conteúdo                                                            |
| --------- | ------------------------------------------------------------------- |
| `wrap`    | salt do Argon2id (16 B) + IV (16 B) + tag (16 B) + **chave-mestra** |
| `payload` | IV (16 B) + tag (16 B) + JSON `{"version":1,"secrets":{...}}`       |

O `payload` é cifrado com a **chave de dados**, derivada da chave-mestra por
HKDF-SHA512 (contexto `chronos-biblioteca/vault/data`), que separa o domínio
da mestra usado no `wrap`.

## Cifras e custo

| Etapa  | Algoritmo                           | Parâmetros                                     |
| ------ | ----------------------------------- | ---------------------------------------------- |
| KDF    | Argon2id (`hash-wasm`)              | padrão: 128 MiB, 3 iterações, paralelismo 4    |
| Cifra  | AES-256-GCM                         | IV aleatório de 16 B por operação, tag de 16 B |
| Chaves | mestra 32 B / KEK 32 B / dados 32 B | HKDF-SHA512 com salt por cofre                 |

A faixa aceita na leitura é limitada (`memoryKiB` 16 MiB a 1 GiB, `iterations`
1 a 8, `parallelism` 1 a 8): um container adulterado não consegue exigir CPU ou
memória ilimitadas; fora da faixa o arquivo é tratado como adulterado.

## Trava exponencial

Cada senha errada soma uma espera, persistida no próprio container
(`attempts`/`lockUntil`), portanto sobrevive a reinício. A trava é checada
**antes** do Argon2id, então esperar não gasta CPU:

| Falha         | Espera |
| ------------- | ------ |
| 1ª            | 10 s   |
| 2ª            | 30 s   |
| 3ª            | 1 min  |
| 4ª            | 1 h    |
| 5ª e seguinte | 24 h   |

Um desbloqueio bem-sucedido zera `attempts` e `lockUntil`.

## Sessão e auto-lock

A chave-mestra só existe na memória do processo main, dentro do Singleton
`VaultSessionManager` (`src/main/vault/session.ts`): `adopt` copia os bytes,
`wipe` zera antes de soltar, e o `before-quit` do Electron zera também. Sem
chave na sessão, `getSecret`/`setSecret` falham com `vaultLocked`.

- **Auto-lock**: 5 minutos de ociosidade (`IDLE_LOCK_MS`) derrubam a sessão e
  emitem o evento `vault:locked` para a interface, que mostra o aviso.
- **Fechar manualmente**: `vault.lock()` (botão _Fechar cofre_ nas
  Configurações).
- Reabrir exige a senha mestra de novo (a trava vale, se houver falha).

## Comportamento fail-closed

- Container ilegível/adulterado → `vaultTampered`; nenhum segredo é entregue.
- Cofre fechado → `vaultLocked`; `loadSettings` devolve `''` e `loadState`
  zera os tokens (falha fechada, nunca exceção fora do domínio).
- Pasta sem permissão → `vaultDirUnavailable`; caixinha do sistema em seguida
  (ver acima) e, se recusada, `vaultAuthCancelled`.
- Os canais IPC devolvem o envelope `VaultResult` com `code` + `retryInMs`
  (tabela em [`api.md`](api.md) §6); o texto exibido é localizado no renderer.

## Sem migração do legado

Nada é copiado de instalações antigas. `settings.json` com `enc:`/keyring e
`dropbox-tokens.json` com `0600` são **ignorados**: `loadSettings` lê só o
`language` do disco, `loadState` lê só o cofre, e o primeiro salvamento
regrava o arquivo só com o idioma (sem segredo em claro). O cofre antigo em
`~/.config/chronos-biblioteca/.vault` também é descartado: ele não é nem
removido nem lido. Detalhe em [`credenciais.md`](credenciais.md).

## Variáveis de ambiente (testes e dev)

| Variável            | Efeito                                                                |
| ------------------- | --------------------------------------------------------------------- |
| `CHRONOS_VAULT_DIR` | sobrepõe o diretório do cofre (testes usam sandbox própria)           |
| `CHRONOS_VAR_LIB`   | sobrepõe o `/var/lib` de base (testes e `npm run dev` usam o sandbox) |

Ambas desligam o pedido de sudo. Os testes também isolam
`HOME`/`XDG_CONFIG_HOME` (`tests/setup-env.ts`) e injetam KDF barato
(`createVault(senha, params)`), então nenhum teste roda Argon2id com custo de
produção.

## Arquivos do domínio

| Arquivo                       | Papel                                          |
| ----------------------------- | ---------------------------------------------- |
| `src/main/vault/crypto.ts`    | Argon2id, AES-256-GCM, HKDF, regra de senha    |
| `src/main/vault/container.ts` | encode/decode fail-closed do `vault.zkv`       |
| `src/main/vault/lockout.ts`   | espera exponencial                             |
| `src/main/vault/session.ts`   | chave em memória, auto-lock, wipe              |
| `src/main/vault/vault.ts`     | criar/desbloquear/travar e ler/gravar segredos |
| `src/main/vault/privilege.ts` | reparo da pasta via `pkexec` (PolicyKit)       |
| `src/main/vault/secrets.ts`   | mapa de nomes + helpers JSON                   |
| `src/main/vault/errors.ts`    | `VaultError` com `code`/`retryInMs`            |
| `src/main/vault/index.ts`     | barrel                                         |

## Ver também

- [`api.md`](api.md) §6 (canais `vault:*` e códigos de erro)
- [`credenciais.md`](credenciais.md) (o que é guardado e o ciclo de vida)
- [`arquitetura.md`](arquitetura.md) (camadas e ciclo de vida)
