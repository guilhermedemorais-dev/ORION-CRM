-- 059_customers_tags.sql
-- Tags simples (texto livre) por cliente, exibidas e editáveis na ficha.
-- Armazenadas como array JSONB de strings. Default '[]' para registros existentes.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
