-- 049_leads_unique_per_pipeline.sql
--
-- Substitui o UNIQUE global em leads.whatsapp_number por um UNIQUE composto
-- (whatsapp_number, pipeline_id). Permite que o mesmo cliente apareça como
-- card em pipelines diferentes (handoff entre setores via pipeline_automation_rules),
-- mantendo a dedup dentro de cada pipeline.
--
-- Idempotente: pode ser re-aplicado sem erro (usa IF EXISTS / NOT EXISTS).

BEGIN;

ALTER TABLE leads
    DROP CONSTRAINT IF EXISTS leads_whatsapp_number_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leads_whatsapp_number_pipeline_key'
    ) THEN
        ALTER TABLE leads
            ADD CONSTRAINT leads_whatsapp_number_pipeline_key
            UNIQUE (whatsapp_number, pipeline_id);
    END IF;
END $$;

COMMIT;
