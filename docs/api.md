# Referência da API interna (`window.api`)

Documentação completa da ponte entre a interface (renderer/React) e o processo
principal (main/Electron) do **Webtoons Biblioteca**, no padrão de referências
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

| `window.api`           | Canal IPC           | Origem dos dados                              |
| ---------------------- | ------------------- | --------------------------------------------- |
| `library.get()`        | `library:get`       | `library.json` local                          |
| `library.save(obra)`   | `library:save`      | cria/atualiza obra + `library.json`           |
| `library.remove(id)`   | `library:delete`    | remove obra + limpa capa órfã                 |
| `pickCover()`          | `cover:pick`        | diálogo do SO → copia para `covers/`          |
| `settings.get()`       | `settings:get`      | `settings.json` local                         |
| `settings.set(cfg)`    | `settings:set`      | normaliza e grava `settings.json` (modo 0600) |
| `drive.status()`       | `drive:status`      | estado em memória (+ `drive-tokens.json`)     |
| `drive.auth()`         | `drive:auth`        | OAuth PKCE + loopback `127.0.0.1`             |
| `drive.backup()`       | `drive:backup`      | criptografa e envia ao `appDataFolder`        |
| `drive.restore(senha)` | `drive:restore`     | baixa, decifra e substitui a biblioteca       |
| `drive.backupInfo()`   | `drive:backup-info` | metadados do `library.json` remoto            |
| `drive.disconnect()`   | `drive:disconnect`  | apaga `drive-tokens.json` local               |
| `drive.onStatus(cb)`   | evento (sem invoke) | assina `drive:status-changed`                 |

---

## 2. Convenção de respostas

Métodos do Drive devolvem um envelope de resultado — **nunca lançam**:

```ts
{ ok: true, summary?: BackupSummary } // sucesso
{ ok: false, error: 'mensagem em pt-BR' } // falha
```

Métodos de biblioteca/configurações devolvem os dados direto (ou `null` onde
indicado). Erros de Drive usam sempre mensagens em pt-BR (ver §5).

---

## 3. Biblioteca

### `library.get() → Promise<Work[]>`

Devolve todas as obras salvas (`library.json`). Lista vazia se ainda não há
obras — nunca `null`.

### `library.save(obra) → Promise<Work[]>`

Cria ou atualiza uma obra e devolve a lista completa atualizada.

- Entrada: `Omit<Work, 'createdAt' | 'updatedAt'>` (os carimbos são gerados
  pelo main; `updatedAt` é renovado a cada salvamento).
- `progress` é fixado em `>= 0` (`clampProgress`), sem limite superior.
- Uma obra `concluida` cujo progresso muda volta para `lendo` (regra de UI).

### `library.remove(id: string) → Promise<Work[]>`

Remove a obra e apaga o arquivo de capa órfão, se houver. Devolve a lista
restante. Remover um `id` inexistente devolve a lista inalterada.

### `pickCover() → Promise<string | null>`

Abre o diálogo nativo (JPG/JPEG/PNG/WebP/GIF/AVIF/BMP), copia a imagem para
`covers/` com nome único e devolve o nome do arquivo. Devolve `null` se o
usuário cancelar. A imagem é servida pelo protocolo interno (§6).

---

## 4. Configurações

### `settings.get() → Promise<AppSettings>`

```ts
interface AppSettings {
  driveClientId: string; // '' = usa as credenciais embutidas
  driveClientSecret: string; // '' = usa as credenciais embutidas
  drivePassphrase: string; // senha de criptografia do backup (obrigatória p/ backup)
}
```

Campos ausentes ou com tipo errado no disco caem para `''` (padrão seguro).

A senha (`drivePassphrase`) é guardada no keyring do SO via `safeStorage`
quando disponível (`enc:<base64>` em `settings.json`); sem keyring, em claro
com permissão `0600` (fallback), e instalações antigas migram sozinhas no
próximo salvamento. `settings.set` sempre devolve a forma utilizável (o
formulário nunca exibe o blob `enc:`).

### `settings.set(cfg: AppSettings) → Promise<AppSettings>`

Normaliza (`trim` em ID/secret; senha preservada como digitada), grava
`settings.json` com permissão `0600` e devolve o valor salvo.

---

## 5. Google Drive

Fluxo completo em [`google-drive.md`](google-drive.md). Resumo dos métodos:

### `drive.status() → Promise<DriveStatus>`

```ts
interface DriveStatus {
  connected: boolean; // há tokens válidos em memória
  syncing: boolean; // backup/restauração em andamento
  lastSync: string | null; // ISO 8601 do último backup
  lastError: string | null; // última falha (pt-BR), ou null
  accountEmail: string | null; // e-mail da conta conectada
}
```

### `drive.auth() → Promise<{ ok: boolean; error?: string }>`

Abre o navegador (PKCE + loopback em `127.0.0.1`), troca o código por tokens e
grava `drive-tokens.json` (modo `0600`). Falhas típicas: `access_denied`
(usuário recusou), `Tempo esgotado aguardando autorização.`,
`Falha ao obter tokens (HTTP).`.

### `drive.backup() → Promise<{ ok: boolean; error?: string; summary?: BackupSummary }>`

Pré-condições, nesta ordem: conta conectada, biblioteca local não vazia,
senha de criptografia definida, nenhuma sincronização em andamento. Envia
`library.json` + capas **sempre criptografados** ao espaço oculto
`appDataFolder` e apaga arquivos remotos órfãos.

Cifra (ver `src/main/drive/crypto.ts`): AES-256-GCM com chave de 32 bytes
derivada por **scrypt explícito** (`N=2¹⁶`, `r=8`, `p=1`), salt de 16 e IV de
12 bytes aleatórios por arquivo, tag de 16 bytes verificada na leitura.
Formato atual `WTENC2`; backups antigos `WTENC1` (scrypt padrão) continuam
restauráveis. A migração da pasta legada recifra arquivos em claro quando há
senha configurada (nunca há dupla criptografia).

Nomes remotos opacos: nada com `library.json` ou nome de capa viaja em claro.
Cada upload usa `HMAC-SHA256(chaveDeNomes, nomeLocal)` como nome remoto (chave
determinística derivada da senha por scrypt, só para nomes — o conteúdo usa
outra chave), mais um **manifesto cifrado** (`manifest.json` → HMAC)
`{ nomeRemoto: nomeLocal }` gravado por último como "commit" do backup. A
restauração e o `backupInfo` resolvem os nomes pelo manifesto, com fallback
para backups legados em claro; manifesto ausente sem legado = "nenhum
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

Baixa o backup, decifra com a senha, valida item a item e **substitui** a
biblioteca local (incluindo capas). Senha errada ou arquivo corrompido:
`Senha de criptografia incorreta ou backup corrompido.` Sem backup remoto:
`Nenhum backup encontrado no espaço oculto do Drive.`

### `drive.backupInfo() → Promise<BackupSummary | null>`

Metadados do backup remoto (`null` se desconectado, sem backup ou ilegível).
`size` usa o tamanho informado pelo Drive, com fallback para os bytes
baixados; `works` é `0` se o conteúdo não for uma lista.

### `drive.disconnect() → Promise<DriveStatus>`

Apaga `drive-tokens.json` local e devolve o status desconectado. O backup na
nuvem **permanece** (apague-o pelo Drive Web, se quiser).

### `drive.onStatus(cb) → () => void`

Assina o evento `drive:status-changed` (emitido a cada transição: conectar,
sincronizar, erro, desconectar). Devolve a função de cancelamento — chame-a
ao desmontar o componente.

### Erros comuns (pt-BR, como exibidos no app)

| Mensagem                                                | Quando                                        |
| ------------------------------------------------------- | --------------------------------------------- |
| `Conecte a conta Google primeiro.`                      | backup/restauração sem sessão                 |
| `Nenhuma biblioteca local para backup. …`               | backup com biblioteca vazia                   |
| `Defina uma senha de criptografia do backup…`           | backup sem senha configurada                  |
| `Sincronização já em andamento.`                        | backup/restauração paralelos                  |
| `Sessão expirada. Conecte a conta Google novamente.`    | refresh token ausente                         |
| `Não foi possível renovar a sessão do Google Drive.`    | refresh recusado pelo Google                  |
| `Senha de criptografia incorreta ou backup corrompido.` | restauração com senha errada                  |
| `Nenhum backup encontrado no espaço oculto do Drive.`   | restauração sem backup remoto                 |
| `Backup inválido (library.json corrompido).`            | backup remoto não é uma lista de obras        |
| `Permissões do Google atualizadas. Reconecte…`          | escopos do app mudaram desde a sessão salva   |
| `Erro do Google Drive (HTTP 500).`                      | falha de rede/API sem corpo JSON aproveitável |

---

## 6. Protocolo `cover://`

Capas servidas como `cover://<arquivo>` (scheme privilegiado: `standard`,
`secure`, `supportFetchAPI`, `stream`), com `Content-Type` por extensão e
`Cache-Control: max-age=3600`. Respostas: `200` (bytes), `404` (ausente ou
nome vazio), `500` (URL inválida). Nomes são higienizados com `basename`
(anti path-traversal).

---

## 7. Esquemas

### `Work`

| Campo       | Tipo         | Obrigatório | Notas                                                 |
| ----------- | ------------ | ----------- | ----------------------------------------------------- |
| `id`        | `string`     | sim         | identificador único                                   |
| `title`     | `string`     | sim         | título da obra                                        |
| `synopsis`  | `string`     | sim         | descrição livre                                       |
| `type`      | `WorkType`   | sim         | `webtoon` `manhwa` `manhua` `manga` `livro` `outro`   |
| `status`    | `WorkStatus` | sim         | `planejado` `lendo` `pausado` `concluido` `cancelado` |
| `progress`  | `number`     | sim         | porcentagem, `>= 0`, sem teto                         |
| `marker`    | `string`     | não         | ex.: `Cap. 45`, `Vol. 3`                              |
| `coverFile` | `string`     | não         | arquivo em `covers/` (ver §6)                         |
| `category`  | `string`     | não         | ex.: `Isekai`                                         |
| `createdAt` | `string`     | sim         | ISO 8601 (gerado pelo main)                           |
| `updatedAt` | `string`     | sim         | ISO 8601 (renovado a cada save)                       |

Transições de status válidas no card: `planejado→{concluido,pausado,cancelado}`,
`lendo→{concluido,pausado,cancelado}`, `pausado→{lendo,concluido,cancelado}`,
`cancelado→{lendo}`, `concluido→{lendo}`. No modal, qualquer estado pode ir
para qualquer outro; **Zerar** volta para `planejado` + progresso `0`.
Marcar `concluido` não altera o número salvo (o card exibe `100%`).

### Demais esquemas

Ver `AppSettings` (§4), `DriveStatus` e `BackupSummary` (§5) acima — tipos-fonte
em `src/types/settings.ts` e `src/types/drive.ts`.
