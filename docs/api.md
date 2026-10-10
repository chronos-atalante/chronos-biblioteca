# Referência da API interna (`window.api`)

Documentação completa da ponte entre a interface (renderer/React) e o processo
principal (main/Electron) do **Chronos Biblioteca**, no padrão de referências
OpenAPI/Swagger (ver também [`openapi.yaml`](openapi.yaml), legível por
Swagger UI, Redoc e afins).

> Tudo em português do Brasil. Tipos-fonte em `src/types/`; implementação em
> `src/preload/index.ts` (ponte) e `src/main/index.ts` (canais IPC).

---

## 1. Visão geral

O renderer **não** acessa Node/Electron diretamente (`sandbox: true`,
`contextIsolation: true`, `nodeIntegration: false`). Toda operação passa pela
ponte exposta via `contextBridge`:

```ts
window.api.library.get(); // Promise<Work[]>
```

Cada método chama `ipcRenderer.invoke(canal, ...args)`, atendido por um
`ipcMain.handle(canal, ...)` no processo main. A tabela abaixo cruza os três
níveis (método → canal → origem dos dados):

| `window.api`           | Canal IPC           | Origem dos dados                            |
| ---------------------- | ------------------- | ------------------------------------------- |
| `library.get()`        | `library:get`       | `library.json` local                        |
| `library.save(obra)`   | `library:save`      | cria/atualiza obra + `library.json`         |
| `library.remove(id)`   | `library:delete`    | remove obra + limpa capa órfã               |
| `pickCover()`          | `cover:pick`        | diálogo do SO → copia para `covers/`        |
| `settings.get()`       | `settings:get`      | idioma do disco + segredos do cofre         |
| `settings.set(cfg)`    | `settings:set`      | segredos no cofre e `settings.json` (0600)  |
| `drive.status()`       | `drive:status`      | estado em memória (+ tokens no cofre)       |
| `drive.providers()`    | `drive:providers`   | catálogo `BackupProvider` (Dropbox, Google) |
| `drive.auth()`         | `drive:auth`        | OAuth PKCE + loopback `localhost:17431`     |
| `drive.backup()`       | `drive:backup`      | criptografa e envia à pasta do app          |
| `drive.restore(senha)` | `drive:restore`     | baixa, decifra e substitui a biblioteca     |
| `drive.backupInfo()`   | `drive:backup-info` | metadados do `library.json` remoto          |
| `drive.disconnect()`   | `drive:disconnect`  | apaga a sessão e o segredo dos tokens       |
| `drive.onStatus(cb)`   | evento (sem invoke) | assina `drive:status-changed`               |
| `vault.status()`       | `vault:status`      | container do cofre + sessão em memória      |
| `vault.create(senha)`  | `vault:create`      | cria o cofre (Argon2id) e o deixa aberto    |
| `vault.unlock(senha)`  | `vault:unlock`      | trava exponencial + Argon2id                |
| `vault.lock()`         | `vault:lock`        | zera a chave da sessão (auto-lock em 5 min) |
| `vault.onLocked(cb)`   | evento (sem invoke) | assina `vault:locked` (auto-lock)           |

---

## 2. Convenção de respostas

Métodos do Drive devolvem um envelope de resultado e **nunca lançam**:

```ts
{ ok: true, summary?: BackupSummary } // sucesso
{ ok: false, error: 'mensagem' } // falha (no idioma corrente)
```

Os canais do cofre seguem a mesma ideia com o envelope `VaultResult` (§6), só
que a falha carrega um **código** (`VaultErrorCode`) em vez de texto: quem
exibe localiza a mensagem no bundle corrente (`m.vault.errors[code]`).

Métodos de biblioteca/configurações devolvem os dados direto (ou `null` onde
indicado). Erros de Drive saem no idioma corrente (`AppSettings.language`,
pt-BR por padrão; ver §4 e [`messages.md`](messages.md)).

Guarda de origem: todo handler IPC chama `assertAppFrame(event)` antes da
lógica de domínio, exigindo `event.senderFrame` apontando para a página
oficial do app (scheme `chronos://` em produção ou dev server do Vite em dev);
uma mensagem de emissor desconhecido é bloqueada com erro.

---

## 3. Biblioteca

### `library.get() → Promise<Work[]>`

Devolve todas as obras salvas (`library.json`). Lista vazia se ainda não há
obras; nunca `null`.

### `library.save(obra) → Promise<Work[]>`

Cria ou atualiza uma obra e devolve a lista completa atualizada.

- Entrada: `Omit<Work, 'createdAt' | 'updatedAt'>` (os carimbos são gerados
  pelo main; `updatedAt` é renovado a cada salvamento).
- `id` vazio gera UUID novo; fora da régua `^[A-Za-z0-9_-]{1,64}$` a chamada
  falha com `Identificador de obra inválido.` (nenhum id vira caminho de
  arquivo, `isValidWorkId`).
- `progress` é fixado em `>= 0` (`clampProgress`), sem limite superior.
- Uma obra `concluida` cujo progresso muda volta para `lendo` (regra de UI).

### `library.remove(id: string) → Promise<Work[]>`

Remove a obra e apaga o arquivo de capa órfão, se houver. Devolve a lista
restante. Remover um `id` inexistente devolve a lista inalterada. Um `id`
fora da régua (`^[A-Za-z0-9_-]{1,64}$`) falha com
`Identificador de obra inválido.`

### `pickCover() → Promise<string | null>`

Abre o diálogo nativo (JPG/JPEG/PNG/WebP/GIF/AVIF/BMP), copia a imagem para
`covers/` com nome único e devolve o nome do arquivo. Devolve `null` se o
usuário cancelar. A imagem é servida pelo protocolo interno (§6).

---

## 4. Configurações

### `settings.get() → Promise<AppSettings>`

```ts
type Language = 'pt-BR' | 'en' | 'ko' | 'zh-CN' | 'ja';

interface AppSettings {
  driveClientId: string; // App key alternativa ('' = usa a embutida; sem campo na UI)
  drivePassphrase: string; // senha de criptografia do backup (obrigatória p/ backup)
  language: Language; // idioma da interface e das mensagens
}
```

`language` fora de `'pt-BR' | 'en' | 'ko' | 'zh-CN' | 'ja'` cai para `'pt-BR'`
(também quando o arquivo não existe: o app não detecta o idioma do SO, a
escolha é explícita em Configurações).

Os dois segredos (`drivePassphrase`, `driveClientId`) moram **no cofre**
([`cofre.md`](cofre.md)); o disco guarda só `language`. Com o cofre fechado
`settings.get` devolve `''` para os segredos (falha fechada) e `settings.set`
lança `vaultLocked` **antes** de gravar. A tela abre o fluxo de criação ou
desbloqueio do cofre e reenvia a operação.

### `settings.set(cfg: AppSettings) → Promise<AppSettings>`

Normaliza o ID com `trim` e ajusta `language` para o valor válido mais próximo.
Também grava os segredos no cofre e `language` em `settings.json` (`0600`, com
escrita atômica), depois devolve o valor salvo. Um `''` em `driveClientId` não apaga uma
chave já gravada (a janela não tem campo: ver [`dropbox.md`](dropbox.md) §1).

---

## 5. Backup em nuvem (provedores)

Catálogo e status dos provedores em [`backup-providers.md`](backup-providers.md);
fluxo do Dropbox em [`dropbox.md`](dropbox.md). Resumo dos métodos:

### `drive.providers() → Promise<BackupProviderInfo[]>`

```ts
interface BackupProviderInfo {
  id: 'dropbox' | 'google-drive';
  label: string; // nome exibido na interface
  operational: boolean; // dá para conectar e fazer backup?
  unavailableReason: string | null; // motivo (null quando operante)
  storageTarget: string; // destino do backup, pronto para exibição
  storageHidden: boolean; // destino oculto na interface do serviço?
}
```

Ordem de exibição: Dropbox (operante) e depois Google Drive (**não
operante**; a UI mostra o selo _Não operante_ e o motivo, sempre com o
destino oculto `appDataFolder`). Os textos (`unavailableReason`,
`storageTarget`) voltam **no idioma corrente** (`AppSettings.language`, §4);
ver [`messages.md`](messages.md).

### `drive.status() → Promise<DriveStatus>`

```ts
interface DriveStatus {
  connected: boolean; // há tokens válidos em memória
  syncing: boolean; // backup/restauração em andamento
  lastSync: string | null; // ISO 8601 do último backup
  lastError: string | null; // última falha (idioma corrente), ou null
  accountEmail: string | null; // e-mail da conta conectada
}
```

### `drive.auth() → Promise<{ ok: boolean; error?: string }>`

Abre o navegador (PKCE, sem `app secret`, com `token_access_type=offline`) e escuta o
callback num servidor loopback de **porta fixa** (`localhost:17431`; o Dropbox exige a
URI de redirect pré-cadastrada no App Console, então a porta não pode ser sorteada;
se estiver ocupada, cai para uma livre e o Dropbox recusa com `redirect_uri_mismatch`).
Troca o código por tokens e grava `dropbox.tokens` no cofre (exige cofre
aberto: sem ele a tela abre a criação/desbloqueio antes). Falhas típicas:
`access_denied` (usuário recusou), `Tempo esgotado aguardando autorização.`,
`Falha ao obter tokens (HTTP).`. Sem App key (a embutida estando vazia e sem
`settings.driveClientId` no cofre), recusa antes de abrir o navegador.

### `drive.backup() → Promise<{ ok: boolean; error?: string; summary?: BackupSummary }>`

Pré-condições, nesta ordem: conta conectada, biblioteca local não vazia,
senha de criptografia definida, nenhuma sincronização em andamento. Envia
`library.json` + capas **sempre criptografados** à pasta do app
(`/Apps/Chronos Biblioteca`, o `path` raiz da API com permissão App folder) e apaga
arquivos remotos órfãos. Cada upload usa `mode: overwrite` direto no
`content.dropboxapi.com`, sem multipart nem id prévio.

Cifra (ver `src/main/drive/crypto.ts`): AES-256-GCM com chave de 32 bytes
derivada por **scrypt explícito** (`N=2¹⁷`, `r=8`, `p=1`; mínimo atual do
OWASP, ~128 MiB por derivação), salt de 16 e IV de
12 bytes aleatórios por arquivo, tag de 16 bytes verificada na leitura.
Formato único `WTENC3` (nunca houve release com outro; o app ainda não foi
publicado para usuários).

Nomes remotos opacos: a pasta do app é visível na conta do usuário, então nada nela
pode entregar o conteúdo. Cada upload usa `HMAC-SHA256(chaveDeNomes, nomeLocal)` como
nome remoto, onde a chave de nomes deriva da senha por scrypt com um **salt
aleatório por cadeia de backup** (só para nomes; o conteúdo usa outra chave). O
salt mora no **manifesto cifrado** (`manifest.json` → HMAC), no formato
`{ v: 2, salt, files: { nomeRemoto: nomeLocal } }`, gravado por último como
"commit" do backup; o manifesto em si é localizado por uma chave com salt fixo,
para ser encontrável em qualquer máquina sem estado prévio. Manifesto v1 (mapa
puro, sem salt) continua legível e migra para v2 no próximo backup. A
restauração e o `backupInfo` resolvem os nomes pelo manifesto, com fallback
para arquivos em claro; manifesto ausente sem arquivos = "nenhum
backup"; manifesto corrompido/senha errada = falha fechada.

```ts
interface BackupSummary {
  id: string; // id remoto do library.json ('novo' no 1º backup)
  name: string; // sempre 'library.json'
  modifiedTime: string; // ISO 8601 do envio
  size: number; // bytes locais enviados
  works: number | null; // nº de obras incluídas
}
```

### `drive.restore(passphrase: string) → Promise<{ ok: boolean; error?: string; works?: number }>`

Baixa cada arquivo da pasta do app pelos ids listados, resolve os nomes locais pelo
manifesto cifrado, decifra com a senha, valida obra por obra e **substitui** a
biblioteca local (incluindo capas). Senha errada ou arquivo corrompido:
`Senha de criptografia incorreta ou backup corrompido.` Sem backup remoto:
`Nenhum backup encontrado na pasta do app no Dropbox.`

As falhas de senha contam numa trava exponencial (`src/main/drive/restore-lock.ts`)
checada **antes** de qualquer chamada de rede: 2 tentativas livres e, a partir da
terceira, 10 s → 30 s → 1 min → 5 min → 15 min (`driveErrors.restoreLocked`), zerada
por um restore bem-sucedido. Erro de rede não conta na trava.

### `drive.backupInfo() → Promise<BackupSummary | null>`

Metadados do backup remoto (`null` se desconectado, sem backup ou ilegível).
A listagem é paginada (`list_folder` + `list_folder/continue`). `size` usa o tamanho
informado pelo Dropbox, com fallback para os bytes baixados; `works` é `0` se o conteúdo
não for uma lista.

### `drive.disconnect() → Promise<DriveStatus>`

Apaga o segredo `dropbox.tokens` do cofre (falha fechada: com o cofre fechado
nada é apagado às cegas) e devolve o status desconectado. O backup na
nuvem **permanece** (apague a pasta `/Apps/Chronos Biblioteca` pelo Dropbox Web, se quiser;
para cortar o acesso do app, remova-o em `dropbox.com/account/security`).

### `drive.onStatus(cb) → () => void`

Assina o evento `drive:status-changed` (emitido a cada transição: conectar,
sincronizar, erro, desconectar). Devolve a função de cancelamento; chame-a
ao desmontar o componente.

### Erros comuns (pt-BR por padrão, como exibidos no app)

| Mensagem                                                                 | Quando                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `Conecte a conta Dropbox primeiro.`                                      | backup/restauração sem sessão                                                  |
| `Nenhuma biblioteca local para backup. …`                                | backup com biblioteca vazia                                                    |
| `Defina uma senha de criptografia do backup…`                            | backup sem senha configurada                                                   |
| `Sincronização já em andamento.`                                         | backup/restauração paralelos                                                   |
| `Sessão expirada. Conecte a conta Dropbox novamente.`                    | refresh token ausente                                                          |
| `Não foi possível renovar a sessão do Dropbox.`                          | refresh recusado pelo Dropbox                                                  |
| `Senha de criptografia incorreta ou backup corrompido.`                  | restauração com senha errada                                                   |
| `Muitas tentativas de restauração com senha errada. Tente novamente em…` | trava exponencial após a 3ª falha de senha (contada só para `PassphraseError`) |
| `Nenhum backup encontrado na pasta do app no Dropbox.`                   | restauração sem backup remoto                                                  |
| `Backup inválido (library.json corrompido).`                             | backup remoto não é uma lista de obras                                         |
| `Faltam permissões no app Dropbox…`                                      | concessão sem todos os escopos, ou `missing_scope`/`required scope` da API     |
| `Permissões do Dropbox atualizadas. Reconecte…`                          | escopos do app mudaram desde a sessão salva                                    |
| `Erro do Dropbox (HTTP 500)[. Resposta: …]`                              | falha de rede/API sem `error_summary` (traz trecho da resposta)                |

---

## 6. Cofre de segredos

O cofre local, protegido por senha mestra, guarda os segredos do app:
`dropbox.tokens`, `settings.drivePassphrase` e `settings.driveClientId`.
Consulte [`credenciais.md`](credenciais.md) e [`cofre.md`](cofre.md). O domínio
fica em `src/main/vault/*`, e os canais são registrados em `src/main/index.ts`.
Todo fluxo que consome um segredo (Conectar, Backup, Restaurar, Salvar
configurações ou Desconectar) consulta `vault.status()` antes de abrir a tela
de criação ou desbloqueio do cofre. **Sem cofre aberto, não há segredo
nenhum** (falha fechada), e o app nunca grava fora dele.

### `vault.status() → Promise<VaultStatus>`

| Campo       | Tipo      | Notas                                         |
| ----------- | --------- | --------------------------------------------- |
| `exists`    | `boolean` | o arquivo do cofre existe (mesmo ilegível)    |
| `unlocked`  | `boolean` | há chave na sessão (cofre aberto)             |
| `attempts`  | `number`  | tentativas erradas consecutivas (0 = nenhuma) |
| `lockUntil` | `number`  | epoch em ms da trava (0 = sem trava)          |

### `vault.create(password: string) → Promise<VaultResult>`

Cria o cofre já aberto (Argon2id + AES-256-GCM) e re-lê o estado do drive.
Se a pasta em `/var/lib` não puder ser escrita, chama o helper do pacote via
PolicyKit e tenta de novo (`vaultDirUnavailable`; diálogo dispensado =
`vaultAuthCancelled`). Recusa senha previsível (`vaultWeakPassword`) e cofre
já existente (`vaultExists`).

### `vault.unlock(password: string) → Promise<VaultResult>`

Abre o cofre existente. A trava exponencial é checada **antes** do Argon2id
(`vaultLockedOut` com `retryInMs`); senha errada soma tentativa
(`vaultWrongPassword`); container adulterado falha fechada (`vaultTampered`).
Sucesso re-lê o estado do drive.

### `vault.lock() → Promise<VaultStatus>`

Fecha a sessão (zera a chave em memória) e devolve o status. O auto-lock
derruba sozinho após 5 min de inatividade.

### `vault.onLocked(cb) → () => void`

Assina o evento `vault:locked`, enviado quando o auto-lock fecha o cofre. A UI
mostra o aviso `m.vault.autoLocked` e o próximo fluxo de segredo pede o
desbloqueio de novo.

### Códigos de erro (`VaultResult.ok === false`)

| Código                | `retryInMs`     | Quando                                       |
| --------------------- | --------------- | -------------------------------------------- |
| `vaultWeakPassword`   | 0               | senha curta ou previsível na criação         |
| `vaultExists`         | 0               | tentativa de criar um segundo cofre          |
| `vaultMissing`        | 0               | desbloqueio sem cofre                        |
| `vaultLocked`         | 0               | operação com a sessão fechada                |
| `vaultWrongPassword`  | espera da volta | senha errada (soma tentativa)                |
| `vaultLockedOut`      | espera restante | tentativa durante a trava exponencial        |
| `vaultTampered`       | 0               | container ilegível/alterado (falha fechada)  |
| `vaultDirUnavailable` | 0               | pasta do cofre sem permissão de escrita      |
| `vaultAuthCancelled`  | 0               | usuário dispensou o pedido de senha (pkexec) |

---

## 7. Protocolos `cover://` e `chronos://`

Capas servidas como `cover://<arquivo>` (scheme privilegiado: `standard`,
`secure`, `supportFetchAPI`, `stream`), com `Content-Type` por extensão e
`Cache-Control: max-age=3600`. Respostas: `200` (bytes), `404` (ausente ou
nome vazio), `500` (URL inválida). Nomes são higienizados com `basename`
(anti path-traversal).

Em produção, a SPA vem pelo scheme `chronos://` (desde a 1.5.0), implementado
em `src/main/protocols.ts` por `registerAppProtocol`: mapeia o pathname da URL
para `out/renderer`, com `..` rejeitado (`path.resolve` + verificação de
prefixo) e não usa `file://`.

---

## 8. Esquemas

### `Work`

| Campo       | Tipo         | Obrigatório | Notas                                                 |
| ----------- | ------------ | ----------- | ----------------------------------------------------- |
| `id`        | `string`     | sim         | identificador único                                   |
| `title`     | `string`     | sim         | título da obra                                        |
| `synopsis`  | `string`     | sim         | descrição livre                                       |
| `type`      | `WorkType`   | sim         | `webtoon` `manhwa` `manhua` `manga` `livro` `outro`   |
| `status`    | `WorkStatus` | sim         | `planejado` `lendo` `pausado` `concluido` `cancelado` |
| `progress`  | `number`     | sim         | capítulos (`Cap. X`), `>= 0`, sem teto                |
| `marker`    | `string`     | não         | ex.: `Cap. 45`, `Vol. 3`                              |
| `coverFile` | `string`     | não         | arquivo em `covers/` (ver §7)                         |
| `category`  | `string`     | não         | ex.: `Isekai`                                         |
| `createdAt` | `string`     | sim         | ISO 8601 (gerado pelo main)                           |
| `updatedAt` | `string`     | sim         | ISO 8601 (renovado a cada save)                       |

Transições de status válidas no card: `planejado→{concluido,pausado,cancelado}`,
`lendo→{concluido,pausado,cancelado}`, `pausado→{lendo,concluido,cancelado}`,
`cancelado→{lendo}`, `concluido→{lendo}`. No modal, qualquer estado pode ir
para qualquer outro; **Zerar** volta para `planejado` + progresso `0`.
Marcar `concluido` não altera o número salvo (o card exibe `100%`).

### Demais esquemas

Ver `AppSettings` (§4), `DriveStatus` e `BackupSummary` (§5), `VaultStatus` e
`VaultResult` (§6) acima; tipos-fonte em `src/types/settings.ts`,
`src/types/drive.ts` e `src/types/vault.ts`.
