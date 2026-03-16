# TASK-05 — Aba Atendimento + Popup + IA 3D

**Depende de:** TASK-03
**Componentes:**
```
components/tabs/ClientAtendimentoTab.tsx
components/attendance/AttendanceBlock.tsx
components/attendance/AttendancePopup.tsx
components/attendance/AI3DSection.tsx
components/attendance/AI3DResult.tsx
```
**Referência:** mockup → aba "💬 Atendimento" + popup + seção IA 3D

---

## 5.1 Tab Atendimento

```
Header: "Atendimento" (Playfair 16px) + [+ Novo bloco] (botão gold)
Botão dashed: "+ Adicionar bloco de atendimento" → openPopup()
Lista de AttendanceBlocks (GET /api/v1/customers/:id/blocks)
Loading: 3 skeleton cards
Empty: "Nenhum atendimento registrado" + botão
```

---

## 5.2 `AttendanceBlock.tsx`

```
Props: block: AttendanceBlock, onEdit, onDelete

Visual por status:
  open   → ícone bg gold-dim, border gold | badge "Em andamento" amber
  done   → ícone bg green-dim | badge "Concluído" verde
  ai     → ícone bg purple-dim | badge "IA" roxo
  design → ícone bg teal-dim | badge "Designer 3D" teal

Estrutura do card:
  ┌─ HEADER: [ícone] [título] [meta: autor·data·canal] [status badge] ─┐
  │  BODY:                                                              │
  │    - Conteúdo HTML (dangerouslySetInnerHTML com sanitize)           │
  │    - Grid de thumbnails de fotos (se attachments.length > 0)       │
  │    - AI3DResult inline (se block.has_3d && ai_render_id)           │
  └─ FOOTER: [Editar][Anexar][Enviar 3D][⚙ Criar OS] [data right]    ─┘

"Editar" → abre popup pré-preenchido com dados do bloco
"Criar OS c/ specs" → abre modal OS com specs do render vinculado
```

---

## 5.3 `AttendancePopup.tsx`

**Trigger:** botão "+ Novo bloco" ou "Editar" em bloco existente
**Tipo:** overlay (position fixed, z-index 100) + modal 680px max-width
**Fechar:** botão ✕, ESC, click no overlay

```typescript
interface AttendancePopupProps {
  customerId: string
  block?: AttendanceBlock  // se edição
  onSave: (block: AttendanceBlock) => void
  onClose: () => void
}
```

### 5.3.1 Estrutura do popup

```
┌─ HEADER ────────────────────────────────────────────────────────┐
│  [select tipo] [input título] [✕]                               │
├─ TOOLBAR ───────────────────────────────────────────────────────┤
│  [B][I][U] | [☰][①][☑] | [🔗][@] | [🎙️ Gravar][📷 Foto] | [select prio] │
├─ NOTA (contenteditable) ────────────────────────────────────────┤
│  min-height 120px | placeholder "Descreva o atendimento..."     │
│  contenteditable com toolbar de formatação                      │
├─ FOTOS DE REFERÊNCIA ────────────────────────────────────────────┤
│  Label "Fotos de referência"                                    │
│  Row: [thumb][thumb][+ Adicionar]                               │
├─ IA 3D STRIP (colapsável) ──────────────────────────────────────┤
│  [ícone IA] [label+desc] [botão ✨ Gerar / ▲ Fechar]            │
│  ── EXPANDIDO: parâmetros + btn gerar + AI3DResult ──           │
└─ FOOTER ────────────────────────────────────────────────────────┘
│  "Maria Fernanda · {atendente} · agora"  [Cancelar] [Salvar]   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3.2 Toolbar do editor

```typescript
// Rich text via contenteditable
// Botões: execCommand('bold'), execCommand('italic'), execCommand('underline')
// Lista: execCommand('insertUnorderedList'), execCommand('insertOrderedList')
// Gravar voz: Web Speech API (SpeechRecognition) — transcrever para nota
//   btn toggle: "🎙️ Gravar" → "⏹ Parar" (cor red)
// Foto: <input type="file" accept="image/*"> → POST /api/v1/blocks/:id/attach
//   Preview imediato via FileReader
```

### 5.3.3 Fotos de referência

```typescript
// Thumbnails 66×66px com hover para deletar
// Botão "+ Foto" → input file → FileReader preview → upload POST /blocks/:id/attach
// Máx 5 fotos por bloco
// Formatos: jpg, png, webp
```

### 5.3.4 Salvar bloco

```typescript
// Novo: POST /api/v1/customers/:id/blocks
// Editar: PATCH /api/v1/blocks/:id
// Body: { title, block_type, content (innerHTML), status, priority, channel }
// Sucesso: fechar popup + inserir/atualizar bloco na lista + toast
// Erro: toast de erro, manter popup aberto
```

---

## 5.4 `AI3DSection.tsx` (dentro do popup, colapsável)

### 5.4.1 Estado colapsado

```
[ícone 🤖 purple] "Gerar modelo 3D com IA"
                   "Usa este bloco + fotos · ajuste manual · vai para OS"
[botão "✨ Gerar"]
```

### 5.4.2 Estado expandido

```
Hint: "🧠 A IA lê: tudo que você escreveu acima + as fotos. Confirme os parâmetros."

Parâmetros (grid 3 colunas):
  Tipo de peça (select)    | Metal (select)           | Pedra central (select)
  Aro (select)             | Acabamento (select)      | Tamanho aro (input)
  Detalhes adicionais (full width — pre-populate da nota)

[botão "✨ Gerar modelo 3D" — gradient purple]
```

### 5.4.3 Lógica de geração

```typescript
// 1. Coletar parâmetros do form + conteúdo da nota
// 2. POST /api/v1/blocks/:block_id/render
// 3. Mostrar loading: "Gerando modelo..." spinner
// 4. Polling GET /api/v1/renders/:id a cada 2s até status = 'generated'
// 5. Exibir AI3DResult
```

---

## 5.5 `AI3DResult.tsx`

```typescript
interface AI3DResultProps {
  render: AIRender
  onApprove: () => void  // → criar OS
  onRegenerate: () => void
}
```

```
┌─ HEADER: 💍 "Anel Solitário Ouro 18k — 3 vistas" [✓ Gerado] [4s] ─┐
├─ 3 VIEWS (grid 3 colunas, 120px height cada) ───────────────────────┤
│  [Frontal] [Superior] [Lateral]                                     │
│  Clicar → selecionar (borda gold + check verde)                     │
├─ AJUSTE MANUAL ─────────────────────────────────────────────────────┤
│  Título "⚙️ Ajuste manual — sem software 3D" (amber)                │
│  Grid 2: espessura aro | altura cravação | nº garras | perfil aro   │
│  [🔄 Atualizar modelo] → PATCH /renders/:id/adjust → novo polling   │
├─ AVISO ─────────────────────────────────────────────────────────────┤
│  "⚠️ Este é um esboço de aprovação. Ao criar OS vai para Designer 3D│
│   para modelagem técnica antes da fabricação."                      │
├─ ACTIONS ───────────────────────────────────────────────────────────┤
│  [💬 WhatsApp] [📄 PDF] [🔄 Regerar] [✓ Aprovado → Criar OS] →     │
└─────────────────────────────────────────────────────────────────────┘
```

**"✓ Aprovado → Criar OS com specs":**
```typescript
// 1. PATCH /renders/:id/approve
// 2. Fechar popup
// 3. Navegar para aba OS
// 4. Abrir modal de criação de OS com specs pré-preenchidas do render
```

**3D Views (CSS simulado — igual ao mockup):**
```css
/* Anel animado puro CSS como no mockup */
/* 3 variantes: frontal (animation rotateY), top (perspective rotateX), side (rotateY 60deg) */
/* Não usar biblioteca 3D — manter CSS puro por ora */
/* Gem: clip-path polygon radial-gradient */
```

---

## DoD
- [ ] Lista de blocos carrega da API
- [ ] "+" abre popup vazio
- [ ] "Editar" abre popup pré-preenchido
- [ ] Toolbar: bold/italic/underline funcionam
- [ ] Gravação de voz transcreve para nota
- [ ] Upload de foto: preview + upload para API
- [ ] Salvar cria/atualiza bloco
- [ ] IA 3D: parâmetros pré-populados da nota
- [ ] Geração: loading → polling → exibe resultado
- [ ] Ajuste manual: atualiza modelo
- [ ] "Aprovado → Criar OS": navega para aba OS com modal aberto
- [ ] ESC fecha popup
- [ ] `tsc --noEmit` limpo
