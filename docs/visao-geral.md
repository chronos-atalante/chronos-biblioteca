# Visão geral

O Cronologia é um aplicativo desktop para anotar o **progresso das suas
leituras** (webtoons, manhwas, manhuas, mangás, livros e outros): capa, título,
descrição, barra de progresso em capítulos e marcação de conclusão, com
**backup manual criptografado no Dropbox**. Roda em Electron, é escrito em
TypeScript com React na interface e é empacotado como `.deb` para o Linux Mint.

Tudo é local: a biblioteca mora na sua máquina, e a nuvem só é usada quando
você mesmo clica em **Fazer backup agora** (ou **Restaurar**), pela pasta do
app no Dropbox.

## O que o app não é

- Não é nuvem nem serviço com conta: não há backend, telemetria nem analytics;
  nenhuma biblioteca sai da máquina sem ação sua.
- Não é leitor: ele anota progresso; a leitura acontece onde você já lê.
- Não sincroniza em tempo real: o backup é manual, por escolha sua, e o
  restaurar substitui a biblioteca local pela versão da nuvem.
- Não é gerenciador de senhas para o usuário: o cofre de segredos interno
  protege **os dados do próprio app** (tokens do Dropbox e a senha de
  criptografia do backup), não credenciais de sites suas.
- Não preenche formulários nem abre o conteúdo da obra dentro do app: capas são
  imagens locais servidas pelo protocolo `cover://`.
- Não tem login por biometria, SSO nem compartilhamento de biblioteca com
  outras pessoas.

## O que ele faz

- Mantém a biblioteca em grade com capa, tipo, status e progresso, com busca e
  filtros por status, e gravação atômica em `library.enc` (cifrado com a
  chave do cofre).
- Copia a imagem de capa escolhida do disco para a biblioteca local e a serve
  pelo protocolo interno `cover://`.
- Faz backup do `library.json` e das capas **sempre criptografados**
  (AES-256-GCM com nomes de arquivo opacos) na pasta do app do Dropbox
  (`/Apps/Cronologia`), com OAuth + PKCE direto no app, sem segredo
  embutido.
- Restaura um backup pedindo a senha de criptografia, e desconecta o Dropbox
  quando você quiser.
- Fala português do Brasil (canônico), inglês, coreano, chinês simplificado e
  japonês, com o idioma escolhido em Configurações.

## Dependências de produção

São 4 pacotes em `dependencies`, todos com licença permissiva. Pense duas vezes
antes de adicionar um: regra do `AGENTS.md` e registro em
`THIRD-PARTY-NOTICES.txt`.

| Pacote                          | Papel                                    |
| ------------------------------- | ---------------------------------------- |
| `react` / `react-dom`           | Interface (grade, modais, configurações) |
| `@fortawesome/fontawesome-free` | Ícones da interface (fontes + CSS)       |
| `hash-wasm`                     | Argon2id do cofre de segredos (main)     |

O Electron é dependência de desenvolvimento, mas é a plataforma: o
electron-builder o embute no `.deb`. O restante (electron-vite, Vite, Vitest,
ESLint, Prettier, electron-builder, Testing Library) é ferramenta de
desenvolvimento e também não entra no pacote.

## Ciclo de vida resumido

1. Primeira execução: a biblioteca nasce vazia em
   `~/.local/share/cronologia/library.enc` e `covers/*.enc`, ambos
   cifrados com a chave do cofre.
2. Uso corrente: adicionar/editar obras, mover a barra de progresso, buscar e
   filtrar; tudo local e instantâneo (gravação com debounce).
3. Backup opcional: crie o **cofre de segredos** e defina a senha de
   criptografia em Configurações, conecte o Dropbox (OAuth + PKCE) e faça
   backup; restaurar pede a senha. Tokens e senha de backup moram no cofre e
   todo fluxo pede a senha mestra quando ele estiver fechado (sem cofre
   aberto não há backup).
4. Distribuição: push na `main` publica o `.deb` e o repositório APT assinado
   na GitHub Release; `sudo apt upgrade` atualiza o app
   (`docs/distribuicao-apt.md`).

## Glossário

- **Obra**: registro da leitura (título, tipo, status, progresso, capa e
  descrição); o tipo fecha em `WorkType` e o status em `WorkStatus`
  (`src/types/work.ts`).
- **Status**: `planejado`, `lendo`, `pausado`, `concluido`, `cancelado`; as
  transições válidas estão no README, seção "Estados de uma obra".
- **Capa / `cover://`**: imagem copiada do disco para `covers/` e servida pela
  interface pelo protocolo interno `cover://`.
- **Backup criptografado**: envio do `library.json` + capas em AES-256-GCM,
  com nomes de arquivo opacos (HMAC), para a pasta do app no Dropbox.
- **Senha de criptografia do backup**: segredo que você cria em Configurações;
  cifra o backup e é exigida para restaurar (`settings.drivePassphrase`).
- **App key (PKCE)**: chave que identifica o app no Dropbox; sem `app secret`
  (fluxo público PKCE). A embutida é `EMBEDDED_APP_KEY` e uma alternativa pode
  ser gravada no cofre (`settings.driveClientId`; sem campo na UI).
- **Tokens do Dropbox**: `access_token` curto + `refresh_token` duradouro
  devolvidos pela autorização, guardados só como segredo `dropbox.tokens` do
  cofre (nunca em arquivo em claro).
- **Cofre de segredos**: arquivo cifrado sob uma senha mestra (Argon2id +
  AES-256-GCM) em `/var/lib/.cronologia/.vault` que guarda os segredos
  do app (tokens do Dropbox, senha de backup, App key alternativa); abre por
  sessão e sofre auto-lock após 5 minutos (`docs/cofre.md`).
- **Provedor de backup**: implementação do contrato `BackupProvider`
  (`authorize` + 4 operações de arquivo); Dropbox operante, Google Drive não
  operante (`docs/backup-providers.md`).
- **Protocolos internos**: `cover://` (capas) e `cronologia://` (SPA em produção);
  nada fora disso é navegável dentro do app.
- **Aliases `@zero/*`**: atalhos de import usados dentro de `src/`
  (`docs/arquitetura.md`).
