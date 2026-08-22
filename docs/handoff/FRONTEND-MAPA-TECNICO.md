# Frontend, mapa técnico e contratos de navegação

## Arquitetura observada

O frontend é Next.js App Router em `apps/web`. O grupo `(crm)` compartilha
`app/(crm)/layout.tsx`; a navegação operacional usa componentes de layout em
`components/layout/`. Chamadas server-side usam `apiRequest`/ações do App Router
e chamadas client-side usam o proxy Next em `app/api/internal/[...path]/route.ts`.
Nginx encaminha `/api/internal/*` ao container web, não ao Express.

```mermaid
flowchart LR
  B[Navegador] --> P[Page ou componente client]
  P --> A[Server Action ou apiRequest]
  A --> X[API Express /api/v1]
  P --> I[/api/internal/*]
  I --> N[Next route handler]
  N --> X
  X --> DB[(PostgreSQL)]
```

Não há store global identificado nesta passada. Os hooks próprios encontrados
são `useHelpContext` e `usePermissions`; permissões visuais não substituem os
guards da API.

## Rotas e telas

| Rota | Página/ações | Componentes críticos | APIs/efeito principal | Estado |
| --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` | landing | navegação/captação | IMPLEMENTADO, não homologado |
| `/login` | `(auth)/login/page.tsx`, `actions.ts` | `LoginForm` | autenticação e cookies | IMPLEMENTADO, browser NÃO VALIDADO |
| `/dashboard` | `(crm)/dashboard/page.tsx` | AppShell, KPIs | dashboard API | IMPLEMENTADO |
| `/leads`, `/leads/[id]` | páginas e `leads/actions.ts` | `LeadsPipelineClient`, detalhe, importação e stage confirm | leads/pipeline | IMPLEMENTADO/PARCIAL |
| `/pipeline/[slug]` | página e `pipeline/actions.ts` | board e regras | pipelines/flows | IMPLEMENTADO/PARCIAL |
| `/clientes`, `/clientes/[id]` | páginas e `clientes/actions.ts` | `ClientPanelShell`, Topbar e abas | customers, blocks, propostas, OS, entregas | IMPLEMENTADO/PARCIAL |
| `/agenda` | página e `agenda/actions.ts` | `AppointmentSheet`, tabs de lead | appointments | IMPLEMENTADO/PARCIAL |
| `/inbox` | página e `inbox/actions.ts` | ConversationList, Thread, Composer, RealtimeBridge | inbox e stream interno | IMPLEMENTADO/PARCIAL |
| `/pedidos` | página e `pedidos/actions.ts` | `PedidosClient`, shared | orders, status, recibo/NF-e | IMPLEMENTADO/PARCIAL |
| `/producao` | página e `producao/actions.ts` | `ProducaoClient` | production-orders | IMPLEMENTADO/PARCIAL |
| `/estoque` | página e `estoque/actions.ts` | `EstoqueClient` | products/movimentos | IMPLEMENTADO/PARCIAL; issues abertas |
| `/financeiro` | página e `financeiro/actions.ts` | `FinanceiroClient`, goal modal | financeiro/lançamentos | IMPLEMENTADO/PARCIAL |
| `/pdv` | página e `pdv/actions.ts` | `PdvClient`, ReceiptModal | PDV e Mercado Pago | IMPLEMENTADO/PARCIAL |
| `/analytics` | `(crm)/analytics/page.tsx` | `AnalyticsClient` | analytics | IMPLEMENTADO/PARCIAL |
| `/automacoes` | página e `automacoes/actions.ts` | catálogo e editor React Flow | automations/n8n | PARCIAL; n8n externo não homologado |
| `/ajustes`, `/settings/loja` | páginas | `AjustesClient`, abas IA, integrações, logística e fluxo | settings/users/integrations/store settings | IMPLEMENTADO/PARCIAL |
| `/chamados` | `(crm)/chamados/page.tsx` | tela de tickets | tickets | PARCIAL |
| `/base-tecnica` | `(crm)/base-tecnica/page.tsx` | `BaseTecnicaClient`, índice, busca, renderer restrito e retry | proxy `/api/internal/support/technical/*` | IMPLEMENTADO, browser/produção NÃO HOMOLOGADOS; somente ADMIN |
| `/loja`, `/loja/produto/[slug]` | páginas e `loja/actions.ts` | StoreProductCard, StoreCheckoutForm | store e checkout | IMPLEMENTADO/PARCIAL |
| `/catalogo` | `app/catalogo/page.tsx` | catálogo público | leitura pública | IMPLEMENTADO/PARCIAL |

## Formulários, estados e falhas

- Server Actions existem em agenda, automações, clientes, estoque, financeiro,
  inbox, leads, PDV, pedidos, pipeline e loja. As actions são contrato de UI e
  devem ser alteradas junto com Zod/API correspondente.
- Componentes de estado reutilizáveis existem: `Skeleton`, `EmptyState`,
  `ApiErrorMessage`, `ErrorModal`, `ToastProvider` e `ConfirmDialog`. A presença
  deles não prova que toda tela os use corretamente.
- `ClientErrorReporter` indica coleta de erro de UI; verificar destino e dados
  enviados antes de ampliar observabilidade.
- `AssistantDock` chama handler interno `app/internal/assistant/route.ts`, que
  encaminha para o endpoint autenticado do assistente.
- `BaseTecnicaClient` só renderiza conteúdo quando a sessão recebida é
  `ADMIN`; isso é defesa de UI. O contrato decisivo é a API, que aplica guarda
  explícita e nega `ROOT` em `/api/v1/support/technical/*`.

## Pontos de fronteira e riscos

1. `/api/internal` é parte essencial do contrato para componentes client; uma
   chamada direta equivocada para a API pode perder sessão, base URL ou política
   de proxy.
2. A rota pode existir sem fluxo completo. Exemplo: tela Automação não prova
   n8n disponível; tela Loja não prova confirmação de pagamento.
3. A árvore atual contém `node_modules` local. Nunca confundir arquivos de
   dependência com componente do produto nem incluí-los em artefato de entrega.
4. Há mudanças locais não pertencentes ao baseline em telas de cliente,
   pipeline, pedidos e Ajustes. Este documento descreve `29c1639`, não WIP.
   A exceção controlada é `/base-tecnica`, entregue como overlay de handoff e
   validada por typecheck, teste de rota e HTTP isolado do ZIP.

## Relação com o fluxo de negócio

- Pré-venda: Inbox → Leads/Pipeline → Agenda → Clientes.
- Operação: Ficha/Atendimento → Propostas/Pedidos → Produção/OS → Entrega.
- Transversal: Estoque, Financeiro e PDV.
- Administração: Ajustes, Usuários, Integrações, Automações e Suporte.

Para transições reais, consultar `FLUXO-OPERACIONAL-END-TO-END.md`; para
camadas de autorização, `RBAC-E-INTEGRACOES-TECNICO.md`.
