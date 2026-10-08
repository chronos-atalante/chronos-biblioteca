# Registro de mudanças

Todos os lançamentos seguem [versionamento semântico](https://semver.org/lang/pt-BR/)
(`MAJOR.MINOR.PATCH`) e o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
em português do Brasil.

## [1.6.1](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.5.0...v1.6.1) (2026-10-08)

### Features

- README e estilos: seção de solução de problemas no `README.md` (sintomas
  comuns e o que verificar antes de reportar) e componentes revisados em
  `src/renderer/src/style/styles.css`.

### Bug Fixes

- traduções: revisão das 5 línguas (pt-BR, en, ko, zh-CN e ja) no app e no
  site: item de privacidade com o texto do link duplicado (zh-CN), ordem de
  frases e partículas (ko), frases quebradas nas doações e botão de conclusão
  (ja), pontuação com `…` e textos das doações (pt-BR), concordância e
  maiúsculas (en); rótulo do pílula de backup (`drivePill.off`) alinhado e
  `translationNotice.title` traduzido nos 4 idiomas.
- site: espaço e ponto finais das frases com link saíram do JSX e passaram a
  viver no dicionário (`*Lead`/`*Mid`/`*End` em `src/i18n/`), removendo os
  espaçamentos fixos entre termos CJK em `HomeContent` e `PrivacidadeContent`.

### Documentação

- japonês (`ja`) incluído nas listas de idioma que ainda citavam só 4 línguas:
  `docs/api.md`, `docs/messages.md`, `docs/openapi.yaml`, `README.md`,
  `AGENTS.md` e, na landing, `doc/i18n.md`, `doc/openapi.yaml`,
  `doc/paginas.md`, `doc/README.md` e `doc/arquitetura.md` (o idioma já
  estava no app e no site desde a 1.5.0).

## [1.5.0](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.4.0...v1.5.0) (2026-10-07)

### Features

- backup: trava exponencial na restauração com senha errada
  (`src/main/drive/restore-lock.ts`): as duas primeiras falhas são livres e,
  a partir da terceira, a espera sobe 10 s → 30 s → 1 min → 5 min até o teto
  de 15 min, sempre antes de qualquer chamada de rede; sucesso no fim da
  tentativa zera a trava. Conta só `PassphraseError`, então erro de rede não
  atrasa a próxima tentativa (`driveErrors.restoreLocked` nos 4 idiomas).
- obras: régua de id (`isValidWorkId`) na entrada por IPC e na restauração:
  UUID ou id curto sem separador de caminho; id fora da regra vindo da nuvem
  vira UUID novo, o import de capa ignora id preferido inválido e o
  `upsertWork`/`deleteWork` recusam `..`, `/` e `\` (defesa em profundidade,
  classe CVE-2026-21589; `libraryErrors.invalidId` nos 4 idiomas).
- infraestrutura: escrita de JSON atômica com permissão
  (`writeJsonAtomic`, `src/main/jsonfile.ts`) para `library.json`,
  `settings.json` e `dropbox-tokens.json`, e diretórios XDG extraídos para
  `src/main/paths.ts` (quebra o ciclo `library` ↔ `settings` ↔ `drive`).

### Segurança

- janela: navegação presa na página do app (`will-navigate` recusa qualquer
  URL fora da página carregada, mantendo o `setWindowOpenHandler` que só
  repassa `https:` para o navegador do sistema).
- sessão: toda permissão web do renderer (mídia, geolocalização,
  notificações…) é negada; só o clipboard passa, para o modal de doação.
- produção: DevTools desligado no app empacotado (`devTools:
!app.isPackaged`).
- IPC pelo frame oficial: todo handler chegou com `assertAppFrame(event)`, que
  confere `event.senderFrame` contra a página do scheme `chronos://` (ou o Vite
  dev server), bloqueando qualquer frame de fora antes do domínio.
- renderer entregue via scheme `chronos://` em produção (`registerAppProtocol`
  serve `out/renderer`), em vez de `file://`; CSP com `object-src 'none';
base-uri 'self'; frame-ancestors 'none'; form-action 'self'` nos dois
  lugares.
- `electronFuses` no electron-builder: `runAsNode: false`,
  `enableNodeOptionsEnvironmentVariable: false`,
  `enableNodeCliInspectArguments: false`, `enableCookieEncryption: true`,
  `onlyLoadAppFromAsar: true` e
  `grantFileProtocolExtraPrivileges: false`.

### Documentação

- `SECURITY.md` com as proteções novas (janela e sessão contidas, trava de
  restauração, régua de id e escrita atômica), `docs/api.md` com a mensagem
  de trava na tabela de erros e o travamento em `drive.restore`, e
  `docs/dropbox.md` com o sintoma na tabela de problemas.

## [1.4.0](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.3.0...v1.4.0) (2026-10-07)

### Features

- idioma: chinês simplificado (`zh-CN`, 简体中文) na interface do app e no
  site, escolhido em Configurações e persistido em `settings.json` (textos em
  `src/messages/zh-CN.ts`; detecção `zh-*` e seletor PT/EN/KO/中 na landing;
  ver `docs/messages.md`).
- configurações: aviso na tela de Configurações quando o cofre do sistema está
  indisponível (canal IPC `settings:keyring` com `settings.keyringWarning`
  nos 4 idiomas), em vez de cair em silêncio no fallback em claro.

### Bug Fixes

- privacidade: caminhos de persistência corrigidos na política do site, no
  `README.md` e no `AGENTS.md` (obras e capas em `~/.local/share/`, configs e
  tokens em `~/.config/`), incluindo a instrução de exclusão.
- textos: pontuação restaurada nas mensagens em pt-BR e en (parênteses e ponto
  e vírgula onde a remoção de travessões tinha truncado frases) e progresso
  descrito em capítulos no site (era "porcentagem"), com o tipo "outro" na
  lista.
- doações: removidas as menções ao QR Code Pix (`README.md` e
  `docs/doacoes.md`); o modal oferece link do Mercado Pago e botão de copiar.
- metadados: `homepage` e `maintainer` do pacote apontam para o repositório e
  o e-mail oficiais; exemplo de instalação local usa glob de versão;
  workflow do CI no Node 24 e scripts de limpeza sem `rimraf`.

## [1.3.0](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.2.1...v1.3.0) (2026-10-06)

### Features

- categorias: lista ampliada de 16 para 56 gêneros e `Select` pesquisável na
  Categoria da obra (campo "Digite para filtrar…", sem diferenciar acentos ou
  maiúsculas, com mensagem de vazio).
- idioma: coreano (`ko`, 한국어) na interface do app, escolhido em
  Configurações e persistido em `settings.json` (textos em `src/messages/ko.ts`;
  ver `docs/messages.md`).

## [1.2.1](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.1.2...v1.2.1) (2026-10-06)

### Features

- backup: contrato `BackupProvider` com catálogo de provedores na seção
  "Provedores de backup" das Configurações (canal IPC `drive:providers`):
  Dropbox operante e Google Drive documentado como não operante (destino
  `appDataFolder`; ver `docs/backup-providers.md`).
- backup: formato de arquivo único `WTENC3` (scrypt `N=2¹⁷`, `r=8`, `p=1`)
  no lugar dos legados `WTENC1`/`WTENC2` e da função `encryptIfNeeded`.
- idioma: interface em português (Brasil) ou inglês, escolhido em
  Configurações e persistido em `language`; textos centralizados em
  `src/messages/` (ver `docs/messages.md`).
- configurações: botão **Fechar** no rodapé do modal.
- configurações: App key do Dropbox embutida no binário (em cliente PKCE a
  chave é pública por definição); `driveClientId` no `settings.json` passa a
  ser override opcional e a UI não pergunta mais a chave.

### Bug Fixes

- segurança: salt aleatório por cadeia no manifesto v2 de nomes do backup,
  em vez de derivar o mesmo salt fixo da senha.
- segurança: respostas da API do Dropbox passam por validação de forma
  (`parseJson` → `unknown` com guards) e `openExternalSafe` só abre `https:`.
- segurança: `build/postrm` usa o nome correto do pacote (casing) e as
  Actions do GitHub ficam fixadas por SHA.
- dev: os webfonts do FontAwesome deixam de ser recusados (HTTP 403) pelo
  servidor do Vite no `npm run dev` (`server.fs.allow` no renderer).

### Documentação

- `SECURITY.md` passa a registrar a política de segurança e os riscos
  aceitos (porta do callback OAuth, senha sem keyring e `braces` na landing);
  `api.md`/`dropbox.md`/`README.md` refletem a chave embutida e as URLs do
  repo APT flat da Release.

## [1.1.2](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.1.1...v1.1.2) (2026-10-06)

### Bug Fixes

- embalagem: o `after-pack` não remove mais o `libffmpeg.so`, o binário do
  Electron o declara como `DT_NEEDED` e o 1.1.1 abria apenas o ícone,
  morrendo com "error while loading shared libraries: libffmpeg.so".

## [1.1.1](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.1.0...v1.1.1) (2026-10-05)

### Bug Fixes

- detecta escopos faltantes no Dropbox e orienta a correção ([29f009f](https://github.com/chronos-atalante/chronos-biblioteca/commit/29f009fc89b67f1024534afc2b69b038c252773d))

## [1.1.0](https://github.com/chronos-atalante/chronos-biblioteca/compare/v1.0.2...v1.1.0) (2026-10-05)

### Features

- migra backup em nuvem do Google Drive para o Dropbox ([c55190e](https://github.com/chronos-atalante/chronos-biblioteca/commit/c55190e62250866841bfcbf93c1d2bae2f8b020e))

### Bug Fixes

- corrige tipos do upload no Dropbox (autorename/mute booleanos) ([59454b5](https://github.com/chronos-atalante/chronos-biblioteca/commit/59454b5b630231436e6f680df9ac69e2921dbfc1))

## [1.0.2] - 2026-10-05

### Adicionado

- Página **Atribuições**: botão ao lado da pílula do Drive abre os créditos
  das dependências em rolagem lenta e contínua (estilo pós-créditos de
  cinema), com pausar/continuar e respeito a `prefers-reduced-motion`
  (detalhes em `docs/atribuicoes.md`).
- Página **Doações**: botão **Doar** no cabeçalho abre a página de apoio ao
  projeto, com link do Mercado Pago (abre no navegador do sistema) e botão
  de copiar (detalhes em `docs/doacoes.md`).

## [1.0.1] - 2026-10-04

### Segurança

- Chaves OAuth do Google atualizadas (novo `client_id`/`client_secret`).
- Cifra do backup com scrypt explícito (`N=2¹⁶`, `r=8`, `p=1`) e formato
  `WTENC2`, mantendo leitura dos backups antigos `WTENC1`.
- Migração da pasta legada recifra arquivos em claro quando há senha
  configurada (sem dupla criptografia).
- OAuth: e-mail da conta via header `Authorization` (fora da URL) e validação
  da resposta de tokens antes de usar (falha fechada).
- Senha de backup no keyring do SO (`safeStorage`, com fallback `0600`) e
  nomes remotos opacos (HMAC-SHA256 + manifesto cifrado).

## [1.0.0] - 2026-10-04

Primeira versão pública do **Chronos Biblioteca** (pacote `.deb` para Linux Mint).

### Adicionado

- Biblioteca em grade: capa, título, descrição, tipo (`webtoon`, `manhwa`,
  `manhua`, `mangá`, `livro`, `outro`), status e progresso com ajuste fino
  (`↑`/`↓`, `−10`/`+10`, concluir, zerar).
- Capas locais servidas pelo protocolo interno `cover://` (com cache e
  proteção anti path-traversal).
- Busca por título/descrição, filtros por status e estatísticas
  (contador + progresso médio do filtro + total da biblioteca).
- Backup manual no Google Drive: OAuth PKCE embutido, espaço oculto
  `appDataFolder`, arquivos sempre criptografados (AES-256-GCM + scrypt),
  restaurar com senha e migração automática da pasta legada.
- Janela nativa sem barra de menus (sem File/Edit/View), com encaixe
  (tiling) do gerenciador de janelas e `F11` para tela cheia.
- Scripts `clean`/`build`/`dist` (limpeza com rimraf) e empacotamento `.deb`.
- Documentação: referência da API interna em padrão Swagger
  (`docs/api.md` + `docs/openapi.yaml`), guia de backup
  (`docs/google-drive.md`) e arquivos de governança
  (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`).
