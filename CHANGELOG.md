# Registro de mudanças

Todos os lançamentos seguem [versionamento semântico](https://semver.org/lang/pt-BR/)
(`MAJOR.MINOR.PATCH`) e o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
em português do Brasil.

## [Não publicado]

## [1.0.0] - 2026-10-04

Primeira versão pública do **Webtoons Biblioteca** (pacote `.deb` para Linux Mint).

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
