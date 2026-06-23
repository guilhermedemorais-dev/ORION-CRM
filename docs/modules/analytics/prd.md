# 18 — ANALYTICS MODULE
**ORION CRM · PRD v1.0**
Rota: `/analytics` · Role: ADMIN only

---

## 1. Visão Geral

Módulo de inteligência de negócios do ORION. Consolida dados de todas as verticais (Vendas, Leads, Produção, Loja, Atendentes) em visualizações acionáveis. Sem biblioteca externa de BI — tudo renderizado com **Recharts** (já no stack).

**Princípios:**
- Dados sempre filtráveis por **período** (7d / 30d / 90d / 12m / custom)
- Exportação CSV em toda tabela
- Nenhum número sem contexto — sempre comparação com período anterior (↑ / ↓)
- Skeleton loading em todo card/chart

---

## 2. Layout Geral

```
┌────────────────────────────────────────────────────────┐
│ Analytics                    [Período: Este mês ▾] [↓ Exportar] │
│                                                        │
│ [Vendas] [Leads] [Produção] [Loja] [Atendentes]       │
│─────────────────────────────────────────────────────── │
│                                                        │
│  [KPI Row — 4 cards]                                   │
│                                                        │
│  [Chart Principal — full width ou 2/3]  [Chart Sec]   │
│                                                        │
│  [Tabela de detalhe]                                   │
└────────────────────────────────────────────────────────┘
```

**Filtro de período**: dropdown com opções rápidas + DateRangePicker para custom.
Seleção persiste em `localStorage` por tab.

---

## 3. Tabs

### 3.1 Tab — Vendas

**KPI Row (4 cards):**
| Card | Métrica | Comparação |
|------|---------|------------|
| Faturamento | Soma `store_orders.amount` (status=paid) + `pedidos.valor_total` | vs período anterior |
| Pedidos | Count pedidos + orders | vs período anterior |
| Ticket Médio | faturamento / pedidos | vs período anterior |
| Taxa de Cancelamento | cancelados / total % | vs período anterior |

**Charts:**
- **LineChart** (full width): faturamento por dia/semana no período. Duas linhas: período atual (dourado) vs período anterior (cinza). Tooltip rico com valor + variação.
- **BarChart** (50%): faturamento por canal — Loja Online / PDV / WhatsApp (pedidos manuais)
- **BarChart** (50%): top 5 categorias por receita

**Tabela:** Top 10 produtos mais vendidos
```
Produto | Categoria | Qtd Vendida | Receita | % do total
```
Ordenável por qualquer coluna. Exporta CSV.

---

### 3.2 Tab — Leads

**KPI Row (4 cards):**
| Card | Métrica |
|------|---------|
| Leads Criados | count no período |
| Taxa de Conversão | won / total % |
| Tempo Médio de Fechamento | avg(won_at - created_at) em dias |
| Receita de Leads | soma valor dos leads ganhos |

**Charts:**
- **Funil de Conversão** (40%): barras horizontais por stage do pipeline. Mostra volume e % de drop em cada etapa. Ex: Novo 120 → Qualificado 84 (70%) → Proposta 42 (50%) → Fechado 18 (43%)
- **BarChart** (60%): leads por origem — WhatsApp / Loja / Indicação / Manual / Import

**Gráfico secundário:**
- **HeatMap semanal**: dias da semana × hora do dia, colorido por volume de leads criados. Identifica horários de pico para automações.

**Tabela:** Leads perdidos no período
```
Lead | Pipeline | Stage que perdeu | Motivo | Responsável | Data
```

---

### 3.3 Tab — Produção

**KPI Row (4 cards):**
| Card | Métrica |
|------|---------|
| Pedidos em Produção | count status em aberto |
| No Prazo | % entregues on-time |
| Atraso Médio | avg dias de atraso (só atrasados) |
| Produção Concluída | count no período |

**Charts:**
- **BarChart** (60%): pedidos por status (Aguardando / Em Produção / Pronto / Entregue / Atrasado) — snapshot atual
- **LineChart** (40%): ritmo de produção — pedidos concluídos por dia no período

**Tabela:** Pedidos atrasados (urgente)
```
Pedido | Cliente | Prazo | Atraso (dias) | Responsável | Status
```
Linha vermelha para atraso > 7 dias. Link direto para o pedido.

---

### 3.4 Tab — Loja

Só exibe quando `store_config.is_active = true`. Caso contrário: empty state com link para `/settings/loja`.

**KPI Row (4 cards):**
| Card | Métrica |
|------|---------|
| Visitas | page views (implementado via evento n8n/webhook) |
| Conversão | orders / visitas % |
| Receita Online | soma `store_orders.amount` (paid) |
| Ticket Médio Loja | receita / pedidos |

**Charts:**
- **LineChart** (full width): visitas vs pedidos por dia — eixo duplo Y
- **BarChart** (50%): produtos mais visualizados (top 10)
- **BarChart** (50%): receita por método de pagamento (Cartão / PIX / Boleto)

**Tabela:** Últimos 20 pedidos da loja
```
Pedido | Produto | Cliente | Valor | Método | Status | Data
```

---

### 3.5 Tab — Atendentes

**KPI Row (3 cards):**
| Card | Métrica |
|------|---------|
| Atendentes Ativos | count com leads no período |
| Melhor Taxa | nome + % do top performer |
| Meta Atingida | atendentes acima da meta / total |

**Charts:**
- **BarChart horizontal** (full width): ranking de atendentes por faturamento gerado. Cor dourada para quem atingiu meta, cinza para quem não atingiu.

**Tabela:** Performance individual
```
Atendente | Leads Atribuídos | Ganhos | Perdidos | Taxa % | Faturamento | Comissão | Meta
```
Cada linha tem mini progress bar de meta. Exporta CSV para folha de pagamento.

---

## 4. Componentes Compartilhados

### 4.1 PeriodSelector
```tsx
type Period = '7d' | '30d' | '90d' | '12m' | 'custom'
// Dropdown com DateRangePicker (react-day-picker já no shadcn)
// Retorna: { from: Date, to: Date }
// Persiste em localStorage key: 'analytics_period'
```

### 4.2 KpiCard
```tsx
interface KpiCardProps {
  label: string
  value: string | number
  trend: number        // ex: 12.5 = +12.5%
  trendLabel?: string  // ex: "vs mês anterior"
  icon: LucideIcon
  prefix?: string      // ex: "R$"
  loading?: boolean
}
// trend > 0 → verde ↑
// trend < 0 → vermelho ↓ (exceto taxa de cancelamento: invertido)
// trend === 0 → neutro →
```

### 4.3 ExportButton
```tsx
// Recebe: data: unknown[], filename: string, columns: string[]
// Gera CSV via papaparse (já no stack)
// Download automático
```

### 4.4 ChartTooltip
```tsx
// Wrapper padronizado: fundo #1A1A1E, borda gold, texto F0EBE3
// Sempre exibe: valor principal + variação vs período anterior
```

---

## 5. API Endpoints

```
GET /api/v1/analytics/sales?from=&to=          → KPIs + dados vendas
GET /api/v1/analytics/leads?from=&to=          → KPIs + funil + origens
GET /api/v1/analytics/production?from=&to=     → KPIs + status + atrasos
GET /api/v1/analytics/store?from=&to=          → KPIs + visitas + produtos
GET /api/v1/analytics/agents?from=&to=         → ranking + performance
```

Todos retornam:
```json
{
  "period": { "from": "2026-01-01", "to": "2026-01-31" },
  "kpis": [...],
  "charts": { ... },
  "tables": { ... }
}
```

Queries pesadas → cache Redis com TTL 5 min. Key: `analytics:{tab}:{orgId}:{from}:{to}`

---

## 6. Schema SQL (sem tabelas novas)

Analytics é 100% read-only sobre tabelas existentes:
- `leads`, `lead_activities` — tab Leads
- `pedidos`, `producao_items` — tab Produção
- `store_orders`, `store_products` — tab Loja
- `clientes`, `users` — tab Atendentes
- `financeiro_lancamentos` — tab Vendas (receitas)

**View opcional para performance:**
```sql
-- Materializada, refresh via BullMQ job às 00h
CREATE MATERIALIZED VIEW mv_analytics_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  org_id,
  COUNT(*) FILTER (WHERE type='lead') AS leads_count,
  COUNT(*) FILTER (WHERE type='order') AS orders_count,
  SUM(amount) FILTER (WHERE type='order' AND status='paid') AS revenue
FROM (
  SELECT created_at, org_id, 'lead' as type, 0 as amount, null as status FROM leads
  UNION ALL
  SELECT created_at, org_id, 'order', amount, status FROM store_orders
  UNION ALL
  SELECT created_at, org_id, 'order', valor_total, status FROM pedidos
) combined
GROUP BY 1, 2;
```

---

## 7. Checkpoints Codex

### CP1 — Estrutura + Tab Vendas
- Rota `/analytics` com layout, PeriodSelector, tab switcher
- KpiCard component com skeleton e trend
- Tab Vendas: LineChart faturamento + BarCharts + tabela top produtos
- Endpoint `/api/v1/analytics/sales`
- Cache Redis 5 min

### CP2 — Tab Leads + Tab Produção
- Funil de conversão (barras horizontais customizadas)
- HeatMap semanal (grid CSS + dados)
- Tab Produção com tabela de atrasos
- Endpoints `/leads` e `/production`

### CP3 — Tab Loja + Tab Atendentes
- Guard: empty state se loja inativa
- Tab Loja com LineChart dual-axis
- Tab Atendentes com ranking + progress bar de meta
- ExportButton CSV em todas as tabelas
- Endpoints `/store` e `/agents`

### CP4 — Polimento
- Materialized view + BullMQ job refresh
- Skeleton loading em todos charts
- Responsividade (tablet 768px+)
- Typecheck + lint

---

## 8. Dependências

Sem novas dependências — tudo já no projeto:
- **Recharts** — todos os charts
- **Papaparse** — export CSV
- **react-day-picker** — DateRangePicker (via shadcn)
- **Redis** — cache de queries
- **BullMQ** — job de refresh da materialized view
