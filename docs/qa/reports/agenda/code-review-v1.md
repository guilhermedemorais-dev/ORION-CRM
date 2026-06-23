# CODE REVIEW — Agenda Feature
**Data:** 2026-03-23
**Revisor:** Senior (Claude Code)
**Branch:** feat/orion-evolution-foundations
**Veredicto:** Não está pronta para produção. É um protótipo visual com stubs.

---

## Resumo executivo

O build passa e o TypeScript compila sem erros. A estrutura de arquivos está correta e o design visual em dark mode está alinhado com o sistema de cores. Até aqui vai o positivo.

Porém: nenhuma das server actions chama a API real, a página usa mock data hardcoded, o AppointmentSheet ignora o ID recebido e exibe dados falsos, e o formulário de criação não submete nada. A feature existe visualmente mas não funciona.

---

## O que está correto (não mexer)

- Estrutura de arquivos e rotas Next.js
- `getDaysInMonthView`: lógica de cálculo de dias correta (incluindo 35/42 células)
- Design system: cores dark, tokens brand-gold aplicados
- `CalendarLegend`: simples e correto
- `StatusBadge`: expandido com novos status no lugar certo
- `ClientTabs.tsx` e `ClientPanelShell.tsx`: tab "Agenda" adicionada estruturalmente

---

## CORREÇÕES OBRIGATÓRIAS — em ordem de execução

### PASSO 1 — Alinhar tipos com o schema da API

**Arquivo:** `apps/web/app/(crm)/agenda/types.ts`

**Problema:** Campos `start_date`/`end_date`, `client_name`, `user_name` não existem no backend. Quando a API real for conectada, tudo quebra.

**Corrigir para:**
```typescript
export type AppointmentStatus =
  | 'AGENDADO'
  | 'CONFIRMADO_CLIENTE'
  | 'EM_ATENDIMENTO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'NAO_COMPARECEU';

export type AppointmentType =
  | 'VISITA_PRESENCIAL'
  | 'CONSULTA_ONLINE'
  | 'RETORNO'
  | 'ENTREGA'
  | 'OUTRO';

export type AppointmentSource = 'MANUAL' | 'CRM' | 'WHATSAPP_BOT';

export interface AppointmentRecord {
  id: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  source: AppointmentSource;
  starts_at: string;   // ISO 8601
  ends_at: string;     // ISO 8601
  notes?: string | null;
  lead?: { id: string; name: string; whatsapp_number?: string | null } | null;
  customer?: { id: string; name: string; whatsapp_number?: string | null } | null;
  assigned_to?: { id: string; name: string } | null;
  ai_context?: Record<string, unknown> | null;
  created_at: string;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
}
```

**Impacto:** Todos os outros arquivos vão precisar ser atualizados após essa correção (campo `starts_at` em vez de `start_date`, etc). Fazer esse passo primeiro evita retrabalho.

---

### PASSO 2 — Corrigir `StatusBadge` com chaves corretas

**Arquivo:** `apps/web/components/ui/StatusBadge.tsx`

**Problema:** Chaves `CONFIRMADO` e `NO_SHOW` no mapa, mas o backend retorna `CONFIRMADO_CLIENTE` e `NAO_COMPARECEU`. Runtime vai quebrar.

**Remover:** `CONFIRMADO`, `NO_SHOW`

**Adicionar:**
```typescript
CONFIRMADO_CLIENTE: { label: 'Confirmado',       color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
NAO_COMPARECEU:     { label: 'Não compareceu',   color: 'border-rose-500/20 bg-rose-500/10 text-rose-300' },
```

As demais chaves (`AGENDADO`, `CANCELADO`, `CONCLUIDO`, `EM_ATENDIMENTO`) já estão corretas.

---

### PASSO 3 — Corrigir ícone da Sidebar

**Arquivo:** `apps/web/components/layout/Sidebar.tsx`

**Problema:** PRD especifica `CalendarDays` (com bolinhas dos dias), implementação usa `Calendar` (ícone simples).

**Corrigir:**
```typescript
// Remover do import:
Calendar,

// Adicionar ao import:
CalendarDays,

// Na linha do item Agenda:
{ icon: CalendarDays, label: 'Agenda', href: '/agenda' },
```

---

### PASSO 4 — Corrigir query params para alinhar com o PRD

**Arquivos:** `apps/web/app/(crm)/agenda/page.tsx` e `components/CalendarHeader.tsx`

**Problema:** Implementação usa `?month=YYYY-MM`. PRD define `?view=month|week|day&date=YYYY-MM-DD`. Quando WeekView/DayView forem adicionados, quebra tudo.

**Em `CalendarHeader.tsx`**, trocar:
```typescript
// ERRADO
params.set('month', `${year}-${month}`);

// CORRETO
const day = String(newDate.getDate()).padStart(2, '0');
params.set('date', `${year}-${month}-${day}`);
params.set('view', searchParams.get('view') ?? 'month');
```

Botão "Hoje":
```typescript
// ERRADO
params.delete('month');

// CORRETO
params.delete('date'); // ausente = hoje
params.set('view', searchParams.get('view') ?? 'month');
```

**Em `page.tsx`**, trocar a leitura de params:
```typescript
// ERRADO
searchParams: { month?: string; selected?: string; new?: string }
// ...
if (searchParams.month) {
    const [year, month] = searchParams.month.split('-');

// CORRETO
searchParams: { view?: string; date?: string; selected?: string; create?: string }
// ...
if (searchParams.date) {
    currentDate = new Date(searchParams.date + 'T12:00:00');
}
const view = (searchParams.view ?? 'month') as 'month' | 'week' | 'day';
```

Também trocar a condição para abrir o dialog de criação:
```typescript
// ERRADO
{searchParams.new === '1' && <CreateAppointmentDialog />}

// CORRETO
{searchParams.create === 'true' && <CreateAppointmentDialog />}
```

E em `CalendarHeader.tsx`, o botão de novo agendamento:
```typescript
// ERRADO
params.set('new', '1');

// CORRETO
params.set('create', 'true');
```

---

### PASSO 5 — Implementar `actions.ts` com chamadas reais à API

**Arquivo:** `apps/web/app/(crm)/agenda/actions.ts`

**Problema:** Ambas as actions são stubs com `console.log`. Nada é enviado para o backend.

**Substituir completamente:**
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export async function createAppointmentAction(formData: FormData) {
    const body = {
        type:        formData.get('type') as string,
        starts_at:   formData.get('starts_at') as string,
        ends_at:     formData.get('ends_at') as string,
        assigned_to: formData.get('assigned_to_id') as string | null,
        lead_id:     formData.get('lead_id') as string | null,
        customer_id: formData.get('customer_id') as string | null,
        notes:       formData.get('notes') as string | null,
        source:      'CRM',
    };

    await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    revalidatePath('/agenda');
}

export async function updateAppointmentStatusAction(formData: FormData) {
    const id           = formData.get('id') as string;
    const status       = formData.get('status') as string;
    const cancelReason = formData.get('cancel_reason') as string | null;

    await apiRequest(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancel_reason: cancelReason || undefined }),
    });

    revalidatePath('/agenda');
    redirect(`/agenda?selected=${id}`);
}
```

---

### PASSO 6 — Conectar `page.tsx` à API real

**Arquivo:** `apps/web/app/(crm)/agenda/page.tsx`

**Problema:** `const appointments = mockAppointments` — nunca chama a API.

**Substituir o bloco de mock:**
```typescript
import { apiRequest } from '@/lib/api';
import type { AppointmentRecord } from './types';

// Calcular range baseado na view
function getDateRange(date: Date, view: 'month' | 'week' | 'day') {
    if (view === 'month') {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        // Expandir para incluir dias visíveis de meses adjacentes
        start.setDate(start.getDate() - start.getDay()); // voltar ao domingo
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        end.setDate(end.getDate() + (6 - end.getDay())); // avançar ao sábado
        return { start, end };
    }
    // week e day: implementar quando as views forem adicionadas
    return {
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end:   new Date(date.getFullYear(), date.getMonth() + 1, 0),
    };
}

// Dentro do componente:
const { start, end } = getDateRange(currentDate, view);
const startDate = start.toISOString().split('T')[0];
const endDate   = end.toISOString().split('T')[0];

const [appointmentsRes, selectedAppointment] = await Promise.all([
    apiRequest<{ data: AppointmentRecord[] }>(
        `/appointments?start_date=${startDate}&end_date=${endDate}&limit=200`
    ).catch(() => ({ data: [] })),
    searchParams.selected
        ? apiRequest<AppointmentRecord>(`/appointments/${searchParams.selected}`).catch(() => null)
        : Promise.resolve(null),
]);

const appointments = appointmentsRes.data;
```

---

### PASSO 7 — Corrigir layout split do AppointmentSheet

**Arquivo:** `apps/web/app/(crm)/agenda/page.tsx`

**Problema:** Sheet usa `fixed inset-0` (modal overlay). PRD exige panel lateral fixo dentro do grid.

**Corrigir layout no return:**
```tsx
const hasSelection = !!selectedAppointment;

return (
    <div className="h-[calc(100vh-60px)] flex flex-col pt-4 overflow-hidden relative">
        <PageHeader
            title="Agenda"
            description="Gerencie seus agendamentos e horários para visitas e reuniões."
        />

        <div className={cn(
            'mt-4 flex-1 overflow-hidden min-h-0',
            hasSelection ? 'grid grid-cols-[1fr_400px]' : 'flex flex-col'
        )}>
            <div className="flex flex-col overflow-hidden p-0">
                <CalendarHeader currentDate={currentDate} view={view} />
                <div className="flex-1 overflow-hidden min-h-0 shrink">
                    <MonthView
                        currentDate={currentDate}
                        appointments={appointments}
                        selectedId={searchParams.selected ?? null}
                    />
                </div>
                <CalendarLegend />
            </div>

            {hasSelection && selectedAppointment && (
                <AppointmentSheet
                    appointment={selectedAppointment}
                    closeHref={`/agenda?view=${view}&date=${searchParams.date ?? ''}`}
                />
            )}
        </div>

        {searchParams.create === 'true' && <CreateAppointmentDialog />}
    </div>
);
```

---

### PASSO 8 — Reescrever `AppointmentSheet` com dados reais e state machine

**Arquivo:** `apps/web/app/(crm)/agenda/components/AppointmentSheet.tsx`

**Problema:** Props erradas, mock data hardcoded, sem state machine de botões, usa overlay modal.

**Props corretas (alinhadas ao PRD seção 2.3):**
```typescript
interface AppointmentSheetProps {
    appointment: AppointmentRecord;
    closeHref: string;
}
```

**Remover:** `"use client"`, `useRouter`, `useSearchParams`, `usePathname`, o objeto `appointment` hardcoded, e o `fixed inset-0 bg-black/40` wrapper.

**Estrutura correta — server component:**
```tsx
import Link from 'next/link';
import { X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AiContextCard } from './AiContextCard';
import { updateAppointmentStatusAction } from '../actions';
import type { AppointmentRecord } from '../types';

export function AppointmentSheet({ appointment, closeHref }: AppointmentSheetProps) {
    const clientName = appointment.lead?.name ?? appointment.customer?.name ?? 'Sem nome';
    const phone = appointment.lead?.whatsapp_number ?? appointment.customer?.whatsapp_number;
    const durationMs = new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime();
    const durationMin = Math.round(durationMs / 60000);

    return (
        <div className="h-full bg-surface-sidebar border-l border-white/5 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/5">
                <div>
                    <p className="text-sm text-brand-gold">
                        {new Date(appointment.starts_at).toLocaleString('pt-BR', {
                            weekday: 'short', day: 'numeric', month: 'long',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{durationMin} minutos</p>
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={appointment.status} />
                    <Link href={closeHref} className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                        <X className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {/* Tipo */}
                <div>
                    <h2 className="text-lg font-bold text-white">{appointment.title}</h2>
                    {/* pill de tipo — ver PRD seção 2.3 */}
                </div>

                <Separator className="bg-white/5" />

                {/* Cliente */}
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 mb-2">Cliente</p>
                    <p className="text-[15px] font-semibold text-white">{clientName}</p>
                    {phone && (
                        <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-brand-gold hover:underline mt-1 block">
                            {phone}
                        </a>
                    )}
                    {appointment.lead?.id && (
                        <Link href={`/leads?selected=${appointment.lead.id}`}
                              className="text-xs text-gray-400 hover:text-white mt-1 block">
                            Ver perfil no CRM →
                        </Link>
                    )}
                    {appointment.customer?.id && !appointment.lead?.id && (
                        <Link href={`/clientes/${appointment.customer.id}`}
                              className="text-xs text-gray-400 hover:text-white mt-1 block">
                            Ver perfil no CRM →
                        </Link>
                    )}
                </div>

                {/* Contexto IA — SOMENTE se source === WHATSAPP_BOT e context não vazio */}
                {appointment.source === 'WHATSAPP_BOT' &&
                 appointment.ai_context &&
                 Object.keys(appointment.ai_context).length > 0 && (
                    <>
                        <Separator className="bg-white/5" />
                        <AiContextCard context={appointment.ai_context} />
                    </>
                )}

                {/* Observações — SOMENTE se notas existir */}
                {appointment.notes && (
                    <>
                        <Separator className="bg-white/5" />
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 mb-2">Observações</p>
                            <p className="text-sm text-gray-400 leading-relaxed">{appointment.notes}</p>
                        </div>
                    </>
                )}

                <Separator className="bg-white/5" />

                {/* Metadados */}
                <div className="space-y-1.5 text-xs">
                    <p className="text-gray-500">Atendente: <span className="text-gray-300">{appointment.assigned_to?.name ?? 'Não atribuído'}</span></p>
                    <p className="text-gray-500">
                        Agendado por:{' '}
                        {appointment.source === 'WHATSAPP_BOT'
                            ? <span className="px-1.5 py-0.5 rounded bg-purple-500/12 text-purple-400">Bot WhatsApp</span>
                            : <span className="text-gray-300">{appointment.source === 'MANUAL' ? 'Manual' : 'CRM'}</span>
                        }
                    </p>
                    <p className="text-gray-500 font-mono">
                        {new Date(appointment.created_at).toLocaleDateString('pt-BR')}
                    </p>
                </div>
            </div>

            {/* Botões — state machine por status */}
            <ActionButtons appointment={appointment} />
        </div>
    );
}

// Componente separado para os botões — state machine conforme PRD seção 2.3
function ActionButtons({ appointment }: { appointment: AppointmentRecord }) {
    if (appointment.status === 'CONCLUIDO') {
        return (
            <div className="p-6 border-t border-white/5 text-center text-sm text-gray-500">
                Atendimento concluído
            </div>
        );
    }

    if (appointment.status === 'CANCELADO') {
        return (
            <div className="p-6 border-t border-white/5 text-center text-sm text-gray-500">
                Agendamento cancelado em {appointment.cancelled_at
                    ? new Date(appointment.cancelled_at).toLocaleDateString('pt-BR')
                    : '—'}
            </div>
        );
    }

    // AGENDADO: Confirmar + Iniciar + Reagendar + Cancelar
    // CONFIRMADO_CLIENTE: Iniciar + Reagendar + Cancelar
    // EM_ATENDIMENTO: Concluir + Cancelar
    // NAO_COMPARECEU: Reagendar
    // Ver PRD seção 2.3 para implementação completa com <form> + hidden inputs
    return (
        <div className="p-6 border-t border-white/5 bg-black/20 flex flex-col gap-3">
            {/* Implementar botões conforme state machine do PRD */}
        </div>
    );
}
```

---

### PASSO 9 — Corrigir `AppointmentPill` para colorir por tipo e seguir PRD

**Arquivo:** `apps/web/app/(crm)/agenda/components/AppointmentPill.tsx`

**Problema:** Colore por status, não por tipo. Props `compact` e `isSelected` ausentes. Texto não segue formato do PRD.

**Props corretas:**
```typescript
interface AppointmentPillProps {
    appointment: AppointmentRecord;
    compact?: boolean;
    isSelected?: boolean;
    onClick?: (appointment: AppointmentRecord) => void;
}
```

**Mapeamento de cor por tipo (substituir o mapa de status):**
```typescript
const TYPE_COLORS: Record<string, string> = {
    VISITA_PRESENCIAL: 'bg-[#C8A97A]/12 text-[#C8A97A] border-l-2 border-[#C8A97A]',
    CONSULTA_ONLINE:   'bg-blue-500/12 text-blue-400 border-l-2 border-blue-400',
    RETORNO:           'bg-emerald-500/12 text-emerald-400 border-l-2 border-emerald-400',
    ENTREGA:           'bg-orange-400/12 text-orange-400 border-l-2 border-orange-400',
    OUTRO:             'bg-gray-500/12 text-gray-400 border-l-2 border-gray-400',
};
```

**Status especiais sobrepõem as cores de tipo:**
```typescript
const statusOverride =
    appointment.status === 'CANCELADO'    ? 'opacity-35 line-through' :
    appointment.status === 'NAO_COMPARECEU' ? 'ring-1 ring-red-500/50' : '';

const selectedStyle = isSelected ? 'outline outline-2 outline-brand-gold outline-offset-1' : '';
```

**Formato de texto (PRD seção 1.6):**
```typescript
// Compact (month view): "14:00 Maria S."
// Full (week/day view): "14:00 – 14:45 · Maria Silva · Visita Presencial"
const hour = new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function abbreviateName(fullName: string): string {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return fullName;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const clientName = appointment.lead?.name ?? appointment.customer?.name ?? 'Sem nome';
const label = compact
    ? `${hour} ${abbreviateName(clientName)}`
    : `${hour} · ${clientName} · ${appointment.type}`;
```

**Classe base (PRD seção 1.6):**
```typescript
className="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer truncate block hover:brightness-125 transition"
```

**NÃO usar ícones ou emojis no pill.** Remover o `<Clock>` e o bloco multi-linha atual.

---

### PASSO 10 — Corrigir `MonthView`: limite de 3 pills + selectedId + `grid-rows-6` dinâmico

**Arquivo:** `apps/web/app/(crm)/agenda/components/MonthView.tsx`

**Props corretas (adicionar `selectedId`):**
```typescript
interface MonthViewProps {
    appointments: AppointmentRecord[];
    currentDate: Date;
    selectedId: string | null;
}
```

**Limite de 3 pills por célula:**
```tsx
const visible = dayAppointments.slice(0, 3);
const overflow = dayAppointments.length - 3;

{visible.map((app) => (
    <Link
        key={app.id}
        href={`/agenda?view=month&date=${dateStr}&selected=${app.id}`}
    >
        <AppointmentPill
            appointment={app}
            compact
            isSelected={app.id === selectedId}
        />
    </Link>
))}
{overflow > 0 && (
    <Link
        href={`/agenda?view=day&date=${dateStr}`}
        className="text-[10px] text-gray-500 hover:text-brand-gold px-1.5 mt-0.5"
    >
        +{overflow} mais
    </Link>
)}
```

**Clicar em célula vazia:**
```tsx
<div
    onClick={() => router.push(`/agenda?create=true&date=${dateStr}`)}
    ...
>
```

**Grid rows dinâmico (bug fix):**
```tsx
// Trocar grid-rows-5 fixo por:
const rowCount = days.length / 7; // 5 ou 6
<div className={`flex-1 grid grid-cols-7 grid-rows-${rowCount} overflow-y-auto`}>
```

---

### PASSO 11 — Corrigir `CreateAppointmentDialog` com zod + react-hook-form

**Arquivo:** `apps/web/app/(crm)/agenda/components/CreateAppointmentDialog.tsx`

**Problema:** Sem validação, botão principal só fecha o modal, typo "opicional".

**Adicionar:**
```typescript
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAppointmentAction } from '../actions';

const schema = z.object({
    type:       z.enum(['VISITA_PRESENCIAL', 'CONSULTA_ONLINE', 'RETORNO', 'ENTREGA', 'OUTRO']),
    date:       z.string().min(1, 'Data obrigatória'),
    time:       z.string().min(1, 'Horário obrigatório'),
    duration:   z.number().min(15).max(480).default(60),
    notes:      z.string().optional(),
    // lead_id ou customer_id: validar ao menos um
});
```

**Botão de submit:**
```tsx
// ERRADO
<Button variant="primary" onClick={handleClose}>Confirmar e Agendar</Button>

// CORRETO
<form action={createAppointmentAction}>
    {/* campos com <input name="..."> */}
    <Button type="submit" variant="primary">Confirmar e Agendar</Button>
</form>
```

**Corrigir typo:**
```
"opicional" → "opcional"
```

---

### PASSO 12 — Corrigir `LeadAppointmentsTab` para receber dados reais

**Arquivo:** `apps/web/app/(crm)/agenda/components/LeadAppointmentsTab.tsx`

**Problema:** `hasNextAppointment = true` hardcoded, dados fixos, `leadId` ignorado.

**Props corretas:**
```typescript
interface LeadAppointmentsTabProps {
    leadId: string;
    appointments: AppointmentRecord[];  // recebido do server component pai
}
```

O componente pai (perfil do lead) deve buscar `GET /appointments?lead_id={leadId}&limit=50` e passar como prop. `LeadAppointmentsTab` só renderiza — não faz fetch.

**Lógica:**
```typescript
const upcoming = appointments
    .filter(a => new Date(a.starts_at) > new Date() && a.status !== 'CANCELADO')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

const past = appointments
    .filter(a => new Date(a.starts_at) <= new Date() || a.status === 'CANCELADO')
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

const nextAppointment = upcoming[0] ?? null;
const hasNextAppointment = !!nextAppointment; // ← não mais hardcoded
```

---

### PASSO 13 — Mover tab "Agenda" para primeira posição

**Arquivo:** `apps/web/app/(crm)/clientes/[id]/components/ClientTabs.tsx`

**Problema:** PRD especifica "Agenda" como PRIMEIRA tab. Está como segunda.

```typescript
const TABS: Tab[] = [
  { key: 'agenda', label: 'Agenda' },    // ← mover para primeiro
  { key: 'ficha', label: 'Ficha' },
  { key: 'atendimento', label: 'Atendimento' },
  // ...resto igual
];
```

Verificar também se o tab padrão (`defaultTab` ou estado inicial) precisa ser atualizado.

---

## Checklist de validação pós-correção

Após implementar todos os passos, verificar:

- [ ] `tsc --noEmit` sem erros
- [ ] `docker compose up -d` sobe sem erros
- [ ] Calendário do mês atual mostra appointments reais da API (não mock)
- [ ] Navegar ‹ › muda o mês E a URL usa `?date=YYYY-MM-DD&view=month`
- [ ] Clicar em pill abre sheet lateral (não modal overlay) com dados reais do appointment
- [ ] Sheet mostra botões corretos por status (ex: CONCLUIDO não mostra botões)
- [ ] Botão "Confirmar" no sheet chama PATCH /appointments/:id/status
- [ ] Clicar em "+ Novo Agendamento" abre dialog
- [ ] Preencher e submeter o form cria appointment real via POST /appointments
- [ ] Meses com 6 semanas (ex: março 2026) renderizam 42 células corretamente
- [ ] Célula com mais de 3 appointments mostra "+N mais"
- [ ] Pills colorem por tipo (dourado = visita, azul = online, verde = retorno, laranja = entrega)
- [ ] Pill de appointment CANCELADO tem opacity-35 e text line-through
- [ ] Pill selected tem outline dourado
- [ ] Tab "Agenda" é a primeira tab no perfil de cliente
- [ ] LeadAppointmentsTab mostra dados reais do lead (não hardcoded)
- [ ] Sidebar usa ícone CalendarDays (com bolinhas)
