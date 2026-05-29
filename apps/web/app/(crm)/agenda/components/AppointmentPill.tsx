import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "../types";

interface AppointmentPillProps {
    appointment: AppointmentRecord;
    selected?: boolean;
    onClick: (appointment: AppointmentRecord) => void;
    /** Modo compacto (h-5, texto menor) — usado em células do MonthView onde há
     *  pouco espaço vertical. Demais views (Day/Week/Schedule) usam o padrão WCAG. */
    compact?: boolean;
}

// Esquema compact = bullet colorido + texto plano (estilo Google Agenda "lista").
// Esquema padrão (Day/Week/Schedule) = border-left + fundo translúcido (mais denso).
const STATUS_DOT: Record<string, string> = {
    'AGENDADO':           'bg-blue-500',
    'CONFIRMADO_CLIENTE': 'bg-emerald-500',
    'EM_ATENDIMENTO':     'bg-amber-500',
    'CONCLUIDO':          'bg-green-500',
    'CANCELADO':          'bg-gray-500',
    'NAO_COMPARECEU':     'bg-rose-500',
};

const STATUS_TEXT_COMPACT: Record<string, string> = {
    'AGENDADO':           'text-gray-200',
    'CONFIRMADO_CLIENTE': 'text-gray-200',
    'EM_ATENDIMENTO':     'text-gray-200',
    'CONCLUIDO':          'text-gray-400',
    'CANCELADO':          'text-gray-500 line-through',
    'NAO_COMPARECEU':     'text-gray-500',
};

const STATUS_COLORS: Record<string, string> = {
    'AGENDADO':           'border-l-blue-500 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25',
    'CONFIRMADO_CLIENTE': 'border-l-emerald-500 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25',
    'EM_ATENDIMENTO':     'border-l-amber-500 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25',
    'CONCLUIDO':          'border-l-green-500 bg-green-500/15 text-green-300 hover:bg-green-500/25',
    'CANCELADO':          'border-l-gray-500 bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 line-through opacity-60',
    'NAO_COMPARECEU':     'border-l-rose-500 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 opacity-60',
};

/** Sanitize event type names — remove ALL_CAPS_UNDERSCORE format from raw DB values */
function formatEventName(raw: string): string {
    return raw
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AppointmentPill({ appointment, selected, onClick, compact = false }: AppointmentPillProps) {
    const timeString = new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const clientName = appointment.customer?.name || appointment.lead?.name || '';
    const formattedType = formatEventName(appointment.type);
    const displayLabel = clientName || formattedType;

    // Full tooltip text with client name + type for truncated events
    const tooltipText = clientName
        ? `${timeString} — ${clientName} (${formattedType})`
        : `${timeString} — ${formattedType}`;

    if (compact) {
        // Estilo Google Agenda "lista": bullet colorido + texto plano (sem fundo).
        const dotClass = STATUS_DOT[appointment.status] || STATUS_DOT['AGENDADO'];
        const textClass = STATUS_TEXT_COMPACT[appointment.status] || STATUS_TEXT_COMPACT['AGENDADO'];
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClick(appointment); }}
                title={tooltipText}
                className={cn(
                    "w-full text-left text-[11px] truncate cursor-pointer flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-white/5 transition-colors shrink-0",
                    selected && "ring-1 ring-brand-gold/60"
                )}
            >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClass)} aria-hidden="true" />
                <span className={cn("shrink-0 tabular-nums", textClass, "opacity-70")}>{timeString}</span>
                <span className={cn("font-medium truncate", textClass)}>{displayLabel}</span>
            </button>
        );
    }

    const colorClass = STATUS_COLORS[appointment.status] || STATUS_COLORS['AGENDADO'];
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(appointment); }}
            className={cn(
                "w-full text-left font-medium truncate transition-all cursor-pointer flex items-center gap-1 shrink-0 rounded-r-[4px] border-l-[3px] px-2 py-1.5 text-[11px] min-h-[44px]",
                colorClass,
                selected && "ring-1 ring-brand-gold ring-offset-1 ring-offset-transparent"
            )}
            title={tooltipText}
        >
            <span className="shrink-0 opacity-75">{timeString}</span>
            <span className="font-semibold truncate">{displayLabel}</span>
        </button>
    );
}
