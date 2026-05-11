-- 050_product_categories_and_raw_material.sql
--
-- 1) Cria tabela product_categories com suporte a subcategorias via parent_id.
-- 2) Adiciona FK opcional products.category_id (mantém products.category string
--    como fallback durante a migração — UI nova passa a usar category_id).
-- 3) Adiciona flag products.is_raw_material (default false) — distingue joia
--    pronta de matéria-prima. Matéria-prima aparece no PDV e na seleção de
--    materiais consumidos por OS.

BEGIN;

CREATE TABLE IF NOT EXISTS product_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    parent_id  UUID REFERENCES product_categories(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_name_parent
    ON product_categories (LOWER(name), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_product_categories_parent
    ON product_categories (parent_id);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category_id      UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_raw_material  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON products (category_id);

CREATE INDEX IF NOT EXISTS idx_products_is_raw_material
    ON products (is_raw_material) WHERE is_raw_material = TRUE;

COMMIT;
