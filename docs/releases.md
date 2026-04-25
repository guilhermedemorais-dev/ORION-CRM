# ORION CRM — Histórico de Releases

> Changelog estruturado do desenvolvimento do sistema, organizado por versão e data.
> Atualizado manualmente pelo dev a cada entrega significativa.
> Este arquivo é consumido pelo endpoint `GET /api/internal/system/timeline` e exibido na página `/chamados` (abas "Linha do Tempo" e "Atualizações").

---

## [v0.8.1] — 2026-04-25
### Módulo Suporte expandido com Linha do Tempo e Atualizações
- Reformulação do módulo `/chamados` com 3 abas: Incidentes, Linha do Tempo e Atualizações
- Endpoint `GET /api/internal/system/timeline` que parseia este arquivo e retorna JSON estruturado
- Linha do Tempo visual estilo changelog com badges de versão dourados
- Aba Atualizações separa "Entregue recentemente" de "Em desenvolvimento"
- Cliente passa a acompanhar a evolução do sistema sem precisar de daily

## [v0.8.0] — 2026-04-25
### Pipeline QA + Módulo Suporte/Chamados
- Pipeline QA: 13 das 14 tasks resolvidas (críticas, altas e quick wins)
- Toolbar compacta do Pipeline com QuickView, import/export CSV e card footer
- LeadCardMenu (dropdown contextual) substituindo botão "+" que causava logout
- Modal de confirmação Ganhou/Perdeu com simetria (valor obrigatório vs motivo obrigatório)
- View Lista funcional com toggle Pipeline/Lista e persistência em localStorage
- Pipeline mobile fallback automático para view de lista em viewports <768px
- Validação inline modal "Novo Lead" com regex e mensagens contextuais
- Feedback de salvamento da nota inline (Salvando → Salvo ✓ → idle)
- Colapsar colunas vazias e ocultar etapas vazias com persistência
- Módulo Suporte/Chamados completo (migration 044, rota /chamados, upload de mídias)
- Tabela `system_tickets` com tipos BUG/SUGGESTION/OTHER e status OPEN/EVALUATING/RESOLVED/REJECTED
- Painel admin transparente com select inline de status para ROOT/ADMIN
- Fix de logout em ambiente local com http (cookies sem secure flag)

## [v0.7.1] — 2026-04-24
### QA Agenda — 19 tasks resolvidas
- 6 visualizações estilo Google Calendar (Mês, Semana, Dia, 4 Dias, Agenda, Programação)
- Barra única consolidada de navegação do calendário
- CRUD completo de agendamentos (criar, editar, cancelar com motivo, remarcar)
- Confirmação inline antes de "Concluir Atendimento"
- Deduplicação de eventos duplicados no calendário
- Cor CONCLUÍDO corrigida para verde (era cinza)
- Máscara WhatsApp `(XX) XXXXX-XXXX` com `inputMode="numeric"`
- Pré-seleção do responsável com user.id logado via sessão
- Sanitização de nomes de eventos (ALL_CAPS → "Formato Normal")
- Modal centralizado na viewport com max-h-[90vh]
- Área de toque dos eventos com min-h-[44px] (WCAG 2.5.5)
- Tooltip com nome completo e tipo nos eventos do calendário
- Sistema de cores unificado entre eventos do calendário e badges do painel

## [v0.7.0] — 2026-04-23
### Dashboard QA Completo — 22 tasks resolvidas
- Responsividade completa: breakpoints mobile (640px), tablet (1024px), narrow (380px)
- Calendário dinâmico com `new Date()` em useEffect (evita hydration mismatch)
- Gráfico de faturamento com série SVG + fallback "Nenhum dado para o período"
- KPI values com `suppressHydrationWarning` + DashboardSkeleton durante hydration
- Top Clientes corrigido para centavos coerentes com faturamento (`total_cents`)
- Botões de aniversariantes: modal de parabéns + WhatsApp wa.me com texto pré-preenchido
- Painel de Notificações no Topbar com `aria-haspopup`, `aria-expanded` e close on outside click
- Atividade recente com `relativeTime()` + `activityLabel()` por tipo
- AI Assistant com badge "manutenção", `disabled`, tooltip e env var `NEXT_PUBLIC_ORION_AI_ENABLED`
- Cards de estoque crítico clicáveis com `onClick → router.push('/estoque')`
- Etapas de produção canônicas (`PRODUCTION_STAGES_CANONICAL`)
- Skeleton loaders para KPIs, gráfico, alertas e atividade
- KPI cards clicáveis com `router.push()`, `role="link"`, `tabIndex={0}`
- Auto-refresh 60s com `router.refresh()` + timestamp "Atualizado: HH:mm"

## [v0.6.0] — 2026-04-13
### IA Copiloto + Central de Ajuda + Agenda Backend
- Módulo IA Copiloto com sistema de skills e suporte Qwen
- Refatoração do layout de skills para cards visuais com ícones por categoria
- Central de Ajuda com abas Ajuda/Tutorial e documentação de todos os módulos
- Backend de appointments completo (3a32469): rotas + integração com leads
- Calendário estilo Google Calendar com botões funcionais
- Validação obrigatória de campos no agendamento + lead aparece no kanban
- Permitir até 2 agendamentos por slot, retornar mensagem formatada e criar lead automaticamente
- WhatsApp movido para sub-aba dentro de Integrações
- Endpoints n8n: lead-context, available-slots e create-appointment

## [v0.5.1] — 2026-03-30
### Settings — Webhook Multi-Key + RBAC Hardening
- Multi-key webhook management panel
- Card de webhook key movido para aba "API & Webhooks"
- Geração de CRM webhook key para automações externas
- Fix RBAC: ROOT bypass em userCan + ADMIN full access na permissions matrix
- Fix n8n: parâmetro de query corrigido + erro no update-lead
- Pipeline_id e stage_id incluídos no upsert de leads via n8n

## [v0.5.0] — 2026-03-27
### Dashboard Real + User Management v2 (5 roles)
- Dashboard refeito com dados reais do banco (queries agregadas por role)
- Endpoint `GET /api/internal/dashboard` com `getAdminDashboard`, `getAtendenteDashboard`, `getProducaoDashboard`, `getFinanceiroDashboard`
- Animação de contagem numérica com easing cúbico nos KPI cards
- IntersectionObserver para animações de entrada com stagger
- Migration 038: expansão de user roles (ROOT, ADMIN, GERENTE, VENDEDOR, PRODUCAO)
- Middleware `requireRole` com bypass total para ROOT
- Modal "Convidar Usuário" redesenhado conforme mockup v2
- Modal "Editar Usuário" redesenhado com barra de status inline
- Grid de permissões com 10 módulos fixos + pipelines dinâmicos
- Endpoint `DELETE /api/internal/users/:id` com prevenção de auto-exclusão e audit log
- Botão "Excluir" com Trash2 vermelho e confirmação via window.confirm()
- Aba de Segurança com restrição de login por horário e session timeout configurável

## [v0.4.0] — 2026-03-16
### Busca Global + RBAC Expandido + PRDs PDV/Estoque
- Migration 035: tabela `proposal_attachments` para anexos de propostas
- Endpoint `/api/internal/search` para busca global
- Busca simultânea em clientes, produtos, pedidos e leads
- Endpoints `/api/v1/customers/:id/proposals/attachments` (GET, POST, DELETE)
- Componente `GlobalSearch.tsx` com modal de busca
- Atalho de teclado Cmd+K/Ctrl+K no Topbar
- Migrations 025-034 para PDV, estoque, painel cliente, carriers e providers
- Middleware RBAC permissions
- Carriers service com adapters e REST routes
- Routes: attendance, renders, service-orders, deliveries
- Routes: whatsapp-providers, integration-providers
- PRDs adicionados para PDV, Estoque, Painel Cliente, Help System e Ajustes
- Settings: Fiscal e Logística mescladas em Integrações como sub-tabs

## [v0.3.1] — 2026-03-13
### Inbox Closure + Analytics Tabs + Automations Canvas
- Inbox closure (fechamento de conversas)
- Analytics tabs adicionais
- Automations canvas inicial (drag-and-drop)
- Financial receipt upload (comprovante físico)
- LeadDetailClient layout refactor + fix UI text references

## [v0.3.0] — 2026-03-12
### Evolution — Pipeline v2, Inbox Multicanal, Loja, Analytics, IA v2
- Migration 017: pipelines foundation com modelo canônico
- Migration 018: inbox multichannel foundation
- Migration 019: store foundation
- Migration 020: store_order_crm_sync (rastreabilidade store → CRM)
- API `/api/v1/pipelines/*` com sidebar dinâmica por pipeline
- Rota canônica `/pipeline/[slug]` + builder inicial `/pipeline/[slug]/builder`
- Inbox v2 foundation com SSE realtime e quick replies
- Catálogo backend de automações
- API canônica `/api/v1/financeiro/*` com compatibilidade legada
- Checkout público via preferência Mercado Pago
- Sync `store_order → customer → crm order → payment → stock`
- Simulação local de venda aprovada para testes sem produção
- Analytics de vendas `/api/v1/analytics/sales` com Recharts
- Assistente IA v2 com fallback por tools, RBAC reforçado, usage no retorno
- Rotas públicas `/loja` e `/loja/produto/[slug]`
- Rota admin `/settings/loja`
- Widget do assistente com Ctrl+K, Esc, skeleton e exibição de uso

## [v0.2.0] — 2026-03-03
### CRM Core Completo + Deploy Hostinger
- Bloco 2: design system + shell frontend (Next.js 14 + Tailwind + componentes base)
- Bloco 2: layout do CRM com auth guard
- Bloco 3: CRUD de leads + pipeline kanban inicial
- Bloco 3: lista e detalhe de clientes com painel completo
- Bloco 4: Inbox WhatsApp base (lista, thread, assign, close, webhook, worker)
- Bloco 5: pedidos pronta entrega + personalizados com state machine
- Bloco 5: fila de produção com avanço de etapa
- Bloco 6: produtos + ajustes de estoque com SELECT FOR UPDATE
- Bloco 6: PDV com busca debounce, carrinho e finalização
- Bloco 6: financeiro (entradas, despesas, relatórios)
- Bloco 7: Mercado Pago — link de pagamento + webhook MP
- Bloco 7: dashboard inicial e assistente IA v1
- Bloco 8: n8n no compose, landing pública, captura de leads
- Bloco 9: CRUD de workflows n8n com toggle, execuções e seed
- Bloco 10: assistente IA v2 operacional com histórico curto, RBAC e logs
- Deploy na Hostinger com Traefik + SSL
- GitHub Actions com build + push para GHCR

## [v0.1.0] — 2026-03-02
### Fundação Backend + Infra
- API Express + TypeScript strict
- Migrations principais do CRM (leads, clientes, pedidos, produção)
- Sistema de auth com JWT + refresh token rotacionado em transação
- RBAC middleware com `requireRole([...])`
- Audit log middleware automático em toda operação de escrita
- Rate limiting por endpoint sensível
- Settings singleton com cache Redis (TTL 5min)
- Operator webhook com HMAC + ação `provision`
- Health check (`GET /health` e `GET /api/v1/operator/health`)
- Docker Compose completo (api, postgres, redis, nginx)
- `.env.example` documentado
- Estrutura de upload com magic bytes validation
- requestId (UUID v4) em todo log e resposta de erro
- Formato de erro padrão `{error, message, requestId, details}`
