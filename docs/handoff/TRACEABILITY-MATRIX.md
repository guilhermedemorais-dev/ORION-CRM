# Matriz de rastreabilidade, produto para código

## Critério

Cada linha liga requisito/documento a evidência técnica no baseline `29c1639`.
Uma issue aberta não é prova de implementação. `—` significa que a ligação não
foi localizada nesta passada, não que seja impossível existir em runtime.

| Regra/feature | PRD/módulo | Spec/task/issue | Frontend | Endpoint/serviço | Tabela/migration | Teste/evidência | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login e sessão | PRD v1.2, Auth | — | `/login`, LoginForm | `/auth/login`, `/auth/refresh`; auth middleware | users, auth migrations | source e testes de rota locais | IMPLEMENTADO/PARCIAL |
| Lead e pipeline | PRD CRM | issue #28 aberta | Leads/Pipeline | leads, pipeline e pipelines routes | leads, pipelines, pipeline_stages | código; E2E não localizado | PARCIAL |
| Ficha do cliente | PRD CRM | issue #17 aberta | `/clientes/[id]` | customers routes | customers e relações | documentação/código | PARCIAL |
| Histórico WhatsApp | PRD Inbox | issue #16 aberta | Ficha/Inbox | customers/inbox/n8n routes | conversations, messages | QA histórico existente | PARCIAL |
| Atendimento sanitizado | PRD Atendimento | issue #18 aberta | abas da Ficha | attendance routes | attendance_blocks | sanitizador no source; teste de segurança não executado | PARCIAL |
| Inbox inbound | PRD Inbox | issue #15 aberta | `/inbox` | webhook/n8n/inbox | conversations, messages | código + QA; provider externo ausente | PARCIAL |
| Agenda e lembrete | PRD Agenda | issue #35 aberta | `/agenda` | appointments + worker | appointments, Redis job | source; Redis/n8n NÃO VALIDADO | PARCIAL |
| Propostas multi-peça | produção spec | TASK-001–005, issue #12 aberta | aba Propostas | proposals routes | proposals, itens relacionados | migration 061 e source | PARCIAL |
| Pedido personalizado → produção | PRD Pedidos | issue #48 aberta | `/pedidos`, `/producao` | orders status → production | orders, custom_order_details, production_orders | source transaction | IMPLEMENTADO/PARCIAL |
| PDV e financeiro | PRD PDV/Financeiro | issues #31 e #39 abertas | `/pdv`, `/financeiro` | pdv/financial/order-financial | orders, payments, entries, movements | serviço transacional; DB real NÃO VALIDADO | PARCIAL |
| Estoque e dados sensíveis | PRD Estoque | issues #38, #52–56 abertas | `/estoque` | products + order-financial | products, movements | issues abertas e WIP separado | PARCIAL |
| Transportadoras | PRD Settings | issue #37 aberta | Ajustes, Entregas | carriers/deliveries | carriers_config, deliveries | adapters source; API externa NÃO VALIDADA | PARCIAL |
| Loja e checkout | PRD e-commerce | issue #32 aberta | `/loja` | store/mercadopago | catálogo, pedidos/pagamentos | preferência no source; confirmação não homologada | PARCIAL |
| Analytics | PRD analytics | issue #33 aberta | `/analytics` | analytics routes | agregados do domínio | consultas source; métricas não homologadas | PARCIAL |
| Assistente IA com RBAC | PRD AI-001 | issue #34 aberta | AssistantDock | assistant/ai-copilot | ai config, skills, logs | source; teste negativo não executado | PARCIAL |
| Builder n8n | módulo Automações | issue #30 aberta | `/automacoes` | automations/n8n | automation_flows | source; n8n externo não homologado | PARCIAL |
| Exportação de incidentes | módulo Suporte | TASK-042, issue #42 fechada | `/chamados` | tickets/system routes | tickets/incidentes | artefato/task e source | IMPLEMENTADO/PARCIAL |
| Base Técnica | pedido de handoff | spec `support/base-tecnica`, TASK-062, issue #62 | `/base-tecnica`, item Sidebar somente ADMIN | `support-technical.routes` e serviço allowlisted | sem tabela, por decisão | teste de rota 3/3 e HTTP isolado do ZIP | IMPLEMENTADO, NÃO HOMOLOGADO |

## Cobertura complementar dos módulos mínimos

| Regra/feature | PRD/módulo | Spec/task/issue | Frontend | Endpoint/serviço | Tabela/migration | Teste/evidência | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Dashboard | — | `/dashboard` | dashboard route | agregados de CRM/operação | source; dados reais não verificados | IMPLEMENTADO/PARCIAL |
| Cotação separada | Comercial | — | não localizada | não localizada | não localizada | busca em routes/migrations | INDEFINIDO |
| OS e materiais | Produção | — | aba OS da Ficha | service-orders route | service_orders/materials, 030/051 | source; baixa não homologada | IMPLEMENTADO/PARCIAL |
| Entrega e tracking | Entregas | issue #37 parcialmente relacionado | aba Entrega | deliveries/carriers adapters | deliveries/carriers, 030/032 | source; provider externo ausente | PARCIAL |
| Usuários e permissões | Auth/RBAC | tasks de permissões legadas | Ajustes/Ficha | users, rbac, permissions | users/custom_permissions, 002/030 | matriz RBAC e source | PARCIAL |
| Auditoria | transversal | — | sem tela dedicada confirmada | audit middleware + ações | audit_logs, 010 | source; cobertura não uniforme | PARCIAL |
| Configuração geral | Ajustes | — | `/ajustes` | settings/integrations/providers | settings + provider migrations | source; env externo ausente | PARCIAL |
| WhatsApp provider | Inbox/Integrações | — | Aba WhatsApp | providers/sender/meta/evolution | whatsapp_providers, 033 | source; provedor não testado | PARCIAL |
| Mercado Pago | PDV/Loja | issue #31/#32 | PDV/checkout | MP service/webhooks | payments/store_orders, 008/019 | source; callback não homologado | PARCIAL |
| Roadmap interno | Gestão | migration 052; issue não localizada | não há página CRM confirmada nesta matriz | roadmap routes | roadmap tables, 052 | source; fluxo não testado | IMPLEMENTADO/PARCIAL |
| Admin de banco | Administração | TASK-043 relacionada | Ajustes | database-admin routes | todas as tabelas | source; destrutivo, não executado | PARCIAL |

Para caminhos/métodos de cada route module, use `API-ROUTE-CATALOG.md`; para
papel de negócio, estados e efeitos, use `MODULE-OPERATING-DOSSIERS.md`. Esta
separação evita repetir uma lista de endpoints sem seu contexto transacional.

## Divergências de alto impacto

1. PRD contém Activepieces/Python AI, mas baseline executável referencia
   n8n/TypeScript e não sobe esses containers.
2. Há múltiplas issues abertas para superfícies que já possuem tela/código. O
   estado correto é parcial, não concluído.
3. A migration 063 e ajustes de fluxo do diretório de trabalho não pertencem ao
   commit de entrega e não entram nesta matriz.

## Uso de manutenção

Ao modificar uma linha, atualizar o PRD/módulo canônico quando autorizado, a
spec, task, issue, contrato de backend, UI e teste relacionado. A matriz não
autoriza implementação sem o workflow de governança do repositório.
