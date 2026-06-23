# PRD-PROPOSTAS — Propostas Comerciais com QR PIX

## Referência visual
- `PRD.DOCS/mockup-proposta.html` — proposta digital + impressa 80mm
- `PRD.DOCS/mockup-gerar-proposta.html` — modal de geração + confirmação no PDV

## Leia antes de implementar
- `apps/api/src/routes/` — rotas existentes (especialmente webhook MP)
- `apps/api/src/db/schema/` — schema atual
- `apps/web/app/(crm)/pdv/` — PDV (aba proposta)
- `apps/web/app/(crm)/pedidos/` — botão "Gerar Proposta"

---

## O que é uma Proposta

Documento gerado **antes** da venda ser confirmada. Contém:
- Itens + valores (snapshot — não muda se preço mudar depois)
- QR Code PIX gerado via API do banco
- Código único `PROP-YYYYMMDD-XXXX`
- Validade configurável (padrão 24h)

O estoque **não é reservado** ao criar a proposta.
O estoque só é baixado ao confirmar a venda.

---

## Banco

```sql
CREATE TABLE proposals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(30) NOT NULL UNIQUE,
  -- PROP-YYYYMMDD-XXXX, sequencial por dia, zero-padded 4 dígitos

  origin_type     VARCHAR(20) NOT NULL, -- 'PDV' | 'ORDER' | 'LEAD'
  origin_id       UUID,

  customer_id     UUID        REFERENCES customers(id),

  items           JSONB       NOT NULL DEFAULT '[]',
  -- [{ product_id, name, internal_code, metal, weight_grams, qty, unit_price_cents, total_cents }]

  subtotal_cents  INTEGER     NOT NULL,
  discount_cents  INTEGER     NOT NULL DEFAULT 0,
  total_cents     INTEGER     NOT NULL,

  pix_key         VARCHAR(100),
  pix_txid        VARCHAR(100),   -- ID da transação no banco (para webhook)
  pix_qr_code     TEXT,           -- payload EMV (copia-e-cola)
  pix_qr_image    TEXT,           -- base64 da imagem QR

  valid_until     TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  -- PENDENTE | PAGA | EXPIRADA | CANCELADA

  paid_at         TIMESTAMPTZ,
  paid_via        VARCHAR(20),    -- 'WEBHOOK' | 'MANUAL'
  confirmed_by    UUID REFERENCES users(id),
  order_id        UUID REFERENCES orders(id),

  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposals_code     ON proposals(code);
CREATE INDEX idx_proposals_pix_txid ON proposals(pix_txid);
CREATE INDEX idx_proposals_status   ON proposals(status);
CREATE INDEX idx_proposals_valid    ON proposals(valid_until) WHERE status = 'PENDENTE';
```

```sql
ALTER TABLE settings ADD COLUMN IF NOT EXISTS
  proposal_validity_hours  INTEGER DEFAULT 24,
  proposal_pix_key_default VARCHAR(100),
  proposal_footer_note     TEXT DEFAULT 'Proposta sujeita a disponibilidade de estoque.';
```

---

## Geração do código

```typescript
async function generateProposalCode(db): Promise<string> {
  const today = format(new Date(), 'yyyyMMdd');
  const prefix = `PROP-${today}-`;
  const last = await db.query(
    `SELECT code FROM proposals WHERE code LIKE $1 ORDER BY code DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const nextNum = last.rows[0] ? parseInt(last.rows[0].code.split('-')[3]) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}
```

---

## Endpoints

### `POST /api/v1/proposals`
1. Gerar código único
2. Calcular `valid_until = NOW() + valid_hours horas`
3. Chamar API PIX (Mercado Pago) com `external_reference = code`
4. Salvar proposta com `pix_txid`, `pix_qr_code`, `pix_qr_image`
5. Agendar BullMQ job de expiração com delay = (valid_until - now)
6. Retornar proposta completa

### `GET /api/v1/proposals/:code`
Buscar por código. Se `valid_until < NOW()` e status PENDENTE → atualizar para EXPIRADA antes de retornar.

### `GET /api/v1/proposals`
Listar com filtros: `?status=&customer_id=&origin_type=`

### `POST /api/v1/proposals/:id/confirm`
Confirmação manual (fallback).
1. Verificar status = PENDENTE → 422 se EXPIRADA/CANCELADA/PAGA
2. `UPDATE proposals SET status='PAGA', paid_via='MANUAL', confirmed_by=req.user.id`
3. Chamar `createOrderFromProposal(proposal)` → cria order + baixa estoque
4. Retornar `{ order_id, order_number }`

### `DELETE /api/v1/proposals/:id`
Cancelar. Só funciona se status = PENDENTE. Cancelar PIX na API do banco se possível.

### `GET /api/v1/proposals/:id/pdf`
Gerar PDF baseado no template da proposta (`mockup-proposta.html`).
Retornar `application/pdf`.

### `POST /api/v1/webhooks/mercadopago` (handler adicional)
Ao receber `payment.updated` com status `approved`:
```typescript
const proposal = await db.query(
  `SELECT * FROM proposals WHERE pix_txid=$1 AND status='PENDENTE'`,
  [String(event.data.id)]
);
if (proposal.rows[0]) {
  // SELECT FOR UPDATE para evitar race condition
  await db.query(`UPDATE proposals SET status='PAGA', paid_via='WEBHOOK', paid_at=NOW() WHERE id=$1`, [...]);
  const order = await createOrderFromProposal(proposal.rows[0]);
  await notifyUser(proposal.rows[0].created_by, `Proposta ${proposal.rows[0].code} foi paga!`);
}
```
Webhook deve ser **idempotente** — verificar status antes de processar.

---

## `createOrderFromProposal(proposal)` — função interna

```typescript
async function createOrderFromProposal(proposal) {
  // 1. BEGIN transaction
  // 2. Criar orders (type='PRONTA_ENTREGA', customer_id, total_cents...)
  // 3. Criar order_items a partir de proposal.items
  // 4. Para cada item: INSERT stock_movements (type='VENDA_PDV', delta=-qty)
  //    Usar SELECT FOR UPDATE em products para evitar concorrência
  // 5. Verificar estoque crítico → notificação se qty_after <= min_stock
  // 6. UPDATE proposals SET order_id = novaOrder.id
  // 7. COMMIT
  // 8. Retornar order
}
```

---

## Frontend

### Onde aparece o botão "Gerar Proposta"
- **PDV:** botão secundário `[📋 Proposta]` ao lado de "Ir para pagamento →"
- **Pedidos:** botão no header de ações do detalhe do pedido
- **Pipeline/Lead:** botão no painel do lead (itens adicionados manualmente no modal)

### `ProposalGenerateModal.tsx`
Props: `origin`, `items`, `subtotal_cents`, `discount_cents`, `total_cents`, `customer`, `onSuccess`, `onClose`

Campos: validade (select) + chave PIX (select das configuradas em settings) + observação (opcional) + botões de envio pós-geração

### `ProposalSuccessModal.tsx`
Exibe código em destaque + validade + botões: WhatsApp / E-mail / Imprimir / Voltar ao PDV

### Aba "📋 Proposta" no PDV (painel direito)

```
[ PROP-...                      ] [Buscar]

→ Encontrada / PAGA automaticamente:
  "✅ PIX Confirmado! Clique para registrar."
  [✅ Registrar Venda e Baixar Estoque]

→ Encontrada / PENDENTE:
  resumo da proposta
  [✅ Confirmar Recebimento Manual]
  "Use somente se PIX não confirmou automaticamente"

→ EXPIRADA:
  alerta vermelho + "Gerar nova proposta"

→ CANCELADA:
  alerta
```

Código normalizado: `toUpperCase().trim()` antes de buscar.

### Notificação em tempo real
Quando webhook confirmar, notificar o atendente que criou via WebSocket ou polling (30s).
Toast: "🎉 PROP-20260313-0042 foi paga! Clique para registrar a venda."

---

## Definition of Done
- [ ] Migration `proposals` com índices aplicada
- [ ] `generateProposalCode` sequencial por dia
- [ ] `POST /proposals` cria proposta + chama API PIX + agenda expiração BullMQ
- [ ] `GET /proposals/:code` atualiza EXPIRADA se vencida
- [ ] Webhook handler confirma proposta e cria order automaticamente
- [ ] `createOrderFromProposal` dentro de transação, com SELECT FOR UPDATE
- [ ] `POST /proposals/:id/confirm` funciona como fallback manual
- [ ] Race condition protegida: webhook idempotente + SELECT FOR UPDATE
- [ ] PDF gerado via `GET /proposals/:id/pdf`
- [ ] Botão "Gerar Proposta" em PDV, Pedidos e Lead
- [ ] Aba "Proposta" no PDV com 4 estados
- [ ] Notificação in-app ao atendente quando webhook confirmar
- [ ] `tsc --noEmit` limpo
