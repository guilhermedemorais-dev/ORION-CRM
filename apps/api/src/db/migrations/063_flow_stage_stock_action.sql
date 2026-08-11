-- Migration 063: Ação de estoque por etapa + consolidação da config em flow_stage_rules
--
-- TASK-054 (issue #57). Spec: docs/specs/estoque/baixa-estoque-manufatura/module-spec.md §3.1
--
-- Consolida a configuração por etapa na tabela viva flow_stage_rules e remove a
-- tabela morta pipeline_stage_settings (0 registros em produção, confirmado via
-- dump + painel em 06/08/2026). Aditivo antes de destrutivo; o runner
-- (migrate.ts) envolve o arquivo inteiro em uma transação.
--
-- Rollback: o runner é forward-only. Reverter = migração compensatória que
-- recria pipeline_stage_settings (schema da migration 048), remove as colunas
-- adicionadas abaixo e o enum flow_stock_action.

-- 1. Enum da ação de estoque por etapa. A EXECUÇÃO da ação na transição é
--    fatia posterior do EPIC — esta migração só cria a config.
CREATE TYPE flow_stock_action AS ENUM (
  'none',           -- sem ação
  'reservar',       -- etapa de caixa (venda personalizada): reserva o insumo
  'baixar_insumo',  -- etapa de produção/OS (backflush do insumo reservado)
  'baixar_peca',    -- etapa de caixa (peça pronta, no pagamento): baixa a peça
  'retornar'        -- cancelamento/sobra: devolve ao estoque
);

-- 2. Colunas aditivas em flow_stage_rules.
--    min_role_to_move é validado contra o enum UserRole na API (não string livre).
--    Os demais campos herdam o conceito do fantasma pipeline_stage_settings como
--    schema-ready (sem UI nesta fatia).
ALTER TABLE flow_stage_rules
  ADD COLUMN IF NOT EXISTS stock_action flow_stock_action NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS min_role_to_move VARCHAR(30),
  ADD COLUMN IF NOT EXISTS sla_value INTEGER CHECK (sla_value IS NULL OR sla_value > 0),
  ADD COLUMN IF NOT EXISTS sla_unit VARCHAR(20) CHECK (sla_unit IS NULL OR sla_unit IN ('minutes', 'hours', 'days')),
  ADD COLUMN IF NOT EXISTS default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_cards INTEGER CHECK (max_cards IS NULL OR max_cards > 0),
  ADD COLUMN IF NOT EXISTS checklist_default JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_fields_enter JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_fields_exit JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Guard de vazio: nunca dropar cega. Se no dia do deploy houver linhas,
--    a migração aborta (transação do runner faz rollback de tudo) e o dado
--    precisa ser migrado manualmente antes do DROP.
--
--    O LOCK vem ANTES do count: um count() sozinho pega só ACCESS SHARE, que não
--    bloqueia INSERT. Em deploy rolling, uma instância antiga da API ainda
--    servindo PATCH /stages/:stageId/defaults poderia inserir uma linha entre o
--    count e o DROP, e essa linha seria apagada em silêncio apesar do guard.
--    ACCESS EXCLUSIVE segura até o fim da transação, então count e DROP viram
--    atômicos em relação a qualquer escrita concorrente.
DO $$
BEGIN
  IF to_regclass('pipeline_stage_settings') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE pipeline_stage_settings IN ACCESS EXCLUSIVE MODE';
    IF (SELECT count(*) FROM pipeline_stage_settings) > 0 THEN
      RAISE EXCEPTION 'pipeline_stage_settings NAO esta vazia — migrar os dados antes de dropar';
    END IF;
  END IF;
END $$;

-- 4. Remove a tabela morta (nenhuma FK aponta pra ela; endpoints removidos na API).
DROP TABLE IF EXISTS pipeline_stage_settings;
