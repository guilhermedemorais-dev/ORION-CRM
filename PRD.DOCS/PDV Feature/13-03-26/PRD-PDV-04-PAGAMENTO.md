# PRD-PDV-04 — Modal de Pagamento + Botão "Venda Concluída"

## Referência visual
`PRD.DOCS/mockup-pdv-pagamento.html` — 4 estados (PIX, Dinheiro, Crédito, Sinal)

## Leia antes de implementar
- `apps/web/app/(crm)/pdv/` — fluxo de finalização atual
- `apps/api/src/routes/orders.ts` — POST /orders
- `apps/api/src/routes/products.ts` — stock_movements

## Decisão arquitetural
**O estoque só é baixado quando o atendente clica em "Venda Concluída".**
Abrir o modal de pagamento não cria nada no banco. A venda é efetivada apenas
na confirmação final — seja manual ou via maquininha.

---

## Estrutura do Modal de Pagamento

### Header
```
[←] Pagamento          Total a cobrar
    OR-20260313-8980   R$ 2.500,00
```

### Aviso fixo (sempre visível)
```
⚠️ Estoque será baixado somente ao confirmar "Venda Concluída"
```

### Seletor de formas de pagamento (5 botões em grid)
```
[📱 PIX] [💵 Dinheiro] [💳 Débito] [💳 Crédito] [🔗 Link MP]
```
- Botão ativo: borda dourada + fundo gold-dim

---

## Área de detalhe por forma

### PIX
- Exibir: campo de chave PIX + valor + status de polling
- **Sem QR Code** — QR fica exclusivamente nas Propostas Comerciais
- Status: 🟡 "Aguardando confirmação..." → polling `GET /api/v1/orders/pending-pix/{txid}` a cada 5s
- Botão principal muda conforme status:
  - Aguardando: `[✅ Confirmar Recebimento]` (habilitado — atendente confirma manual)
  - Confirmado automaticamente: `[✅ Venda Concluída]` (destaque máximo)

### Dinheiro
- Campo "Valor recebido" (input grande, Playfair)
- Botões rápidos: `[Exato] [R$ 3.000] [R$ 5.000] [R$ 10.000]`
- Box de troco calculado em tempo real (verde, Playfair)
- Botão: `[✅ Venda Concluída]`

### Débito
- Instrução: "Processe na maquininha"
- Status maquininha (polling `GET /api/v1/pdv/terminal/status/:session_id`)
- Botão: `[✅ Venda Concluída]` habilitado após confirmação da maquininha

### Crédito
- Grid de parcelas: 1× / 2× / 3× / 4× / 5× / 6× / 10× / 12× com valor por parcela
- Status maquininha (mesmo polling do débito)
- Botão: desabilitado até maquininha confirmar → `[✅ Venda Concluída]`

### Link MP
- Gerar link via `POST /api/v1/pdv/link-mp`
- Exibir link + botão copiar
- Polling de confirmação
- Botão: `[✅ Venda Concluída]`

---

## Botão "Venda Concluída"

**Estilo:** dourado, grande (height 50px), Playfair Display bold, sombra gold.
**Sempre acompanhado de:** `⚠️ Estoque descontado ao clicar — ação irreversível`

**Ao clicar:**
1. POST /api/v1/orders (cria a ordem)
2. POST stock_movements para cada item (type: VENDA_PDV, delta: -qty)
3. Se pedido personalizado: só baixa estoque se pagamento final
4. Abrir ReceiptModal com os dados da venda

**Estado desabilitado** (enquanto aguarda maquininha):
```
[⏳ Aguardando confirmação...]   ← cinza, cursor not-allowed
```

---

## Regras

- Nenhum dado é persistido ao **abrir** o modal de pagamento
- Fechar o modal descarta tudo — carrinho continua intacto
- Double-click protegido: desabilitar botão após primeiro clique até resposta da API
- Timeout da maquininha: 3 minutos → cancelar automaticamente via BullMQ job

---

## Definition of Done
- [ ] Modal separado `PaymentModal.tsx`
- [ ] Aviso de estoque visível em todas as formas
- [ ] Área de detalhe correta para cada forma de pagamento
- [ ] Troco calculado ao vivo no dinheiro
- [ ] Grid de parcelas com valor calculado no crédito
- [ ] Polling de maquininha habilita botão ao confirmar
- [ ] "Venda Concluída" cria order + stock_movements em transação única
- [ ] Double-click protegido
- [ ] Sem QR Code PIX neste modal (QR fica só nas Propostas)
- [ ] `tsc --noEmit` limpo
