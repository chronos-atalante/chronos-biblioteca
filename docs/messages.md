# Mensagens e idiomas (i18n)

Todo texto fixo da interface (e das mensagens de erro do processo main) vive em
`src/messages/`, nunca espalhado pelo código. O app nasce em **português (Brasil)**
e também fala **inglês**, **coreano** e **chinês simplificado**; o idioma é escolhido em **Configurações** e persistido
em `settings.json` (`AppSettings.language`).

## O contrato

- `src/messages/pt-BR.ts` é o **canônico**: exporta `ptBR` e
  `export type Messages = typeof ptBR`. Toda chave e assinatura nasce aqui.
- `src/messages/en.ts` exporta `en: Messages` (o mesmo vale para `ko.ts` e
  `zh-CN.ts`). O TypeScript aponta qualquer
  chave ou parâmetro faltando (ou sobrando) na tradução.
- `src/messages/index.ts` é o barrel: `LANGUAGES` (`'pt-BR' | 'en' | 'ko' | 'zh-CN'`),
  `LANGUAGE_LABELS` (nome nativo do idioma, que **não** se traduz), `messages()`
  e os bundles.

Regras das strings:

- Strings com parâmetro são **funções** (`connectFirst: (provider: string) => ...`).
- Marcadores ricos, usados **só na UI**: `**negrito**` vira `<strong>` e
  `` `código` `` vira `<code>`; renderize com `richText()` (em
  `src/renderer/src/i18n.tsx`), que monta nós React sem `dangerouslySetInnerHTML`.
- Elipses são `…` (U+2026), não `...`.

## Como cada camada lê

| Camada     | Como obtém o idioma                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer   | Contexto React em `src/renderer/src/i18n.tsx`: `MessagesProvider` (montado pelo `App`), hooks `useMessages()` / `useLanguage()` e `richText()`. **Fora do provider o padrão é `pt-BR`**, então testes isolados seguem em português. |
| Main       | `currentMessages()` (`src/main/i18n.tsx`) lê `loadSettings().language` a cada chamada e devolve o bundle; os erros saem já no idioma vigente (o contrato IPC não mudou).                                                            |
| Provedores | `BackupProvider.describe(messages)` monta o `BackupProviderInfo` localizado; `listProviders()` usa `currentMessages()` uma vez.                                                                                                     |

`App` lê `settings.get()` na carga e troca o provider ao salvar em Configurações
(`SettingsModal` chama `onLanguageChange`); datas usam
`formatDate(iso, language)` (`src/renderer/src/constants.ts`).

## O que NÃO se traduz

- **Dados por dependência**: `ATTRIBUTIONS[].description` e nomes/licenças de
  pacotes (`src/renderer/src/attributions.ts`), `CATEGORIES`, `DONATION_LABEL`.
- **Nomes de marca**: `Dropbox`, `Google Drive`, `Chronos Biblioteca`,
  `Webtoon`, `Manhwa`... (`label` do provedor, `workTypes.webtoon`, título da
  janela).
- **Logs** (`console.error`/`warn`) e o corpo do 404 interno do protocolo
  `cover://`: diagnóstico, não UI.
- **Erros vindos de fora** (Dropbox/`error_summary`, mensagens já gravadas em
  `status.lastError`): repassam como chegam.

## Adicionando uma string

1. Crie a chave em `src/messages/pt-BR.ts` (com parâmetro, se variar).
2. Traduza em `src/messages/en.ts`, `src/messages/ko.ts` e `src/messages/zh-CN.ts`:
   o typecheck reclama se faltar.
3. Use via `useMessages()` (renderer) ou `currentMessages()` (main).
4. `npm run check` + `npm test`.

## Adicionando um idioma

1. Adicione o código ao tipo `Language` (`src/types/settings.ts`).
2. Novo bundle `src/messages/<código>.ts` tipado como `Messages` + registro em
   `BUNDLES` e em `LANGUAGES`/`LANGUAGE_LABELS` (`src/messages/index.ts`).
3. A normalização de `settings.ts` (`languageField`/`saveSettings`) aceita o
   novo valor.
4. Teste novo cobrindo o bundle (ver `tests/renderer/src/i18n.test.tsx`).
