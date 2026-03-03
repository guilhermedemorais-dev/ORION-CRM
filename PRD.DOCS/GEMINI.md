# ORION CRM — Gemini CLI Command File

> Este arquivo é lido automaticamente pelo Gemini CLI ao iniciar nesta pasta.
> Ele define o contexto completo do projeto e as instruções de construção.

---

## CONTEXTO DO PROJETO

Você é o engenheiro responsável por construir o **ORION CRM** — um sistema de gestão operacional para joalherias, entregue como SaaS com container Docker isolado por cliente.

Antes de escrever qualquer código, leia os documentos na pasta `prd.docs/` na seguinte ordem obrigatória:

```
prd.docs/
├── ORION-CRM-PRD-v1.2.md      # 1º — Regras de negócio, data model, API contracts, segurança
├── ORION-BUILD-GUIDE.md       # 2º — Design system, mapa de telas, referências de código
├── ORION-Fase0-PRD.md         # 3º — Landing page, Evolution API, n8n workflows
```

**Leia os três documentos completos antes de escrever a primeira linha de código.**
Se não fizer isso, o código gerado será genérico e sem a identidade do ORION.

---

## ESTRUTURA DE DESTINO

Todo o código deve ser criado na raiz deste projeto, seguindo esta estrutura exatamente:

```
ORION-CRM/                          ← raiz do projeto (você está aqui)
├── prd.docs/                       ← NÃO MODIFICAR — documentos de referência
│
├── apps/
│   ├── web/                        ← Next.js 14 (CRM + Landing Page)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (crm)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   ├── leads/
│   │   │   │   ├── inbox/
│   │   │   │   ├── clientes/
│   │   │   │   ├── pedidos/
│   │   │   │   ├── producao/
│   │   │   │   ├── estoque/
│   │   │   │   ├── financeiro/
│   │   │   │   ├── pdv/
│   │   │   │   ├── analytics/
│   │   │   │   └── ajustes/
│   │   │   ├── (landing)/
│   │   │   └── api/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── ui/
│   │   │   └── modules/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── content/
│   │
│   └── api/                        ← Node.js + Express (Backend)
│       └── src/
│           ├── routes/
│           ├── middleware/
│           ├── services/
│           ├── workers/
│           └── db/
│               ├── migrations/
│               └── queries/
│
├── nginx/
├── n8n/
│   └── workflows/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── README.md
```

---

## STACK OBRIGATÓRIA

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | Next.js | 14 (App Router) |
| UI Components | shadcn/ui | latest |
| Styling | Tailwind CSS | 3.x |
| Backend | Node.js + Express | 20 LTS |
| Banco de dados | PostgreSQL | 16 |
| Cache / Fila | Redis + BullMQ | latest |
| WhatsApp | Evolution API | self-hosted |
| Automação | n8n | self-hosted |
| Containerização | Docker + Docker Compose | latest |
| Proxy | NGINX | alpine |
| Tipagem | TypeScript | strict mode |
| Validação | Zod | latest |
| Forms | react-hook-form | latest |
| Data fetching | @tanstack/react-query | latest |
| Kanban | @dnd-kit/core + @dnd-kit/sortable | latest |
| Gráficos | recharts | latest |
| Datas | date-fns (com locale ptBR) | latest |
| Moeda (input) | react-currency-input-field | latest |
| Color picker | react-colorful | latest |

**NUNCA usar**: moment.js, react-beautiful-dnd, Chart.js, MUI, Chakra, AntD, axios (usar fetch nativo ou ky).

---

## ORDEM DE CONSTRUÇÃO

Execute os blocos nesta ordem. Não avance para o próximo sem o atual estar funcionando.

### BLOCO 1 — Fundação (Dia 1)
```
1.  Ler prd.docs/ORION-CRM-PRD-v1.2.md Seção 5 (Data Model)
2.  Ler prd.docs/ORION-CRM-PRD-v1.2.md Seção 8 (Security)
3.  Criar apps/api/ — scaffold Express + TypeScript
4.  Criar todas as migrations SQL (todas as tabelas da Seção 5)
    → settings (singleton — INSERT inicial na migration)
    → users, refresh_tokens
    → leads, customers, conversations, messages
    → products, orders, order_items, custom_order_details
    → production_orders, production_steps
    → payments, stock_movements, financial_entries
    → audit_logs (com REVOKE DELETE após criar)
    → automation_flows, automation_executions
    → operator_webhook_log
5.  Middleware: auth (JWT), rbac, audit, rateLimit, instanceStatus
6.  POST /api/v1/auth/login
7.  POST /api/v1/auth/refresh
8.  POST /api/v1/operator/webhook (provisioning)
9.  GET  /health
10. docker-compose.yml com todos os services
11. nginx/nginx.conf
12. .env.example documentado
```

### BLOCO 2 — Design System + Shell (Dia 1-2)
```
1.  Ler prd.docs/ORION-BUILD-GUIDE.md Parte 1 COMPLETO
2.  Criar apps/web/ — scaffold Next.js 14 com TypeScript + Tailwind + shadcn
3.  tailwind.config.ts — paleta ORION exatamente como no Build Guide 1.1
4.  next.config.ts — output: 'standalone', fontes next/font
5.  Instalar componentes shadcn: button, badge, card, dialog, drawer,
    dropdown-menu, form, input, label, select, textarea, avatar,
    separator, skeleton, toast, table, tabs, popover, calendar,
    command, sheet, progress, scroll-area, sidebar, breadcrumb
6.  components/ui/StatusBadge.tsx (todos os status do Build Guide 1.7)
7.  components/ui/KpiCard.tsx
8.  components/ui/EmptyState.tsx
9.  components/ui/PageHeader.tsx
10. components/layout/AppShell.tsx
11. components/layout/Sidebar.tsx (grupos de nav do Build Guide 1.3)
12. components/layout/Topbar.tsx
13. lib/utils.ts (fmt.currency, fmt.phone, fmt.relativeTime, fmt.fullDate)
14. app/(auth)/login/page.tsx
15. app/(crm)/layout.tsx (AppShell wrapper com auth guard)
```

### BLOCO 3 — Leads + Clientes (Dia 2)
```
1.  Ler prd.docs/ORION-BUILD-GUIDE.md Módulo 2 (Leads)
2.  API: GET/POST/PATCH /api/v1/leads com RBAC
3.  API: PATCH /api/v1/leads/:id/stage (mover no kanban)
4.  API: POST /api/v1/leads/:id/convert (lead → cliente)
5.  API: GET/POST/PATCH /api/v1/customers
6.  Frontend: app/(crm)/leads/page.tsx
    → View Kanban (@dnd-kit) + View Lista (DataTable)
    → Sheet de detalhes do lead
7.  Frontend: app/(crm)/clientes/page.tsx (DataTable)
8.  Frontend: app/(crm)/clientes/[id]/page.tsx (perfil completo)
```

### BLOCO 4 — WhatsApp Inbox (Dia 3)
```
1.  Ler prd.docs/ORION-BUILD-GUIDE.md Módulo 3 (Inbox)
2.  services/evolution.service.ts (todos os endpoints do Build Guide 3.8)
3.  POST /webhooks/whatsapp (validação HMAC + BullMQ)
4.  BullMQ worker: processamento de mensagem (BL-001 do PRD)
5.  API: GET /api/v1/conversations
6.  API: GET /api/v1/conversations/:id/messages
7.  API: POST /api/v1/conversations/:id/messages (enviar resposta)
8.  API: POST /api/v1/conversations/:id/handoff
9.  Frontend: app/(crm)/inbox/page.tsx
    → Split-pane (lista esquerda + conversa direita)
    → Polling a cada 3s com react-query refetchInterval
    → Bolhas de mensagem diferenciadas (inbound/outbound/bot)
```

### BLOCO 5 — Pedidos + Produção (Dia 3-4)
```
1.  Ler prd.docs/ORION-CRM-PRD-v1.2.md FR-007 (Pedidos)
2.  Ler prd.docs/ORION-BUILD-GUIDE.md Módulo 5 e 6
3.  API: GET/POST /api/v1/orders
4.  API: PATCH /api/v1/orders/:id/status (state machine)
5.  API: GET/POST /api/v1/production-orders
6.  API: POST /api/v1/production-orders/:id/advance-step
7.  Frontend: app/(crm)/pedidos/page.tsx
8.  Frontend: app/(crm)/producao/page.tsx
```

### BLOCO 6 — Estoque + Financeiro + PDV (Dia 4)
```
1.  Ler prd.docs/ORION-BUILD-GUIDE.md Módulos 7, 8, 9
2.  API: CRUD /api/v1/products (com controle de estoque atômico)
3.  API: GET/POST /api/v1/financial-entries
4.  API: GET /api/v1/financial-entries/summary
5.  Frontend: app/(crm)/estoque/page.tsx
6.  Frontend: app/(crm)/financeiro/page.tsx (recharts)
7.  Frontend: app/(crm)/pdv/page.tsx (busca + carrinho + finalização)
```

### BLOCO 7 — Mercado Pago + IA + Dashboard (Dia 5)
```
1.  POST /webhooks/mercadopago (HMAC + idempotência — BL-002, BL-003 do PRD)
2.  services/openai.service.ts (Function Calling com RBAC — Seção 16 do PRD)
3.  POST /api/v1/ai/chat
4.  Frontend: app/(crm)/dashboard/page.tsx (KPIs + ActivityFeed + Alerts)
5.  Frontend: app/(crm)/analytics/page.tsx
6.  Frontend: app/(crm)/ajustes/page.tsx (branding + usuários + WA)
```

### BLOCO 8 — n8n + Landing Page + Deploy (Dia 5-6)
```
1.  Ler prd.docs/ORION-Fase0-PRD.md
2.  n8n/workflows/WF-A-novo-lead.json
3.  n8n/workflows/WF-B-bot-triagem.json
4.  n8n/workflows/WF-C-handoff.json
5.  n8n/workflows/WF-D-status-pedido.json
6.  app/(landing)/page.tsx (todas as seções)
7.  content/config.ts + content/produtos.ts
8.  app/api/lead/route.ts
9.  apps/web/Dockerfile (multi-stage, output: standalone)
10. apps/api/Dockerfile
11. docker-compose.prod.yml
12. README.md com deploy passo a passo
```

---

## REGRAS ABSOLUTAS

### NUNCA fazer
```
❌ Escrever código antes de ler os PRDs de referência do bloco atual
❌ Criar componente de UI que já existe no shadcn/ui
❌ Usar CSS inline — sempre Tailwind classes
❌ Usar FLOAT para valores monetários — sempre INTEGER (centavos)
❌ Hardcodar textos em componentes — usar content/ ou props
❌ useEffect + fetch manual — sempre react-query
❌ Validação manual de form — sempre zod + react-hook-form
❌ TypeScript any — sempre tipar tudo, sem @ts-ignore
❌ Logar WhatsApp, CPF, email ou tokens em plaintext — usar hash SHA-256
❌ Expor n8n ou Evolution API pelo NGINX — sempre rede interna
❌ Colocar secrets no código — sempre process.env com validação no boot
❌ Modificar qualquer arquivo dentro de prd.docs/
```

### SEMPRE fazer
```
✅ Ler o PRD do módulo antes de implementar
✅ Loading state em todo componente que faz fetch (Skeleton do shadcn)
✅ Empty state em toda lista que pode estar vazia (ícone + texto + CTA)
✅ Error state em todo fetch que pode falhar (mensagem + botão retry)
✅ RBAC testado para todos os roles (acesso permitido E negado)
✅ Audit log em toda operação de escrita
✅ Responsivo: verificar em 375px (mobile) antes de considerar pronto
✅ Formatar moeda: R$ 1.800,00 — usar fmt.currency() de lib/utils.ts
✅ Formatar telefone: (11) 99999-9999 — usar fmt.phone() de lib/utils.ts
✅ Operações de estoque e pagamento dentro de transação SQL
✅ Webhooks (WhatsApp + MP): retornar 200 imediatamente, processar via BullMQ
✅ docker compose up funcionar do zero com apenas o .env
```

---

## DEFINITION OF DONE

Um bloco está **completo** apenas quando:
- [ ] Funciona conforme spec nos PRDs
- [ ] Todos os error cases retornam código HTTP correto
- [ ] RBAC aplicado e testado (permitido + negado)
- [ ] Audit log gravado para operações de escrita
- [ ] Loading, empty e error states implementados no frontend
- [ ] Zero erros TypeScript (`tsc --noEmit` limpo)
- [ ] Zero secrets em código ou logs
- [ ] `docker compose up -d` funciona do zero

---

## COMEÇAR AGORA

Execute este comando para iniciar:

```bash
# 1. Confirmar que está na raiz correta
pwd  # deve mostrar o path terminando em ORION-CRM

# 2. Ler os PRDs (obrigatório antes de qualquer código)
cat prd.docs/ORION-CRM-PRD-v1.2.md
cat prd.docs/ORION-BUILD-GUIDE.md
cat prd.docs/ORION-Fase0-PRD.md

# 3. Iniciar pelo Bloco 1
# Criar estrutura de pastas e começar pelas migrations
```
