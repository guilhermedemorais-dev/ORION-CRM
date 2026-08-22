# QA, gaps de PRD e rastreabilidade inicial

**Baseline:** `29c1639`. O status abaixo é evidência disponível no repositório;
não representa execução nova contra produção.

## Cobertura de testes encontrada

| Camada | Evidência | Cobertura conhecida | Limite |
| --- | --- | --- | --- |
| API unitária/integração | `apps/api/src/**/*.test.ts`, script `npm test` | auth, atendimento, clientes, banco-admin, WhatsApp, pipeline e serviços selecionados | não prova PostgreSQL/Redis/fornecedores reais |
| Tipagem API | `npm run typecheck` | TypeScript | não prova contrato HTTP nem regra de negócio |
| Web E2E | Playwright `01` a `06` | health, login, dia de operação, RBAC, clientes e agenda | depende de runtime/fixtures; execução desta passada não feita |
| Build | scripts `npm run build` | API e Next.js | build não é homologação |

## QA crítico existente

O relatório `docs/qa/reports/architecture/backend-database-audit.md` é a fonte
de achados técnicos. Prioridades ainda relevantes para handoff:

1. Histórico de cliente: contrato `type=all` divergente e query WhatsApp com
   schema desatualizado/erro oculto.
2. RBAC: escopo de cliente e comportamento ROOT inconsistentes entre middleware,
   helper e serviços.
3. Atendimento: HTML não sanitizado renderizado por sink perigoso, com risco de
   XSS persistente.
4. UI/fluxos parciais: upload de foto, IA 3D, feedback, NF-e e comprovantes
   não fecham o ciclo prometido.
5. Sessão: refresh existe no backend, mas a auditoria aponta que o frontend
   redireciona no primeiro 401 em vez de usá-lo.

Todos devem ser considerados **NÃO HOMOLOGADOS** até teste de regressão e
validação runtime. Não foram corrigidos nesta passada documental.

## PRD versus código

| Regra/feature | PRD/documentação | Código e evidência | Status |
| --- | --- | --- | --- |
| Auth com JWT e refresh | PRD FR-001 | login/refresh e `refresh_tokens` existem | IMPLEMENTADO, runtime NÃO VALIDADO |
| RBAC em todos endpoints | PRD FR-002 | middleware/matriz existem; auditoria achou divergências | PARCIAL |
| Meta WhatsApp → CRM | PRD | webhook assinado, fila BullMQ e worker existem | IMPLEMENTADO, integração real NÃO VALIDADA |
| Activepieces/Python IA | PRD | Compose atual não declara esses containers; código usa n8n/TS | DOCUMENTADO NÃO IMPLEMENTADO ou LEGADO |
| n8n | PRD e código | serviço, rotas e env existem; Compose não declara container | PARCIAL |
| NF-e | UI/documentação de pedidos | migração e solicitação pendente, sem emissor real | PARCIAL |
| Comprovante enviado | UI de pedido/PDV | auditoria relata redirecionamento manual | PARCIAL |
| Ficha → OS → entrega | painel e rotas existem | há componentes/rotas, mas transições e erros silenciosos | PARCIAL |

### Cobertura estendida por módulo

| Módulo/regra | PRD/spec/issue localizado | Código e documento de prova | Classificação |
| --- | --- | --- | --- |
| Dashboard | PRD operacional; sem spec específica localizada | dashboard route/página e dossiê | IMPLEMENTADO NÃO HOMOLOGADO |
| CRM/Leads | PRD CRM; issue pipeline/lead parcial | leads, Ficha, pipeline e migrations | IMPLEMENTADO/PARCIAL |
| Pipeline | PRD CRM; rules órfãs sem mount | routes legado/canônico, stages e defaults | IMPLEMENTADO/PARCIAL |
| Clientes | PRD CRM; issue #17 | Ficha, customers e relações | IMPLEMENTADO/PARCIAL |
| Inbox | PRD Inbox; issue #15 | inbox, worker e conversas | IMPLEMENTADO/PARCIAL |
| Agenda | PRD Agenda; issue #35 | appointments e reminder | IMPLEMENTADO/PARCIAL |
| Atendimento | PRD Atendimento; issue #18 | blocks/renders e QA de XSS | PARCIAL |
| Cotação | não há spec/rota/tabela autônoma | proposta/bloco são superfícies próximas | INDEFINIDO |
| Propostas | spec produção multi-peça; TASK-001–005, issue #12 | proposals/pieces/materials | IMPLEMENTADO/PARCIAL |
| Pedidos | PRD Pedidos; issue #48 | orders/status/custom details | IMPLEMENTADO/PARCIAL |
| OS | PRD/produção; sem contrato único de ligação | service orders e materiais | IMPLEMENTADO/PARCIAL |
| Produção | PRD Pedidos; issue #48 | production orders/steps | IMPLEMENTADO/PARCIAL |
| Estoque | PRD Estoque; issues #38, #52–56 | products/movements e WIP separado | IMPLEMENTADO/PARCIAL |
| Financeiro | PRD Financeiro; issue #39 | entries/payments/PDV | IMPLEMENTADO/PARCIAL |
| PDV | PRD PDV; issue #31 | PDV e order-financial | IMPLEMENTADO, NÃO HOMOLOGADO |
| Usuários/permissões | PRD Auth/RBAC; tasks legadas | users, JWT, RBAC e matriz | PARCIAL |
| Auditoria | regra transversal; sem spec única | `audit_logs` e middleware | PARCIAL |
| IA | PRD AI-001; issue #34 | assistant/copilot e migration 043 | PARCIAL; segurança de chave crítica |
| Automações | módulo n8n; issue #30 | automations/n8n e migrations 011/014 | PARCIAL |
| E-commerce | PRD histórico diverge; issue #32 | store/store settings/MP | IMPLEMENTADO/PARCIAL, DIVERGENTE DO PRD |
| Analytics | PRD analytics; issue #33 | analytics routes/consultas | IMPLEMENTADO/PARCIAL |
| Configurações/integrações | PRD ajustes; issue #37 e tabelas provider | settings/providers/carriers | IMPLEMENTADO/PARCIAL |
| Suporte | TASK-042/issue #42 para incidente | tickets/system errors | IMPLEMENTADO/PARCIAL |
| Base Técnica | pedido de handoff, TASK-062, issue #62 | API/UI allowlisted, sem banco | IMPLEMENTADO, NÃO HOMOLOGADO |

Esta tabela é o comparativo PRD → código; a ligação granular para endpoint,
tabela e teste fica em `TRACEABILITY-MATRIX.md` e
`MODULE-OPERATING-DOSSIERS.md`. Ausência de spec ou issue foi mantida como
ausência, não preenchida por inferência.

## Matriz de rastreabilidade inicial

| Feature | PRD/spec/task | Frontend | API/service | Tabela | Teste/evidência | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Login/refresh | PRD FR-001 | login + proxy web | `auth.routes.ts` | `users`, `refresh_tokens` | `auth.routes.test.ts` | PARCIAL |
| Painel cliente | módulos/produção | `ClientPanelShell` e abas | customers, attendance, OS, entrega | customers/leads/blocks/OS/deliveries | auditoria backend | PARCIAL |
| PDV venda | módulo PDV | página PDV | `pdv.routes.ts`, `order-financial.service.ts` | orders/payments/stock/financial | testes de serviço selecionados | PARCIAL |
| WhatsApp inbound | PRD + inbox | inbox | webhook + worker + inbox service | conversations/messages | teste WhatsApp + auditoria | PARCIAL |
| Base Técnica | solicitação de handoff | `/base-tecnica`, visível somente a ADMIN | `/api/v1/support/technical/*`, allowlist sem banco | N/A por decisão | teste 3/3 e matriz HTTP do ZIP; browser/produção pendentes | IMPLEMENTADO, NÃO HOMOLOGADO |

## Itens de rastreio incompletos

- Issues #15–#24 aparecem como Discovery/SDD em relatório de planejamento, mas
  não há task numerada correspondente para todos eles no baseline.
- `TASK-061` e migration `063` estão no WIP local, fora do baseline desta
  documentação.
- PostgreSQL real: **NÃO VALIDADO**.
- Nenhuma execução de rollback, backup/restore, webhook externo ou browser
  autenticado foi realizada nesta passada.
