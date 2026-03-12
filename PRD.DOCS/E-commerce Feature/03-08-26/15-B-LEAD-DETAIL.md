# 15-B — PIPELINE · LEAD DETAIL PAGE
**ORION CRM · PRD v1.0 · 08/03/2026**
> Adendo ao `15-PIPELINE-MODULE.md` — página de detalhe aberta ao clicar em um card do Kanban

---

## Visão Geral

Ao clicar em qualquer card do Kanban, o usuário navega para a página de detalhe do lead — uma tela full-page com três colunas inspirada no Moskit CRM, adaptada ao design dark luxury do ORION. É o centro de informação e operação de um lead específico.

**Rota:** `/pipeline/[slug]/lead/[leadId]`
**Acesso:** Mestre + Funcionário (Funcionário não vê leads de outras fases se RBAC restrito)

---

## Layout — 3 Colunas

```
┌─────────────────────────────────────────────────────────────┐
│  ← Pipeline Leads  │ Novo Lead ✓ │ Qualificado ● │ Proposta │ ... │ Ganhou ✓ │ Perdeu ✗ │
├───────────────┬─────────────────────────────┬───────────────┤
│  COL LEFT     │       COL CENTER            │  COL RIGHT    │
│  260px        │       flex: 1               │  260px        │
│               │                             │               │
│  Lead Info    │  Tabs:                      │  Contato      │
│  Stats        │  · Notas & Atividades       │  Empresa      │
│  Tags         │  · Comunicações             │  Arquivos     │
│  Campos       │  · Linha do Tempo           │  Equipe       │
│  Personalizados│                            │               │
└───────────────┴─────────────────────────────┴───────────────┘
```

---

## Stage Bar (topo)

- Breadcrumb `← Pipeline [nome]` com link de volta ao Kanban
- Etapas do pipeline como tabs horizontais
  - Etapa concluída: texto verde + underline verde
  - Etapa atual: texto dourado + underline dourado
  - Etapa futura: texto muted, sem underline
- Botões `Ganhou` (verde) e `Perdeu` (vermelho) fixos no canto direito
- Clicar em etapa futura → move o lead para aquela etapa (com confirmação)
- Clicar em Ganhou/Perdeu → modal de confirmação + campo de motivo (opcional)

---

## Coluna Esquerda

### Card: Lead Info
| Campo | Tipo | Editável |
|-------|------|---------|
| Nome do lead | text | ✅ inline |
| Data de criação | date | ❌ |
| Valor estimado | currency | ✅ inline |
| Previsão de fechamento | date | ✅ date picker |
| Responsável | user select | ✅ Mestre only |
| Origem | select | ✅ |

### Card: Stats (read-only, calculados)
| Stat | Cálculo |
|------|---------|
| Dias aberto | `NOW() - lead.created_at` |
| Dias na fase | `NOW() - lead.stage_changed_at` |
| Interações | count de messages + activities |
| Dias sem interação | `NOW() - last_interaction_at` |

> Dias sem interação fica em âmbar se > 3 dias, vermelho se > 7 dias

### Card: Tags
- Chips coloridos por categoria
- Botão `+` abre popover de busca/criação de tags
- Mestre pode criar novas tags; Funcionário só associa existentes

### Card: Campos Personalizados
- Campos definidos em `Ajustes > Pipeline > Campos`
- Tipos: text, number, select, date, boolean
- Edição inline com auto-save on blur (debounce 800ms)
- Botão editar (lápis) no header do card

---

## Coluna Central

### Tab: Notas & Atividades

**Input de nota/atividade:**
- Textarea expansível com placeholder "Escreva ou grave o que aconteceu..."
- Footer com:
  - Select "Tipo de atividade" (Nota, Reunião, Ligação, Email, WhatsApp, Visita, Outro)
  - Botão de microfone → gravação de áudio (transcrito via IA na v2; salvo como nota na v1)
  - Botão `Salvar`
- Ao salvar: cria registro em `lead_activities` + evento na Linha do Tempo

**Lista de atividades:**
- Cards ordenados por data desc
- Ícone por tipo de atividade (calendário = reunião, doc = nota, etc.)
- Ações por card: marcar como concluído ✓ / editar ✏️ / excluir 🗑 / ver mais ···

### Tab: Comunicações

**Sub-tabs por canal** (mostra só os habilitados):
- WhatsApp, Email, Instagram DM, Telegram

**Para cada canal:**
- Contador de mensagens trocadas
- Preview da última mensagem
- Link "Ver no Inbox →" que abre a conversa no `/inbox` com a conversa do lead já selecionada
- Se canal sem histórico: placeholder "Nenhuma comunicação via [canal]"

### Tab: Linha do Tempo

**Filtros:** Todas / Notas / Atividades / WhatsApp / Email / Mudanças de etapa

**Tipos de evento na timeline:**
| Tipo | Ícone | Cor |
|------|-------|-----|
| Lead criado | ⚡ pipeline | dourado |
| Mudança de etapa | → seta | dourado |
| Atendimento assumido | 👤 | dourado |
| Nota adicionada | 📄 | dourado |
| Reunião agendada | 📅 | azul |
| Mensagem WA | 💬 WA | verde |
| Email enviado | ✉️ | azul |
| Arquivo anexado | 📎 | cinza |
| Lead ganho/perdido | 🏆/✗ | verde/vermelho |

---

## Coluna Direita

### Card: Contato
- Avatar com iniciais + cor gerada por nome
- Nome, telefone, handle de rede social
- Clique no card → abre página do cliente em `/clientes/[id]`
- Botão `+` → vincular outro contato ao lead
- Múltiplos contatos possíveis (ex: lead de casal)

### Card: Empresa
- Logo/iniciais + nome + setor + cidade
- Clique → abre página da empresa
- Botão `+` → vincular empresa

### Card: Arquivos
- Lista de arquivos enviados (via WhatsApp, email ou upload manual)
- Ícone por tipo (PDF vermelho, imagem azul, doc azul)
- Nome + tamanho + data
- Botão download individual
- Botão `+` → upload manual de arquivo
- Arquivos sincronizados automaticamente do Inbox quando a conversa está vinculada ao lead

### Card: Equipe
- Responsável (com status online)
- Observadores (Mestre pode adicionar)
- Botão `+` → adicionar membro da equipe como observador

---

## Banco de Dados

```sql
-- ATIVIDADES DO LEAD
CREATE TABLE lead_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  type        VARCHAR(30) NOT NULL CHECK (type IN (
                'note','meeting','call','email','whatsapp',
                'visit','stage_change','won','lost','file','other'
              )),
  title       VARCHAR(255),
  body        TEXT,
  media_url   TEXT,                         -- gravação de voz futura
  is_done     BOOLEAN NOT NULL DEFAULT false,
  scheduled_at TIMESTAMPTZ,                 -- para reuniões/chamadas agendadas
  done_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CAMPOS PERSONALIZADOS — VALORES
CREATE TABLE lead_custom_fields (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id   UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,          -- ex: "material_preferido"
  value     TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, field_key)
);

-- DEFINIÇÃO DOS CAMPOS (configurada em Ajustes)
CREATE TABLE pipeline_custom_field_defs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  label       VARCHAR(100) NOT NULL,
  field_key   VARCHAR(100) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('text','number','select','date','boolean')),
  options     JSONB,                        -- para type=select
  position    INT NOT NULL DEFAULT 0,
  UNIQUE (pipeline_id, field_key)
);

-- MEMBROS DA EQUIPE NO LEAD
CREATE TABLE lead_team_members (
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    VARCHAR(20) NOT NULL DEFAULT 'observer' CHECK (role IN ('owner','observer')),
  PRIMARY KEY (lead_id, user_id)
);

-- TAGS
CREATE TABLE tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  label VARCHAR(80) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#BFA06A',
  UNIQUE (org_id, label)
);

CREATE TABLE lead_tags (
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- ARQUIVOS DO LEAD
CREATE TABLE lead_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  url         TEXT NOT NULL,
  mime_type   VARCHAR(100),
  size_bytes  INT,
  source      VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual','whatsapp','email','instagram')),
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COLUNA EXTRAS NO LEADS EXISTENTE
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origin VARCHAR(50);   -- 'instagram','whatsapp','loja','manual'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS forecast_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- ÍNDICES
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_lead_files_lead ON lead_files(lead_id);
```

---

## API Endpoints

```
GET    /api/pipeline/leads/:id                     — detalhe completo do lead
PATCH  /api/pipeline/leads/:id                     — atualizar campos (valor, forecast, responsável)
PATCH  /api/pipeline/leads/:id/stage               — mover para outra etapa { stageId }
POST   /api/pipeline/leads/:id/win                 — marcar como ganho
POST   /api/pipeline/leads/:id/lose                — marcar como perdido { reason? }

GET    /api/pipeline/leads/:id/activities          — listar atividades (query: type, cursor)
POST   /api/pipeline/leads/:id/activities          — criar atividade (nota, reunião, etc.)
PATCH  /api/pipeline/leads/:id/activities/:actId   — editar
DELETE /api/pipeline/leads/:id/activities/:actId   — excluir
PATCH  /api/pipeline/leads/:id/activities/:actId/done — marcar concluída

GET    /api/pipeline/leads/:id/timeline            — linha do tempo (query: type, cursor)
GET    /api/pipeline/leads/:id/files               — listar arquivos
POST   /api/pipeline/leads/:id/files               — upload manual (multipart)
DELETE /api/pipeline/leads/:id/files/:fileId       — excluir arquivo

GET    /api/pipeline/leads/:id/custom-fields       — campos personalizados
PATCH  /api/pipeline/leads/:id/custom-fields       — salvar campos { key: value, ... }

POST   /api/pipeline/leads/:id/tags                — adicionar tag { tagId }
DELETE /api/pipeline/leads/:id/tags/:tagId         — remover tag
POST   /api/pipeline/leads/:id/team                — adicionar membro { userId, role }
DELETE /api/pipeline/leads/:id/team/:userId        — remover membro
```

---

## Componentes Frontend

```
/pipeline/[slug]/lead/[leadId]/
├── page.tsx
├── LeadDetailLayout.tsx         — stage bar + 3 colunas
│
├── StageBar/
│   ├── StageBar.tsx             — etapas + Ganhou/Perdeu
│   └── WinLoseModal.tsx         — modal de confirmação
│
├── ColLeft/
│   ├── LeadInfoCard.tsx         — dados básicos com edição inline
│   ├── StatsCard.tsx            — 4 métricas calculadas
│   ├── TagsCard.tsx             — chips + popover add
│   └── CustomFieldsCard.tsx     — campos com auto-save
│
├── ColCenter/
│   ├── CenterTabs.tsx
│   ├── tabs/
│   │   ├── NotasTab.tsx
│   │   │   ├── ActivityInput.tsx   — textarea + tipo + mic + salvar
│   │   │   └── ActivityList.tsx    — cards de atividade
│   │   ├── ComunicacoesTab.tsx
│   │   │   └── ChannelPreview.tsx  — preview por canal + link inbox
│   │   └── TimelineTab.tsx
│   │       ├── TimelineFilters.tsx
│   │       └── TimelineItem.tsx
│
└── ColRight/
    ├── ContactCard.tsx
    ├── EmpresaCard.tsx
    ├── FilesCard.tsx
    └── TeamCard.tsx
```

---

## Regras de Negócio

```
MOVER ETAPA:
- Qualquer etapa pode ser selecionada (não obrigatoriamente sequencial)
- Ao mover: atualizar leads.stage_id + stage_changed_at
- Criar evento na timeline: type='stage_change'
- Emitir socket para atualizar o Kanban em tempo real (sem reload)

GANHOU / PERDEU:
- Ganhou: leads.status='won', won_at=NOW()
  → cria pedido automaticamente se pipeline for "Leads" (configurável)
  → move card para coluna virtual "Ganhou" no Kanban
- Perdeu: leads.status='lost', lost_at=NOW(), lost_reason=?
  → card fica visível no Kanban com opacidade reduzida por 24h
  → depois some (filtrado por padrão)

CAMPOS PERSONALIZADOS:
- Auto-save on blur com debounce 800ms
- Upsert em lead_custom_fields
- Não bloquear UI durante save (optimistic)

ARQUIVOS SINCRONIZADOS DO INBOX:
- Quando uma conversa está vinculada ao lead (conversation.lead_id = lead.id)
  todos os arquivos enviados no chat são automaticamente espelhados em lead_files
  com source = 'whatsapp' | 'instagram'

STATS — DIAS SEM INTERAÇÃO:
- Cor neutra: 0-2 dias
- Âmbar: 3-6 dias
- Vermelho: 7+ dias
- Tooltip mostra a data da última interação

EDIÇÃO INLINE:
- Duplo clique em qualquer campo do LeadInfoCard → modo edição
- Enter ou blur → salva via PATCH
- Escape → cancela
```

---

## Checkpoints

### CP1 — Migrations + API básica
- [ ] Migrations: lead_activities, lead_custom_fields, pipeline_custom_field_defs, lead_team_members, tags, lead_tags, lead_files + ALTER TABLE leads
- [ ] GET `/api/pipeline/leads/:id` retornando lead + activities + files + team + tags + custom_fields
- [ ] PATCH `/api/pipeline/leads/:id/stage` com emissão de socket para o Kanban
- [ ] POST `/api/pipeline/leads/:id/win` e `/lose`
⛔ STOP — validar typecheck + testar mover etapa refletindo no Kanban aberto

### CP2 — Layout + Coluna Esquerda
- [ ] LeadDetailLayout: StageBar responsiva + 3 colunas com scroll independente
- [ ] StageBar: etapas com estado done/active/future + botões Ganhou/Perdeu + WinLoseModal
- [ ] LeadInfoCard com edição inline (duplo clique → input → blur/Enter → PATCH)
- [ ] StatsCard calculando e colorindo Dias sem interação
⛔ STOP — testar edição inline + navegação de etapas

### CP3 — Coluna Central
- [ ] ActivityInput: textarea + select tipo + botão salvar
- [ ] ActivityList: cards com ações (done / edit / delete)
- [ ] ComunicacoesTab: sub-tabs por canal + preview última mensagem + link `/inbox`
- [ ] TimelineTab: lista com filtros, todos os tipos de evento renderizando
⛔ STOP — testar criação de nota, mudança de etapa aparecendo na timeline

### CP4 — Coluna Direita + Campos
- [ ] ContactCard + EmpresaCard com link para páginas de cliente
- [ ] FilesCard: listar + upload manual (multipart) + download
- [ ] CustomFieldsCard: auto-save on blur debounce 800ms
- [ ] TagsCard: popover busca/criação + remoção de tag
⛔ STOP — testar upload de arquivo + sync automático do Inbox

### CP5 — Polimento + Integração
- [ ] Sincronização automática de arquivos do Inbox → lead_files
- [ ] Socket: mover lead de etapa reflete no Kanban sem reload
- [ ] Animação ao marcar Ganhou (confetti leve) / Perdeu (fade out)
- [ ] typecheck + lint + TODO cleanup
⛔ STOP — smoke test completo: criar lead no kanban → abrir detalhe → mover etapas → ganhar
