-- Migration 048: Pipeline Builder V2 — defaults, regras simples, links e execuções
-- PRD: PRD.DOCS/Build Pipeline/PRD-PIPELINE-BUILDER-V2.md
-- Não altera schema do pipeline atual; adiciona camada segura de configuração.

CREATE TABLE IF NOT EXISTS pipeline_stage_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    sla_value INTEGER CHECK (sla_value IS NULL OR sla_value > 0),
    sla_unit VARCHAR(20) CHECK (sla_unit IS NULL OR sla_unit IN ('minutes', 'hours', 'days')),
    default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    max_cards INTEGER CHECK (max_cards IS NULL OR max_cards > 0),
    checklist_default JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_fields_enter JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_fields_exit JSONB NOT NULL DEFAULT '[]'::jsonb,
    min_role_to_move VARCHAR(30),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pipeline_stage_settings_stage UNIQUE (stage_id)
);

CREATE INDEX IF NOT EXISTS idx_pss_org_pipeline
    ON pipeline_stage_settings (organization_id, pipeline_id);

CREATE TABLE IF NOT EXISTS pipeline_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    source_pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    trigger_event VARCHAR(40) NOT NULL,
    action_type VARCHAR(40) NOT NULL,
    target_pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    target_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    link_strategy VARCHAR(40) NOT NULL DEFAULT 'KEEP_LEAD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_par_trigger CHECK (trigger_event IN ('CARD_ENTERED_STAGE')),
    CONSTRAINT chk_par_action CHECK (action_type IN (
        'CREATE_LINKED_CARD',
        'MOVE_CARD_TO_PIPELINE',
        'MIRROR_CARD_TO_PIPELINE'
    )),
    CONSTRAINT chk_par_link CHECK (link_strategy IN (
        'KEEP_LEAD',
        'KEEP_CUSTOMER',
        'KEEP_ORDER',
        'KEEP_ALL',
        'TECHNICAL_LINK'
    )),
    CONSTRAINT chk_par_target_required CHECK (
        target_pipeline_id IS NOT NULL AND target_stage_id IS NOT NULL
    ),
    CONSTRAINT chk_par_target_distinct CHECK (
        source_pipeline_id <> target_pipeline_id
        OR source_stage_id <> target_stage_id
    )
);

CREATE INDEX IF NOT EXISTS idx_par_source_active
    ON pipeline_automation_rules (organization_id, source_pipeline_id, source_stage_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_par_target
    ON pipeline_automation_rules (organization_id, target_pipeline_id, target_stage_id);

CREATE TABLE IF NOT EXISTS pipeline_card_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES pipeline_automation_rules(id) ON DELETE CASCADE,
    source_lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    target_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    source_pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    target_pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    target_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    link_strategy VARCHAR(40) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pcl_link CHECK (link_strategy IN (
        'KEEP_LEAD',
        'KEEP_CUSTOMER',
        'KEEP_ORDER',
        'KEEP_ALL',
        'TECHNICAL_LINK'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcl_rule_source_target
    ON pipeline_card_links (rule_id, source_lead_id, target_pipeline_id, target_stage_id);

CREATE INDEX IF NOT EXISTS idx_pcl_target
    ON pipeline_card_links (organization_id, target_pipeline_id, target_stage_id);

-- Logs idempotentes de execução. idempotency_key garante não-duplicação em retry.
CREATE TABLE IF NOT EXISTS pipeline_rule_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES pipeline_automation_rules(id) ON DELETE CASCADE,
    trigger_event VARCHAR(40) NOT NULL,
    action_type VARCHAR(40) NOT NULL,
    source_pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    source_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    target_pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    target_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    target_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    payload JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CONSTRAINT chk_pre_trigger CHECK (trigger_event IN ('CARD_ENTERED_STAGE')),
    CONSTRAINT chk_pre_action CHECK (action_type IN (
        'CREATE_LINKED_CARD',
        'MOVE_CARD_TO_PIPELINE',
        'MIRROR_CARD_TO_PIPELINE'
    )),
    CONSTRAINT chk_pre_status CHECK (status IN ('pending', 'success', 'skipped', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_pre_rule_started
    ON pipeline_rule_executions (rule_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_status_started
    ON pipeline_rule_executions (organization_id, status, started_at DESC);
