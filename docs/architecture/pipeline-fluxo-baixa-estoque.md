# Arquitetura — Pipeline como setores + baixa de estoque Make-to-Order

Análise de arquitetura que fundamenta as specs em
`docs/specs/estoque/baixa-estoque-manufatura/`. Verificado no branch
`feat/board-escluir-renomear` + dump/painel de produção (06/08/2026).

## Princípio
Cada pipeline é um **setor configurável** (o cliente cria o processo dele). O
comportamento por etapa é **config**, não código hardcoded. Os setores se
comunicam por regras de handoff. Ver memória `project-pipeline-architecture`.

## O que já existe (verificado)
- `pipelines` (mig 017) = setores; `pipeline_stages` (mig 016/017) = etapas (têm `pipeline_id`).
- `flow_stage_rules` (mig 058) = regra por etapa **VIVA**: `payment_rule`, `stage_role`, `notify_on_enter`. Ligada a `flows.active_module` ('pedidos'|'producao'). Pedido consome `flow_id`/`current_stage_id`. Avaliada por `flow-rules.service.ts::checkFlowRules`, chamada em `orders.routes.ts:1425` na transição de etapa.
- `pipeline_automation_rules` (mig 048) = **handoff entre setores**: `CARD_ENTERED_STAGE` → `MOVE/MIRROR/CREATE_LINKED_CARD` + `link_strategy`. 18 arquivos.
- `pipeline_stage_settings` (mig 048) = **MORTA**: 0 registros em produção (dump + painel admin), 2 endpoints em `pipelines.routes.ts` (GET/PATCH `/:id/stages/:stageId/defaults`), sem frontend, nenhuma FK aponta pra ela.
- Estoque: `stock_movements` (enum já tem `PRODUCAO_CONSUMO`/`PERDA`/`DEVOLUCAO`); `service_order_materials` (mig 051) liga insumo à `service_orders`→`orders`. Produção: `production_orders.current_step` (mig 007).
- Pagamento sinal/integral = `order_payment_status` parcial/pago (mig 058).

## Decisão de arquitetura (batida)
1. **Tabela canônica de regra por etapa = `flow_stage_rules`.** Adicionar `stock_action` (enum) + `min_role_to_move`. Aditivo.
2. **Matar `pipeline_stage_settings`** (dropar com guard de vazio) + remover os 2 endpoints mortos. Migrar só o conceito `min_role_to_move`.
3. **Não criar setores hardcoded.** Caixa/separação/fabricação = etapas que o cliente cria, com `stock_action`/`min_role_to_move`/`payment_rule` configurados. O motor executa ao entrar na etapa.
4. Handoff entre setores permanece em `pipeline_automation_rules`.

## Gap real
Só falta **um** mecanismo: `stock_action` por etapa (reservar/baixar_insumo/baixar_peca/retornar) + o motor executando na transição. O resto (papel, pagamento, handoff, notificação) já existe.

## Regra permanente
Nenhuma migração destrutiva decidida por dado LOCAL — sempre confirmar contra
produção (dump/painel/read-only) antes. `pipeline_stage_settings` foi confirmada
vazia em produção antes de decidir o DROP.
