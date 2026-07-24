# TASK — Refatoração: Aba Atendimento + Mini-Kanban + OS Unificado

## Leia antes de qualquer coisa
- `apps/web/app/(crm)/clientes/[id]/` — estrutura atual do painel do cliente
- `apps/web/components/attendance/` — componentes existentes
- `apps/api/src/routes/` — rotas existentes de attendance_blocks e service_orders
- `apps/api/src/db/schema/` — schema atual

Reporte o que existe antes de implementar:
1. Quais campos tem `attendance_blocks` hoje?
2. Quais campos tem `service_orders` hoje?
3. O botão "+ Novo Bloco" está em qual componente?
4. A aba OS renderiza o quê hoje?

---

## MUDANÇA 1 — Botão "+ Novo Bloco" vira "+ Ordem de Serviço"

### Renomear
```
ANTES: botão "+ Novo Bloco"
DEPOIS: botão "+ Ordem de Serviço"
```

### O que abre ao clicar
Um único popup/modal que **une** o bloco de nota + as especificações de OS em um só formulário.

### Estrutura do popup unificado

```
┌── HEADER ────────────────────────────────────────────────────┐
│  [select: tipo]  [select: status-pipeline]  [input: título]  [X] │
├── TOOLBAR DE NOTA ────────────────────────────────────────────┤
│  [B][I][U][lista] [Gravar]    [select: canal]  [select: prioridade] │
├── ÁREA DE NOTA (contenteditable) ─────────────────────────────┤
│  min-height: 100px                                            │
│  placeholder: "Descreva o atendimento, preferências..."       │
├── FOTOS DE REFERÊNCIA ────────────────────────────────────────┤
│  [+ thumb] [+ thumb] [botão adicionar foto]                   │
├── ESPECIFICAÇÕES DE FABRICAÇÃO (colapsável) ──────────────────┤
│  Título: "Especificações de Fabricação"  [▼ expandir]         │
│                                                               │
│  Nome do produto / peça *  [input]                            │
│  Prioridade [select]        Prazo [date]                      │
│                                                               │
│  — ESPECIFICAÇÕES —                                           │
│  Metal [select]             Pedra principal [input]           │
│  Tamanho do aro [input]     Peso estimado (g) [input]         │
│  Acabamento [select]        Gravação [input]                  │
│  Nº garras [input]          Espessura aro (mm) [input]        │
│  Observações técnicas [textarea]                              │
│                                                               │
│  — EQUIPE —                                                   │
│  Designer 3D [select usuários role=DESIGNER_3D]               │
│  Ourives [select usuários role=PRODUCAO]                      │
│                                                               │
│  — VALORES —                                                  │
│  Sinal pago (R$) [input]    Total (R$) [input]                │
├── IA 3D (colapsável) ─────────────────────────────────────────┤
│  [ícone] "Gerar modelo 3D com IA"    [✨ Gerar]               │
│  (expandido: parâmetros + resultado — igual ao atual)         │
├── FOOTER ─────────────────────────────────────────────────────┤
│  [Cancelar]                                    [Salvar]       │
└───────────────────────────────────────────────────────────────┘
```

### Select de tipo (1ª caixa do header)
```
options: Atendimento | Consulta de peça | Ligação | Visita | E-mail
```

### Select de status-pipeline (2ª caixa do header) — MINI KANBAN
```
options (com cor):
  🟡 Atendimento   → status = 'ATENDIMENTO'
  🟣 Proposta      → status = 'PROPOSTA'
  🔵 Pedido        → status = 'PEDIDO'
  🟠 OS            → status = 'OS'
  🟢 Entrega       → status = 'ENTREGA'
```

Estilos por status no select e no badge do bloco:
```typescript
const statusColors = {
  ATENDIMENTO: { bg: 'var(--amber-dim)',  border: 'var(--amber-b)',  text: 'var(--amber)'  },
  PROPOSTA:    { bg: 'var(--purple-dim)', border: 'var(--purple-b)', text: 'var(--purple)' },
  PEDIDO:      { bg: 'var(--blue-dim)',   border: 'var(--blue-b)',   text: 'var(--blue)'   },
  OS:          { bg: 'var(--teal-dim)',   border: 'var(--teal-b)',   text: 'var(--teal)'   },
  ENTREGA:     { bg: 'var(--green-dim)',  border: 'var(--green-b)',  text: 'var(--green)'  },
}
```

---

## MUDANÇA 2 — Banco de dados: unificar campos

Adicionar colunas em `attendance_blocks` para armazenar as specs de OS:

```sql
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS
  pipeline_status   VARCHAR(20) DEFAULT 'ATENDIMENTO',
  -- ATENDIMENTO | PROPOSTA | PEDIDO | OS | ENTREGA

  -- specs de fabricação (preenchidas quando bloco vira OS)
  product_name      VARCHAR(200),
  priority          VARCHAR(20) DEFAULT 'normal',
  due_date          DATE,
  metal             VARCHAR(50),
  stone             VARCHAR(100),
  ring_size         VARCHAR(10),
  weight_grams      DECIMAL(6,2),
  finish            VARCHAR(50),
  engraving         VARCHAR(100),
  prong_count       INTEGER,
  band_thickness    DECIMAL(4,2),
  tech_notes        TEXT,
  designer_id       UUID REFERENCES users(id),
  jeweler_id        UUID REFERENCES users(id),
  deposit_cents     INTEGER DEFAULT 0,
  total_cents       INTEGER DEFAULT 0,
  so_number         VARCHAR(30) UNIQUE,
  -- gerado automaticamente ao avançar para OS: SO-YYYYMMDD-XXXX
  so_approved_at    TIMESTAMPTZ,
  ai_render_id      UUID;
```

**Regra:** `service_orders` existente passa a ser apenas uma VIEW ou tabela de leitura para a aba OS. Os dados primários vivem em `attendance_blocks`.

---

## MUDANÇA 3 — Aba Atendimento: filtro de exibição

A aba Atendimento exibe SOMENTE blocos com:
```typescript
pipeline_status IN ('ATENDIMENTO', 'PROPOSTA')
// ou seja: blocos que ainda não viraram OS aprovada
```

Blocos com `pipeline_status IN ('OS', 'ENTREGA')` NÃO aparecem na aba Atendimento.

```typescript
// GET /api/v1/customers/:id/blocks?pipeline_status=ATENDIMENTO,PROPOSTA
```

---

## MUDANÇA 4 — Aba OS: somente leitura de OS aprovadas

A aba OS:
- **NÃO tem botão "Nova OS"**
- Exibe SOMENTE blocos com `pipeline_status = 'OS'`
- É a visão do fabricante — role PRODUCAO e DESIGNER_3D
- Cada card exibe as specs de fabricação do bloco

```typescript
// GET /api/v1/customers/:id/blocks?pipeline_status=OS
```

Card de OS na aba:
```
┌── SO-20260314-0001 ─── [badge: Em fabricação] ─────────────┐
│  Nome: Anel Solitário Ouro 18k                              │
│  Metal: Ouro 18k Amarelo  |  Pedra: Brilhante 0.25ct        │
│  Tamanho: 17  |  Espessura: 2.0mm  |  Garras: 4             │
│  Designer: Carlos Mendes  |  Ourives: Pedro Gomes            │
│  Prazo: 30/04/2026  |  Total: R$ 3.200                      │
│                                                             │
│  [Atualizar etapa] [Foto progresso] [Avisar cliente]        │
└─────────────────────────────────────────────────────────────┘
```

---

## MUDANÇA 5 — Progressão de status (mini state machine)

Quando o atendente salva o bloco com um novo status, o sistema deve:

**ATENDIMENTO → PROPOSTA:**
- Apenas salvar o novo status
- Nenhuma ação automática

**PROPOSTA → PEDIDO:**
- Apenas salvar o novo status
- Bloco some da aba Atendimento ao ser recarregada

**PEDIDO → OS:**
- Validar que `product_name` está preenchido
- Se não: retornar erro 422 "Preencha o nome do produto antes de avançar para OS"
- Gerar `so_number = SO-YYYYMMDD-XXXX` (sequencial por dia)
- Salvar `so_approved_at = NOW()`
- Bloco aparece na aba OS
- Notificação in-app para usuários com role PRODUCAO e DESIGNER_3D

**OS → ENTREGA:**
- Apenas salvar o novo status
- Criar registro em `deliveries` vinculado a este bloco

```typescript
// Função helper para gerar so_number
async function generateSONumber(db) {
  const today = format(new Date(), 'yyyyMMdd')
  const prefix = `SO-${today}-`
  const last = await db.query(
    `SELECT so_number FROM attendance_blocks WHERE so_number LIKE $1 ORDER BY so_number DESC LIMIT 1`,
    [`${prefix}%`]
  )
  const next = last.rows[0] ? parseInt(last.rows[0].so_number.split('-')[3]) + 1 : 1
  return `${prefix}${String(next).padStart(4, '0')}`
}
```

---

## MUDANÇA 6 — Badge visual nos blocos da lista

Cada bloco na lista de atendimentos deve mostrar o badge de status-pipeline:

```tsx
<span className={`pipeline-badge status-${block.pipeline_status.toLowerCase()}`}>
  {pipelineLabel[block.pipeline_status]}
</span>

// pipelineLabel:
const pipelineLabel = {
  ATENDIMENTO: 'Atendimento',
  PROPOSTA:    'Proposta',
  PEDIDO:      'Pedido',
  OS:          'OS',
  ENTREGA:     'Entrega',
}
```

---

## MUDANÇA 7 — API: atualizar endpoints

### `POST /api/v1/customers/:id/blocks`
Aceitar todos os novos campos (specs de fabricação + pipeline_status).
Se `pipeline_status = 'OS'`: executar lógica de geração do `so_number`.

### `PATCH /api/v1/blocks/:id`
Aceitar todos os novos campos.
Se `pipeline_status` mudou para 'OS' e `so_number` ainda não existe: gerar `so_number`.

### `GET /api/v1/customers/:id/blocks`
Aceitar query param `pipeline_status` (comma-separated).
```
?pipeline_status=ATENDIMENTO,PROPOSTA   → aba Atendimento
?pipeline_status=OS                     → aba OS
```

---

## MUDANÇA 8 — Seção "Especificações de Fabricação" no popup

Esta seção começa **colapsada** por padrão.
Expandir ao clicar no título ou ao selecionar status "OS" no select de pipeline.

```typescript
// Auto-expandir specs quando status muda para OS
useEffect(() => {
  if (pipelineStatus === 'OS') setSpecsExpanded(true)
}, [pipelineStatus])
```

---

## Definition of Done

- [ ] Migration `attendance_blocks` com colunas novas aplicada
- [ ] Botão "+ Novo Bloco" renomeado para "+ Ordem de Serviço"
- [ ] Popup unificado: nota + specs de fabricação + IA 3D em uma tela só
- [ ] 1ª caixa do header: tipo do atendimento
- [ ] 2ª caixa do header: status-pipeline (mini kanban) com cores por status
- [ ] Seção de specs colapsável, auto-expande ao selecionar "OS"
- [ ] Aba Atendimento filtra pipeline_status = ATENDIMENTO, PROPOSTA
- [ ] Aba OS filtra pipeline_status = OS, sem botão de criar
- [ ] Badge colorido de status em cada bloco da lista
- [ ] Progressão PEDIDO→OS: gera so_number + notifica equipe de fabricação
- [ ] Progressão OS→ENTREGA: cria registro em deliveries
- [ ] Validação: nome do produto obrigatório ao avançar para OS
- [ ] API aceita filtro pipeline_status (comma-separated)
- [ ] `tsc --noEmit` limpo
