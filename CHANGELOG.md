# Registro de mudanças

Todos os lançamentos seguem [versionamento semântico](https://semver.org/lang/pt-BR/)
(`MAJOR.MINOR.PATCH`) e o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
em português do Brasil.

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
