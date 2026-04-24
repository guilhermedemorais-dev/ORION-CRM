import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "../types";

interface AppointmentPillProps {
    appointment: AppointmentRecord;
    selected?: boolean;
    onClick: (appointment: AppointmentRecord) => void;
}

// Color by status — simple left-border stripe like Google Calendar
// FIX: CONCLUIDO now uses green (matching the legend "Confirmado/Concluído" = verde)
// FIX: CANCELADO uses gray (matching the legend "Cancelado/Reagendado" = cinza)
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

export function AppointmentPill({ appointment, selected, onClick }: AppointmentPillProps) {
    const timeString = new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const clientName = appointment.customer?.name || appointment.lead?.name || '';
    const formattedType = formatEventName(appointment.type);
    const displayLabel = clientName || formattedType;
    const colorClass = STATUS_COLORS[appointment.status] || STATUS_COLORS['AGENDADO'];

    // Full tooltip text with client name + type for truncated events
    const tooltipText = clientName
        ? `${timeString} — ${clientName} (${formattedType})`
        : `${timeString} — ${formattedType}`;

    return (
        <button 
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick(appointment);
            }}
            className={cn(
                // FIX: min-h-[44px] ensures WCAG 2.5.5 touch target compliance (was 22.5px)
                "w-full text-left border-l-[3px] rounded-r-[4px] px-2 py-1.5 text-[11px] font-medium truncate transition-all cursor-pointer min-h-[44px] flex items-center gap-1",
                colorClass,
                selected && "ring-1 ring-brand-gold ring-offset-1 ring-offset-transparent"
            )}
            title={tooltipText}
        >
            <span className="opacity-75 shrink-0">{timeString}</span>
            {' '}
            <span className="font-semibold truncate">{displayLabel}</span>
        </button>
    );
}
