# Política de segurança

> O **mapa** medida → arquivo (para quem vai mexer no código) está em
> [`docs/seguranca.md`](docs/seguranca.md). Este documento é o texto
> normativo: o que já protege, o que aceitamos e como reportar.

## Versões suportadas

| Versão | Suporte             |
| ------ | ------------------- |
| 1.5.x  | ✅ Correções ativas |

Versões anteriores à linha suportada não recebem correções; atualize pelo `.deb` mais
recente (`npm run dist` gera em `release/`).

## Como reportar uma vulnerabilidade

**Não abra issue pública.** Descreva a falha em sigilo para quem mantém o
projeto (ver `author` em `package.json`), incluindo se possível:

- o que acontece e o impacto estimado;
- passo a passo para reproduzir;
- versão do app (`1.0.0` em `package.json`) e do sistema.

Nos comprometemos a confirmar o recebimento, investigar e, confirmado o
problema, publicar a correção com crédito a quem reportou (salvo pedido em
contrário).

## Proteções já existentes

- **Cofre de segredos**: tokens do Dropbox, senha de backup e App key
  alternativa sob uma senha mestra (Argon2id de 128 MiB + AES-256-GCM),
  guardados em `/var/lib/.chronos-biblioteca/.vault/vault.zkv` (`0600`,
  escrita atômica), fora de `~` para sobreviver à limpeza do home. A árvore é
  criada no `postinst` (raiz `0711 root:root` sem listagem, vault `0700` do
  usuário) e reparada pelo app só via PolicyKit (`pkexec` + helper do pacote,
  senha do sistema nunca vista pelo app). Container fail-closed (leitura
  inválida = adulterado), chave-mestra só na memória da sessão, auto-lock de 5
  minutos e trava exponencial (10 s → 24 h) checada **antes** do Argon2id
  (`docs/cofre.md`).
- **Sem cofre não há segredo**: com o cofre fechado ou ausente, `loadSettings`
  devolve `''`, `loadState` zera os tokens e gravar lança `vaultLocked` antes
  de tocar em disco (falha fechada). Não existe mais caminho legado com
  `safeStorage`/keyring nem arquivo `dropbox-tokens.json`: o app lê e grava
  segredo **só** no cofre.
- **Tokens só na máquina**: no cofre (`dropbox.tokens`), nunca em arquivo em
  claro nem em repositório (coberto pelo `.gitignore`).
- **Backup sempre criptografado**: AES-256-GCM com chave derivada por scrypt
  explícito (`N=2¹⁷`, `r=8`, `p=1`; mínimo atual do OWASP; salt e IV
  aleatórios por arquivo, tag verificada na leitura). Formato único
  `WTENC3`; o Dropbox guarda só blobs cifrados.
- **Nomes remotos opacos**: HMAC-SHA256 com chave de nomes derivada da senha
  - mesmo custo da cifra (`N=2¹⁷`): o nome do `library.json` é adivinhável e
    permite testar senhas candidatas offline sem decifrar nada.
  - os nomes de conteúdo usam um **salt aleatório por cadeia de backup**,
    gravado no manifesto cifrado (formato v2); o próprio manifesto é
    localizado por uma chave com salt fixo, porque precisa ser encontrável em
    qualquer máquina sem estado prévio. Manifestos v1 (sem salt) são legíveis
    e migram sozinhos no próximo backup.
  - manifesto cifrado (nome remoto → nome local). Ao Dropbox restam visíveis
    só a quantidade aproximada e o tamanho dos blobs (limitação da API;
    tamanhos exatos não têm como ser ocultados sem padding).
- **Senha de backup protegida**: `drivePassphrase` mora no cofre (Argon2id +
  AES-256-GCM). Não há fallback em claro nem depender do `safeStorage` do SO:
  sem cofre aberto a senha simplesmente não existe para o app.
- **Escopos mínimos**: o Dropbox recebe só `account_info.read`,
  `files.metadata.read`, `files.metadata.write`, `files.content.read` e
  `files.content.write`, limitados à App folder. Quando o Google Drive for
  ativado, o destino será a pasta oculta `appDataFolder` (`drive.appdata`),
  sem acesso ao restante do Drive (`docs/backup-providers.md`).
- **Sem servidor intermediário**: do PC direto para o Dropbox (`fetch` nativo).
- **Credenciais embutidas**: a proteção vem do PKCE + loopback (não há
  `client_secret` em uso); não reporte isso como falha.
- **URLs externas só por `https:`**: o `shell.openExternal` é acionado pelo
  helper `openExternalSafe` (`src/main/external.ts`), que recusa qualquer
  protocolo fora de `https:` vindo do renderer ou do fluxo OAuth.
- **Janela e sessão contidas**: a navegação do renderer fica presa à página do
  app (`will-navigate` recusa salto para outra URL), o `setWindowOpenHandler`
  nunca cria janela dentro do app, toda permissão web da sessão é negada no
  renderer menos o clipboard (modal de doação) e o DevTools está desligado no
  app empacotado (`devTools: !app.isPackaged`).
- **Restauração com trava exponencial**: senha errada não é punida na hora
  (2 tentativas livres), mas a partir da terceira a espera sobe 10 s → 30 s →
  1 min → 5 min até 15 min, checada **antes** de qualquer chamada de rede;
  conta só `PassphraseError`, nunca erro de rede, e o sucesso zera a trava
  (`src/main/drive/restore-lock.ts`).
- **Ids sem caminho**: `isValidWorkId` rejeita `..`, `/` e `\` nos ids aceitos
  pela IPC e nos vindos da nuvem (o id inválido vira UUID novo), inclusive no
  nome de capa importado (defesa em profundidade, classe CVE-2026-21589).
- **Escrita de JSON atômica**: `library.json`, `settings.json` e
  `dropbox-tokens.json` são gravados em `.tmp` e renomeados por cima (nunca
  JSON pela metade), com `0600` onde há credencial; o container do cofre segue
  a mesma regra (`vault.zkv.tmp` + `rename`, `0600`)
  (`src/main/jsonfile.ts`, `src/main/vault/vault.ts`).
- **IPC fechado por origem**: todo handler confere `event.senderFrame` contra a
  página oficial do app (scheme `chronos://` em produção ou dev server do
  Vite), bloqueando a mensagem antes do domínio tocar.
- **Sem `file://` em produção**: o renderer é servido por `chronos://`
  (`registerAppProtocol` com path-traversal rejeitado), e o
  `grantFileProtocolExtraPrivileges` está desligado via fuse.
- **Fuses do Electron**: `runAsNode: false`, `NODE_OPTIONS` e inspetor de
  `--inspect` desligados, `enableCookieEncryption: true`,
  `onlyLoadAppFromAsar: true`
  no `electron-builder`.
- **Confinamento AppArmor**: o `.deb` instala um perfil restritivo em
  `/etc/apparmor.d/chronos-biblioteca` (o `postinst` do electron-builder pula
  onde AppArmor não suporta `abi/4.0`). O processo instalado só escreve nos
  próprios diretórios no home, só executa o binário do pacote e o `xdg-open`,
  e usa rede apenas em `stream` e `dgram` (HTTPS e DNS do Dropbox). A leitura
  do home é ampla porque o seletor de capa abre arquivo de qualquer pasta,
  mas uma deny-list cobre credenciais (`.ssh`, `.gnupg`, chaveiros, perfis de
  navegador inclusive Brave, cofre/Cookies do Guardinha, `.aws`, `.docker`,
  `.kube`, `.netrc`, `.git-credentials`) (`build/apparmor-profile`; ciclo de
  teste em `docs/build.md`).
- **Dependências auditadas**: `npm run security:audit` (OSV Scanner) roda em
  todo `npm run check`, que com `npm test` é **gate** do `publish.yml`: falha
  de tipo, lint, formato, vulnerabilidade ou teste interrompe a publicação
  antes de qualquer tag ou `.deb` (`docs/build.md`).

## Modelo de ameaça do cofre

O cofre protege os segredos do app contra leitura direta do disco: alguém com
cópia do `vault.zkv` (backup, HD apagado, outro usuário do mesmo PC) vê só
bytes e precisa da senha mestra, sujeita à trava exponencial; na prática,
chegar ao arquivo exige sudo (raiz `0711 root:root` em
`/var/lib/.chronos-biblioteca`, vault `0700` do usuário). Ele **não** protege
contra:

- **Atacante com o usuário logado e o app desbloqueado**: a chave está em
  memória e os fluxos funcionam normalmente; quem está na sessão do SO com o
  app aberto pode usar (ou despejar) o que o app acessa. Mesma classe do
  "acesso físico ao PC já desbloqueado", fora de escopo abaixo.
- **Engenharia social**: a senha mestra é a única barreira; não há recuperação
  sem ela (esqueceu a senha = refaça o cofre e reconecte o Dropbox).
- **Malware de usuário no mesmo PC**: rodando com os seus privilégios, lê a
  memória do processo ou a biblioteca local; nenhum cofre de usuários resolve
  isso.
- **Quem controla a nuvem**: o Dropbox vê apenas blobs cifrados do backup
  (senha separada da mestra), mas o cofre não muda isso.

## Riscos aceitos (com justificativa)

- **Porta fixa do callback OAuth (`localhost:17431`)**: exigência do App
  Console do Dropbox (redirect URI cadastrada). Um processo malicioso na
  mesma máquina poderia escutar nessa porta, mas isso exige acesso local ao
  PC, fora de escopo (ver abaixo).
- **Dependências sem fix upstream**: problemas reportados em dependências de
  desenvolvimento sem versão corrigida publicada são documentados no README
  da parte correspondente e monitorados (ex.: `braces` na landing).
- **Leitura ampla do home no perfil AppArmor**: exigida pelo seletor de capa
  (`cover:pick` lê o arquivo escolhido em qualquer pasta). A deny-list cobre
  as credenciais usuais, mas pastas sensíveis não listadas ficam legíveis pelo
  processo — e o AppArmor clássico não filtra host de destino da rede, só o
  tipo de socket (`stream`/`dgram`), então a barreira contra exfiltração
  continua sendo a criptografia do backup, não a rede.
- **`xdg-open` fora do confinamento**: a única execução permitida de fora do
  pacote é o abridor de URLs do sistema (`ux` no perfil), acionado apenas por
  `openExternalSafe` com `https:`; a cadeia que ele dispara (shell →
  navegador) roda sem confinamento.

## Fora de escopo

- Engenharia social, spam e ataques a serviços de terceiros (Dropbox, Google,
  npm).
- Falhas que exijam acesso físico ao PC já desbloqueado do usuário.
