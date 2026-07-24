# 16 — INBOX MODULE
**ORION CRM · PRD v1.0 · 08/03/2026**

---

## Visão Geral

O Inbox é o centro de atendimento multicanal do ORION. Agrega conversas de WhatsApp, Instagram DM, Telegram (e futuramente TikTok Direct, Messenger) em uma única fila com layout WhatsApp Web — lista de conversas à esquerda + chat à direita + painel de contexto do cliente à direita.

**Rota:** `/inbox`
**Acesso:** Mestre + Funcionário (RBAC diferenciado)

---

## Decisões de Design (LOCKED)

| Decisão | Valor |
|---------|-------|
| Layout desktop | Lista + Chat lado a lado (WhatsApp Web) |
| Mídias suportadas | Imagem inline, player áudio, preview vídeo, PDF/doc, sticker/GIF, localização no mapa |
| Canais v1 | WhatsApp, Instagram DM, Telegram |
| Canais desabilitados (visíveis) | TikTok Direct, Messenger |
| Filtro de canal | Ícones no header do painel esquerdo |
| Assumir conversa | Banner + botão dourado; conversas livres com tag vermelha |
| Mensagens prontas | Tray expansível com busca + categorias |
| Identificação | Banner fixo acima do input + card dourado especial no chat |
| Painel lateral | Info cliente + pipeline + atendentes online + nota interna |

---

## Banco de Dados

```sql
-- CONVERSAS
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','instagram','telegram','tiktok','messenger')),
  external_id   VARCHAR(255) NOT NULL,           -- ID da conversa no canal externo
  contact_name  VARCHAR(150),
  contact_phone VARCHAR(30),
  contact_ig    VARCHAR(100),
  client_id     UUID REFERENCES clients(id),     -- linkado se já é cliente
  assignee_id   UUID REFERENCES users(id),       -- atendente atual (NULL = livre)
  assigned_at   TIMESTAMPTZ,
  pipeline_id   UUID REFERENCES pipelines(id),
  stage_id      UUID REFERENCES pipeline_stages(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','archived')),
  unread_count  INT NOT NULL DEFAULT 0,
  last_message  TEXT,
  last_message_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MENSAGENS
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_id       UUID REFERENCES users(id),     -- NULL se inbound
  type            VARCHAR(20) NOT NULL CHECK (type IN ('text','image','audio','video','document','sticker','location','identification')),
  content         TEXT,                           -- texto ou JSON de mídia
  media_url       TEXT,
  media_mime      VARCHAR(100),
  media_size      INT,
  status          VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  is_quick_reply  BOOLEAN DEFAULT false,          -- mensagem pronta usada
  external_id     VARCHAR(255),                   -- ID no canal externo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MENSAGENS PRONTAS
CREATE TABLE quick_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(100) NOT NULL,
  body        TEXT NOT NULL,
  category    VARCHAR(50),
  created_by  UUID NOT NULL REFERENCES users(id),
  org_id      UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INTEGRAÇÕES DE CANAL
CREATE TABLE channel_integrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  channel     VARCHAR(20) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB,                              -- tokens criptografados
  webhook_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, channel)
);

-- ÍNDICES
CREATE INDEX idx_conversations_assignee ON conversations(assignee_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
```

---

## Arquitetura

```
Canais externos (WA, IG, TG)
         ↓ webhook
    n8n (receptor)
         ↓
   POST /api/inbox/inbound
         ↓
   InboxService (Node.js)
         ↓
   salva em messages + conversations
         ↓
   Socket.io emite para sala conversation:{id}
         ↓
   Frontend atualiza em tempo real
```

### WebSocket eventos
```
server → client:
  inbox:new_conversation   — nova conversa chegou
  inbox:new_message        — nova mensagem na conversa aberta
  inbox:conversation_taken — atendente assumiu conversa
  inbox:typing             — cliente digitando

client → server:
  inbox:join    — entrar na sala de uma conversa
  inbox:leave
  inbox:read    — marcar como lido
```

---

## API Endpoints

```
GET    /api/inbox/conversations          — lista (query: channel, status, assignee, search)
GET    /api/inbox/conversations/:id      — detalhe + últimas 50 mensagens
GET    /api/inbox/conversations/:id/messages?cursor= — paginação
POST   /api/inbox/conversations/:id/assign   — assumir conversa
POST   /api/inbox/conversations/:id/transfer — transferir para outro atendente
POST   /api/inbox/conversations/:id/messages — enviar mensagem (text | identification | quick_reply)
POST   /api/inbox/conversations/:id/resolve  — encerrar conversa
POST   /api/inbox/inbound                    — webhook receptor (n8n → CRM)

GET    /api/inbox/quick-replies          — listar mensagens prontas
POST   /api/inbox/quick-replies          — criar
PUT    /api/inbox/quick-replies/:id      — editar
DELETE /api/inbox/quick-replies/:id      — excluir

GET    /api/inbox/channels               — status das integrações por canal
```

---

## Componentes Frontend

```
/inbox
├── page.tsx                    — layout principal (SSR shell)
├── InboxLayout.tsx             — flex row: PanelLeft + ChatMain + PanelSide
│
├── PanelLeft/
│   ├── ChannelFilter.tsx       — ícones de canal (WA/IG/TG/desabilitados)
│   ├── ConversationSearch.tsx  — input busca
│   ├── ConversationTabs.tsx    — Todos / Não lidos / Meus / Livre
│   └── ConversationList.tsx    — lista virtualizada (react-virtual)
│       └── ConversationItem.tsx — avatar + canal icon + nome + preview + badges
│
├── ChatMain/
│   ├── ChatHeader.tsx          — avatar + nome + status online + pipeline tag + ações
│   ├── AssumirBanner.tsx       — banner dourado "Assumir conversa"
│   ├── AtendenteBanner.tsx     — banner verde "Julia Santos · assumiu às 14:21"
│   ├── MessageList.tsx         — mensagens virtualizadas + auto-scroll
│   │   ├── BubbleText.tsx
│   │   ├── BubbleImage.tsx     — lightbox no clique
│   │   ├── BubbleAudio.tsx     — player com waveform
│   │   ├── BubbleVideo.tsx     — thumbnail + play
│   │   ├── BubbleDocument.tsx  — ícone + nome + download
│   │   ├── BubbleSticker.tsx   — sem border, tamanho fixo
│   │   ├── BubbleLocation.tsx  — mini mapa + endereço + link externo
│   │   └── BubbleIdentification.tsx — card dourado especial
│   └── InputArea/
│       ├── ProntasTray.tsx     — tray expansível com busca
│       ├── IdQuickBanner.tsx   — "Enviar como [nome]"
│       └── ChatInputBar.tsx    — anexo + prontas + textarea + voz + send
│
└── PanelSide/
    ├── ClientInfo.tsx          — nome + telefone
    ├── PipelineChip.tsx        — etapa atual + link para kanban
    ├── ConversationStats.tsx   — iniciada / atendente / mensagens
    ├── AttendantsList.tsx      — online / ocupado / offline
    └── InternalNote.tsx        — textarea privada (salva on blur debounce 1s)
```

---

## RBAC

| Ação | Mestre | Funcionário |
|------|--------|-------------|
| Ver todas as conversas | ✅ | ❌ (só as suas + livres) |
| Assumir conversa livre | ✅ | ✅ |
| Transferir conversa | ✅ | ✅ |
| Ver atendentes online | ✅ | ✅ |
| Criar mensagens prontas | ✅ | ❌ |
| Configurar canais (Ajustes) | ✅ | ❌ |
| Ver nota interna | ✅ | ✅ (só da própria conversa) |

---

## Fluxo: Assumir Conversa

```
1. Conversa chega via webhook → status=open, assignee_id=NULL
2. Aparece na lista com tag "Livre" (vermelha)
3. Atendente clica na conversa → vê AssumirBanner
4. Clica "Assumir" → POST /api/inbox/conversations/:id/assign
5. assignee_id = user.id, assigned_at = NOW()
6. Socket emite inbox:conversation_taken para todos
7. Banner muda para AtendenteBanner (verde)
8. Banner de identificação aparece no input
```

## Fluxo: Mensagem de Identificação

```
1. Atendente assume conversa
2. Banner "Enviar como [nome]" aparece acima do input
3. Clica no botão → POST messages { type: 'identification' }
4. Backend monta texto: "Olá! Sou [nome], [cargo] da [empresa]. ..."
5. Envia via n8n para o canal correspondente
6. Renderiza como BubbleIdentification (card dourado) no chat
7. Banner desaparece após envio (não repete na sessão)
```

## Fluxo: Mensagem Pronta

```
1. Clica ícone de documento na barra de input
2. ProntasTray abre com animação slide-up
3. Digita no search → filtra por título/corpo
4. Clica no item → cola no textarea + fecha tray
5. Atendente pode editar antes de enviar
6. Mensagem enviada recebe badge "✦ pronta" no chat
7. is_quick_reply = true no banco
```

---

## Renderização de Mídia

| Tipo | Comportamento | Tamanho máx. |
|------|--------------|--------------|
| image | Preview inline, lightbox no clique, expand hover | 220px largura |
| audio | Player com waveform SVG, progresso real, duração | 240px |
| video | Thumbnail + play central + duração overlay | 220px 16:9 |
| document | Ícone por tipo (PDF=vermelho, DOC=azul), nome, tamanho, download | 240px |
| sticker | Sem bubble, sem borda, 100x100px | 100px |
| location | Mini-mapa com grid, pin vermelho, endereço, abre Google Maps | 220px |
| identification | Card dourado especial, não é bubble normal | 72% largura máx |

---

## Checkpoints

### CP1 — Banco + WebSocket
- [ ] Migrations: conversations, messages, quick_replies, channel_integrations
- [ ] InboxService: upsert conversa inbound, emitir socket
- [ ] Auth: RBAC middleware no router `/api/inbox`
- [ ] GET conversations com filtros funcionando
⛔ STOP — validar queries e socket local antes de avançar

### CP2 — Painel Esquerdo
- [ ] ChannelFilter: ícones reais WA/IG/TG, disabled TikTok/Messenger
- [ ] ConversationList virtualizada com react-virtual
- [ ] ConversationItem: avatar + canal icon + nome + preview + badges (Livre, unread count, atendente dot)
- [ ] Search + Tabs funcionando (filtro client-side + server)
⛔ STOP — testar scroll performance com 100+ conversas

### CP3 — Chat Principal
- [ ] MessageList virtualizado com auto-scroll e load mais (cursor)
- [ ] Todos os 7 tipos de bubble renderizando
- [ ] BubbleAudio com player real (Howler.js ou HTML5 audio)
- [ ] BubbleImage com lightbox (react-medium-image-zoom ou similar)
⛔ STOP — testar cada tipo de mídia com dados reais

### CP4 — Input + Ações
- [ ] AssumirBanner / AtendenteBanner / Transferir
- [ ] ProntasTray: CRUD, busca, inserção no textarea
- [ ] IdQuickBanner: envio de identificação como mensagem especial
- [ ] ChatInputBar: envio texto, anexo upload, gravação áudio
⛔ STOP — testar fluxo completo assumir → identificar → responder

### CP5 — Painel Lateral + Polimento
- [ ] PanelSide: ClientInfo, PipelineChip, AttendantsList em tempo real
- [ ] InternalNote: auto-save on blur debounce 1s
- [ ] Notificação browser (Notification API) para novas mensagens
- [ ] typecheck + lint + TODO cleanup
⛔ STOP — smoke test em staging com canais reais conectados

---

## Dependências

```json
{
  "socket.io": "^4",
  "socket.io-client": "^4",
  "@tanstack/react-virtual": "^3",
  "howler": "^2",
  "react-medium-image-zoom": "^5",
  "date-fns": "^3"
}
```

---

## Notas de Implementação

- Waveform do áudio: gerar SVG de barras aleatórias no frontend (não precisa processar o áudio em si na v1). Na v2, usar Web Audio API para waveform real.
- Canal icon no avatar: componente `ChannelIcon` reutilizável que recebe `channel` e retorna o SVG correto com a cor certa.
- Canais desabilitados: buscar `channel_integrations` na montagem do `ChannelFilter` e só renderizar como clicável os que têm `is_active = true`.
- Notificação de identificação: após envio bem-sucedido, `localStorage.setItem('id_sent_${conversationId}', 'true')` para não reaparecer na mesma sessão.
- Otimistic update: ao enviar mensagem, inserir imediatamente na lista local com status `sending` e substituir pelo dado real quando o socket confirmar.
