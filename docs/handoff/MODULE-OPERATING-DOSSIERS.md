# Dossiês operacionais por módulo

## Como ler

Este é o mapa de responsabilidade por módulo do baseline `29c1639`, acrescido
apenas da Base Técnica entregue no handoff. O projeto Express não separa
controllers/repositories: as `*.routes.ts` concentram handlers/controladores e
acessam `query` ou services; nenhum diretório `repositories/` foi encontrado.
Os caminhos e métodos completos estão em `API-ROUTE-CATALOG.md`, e campos/FKs
em `BANCO-ENTIDADES-E-RELACIONAMENTOS.md`.

**Status** descreve código observável. Integração externa, browser e banco
operacional só são considerados homologados quando a evidência é declarada.

## Pré-venda e relação com cliente

| Módulo | Objetivo, entrada e UI | API/controlador e persistência | Estados, efeitos, dependências, acesso e risco |
| --- | --- | --- | --- |
| Dashboard | Mostrar resumo da operação em `/dashboard`. Entrada é navegação autenticada; saída são KPIs. | `dashboard.routes.ts`, `GET /api/v1/dashboard`; lê agregados de CRM, pedidos, produção e financeiro. | Não cria estado. Depende da integridade dos domínios; permissão e números não foram conferidos com dados reais. **IMPLEMENTADO, NÃO HOMOLOGADO.** |
| CRM/Leads | Captar, listar, editar, anotar, converter, ganhar/perder lead em `/leads` e `/leads/[id]`. | `leads.routes.ts`; `leads`, `lead_tasks`, `lead_attachments`, `lead_timeline`, pipeline/stage. | `NOVO` a ganho/perda/conversão, conforme rota. Escrita pode alterar etapa, timeline e cliente convertido. Depende de pipeline e upload; RBAC é específico da rota. **PARCIAL.** |
| Pipeline | Organizar leads por boards, stages, campos e regras em `/pipeline/[slug]`. | `pipeline.routes.ts`, `pipelines.routes.ts`; `pipelines`, `pipeline_stages`, campos e FKs em `leads`. | Reorder, toggle, publish e defaults alteram operação de lead. `pipeline-rules.routes.ts` existe mas não está montada no baseline. **IMPLEMENTADO/PARCIAL.** |
| Clientes | Cadastro e visão 360 em `/clientes` e `/clientes/[id]`. | `customers.routes.ts`; `customers`, tags, foto, histórico, feedback e relações. | Edição, GDPR erasure, anexos e conversão de lead são escritas. Dono de carteira/custom permission são regra de aplicação. Depende de ViaCEP para auxiliar UI. **IMPLEMENTADO/PARCIAL.** |
| Inbox | Ler, atribuir, responder, encerrar e fazer handoff em `/inbox`. | `inbox.routes.ts`, `inbox.service.ts`, worker; `conversations`, `messages`, respostas rápidas. | Conversa pode mudar atribuída/lida/encerrada; enviar mensagem depende de provider. SSE e Webhook exigem Redis/serviço externo. **PARCIAL.** |
| Agenda | Criar, consultar, atualizar status e notificar em `/agenda`. | `appointments.routes.ts`, worker `appointmentReminder`; `appointments` e Redis job. | AGENDADO, confirmado, atendimento, concluído, cancelado/não compareceu. `notify` pode disparar integração; Calendar externo não foi provado. **IMPLEMENTADO/PARCIAL.** |
| Atendimento | Registrar bloco técnico/comercial dentro da Ficha. | `attendance.routes.ts`; `attendance_blocks`, `ai_renders`; aliases sob `/customers` e `/blocks`. | Status do bloco, orçamento e dados técnicos podem mudar; `OS` no bloco não materializa automaticamente `service_orders`. ADMIN/ATENDENTE/GERENTE/PRODUCAO variam por ação. **PARCIAL.** |
| Cotação | Não há módulo autônomo confirmado. A superfície comercial próxima está em bloco/proposta. | Nenhum `quotes.routes.ts` ou tabela `quotes` no baseline. | Não declarar cotação como fluxo independente. Decisão de produto necessária antes de criar contrato. **INDEFINIDO.** |
| Propostas | Registrar proposta multi-peça e materiais na Ficha. | `proposals.routes.ts`; migrations 061: `proposals`, `proposal_pieces`, `proposal_piece_materials`. | draft/registered e pieces draft/ready. Não há conversão automática comprovada para pedido, reserva ou estoque. **IMPLEMENTADO/PARCIAL.** |

## Venda, execução e entrega

| Módulo | Objetivo, entrada e UI | API/controlador e persistência | Estados, efeitos, dependências, acesso e risco |
| --- | --- | --- | --- |
| Pedidos | Criar, consultar, pausar, cancelar, aprovar e notificar em `/pedidos`. | `orders.routes.ts`; `orders`, items, custom details, audit/financeiro correlato. | Pronta-entrega e personalizado têm estados distintos; aprovação de personalizado pode criar produção em transação. NF-e/recibo/WhatsApp são integrações parciais. **IMPLEMENTADO/PARCIAL.** |
| OS | Criar e executar ordem de serviço ligada a cliente, pedido ou bloco. | `service-orders.routes.ts`; `service_orders`, `service_order_materials`. | Etapa, mão de obra e materiais alteram custo/snapshot. Material não baixa estoque por si; PRODUCAO só pode ações específicas. **IMPLEMENTADO/PARCIAL.** |
| Produção | Atribuir, avançar, pausar e retomar ordem em `/producao`. | `production.routes.ts`; `production_orders`, `production_steps`. | PENDENTE, EM_ANDAMENTO, PAUSADA, CONCLUIDA, REPROVADA. Depende de pedido personalizado aprovado; escopo do usuário de produção é aplicado em rota. **IMPLEMENTADO/PARCIAL.** |
| Entregas | Criar, atualizar status, rastrear e cancelar entregas da Ficha. | `deliveries.routes.ts`, adapters; `deliveries`, `carriers_config`. | pending/posted/in_transit/out_for_delivery/delivered/failed conforme rota. Adapter pode falhar sem impedir registro local. **IMPLEMENTADO/PARCIAL.** |
| Estoque | CRUD de produto, movimentos, ajuste, import/export e foto em `/estoque`. | `products.routes.ts`; `products`, `stock_movements`, categorias. | Entrada/saída/ajuste e saldo anterior/novo são persistidos. Reserva, devolução e baixa de personalizado não estão provadas. Custo e concorrência exigem transação/RBAC. **IMPLEMENTADO/PARCIAL.** |
| Financeiro | Lançamentos, dashboard, comissões e comprovantes em `/financeiro`. | `financial.routes.ts`, `financeiro.service.ts`; `financial_entries`, `payments`, pedidos. | ENTRADA/SAÍDA e valor em centavos; lançamento pode vincular pedido/pagamento/comissão. Conciliação, estorno e banco real não homologados. ROOT/ADMIN/FINANCEIRO são referência. **IMPLEMENTADO/PARCIAL.** |
| PDV | Venda balcão, cliente rápido e link Mercado Pago em `/pdv`. | `pdv.routes.ts`, `order-financial.service.ts`; orders, payments, movimentos e financeiro. | Venda deveria ocorrer em transação com baixa/lançamento. ADMIN/ATENDENTE no source; estoque concorrente e callback MP requerem prova real. **IMPLEMENTADO EM CÓDIGO, NÃO HOMOLOGADO.** |

## Administração, automação e canais externos

| Módulo | Objetivo, entrada e UI | API/controlador e persistência | Estados, efeitos, dependências, acesso e risco |
| --- | --- | --- | --- |
| Usuários | Gerir sessão, convite, status, perfil e permissões em Ajustes. | `users.routes.ts`; `users`, refresh tokens e `custom_permissions`. | Ativo/inativo e role afetam sessão/RBAC. Administra identidade, portanto não confiar apenas em menu oculto. **IMPLEMENTADO/PARCIAL.** |
| Permissões | Aplicar role e overrides por ação/tela. | `auth.ts`, `rbac.ts`, `permissions.ts`; JWT e `users.custom_permissions`. | `ROOT` passa em `requireRole`; `userCan` na UI é apenas visibilidade. Exceção Base Técnica usa guard ADMIN exclusivo. **PARCIAL, risco de inconsistência.** |
| Auditoria | Registrar ações críticas e trilha de entidade. | `middleware/audit.ts` e chamadas explícitas; `audit_logs`. | Log por entidade/usuário/data, não cobertura universal. Leitura de Base Técnica não persiste audit específico, apenas request log. **PARCIAL.** |
| Configurações | Ajustar singleton, agenda, marca, logo, chaves e provedores. | `settings.routes.ts`, providers/integrations/store-settings; `settings` e tabelas de provider. | Pode alterar defaults de fluxo e integração. `GET /public` é contrato de exposição. ADMIN predominante, mas revisar rota. **IMPLEMENTADO/PARCIAL.** |
| WhatsApp | Receber Meta, administrar canal e enviar mensagens. | `whatsapp.routes.ts`, `whatsapp-admin`, Meta service/worker; conversas/mensagens. | HMAC, fila e até retries no código. Depende de secret, Graph API e worker; execução externa não validada. **PARCIAL.** |
| Automação/n8n | Espelhar workflows e receber webhooks de mensagem, lead e agenda. | `automations.routes.ts`, `n8n.routes.ts`, `n8n.service.ts`; `automation_flows/executions`. | Cria/atualiza CRM e agenda via endpoints. n8n não está no Compose e credenciais/workflows não foram entregues. **PARCIAL.** |
| IA/Copilot | Chat, config e skills na UI/Ajustes. | `assistant.routes.ts`, `ai-copilot.routes.ts`, serviços; configs/skills/logs. | Pode executar fluxo de assistente; provider/chave e RBAC real são pendências. PRD Activepieces/Python diverge do TypeScript/n8n atual. **PARCIAL.** |
| Integrações | Configurar Meta, Mercado Pago, transportadoras e provedores. | `integrations`, `integration-providers`, `carriers`, `mercadopago` routes. | Testes/config podem chamar serviço externo; tokens não entram no handoff. Falha de adapter é tratada localmente em entrega. **PARCIAL.** |

## Informação, loja e suporte

| Módulo | Objetivo, entrada e UI | API/controlador e persistência | Estados, efeitos, dependências, acesso e risco |
| --- | --- | --- | --- |
| E-commerce/Loja | Expor catálogo, produto e checkout em `/loja`; administrar em `/settings/loja`. | `store.routes.ts`, `store-settings.routes.ts`; `store_config/categories/products/orders`. | Produto publicado e pedido de loja podem criar preference de pagamento. Webhook/MP e sincronização CRM não homologados. **IMPLEMENTADO/PARCIAL, divergente de PRD histórico.** |
| Analytics | Consultar vendas, leads, produção, loja e agentes em `/analytics`. | `analytics.routes.ts`, `analytics.service.ts`; leituras agregadas dos domínios. | Não cria transação; qualidade depende da origem e filtros. Métricas não foram reconciliadas com dados reais. **IMPLEMENTADO/PARCIAL.** |
| Suporte | Tratar tickets, erros e exportações em `/chamados`. | `tickets.routes.ts`, `system-errors.routes.ts`; `system_tickets`, erros e export. | Exportações podem carregar dados pessoais. Ações administrativas precisam de RBAC efetivo. **PARCIAL.** |
| Base Técnica | Permitir suporte programador consultar documentação canônica em `/base-tecnica`. | `support-technical.routes.ts/service`; sem tabela, somente allowlist de `docs/handoff`. | `GET docs/docs:id/search`; ADMIN estrito, inclusive ROOT negado. 16 docs, teste unitário e HTTP isolado passaram; browser/produção pendentes. **IMPLEMENTADA, NÃO HOMOLOGADA.** |
| Roadmap | Registrar itens, comentários, anexos e aprovação. | `roadmap.routes.ts`; migration 052 e tabelas do domínio. | CRUD, comentários/reação/anexo e aprovação; é planejamento interno, não garantia de entrega comercial. **IMPLEMENTADO/PARCIAL.** |

## Caminhos de leitura por função

- Quem corrige um fluxo comercial: `FLUXO-OPERACIONAL-END-TO-END.md`, Ficha,
  estoque/financeiro/PDV e o catálogo de API.
- Quem altera schema: banco/ER, migration relacionada e todas as rotas citadas
  neste dossiê antes de escrever SQL.
- Quem opera incidente: RBAC/integrações, runbook, suporte e matriz de QA.
- Quem planeja feature: traceability matrix, PRD/spec/task e estado real acima;
  tela ou endpoint não é autorização para assumir fluxo de negócio completo.
