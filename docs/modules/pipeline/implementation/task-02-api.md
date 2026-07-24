# TASK-02 — API Endpoints

**Depende de:** TASK-01
**Arquivo de rotas:** `apps/api/src/routes/`
**Auth middleware:** aplicar em todas as rotas — `requireAuth`
**Audit middleware:** aplicar em todas as rotas de escrita — `auditLog`

---

## 2.1 Customers (extensão das rotas existentes)

```
GET    /api/v1/customers/:id/full
```
Retornar cliente + `orders_count`, `ltv_cents`, `last_order_at`, `has_pending_os`.

```
PATCH  /api/v1/customers/:id
```
Aceitar todos os novos campos (social_name, ring_size, special_dates etc).
Atualizar `updated_at`. Registrar no audit log.

```
GET    /api/v1/customers/:id/orders?limit=20&page=1
```
Pedidos do cliente. JOIN com `fiscal_documents` para retornar `nfe_status`.

```
GET    /api/v1/customers/:id/stats
```
```json
{ "ltv_cents": 0, "orders_count": 0, "pending_os": 0,
  "last_interaction_days": 0, "open_proposals": 0 }
```

---

## 2.2 Attendance Blocks

```
GET    /api/v1/customers/:id/blocks?page=1&limit=20
POST   /api/v1/customers/:id/blocks
PATCH  /api/v1/blocks/:id
DELETE /api/v1/blocks/:id        → soft delete (status = 'deleted')
POST   /api/v1/blocks/:id/attach → upload de arquivo (multer, max 10MB)
```

**POST body:**
```typescript
{
  title: string,
  block_type: string,
  content: string,       // HTML do editor
  status: string,
  priority: string,
  channel: string,
  lead_id?: string
}
```

---

## 2.3 AI Renders

```
POST   /api/v1/blocks/:block_id/render
```
**Body:** todos os parâmetros de geração (piece_type, metal, stone, etc).
**Lógica:**
1. Salvar registro em `ai_renders` com `status = 'pending'`
2. Enfileirar job BullMQ: `ai-render-queue`
3. Job chama API de geração (stub por enquanto — retornar URLs de placeholder)
4. Atualizar `ai_renders.status = 'generated'`, salvar URLs
5. Retornar render completo via polling ou WebSocket

```
GET    /api/v1/renders/:id          → status + URLs
PATCH  /api/v1/renders/:id/approve  → { is_approved: true, approved_by }
PATCH  /api/v1/renders/:id/adjust   → atualizar parâmetros manuais + reagendar job
```

**Stub de geração (usar até integração real):**
```typescript
// Retornar imagens placeholder de anel 3D
render_url_front = '/static/placeholders/ring-front.png'
render_url_top   = '/static/placeholders/ring-top.png'
render_url_side  = '/static/placeholders/ring-side.png'
// Marcar status = 'generated' imediatamente
```

---

## 2.4 Service Orders

```
GET    /api/v1/customers/:id/service-orders?status=&page=1
POST   /api/v1/service-orders
PATCH  /api/v1/service-orders/:id
PATCH  /api/v1/service-orders/:id/step   → { step: string }
POST   /api/v1/service-orders/:id/files  → upload STL/3DM (multer, max 50MB)
DELETE /api/v1/service-orders/:id/files/:file_id
```

**POST /service-orders body:**
```typescript
{
  customer_id: string,
  order_id?: string,
  attendance_block_id?: string,
  ai_render_id?: string,
  product_name: string,
  priority: string,
  specs: object,          // JSON com todas as specs de fabricação
  designer_id?: string,
  jeweler_id?: string,
  due_date?: string,
  deposit_cents?: number,
  total_cents?: number
}
```

**PATCH /step body:** `{ step: 'casting' | 'setting' | ... }`
Adicionar step a `steps_done[]`. Atualizar `current_step`. Notificar responsável.

**Auto-gerar number:** `OS-YYYYMMDD-XXXX` (ver lógica em TASK-01).

---

## 2.5 Deliveries

```
GET    /api/v1/customers/:id/deliveries
POST   /api/v1/deliveries
PATCH  /api/v1/deliveries/:id
PATCH  /api/v1/deliveries/:id/status → { status: string, note?: string }
```

---

## 2.6 History / Log

```
GET    /api/v1/customers/:id/history?type=log|whatsapp|email&page=1&limit=30
```
Agregar de:
- `audit_log` onde `entity_id = customer_id`
- `attendance_blocks` (log de blocos criados)
- `whatsapp_messages` se existir (ou mock)
- `email_logs` se existir (ou mock)

---

## 2.7 Feedback

```
GET    /api/v1/customers/:id/feedback
POST   /api/v1/customers/:id/feedback  → { order_id?, rating, comment, channel }
```

---

## 2.8 Stage (pipeline)

```
PATCH  /api/v1/leads/:id/stage → { stage_id: string }
POST   /api/v1/leads/:id/won
POST   /api/v1/leads/:id/lost  → { reason?: string }
```
Registrar mudança no `audit_log`. Atualizar `attendance_blocks` com stage change automático.

---

## DoD
- [ ] Todos os endpoints respondem com status correto
- [ ] Auth middleware em todas as rotas
- [ ] Erros retornam `{ error: string, code: string }`
- [ ] Upload de arquivo valida tipo e tamanho
- [ ] `tsc --noEmit` limpo
