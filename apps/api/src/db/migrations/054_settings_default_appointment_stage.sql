-- 054_settings_default_appointment_stage.sql
--
-- Adiciona settings.default_appointment_stage_id. Quando configurado,
-- agendamentos novos que criam um lead vão direto pra essa etapa
-- específica do pipeline definido em default_appointment_pipeline_id.
-- Se ficar null, cai na primeira etapa do pipeline (comportamento atual).
--
-- ON DELETE SET NULL: se o usuário apagar a etapa, a config zera sozinha.

BEGIN;

ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS default_appointment_stage_id UUID
        REFERENCES pipeline_stages(id) ON DELETE SET NULL;

COMMIT;
