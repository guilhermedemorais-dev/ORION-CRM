# ORION CRM — Guia de Construção para IA

> Este documento define EXATAMENTE como cada tela deve ser construída.
> Sem isso, a IA entrega componentes genéricos.
> Com isso, a IA entrega o ORION.
>
> Leia este documento COMPLETO antes de escrever qualquer linha de código.
> Cada módulo tem: visual esperado + componentes shadcn/ui a usar + referência de código validada.

---

## PARTE 1 — DESIGN SYSTEM

### 1.1 Paleta de Cores

```typescript
// tailwind.config.ts — copiar exatamente
export default {
  theme: {
    extend: {
      colors: {
        // Identidade ORION
        brand: {
          gold:        '#C8A97A',  // dourado principal — CTAs, badges, acentos
          'gold-light':'#E8D5B0',  // hover states, borders sutis
          'gold-dark': '#A8895A',  // pressed states
        },
        // Sidebar e surfaces escuros
        surface: {
          sidebar:     '#0F0F0F',  // sidebar background
          card:        '#1A1A1A',  // cards dentro da sidebar
          overlay:     '#141414',  // modais sobre dark
        },
        // Área de conteúdo principal (clara)
        canvas: {
          DEFAULT:     '#F8F7F5',  // fundo do content area
          card:        '#FFFFFF',  // cards de conteúdo
          border:      '#E8E5E0',  // bordas sutis
        },
        // Status — sistema de cores semânticas
        status: {
          novo:        '#F59E0B',  // amarelo — lead novo
          qualificado: '#3B82F6',  // azul
          proposta:    '#8B5CF6',  // roxo
          negociacao:  '#EC4899',  // rosa
          convertido:  '#10B981',  // verde
          perdido:     '#6B7280',  // cinza
          // Pedidos
          rascunho:    '#9CA3AF',
          aguard_pag:  '#F59E0B',
          pago:        '#10B981',
          producao:    '#3B82F6',
          enviado:     '#8B5CF6',
          cancelado:   '#EF4444',
        }
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm:      '4px',
        md:      '8px',
        lg:      '12px',
        xl:      '16px',
      },
      boxShadow: {
        card:   '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        gold:   '0 0 0 2px rgba(200,169,122,0.3)',
      }
    }
  }
}
```

### 1.2 Layout Shell — Estrutura Raiz do CRM

```
┌─────────────────────────────────────────────────────────┐
│                    ORION CRM Shell                       │
├──────────┬──────────────────────────────────────────────┤
│          │  Topbar (h-14, border-b, bg-white)           │
│          │  [Breadcrumb]          [Search] [Notif] [Avatar]│
│ Sidebar  ├──────────────────────────────────────────────┤
│ w-64     │                                              │
│ bg-      │         Content Area                         │
│ surface- │         bg-canvas                            │
│ sidebar  │         p-6                                  │
│          │         max-w-none                           │
│ (fixed)  │         (scroll aqui, não na sidebar)        │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Arquivo**: `components/layout/AppShell.tsx`
```tsx
// Estrutura base — não simplificar
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar />                          {/* fixed, w-64 */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        <Topbar />                         {/* h-14, sticky top-0 */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### 1.3 Sidebar

**Visual**: fundo `#0F0F0F`, logo ORION no topo com nome da joalheria em serif dourado, nav items com hover dourado sutil, seção de usuário no rodapé.

```tsx
// components/layout/Sidebar.tsx
// Grupos de navegação com separadores

const NAV_GROUPS = [
  {
    label: null,  // sem label — itens principais
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: Users,           label: 'Leads',     href: '/leads',     badge: 'leads_novos' },
      { icon: MessageCircle,   label: 'Inbox',     href: '/inbox',     badge: 'nao_lidas' },
      { icon: UserCheck,       label: 'Clientes',  href: '/clientes' },
    ]
  },
  {
    label: 'Operação',
    items: [
      { icon: ShoppingBag,  label: 'Pedidos',   href: '/pedidos' },
      { icon: Gem,          label: 'Produção',  href: '/producao' },
      { icon: Package,      label: 'Estoque',   href: '/estoque' },
      { icon: DollarSign,   label: 'Financeiro',href: '/financeiro' },
      { icon: Monitor,      label: 'PDV',       href: '/pdv' },
    ]
  },
  {
    label: 'Sistema',
    items: [
      { icon: Zap,          label: 'Automações',href: '/automacoes' },
      { icon: BarChart3,    label: 'Analytics', href: '/analytics' },
      { icon: Settings,     label: 'Ajustes',   href: '/ajustes' },
    ]
  }
]

// Item ativo: bg-brand-gold/10, text-brand-gold, borda esquerda 2px brand-gold
// Item hover: bg-white/5, text-white
// Item inativo: text-gray-400
// Badge: rounded-full bg-brand-gold text-black text-xs px-1.5
```

**Referência validada**: https://github.com/shadcn-ui/ui/blob/main/apps/www/registry/new-york/example/sidebar-08.tsx

### 1.4 Topbar

```tsx
// components/layout/Topbar.tsx
// h-14 bg-white border-b border-canvas-border sticky top-0 z-10
// Conteúdo:
// Left:  <Breadcrumb /> (shadcn Breadcrumb component)
// Right: <GlobalSearch /> | <NotificationBell count={N} /> | <UserMenu />
```

### 1.5 Tipografia — Hierarquia

```tsx
// Usar consistentemente em todo o CRM

// Page title (h1)
<h1 className="font-serif text-2xl font-semibold text-gray-900">Leads</h1>

// Section title (h2)
<h2 className="text-base font-semibold text-gray-900">Pipeline</h2>

// Card title
<h3 className="text-sm font-semibold text-gray-900">Mariana Silva</h3>

// Label de campo
<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">WhatsApp</p>

// Valor de campo
<p className="text-sm text-gray-900">+55 11 99999-9999</p>

// Texto secundário / muted
<p className="text-xs text-gray-500">há 2 horas</p>
```

### 1.6 Componentes Base — O que usar de shadcn/ui

Instalar via `npx shadcn@latest add [componente]`:

| Componente shadcn | Usar em |
|-------------------|---------|
| `button` | Todos os CTAs |
| `badge` | Status de lead, pedido, produção |
| `card` | Cards de KPI, cards de lead |
| `dialog` | Modais de criação/edição |
| `drawer` | Painel lateral de detalhes (mobile-friendly) |
| `dropdown-menu` | Menus de ação (⋯ nos cards) |
| `form` + `input` + `label` | Todos os formulários |
| `select` | Seletores de status, categoria |
| `textarea` | Campos de notas, mensagem |
| `avatar` | Foto de usuário |
| `separator` | Divisores de seção |
| `skeleton` | Loading states |
| `toast` | Feedback de ação (react-hot-toast como alternativa) |
| `table` | Listagens tabulares (financeiro, estoque) |
| `tabs` | Múltiplas views (perfil de cliente) |
| `popover` | Tooltips, date picker |
| `calendar` | Seleção de datas (pedidos, produção) |
| `command` | Search global + filtros |
| `sheet` | Painel lateral de detalhes (desktop) |
| `progress` | Progresso de produção |
| `scroll-area` | Inbox, histórico de mensagens |
| `sidebar` | Shell principal (shadcn sidebar component) |

**NÃO instalar**: componentes de terceiros como react-beautiful-dnd, fullcalendar, chart.js direto — ver seção de cada módulo para alternativas corretas.

### 1.7 Sistema de Status — Badges

```tsx
// components/ui/StatusBadge.tsx
// Usar em TODOS os módulos — nunca criar badge ad-hoc

const STATUS_CONFIG = {
  // Leads
  NOVO:             { label: 'Novo',          color: 'bg-amber-100 text-amber-800 border-amber-200' },
  QUALIFICADO:      { label: 'Qualificado',   color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PROPOSTA_ENVIADA: { label: 'Proposta',      color: 'bg-purple-100 text-purple-800 border-purple-200' },
  NEGOCIACAO:       { label: 'Negociação',    color: 'bg-pink-100 text-pink-800 border-pink-200' },
  CONVERTIDO:       { label: 'Convertido',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PERDIDO:          { label: 'Perdido',       color: 'bg-gray-100 text-gray-600 border-gray-200' },
  // Pedidos
  RASCUNHO:         { label: 'Rascunho',      color: 'bg-gray-100 text-gray-600 border-gray-200' },
  AGUARD_PAGAMENTO: { label: 'Aguard. Pag.',  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  PAGO:             { label: 'Pago',          color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  EM_PRODUCAO:      { label: 'Em Produção',   color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PRONTO:           { label: 'Pronto',        color: 'bg-purple-100 text-purple-800 border-purple-200' },
  ENVIADO:          { label: 'Enviado',       color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  CANCELADO:        { label: 'Cancelado',     color: 'bg-red-100 text-red-800 border-red-200' },
  // Conversa
  BOT:              { label: 'Bot',           color: 'bg-violet-100 text-violet-800 border-violet-200' },
  AGUARD_HUMANO:    { label: 'Aguardando',    color: 'bg-amber-100 text-amber-800 border-amber-200' },
  EM_ATENDIMENTO:   { label: 'Em Atend.',     color: 'bg-blue-100 text-blue-800 border-blue-200' },
  ENCERRADA:        { label: 'Encerrada',     color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  )
}
```

### 1.8 KPI Cards — Dashboard

```tsx
// components/ui/KpiCard.tsx — padrão para todos os dashboards
interface KpiCardProps {
  title: string
  value: string | number
  change?: { value: number; positive: boolean }  // ex: +12% vs ontem
  icon: LucideIcon
  iconColor?: string
  loading?: boolean
}

// Visual: bg-white rounded-lg border border-canvas-border p-5
// Ícone: bg-brand-gold/10 rounded-md p-2 text-brand-gold
// Valor: text-2xl font-semibold font-serif
// Change: text-xs com seta verde/vermelha
```

---

## PARTE 2 — MAPA DE TELAS POR MÓDULO

### MÓDULO 1: DASHBOARD

**Rota**: `/dashboard`
**Roles**: ADMIN (dados completos), ATENDENTE (apenas seus dados)

#### Layout da Tela

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                          [Período: Este mês ▾]│
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Leads    │ │ Inbox    │ │ Pedidos  │ │Faturament│  │
│  │ Hoje: 12 │ │ 3 novos  │ │ 8 abertos│ │ R$12.400 │  │
│  │ +3 ↑     │ │          │ │          │ │  este mês│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐ ┌───────────────────────┐ │
│  │ Atividade Recente        │ │ Alertas               │ │
│  │ (feed de eventos)        │ │ • 2 pedidos atrasados │ │
│  │ • Mariana → QUALIFICADO  │ │ • 3 estoques baixos   │ │
│  │ • Pedido #023 PAGO       │ │ • 1 prod. vencendo    │ │
│  │ • Lead novo: Ana Paula   │ │                       │ │
│  └──────────────────────────┘ └───────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │ Leads por Stage (mini kanban — só leitura)       │   │
│  │ [NOVO: 8] [QUALIFICADO: 5] [PROPOSTA: 3] [...]   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Componentes**:
- 4x `KpiCard` — leads, inbox não lidas, pedidos abertos, faturamento
- `ActivityFeed` — lista de eventos recentes com ícone e timestamp relativo
- `AlertsPanel` — lista de alertas críticos com link para ação
- Mini pipeline — `Tabs` + contadores por stage

**API Endpoints necessários**:
- `GET /api/v1/dashboard/stats` — todos os KPIs em uma chamada
- `GET /api/v1/dashboard/activity?limit=10` — feed de atividade
- `GET /api/v1/dashboard/alerts` — alertas ativos

---

### MÓDULO 2: LEADS + PIPELINE

**Rota**: `/leads`
**Roles**: ADMIN (todos), ATENDENTE (atribuídos a ele)

#### View 1: Kanban (padrão)

```
┌─────────────────────────────────────────────────────────┐
│  Leads            [+ Novo Lead]    [🔍 Buscar] [Filtros]│
│                   [Kanban | Lista]                       │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│ NOVO (8) │QUALIF(5) │PROPOSTA  │NEGOC.(2) │CONV.(12)   │
│          │          │(3)       │          │            │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │            │
│ │👤 Ana│ │ │👤 Bia│ │ │👤 Car│ │ │👤 Dan│ │ [ver hist] │
│ │anel  │ │ │colar │ │ │pulseira│ │ │anel │ │            │
│ │2h    │ │ │1d    │ │ │3d    │ │ │5d   │ │            │
│ │[⋯]  │ │ │[⋯]  │ │ │[⋯]  │ │ │[⋯] │ │            │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │            │
│ ┌──────┐ │          │          │          │            │
│ │👤 Eva│ │          │          │          │            │
│ │...   │ │          │          │          │            │
│ └──────┘ │          │          │          │            │
└──────────┴──────────┴──────────┴──────────┴────────────┘
```

**Biblioteca para o Kanban**: `@dnd-kit/core` + `@dnd-kit/sortable`
- NÃO usar `react-beautiful-dnd` (deprecated)
- NÃO usar `react-dnd` (complexo demais)
- Referência validada: https://github.com/clauderic/dnd-kit/tree/master/stories/2%20-%20Presets/Sortable

**Card de Lead no Kanban**:
```tsx
// Largura: 240px fixo por coluna
// Altura: auto, min 80px
// Estrutura interna:
// [Avatar inicial] [Nome] [Interesse] [Tempo desde última interação]
// [badge status] [avatar atendente]
// Hover: shadow-card-hover, cursor: grab
// Drag: opacity-50, scale-105, shadow-xl
```

#### View 2: Lista (alternativa)

```
Tabela com colunas: Nome | WhatsApp | Interesse | Stage | Atendente | Última interação | Ações
```

Usar `DataTable` do shadcn/ui com:
- Referência: https://ui.shadcn.com/docs/components/data-table
- Sorting por coluna
- Filtro global
- Paginação (20 por página)

#### Painel Lateral de Lead (Sheet)

Ao clicar em qualquer lead → abre `Sheet` pela direita (não modal, não página nova)

```
┌──────────────────────────────────┐
│ [←] Mariana Silva         [⋯]   │
│ +55 11 99999-9999                │
│ [StatusBadge: QUALIFICADO]       │
│ Atendente: João                  │
├──────────────────────────────────┤
│ [Converter em Cliente] [Criar Pedido] │
├──────────────────────────────────┤
│ Tabs: [Detalhes] [Histórico WA] [Pedidos] │
├──────────────────────────────────┤
│ (conteúdo da tab selecionada)    │
└──────────────────────────────────┘
```

---

### MÓDULO 3: INBOX WHATSAPP

**Rota**: `/inbox`
**Roles**: ADMIN (todas), ATENDENTE (atribuídas a ele)

#### Layout Split-Pane (estilo WhatsApp Web)

```
┌──────────────────┬──────────────────────────────────────┐
│ Conversas (left) │ Conversa Ativa (right)               │
│ w-80 border-r    │ flex-1                               │
│                  │                                      │
│ [🔍 Buscar]      │ ┌────────────────────────────────┐  │
│ [Filtro: status] │ │ Topbar da conversa             │  │
│                  │ │ [Avatar] Mariana Silva          │  │
│ ┌──────────────┐ │ │ [StatusBadge] [Assumir] [⋯]   │  │
│ │ 🟡 Ana P.    │ │ └────────────────────────────────┘  │
│ │ Bot • 2h     │ │                                      │
│ │ Olá, vim...  │ │ ┌────────────────────────────────┐  │
│ └──────────────┘ │ │ Área de mensagens (ScrollArea) │  │
│ ┌──────────────┐ │ │                                │  │
│ │ 🔵 Bia S.    │ │ │ [msg bot]  Olá! Como posso... │  │
│ │ Em atend.    │ │ │            [msg cliente] Quero │  │
│ │ Interesse... │ │ │            ver anéis           │  │
│ └──────────────┘ │ │ [msg atend] Claro! Segue...   │  │
│                  │ └────────────────────────────────┘  │
│                  │ ┌────────────────────────────────┐  │
│                  │ │ [📎] [Digitar mensagem...] [➤] │  │
│                  │ └────────────────────────────────┘  │
└──────────────────┴──────────────────────────────────────┘
```

**Componentes críticos**:

```tsx
// Polling para novas mensagens (sem WebSocket na Fase 0)
// useQuery com refetchInterval: 3000 (3 segundos)
// Quando nova mensagem chega: toast discreto + scroll para o final

// ScrollArea: usar shadcn ScrollArea
// Ao abrir conversa: scrollar para o bottom automaticamente
// useEffect([messages]) → ref.scrollIntoView({ behavior: 'smooth' })

// Bolhas de mensagem:
// INBOUND (cliente): alinhado à esquerda, bg-gray-100, rounded-tr-xl rounded-br-xl rounded-tl-xl
// OUTBOUND humano: alinhado à direita, bg-brand-gold text-white, rounded-tl-xl rounded-bl-xl rounded-tr-xl
// OUTBOUND bot: alinhado à direita, bg-violet-100 text-violet-900, borda tracejada

// Timestamp: text-xs text-gray-400 abaixo da bolha
// Avatar do remetente: só no primeiro de um grupo consecutivo
```

**Referência de UI de chat**: https://github.com/jakearchibald/svgomg — não o projeto, mas o padrão de layout split que funciona em todos os breakpoints.

**Atualização em tempo real**: usar `react-query` (`@tanstack/react-query`) com `refetchInterval`. WebSocket pode ser adicionado na Fase 1.1 sem reescrever nada.

---

### MÓDULO 4: CLIENTES

**Rota**: `/clientes`

#### Lista de Clientes

Igual ao módulo de Leads mas com `DataTable` + coluna "Lifetime Value" formatada em R$.

#### Perfil do Cliente (página dedicada)

**Rota**: `/clientes/[id]`

```
┌─────────────────────────────────────────────────────────┐
│ ← Clientes  /  Mariana Silva                            │
├───────────────────────┬─────────────────────────────────┤
│ LEFT (w-80)           │ RIGHT (flex-1)                  │
│                       │                                 │
│ [Avatar grande]       │ Tabs:                           │
│ Mariana Silva         │ [Pedidos] [Histórico WA]        │
│ +55 11 99999-9999     │ [Financeiro] [Notas]            │
│ cliente desde Jan/24  │                                 │
│                       │ (conteúdo da tab)               │
│ Lifetime Value:       │                                 │
│ R$ 4.800              │                                 │
│                       │                                 │
│ Atendente: João       │                                 │
│                       │                                 │
│ [Editar] [Criar Pedido│                                 │
│ ] [Enviar WA]         │                                 │
└───────────────────────┴─────────────────────────────────┘
```

---

### MÓDULO 5: PEDIDOS

**Rota**: `/pedidos`

#### Lista com Filtros

```
Filtros rápidos (pills):  [Todos] [Aguard. Pag.] [Em Produção] [Prontos]
DataTable: Nº | Cliente | Tipo | Valor | Status | Atendente | Data | Ações
```

#### Criação de Pedido (Dialog em 2 steps)

```
Step 1: Tipo de pedido
  ┌─────────────────┐  ┌──────────────────┐
  │ 🛍️ Pronta       │  │ 💍 Personalizado  │
  │ Entrega         │  │                  │
  │ Selecionar do   │  │ Descrever a peça │
  │ estoque         │  │ com referências  │
  └─────────────────┘  └──────────────────┘

Step 2 (Pronta Entrega):
  [Buscar produto por nome/código]
  [Lista de resultados com estoque disponível]
  [Quantidade] [Desconto] [Forma de pagamento]
  [Gerar Link MP] ou [Registrar pagamento manual]

Step 2 (Personalizado):
  [Descrição da peça] (textarea obrigatório)
  [Upload de imagens de referência] (múltiplas)
  [Material: ouro 18k / prata / etc]
  [Prazo estimado] (date picker)
  [Valor estimado]
```

**Upload de imagens**: usar `react-dropzone` + preview com `URL.createObjectURL()`
- Referência: https://react-dropzone.js.org/
- Armazenar em `/uploads/pedidos/{order_id}/` no servidor

---

### MÓDULO 6: PRODUÇÃO

**Rota**: `/producao`

#### View Principal — Cards por Ordem

```
┌─────────────────────────────────────────────────────────┐
│ Produção                    [Filtrar por ourives ▾]     │
├─────────────────────────────────────────────────────────┤
│ ⚠️ Atrasados (2)                                        │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Pedido #023 · Ana Paula                  ATRASADO  │  │
│ │ Anel solitário ouro 18k                            │  │
│ │ Ourives: João  │  Etapa: POLIMENTO                 │  │
│ │ [████████░░] 80%  Prazo: 2 dias atrás ⚠️          │  │
│ │ [Ver Detalhes]                                     │  │
│ └────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│ Em andamento (5)                                        │
│ [cards normais]                                         │
└─────────────────────────────────────────────────────────┘
```

**Progress bar**: usar `Progress` do shadcn/ui
Percentual calculado: `(etapa_atual_index / total_etapas) * 100`

#### Detalhe da Ordem de Produção (Sheet)

```
Etapas (timeline vertical):
  ✅ SOLDA        — João — 12/02 14:30 — [ver foto]
  ✅ MODELAGEM    — João — 13/02 09:15 — [ver foto]
  🔄 POLIMENTO    — João — em andamento
  ○  CRAVAÇÃO
  ○  CONTROLE DE QUALIDADE

[Avançar Etapa] → abre dialog com:
  - Campo: "Observações" (opcional)
  - Upload: "Foto de evidência" (opcional)
  - Botão: "Confirmar"
```

---

### MÓDULO 7: ESTOQUE

**Rota**: `/estoque`

#### Lista de Produtos

```
[+ Cadastrar Produto]  [🔍 Buscar]  [Filtro: categoria ▾]  [⚠️ Alertas de estoque]

DataTable:
Foto | Código | Nome | Categoria | Material | Preço | Estoque | Estoque Mín. | Ações
```

Linhas com `estoque <= estoque_mínimo`: fundo vermelho sutil `bg-red-50`

#### Cadastro de Produto (Dialog)

```
[Upload de fotos] (múltiplas, drag-and-drop)
[Código] [Nome]
[Categoria] [Material] [Peso (g)]
[Preço (R$)] ← formatar como moeda: react-currency-input-field
[Estoque inicial] [Estoque mínimo]
[Descrição]
```

**Biblioteca para input de moeda**: `react-currency-input-field`
- Instalação: `npm i react-currency-input-field`
- Config: prefix="R$ ", decimalsLimit=2, decimalSeparator=","
- Referência: https://github.com/cchanxzy/react-currency-input-field

---

### MÓDULO 8: FINANCEIRO

**Rota**: `/financeiro`

#### Dashboard Financeiro

```
┌─────────────────────────────────────────────────────────┐
│ Financeiro                    [Mês: Fevereiro 2026 ▾]  │
├──────────────┬──────────────┬──────────────────────────┤
│ Entradas     │ Saídas       │ Saldo                    │
│ R$ 28.400    │ R$ 8.200     │ R$ 20.200                │
│ +12% ↑       │ -3% ↓        │                          │
├──────────────┴──────────────┴──────────────────────────┤
│ Gráfico de barras (entradas vs saídas por semana)       │
│                                                         │
│ Lib: recharts — BarChart + ResponsiveContainer          │
│ Referência: https://recharts.org/en-US/examples/SimpleBarChart │
├─────────────────────────────────────────────────────────┤
│ Comissões por Atendente         │  Últimas transações   │
│ João: R$ 840 (5% de R$ 16.800) │  [tabela]             │
│ Maria: R$ 560                   │                       │
└─────────────────────────────────────────────────────────┘
```

**Biblioteca de gráfico**: `recharts`
- NÃO usar: Chart.js, D3 direto, ApexCharts
- Instalar: `npm i recharts`
- Componentes: `BarChart`, `LineChart`, `ResponsiveContainer`, `Tooltip`, `Legend`

#### Registro de Despesa (Dialog)

```
[Valor] (currency input)
[Categoria] (select): Material, Aluguel, Marketing, Salário, Outro
[Descrição] (obrigatório)
[Data de competência] (date picker — shadcn Calendar + Popover)
[Comprovante] (upload opcional)
```

---

### MÓDULO 9: PDV — PONTO DE VENDA

**Rota**: `/pdv`

#### Interface do PDV

```
┌───────────────────────────┬─────────────────────────────┐
│ BUSCAR PRODUTO             │ CARRINHO                    │
│                           │                             │
│ [🔍 Código ou nome...    ]│ ┌─────────────────────────┐ │
│                           │ │ Anel Solitário Ouro 18k │ │
│ Resultados:               │ │ 1x  R$ 1.800            │ │
│ ┌───────────────────────┐ │ │                    [-][+]│ │
│ │ [foto] Anel Solitário │ │ └─────────────────────────┘ │
│ │ Ouro 18k   R$ 1.800   │ │                             │
│ │ Estoque: 3            │ │ Subtotal: R$ 1.800          │
│ │ [+ Adicionar]         │ │ Desconto: R$ 0,00           │
│ └───────────────────────┘ │ ──────────────────────────  │
│                           │ TOTAL: R$ 1.800             │
│                           │                             │
│                           │ [Forma de pagamento ▾]      │
│                           │ ○ Dinheiro  ○ PIX           │
│                           │ ○ Débito    ○ Crédito       │
│                           │ ○ Link MP                   │
│                           │                             │
│                           │ [Finalizar Venda]           │
└───────────────────────────┴─────────────────────────────┘
```

**Busca de produto**: debounce 300ms → `GET /api/v1/products?q=texto&inStock=true`
**Atalho de teclado**: `F2` foca no campo de busca (útil no balcão com teclado físico)
**Finalizar venda**: abre dialog de confirmação com cálculo de troco (se Dinheiro)

---

### MÓDULO 10: ANALYTICS

**Rota**: `/analytics`

```
Tabs: [Vendas] [Leads] [Produção] [Atendentes]

Tab Vendas:
  - LineChart: faturamento dos últimos 30 dias (recharts)
  - BarChart: vendas por categoria de produto
  - Tabela: top 10 produtos mais vendidos

Tab Leads:
  - Funil de conversão (barras horizontais por stage)
  - Tempo médio por stage
  - Taxa de conversão por fonte (WhatsApp, Landing, Indicação)

Tab Atendentes:
  - DataTable: nome | leads atribuídos | convertidos | taxa % | comissão
```

---

### MÓDULO 11: AJUSTES (Settings)

**Rota**: `/ajustes`

```
Tabs:
[Empresa] [Usuários] [WhatsApp] [Notificações] [Plano]

Tab Empresa:
  - Upload de logo
  - Nome da empresa, CNPJ, telefone, endereço
  - Cor primária (color picker)
  - Preview em tempo real do branding

Tab Usuários:
  - DataTable de usuários com [Editar] [Ativar/Desativar]
  - [+ Convidar Usuário] → dialog com email + role + comissão

Tab WhatsApp:
  - Status da instância Evolution API (conectado/desconectado)
  - QR Code para reconectar (quando desconectado)
  - Número conectado
  - [Trocar número] (instrução de como escanear o novo QR)

Tab Notificações:
  - Toggle: notificar via WA pessoal para novo lead
  - Toggle: notificar para pedido pago
  - Toggle: notificar para produção atrasada
```

**Color picker**: usar `react-colorful` (4KB, sem dependências)
- Instalação: `npm i react-colorful`
- Referência: https://github.com/omgovich/react-colorful

---

## PARTE 3 — REFERÊNCIAS DE CÓDIGO VALIDADAS

### Para o Agente de IA: copiar e adaptar, não recriar do zero

#### 3.1 DataTable com shadcn
- **URL**: https://ui.shadcn.com/docs/components/data-table
- **Usar em**: Leads (view lista), Clientes, Pedidos, Estoque, Financeiro, Analytics
- **Adaptar**: definir `columns` com as colunas do módulo + passar `data` da API

#### 3.2 Kanban com dnd-kit
- **URL**: https://github.com/clauderic/dnd-kit/tree/master/stories/2%20-%20Presets/Sortable/MultipleContainers.tsx
- **Usar em**: Pipeline de Leads
- **Adaptar**: trocar dados de exemplo pelos leads da API + estilizar cards conforme design system

#### 3.3 Dashboard Layout
- **URL**: https://ui.shadcn.com/blocks (Dashboard block)
- **Usar em**: Dashboard ADMIN e ATENDENTE
- **Adaptar**: trocar KPIs genéricos pelos dados do ORION

#### 3.4 Chat/Inbox Layout
- **URL**: https://github.com/mcnaveen/shadcn-chat
- **Usar em**: Inbox WhatsApp
- **Adaptar**: adicionar polling, bolhas de bot separadas, painel de info lateral

#### 3.5 Form com validação
- **URL**: https://ui.shadcn.com/docs/components/form (usa react-hook-form + zod)
- **Usar em**: TODOS os formulários
- **Padrão de validação**: sempre usar `zod` para schema — nunca validação manual

```tsx
// Padrão obrigatório para todo formulário
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres').max(255),
  whatsapp: z.string().regex(/^\+55\d{10,11}$/, 'Formato inválido'),
  // ...
})

type FormData = z.infer<typeof schema>
```

#### 3.6 Autenticação (JWT + refresh)
- **URL**: https://github.com/alan2207/bulletproof-react/tree/master/src/features/auth
- **Usar em**: implementação do auth flow completo
- **Adaptar**: endpoints para /api/v1/auth/login e /api/v1/auth/refresh

#### 3.7 React Query para data fetching
- **Instalar**: `npm i @tanstack/react-query`
- **URL**: https://tanstack.com/query/latest/docs/framework/react/examples/basic
- **Usar em**: TODOS os fetches de dados — nunca useEffect + fetch manual
- **Padrão**:
```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['leads', filters],
  queryFn: () => api.get('/leads', { params: filters }),
  refetchInterval: module === 'inbox' ? 3000 : false,
})
```

#### 3.8 Evolution API no Node.js
- **URL**: https://doc.evolution-api.com/v2/pt/get-started/introduction
- **Endpoints críticos a implementar**:
```typescript
// services/evolution.service.ts
const EVOLUTION_BASE = process.env.EVOLUTION_URL // http://evolution-api:8080
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY

// Enviar texto
POST ${EVOLUTION_BASE}/message/sendText/${INSTANCE}
// Enviar imagem
POST ${EVOLUTION_BASE}/message/sendMedia/${INSTANCE}
// Configurar webhook
POST ${EVOLUTION_BASE}/webhook/set/${INSTANCE}
// Status da instância
GET  ${EVOLUTION_BASE}/instance/fetchInstances
// QR Code
GET  ${EVOLUTION_BASE}/instance/connect/${INSTANCE}
```

---

## PARTE 4 — SKILL MAP POR MÓDULO

> Para cada módulo, qual skill interna + recurso externo consultar ANTES de construir.
> As skills internas ficam em `/mnt/skills/` — ler o SKILL.md antes de escrever qualquer código do módulo.

### Skills Internas Disponíveis

| Skill | Path | Quando usar no ORION |
|-------|------|----------------------|
| `frontend-design` | `/mnt/skills/public/frontend-design/SKILL.md` | **Obrigatória em TODOS os módulos de UI** — guia para interfaces production-grade que evitam output genérico. Ler antes de qualquer componente. |
| `theme-factory` | `/mnt/skills/examples/theme-factory/SKILL.md` | Design system, paleta de cores, aplicar tema dourado do ORION consistentemente |
| `web-artifacts-builder` | `/mnt/skills/examples/web-artifacts-builder/SKILL.md` | Componentes complexos com múltiplos estados (Kanban, Inbox, Dashboard) |
| `canvas-design` | `/mnt/skills/examples/canvas-design/SKILL.md` | Landing page, elementos visuais de marca, banners |
| `brand-guidelines` | `/mnt/skills/examples/brand-guidelines/SKILL.md` | Garantir que cores, tipografia e espaçamento seguem identidade ORION |
| `doc-coauthoring` | `/mnt/skills/examples/doc-coauthoring/SKILL.md` | Gerar documentação técnica de cada módulo entregue |

### Instrução para o Agente de IA

```
ANTES de construir qualquer módulo de UI:
1. Ler /mnt/skills/public/frontend-design/SKILL.md
2. Ler /mnt/skills/examples/theme-factory/SKILL.md
3. Consultar a tabela abaixo para skills adicionais do módulo específico
4. Consultar a referência de componentes em https://www.shadcn-vue.com/
   (mesma API do shadcn/ui React — usar como referência de padrões de componente,
   especialmente: https://www.shadcn-vue.com/docs/components)
```

> **Por que shadcn-vue como referência mesmo usando React?**
> A API é idêntica — mesma estrutura de props, mesma lógica de composição.
> O site tem exemplos visuais excelentes e documentação de cada variante.
> Use para inspecionar o comportamento esperado de cada componente antes de implementar.

### Mapa por Módulo

| Módulo | Skills Internas | Referências Externas |
|--------|-----------------|----------------------|
| **Fundação (Auth, RBAC, API)** | — (backend puro) | https://github.com/alan2207/bulletproof-react |
| **Design System + Tailwind** | `frontend-design` + `theme-factory` + `brand-guidelines` | https://www.shadcn-vue.com/docs/theming |
| **AppShell (Sidebar + Topbar)** | `frontend-design` + `web-artifacts-builder` | https://www.shadcn-vue.com/docs/components/sidebar |
| **Dashboard** | `frontend-design` + `theme-factory` | https://www.shadcn-vue.com/blocks (Dashboard block) |
| **Leads / Kanban** | `frontend-design` + `web-artifacts-builder` | https://github.com/clauderic/dnd-kit + https://www.shadcn-vue.com/docs/components/card |
| **Inbox WhatsApp** | `frontend-design` + `web-artifacts-builder` | https://www.shadcn-vue.com/docs/components/scroll-area |
| **Clientes** | `frontend-design` | https://www.shadcn-vue.com/docs/components/data-table |
| **Pedidos** | `frontend-design` + `web-artifacts-builder` | https://www.shadcn-vue.com/docs/components/dialog |
| **Produção** | `frontend-design` | https://www.shadcn-vue.com/docs/components/progress |
| **Estoque** | `frontend-design` | https://www.shadcn-vue.com/docs/components/data-table |
| **Financeiro** | `frontend-design` + `theme-factory` | https://recharts.org/en-US/examples + https://www.shadcn-vue.com/charts |
| **PDV** | `frontend-design` + `web-artifacts-builder` | https://www.shadcn-vue.com/docs/components/command |
| **Analytics** | `frontend-design` + `theme-factory` | https://www.shadcn-vue.com/charts |
| **Ajustes/Branding** | `frontend-design` + `brand-guidelines` | https://www.shadcn-vue.com/docs/components/tabs |
| **Landing Page** | `frontend-design` + `canvas-design` + `theme-factory` | https://www.shadcn-vue.com/blocks |
| **n8n Workflows** | — | https://doc.evolution-api.com/v2 |

---

## PARTE 5 — ESTRUTURA DO MONOREPO

```
orion-crm/
├── apps/
│   ├── web/                        # Next.js 14 — CRM + Landing Page
│   │   ├── app/
│   │   │   ├── (auth)/             # Rotas sem shell (login)
│   │   │   │   └── login/page.tsx
│   │   │   ├── (crm)/              # Rotas com AppShell
│   │   │   │   ├── layout.tsx      # AppShell wrapper
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── leads/page.tsx
│   │   │   │   ├── inbox/page.tsx
│   │   │   │   ├── clientes/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── pedidos/page.tsx
│   │   │   │   ├── producao/page.tsx
│   │   │   │   ├── estoque/page.tsx
│   │   │   │   ├── financeiro/page.tsx
│   │   │   │   ├── pdv/page.tsx
│   │   │   │   ├── analytics/page.tsx
│   │   │   │   └── ajustes/page.tsx
│   │   │   ├── (landing)/          # Landing page pública
│   │   │   │   └── page.tsx
│   │   │   └── api/                # API Routes (proxy leve para o backend)
│   │   │       └── [...path]/route.ts
│   │   ├── components/
│   │   │   ├── layout/             # AppShell, Sidebar, Topbar
│   │   │   ├── ui/                 # shadcn/ui + customizações
│   │   │   ├── modules/            # Componentes por módulo
│   │   │   │   ├── leads/
│   │   │   │   ├── inbox/
│   │   │   │   ├── pedidos/
│   │   │   │   └── ...
│   │   │   └── landing/            # Componentes da landing
│   │   ├── lib/
│   │   │   ├── api.ts              # Cliente HTTP (axios ou fetch wrapper)
│   │   │   ├── auth.ts             # Helpers de JWT client-side
│   │   │   └── utils.ts            # Formatadores (moeda, data, telefone)
│   │   ├── hooks/                  # Custom hooks reutilizáveis
│   │   ├── content/                # config.ts, produtos.ts (landing)
│   │   └── public/                 # Assets estáticos
│   │
│   └── api/                        # Node.js Express — Backend
│       ├── src/
│       │   ├── routes/             # Um arquivo por módulo
│       │   ├── middleware/         # auth.ts, rbac.ts, audit.ts, rateLimit.ts
│       │   ├── services/           # Lógica de negócio
│       │   │   ├── evolution.service.ts
│       │   │   ├── mercadopago.service.ts
│       │   │   └── openai.service.ts
│       │   ├── workers/            # BullMQ workers
│       │   ├── db/
│       │   │   ├── migrations/     # SQL migrations numeradas
│       │   │   └── queries/        # Queries por módulo
│       │   └── types/              # Tipos TypeScript compartilhados
│       └── Dockerfile
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
├── n8n/workflows/
└── .env.example
```

---

## PARTE 6 — PADRÕES OBRIGATÓRIOS PARA A IA

### O que NUNCA fazer

```
❌ Criar componentes de UI do zero quando existe no shadcn/ui
❌ Usar CSS inline — sempre Tailwind classes
❌ Usar <div> com onClick sem role/aria — usar <button>
❌ Hardcodar textos em componentes — usar content/ ou props
❌ Fetch manual com useEffect + useState — usar react-query
❌ Validação manual de formulários — usar zod + react-hook-form
❌ Usar FLOAT para valores monetários — sempre INTEGER (centavos)
❌ Cores hardcodadas (#C8A97A direto) — usar CSS var ou classe Tailwind
❌ Criar biblioteca de gráficos que não seja recharts
❌ Usar react-beautiful-dnd (deprecated) — usar @dnd-kit
```

### O que SEMPRE fazer

```
✅ Consultar Skill Map (Parte 4) antes de construir qualquer módulo
✅ Usar StatusBadge para qualquer badge de status
✅ Usar KpiCard para qualquer card de métrica
✅ Loading state em todo componente que faz fetch (Skeleton do shadcn)
✅ Empty state em toda lista que pode estar vazia (com ícone + texto + CTA)
✅ Error state em todo componente que pode falhar (com retry)
✅ Responsivo: testar em 375px (mobile) antes de considerar pronto
✅ TypeScript strict — sem any, sem @ts-ignore
✅ Formatar moeda sempre: R$ 1.800,00 (não $1800 nem R$1800)
✅ Formatar telefone sempre: (11) 99999-9999 na exibição, E.164 no banco
```

### Formatadores Utilitários (criar em lib/utils.ts)

```typescript
// Usar em TODO o projeto — nunca formatar inline

export const fmt = {
  // Moeda: 180000 → "R$ 1.800,00"
  currency: (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(cents / 100),

  // Telefone: "+5511999999999" → "(11) 99999-9999"
  phone: (e164: string) => {
    const digits = e164.replace(/\D/g, '').replace(/^55/, '')
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  },

  // Data relativa: "há 2 horas", "ontem", "12 jan"
  relativeTime: (date: Date | string) => {
    // usar date-fns/formatDistanceToNow com locale ptBR
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
  },

  // Data completa: "12 de fevereiro de 2026"
  fullDate: (date: Date | string) =>
    format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),

  // Data curta: "12/02/26"
  shortDate: (date: Date | string) =>
    format(new Date(date), 'dd/MM/yy', { locale: ptBR }),
}

// date-fns: npm i date-fns
// Nunca usar moment.js — deprecated e pesado
```
