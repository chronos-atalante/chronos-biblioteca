# Atribuições

A página **Atribuições** lista as dependências de código aberto usadas no Chronos
Biblioteca, no formato de **créditos de cinema**: os itens sobem devagar em loop
contínuo.

## Onde fica

No cabeçalho do app, ao lado da pílula **Drive conectado / Drive off**, há o botão
**Atribuições** (ícone de claquete). Ele abre o modal de créditos por cima da
biblioteca: `Escape`, clique fora ou **Fechar** dispensam o modal.

## Comportamento

- A trilha de créditos (`credits-track`) contém a lista **duplicada**: ao terminar
  a primeira metade, a animação recomeça em `-50%`, o que dá o loop sem salto.
- Animação CSS `credits-scroll` de **89,8 s, linear e infinita**, com máscara de
  fade no topo e na base (`mask-image`).
- A rolagem **pausa** ao passar o mouse, ao focar o painel (`:focus-within`) ou
  pelo botão **Pausar / Continuar**; pensado para leitura e acessibilidade.
- Com `prefers-reduced-motion: reduce`, a animação é desligada e o painel vira
  uma lista rolável manualmente.

## Conteúdo

A fonte de verdade da tela é `src/renderer/src/attributions.ts` (`ATTRIBUTIONS`):
nome, licença, descrição curta e URL de cada dependência direta do
`package.json`. As **versões exatas** não ficam hardcoded na tela; consulte
`package.json` / `package-lock.json`.

| Dependência                                                           | Licença                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| React, React DOM                                                      | MIT                                                  |
| Font Awesome Free                                                     | MIT (código) · OFL-1.1 (fontes) · CC-BY-4.0 (ícones) |
| Electron, electron-vite, electron-builder, Vite, @vitejs/plugin-react | MIT                                                  |
| TypeScript                                                            | Apache-2.0                                           |
| Vitest, jsdom, Testing Library, ESLint, Prettier e demais ferramentas | MIT (rimraf: BlueOak-1.0.0)                          |

Todas são licenças permissivas aprovadas pela OSI (código). OFL-1.1 e CC-BY-4.0
aparecem **apenas para os assets** (fontes/ícones) do Font Awesome, nunca para
código executado pelo app.

## Manutenção

Ao adicionar uma dependência ao `package.json`:

1. Verifique a licença (`node_modules/<pacote>/package.json`, campo `license`).
2. Prefira alternativas já presentes no projeto.
3. Adicione uma entrada em `ATTRIBUTIONS` (`src/renderer/src/attributions.ts`).
4. Atualize a tabela acima e rode `npm run check` + `npm test`.
