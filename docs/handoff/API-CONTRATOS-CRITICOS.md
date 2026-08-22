# Contratos de API críticos

## Convenção

Prefixo padrão: `/api/v1`. Toda entrada passa por schema Zod quando indicado na
rota. Os formatos de resposta não são uniformes: leitura paginada costuma usar
`{ data, meta }`, enquanto criação/detalhe pode retornar objeto direto. Esta é
uma referência de negócio para manutenção, não substitui a rota-fonte antes de
alterar payloads.

## CRM, agenda e atendimento

| Método e path | Auth/role | Input principal | Saída/efeito | Fonte |
| --- | --- | --- | --- | --- |
| `GET /customers`, `GET /customers/:id`, `GET /customers/:id/full` | JWT; escopo varia por rota | filtros/ID | lista, detalhe ou agregado da ficha | `customers.routes.ts` |
| `POST /customers`, `PATCH /customers/:id` | JWT + guard da rota | dados cadastrais | persiste/atualiza customer e pode alimentar histórico | `customers.routes.ts` |
| `GET /customers/:id/blocks` | JWT, ADMIN/ATENDENTE/GERENTE/PRODUCAO | paginação/filtro | blocos ativos do atendimento | `attendance.routes.ts` |
| `POST /customers/:id/blocks` | JWT, ADMIN/ATENDENTE/GERENTE | título, tipo, conteúdo, status operacional, campos técnicos e valores em centavos | sanitiza HTML, grava `attendance_blocks`, audit; `OS` exige produto | `attendance.routes.ts` |
| `PATCH /blocks/:id` | JWT, ADMIN/ATENDENTE/GERENTE/PRODUCAO | campos mutáveis e `pipeline_status` | atualiza bloco; entrada em OS atribui número; em ENTREGA pode criar stub | `attendance.routes.ts` |
| `DELETE /blocks/:id` | JWT, ADMIN/GERENTE | ID | soft delete e audit | `attendance.routes.ts` |
| `GET /appointments` | JWT | intervalo, lead/customer, status, paginação | agenda filtrada | `appointments.routes.ts` |
| `POST /appointments` | JWT | tipo, início/fim ou duração, contato/lead/customer, responsável | valida intervalo, conflito, cria/vincula lead e agenda; pode criar timeline | `appointments.routes.ts` |
| `PATCH /appointments/:id/status`, `PATCH /appointments/:id` | JWT | status/campos da agenda | altera appointment; validar transição na rota | `appointments.routes.ts` |
| `POST /appointments/:id/notify` | JWT | ID | tenta notificação por n8n, não bloqueante | `appointments.routes.ts` |
| `GET/POST/PATCH /leads...` | JWT + roles específicos | cadastro, filtros, etapa, dados comerciais | persiste lead, pipeline/stage e timeline conforme operação | `leads.routes.ts` |
| `GET/PATCH/POST /pipeline...` e `/pipelines...` | JWT + administração por rota | slug, card, board/stage/regra | gestão do pipeline e boards | `pipeline.routes.ts`, `pipelines.routes.ts` |

## Pedidos, OS, produção, entrega e PDV

| Método e path | Auth/role | Input principal | Saída/efeito | Fonte |
| --- | --- | --- | --- | --- |
| `POST /orders` | JWT, ADMIN/ATENDENTE | cliente, tipo, itens, preços/discount em centavos, entrega; personalizado exige design/metal | transação cria order/itens/detalhe; inicia status por tipo; associa flow de Pedidos se existir; audit | `orders.routes.ts` |
| `PATCH /orders/:id/status` | JWT, ADMIN/ATENDENTE/FINANCEIRO + `order.approve` em aprovação | novo status | valida transição; pedido personalizado aprovado cria `production_orders` e marca aprovação | `orders.routes.ts` |
| `POST /orders/:id/nfe` | JWT, ADMIN/ATENDENTE | ID | cria solicitação fiscal pendente; exige customer e CPF/CNPJ | `orders.routes.ts` |
| `POST /orders/:id/send-receipt` | JWT, ADMIN/ATENDENTE | canal WhatsApp/e-mail | gera link WhatsApp ou resposta de e-mail; não prova entrega de e-mail | `orders.routes.ts` |
| `GET/POST/PATCH /service-orders...` | JWT, role por operação | cliente, produto, vínculo, etapas, materiais, mão de obra | persiste OS e materiais; atualiza custo/preço; audit | `service-orders.routes.ts` |
| `GET/POST/PATCH /production-orders...` | JWT, produção/gestão por rota | ordem, etapa, atribuição/pausa | persiste produção, avançar/pausar/retomar e audit | `production.routes.ts` |
| `POST /deliveries` | JWT + role da rota | cliente, pedido/OS, tipo, endereço/transportadora | cria entrega; tenta despacho externo sem impedir registro se falhar | `deliveries.routes.ts` |
| `GET /deliveries/:id/tracking` | JWT | ID | consulta adapter quando configurado, atualiza eventos/status | `deliveries.routes.ts` |
| `PATCH /deliveries/:id/status`, `DELETE /deliveries/:id` | JWT | status/ID | marca entrega ou cancela apenas em estados iniciais | `deliveries.routes.ts` |
| `POST /pdv/sales` | JWT, ADMIN/ATENDENTE | cliente opcional, itens, pagamento manual, desconto | `finalizePdvSale` em transação: pedido, pagamento, estoque, financeiro e audit | `pdv.routes.ts`, `order-financial.service.ts` |
| `POST /pdv/mp-link` | JWT, ADMIN/ATENDENTE | itens/cliente/desconto | finaliza venda local e cria preference Mercado Pago; devolve URL | `pdv.routes.ts` |

## Financeiro e integrações

| Método e path | Auth/role | Input principal | Saída/efeito | Fonte |
| --- | --- | --- | --- | --- |
| `GET /financeiro` e `GET /financial-entries` | JWT, ROOT/ADMIN/FINANCEIRO | tipo, categoria, data, paginação | lançamentos, metadados e resumo em centavos | `financial.routes.ts` |
| `GET /financeiro/dashboard`, `/comissoes`, `/lancamentos` | JWT, ROOT/ADMIN/FINANCEIRO | período/filtros | agregados, comissões ou lista canônica | `financial.routes.ts` |
| `POST/PUT/DELETE /financeiro/lancamentos...` | JWT, ROOT/ADMIN/FINANCEIRO | tipo, valor em centavos, categoria, descrição, data | grava, edita ou remove lançamento e audit quando aplicável | `financial.routes.ts` |
| `GET/PATCH /integrations/{meta,n8n,mercadopago}` | JWT, ADMIN | credenciais/URLs | salva snapshot de integração com resposta mascarada | `integrations.routes.ts` |
| `POST /integrations/n8n/test`, `/integrations/mp/test` | JWT, ADMIN | configuração persistida | health call externo e atualiza status | `integrations.routes.ts` |
| `POST /webhooks/whatsapp` | assinatura/contrato Meta | payload provider | enfileira/processa entrada conforme worker | `whatsapp.routes.ts` e worker |

## IA, automação e webhooks internos

| Método e path | Auth/role | Input principal | Saída/efeito | Fonte |
| --- | --- | --- | --- | --- |
| `POST /assistant/chat` | JWT, rate limit 20/min | mensagem ou até 20 mensagens | resposta, tools usadas e uso estimado; log assíncrono | `assistant.routes.ts` |
| `GET/PUT /ai-copilot/config` | JWT, ROOT/ADMIN | estado, provider, URL, modelo, prompt, chave | lê mascarado/atualiza configuração global | `ai-copilot.routes.ts` |
| `GET/POST/PUT/DELETE /ai-copilot/skills...` | JWT, ROOT/ADMIN | skill/prompt/ordem | CRUD de skills; global não exclui | `ai-copilot.routes.ts` |
| `POST /ai-copilot/skills/generate` | JWT, ROOT/ADMIN | descrição | consulta LLM e retorna sugestão JSON, sem persistir | `ai-copilot.routes.ts` |
| `GET/POST/PUT/PATCH/DELETE /automations...` | JWT, ADMIN | workflow n8n JSON, toggle/ID | CRUD remoto n8n e espelho `automation_flows` | `automations.routes.ts` |
| `GET /automations/:workflowId/executions` | JWT, ADMIN | limite 1–100 | proxy de execuções n8n | `automations.routes.ts` |
| `POST /n8n/webhook/new-message`, `/order-status`, `/bot-reply`, `/update-lead`, `/handoff`, `/create-appointment` | Bearer de sistema | payload específico do webhook | Inbox, pedido, lead, handoff ou agenda; maioria responde 202/201 | `n8n.routes.ts` |
| `GET /n8n/webhook/lead-context`, `/conversation-status`, `/available-slots` | Bearer de sistema | telefone/data/período | contexto de CRM, conversa ou slots locais | `n8n.routes.ts` |

## Erros e manutenção

- Erros de entrada Zod retornam `AppError.badRequest`; autenticação e role usam
  middleware antes do handler. Não assumir códigos exatos sem ler a rota.
- Escritas críticas mapeadas acima criam audit log em várias rotas, mas cobertura
  integral não foi demonstrada.
- Rotas de n8n têm autenticação diferente de JWT; nunca reutilizar token de
  usuário como chave de integração.
- Não iniciar chamadas mutantes em produção para “testar” documentação.
