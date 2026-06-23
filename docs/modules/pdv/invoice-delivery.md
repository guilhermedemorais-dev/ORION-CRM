# PRD-PDV-05 — NF-e (Stub) + Envio de Comprovante

## Referência visual
`PRD.DOCS/mockup-pdv-comprovante.html` — botões NF-e / WhatsApp / E-mail

## Leia antes de implementar
- `apps/api/src/routes/orders.ts`
- `apps/api/src/db/schema/` — tabela customers (campos email, whatsapp/phone)

## Escopo
NF-e: criar estrutura e endpoint stub — integração SEFAZ em task futura.
Envio: funcional agora para WhatsApp (link) e e-mail (se infra existir).

---

## Banco

```sql
CREATE TABLE IF NOT EXISTS fiscal_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id),
  customer_id  UUID NOT NULL REFERENCES customers(id),
  type         VARCHAR(20) NOT NULL DEFAULT 'NFE',
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  -- PENDENTE | PROCESSANDO | EMITIDA | CANCELADA | ERRO
  nfe_key      VARCHAR(50),
  nfe_number   VARCHAR(20),
  pdf_url      VARCHAR(500),
  xml_url      VARCHAR(500),
  error_msg    TEXT,
  requested_by UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Endpoints

### `POST /api/v1/orders/:id/nfe`

```typescript
// 1. Verificar que pedido tem customer_id → 422 se não tiver
// 2. Verificar que customer tem cpf_cnpj → 422 "Cliente sem CPF/CNPJ"
// 3. Verificar que não existe fiscal_document PENDENTE/EMITIDA para este order
// 4. Criar fiscal_documents { status: 'PENDENTE', requested_by: req.user.id }
// 5. Retornar { status: 'PENDENTE', message: 'NF-e solicitada' }
// Toast no frontend: "NF-e solicitada. Você será notificado quando emitida."
```

### `POST /api/v1/orders/:id/send-receipt`
Body: `{ channel: 'whatsapp' | 'email' }`

**WhatsApp:**
```typescript
// 1. Buscar customer do pedido
// 2. Formatar phone: remover não-numéricos, prefixar 55
// 3. Montar mensagem:
const msg = `Olá ${customer.name}! Segue o comprovante da sua compra na ${settings.store_name}:`
  + ` Pedido ${order.number} · Total: ${fmt(order.total_cents)} · Data: ${fmt(order.created_at)}.`
  + ` ${settings.receipt_thanks_message}`;
// 4. Retornar { url: `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` }
// Frontend: window.open(url, '_blank')
// Erro 422 se customer sem phone
```

**E-mail:**
```typescript
// 1. Verificar customer.email → 422 se não tiver
// 2. Se infra de e-mail existir: usar
// 3. Se não: log + retornar { sent: true, email: customer.email }
// Toast: "Comprovante enviado para {email}"
```

---

## Frontend — botões condicionais no ReceiptModal

Renderizar SOMENTE se `customer !== null`:

```tsx
{customer && (
  <div className="receipt-nf-row">
    <button onClick={handleNfe}>🧾 Emitir NF-e</button>
    <button onClick={handleWhatsapp}>💬 WhatsApp</button>
    <button onClick={handleEmail}>✉️ E-mail</button>
  </div>
)}
```

Dica abaixo dos botões: "Disponível pois cliente {nome} está vinculado"

---

## Perfil do cliente — histórico de compras

Na tela `/crm/clientes/:id`, adicionar seção "Histórico de Compras":

```
GET /api/v1/customers/:id/orders?limit=20&page=1
```

Por pedido:
- Número + data + forma de pagamento + valor
- `[🧾 NF-e]` → emitir ou, se já emitida, botão verde `[✓ NF]` para baixar
- `[💬]` → enviar comprovante WhatsApp
- `[✉️]` → enviar comprovante e-mail

Novo endpoint: `GET /api/v1/customers/:id/orders` (se não existir)

---

## Definition of Done
- [ ] Migration `fiscal_documents` aplicada
- [ ] `POST /orders/:id/nfe` cria registro com status PENDENTE
- [ ] Erro 422 sem customer ou sem CPF/CNPJ
- [ ] `POST /orders/:id/send-receipt` retorna URL WhatsApp formatada
- [ ] Botões NF-e/WhatsApp/E-mail só renderizam com customer !== null
- [ ] Seção de histórico no perfil do cliente
- [ ] Por compra: botão NF-e + WhatsApp + e-mail
- [ ] `tsc --noEmit` limpo
