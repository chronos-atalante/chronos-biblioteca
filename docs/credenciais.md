# Credenciais e segredos

Que segredos o app carrega, onde eles moram e o que acontece com eles ao longo
do tempo. O destino de todos é o **cofre** ([`cofre.md`](cofre.md)) em
`/var/lib/.chronos-biblioteca/.vault`: sem cofre aberto não há segredo nenhum
(falha fechada) — o app pergunta para criar um antes de continuar.

## O que é segredo

| Segredo                    | O que é                                     | Consumidor                           | Antes (legado descartado)      |
| -------------------------- | ------------------------------------------- | ------------------------------------ | ------------------------------ |
| `dropbox.tokens`           | access/refresh token da sessão OAuth (JSON) | `src/main/drive/state.ts`            | `dropbox-tokens.json` (`0600`) |
| `settings.drivePassphrase` | senha de criptografia do backup (scrypt)    | `drive/backup.ts`, `drive/crypto.ts` | `settings.json` (`enc:`/claro) |
| `settings.driveClientId`   | App key alternativa do Dropbox (override)   | `src/main/drive/state.ts`            | `settings.json` (em claro)     |

Os nomes canônicos são a constante `VAULT_SECRET`
(`src/main/vault/secrets.ts`); nenhum consumidor usa string solta.

**Não** são segredos do cofre: a biblioteca (`library.json`), as capas, o
conteúdo cifrado do backup na nuvem e as preferências comuns — inclusive o
`language`, que é o **único** campo persistido fora do cofre
(`settings.json`, `0600`, só idioma).

## Ciclo de vida

1. **Criar**: Configurações → _Criar cofre_ → senha mestra + confirmação
   (medidor de força na UI; a autoridade é o main, que recusa senha previsível
   antes do Argon2id). O cofre nasce **aberto**. Qualquer ação que precise de
   segredo sem cofre (Salvar configurações, Conectar, Backup, Restaurar,
   Desconectar) abre esse mesmo fluxo antes de seguir.
2. **Usar**: com o cofre aberto, ler e gravar segredos é transparente
   (`loadSettings`, tokens do Drive). Fechar (botão _Fechar cofre_), reiniciar
   ou ficar 5 minutos ocioso (`auto-lock`) derruba a sessão; aí `loadSettings`
   devolve `''`, `loadState` zera os tokens e gravar lança `vaultLocked`
   (nada é gravado às cegas).
3. **Desbloquear**: qualquer fluxo que precise de segredo (Conectar, Backup,
   Restaurar, Salvar configurações, Desconectar) pede a senha mestra quando o
   cofre existe fechado, e só então continua. Sucesso recarrega o estado do
   Drive (os tokens vivem só no cofre).
4. **Rotacionar**: trocar a senha de backup nas Configurações regrava o
   segredo no cofre (com ele aberto). Desconectar apaga `dropbox.tokens` do
   cofre; sem desbloqueio o fluxo é interrompido antes (falha fechada: nada é
   apagado às cegas).
5. **Reparo da pasta**: se `/var/lib/.chronos-biblioteca/.vault` não puder ser
   escrita, a criação do cofre pede sudo pelo PolicyKit e tenta de novo
   (ver [`cofre.md`](cofre.md) § Criação e reparo da pasta).
6. **Sem keyring**: o cofre **não** depende do `safeStorage` do SO; a senha
   mestra protege tudo por conta própria. Não há mais caminho em claro
   nem `safeStorage` em nenhum fluxo.

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

## Sem cofre: falha fechada

- `loadSettings` devolve `driveClientId: ''`, `drivePassphrase: ''` e o
  `language` do disco; `saveSettings` lança `vaultLocked` **antes** de tocar
  no disco.
- `loadState` zera os tokens na memória; `persistState` lança `vaultLocked`
  (a desconexão, que só limpa, continua funcionando: `clearSecret` é melhor
  esforço).
- O app nunca quebra por causa disso: a UI abre o cria-cofre e o fluxo continua
  depois do desbloqueio.

## Legado descartado

Instalações antigas que ainda tenham `settings.json` com `enc:`/keyring,
`dropbox-tokens.json` com `0600` ou `~/.config/chronos-biblioteca/.vault`
continuam **intocadas e ignoradas**: o app não lê, não copia e não apaga nada
de lá. O primeiro salvamento regrava o `settings.json` só com o idioma
(sem segredo em claro). Não existe migração e não é preciso limpar manualmente.

## Ver também

- [`cofre.md`](cofre.md) (formato, KDF, trava, sessão, reparo da pasta)
- [`api.md`](api.md) §6 (canais `vault:*` e códigos de erro)
- [`dropbox.md`](dropbox.md) (sessão OAuth e backup)
- [`telas.md`](telas.md) (Configurações: linha do cofre e botões)
