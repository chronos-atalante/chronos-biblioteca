# Doações

A página **Doações** (botão **Doar**, ícone de coração, no cabeçalho ao lado de
**Atribuições**) conta a história do projeto e oferece duas formas de
contribuição: link do Mercado Pago e QR Code Pix.
`Escape`, clique fora ou **Fechar** dispensam o modal.

## Como funciona

- O link é `https://link.mercadopago.com.br/chronosbiblioteca` (constante
  `DONATION_URL` em `src/renderer/src/donations.ts`).
- **Doar agora** é um `<a target="_blank">`: o `setWindowOpenHandler` do processo
  main intercepta e abre a URL no **navegador do sistema** via `shell.openExternal`
  — nada navega para fora dentro do app.
- **Copiar link** grava a URL com `navigator.clipboard` e mostra **Copiado!** por
  2,5 s. Se a API de clipboard estiver indisponível, o botão não faz nada.
- **Pix**: o QR em `src/renderer/src/assets/qr-code-pix.png` é exibido no modal
  (importado via Vite, empacotado no build) com a dica "Escaneie o QR no app do
  banco". Para trocar o QR, substitua o arquivo mantendo o mesmo nome.
- Toques leves: banner de abertura ("cafezinho"), linha de agradecimento no fim e
  pulsação sutil no coração do título — desligada com `prefers-reduced-motion`.

## Manutenção

Se o link de doação mudar, atualize em dois lugares:

1. `DONATION_URL` / `DONATION_LABEL` em `src/renderer/src/donations.ts`.
2. Este documento.
3. Rode `npm test` (o teste `DonateModal — conteúdo` confere `href` e `target`) e
   `npm run check`.

Se o QR do Pix mudar, substitua `src/renderer/src/assets/qr-code-pix.png`
(mantendo o nome) — nenhum código precisa mudar.
