# Module Spec — Baixa de estoque Make-to-Order (fluxo Caixa → Separação → Fabricação)

- Área: Estoque / Pedidos / Pipeline
- Arquitetura de referência: `docs/architecture/pipeline-fluxo-baixa-estoque.md`
- Regra de negócio: memória `project-regra-aprovacao-baixa-estoque` (v3)
- Status: Discovery/SDD → habilita TASK-054 (primeira fatia)

## 1. Objetivo
Controlar a baixa de estoque no padrão Make-to-Order: a venda deixa de baixar na
finalização do atendente; a baixa passa a ser dirigida por **configuração de
etapa** (reserva → backflush) e por **papel** (caixa = gerente/admin). Tudo sobre
o motor de regras já existente (`flow_stage_rules`), sem setores hardcoded.

## 2. Regra de negócio (fluxo alvo)
> **Estado alvo do EPIC, não o comportamento atual.** A TASK-054 entrega apenas a
> persistência da configuração (`stock_action` + `min_role_to_move`). Nada abaixo é
> aplicado ainda: `flow-rules.service.ts::checkFlowRules` avalia somente
> `payment_rule`, e `PATCH /orders/:id/stage` continua aceitando ATENDENTE.
> Não trate reserva, backflush ou gate de papel como controle ativo até as fatias
> de execução (§12, itens 2 a 5) entrarem.

- **Atendente** abre o pedido (ficha, cotação, proposta) e **não finaliza**. O pedido entra na etapa de **CAIXA** (via handoff `pipeline_automation_rules`).
- **Caixa (GERENTE/ADMIN)**: confere; em personalizada, **edita insumos**; **recebe pagamento** (sinal=`parcial` / integral=`pago`); finaliza. → insumos **RESERVADOS**.
- **Separação**: separa os insumos, confirma.
- **Ourives**: aciona **"fabricação"** → **backflush** (baixa efetiva dos insumos).
- **Pronta**: baixa no pagamento do caixa (sem reserva/backflush).
- **Cancelamento pós-produção**: joia vira **produto acabado** (novo SKU); matéria-prima não retorna.

## 3. Banco
- `flow_stage_rules` (+): `stock_action flow_stock_action` (enum `none|reservar|baixar_insumo|baixar_peca|retornar`, default `none`); `min_role_to_move VARCHAR(30)`; campos herdados do fantasma como schema-ready (sla_value/unit, default_assignee_id, max_cards, checklist_default, required_fields_enter/exit).
- DROP `pipeline_stage_settings` com guard de vazio (0 em produção, confirmado).

### 3.1 Contrato da migração (fatia 1 — TASK-054; confirmar nº livre, provável 063)
```sql
BEGIN;
CREATE TYPE flow_stock_action AS ENUM ('none','reservar','baixar_insumo','baixar_peca','retornar');
ALTER TABLE flow_stage_rules
  ADD COLUMN IF NOT EXISTS stock_action flow_stock_action NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS min_role_to_move VARCHAR(30),
  ADD COLUMN IF NOT EXISTS sla_value INTEGER CHECK (sla_value IS NULL OR sla_value > 0),
  ADD COLUMN IF NOT EXISTS sla_unit VARCHAR(20) CHECK (sla_unit IS NULL OR sla_unit IN ('minutes','hours','days')),
  ADD COLUMN IF NOT EXISTS default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_cards INTEGER CHECK (max_cards IS NULL OR max_cards > 0),
  ADD COLUMN IF NOT EXISTS checklist_default JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_fields_enter JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_fields_exit JSONB NOT NULL DEFAULT '[]'::jsonb;
-- O LOCK vem ANTES do count: count() sozinho pega só ACCESS SHARE, que não
-- bloqueia INSERT. Em deploy rolling, uma instância antiga da API poderia inserir
-- entre o count e o DROP e a linha morreria em silêncio, apesar do guard.
DO $$
BEGIN
  IF to_regclass('pipeline_stage_settings') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE pipeline_stage_settings IN ACCESS EXCLUSIVE MODE';
    IF (SELECT count(*) FROM pipeline_stage_settings) > 0 THEN
      RAISE EXCEPTION 'pipeline_stage_settings NAO esta vazia — migrar antes de dropar';
    END IF;
  END IF;
END $$;
DROP TABLE IF EXISTS pipeline_stage_settings;
COMMIT;
```
Obs: o `BEGIN`/`COMMIT` acima é ilustrativo — o runner (`migrate.ts`) já envolve
cada arquivo numa transação, então a migração real não os repete.

Rollback: o runner é **forward-only**, não existe "down". Reverter = migração
compensatória que recria `pipeline_stage_settings` (schema da mig 048) e remove
as colunas novas + o enum.

### 3.2 Matriz de interação UI (FluxoTab.tsx)

| Elemento | Quem vê | Chama | Sucesso | Erro |
|---|---|---|---|---|
| Dropdown "Ação de estoque" (por etapa) | **hoje: só ROOT** (ver nota) | POST/PATCH `/api/internal/flows` | grava `stock_action` | toast + retry |
| Dropdown "Quem pode mover" (por etapa) | idem | idem | grava `min_role_to_move` | idem |

> **Nota de RBAC (pendente após a TASK-054).** O backend já exige
> `pipeline.configure` (ADMIN/GERENTE; ROOT bypassa), mas a UI ainda não alcança
> esse público: a aba "Fluxo" é `rootOnly: true` no `AjustesClient.tsx` e a rota
> `/ajustes` redireciona quem não é ADMIN/ROOT. Alinhar a UI ao
> `pipeline.configure` é fatia própria — `AjustesClient.tsx` ficou fora dos
> `locked_paths` da TASK-054. Até lá, "quem vê" na prática é só ROOT.
>
> Ambos os dropdowns devem ser rotulados como **não aplicados** enquanto a
> execução não entrar, para não sugerir uma trava de permissão inexistente.
- Reserva de insumo por pedido: **HIPÓTESE** — nova tabela `stock_reservations (order_id, product_id, quantity, status)` (detalhar na fatia de execução, não na primeira).
- Movimentos: reutilizar `stock_movements` (`PRODUCAO_CONSUMO` no backflush, `DEVOLUCAO` no retorno de sobra).

## 4. API/Backend
- `flows.routes.ts`: schema/INSERT/UPDATE/SELECT de `flow_stage_rules` passam a incluir `stock_action` + `min_role_to_move`; guard "pula regra se tudo none" considera os campos novos.
- `pipelines.routes.ts`: remover GET/PATCH `/:id/stages/:stageId/defaults` + tipos/mapeadores mortos.
- `flow-rules.service.ts`: tipos de `stock_action` (execução da ação é fatia posterior, ver §9).
- Ponto de execução (fatia posterior): `orders.routes.ts:1425` (`checkFlowRules` na transição).

## 5. Frontend/UI
- `FluxoTab.tsx`: por etapa, dropdown "Ação de estoque" (`stock_action`) e "Quem pode mover" (`min_role_to_move`), além dos campos atuais. Estados loading/erro/sucesso.

## 6. Testes
- Migração **aplica** (não há "reverte": runner forward-only; rollback = migração
  compensatória documentada em §3.1).
- Guard: DROP só com tabela vazia. Com 1 linha, a migração aborta e **preserva o
  schema** (testado com linha → exceção + rollback).
- Config persiste/retorna `stock_action`+`min_role_to_move`; regras antigas intactas.
- Endpoints mortos → 404. `tsc --noEmit` limpo.

## 7. Segurança
- Config atrás de `requirePermission('pipeline.configure')`.
- `min_role_to_move` validado contra enum `UserRole` (não string livre).
- DROP de tabela e mudança de estoque/pagamento → **`security-standard` obrigatório** nas fatias de execução.

## 8. Observabilidade
- Audit log em toda escrita de regra (já existe padrão). Backflush/reserva geram `stock_movements` rastreáveis por `order_id`+`created_by` (fatia de execução).

## 9. Decisões pendentes / Fatias posteriores
- Modelo de `stock_reservations` (tabela vs estado) — decidir na fatia de execução.
- Margem de perda de ouro (% por categoria) — fatia própria.
- `HIPÓTESE:` etapa "caixa" identificada por `receives_payment` (novo campo) ou por `payment_rule`+`min_role_to_move` — validar na fatia do caixa.

## 10. Riscos
- Número da migração pode divergir entre branches — executor confirma o próximo livre.
- Mudar o motor do pedido nas fatias de execução é sensível (dinheiro/estoque) → sequencial, com security gate.

## 11. Critérios de aceite (nível módulo)
- Config por etapa unificada em `flow_stage_rules` com `stock_action`+`min_role_to_move`; fantasma removido; sem regressão. As fatias de execução entregam reserva/backflush/caixa em sequência.

## 12. Quebra em tasks (ordem)
1. **TASK-054** — Consolidar config + `stock_action`/`min_role_to_move` + matar `pipeline_stage_settings` + painel. (SÓ config; sem executar ação.)
2. TASK-05x — Executar `stock_action` na transição (`checkFlowRules`): reserva/baixa.
3. TASK-05x — Etapa caixa: finalização + pagamento; atendente não move.
4. TASK-05x — Backflush do ourives ("fabricação").
5. TASK-05x — Pronta + cancelamento→produto acabado + margem de perda + retorno de sobra.
