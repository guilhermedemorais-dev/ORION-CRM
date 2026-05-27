-- Migration 058: Sistema de Fluxos + Status de pagamento do pedido
--
-- Conceito:
--   FLUXO = pipeline + regras por etapa
--   payment_status do PEDIDO = derivado das linhas em payments (não confundir com
--   o enum payment_status existente que pertence à tabela payments)
--
-- Compatibilidade: novos campos NULLABLE; pedidos antigos seguem usando o fallback
-- hardcoded (STAGE_ORDER no frontend) até serem associados a um fluxo.

-- 1. Enum de status de pagamento do PEDIDO (agregado das linhas em payments)
CREATE TYPE order_payment_status AS ENUM (
  'nao_pago',
  'parcial',
  'pago',
  'estornado',
  'isento'
);

-- 2. Enum de "conta como" pra etapas que importam aos KPIs
CREATE TYPE flow_stage_role AS ENUM (
  'none',
  'in_production',
  'finalized',
  'cancelled'
);

-- 3. Enum das regras de pagamento por etapa
CREATE TYPE flow_payment_rule AS ENUM (
  'none',                  -- sem regra
  'not_overdue',           -- qualquer status menos estornado
  'requires_partial',      -- exige parcial ou pago
  'requires_paid_in_full', -- exige pago
  'requires_refunded'      -- exige estornado (etapa de cancelado com reembolso)
);

-- 4. Tabela de fluxos
CREATE TABLE flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  -- Qual módulo do sistema usa este fluxo. Apenas 1 fluxo ativo por módulo.
  active_module VARCHAR(32),    -- 'pedidos' | 'producao' | null
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flows_pipeline ON flows (pipeline_id);
-- Apenas 1 fluxo ativo por módulo (UNIQUE parcial)
CREATE UNIQUE INDEX idx_flows_active_module ON flows (active_module)
  WHERE active_module IS NOT NULL;

-- 5. Regras por etapa do fluxo (1 regra por (flow_id, stage_id))
-- Apenas um config por etapa: "conta como" + "regra de pagamento"
CREATE TABLE flow_stage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  stage_role flow_stage_role NOT NULL DEFAULT 'none',
  payment_rule flow_payment_rule NOT NULL DEFAULT 'none',
  -- Notificar cliente via WhatsApp automaticamente ao entrar nesta etapa?
  notify_on_enter BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flow_id, stage_id)
);

CREATE INDEX idx_flow_stage_rules_flow ON flow_stage_rules (flow_id);
CREATE INDEX idx_flow_stage_rules_stage ON flow_stage_rules (stage_id);

-- 6. Adicionar campos no pedido
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status order_payment_status NOT NULL DEFAULT 'nao_pago',
  ADD COLUMN IF NOT EXISTS flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_flow ON orders (flow_id) WHERE flow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_current_stage ON orders (current_stage_id) WHERE current_stage_id IS NOT NULL;

-- 7. Backfill: calcula payment_status inicial dos pedidos existentes
-- Soma os pagamentos APPROVED de cada pedido e compara com final_amount_cents
UPDATE orders o
SET payment_status = CASE
  WHEN o.final_amount_cents = 0 THEN 'isento'::order_payment_status
  WHEN paid.total IS NULL OR paid.total = 0 THEN 'nao_pago'::order_payment_status
  WHEN refunded.total IS NOT NULL AND refunded.total >= o.final_amount_cents THEN 'estornado'::order_payment_status
  WHEN paid.total >= o.final_amount_cents THEN 'pago'::order_payment_status
  ELSE 'parcial'::order_payment_status
END
FROM (
  SELECT order_id, SUM(amount_cents) AS total
  FROM payments
  WHERE status = 'APPROVED'
  GROUP BY order_id
) paid
FULL OUTER JOIN (
  SELECT order_id, SUM(amount_cents) AS total
  FROM payments
  WHERE status = 'REFUNDED'
  GROUP BY order_id
) refunded ON refunded.order_id = paid.order_id
WHERE o.id = COALESCE(paid.order_id, refunded.order_id);
