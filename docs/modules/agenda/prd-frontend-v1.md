# ORION CRM — PRD Frontend: Módulo Agenda (4 Telas)

**Versão:** 1.0  
**Data:** 2026-03-23  
**Dependência backend:** `ORION-PRD-AGENDA-v1.md` (migration, service, routes)  
**Referência visual:** `mockup-01` a `mockup-04`  

---

## Convenções deste documento

- **Arquivo** = caminho exato onde criar/editar
- **Props** = interface TypeScript exata do componente
- **Regra** = comportamento obrigatório que deve ser testado
- **NÃO** = proibição explícita — violar invalida a implementação
- Cada botão, cada clique, cada estado está documentado
- Se não está aqui, NÃO implementar

---

# TELA 1 — Página `/agenda` (View Mensal)

**Mockup:** `mockup-01-agenda-mensal.html`  
**Arquivo principal:** `apps/web/app/(crm)/agenda/page.tsx`  
**Rota:** `/agenda` ou `/agenda?view=month&date=2026-03-01`

---

## 1.1 URL e Query Params

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `view` | `'month' \| 'week' \| 'day'` | `'month'` | View ativa do calendário |
| `date` | `YYYY-MM-DD` | Hoje | Data de referência (mês/semana/dia que está visível) |
| `selected` | UUID | `null` | ID do agendamento selecionado (abre sheet lateral) |

Exemplo: `/agenda?view=month&date=2026-03-01&selected=uuid-123`

---

## 1.2 Data Fetching (Server Component)

```typescript
// page.tsx — server component
// 1. Ler query params: view, date, selected
// 2. Calcular range baseado na view:
//    - month: primeiro dia do mês até último dia (expandir pra incluir dias visíveis de meses adjacentes)
//    - week: segunda-feira até domingo da semana
//    - day: o dia inteiro
// 3. Chamar API:

const appointments = await apiRequest<ApiListResponse<AppointmentRecord>>(
    `/appointments?start_date=${startDate}&end_date=${endDate}&limit=200`
);

// 4. Se `selected` presente:
const selectedAppointment = selected
    ? await apiRequest<AppointmentRecord>(`/appointments/${selected}`).catch(() => null)
    : null;
```

**NÃO** fazer fetch no client side. A page.tsx é server component. Refresh de dados via `router.refresh()` após mutations.

---

## 1.3 Layout da Página

```
┌─────────────────────────────────────────────────────────────┐
│ PageHeader: "Agenda" + controles de navegação + botão criar │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [MonthView]  ou  [WeekView]  ou  [DayView]                │
│  (renderizado condicionalmente baseado em `view`)           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Legenda: ● Visita  ● Consulta  ● Retorno  ● Entrega       │
└─────────────────────────────────────────────────────────────┘
```

Se `selected` está presente → layout muda para split (ver Tela 2).

---

## 1.4 Componente: `CalendarHeader`

**Arquivo:** `apps/web/app/(crm)/agenda/components/CalendarHeader.tsx`

**Props:**
```typescript
interface CalendarHeaderProps {
    currentDate: Date;
    view: 'month' | 'week' | 'day';
}
```

**Elementos renderizados (esquerda → direita):**

| # | Elemento | Tipo | Comportamento |
|---|----------|------|---------------|
| 1 | "Agenda" | `h1` com `font-serif text-2xl font-semibold text-gray-900` | Título da página. Usa componente `PageHeader` existente. |
| 2 | Botão `‹` | `button` | Navega para período anterior. Atualiza URL: `?date={data-anterior}&view={view}`. Month: mês anterior. Week: semana anterior. Day: dia anterior. |
| 3 | Label do período | `span` com `text-base font-medium` | Month: "Março de 2026". Week: "23 – 29 Mar 2026". Day: "Terça, 25 de março". Formatação com `Intl.DateTimeFormat('pt-BR')`. |
| 4 | Botão `›` | `button` | Navega para período seguinte. Mesma lógica do `‹`. |
| 5 | Botão "Hoje" | `button` estilo outline | Navega para hoje: `?date={hoje}&view={view}`. Se já está no período que contém hoje → botão fica disabled/dimmed. |
| 6 | Toggle Dia/Semana/Mês | Grupo de 3 botões | Cada botão navega: `?view=day`, `?view=week`, `?view=month`. Manter o `date` atual. Botão ativo: `bg-brand-gold/10 text-brand-gold`. Botão inativo: `bg-canvas-card text-gray-500`. |
| 7 | Botão "+ Novo Agendamento" | `button` estilo `bg-brand-gold text-surface-sidebar` | Abre `CreateAppointmentDialog` (ver Tela 4). Renderizar como `<Link href="/agenda?create=true&date={dateClicada}">` ou controlar via state. |

**Navegação por botões:**

Todos os botões de navegação (‹, ›, Hoje, views) funcionam via `<Link>` com `href` que muda os query params. NÃO usar state no client — é server component, toda navegação via URL.

```typescript
// Exemplo de cálculo para botão ‹ no month view:
const prevMonth = new Date(currentDate);
prevMonth.setMonth(prevMonth.getMonth() - 1);
const prevHref = `/agenda?view=month&date=${format(prevMonth, 'yyyy-MM-dd')}`;
```

---

## 1.5 Componente: `MonthView`

**Arquivo:** `apps/web/app/(crm)/agenda/components/MonthView.tsx`

**Props:**
```typescript
interface MonthViewProps {
    appointments: AppointmentRecord[];
    currentDate: Date;          // mês sendo exibido
    selectedId: string | null;  // agendamento selecionado (para highlight no pill)
}
```

**Estrutura HTML:**
```
<div className="grid grid-cols-7 border border-canvas-border rounded-xl overflow-hidden">
    {/* 7 headers: Dom, Seg, Ter, Qua, Qui, Sex, Sáb */}
    {/* 35 ou 42 células (5 ou 6 semanas) */}
</div>
```

**Regras de renderização das células:**

| Condição | Classes CSS |
|----------|-------------|
| Célula normal | `bg-canvas-card border-b border-r border-canvas-border min-h-[110px] p-2 cursor-pointer hover:bg-surface-overlay` |
| Dia de outro mês | `bg-canvas` (mais escuro) + `.day-num` com `text-gray-600` |
| Dia de hoje | `.day-num` com `bg-brand-gold text-surface-sidebar rounded-full w-6 h-6 flex items-center justify-center font-semibold` |
| Domingo | Mesma aparência dos outros dias (NÃO marcar como "fechado" visualmente — o impedimento é no modal de criação) |

**Regras de renderização dos pills por célula:**

1. Listar appointments do dia, ordenados por `starts_at` ASC
2. Renderizar no máximo **3 pills** por célula
3. Se mais de 3 → mostrar `+{N} mais` como link clicável (navega para `/agenda?view=day&date={dia}`)
4. Cada pill é um `<Link href="/agenda?view=month&date={mesAtual}&selected={appointment.id}">`

**Clicar em célula vazia:** navega para `/agenda?create=true&date={dia}` → abre modal de criação com data pré-preenchida.

---

## 1.6 Componente: `AppointmentPill`

**Arquivo:** `apps/web/app/(crm)/agenda/components/AppointmentPill.tsx`

**Props:**
```typescript
interface AppointmentPillProps {
    appointment: AppointmentRecord;
    compact?: boolean;    // true no MonthView, false no WeekView/DayView
    isSelected?: boolean; // true se é o agendamento no sheet lateral
}
```

**Formatação do texto:**
- Compact (month view): `"14:00 Maria S."` → hora + nome truncado com iniciais do sobrenome
- Full (week/day view): `"14:00 – 14:45 · Maria Silva · Visita Presencial"`

**Extrair nome:** `appointment.lead?.name ?? appointment.customer?.name ?? 'Sem nome'`

**Truncar nome (compact):** se nome tem espaço, pegar primeiro nome + inicial do último. Ex: "Maria Fernanda da Silva" → "Maria S."

**Cores por tipo — classes CSS:**

| Type | Background | Texto | Border-left |
|------|-----------|-------|-------------|
| `VISITA_PRESENCIAL` | `bg-[#C8A97A]/12` | `text-[#C8A97A]` | `border-l-2 border-[#C8A97A]` |
| `CONSULTA_ONLINE` | `bg-blue-500/12` | `text-blue-400` | `border-l-2 border-blue-400` |
| `RETORNO` | `bg-emerald-500/12` | `text-emerald-400` | `border-l-2 border-emerald-400` |
| `ENTREGA` | `bg-orange-400/12` | `text-orange-400` | `border-l-2 border-orange-400` |
| `OUTRO` | `bg-gray-500/12` | `text-gray-400` | `border-l-2 border-gray-400` |

**Estados visuais especiais:**

| Status | Efeito visual |
|--------|---------------|
| `CANCELADO` | `opacity-35` + `line-through` no texto |
| `NAO_COMPARECEU` | `ring-1 ring-red-500/50` (borda vermelha sutil) |
| `CONCLUIDO` | Nenhum efeito extra (fica como pill normal) |
| Selected (`isSelected=true`) | `outline outline-2 outline-brand-gold outline-offset-1` |

**Classe base do pill:**
```
rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer truncate block hover:brightness-125 transition
```

**NÃO** usar emojis no pill. Sem ícones. Apenas texto `"HH:MM Nome"`.

---

## 1.7 Componente: `CalendarLegend`

**Arquivo:** `apps/web/app/(crm)/agenda/components/CalendarLegend.tsx`

**Props:** nenhum.

**Renderização:** linha horizontal abaixo do grid com 4 items:
```
<div className="flex gap-5 mt-4 px-1">
    <LegendItem color="#C8A97A" label="Visita Presencial" />
    <LegendItem color="#60A5FA" label="Consulta Online" />
    <LegendItem color="#10B981" label="Retorno" />
    <LegendItem color="#FB923C" label="Entrega" />
</div>
```

Cada `LegendItem`:
```
<div className="flex items-center gap-1.5 text-[11px] text-gray-500">
    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
    {label}
</div>
```

---

## 1.8 Sidebar — Adicionar item "Agenda"

**Arquivo:** `apps/web/components/layout/Sidebar.tsx`

**Edição:** no array `navGroups`, seção "Operação", adicionar ENTRE "Estoque" e "Financeiro":

```typescript
{ icon: CalendarDays, label: 'Agenda', href: '/agenda' },
```

Import: `import { CalendarDays } from 'lucide-react';`

**Ícone:** `CalendarDays` do lucide-react (NÃO `Calendar` — `CalendarDays` tem as bolinhas dos dias).

---

# TELA 2 — Agenda com Sheet de Detalhe (Lateral Direita)

**Mockup:** `mockup-02-agenda-com-sheet.html`  
**Arquivo:** mesmo `page.tsx` da Tela 1 (renderização condicional)  
**Rota:** `/agenda?view=month&selected=uuid-123`

---

## 2.1 Quando exibir

Quando query param `selected` está presente E o appointment foi carregado com sucesso.

## 2.2 Layout Split

O layout muda de full-width para split:

```typescript
// page.tsx
const hasSelection = !!selectedAppointment;

return (
    <div className={cn(
        "flex-1 overflow-hidden",
        hasSelection ? "grid grid-cols-[1fr_400px]" : ""
    )}>
        <div className="overflow-y-auto p-6">
            <CalendarHeader ... />
            <MonthView ... />
            <CalendarLegend />
        </div>
        {hasSelection && (
            <AppointmentSheet
                appointment={selectedAppointment}
                onClose={`/agenda?view=${view}&date=${date}`}
            />
        )}
    </div>
);
```

**Regra:** o calendário comprime para dar espaço ao sheet. NÃO usar overlay/modal — é um panel fixo à direita, dentro do grid.

## 2.3 Componente: `AppointmentSheet`

**Arquivo:** `apps/web/app/(crm)/agenda/components/AppointmentSheet.tsx`

**Props:**
```typescript
interface AppointmentSheetProps {
    appointment: AppointmentRecord;
    closeHref: string;  // URL sem ?selected para fechar o sheet
}
```

**Estrutura — seções em ESTA ORDEM (de cima para baixo):**

### Seção 1 — Header

```
┌──────────────────────────────────────────┐
│ 📅 Qui, 27 de março · 14:00      [badge]│
│ ⏱ 45 minutos                      [✕]   │
└──────────────────────────────────────────┘
```

- Data formatada: `new Date(appointment.starts_at).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })` → "qui., 27 de março"
- Hora: `new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })` → "14:00"
- Duração: calcular `(ends_at - starts_at) / 60000` → "45 minutos"
- Badge de status: usar `StatusBadge` existente (ver mapeamento abaixo)
- Botão ✕: `<Link href={closeHref}>` — renderizar como `<a>` com ícone `X` do lucide-react

**Mapeamento de status para StatusBadge:**

Adicionar ao `StatusBadge.tsx` existente:
```typescript
// Appointments
AGENDADO:            { label: 'Agendado',          color: 'bg-blue-100 text-blue-800 border-blue-200' },
CONFIRMADO_CLIENTE:  { label: 'Confirmado',        color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
EM_ATENDIMENTO:      { label: 'Em atendimento',    color: 'bg-amber-100 text-amber-800 border-amber-200' },
CONCLUIDO:           { label: 'Concluído',         color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
CANCELADO:           { label: 'Cancelado',         color: 'bg-red-100 text-red-800 border-red-200' },
NAO_COMPARECEU:      { label: 'Não compareceu',    color: 'bg-red-100 text-red-800 border-red-200' },
```

### Seção 2 — Tipo

Pill colorida com label do tipo:
```
<span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
      style={{ background: APPOINTMENT_TYPE_COLORS[type] + '1F', color: APPOINTMENT_TYPE_COLORS[type] }}>
    {APPOINTMENT_TYPE_LABELS[type]}
</span>
```

`APPOINTMENT_TYPE_LABELS` e `APPOINTMENT_TYPE_COLORS` definidos no PRD backend (seção 6 de `ORION-PRD-AGENDA-v1.md`).

### Seção 3 — Cliente (após `<Separator />`)

| Campo | Valor | Regra |
|-------|-------|-------|
| Nome | `appointment.lead?.name ?? appointment.customer?.name ?? 'Sem nome'` | Font-size: 15px, font-weight: 600 |
| WhatsApp | `appointment.lead?.whatsapp_number ?? appointment.customer?.whatsapp_number` | Link clicável: `<a href="https://wa.me/{number}" target="_blank">` em `text-brand-gold` |
| Instagram | `appointment.ai_context?.instagram` | Só exibir se presente. Link: `<a href="https://instagram.com/{handle}">` |
| Link CRM | "Ver perfil no CRM →" | Se `lead_id`: `href="/leads?selected={lead_id}"`. Se `customer_id`: `href="/clientes/{customer_id}"`. Se nenhum: não renderizar. |

### Seção 4 — Contexto da IA (após `<Separator />`)

**Renderizar SOMENTE SE:** `appointment.source === 'WHATSAPP_BOT'` E `Object.keys(appointment.ai_context).length > 0`

Se essas condições forem falsas: **NÃO renderizar a seção inteira** (nem o título).

Componente: `AiContextCard` (ver seção 2.5).

### Seção 5 — Observações (após `<Separator />`)

**Renderizar SOMENTE SE:** `appointment.notes` não é null e não é string vazia.

```
<div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 mb-2">Observações</p>
    <p className="text-sm text-gray-400 leading-relaxed">{appointment.notes}</p>
</div>
```

### Seção 6 — Metadados (após `<Separator />`)

| Campo | Valor |
|-------|-------|
| Atendente | `appointment.assigned_to?.name ?? 'Não atribuído'` |
| Agendado por | Se `source === 'WHATSAPP_BOT'`: pill "Bot WhatsApp" em `bg-purple-500/12 text-purple-400`. Se `source === 'MANUAL'`: texto "Manual". Se `source === 'CRM'`: texto "CRM". |
| Criado em | `formatDate(appointment.created_at)` com font monospace |

### Seção 7 — Botões de Ação

**Regra crítica:** exibir APENAS os botões válidos para o status atual.

| Status atual | Botões visíveis |
|-------------|-----------------|
| `AGENDADO` | [✓ Confirmar] [Iniciar Atendimento] [Reagendar] [Cancelar] |
| `CONFIRMADO_CLIENTE` | [Iniciar Atendimento] [Reagendar] [Cancelar] |
| `EM_ATENDIMENTO` | [✓ Concluir] [Cancelar] |
| `CONCLUIDO` | Nenhum botão (apenas texto "Atendimento concluído") |
| `CANCELADO` | Nenhum botão (apenas texto "Agendamento cancelado em {data}") |
| `NAO_COMPARECEU` | [Reagendar] (permitir re-agendar após no-show) |

**Cada botão é um `<form>` com server action:**

```typescript
// actions.ts
'use server';

export async function updateAppointmentStatusAction(formData: FormData) {
    const id = formData.get('id') as string;
    const status = formData.get('status') as string;
    const cancelReason = formData.get('cancel_reason') as string | null;

    await apiRequest(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancel_reason: cancelReason || undefined }),
    });

    revalidatePath('/agenda');
    redirect(`/agenda?selected=${id}`);
}
```

**Estilos dos botões:**

| Botão | Classes |
|-------|---------|
| Confirmar / Concluir | `bg-brand-gold text-surface-sidebar font-semibold` (botão primary) |
| Iniciar Atendimento / Reagendar | `bg-canvas-card border border-canvas-border text-gray-700 hover:border-brand-gold-light` (botão secondary) |
| Cancelar | `text-red-600 border-red-200 hover:bg-red-50` (botão danger) |

**Botão "Cancelar":** ao clicar, NÃO executar imediatamente. Abrir um mini-form inline (ou Dialog de confirmação) pedindo `cancel_reason` (obrigatório). Só após preencher motivo e confirmar, executar a action.

**Botão "Reagendar":** navegar para `/agenda?create=true&reschedule={appointment.id}` → abre modal de criação com dados pré-preenchidos do agendamento anterior. Após criar o novo, cancelar o antigo automaticamente com reason "Reagendado para {nova data}".

---

## 2.5 Componente: `AiContextCard`

**Arquivo:** `apps/web/app/(crm)/agenda/components/AiContextCard.tsx`

**Props:**
```typescript
interface AiContextCardProps {
    context: Record<string, unknown>;
}
```

**Mapeamento de campos conhecidos:**

```typescript
const KNOWN_FIELDS: Record<string, { icon: string; label: string }> = {
    interesse:  { icon: '💍', label: 'Interesse' },
    material:   { icon: '✨', label: 'Material' },
    ocasiao:    { icon: '💒', label: 'Ocasião' },
    orcamento:  { icon: '💰', label: 'Orçamento' },
    urgencia:   { icon: '⚡', label: 'Urgência' },
    instagram:  { icon: '📸', label: 'Instagram' },
};
```

**NÃO usar emojis para ícones na sidebar ou no sistema geral.** Os emojis são permitidos APENAS dentro do `AiContextCard` porque são dados informais coletados por IA no WhatsApp. É a única exceção.

**Renderização:**
1. Iterar sobre `Object.entries(context)`
2. Para cada key: se existe em `KNOWN_FIELDS`, usar icon e label customizados
3. Se key não existe em `KNOWN_FIELDS`: usar ícone `📋` e label = key capitalizado
4. Valor: renderizar como string. Se valor é `null`, `undefined` ou `""`: NÃO renderizar a linha.
5. Se key === `urgencia` e valor contém "alta" (case insensitive): `text-orange-400` no valor.

**Container:**
```
<div className="rounded-lg border border-brand-gold/15 bg-canvas p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-gold mb-3 flex items-center gap-1.5">
        ✨ Dados da conversa WhatsApp
    </p>
    {rows}
</div>
```

**Cada row:**
```
<div className="flex items-baseline gap-2 mb-1.5 text-xs">
    <span className="w-4 text-center flex-shrink-0">{icon}</span>
    <span className="text-gray-500 min-w-[75px]">{label}</span>
    <span className="text-gray-200 font-medium">{value}</span>
</div>
```

---

# TELA 3 — Aba "Agenda" no Perfil do Lead/Cliente

**Mockup:** `mockup-03-lead-aba-agenda.html`  
**Arquivo (lead):** editar `apps/web/app/(crm)/leads/page.tsx` ou componente de detalhe do lead  
**Arquivo (cliente):** editar `apps/web/app/(crm)/clientes/[id]/page.tsx`

---

## 3.1 Adicionar Tab "Agenda"

**Nas tabs do perfil do lead/cliente, adicionar "Agenda" como PRIMEIRA tab:**

```
ANTES:  Ficha | Atendimento | Proposta | Pedidos | OS | Entrega | Histórico
DEPOIS: Agenda | Ficha | Atendimento | Proposta | Pedidos | OS | Entrega | Histórico
```

**Tab "Agenda" é a tab ativa por padrão** quando o perfil é aberto. Isto é uma decisão de UX — o funcionário precisa ver o próximo agendamento antes de qualquer outra informação.

## 3.2 Data Fetching

No server component do perfil, buscar agendamentos:

```typescript
// Dentro do page.tsx do lead detail ou cliente detail:
const appointmentsResponse = await apiRequest<ApiListResponse<AppointmentRecord>>(
    `/appointments?start_date=2020-01-01&end_date=2030-12-31&limit=50`
    // Filtrar no frontend por lead_id ou customer_id
    // OU: criar query param no backend: ?lead_id={id} ou ?customer_id={id}
).catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 50, pages: 1 } }));

// Filtrar client-side (se backend não tiver filtro por lead/customer):
const leadAppointments = appointmentsResponse.data.filter(a => a.lead?.id === leadId);
```

**Preferível:** adicionar query params `lead_id` e `customer_id` no endpoint `GET /appointments` do backend. Isso é uma alteração de 3 linhas no service (adicionar WHERE clause). Documentar como task de backend.

## 3.3 Componente: `LeadAppointmentsTab`

**Arquivo:** `apps/web/app/(crm)/agenda/components/LeadAppointmentsTab.tsx`

**Props:**
```typescript
interface LeadAppointmentsTabProps {
    appointments: AppointmentRecord[];
    contactId: string;
    contactType: 'lead' | 'customer';
    contactName: string;
}
```

**Lógica de separação:**

```typescript
const now = new Date();

// Próximo agendamento: o mais próximo no futuro com status ativo
const nextAppointment = appointments
    .filter(a => new Date(a.starts_at) >= now && !['CANCELADO', 'NAO_COMPARECEU', 'CONCLUIDO'].includes(a.status))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    [0] ?? null;

// Histórico: todos os outros (passados + cancelados + concluídos)
const history = appointments
    .filter(a => a.id !== nextAppointment?.id)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
```

## 3.4 Renderização — Com agendamentos

### Seção "PRÓXIMO AGENDAMENTO"

Label: `<p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 mb-3">Próximo Agendamento</p>`

Card:
```
<div className="rounded-xl border border-canvas-border bg-canvas-card p-5">
```

**Dentro do card, nesta ordem:**

1. **Header:** data formatada + badge de status (mesma formatação da Tela 2, seção header)
2. **Meta:** duração + tipo + atendente (em linha, separados por espaço, `text-xs text-gray-500`)
3. **AiContextCard** (se `source === 'WHATSAPP_BOT'` e `ai_context` não vazio) — mesmo componente da Tela 2
4. **Observações** (se `notes` não vazio) — `<p>` prefixado com `<strong>Obs:</strong>`
5. **Botões de ação** — mesmos botões e mesmas regras da Tela 2, seção 7

### Seção "HISTÓRICO DE AGENDAMENTOS"

Label: `<p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 mb-3 mt-6">Histórico de Agendamentos</p>`

**Cada item do histórico:**
```
<div className="flex items-center justify-between rounded-lg border border-canvas-border bg-canvas-card px-4 py-3 mb-1.5">
    <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-gray-500 min-w-[90px]">
            {formatDate(a.starts_at, 'dd/MM')} · {formatTime(a.starts_at)}
        </span>
        <span className="text-xs text-gray-300">
            {APPOINTMENT_TYPE_LABELS[a.type]}
        </span>
    </div>
    <StatusBadge status={a.status} />
</div>
```

**NÃO** renderizar `AiContextCard` nos itens do histórico — apenas no próximo agendamento.

## 3.5 Renderização — Sem agendamentos

Usar componente `EmptyState` existente:

```tsx
<EmptyState
    title="Nenhum agendamento"
    description="Este cliente ainda não tem agendamentos registrados."
/>
<div className="mt-4 flex justify-center">
    <Link href={`/agenda?create=true&${contactType}_id=${contactId}`}>
        <Button variant="primary">+ Agendar visita</Button>
    </Link>
</div>
```

## 3.6 Painel direito — Botão "Novo Agendamento"

No painel direito do perfil (seção "Ações Rápidas"), adicionar botão:

```tsx
<Link href={`/agenda?create=true&${contactType}_id=${contactId}`}>
    <button className="action-btn gold">
        <CalendarDays className="h-4 w-4" /> Novo Agendamento
    </button>
</Link>
```

Ícone: `CalendarDays` do lucide-react. Cor: `text-brand-gold`.

Inserir APÓS "Nova OS" e ANTES de "Novo Bloco" (ou no final da lista se esses não existirem).

---

# TELA 4 — Modal "Criar Agendamento"

**Mockup:** `mockup-04-criar-agendamento.html`  
**Arquivo:** `apps/web/app/(crm)/agenda/components/CreateAppointmentDialog.tsx`

---

## 4.1 Quando abrir

O modal abre quando query param `create=true` está presente na URL.

Exemplos de URL que abrem o modal:
- `/agenda?create=true` → modal vazio
- `/agenda?create=true&date=2026-03-27` → data pré-preenchida
- `/agenda?create=true&lead_id=uuid` → lead pré-selecionado
- `/agenda?create=true&customer_id=uuid` → cliente pré-selecionado
- `/agenda?create=true&reschedule=uuid` → reagendamento (dados do antigo pré-preenchidos)

## 4.2 Componente

**Props:**
```typescript
interface CreateAppointmentDialogProps {
    open: boolean;
    defaultDate?: string;        // YYYY-MM-DD
    defaultLeadId?: string;      // UUID
    defaultCustomerId?: string;  // UUID
    rescheduleFrom?: AppointmentRecord; // agendamento sendo reagendado
}
```

**Usar:** shadcn `Dialog` component. `<Dialog open={open}>`.

**Fechar:** navegar para URL sem `create` param → `<Link href="/agenda?view=...&date=...">`.

## 4.3 Campos do formulário — NESTA ORDEM

### Campo 1 — Tipo de agendamento

**Componente:** Radio group visual (pills)

```typescript
const TYPES = [
    { value: 'VISITA_PRESENCIAL', label: 'Visita' },
    { value: 'CONSULTA_ONLINE', label: 'Consulta' },
    { value: 'RETORNO', label: 'Retorno' },
    { value: 'ENTREGA', label: 'Entrega' },
    { value: 'OUTRO', label: 'Outro' },
];
```

**Default:** `VISITA_PRESENCIAL`.

**Visual:** pills em linha. Pill ativa: `bg-brand-gold/10 border-brand-gold text-brand-gold`. Pill inativa: `border-canvas-border text-gray-500`.

**NÃO** usar emojis nos pills do radio. Texto puro: "Visita", "Consulta", etc.

### Campo 2 — Cliente ou Lead (busca com autocomplete)

**Label:** "Cliente ou Lead"

**Componente:** `<input>` com dropdown de autocomplete.

**Comportamento:**
1. Usuário digita no mínimo 2 caracteres
2. Debounce de 300ms
3. Buscar em DOIS endpoints simultaneamente:
   - `GET /api/v1/leads?q={query}&limit=5`
   - `GET /api/v1/customers?q={query}&limit=5`
4. Renderizar dropdown com resultados combinados
5. Cada resultado mostra: `Nome · +55 XX XXXXX-XXXX` + badge "Lead" (amarelo) ou "Cliente" (verde)
6. Ao selecionar: preencher `lead_id` ou `customer_id` no form state + mostrar hint verde "✓ Lead selecionado: {nome}"

**Se `defaultLeadId` ou `defaultCustomerId` está preenchido:** buscar os dados e pré-preencher.

**NÃO** usar shadcn `Command` para isso — usar um input com dropdown customizado, ou shadcn `Popover` + lista filtrada.

### Campo 3 — Data

**Label:** "Data"

**Componente:** shadcn `Calendar` dentro de `Popover`. Ao clicar no input, abre o calendar picker.

**Formato exibido:** `"27/03/2026 (Quinta-feira)"` — data + dia da semana entre parênteses.

**Restrições do calendar:**
- Dias passados: `disabled` (não clicáveis)
- Domingos: `disabled` + tooltip "Fechado aos domingos"
- Hoje em diante: habilitado

**Default:** `defaultDate` se fornecido, senão hoje (ou próximo dia útil se hoje for domingo).

### Campo 4 — Horário de início

**Label:** "Horário de início"

**Componente:** `<select>` nativo (NÃO shadcn Select — mais simples e funcional).

**Opções geradas dinamicamente:**
- Quando a data muda, buscar slots disponíveis (ou calcular localmente):
  - Se segunda a sexta: `09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00`
  - Se sábado: `09:00, 10:00, 11:00, 12:00`
- **Idealmente**, buscar da API: `GET /api/v1/n8n/appointments/available-slots?date={date}` (mesmo endpoint do bot) — mas esse endpoint usa auth do n8n. **Alternativa**: fazer o cálculo no frontend buscando agendamentos do dia e removendo horários conflitantes.

**NÃO** mostrar horários que já estão ocupados. Se `14:00` já tem agendamento para o atendente selecionado → não incluir na lista.

### Campo 5 — Horário de término (auto-calculado)

**Label:** "Término (automático)"

**Componente:** `<input>` com `disabled`. Valor: `start_time + 45 minutos`.

**Regra:** ao mudar start_time, recalcular end_time = start + 45min.

**NÃO** permitir edição manual do end_time nesta versão.

### Campo 6 — Atendente

**Label:** "Atendente"

**Componente:** `<select>`.

**Opções:** listar usuários com role `ADMIN` ou `ATENDENTE`. Buscar de `/api/v1/users` ou de um endpoint dedicado (se existir).

**Default:** o usuário logado (se é ADMIN ou ATENDENTE).

### Campo 7 — Observações

**Label:** "Observações"

**Componente:** `<textarea>` com `maxLength={2000}`.

**Placeholder:** "Detalhes sobre o atendimento..."

**Default:** vazio, ou dados do agendamento anterior se `rescheduleFrom` está preenchido.

## 4.4 Validações inline (ANTES do submit)

| Condição | Mensagem | Visual |
|----------|----------|--------|
| Data é domingo | "Domingo: a loja está fechada. Escolha outro dia." | Texto `text-orange-500` abaixo do campo data |
| Horário já ocupado | "Conflito com «{título}» ({hora} – {hora})" | Texto `text-orange-500` abaixo do campo horário |
| Nenhum cliente/lead selecionado | "Selecione um cliente ou lead" | Texto `text-red-500` abaixo do campo de busca |
| Data no passado | "Selecione uma data futura" | Texto `text-red-500` + campo data com `border-red-300` |

**Botão "Agendar" fica desabilitado** enquanto houver qualquer validação falhando.

## 4.5 Submit — Server Action

**Arquivo:** `apps/web/app/(crm)/agenda/actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export async function createAppointmentAction(formData: FormData) {
    const body = {
        lead_id: formData.get('lead_id') || undefined,
        customer_id: formData.get('customer_id') || undefined,
        title: `${APPOINTMENT_TYPE_LABELS[formData.get('type') as string]} — ${formData.get('contact_name')}`,
        type: formData.get('type'),
        starts_at: formData.get('starts_at'),
        ends_at: formData.get('ends_at'),
        notes: formData.get('notes') || undefined,
        assigned_to: formData.get('assigned_to') || undefined,
    };

    const result = await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    revalidatePath('/agenda');
    redirect(`/agenda?selected=${result.id}`);
}
```

**Após criar com sucesso:** fechar modal + navegar para `/agenda?selected={novo_id}` → mostra o agendamento recém-criado no sheet lateral.

**Se `rescheduleFrom` existia:** após criar o novo agendamento, executar segunda action para cancelar o antigo:

```typescript
if (rescheduleFromId) {
    await apiRequest(`/appointments/${rescheduleFromId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
            status: 'CANCELADO',
            cancel_reason: `Reagendado para ${format(newDate, 'dd/MM/yyyy')} às ${newTime}`,
        }),
    });
}
```

## 4.6 Footer do modal

```
[Cancelar]              [✓ Agendar]
```

- "Cancelar": `<Link href="/agenda?view=...&date=...">` — fecha o modal
- "✓ Agendar": `<button type="submit">` — submit do form. Disabled se validação falhou.
- Estilos: Cancelar = secondary, Agendar = primary (`bg-brand-gold`).

---

# ESTRUTURA DE ARQUIVOS COMPLETA

```
apps/web/app/(crm)/agenda/
├── page.tsx                              ← Server component (data fetch, layout)
├── actions.ts                            ← Server actions (create, updateStatus)
└── components/
    ├── CalendarHeader.tsx                 ← Navegação + toggle view + botão criar
    ├── MonthView.tsx                      ← Grid mensal 7×5/6
    ├── WeekView.tsx                       ← (fase 2 — não implementar agora)
    ├── DayView.tsx                        ← (fase 2 — não implementar agora)
    ├── AppointmentPill.tsx                ← Pill colorida (usado em MonthView)
    ├── AppointmentSheet.tsx               ← Sheet lateral de detalhes
    ├── CreateAppointmentDialog.tsx         ← Modal de criação
    ├── AiContextCard.tsx                  ← Card com dados da IA (usado em Sheet e LeadTab)
    ├── CalendarLegend.tsx                 ← Legenda de cores
    └── LeadAppointmentsTab.tsx            ← Tab "Agenda" no perfil do lead/cliente
```

---

# ORDEM DE IMPLEMENTAÇÃO

```
1.  StatusBadge: adicionar status de appointments
2.  CalendarLegend (componente mais simples — validar styling)
3.  AppointmentPill
4.  AiContextCard
5.  MonthView (grid + pills + interações de clique)
6.  CalendarHeader (navegação + toggle view)
7.  page.tsx com MonthView (sem sheet, sem modal)
8.  AppointmentSheet (detalhes do agendamento)
9.  page.tsx com layout split (calendar + sheet)
10. CreateAppointmentDialog (modal de criação)
11. actions.ts (create + updateStatus)
12. LeadAppointmentsTab
13. Adicionar tab "Agenda" no perfil do lead
14. Adicionar tab "Agenda" no perfil do cliente
15. Adicionar "Agenda" na sidebar
16. Testar fluxo completo: criar → ver no calendar → clicar → ver sheet → mudar status
```

---

# O QUE NÃO FAZER

- NÃO usar FullCalendar.js ou qualquer biblioteca de calendário
- NÃO usar emojis na sidebar, topbar, pills, botões ou headers. Emojis SÓ dentro do AiContextCard
- NÃO usar ícones como texto inline (ex: "📅 Qui, 27/03") — usar ícones lucide-react como componentes SVG
- NÃO implementar WeekView e DayView agora — apenas MonthView
- NÃO implementar drag & drop no calendário
- NÃO implementar notificações/reminders
- NÃO usar light theme em nenhum componente novo
- NÃO criar componentes de UI novos quando shadcn/ui já tem equivalente (Dialog, Separator, Badge, etc.)
- NÃO usar `useState` para dados que devem vir do server — toda navegação e dados via URL params + server components
- NÃO duplicar lógica de formatação — usar `lib/utils.ts` existente (formatDate, formatCurrencyFromCents, etc.)
