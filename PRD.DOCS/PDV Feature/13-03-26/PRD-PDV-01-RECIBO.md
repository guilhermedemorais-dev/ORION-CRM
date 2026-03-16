# PRD-PDV-01 — Recibo de Finalização Melhorado

## Referência visual
`PRD.DOCS/mockup-recibo.html` (dark + print 80mm)

## Leia antes de implementar
- `apps/web/app/(crm)/pdv/` — componente de recibo atual
- `apps/api/src/routes/settings.ts` — campos da loja
- `apps/api/src/routes/products.ts` — verificar campos retornados

---

## O que mudar

### Criar `ReceiptModal.tsx` (componente separado)

Substituir o modal atual. Todas as props chegam prontas — sem fetch interno.

```typescript
interface ReceiptModalProps {
  order: {
    id: string
    number: string
    createdAt: Date
    items: {
      name: string
      internal_code: string
      metal?: string
      weight_grams?: number
      quantity: number
      unit_price_cents: number
    }[]
    subtotal_cents: number
    discount_cents: number
    total_cents: number
    payment_method: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'LINK_MP'
    amount_received_cents?: number  // dinheiro
    installments?: number           // crédito
  }
  customer?: { id: string; name: string; phone: string; email?: string; cpf_cnpj?: string } | null
  attendant: string
  settings: StoreSettings
  onClose: () => void
  onNewSale: () => void
}
```

### Estrutura do recibo (top → bottom)

1. **Header:** ícone ✅ + "Venda Concluída!" + número do pedido
2. **Loja:** nome (Playfair, gold), endereço, CNPJ, telefone (de `settings`)
3. **Meta:** data/hora (`DD/MM/YYYY às HH:mm`), atendente, badge do cliente (se vinculado)
4. **Divisor tracejado**
5. **Itens:** nome + `{code} · {metal} · {peso}g · {qty} × {unit_price}` + total (right-align, gold)
6. **Divisor tracejado**
7. **Totais:** subtotal → desconto (omitir se zero) → total (Playfair 17px gold)
8. **Box de pagamento:**
   - DINHEIRO: forma + recebido + troco
   - PIX: forma + "Confirmado"
   - DEBITO: forma
   - CREDITO: forma + `Nx de R$ Y`
   - LINK_MP: forma + "Link Mercado Pago"
9. **Rodapé:** agradecimento + política de troca + garantia (de `settings`)
10. **Botões:** `[✕] [🖨️ Imprimir] [Nova Venda]`
11. **Botões condicionais** (só se `customer !== null`): `[🧾 NF-e] [💬 WhatsApp] [✉️ E-mail]`

### CSS @media print

```css
@media print {
  body > *:not(#receipt-print-area) { display: none !important; }
  #receipt-print-area {
    position: fixed; inset: 0;
    width: 80mm; margin: 0 auto;
    background: white !important;
    color: black !important;
    font-size: 10px; padding: 8mm;
    box-shadow: none !important; border: none !important;
  }
  .receipt-actions, .receipt-nf-row { display: none !important; }
  .receipt-store-name,
  .receipt-item-total,
  .receipt-total-value { color: #B8924A !important; }
  .receipt-order-barcode {
    font-family: monospace; font-size: 8px;
    letter-spacing: 3px; text-align: center; margin-top: 8px;
  }
}
```

### Ajustes em endpoints existentes

**`GET /api/v1/products`** — adicionar ao SELECT se faltar:
`internal_code`, `metal`, `weight_grams`

**`GET /api/v1/settings`** — adicionar se colunas não existirem:
```sql
ALTER TABLE settings ADD COLUMN IF NOT EXISTS
  receipt_thanks_message  TEXT DEFAULT 'Obrigado pela preferência ✦',
  receipt_exchange_policy TEXT DEFAULT 'Troca em até 30 dias com este recibo.',
  receipt_warranty        TEXT DEFAULT 'Garantia de 1 ano contra defeito de fabricação.';
```

### Estado do carrinho

Ao adicionar produto ao carrinho, guardar `internal_code`, `metal`, `weight_grams`.
Settings carregadas na **montagem do PDV** — não no clique de finalizar.

---

## Definition of Done
- [ ] `ReceiptModal.tsx` criado com todas as props tipadas
- [ ] Desconto omitido quando `discount_cents === 0`
- [ ] Box de pagamento correto para cada forma
- [ ] Botões NF-e/WhatsApp/E-mail só renderizam com `customer !== null`
- [ ] `@media print` gera recibo limpo em 80mm sem UI
- [ ] `internal_code`, `metal`, `weight_grams` chegando nos itens do carrinho
- [ ] `tsc --noEmit` limpo
