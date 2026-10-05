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

- **Tokens só na máquina**: `drive-tokens.json` com permissão `0600`, nunca em
  repositório (coberto pelo `.gitignore`).
- **Backup sempre criptografado**: AES-256-GCM com chave derivada por scrypt
  explícito (`N=2¹⁶`, `r=8`, `p=1`; salt e IV aleatórios por arquivo, tag
  verificada na leitura). Formato atual `WTENC2`, com leitura dos legados
  `WTENC1`; o Google guarda só blobs cifrados.
- **Nomes remotos opacos**: HMAC-SHA256 com chave de nomes derivada da senha
  - manifesto cifrado (nome remoto → nome local). Ao Google restam visíveis
    só a quantidade aproximada e o tamanho dos blobs (limitação da API do
    Drive; tamanhos exatos não têm como ser ocultados sem padding).
- **Senha no keyring**: `drivePassphrase` vai para o cofre do SO
  (`safeStorage`) quando há keyring; sem keyring, em claro com `0600`
  (fallback documentado, com migração automática).
- **Escopos mínimos**: `drive.appdata` + `drive.file` + `openid email`.
- **Sem servidor intermediário**: do PC direto para o Google (`fetch` nativo).
- **Credenciais embutidas**: o `client_secret` de app desktop não é segredo
  real (é público por definição; a proteção vem de PKCE + loopback); não
  reporte isso como falha.
- **Dependências auditadas**: `npm run security:audit` (OSV Scanner) roda em
  todo `npm run check`.

## Fora de escopo

- Engenharia social, spam e ataques a serviços de terceiros (Google, npm).
- Falhas que exijam acesso físico ao PC já desbloqueado do usuário.
