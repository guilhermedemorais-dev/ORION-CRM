-- 056_customers_photo_url.sql
--
-- Adiciona coluna `photo_url` em customers para foto de perfil do cliente
-- (avatar). Armazena o caminho público servido pelo NGINX
-- (ex.: "/uploads/customers/<uuid>/photo.jpg"), nunca o arquivo binário.
--
-- Idempotente (IF NOT EXISTS). Não altera dados existentes.

BEGIN;

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

COMMIT;
