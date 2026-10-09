# Credenciais e segredos

Que segredos o app carrega, onde eles moram hoje e o que acontece com eles ao
longo do tempo. O destino de todos é o **cofre** ([`cofre.md`](cofre.md)); sem
cofre criado, o app segue no caminho legado, documentado aqui.

## O que é segredo

| Segredo                    | O que é                                     | Consumidor                           | Onde estava antes                                    |
| -------------------------- | ------------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `dropbox.tokens`           | access/refresh token da sessão OAuth (JSON) | `src/main/drive/state.ts`            | `dropbox-tokens.json` (arquivo `0600`)               |
| `settings.drivePassphrase` | senha de criptografia do backup (scrypt)    | `drive/backup.ts`, `drive/crypto.ts` | `settings.json` (`enc:` no keyring, ou claro `0600`) |
| `settings.driveClientId`   | App key alternativa do Dropbox (override)   | `src/main/drive/state.ts`            | `settings.json` (em claro)                           |

Os nomes canônicos são a constante `VAULT_SECRET`
(`src/main/vault/secrets.ts`); nenhum consumidor usa string solta.

**Não** são segredos do cofre: a biblioteca (`library.json`), as capas, o
conteúdo cifrado do backup na nuvem e as preferências comuns. Senha de
criptografia do backup, uma vez definida, só existe dentro do cofre (ou no
legado abaixo).

## Ciclo de vida

1. **Sem cofre**: tudo funciona como sempre funcionou (legado). Os segredos
   ficam onde a tabela acima diz, com as permissões descritas.
2. **Criar**: Configurações → _Criar cofre_ → senha mestra + confirmação
   (medidor de força na UI; a autoridade é o main, que recusa senha previsível
   antes do Argon2id). O cofre nasce **aberto** e os segredos legados são
   copiados para dentro e zerados de onde estavam (**disco vence o cofre**:
   o disco é a última escrita do usuário).
3. **Usar**: com o cofre aberto, ler e gravar segredos é transparente
   (`loadSettings`, tokens do Drive). Fechar (botão _Fechar cofre_), reiniciar
   ou ficar 5 minutos ocioso (`auto-lock`) derruba a sessão; o app volta ao
   modo legado **sem** perder o que está no cofre.
4. **Desbloquear**: qualquer fluxo que precise de segredo (Conectar, Backup,
   Restaurar, Salvar configurações, Desconectar) pede a senha mestra quando o
   cofre existe fechado, e só então continua. Sucesso recarrega o estado do
   Drive (os tokens vivem só no cofre).
5. **Rotacionar**: trocar a senha de backup nas Configurações regrava o
   segredo no cofre (com ele aberto). Desconectar apaga `dropbox.tokens` do
   cofre; sem desbloqueio o fluxo é interrompido antes (falhar fechado: nada é
   apagado às cegas).
6. **Sem keyring**: o cofre **não** depende do `safeStorage` do SO; a senha
   mestra protege tudo por conta própria. O keyring só continua valendo no
   caminho legado.

## Força da senha mestra

Regra do processo main (`passwordProblem`, `src/main/vault/crypto.ts`),
aplicada na criação **antes** de qualquer Argon2id:

- mínimo de **12 caracteres**;
- sem fragmentos previsíveis (comparados em minúsculas): `password`, `senha`,
  `chronos`, `biblioteca`, `dropbox`, `123456`, `qwerty`, `letmein`, `admin`;
- sem padrão óbvio: caractere repetido (`aaa…`), sequência ±1 (`abcdef…`,
  `123456…`) nem bloco repetido (`abcabc…`).

O modal mostra um medidor local (Fraca/Razoável/Forte) só para feedback; o
back-end é quem recusa (`vaultWeakPassword`). A trava exponencial (10 s até
24 h) protege o desbloqueio contra tentativas.

## Caminho legado (sem cofre)

Enquanto não existir cofre, o comportamento antigo permanece intacto:

- `drivePassphrase` → `safeStorage` (`enc:`) no keyring do SO; sem keyring
  disponível, em claro com `0600` e aviso `settings.keyringWarning` nas
  Configurações (migra sozinha no próximo salvamento com keyring).
- `driveClientId` → `settings.json` (sem UI; override manual).
- tokens → `dropbox-tokens.json` com `0600`.

Ao criar o cofre, `loadSettings`/`persistState` migram esses valores para
dentro (uma única vez, idempotente) e limpam o disco. Cofre fechado ou
adulterado **não** quebra nada: os fluxos seguem legados (falha fechada).

## Ver também

- [`cofre.md`](cofre.md) (formato, KDF, trava, sessão)
- [`api.md`](api.md) §6 (canais `vault:*` e códigos de erro)
- [`dropbox.md`](dropbox.md) (sessão OAuth e backup)
- [`telas.md`](telas.md) (Configurações: linha do cofre e botões)
