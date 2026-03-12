# ORION CRM — PRD: Módulo Pipeline Completo

> Baseado nos mockups aprovados em 07/03/2026.
> Unifica menu lateral, kanban do funcionário e builder do mestre.

---

## Referências Visuais

| Arquivo | O que mostra |
|---------|-------------|
| `mockup-pipeline-builder.html` | Menu novo + página do builder (visão MESTRE) |
| `mockup-kanban-funcionario.html` | Kanban rico (visão FUNCIONÁRIO) |

Abrir ambos antes de implementar qualquer componente.

---

## Conceito

O Pipeline é um motor de orquestração interno.
O Mestre define o fluxo (etapas, regras, ações, skills de IA).
O Funcionário só vê o kanban resultante — sem saber que existe um builder por baixo.

```
MESTRE → Builder → define fluxo → publica pipeline
FUNCIONÁRIO → Kanban → opera leads → IA orquestra automaticamente
```

---

## 1. Menu Lateral — Reestruturação

### Estrutura nova

```
ORION CRM

[Dashboard]

─── PIPELINE ───────────────────
  ● Leads          [✏️][⏸][🗑]   ← ações só pro Mestre no hover
  ● Pedidos        [✏️][⏸][🗑]
  ● Produção       [✏️][⏸][🗑]
  ● Pós-venda off              ← pipeline desativado: visível só pro Mestre
  + Novo pipeline              ← só pro Mestre

─── COMERCIAL ──────────────────
  Clientes
  Inbox

─── OPERAÇÃO ───────────────────
  Financeiro
  Estoque
  PDV

─── SISTEMA ────────────────────
  Automações
  Analytics
  Ajustes
```

### RBAC no menu

| Elemento | Mestre | Funcionário |
|----------|--------|-------------|
| Ver pipelines ativos | ✅ | ✅ |
| Ver pipelines desativados | ✅ | ❌ |
| Botões ✏️ ⏸ 🗑 no hover | ✅ | ❌ |
| Botão "+ Novo pipeline" | ✅ | ❌ |
| Badge "Mestre" no perfil | ✅ | ❌ |

### Rotas

```
/pipeline/[slug]           → kanban do pipeline (todos)
/pipeline/[slug]/builder   → builder do fluxo (Mestre only)
```

---

## 2. Banco de Dados

```sql
-- Pipelines (múltiplos por empresa)
CREATE TABLE pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,        -- "Leads", "Pedidos", "Produção"
  slug        VARCHAR(100) NOT NULL UNIQUE, -- "leads", "pedidos"
  description TEXT,
  icon        VARCHAR(10) DEFAULT '🔀',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  flow_json   JSONB DEFAULT '{}',           -- nós e conexões do builder
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: 3 pipelines padrão
INSERT INTO pipelines (name, slug, is_active, is_default) VALUES
  ('Leads',    'leads',    true, true),
  ('Pedidos',  'pedidos',  true, false),
  ('Produção', 'producao', true, false);

-- Vincular pipeline_stages ao pipeline
ALTER TABLE pipeline_stages
  ADD COLUMN pipeline_id UUID REFERENCES pipelines(id);

-- Migrar stages existentes para o pipeline de Leads
UPDATE pipeline_stages SET pipeline_id = (SELECT id FROM pipelines WHERE slug = 'leads');

-- Vincular leads ao pipeline
ALTER TABLE leads
  ADD COLUMN pipeline_id UUID REFERENCES pipelines(id);

UPDATE leads SET pipeline_id = (SELECT id FROM pipelines WHERE slug = 'leads');
```

---

## 3. API — Endpoints

```typescript
// Pipelines
GET    /api/v1/pipelines                    → lista ativos (+ inativos pro Mestre)
POST   /api/v1/pipelines                    → criar pipeline (Mestre)
PUT    /api/v1/pipelines/:id                → editar nome/ícone/descrição (Mestre)
PATCH  /api/v1/pipelines/:id/toggle         → ativar/desativar (Mestre)
DELETE /api/v1/pipelines/:id                → apagar se vazio (Mestre)

// Builder — salvar fluxo
PUT    /api/v1/pipelines/:id/flow           → salva flow_json (canvas do builder)
POST   /api/v1/pipelines/:id/publish        → publica pipeline (valida fluxo antes)

// Stages por pipeline
GET    /api/v1/pipelines/:id/stages         → etapas do pipeline
POST   /api/v1/pipelines/:id/stages         → criar etapa
PUT    /api/v1/pipelines/:id/stages/reorder → reordenar

// Leads por pipeline (kanban)
GET    /api/v1/pipelines/:id/leads          → leads do pipeline com filtros
```

---

## 4. Frontend — Kanban do Funcionário (/pipeline/[slug])

### Topbar
- Título do pipeline + tag com nome
- Botão "+ Novo lead"
- Botão "Importar leads"
- SEM botão de configurar (Funcionário)

### Barra de etapas (abaixo do topbar)
- Etapas clicáveis em linha com separadores `›`
- Etapa atual destacada (gold)
- Etapas anteriores: cinza claro
- Click filtra o kanban para mostrar só aquela etapa

### Filtro Bar
- Busca por nome (debounce 300ms)
- Pills: Todos / Meus leads / Com WA / Sem interação 7d+ / Com tarefas
- Toggle kanban / lista

### Cards (LeadCard rico)
Cada card mostra:
1. Nome do lead + avatar do responsável
2. Interesse/categoria com emoji
3. Valor estimado (gold)
4. Quick note (textarea inline, salva no blur com debounce 1s)
5. Badges no rodapé: 💬 WA não lidas · ✓ tarefas · ⏱ dias sem interação
6. Badge `✦ IA` se a IA moveu o card automaticamente

Cores dos badges:
- ⏱ dias: amarelo >3d, vermelho >7d
- ✓ tarefas: roxo normal, vermelho se alguma atrasada
- Card convertido: fundo verde claro, nota "Pedido criado automaticamente"

### Drag-and-drop
- @dnd-kit — já instalado
- Otimistic update + rollback em erro
- PATCH /api/v1/leads/:id/stage ao soltar

---

## 5. Frontend — Builder do Mestre (/pipeline/[slug]/builder)

> v1: canvas funcional com nós básicos + chat IA placeholder
> v2: lógica completa de orquestração e execução automática

### Layout
```
[TOPBAR: nome do pipeline + Desfazer + Preview + Publicar]
[TABS: Fluxo | Configurações | Etapas | Métricas]
[CANVAS (flex-1) | CHAT IA (320px)]
```

### Canvas (React Flow — @xyflow/react)
- Background: dot grid 24x24px
- Toolbar: Selecionar / Mover / Adicionar nó
- Zoom: −  100%  + ⊡
- Paleta de nós (canto direito do canvas):

| Nó | Cor | Função |
|----|-----|--------|
| Gatilho | Verde | Evento que inicia o fluxo |
| Etapa | Gold | Coluna do kanban |
| Ação | Azul | Executa algo (ex: enviar WA) |
| Condição | Âmbar | Bifurca o fluxo (se/senão) |
| Skill IA | Roxo | Executa uma skill de IA |
| n8n Flow | Rosa | Aciona workflow externo no n8n |

### Salvar fluxo
- Auto-save a cada 30s (PUT /api/v1/pipelines/:id/flow)
- Indicador "Salvando..." / "Salvo" no topbar
- Botão "Publicar" valida fluxo e ativa

### Chat IA (placeholder v1)
- Header: avatar + "ORION IA" + badge "Pipeline AI" + status online
- Mensagem de boas-vindas fixa
- Input funcional (envia mensagem)
- Resposta placeholder: "Em breve a IA vai configurar o fluxo por aqui 🔀"
- Sugestões clicáveis (não funcionais na v1 — apenas visual)

> v2: IA interpreta linguagem natural e manipula o canvas via API

---

## Protocolo de Execução — CHECKPOINTS OBRIGATÓRIOS

> REGRA ABSOLUTA: implemente um checkpoint por vez. Após cada um, PARE,
> mostre o que foi feito e aguarde aprovação explícita ("ok") antes de continuar.
> Se algo contradiz o que já existe no código, PARE e pergunte antes de decidir.

---

### CHECKPOINT 1 — DIAGNÓSTICO
Antes de qualquer código, responda:
- A tabela `pipeline_stages` já existe? Com quais colunas?
- Existe alguma referência a `stage` hardcoded no menu lateral atual?
- O `@xyflow/react` já está em `apps/web/package.json`?
- Qual é a estrutura atual do menu lateral (arquivo)?
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 2 — BANCO + SEED
Implemente APENAS:
- Migration: tabela `pipelines`
- ALTER TABLE `pipeline_stages` ADD `pipeline_id`
- ALTER TABLE `leads` ADD `pipeline_id`
- UPDATE para migrar dados existentes
- Seed: 3 pipelines padrão (Leads, Pedidos, Produção)
Mostre o SQL gerado e aguarde aprovação.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 3 — API PIPELINES
Implemente APENAS:
- GET/POST/PUT/PATCH/DELETE `/api/v1/pipelines`
- PUT `/api/v1/pipelines/:id/flow`
- POST `/api/v1/pipelines/:id/publish`
- GET `/api/v1/pipelines/:id/leads`
Mostre os arquivos criados.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 4 — MENU LATERAL
Implemente APENAS:
- Reestruturar seções do sidebar (Pipeline / Comercial / Operação / Sistema)
- Seção Pipeline: lista dinâmica de pipelines da API
- Hover revela ✏️ ⏸ 🗑 (só pro role MESTRE)
- Botão "+ Novo pipeline" (só pro role MESTRE)
- Pipeline desativado: visível só pro Mestre, opaco
Compare pixel a pixel com `mockup-pipeline-builder.html` (sidebar esquerda).
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 5 — KANBAN DO FUNCIONÁRIO
Implemente APENAS:
- Página `/pipeline/[slug]/page.tsx`
- Barra de etapas clicável
- Filtro bar com pills e busca
- LeadCard rico com todos os 6 elementos
- Badge `✦ IA` nos cards movidos pela IA
- Drag-and-drop com @dnd-kit + otimistic update
Compare com `mockup-kanban-funcionario.html`.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 6 — BUILDER BÁSICO (v1)
Implemente APENAS:
- Página `/pipeline/[slug]/builder/page.tsx` (MESTRE only — redireciona se não for Mestre)
- Canvas React Flow com dot grid
- 6 tipos de nó na paleta
- Auto-save do flow_json a cada 30s
- Chat IA lateral com placeholder funcional
- Botão Publicar (salva e ativa o pipeline)
Compare com `mockup-pipeline-builder.html`.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 7 — INTEGRAÇÃO FINAL
- Rodar typecheck em apps/web e apps/api
- Confirmar RBAC: Funcionário não acessa /builder
- Confirmar que leads existentes aparecem no pipeline de Leads
- Listar TODOs para v2 (orquestração real da IA)
⛔ Aguarde aprovação.

---

## Definition of Done

- [ ] Menu lateral reestruturado em 4 seções
- [ ] Pipelines carregados dinamicamente da API
- [ ] Botões de mestre aparecem só no hover e só pro role Mestre
- [ ] Kanban carrega etapas do pipeline selecionado
- [ ] Cards ricos com todos os 6 elementos + badge IA
- [ ] Drag-and-drop funcional com rollback em erro
- [ ] Quick note salva com debounce
- [ ] Builder abre só pro Mestre (redirect 403 se Funcionário)
- [ ] Canvas React Flow com 6 tipos de nó
- [ ] Auto-save do fluxo a cada 30s
- [ ] Chat IA placeholder funcional
- [ ] Publicar pipeline funciona
- [ ] Typecheck limpo
