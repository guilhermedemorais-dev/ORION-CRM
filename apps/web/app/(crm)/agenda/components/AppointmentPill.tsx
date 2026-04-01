import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "../types";

interface AppointmentPillProps {
    appointment: AppointmentRecord;
    selected?: boolean;
    onClick: (appointment: AppointmentRecord) => void;
}

// Color by status — simple left-border stripe like Google Calendar
const STATUS_COLORS: Record<string, string> = {
    'AGENDADO':           'border-l-blue-500 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25',
    'CONFIRMADO_CLIENTE': 'border-l-emerald-500 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25',
    'EM_ATENDIMENTO':     'border-l-amber-500 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25',
    'CONCLUIDO':          'border-l-gray-500 bg-gray-500/10 text-gray-400 hover:bg-gray-500/20',
    'CANCELADO':          'border-l-rose-500 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 line-through opacity-60',
    'NAO_COMPARECEU':     'border-l-orange-500 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 opacity-60',
};

export function AppointmentPill({ appointment, selected, onClick }: AppointmentPillProps) {
    const timeString = new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const clientName = appointment.customer?.name || appointment.lead?.name || '';
    const colorClass = STATUS_COLORS[appointment.status] || STATUS_COLORS['AGENDADO'];

    return (
        <button 
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick(appointment);
            }}
            className={cn(
                "w-full text-left border-l-[3px] rounded-r-[4px] px-1.5 py-[3px] text-[11px] font-medium truncate transition-all cursor-pointer",
                colorClass,
                selected && "ring-1 ring-brand-gold ring-offset-1 ring-offset-transparent"
            )}
            title={`${timeString} — ${clientName || appointment.type}`}
        >
            <span className="opacity-75">{timeString}</span>
            {' '}
            <span className="font-semibold">{clientName || appointment.type}</span>
        </button>
    );
}
