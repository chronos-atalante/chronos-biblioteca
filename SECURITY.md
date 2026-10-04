# Política de segurança

## Versões suportadas

| Versão | Suporte             |
| ------ | ------------------- |
| 1.0.x  | ✅ Correções ativas |

Versões anteriores ao 1.0.0 não recebem correções — atualize pelo `.deb` mais
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
  (salt e IV aleatórios por arquivo); o Google guarda só o blob cifrado.
- **Escopos mínimos**: `drive.appdata` + `drive.file` + `openid email`.
- **Sem servidor intermediário**: do PC direto para o Google (`fetch` nativo).
- **Credenciais embutidas**: o `client_secret` de app desktop não é segredo
  real (é público por definição; a proteção vem de PKCE + loopback) — não
  reporte isso como falha.
- **Dependências auditadas**: `npm run security:audit` (OSV Scanner) roda em
  todo `npm run check`.

## Fora de escopo

- Engenharia social, spam e ataques a serviços de terceiros (Google, npm).
- Falhas que exijam acesso físico ao PC já desbloqueado do usuário.
