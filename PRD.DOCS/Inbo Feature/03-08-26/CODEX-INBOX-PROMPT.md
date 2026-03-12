# CODEX PROMPT — INBOX MODULE (16)
**ORION CRM · 08/03/2026**

---

## Contexto do Projeto

Você está implementando o módulo **Inbox** do ORION CRM. O ORION é um CRM dark-luxury para joalherias, construído em monorepo com:

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js + Express, PostgreSQL, Redis, Socket.io, BullMQ
- **Automação:** n8n (único responsável por receber webhooks dos canais externos)
- **Design:** dark sidebar `#0F0F0F`, gold `#C8A97A`, canvas `#F8F7F5`, fonte Inter

O Inbox é o **centro de atendimento multicanal**: WhatsApp, Instagram DM e Telegram convergem em uma única fila. O layout é idêntico ao WhatsApp Web (lista de conversas à esquerda + chat no centro + painel de contexto à direita).

---

## Checkpoint Atual

Implemente o **CP1 — Banco + WebSocket**:

1. Criar migrations para as tabelas: `conversations`, `messages`, `quick_replies`, `channel_integrations`
2. Implementar `InboxService` com os métodos:
   - `upsertConversation(channel, externalId, contactData)` — cria ou atualiza conversa inbound
   - `saveMessage(conversationId, messageData)` — persiste mensagem e atualiza `last_message`
   - `emitToRoom(conversationId, event, data)` — emite via Socket.io para `conversation:{id}`
3. Implementar `POST /api/inbox/inbound` — endpoint receptor de webhooks do n8n
4. Implementar `GET /api/inbox/conversations` com filtros: `channel`, `status`, `assignee_id`, `search`
5. Configurar RBAC middleware: Mestre vê todas; Funcionário vê apenas as suas + livres (assignee_id IS NULL)

---

## Schema SQL Completo

```sql
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','instagram','telegram','tiktok','messenger')),
  external_id     VARCHAR(255) NOT NULL,
  contact_name    VARCHAR(150),
  contact_phone   VARCHAR(30),
  contact_ig      VARCHAR(100),
  client_id       UUID REFERENCES clients(id),
  assignee_id     UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ,
  pipeline_id     UUID REFERENCES pipelines(id),
  stage_id        UUID REFERENCES pipeline_stages(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','archived')),
  unread_count    INT NOT NULL DEFAULT 0,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_id       UUID REFERENCES users(id),
  type            VARCHAR(20) NOT NULL CHECK (type IN ('text','image','audio','video','document','sticker','location','identification')),
  content         TEXT,
  media_url       TEXT,
  media_mime      VARCHAR(100),
  media_size      INT,
  status          VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  is_quick_reply  BOOLEAN DEFAULT false,
  external_id     VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quick_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(100) NOT NULL,
  body        TEXT NOT NULL,
  category    VARCHAR(50),
  created_by  UUID NOT NULL REFERENCES users(id),
  org_id      UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE channel_integrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  channel     VARCHAR(20) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB,
  webhook_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, channel)
);

CREATE INDEX idx_conversations_assignee ON conversations(assignee_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
```

---

## Payload do Webhook (n8n → CRM)

O n8n normaliza os webhooks de cada canal para este formato antes de enviar ao CRM:

```typescript
interface InboundWebhookPayload {
  channel: 'whatsapp' | 'instagram' | 'telegram';
  externalConversationId: string;   // ID único da conversa no canal
  externalMessageId: string;        // ID da mensagem no canal
  contact: {
    name?: string;
    phone?: string;                 // apenas WhatsApp
    igHandle?: string;              // apenas Instagram
    telegramId?: string;            // apenas Telegram
  };
  message: {
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location';
    content?: string;               // texto da mensagem
    mediaUrl?: string;              // URL da mídia (hospedada no n8n ou storage)
    mediaMime?: string;
    mediaSize?: number;
    location?: { lat: number; lng: number; address?: string };
  };
  timestamp: string;                // ISO 8601
}
```

---

## Regras de Negócio

```
ASSUMIR CONVERSA:
- POST /api/inbox/conversations/:id/assign
- Só pode assumir se assignee_id IS NULL OU se o caller for Mestre
- Após assumir: emitir socket inbox:conversation_taken para todos
- Funcionário só pode assumir conversas da sua org

MENSAGEM DE IDENTIFICAÇÃO:
- type = 'identification'
- Backend monta o texto: "Olá! Sou [user.name], [user.role] da [org.name]. {saudação_personalizada}"
- Envia via n8n (POST para webhook de saída configurado)
- Salva no banco como qualquer outra mensagem
- Frontend renderiza com componente BubbleIdentification (card dourado)

UNREAD COUNT:
- Incrementa em +1 a cada mensagem inbound
- Reset para 0 quando atendente abre a conversa (POST /conversations/:id/read)

TRANSFERÊNCIA:
- POST /api/inbox/conversations/:id/transfer { toUserId }
- Atualiza assignee_id, emite socket inbox:conversation_taken
- Cria mensagem interna do tipo 'text' com content: "Conversa transferida para [nome]"
```

---

## Estrutura de Arquivos Esperada

```
apps/api/src/
├── inbox/
│   ├── inbox.router.ts
│   ├── inbox.service.ts
│   ├── inbox.socket.ts       — configuração das salas e eventos
│   └── inbox.types.ts        — interfaces TypeScript

apps/web/src/
├── app/(dashboard)/inbox/
│   ├── page.tsx
│   ├── InboxLayout.tsx
│   ├── PanelLeft/
│   │   ├── ChannelFilter.tsx
│   │   ├── ConversationList.tsx
│   │   └── ConversationItem.tsx
│   ├── ChatMain/
│   │   ├── ChatHeader.tsx
│   │   ├── AssumirBanner.tsx
│   │   ├── AtendenteBanner.tsx
│   │   ├── MessageList.tsx
│   │   ├── bubbles/
│   │   │   ├── BubbleText.tsx
│   │   │   ├── BubbleImage.tsx
│   │   │   ├── BubbleAudio.tsx
│   │   │   ├── BubbleVideo.tsx
│   │   │   ├── BubbleDocument.tsx
│   │   │   ├── BubbleSticker.tsx
│   │   │   ├── BubbleLocation.tsx
│   │   │   └── BubbleIdentification.tsx
│   │   └── InputArea/
│   │       ├── ProntasTray.tsx
│   │       ├── IdQuickBanner.tsx
│   │       └── ChatInputBar.tsx
│   └── PanelSide/
│       ├── ClientInfo.tsx
│       ├── PipelineChip.tsx
│       ├── AttendantsList.tsx
│       └── InternalNote.tsx
└── hooks/
    ├── useInboxSocket.ts     — socket.io client hook
    └── useConversations.ts   — react-query + socket sync
```

---

## Dependências a Instalar

```bash
# API
npm install socket.io

# Web
npm install socket.io-client @tanstack/react-virtual howler react-medium-image-zoom date-fns
npm install --save-dev @types/howler
```

---

## Restrições

- ❌ Não implementar player de áudio com waveform real (v1: waveform é decorativo com barras SVG aleatórias)
- ❌ Não implementar envio via canal real (v1: logar no console + salvar no banco; integração real é responsabilidade do n8n)
- ❌ Não criar página de configuração de canais (isso fica em `/settings/channels`)
- ✅ Usar `@tanstack/react-virtual` para virtualizar a lista de conversas e o histórico de mensagens
- ✅ Optimistic update ao enviar: inserir mensagem localmente com status `sending` antes da confirmação do servidor
- ✅ Canal icon no avatar: componente `ChannelIcon` reutilizável que recebe prop `channel: ChannelType` e retorna SVG correto
- ✅ Seguir padrão de checkpoint: implementar CP1, rodar typecheck, só avançar se aprovado

---

## Critério de Conclusão do CP1

```bash
# Deve passar sem erros:
npx tsc --noEmit
npx eslint apps/api/src/inbox/

# Deve responder:
curl -X GET http://localhost:3001/api/inbox/conversations \
  -H "Authorization: Bearer <token>"
# → { conversations: [], total: 0 }

# Socket deve conectar:
# io.on('connection') deve logar o userId do usuário autenticado
```
