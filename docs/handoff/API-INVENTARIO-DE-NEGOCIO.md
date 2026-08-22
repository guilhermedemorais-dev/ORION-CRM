# Inventário de API de negócio

**Baseline:** `29c1639`. Mounts canônicos: `apps/api/src/index.ts`. Este
inventário prioriza operações de negócio; detalhes de schema e erros devem ser
confirmados na route source antes de mudança.

## Domínios e rotas prioritárias

| Domínio | Mount | Operações relevantes | Auth/RBAC observado |
| --- | --- | --- | --- |
| Auth | `/api/v1/auth` | `POST /login`, `POST /refresh` | login público; refresh por cookie |
| Leads/Pipeline | `/api/v1/leads`, `/pipeline`, `/pipelines` | lista/cria/edita lead, etapa, ganho/perda, boards/stages/rules | rota-fonte define roles; etapa é efeito operacional |
| Clientes | `/api/v1/customers` | lista, detalhe, full, editar, pedidos, stats, histórico, feedback, foto, anexos | JWT + roles/helpers por operação |
| Agenda | `/api/v1/appointments` | listar, detalhe, criar, editar, status, notificar | JWT; efeitos incluem reminder job |
| Atendimento | `/api/v1/customers`, `/api/v1/blocks` | blocos por cliente, criar/editar/apagar | JWT + `requireRole`; HTML é risco documentado |
| Proposta | `/api/v1/proposals` e clientes | proposta/anexos | mapear junto da Ficha |
| Pedidos | `/api/v1/orders` | lista, stats, export, criar, NF-e, recibo, status, pause/resume/cancel, etapa | RBAC varia por ação; NF-e/recibo são parciais |
| OS | `/api/v1/service-orders` | criar/editar, etapa, materiais, mão de obra | ADMIN/GERENTE/ATENDENTE/PRODUCAO conforme ação |
| Produção | `/api/v1/production-orders` | lista, detalhe, criar, atribuir, pausar/retomar | produção e gestão por rota |
| Estoque | `/api/v1/products` | CRUD, import/export, movimentos, ajuste, foto | custo sensível exige revisão de permissão |
| Financeiro | `/api/v1/financeiro`, `/financial-entries`, `/payments` | lançamentos, dashboard, comissões, despesas, comprovantes, pagamentos | ROOT/ADMIN/FINANCEIRO em superfície principal |
| PDV | `/api/v1/pdv` | venda, link MP, pedidos personalizados, cliente rápido | ADMIN/ATENDENTE |
| Entregas | `/api/v1/deliveries`, clientes | criar, tracking, editar/status/cancelar | integração de transportadora opcional |
| Inbox/WhatsApp | `/api/v1/inbox`, `/webhooks/whatsapp`, `/whatsapp` | conversa, mensagem, notas, webhooks e provider | assinatura Meta/webhook e RBAC inbox |
| n8n/automações | `/api/v1/n8n`, `/automations`, `/flows` | bot, workflows, execuções e catálogo | API key n8n ou RBAC, conforme route |
| Configuração | `/api/v1/settings`, `/users`, `/integrations` | usuários, roles, permissões, logo, agenda, providers | majoritariamente administrativo |
| Suporte | `/api/v1/tickets`, `/system`, `/system/errors` | incidentes, export, timeline, erros | export e ações críticas restringidas |

## Contratos que exigem cuidado

- Respostas de rotas usam formatos mistos (`{ data, meta }`, objeto direto e
  download), portanto consumidores novos não devem deduzir envelope global.
- `/api/internal/*` é proxy Next.js, não mount público direto da API. Nginx o
  encaminha ao `web`; o proxy é parte do contrato frontend/backend.
- API aplica `authenticate` por rota, não por prefixo global. Ao adicionar rota,
  ausência de middleware é risco de segurança.
- Escritas críticas devem manter `createAuditLog`; existência de audit não prova
  cobertura integral de toda ação de escrita.

## Efeitos transversais por entrada

| Entrada | Escrita/efeito | Dependência |
| --- | --- | --- |
| venda PDV | pedido, itens, pagamento, movimento, financeiro, audit | transação PostgreSQL; produto disponível |
| webhook Meta | job Redis, conversa/mensagem, logs | assinatura HMAC e worker BullMQ |
| criação de agenda | `appointments`, agendamento de reminder | Redis/n8n quando notificação é usada |
| OS/material | OS, materiais, valores | não baixa estoque real nesta rota |
| entrega transportadora | entrega e tentativa de API externa | adapter/credenciais; falha externa não impede registro |

## Fonte de detalhe

Para método, payload, status HTTP e erros, consulte `apps/api/src/routes/*.ts`
e os schemas Zod junto à própria rota. Esta regra evita que o handoff trate este
índice como substituto da implementação.
