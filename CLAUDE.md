# ORION CRM — CLAUDE.md

> Lido automaticamente pelo Claude Code em toda sessão.
> Contém regras absolutas, contexto do projeto e ordem de implementação.

---

## ANTES DE QUALQUER CÓDIGO

Ler os PRDs na seguinte ordem obrigatória:

```bash
cat prd.docs/ORION-CRM-PRD-v1.2.md
cat prd.docs/ORION-BUILD-GUIDE.md
cat prd.docs/ORION-Fase0-PRD.md
```

**Não escrever uma linha de código sem ter lido o PRD do módulo atual.**

---

## CONTEXTO DO PROJETO

Sistema operacional completo para joalherias — CRM, pedidos, produção, PDV, estoque, financeiro, analytics e assistente IA. Entregue como SaaS com container Docker isolado por cliente. Software de produção: erros em pagamento, estoque ou autenticação têm impacto direto no negócio.

**Repositório**: monorepo `ORION-CRM/`
**Status atual**: verificar com `git log --oneline -10` antes de começar qualquer sessão

---

## STACK (imutável — não substituir)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS 3.x |
| Backend | Node.js 20 + Express + TypeScript strict |
| Banco | PostgreSQL 16 |
| Cache/Fila | Redis + BullMQ |
| Automações | Activepieces self-hosted (MIT) via API REST |
| IA Automações | Python 3.11 + FastAPI + LangChain |
| WhatsApp | Meta Cloud API (Graph API v19.0+) |
| Pagamentos | Mercado Pago |
| Containerização | Docker + Docker Compose |
| Proxy | NGINX alpine |

**NUNCA usar**: moment.js, react-beautiful-dnd, Chart.js, MUI, Chakra, AntD, axios (usar fetch nativo ou ky), FLOAT para valores monetários.

---

## DESIGN SYSTEM (aplicar em todo componente de UI)

```css
/* Tokens — copiar do ORION-BUILD-GUIDE.md Seção 1.1 */
brand-gold:    #C8A97A   /* CTAs, badges, acentos */
surface-sidebar: #0F0F0F /* sidebar */
canvas:        #F8F7F5   /* content area */
canvas-card:   #FFFFFF   /* cards */

/* Fontes */
font-sans:  Inter
font-serif: Playfair Display  /* títulos de página */
```

**Regras de layout críticas** (Claude Code frequentemente esquece):
- Todo `flex-1` precisa de `min-w-0` para não vazar
- Colunas fixas precisam de `flex-shrink-0`
- Skeleton loading em todo fetch — nunca spinner centralizado
- Empty state em toda lista que pode estar vazia
- Error state com botão "Tentar novamente" em todo fetch que pode falhar

---

## ORDEM DE IMPLEMENTAÇÃO

Executar em fases. Não avançar sem o anterior estar funcionando e `docker compose up -d` limpo.

### Fase 1 — Fundação
1. `docker-compose.yml` completo (api, postgres, redis, activepieces, python-ai, nginx)
2. Migrations SQL completas (todas as tabelas do PRD Seção 5)
3. Seed: `INSERT INTO settings DEFAULT VALUES` (singleton obrigatório no boot)
4. `POST /api/v1/operator/webhook` com HMAC + ação `provision`
5. Auth: login + refresh + rotação de refresh token
6. Middleware global de status: `settings.status = 'suspended'` → 403 antes de qualquer auth
7. RBAC middleware (`requireRole([...])`)
8. Audit log middleware (automático — não chamar manualmente por endpoint)
9. `GET+PUT /api/v1/settings` + `POST /api/v1/settings/logo`
10. `GET /health` e `GET /api/v1/operator/health`

### Fase 2 — Core CRM
11. CRUD leads com RBAC + deduplicação por whatsapp_number
12. CRUD clientes com RBAC
13. `POST /webhooks/whatsapp` → validar HMAC → enfileirar BullMQ → 200 imediato
14. Worker BullMQ: BL-001 (processar mensagem)
15. Inbox: listar conversas, mensagens, enviar via Meta API

### Fase 3 — Pedidos e Produção
16. CRUD pedidos com state machine (ver Seção 10 do PRD)
17. custom_order_details + upload de imagens de design
18. Ordens de produção + etapas + fotos de evidência
19. Notificação de status via WhatsApp (job BullMQ — nunca síncrono)

### Fase 4 — PDV, Estoque, Pagamento
20. Produtos/estoque com `SELECT FOR UPDATE` em vendas concorrentes
21. PDV: busca debounce 300ms + carrinho + finalização + cálculo de troco
22. Mercado Pago: gerar link + `POST /webhooks/mercadopago` + BL-002 + BL-003

### Fase 5 — Financeiro
23. Entradas automáticas via evento de pagamento (BL-002)
24. Despesas manuais + relatórios por período
25. Dashboards por role (FR-016)

### Fase 6 — IA e Automações
26. Assistente IA com Function Calling (ler PRD Seção 16 integralmente antes)
27. Python AI container: FastAPI + endpoints `/classify-intent`, `/generate-response`, etc.
28. Activepieces: pieces customizadas ORION + deploy via API
29. Builder visual: canvas React Flow + sincronização com Activepieces
30. Workflows WF-001 e WF-002

---

## REGRAS ABSOLUTAS

### NUNCA
```
❌ TypeScript any — sem @ts-ignore — tipagem estrita em tudo
❌ FLOAT para valores monetários — sempre INTEGER (centavos)
❌ SQL string concatenado — usar Knex ou Prisma
❌ fetch manual com useEffect+useState — sempre react-query
❌ Validação manual de form — sempre zod + react-hook-form
❌ CSS inline — sempre Tailwind classes
❌ Secrets no código — sempre process.env (process.exit(1) se undefined no boot)
❌ Logs com CPF, telefone, email, tokens em plaintext — usar SHA-256
❌ Activepieces ou Python AI expostos pelo NGINX — sempre rede interna
❌ n8n com acesso direto ao banco — sempre via API REST
❌ Processar webhook WhatsApp ou MP de forma síncrona — sempre BullMQ
❌ Modificar arquivos em prd.docs/
```

### SEMPRE
```
✅ Ler PRD do módulo antes de implementar
✅ RBAC testado: acesso permitido E negado para cada role
✅ Audit log em toda operação de escrita (INSERT/UPDATE/DELETE)
✅ Estoque e pagamento dentro de transação SQL (BEGIN/COMMIT)
✅ Webhooks: retornar 200 imediatamente, processar via BullMQ
✅ Operações de estoque: SELECT FOR UPDATE (previne corrida)
✅ Refresh token: invalidar anterior ANTES de criar novo (em transação)
✅ Upload de arquivo: validar por magic bytes, não extensão
✅ requestId (UUID v4) em todo log e resposta de erro
✅ tsc --noEmit limpo antes de considerar feature completa
✅ docker compose up -d funcionar do zero com apenas .env
```

---

## FORMATADORES (criar em lib/utils.ts — usar em todo o projeto)

```typescript
export const fmt = {
  // 180000 → "R$ 1.800,00"
  currency: (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100),

  // "+5511999999999" → "(11) 99999-9999"
  phone: (e164: string) => {
    const d = e164.replace(/\D/g, '').replace(/^55/, '')
    return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  },

  // date-fns ptBR
  relativeTime: (date: Date | string) =>
    formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR }),

  fullDate: (date: Date | string) =>
    format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
}
```

---

## FORMATO DE ERRO (padrão de toda resposta de erro)

```json
{
  "error": "MACHINE_READABLE_CODE",
  "message": "Mensagem segura para o usuário",
  "requestId": "uuid-v4",
  "details": []
}
```
Nunca incluir: stack trace, SQL, path de arquivo, secrets.

---

## GOTCHAS CRÍTICOS

- **Settings singleton**: boot faz `SELECT * FROM settings LIMIT 1` — abortar se não encontrar. Cache Redis `settings:instance` TTL 5min, invalidar no PUT /settings
- **Middleware de suspensão**: roda ANTES do middleware de auth
- **Activepieces pieces**: compilar TypeScript + publicar via API antes de ficarem disponíveis no builder — criar script de deploy como parte do CI/CD
- **Python AI cold start**: ~2-3s — implementar health check ping a cada 5min para manter quente
- **Meta Cloud API webhook de verificação** (GET com `hub.challenge`): implementar no Dia 1 da Fase 2 — sem isso nenhuma mensagem chega
- **Janela de 24h WhatsApp**: validar SEMPRE antes de enviar texto simples — fora da janela, só templates aprovados
- **Estoque concorrente**: `SELECT ... FOR UPDATE` — nunca apenas `WHERE stock > 0`
- **Branding no login**: endpoint público `GET /api/v1/settings/public` retorna company_name, logo_url, primary_color — sem auth

---

## DEFINITION OF DONE

Feature está completa SOMENTE quando:
- [ ] Acceptance criteria do PRD atendidos
- [ ] Error cases retornam códigos HTTP corretos (PRD Seção 9.2)
- [ ] RBAC testado: permitido E negado para cada role relevante
- [ ] Audit log gravado para toda operação de escrita
- [ ] Loading, empty e error states no frontend
- [ ] `tsc --noEmit` limpo
- [ ] Zero secrets em código, logs ou respostas de API
- [ ] `docker compose up -d` funciona do zero com apenas .env

---

## AGENT RULES (comportamento obrigatório)

### Prioridade do Humano
- Tempo e conhecimento são os recursos de maior valor neste projeto.
- Não criar retrabalho evitável, ambientes paralelos ou confusão de status.
- Não apresentar suposições como trabalho concluído.

### Ambiente
- Este repo tem um único runtime canônico: `docker compose` a partir da raiz.
- Antes de alterar qualquer coisa relacionada ao runtime, inspecionar o stack existente.
- Não criar stack Docker alternativo quando o repo já tem um compose definido.
- Se o ambiente estiver desatualizado, rebuild o stack atual — não inventar um segundo.

### UI / Mockup
- A pasta canônica de design visual é `PRD.DOCS/Designer Systems/`.
- O arquivo base do design system é `PRD.DOCS/Designer Systems/ORION-DESIGN-SYSTEM.html`.
- Todo mockup `.html` em `PRD.DOCS/` é especificação visual obrigatória da feature correspondente.
- Nunca inventar layout, componente, estilo ou interação se já existir mockup em `PRD.DOCS/`.
- **NUNCA dizer que uma tela está "pronta" ou "implementada" a menos que:**
  - A rota/componente existe no código
  - O ambiente rodando usa o código mais recente
  - A página foi verificada contra o PRD/mockup correspondente
  - A resposta declara explicitamente se o resultado é exato, parcial ou apenas fundacional

### Reporting (separar sempre em 3 camadas)
- `Banco` — migrations, queries, schema
- `API/Backend` — endpoints, workers, serviços
- `Frontend/UI` — rotas, componentes, visual renderizado

Se uma mudança visual não está visível na página que o usuário está verificando, dizer exatamente onde aparece. Se algo não foi validado em browser/runtime ao vivo, declarar explicitamente.

### Prevenção de Falhas
- Antes de dizer "está feito": verificar o ambiente que o usuário está usando.
- Antes de dizer "a página não existe": verificar arquivos de rota e status do runtime.
- Antes de dizer "a interface está pronta": verificar o resultado renderizado ou rotular como não validado.
- Se há ambiguidade: reportar a incerteza — não comprimir incerteza em confiança.

---

## INÍCIO DE SESSÃO

Ao iniciar qualquer sessão de trabalho:

```bash
# 1. Verificar onde parou
git log --oneline -10
git status

# 2. Verificar se está na raiz correta
ls prd.docs/

# 3. Ler PRD do módulo a ser implementado hoje
cat prd.docs/ORION-CRM-PRD-v1.2.md | grep -A 50 "FR-00X"
```
