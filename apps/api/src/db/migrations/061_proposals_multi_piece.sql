-- 061_proposals_multi_piece.sql
--
-- TASK-005: contrato de backend da OS multi-peca com proposta.
-- Spec: docs/specs/production/os-multi-piece-proposal/{database,api}.md
--
-- Entidade NOVA, desacoplada de service_orders (que segue como OS unica de producao).
-- Modelo: proposals (1) -> proposal_pieces (N) -> proposal_piece_materials (N).
-- Dinheiro sempre em centavos, inteiro. Custo/margem NAO trafegam para o modal.

BEGIN;

CREATE TABLE IF NOT EXISTS proposals (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_number        VARCHAR(30) NOT NULL UNIQUE,
    customer_id            UUID NOT NULL REFERENCES customers(id),
    attendance_block_id    UUID REFERENCES attendance_blocks(id),
    title                  VARCHAR(200),
    due_date               DATE,
    responsible_user_id    UUID REFERENCES users(id),
    status                 VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','registered')),
    subtotal_cents         INTEGER NOT NULL DEFAULT 0,
    customer_credit_cents  INTEGER NOT NULL DEFAULT 0,
    total_cents            INTEGER NOT NULL DEFAULT 0,
    created_by             UUID NOT NULL REFERENCES users(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_customer ON proposals (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS proposal_pieces (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id   UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    position      SMALLINT NOT NULL DEFAULT 0,
    category      VARCHAR(100),
    title         VARCHAR(200),
    tech_specs    JSONB NOT NULL DEFAULT '{}',
    price_cents   INTEGER NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_pieces_proposal ON proposal_pieces (proposal_id, position);

CREATE TABLE IF NOT EXISTS proposal_piece_materials (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piece_id                  UUID NOT NULL REFERENCES proposal_pieces(id) ON DELETE CASCADE,
    origin                    VARCHAR(20) NOT NULL CHECK (origin IN ('own_stock','customer_custody')),
    product_id                UUID REFERENCES products(id),
    custody_ref               UUID,
    material_label            VARCHAR(200),
    quantity                  NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
    unit                      VARCHAR(10),
    unit_price_snapshot_cents INTEGER NOT NULL DEFAULT 0,
    notes                     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- estoque proprio exige produto; custodia usa rotulo (subsistema de custodia ainda inexistente)
    CONSTRAINT chk_material_origin CHECK (
        (origin = 'own_stock' AND product_id IS NOT NULL)
        OR (origin = 'customer_custody')
    )
);

CREATE INDEX IF NOT EXISTS idx_proposal_piece_materials_piece ON proposal_piece_materials (piece_id);

COMMIT;
