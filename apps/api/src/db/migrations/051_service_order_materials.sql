-- 051_service_order_materials.sql
--
-- Vincula matérias-primas (e qualquer produto do estoque) consumidos na produção
-- de uma OS. Snapshot de preço/custo no momento que o material é adicionado à OS,
-- preservando o histórico mesmo que o produto seja repreçado depois.
--
-- Também adiciona campos de mão de obra e subtotal de materiais na própria OS
-- para evitar recálculo redundante e suportar auditoria.

BEGIN;

CREATE TABLE IF NOT EXISTS service_order_materials (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_order_id        UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    product_id              UUID NOT NULL REFERENCES products(id),
    quantity                NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
    unit_cost_snapshot_cents INTEGER NOT NULL DEFAULT 0,
    unit_price_snapshot_cents INTEGER NOT NULL DEFAULT 0,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_som_service_order
    ON service_order_materials (service_order_id);

CREATE INDEX IF NOT EXISTS idx_som_product
    ON service_order_materials (product_id);

-- Mão de obra (separada do subtotal de materiais, padrão em joalheria).
ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS labor_cents              INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS materials_subtotal_cents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS markup_percent           NUMERIC(5,2) NOT NULL DEFAULT 0;

COMMIT;
