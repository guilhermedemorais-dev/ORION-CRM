-- Migration 004: Conversations + Messages

CREATE TYPE conversation_status AS ENUM ('BOT', 'AGUARDANDO_HUMANO', 'EM_ATENDIMENTO', 'ENCERRADA');
CREATE TYPE message_direction AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE message_type AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'TEMPLATE');
CREATE TYPE message_status AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number VARCHAR(20) NOT NULL,
  lead_id UUID REFERENCES leads(id),
  customer_id UUID REFERENCES customers(id),
  status conversation_status NOT NULL DEFAULT 'BOT',
  assigned_to UUID REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_whatsapp ON conversations (whatsapp_number);
CREATE INDEX idx_conversations_status ON conversations (status);
CREATE INDEX idx_conversations_assigned ON conversations (assigned_to);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  meta_message_id VARCHAR(255) UNIQUE,
  direction message_direction NOT NULL,
  type message_type NOT NULL DEFAULT 'TEXT',
  content TEXT,
  media_url VARCHAR(500),
  sent_by UUID REFERENCES users(id),
  status message_status NOT NULL DEFAULT 'SENT',
  is_automated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_meta_id ON messages (meta_message_id) WHERE meta_message_id IS NOT NULL;
CREATE INDEX idx_messages_created ON messages (created_at DESC);
