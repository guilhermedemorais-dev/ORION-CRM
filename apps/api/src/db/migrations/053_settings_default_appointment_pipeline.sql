-- 053_settings_default_appointment_pipeline.sql
--
-- Adiciona coluna em settings para configurar o pipeline padrão dos
-- agendamentos. Nullable: se não configurado, agendamento ainda é criado
-- (apenas sem vínculo de pipeline).
--
-- Idempotente (IF NOT EXISTS).

BEGIN;

ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS default_appointment_pipeline_id UUID
        REFERENCES pipelines(id) ON DELETE SET NULL;

COMMIT;
