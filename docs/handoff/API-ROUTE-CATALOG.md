# Catálogo de rotas da API

## Escopo e leitura

Este catálogo foi extraído das chamadas `router.<método>()` em
`apps/api/src/routes/*.routes.ts` e dos mounts em `apps/api/src/index.ts`. O
baseline é `29c1639`; `support-technical` é o overlay controlado da entrega de
handoff. Caminhos abaixo de cada mount são relativos a ele. A existência de uma
rota não prova que o fluxo externo, o dado real ou todos os roles estejam
homologados.

`authenticate` não é global: confirmar o middleware da própria rota antes de
alterar ou consumir um endpoint. Os formatos de resposta também variam entre
`data`, objeto direto e download.

## Sessão, saúde e administração

| Fonte e mount | Operações extraídas | Persistência/efeito e controle observado |
| --- | --- | --- |
| `health`, `/health` | `GET /` | health de API, banco e Redis; não é endpoint de negócio. |
| `auth`, `/api/v1/auth` | `POST /login`; `POST /refresh` | emite/renova sessão e cookies; `users`/tokens. Login é público, refresh tem contrato próprio. |
| `users`, `/api/v1/users` | `GET /me`; `GET /`; `POST /invite`; `PATCH /:id`; `PATCH /:id/toggle-status`; `GET /pipelines-for-perms`; `DELETE /:id` | usuários, roles e permissões; administrativo. |
| `settings`, `/api/v1/settings` e `/api/v1/org` | `GET /public`; `GET /`; `GET /settings`; `GET /agenda`; `PATCH /agenda`; `PUT /`; `PUT /settings`; `POST /logo`; `PATCH /notifications`; `GET /whatsapp/status`; `GET /whatsapp/qrcode`; `POST /whatsapp/disconnect`; `GET/POST/DELETE /webhook-keys[/:id]` | singleton settings, agenda, logo e chaves; diferenciar leitura pública de administração. |
| `database-admin`, `/api/v1/admin/database` | `GET /tables`; `GET /tables/:name`; exports CSV/SQL; `POST /export`; `POST /import`; dependentes; `DELETE /tables/:name`; `POST /truncate`; `POST /truncate-all` | banco completo; superfície altamente sensível, nunca chamar por automação sem autorização explícita. |
| `system`, `/api/v1/system` | `GET /timeline`; `GET /activity` | leitura de atividade operacional. |
| `system-errors`, `/api/v1/system/errors` | `GET /`; `DELETE /`; `POST /export`; `POST /report` | erros enviados pelo cliente e exportação; pode conter dados sensíveis. |
| `notifications`, `/api/v1/notifications` | `GET/PATCH /preferences` | preferências de usuário. |
| `search`, `/api/internal/search` | `GET /` | rota interna, não publicada pelo Nginx como `/api/v1`. |

## CRM, cliente, pipeline e agenda

| Fonte e mount | Operações extraídas | Persistência/efeito e controle observado |
| --- | --- | --- |
| `leads`, `/api/v1/leads` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id/stage`, `PATCH /:id/quick-note`, `PATCH /:id/custom-fields`, `PATCH /:id/value`, tarefas CRUD em `/:id/tasks`, anexos CRUD em `/:id/attachments`, `GET /:id/timeline`, `POST /:id/won`, `POST /:id/lost`, `POST /:id/convert` | leads, estágio, tarefas, anexos e conversão; escrita altera histórico/pipeline conforme rota. |
| `pipeline`, `/api/v1/pipeline` | stages CRUD/reorder; custom-fields CRUD | configuração de pipeline legado e campos; confirmar consumidores antes de mudança. |
| `pipelines`, `/api/v1/pipelines` | pipeline CRUD/toggle/flow/publish; stages CRUD/reorder/defaults; `GET /:id/leads` | `pipelines`, `pipeline_stages`, leads e regras de fluxo. |
| `pipeline-rules`, **sem mount em `index.ts`** | `GET /`; `POST /`; `PATCH/DELETE /:ruleId`; `POST /:ruleId/test` | arquivo e serviço existem, mas a rota não é alcançável no baseline; tratar como código órfão/pendência, não endpoint público. |
| `customers`, `/api/v1/customers` | lista/detalhe/pedidos, `POST /`, `GET /:id/full`, `PATCH /:id`, apagamento GDPR, stats/history/feedback, foto, anexos de proposta | `customers` e relações de ficha; foto/anexos exigem validação de upload e escopo. |
| `attendance`, `/api/v1/customers` e `/api/v1/blocks` | blocos por cliente, `POST /:customerId/blocks`, aliases de patch/delete por id | `attendance_blocks`; ADMIN/ATENDENTE/GERENTE/PRODUCAO para leitura/escrita e ADMIN/GERENTE para delete no source. |
| `appointments`, `/api/v1/appointments` | `GET /`; `GET /:id`; `POST /`; `PATCH /:id/status`; `POST /:id/notify`; `PATCH /:id` | `appointments`, slot/status e reminder; job depende de Redis. |
| `dashboard`, `/api/v1/dashboard` | `GET /` | agregados de CRM/operação. |
| `renders`, `/api/v1/renders` e `/api/v1/blocks` | `POST /:block_id/render`; `GET /:id`; `PATCH /:id/approve`; `PATCH /:id/adjust` | renderizações ligadas a bloco; validar mount duplicado. |

## Pedido, produção, estoque, financeiro e entrega

| Fonte e mount | Operações extraídas | Persistência/efeito e controle observado |
| --- | --- | --- |
| `orders`, `/api/v1/orders` | lista/stats/export/detalhe; `POST /`; NF-e; recibo; status; pause/resume/cancel; preview/envio WhatsApp; stage | pedido, itens, notificações e possível produção; status é efeito de negócio crítico. |
| `proposals`, `/api/v1/proposals` | `POST /`; `GET /`; `GET /:id` | proposta e itens/arquivos correlatos; ponte automática para pedido não é provada. |
| `service-orders`, `/api/v1/service-orders` e `/api/v1/customers` | lista por cliente; `POST /`; patch/step; materiais CRUD; labor | `service_orders` e materiais; material não é prova de baixa de estoque. |
| `production`, `/api/v1/production-orders` | lista/detalhe; `POST /:id/advance`; `PATCH /:id/assign`; pause/resume | `production_orders` e steps; pedido personalizado aprovado pode criar ordem. |
| `products`, `/api/v1/products` | stats, check-code, export/import, CRUD, movimentos, ajuste, foto | produtos e `stock_movements`; custo/ajuste têm impacto financeiro e de permissão. |
| `product-categories`, `/api/v1/product-categories` | `GET /`; `POST /`; `PATCH /:id`; `DELETE /:id` | categorias de produto. |
| `financial`, `/api/v1/financial-entries` e `/api/v1/financeiro` | lista/dashboard/comissões/lancamentos; CRUD lançamento; comprovante; detalhe; `POST /` | `financial_entries`, pagamentos e comissões; valores em centavos. |
| `payments`, `/api/v1/payments` | `GET /`; `GET /:id`; `POST /`; `PATCH /:id/status` | pagamentos e transição de status; idempotência/integração devem ser preservadas. |
| `pdv`, `/api/v1/pdv` | `POST /sales`; `POST /mp-link`; `GET /custom-orders`; `POST /quick-customer` | venda, item, pagamento, movimento e financeiro em transação; requer banco real para homologação. |
| `deliveries`, `/api/v1/deliveries` e `/api/v1/customers` | lista por cliente; `POST /`; tracking; patch/status/delete | entrega e adaptador de transportadora opcional. |
| `carriers`, `/api/v1/carriers` | lista/active; CRUD; toggle; test | configuração e teste de adaptadores de transportadora. |
| `mercadopago`, `/api/v1` | `POST /payments/link`; `POST /webhooks/mercadopago` | preference/link e webhook externo; assinatura e confirmação não homologadas. |

## Inbox, WhatsApp, automação e IA

| Fonte e mount | Operações extraídas | Persistência/efeito e controle observado |
| --- | --- | --- |
| `inbox`, `/api/v1/inbox` | stream, channels, quick-replies CRUD, conversations lista/detalhe, mensagem, assign/handoff/close/resolve, note, read | conversas, mensagens, notas e atribuição; envio físico depende de provider. |
| `whatsapp`, `/api/v1/webhooks/whatsapp` | `GET /`; `POST /` | verificação/recepção Meta; assinatura e worker devem ser validados no ambiente. |
| `whatsapp-admin`, `/api/v1/whatsapp` | status, reconnect, disconnect | operação administrativa de canal. |
| `whatsapp-providers`, `/api/v1/whatsapp-providers` | lista, CRUD, toggle, set-primary | providers configurados. |
| `integration-providers`, `/api/v1/integration-providers` | lista, CRUD, toggle, set-primary, test | configuração de integrações genéricas. |
| `integrations`, `/api/v1/integrations` | `GET /`; patches Meta/n8n/Mercado Pago; teste n8n/MP | singleton de integrações e testes de conectividade. |
| `n8n`, `/api/v1/n8n` | webhooks new-message/order-status/bot-reply/update-lead/handoff; leitura conversation-status/lead-context/available-slots; create-appointment | borda n8n → CRM; pode escrever conversa, lead e agenda. |
| `automations`, `/api/v1/automations` | catalog, workflow lista/detalhe/CRUD/toggle/executions | catálogo/execução externa n8n; não há container n8n no Compose. |
| `flows`, `/api/v1/flows` | lista, active por módulo, detalhe, CRUD | configuração de fluxo; armazenar ação não significa executar reserva/baixa. |
| `assistant`, `/api/v1/assistant` | `POST /chat` | chat/ação de assistente, depender de configuração de IA. |
| `ai-copilot`, `/api/v1/ai-copilot` | config, skills CRUD, generate | configuração/skills de IA; revisar segredo e RBAC. |
| `operator`, `/api/v1/operator` | `POST /webhook`; `GET /health` | integração de operador, contrato/secret próprios. |

## Loja, analytics, suporte e documentação técnica

| Fonte e mount | Operações extraídas | Persistência/efeito e controle observado |
| --- | --- | --- |
| `store`, `/api/v1/store` | config, categories, products, product slug, checkout preference, Mercado Pago webhook | catálogo público e checkout; pagamento externo não homologado. |
| `store-settings`, `/api/v1/settings/store` | config, categorias CRUD/reorder, produtos CRUD/reorder, simulação de pedido aprovado, pedidos lista/detalhe | configuração administrativa da loja e espelho de catálogo. |
| `public`, `/api/v1/public` | `GET /catalog`; `POST /leads` | superfície pública de catálogo e captação. |
| `analytics`, `/api/v1/analytics` | sales, leads, production, store, agents | consultas agregadas; qualidade dos dados depende dos domínios. |
| `tickets`, `/api/v1/tickets` | lista, cria, exporta, atualiza status | `system_tickets` e comentários/exportação. |
| `roadmap`, `/api/v1/roadmap` | items CRUD/approve/comments/reactions/attachments; unread-count | itens de roadmap, comentários, anexos e notificação. |
| `support-technical`, `/api/v1/support/technical` | `GET /docs`; `GET /docs/:id`; `GET /search` | Markdown allowlisted, sem tabela; somente ADMIN, ROOT negado. |

## Consequências para manutenção

1. Antes de expor um endpoint novo no frontend, confirmar mount, middleware,
   schema Zod e formato de resposta da rota específica.
2. Alterações em pedido, PDV, pagamento, estoque, produção, entrega e agenda
   devem mapear também os efeitos listados em
   `FLUXO-OPERACIONAL-END-TO-END.md` e
   `ESTOQUE-FINANCEIRO-PDV-TECNICO.md`.
3. Webhooks, testes de provider, import/export e endpoints administrativos não
   devem ser disparados durante investigação; eles podem escrever dados ou
   exfiltrar dados operacionais.
