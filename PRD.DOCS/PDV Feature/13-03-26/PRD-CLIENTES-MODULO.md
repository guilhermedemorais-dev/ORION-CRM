# PRD-CLIENTES-MODULO — Reformulação do Módulo de Clientes

## Referência visual
- Print 1 da sessão → listagem atual de clientes
- Print 2 da sessão → painel de lead (mesmo painel a reusar para clientes)
- `PRD.DOCS/mockup-pdv-comprovante.html` → seção de histórico no perfil

## Leia antes de implementar
- `apps/web/app/(crm)/clientes/` — módulo atual
- `apps/web/app/(crm)/leads/` — componente de painel do lead (reusar)
- `apps/api/src/routes/customers.ts`
- `apps/api/src/db/schema/` — tabela canônica

## Contexto
Cliente cadastrado no PDV, pelo agente de IA via WhatsApp, ou via landing page
é **o mesmo registro**. O painel de detalhe do cliente deve ser o mesmo
componente do painel de leads — apenas com contexto diferente (compras × pipeline).

---

## PARTE 1 — Listagem de Clientes

### Manter estrutura atual, melhorar com:

**KPI row (4 cards no topo):**
- Total de clientes ativos
- Novos este mês
- Clientes com compra nos últimos 30 dias
- LTV médio

**Toolbar:**
- Busca (debounce 300ms) por nome, WhatsApp, CPF/CNPJ
- Filtro: Com compras / Sem compras / Leads convertidos
- Botão `+ Novo Cliente` → mini-modal de cadastro rápido (mesmo form do PDV)
- Export CSV

**Tabela (colunas):**
| Cliente (avatar+nome) | WhatsApp | E-mail | CPF/CNPJ | Compras | LTV | Última compra | Atualizado |

- Clique em qualquer linha → abre painel lateral (ver Parte 2)
- LTV formatado em BRL
- Badge de origem: PDV / WhatsApp / Landing / Manual

---

## PARTE 2 — Painel de Detalhe do Cliente

**Reusar o mesmo componente de painel do Lead** (`LeadDetailPanel` ou equivalente).
A diferença é o contexto — não a estrutura visual.

### Header do painel
- Avatar com iniciais (ou foto se tiver)
- Nome + CPF/CNPJ
- Tags de contato: WhatsApp, e-mail, telefone
- Badge de origem
- Botão "Editar"

### Abas do painel

**ABA: Notas & Atividades** (igual ao Lead)
- Textarea para nova nota/atividade
- Histórico de atividades (igual ao painel de lead)

**ABA: Comunicações** (igual ao Lead)
- Histórico de mensagens WhatsApp/e-mail

**ABA: Compras** ← nova aba exclusiva do cliente
- Lista de pedidos do cliente (`GET /api/v1/customers/:id/orders`)
- Por pedido: número + data + forma + valor + status
- Botões por pedido: `[🧾 NF-e]` `[💬]` `[✉️]`
  - NF-e já emitida → `[✓ NF]` verde
- Totalizador: "X compras · LTV: R$ Y"

**ABA: Linha do Tempo** (igual ao Lead)

### Painel lateral direito (igual ao Lead)
- Contato
- Empresa (se B2B)
- Equipe / Responsável
- Arquivos

---

## PARTE 3 — Unificação Lead → Cliente

Quando um lead do pipeline é convertido (status CONVERTIDO), ele deve:
1. Aparecer também na listagem de Clientes (mesma tabela)
2. Manter seu painel de lead intacto
3. Ganhar a aba "Compras" com histórico

Não criar novo registro — apenas o `type` ou `status` do registro muda.

Verificar se a tabela já tem campo para isso:
```sql
-- Exemplo (adaptar ao schema real):
ALTER TABLE customers ADD COLUMN IF NOT EXISTS
  is_converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  origin VARCHAR(20) DEFAULT 'MANUAL';
  -- 'MANUAL' | 'PDV' | 'WHATSAPP' | 'LANDING' | 'PIPELINE'
```

---

## Endpoints

### Existentes a verificar/ajustar
- `GET /api/v1/customers` — adicionar filtros: `?origin=&has_orders=&q=`
- `GET /api/v1/customers/:id` — incluir `orders_count` e `ltv_cents` na resposta

### Novos
- `GET /api/v1/customers/:id/orders?limit=20&page=1`
  Retornar: `id, number, created_at, payment_method, total_cents, status, fiscal_document_status`

- `GET /api/v1/customers/stats`
  Retornar: `total, new_this_month, active_last_30d, avg_ltv_cents`

---

## Regras

- Cliente criado no PDV aparece na listagem de Clientes com `origin = 'PDV'`
- Lead convertido aparece em ambas as listas (Leads e Clientes)
- Busca na listagem de Clientes funciona por nome, WhatsApp E CPF/CNPJ
- Painel compartilhado com Lead: modificações no componente devem ser retrocompatíveis
- Aba "Compras" só aparece se `orders_count > 0` ou se `origin === 'PDV'`

---

## Definition of Done
- [ ] KPI row com 4 métricas na listagem
- [ ] Tabela com colunas completas incluindo LTV e badge de origem
- [ ] Clique na linha abre painel lateral (componente reutilizado do Lead)
- [ ] Painel tem abas: Notas & Atividades / Comunicações / Compras / Linha do Tempo
- [ ] Aba Compras lista pedidos com botões NF-e / WhatsApp / e-mail
- [ ] NF-e já emitida exibe badge verde
- [ ] Lead convertido aparece na listagem de Clientes
- [ ] `GET /api/v1/customers/:id/orders` funcionando
- [ ] `GET /api/v1/customers/stats` para os KPIs
- [ ] Busca por nome, WhatsApp e CPF/CNPJ
- [ ] `tsc --noEmit` limpo
