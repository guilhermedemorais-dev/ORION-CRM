-- 055_settings_default_appointment_duration.sql
--
-- Adiciona settings.default_appointment_duration_minutes. Define a duração
-- padrão (em minutos) de novos agendamentos quando o usuário não informar
-- a hora final manualmente. Default: 60 min.
--
-- Range válido (CHECK): 5 .. 480 minutos (5 min a 8h).
-- Idempotente (IF NOT EXISTS).

BEGIN;

ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS default_appointment_duration_minutes INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'settings_default_appointment_duration_range'
    ) THEN
        ALTER TABLE settings
            ADD CONSTRAINT settings_default_appointment_duration_range
            CHECK (default_appointment_duration_minutes BETWEEN 5 AND 480);
    END IF;
END $$;

COMMIT;
