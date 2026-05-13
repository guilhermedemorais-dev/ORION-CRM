-- 052_roadmap_items.sql
--
-- Painel de gestão do projeto que substitui a "Linha do Tempo" atual em
-- Suporte. Items representam features/planos/entregas, com status editável,
-- comentários em threading, reações 👍/👎 e anexos. Cliente (ADMIN) aprova ou
-- reprova um item. ROOT cria/edita. IA (Claude) pode criar via SQL — flag
-- created_by_ai distingue.

BEGIN;

CREATE TABLE IF NOT EXISTS roadmap_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(200) NOT NULL,
    description      TEXT NOT NULL,
    technical_details TEXT,
    status           VARCHAR(40) NOT NULL DEFAULT 'PLANEJADO',
    due_date         DATE,
    approval_state   VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approval_at      TIMESTAMPTZ,
    approval_by      UUID REFERENCES users(id),
    created_by       UUID REFERENCES users(id),
    created_by_ai    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_roadmap_status CHECK (status IN (
        'PLANEJADO',
        'AGUARDANDO_APROVACAO',
        'APROVADO',
        'EM_ANDAMENTO',
        'PARADO',
        'CONCLUIDO',
        'REPROVADO'
    )),
    CONSTRAINT chk_roadmap_approval CHECK (approval_state IN (
        'PENDING', 'APPROVED', 'REPROVED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_roadmap_items_status
    ON roadmap_items (status);

CREATE INDEX IF NOT EXISTS idx_roadmap_items_created_at
    ON roadmap_items (created_at DESC);

-- Comentários com threading via parent_comment_id
CREATE TABLE IF NOT EXISTS roadmap_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id           UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES roadmap_comments(id) ON DELETE CASCADE,
    body              TEXT NOT NULL,
    author_id         UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_comments_item
    ON roadmap_comments (item_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_roadmap_comments_parent
    ON roadmap_comments (parent_comment_id);

-- Reações em comentários (apenas ROOT pode reagir aos comentários do cliente).
-- agree=true significa "concordo, vou seguir" / agree=false significa
-- "não vou seguir essa sugestão". UNIQUE garante uma reação por (comentário,
-- usuário) — clicar de novo no mesmo botão remove.
CREATE TABLE IF NOT EXISTS roadmap_comment_reactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id  UUID NOT NULL REFERENCES roadmap_comments(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agree       BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_reactions_comment
    ON roadmap_comment_reactions (comment_id);

-- Anexos podem pertencer a um item OU a um comentário (exatamente um deles).
CREATE TABLE IF NOT EXISTS roadmap_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID REFERENCES roadmap_items(id) ON DELETE CASCADE,
    comment_id  UUID REFERENCES roadmap_comments(id) ON DELETE CASCADE,
    file_url    VARCHAR(500) NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_type   VARCHAR(80) NOT NULL,
    file_size   INTEGER NOT NULL DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_attachment_owner CHECK (
        (item_id IS NOT NULL AND comment_id IS NULL)
        OR (item_id IS NULL AND comment_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_roadmap_attachments_item
    ON roadmap_attachments (item_id);

CREATE INDEX IF NOT EXISTS idx_roadmap_attachments_comment
    ON roadmap_attachments (comment_id);

COMMIT;
