# Política de segurança

## Versões suportadas

| Versão | Suporte             |
| ------ | ------------------- |
| 1.0.x  | ✅ Correções ativas |

Versões anteriores ao 1.0.0 não recebem correções; atualize pelo `.deb` mais
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

- **Tokens só na máquina**: `dropbox-tokens.json` com permissão `0600`, nunca em
  repositório (coberto pelo `.gitignore`).
- **Backup sempre criptografado**: AES-256-GCM com chave derivada por scrypt
  explícito (`N=2¹⁷`, `r=8`, `p=1` — mínimo atual do OWASP; salt e IV
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
- **Senha no keyring**: `drivePassphrase` vai para o cofre do SO
  (`safeStorage`) quando há keyring; sem keyring, em claro com `0600`
  (fallback documentado, com migração automática).
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
- **Dependências auditadas**: `npm run security:audit` (OSV Scanner) roda em
  todo `npm run check`.

## Riscos aceitos (com justificativa)

- **Porta fixa do callback OAuth (`localhost:17431`)**: exigência do App
  Console do Dropbox (redirect URI cadastrada). Um processo malicioso na
  mesma máquina poderia escutar nessa porta, mas isso exige acesso local ao
  PC — fora de escopo (ver abaixo).
- **Senha de backup em claro sem keyring**: quando
  `safeStorage.isEncryptionAvailable()` é `false` (containers, WSL sem
  cofre), a `drivePassphrase` vai para `settings.json` com permissão `0600`
  e migra sozinha para o keyring no próximo save. Não há alternativa viável
  nesses ambientes.
- **Dependências sem fix upstream**: problemas reportados em dependências de
  desenvolvimento sem versão corrigida publicada são documentados no README
  da parte correspondente e monitorados (ex.: `braces` na landing).

## Fora de escopo

- Engenharia social, spam e ataques a serviços de terceiros (Dropbox, Google,
  npm).
- Falhas que exijam acesso físico ao PC já desbloqueado do usuário.
