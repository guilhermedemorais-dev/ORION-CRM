import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "../types";
import { Clock } from "lucide-react";

interface AppointmentPillProps {
    appointment: AppointmentRecord;
    selected?: boolean;
    onClick: (appointment: AppointmentRecord) => void;
}

export function AppointmentPill({ appointment, selected, onClick }: AppointmentPillProps) {
    const timeString = new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Status colors mapping based on PRD
    const colorClasses = {
        'VISITA_PRESENCIAL': 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
        'CONSULTA_ONLINE':   'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20',
        'RETORNO':           'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20',
        'ENTREGA':           'border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20',
        'OUTRO':             'border-gray-500/30 bg-gray-500/10 text-gray-300 hover:bg-gray-500/20',
    }[appointment.type] || 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10';

    const clientName = appointment.customer?.name || appointment.lead?.name || 'Cliente Não Informado';
    const userName = appointment.assigned_to?.name || 'Atendente';

    return (
        <button 
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick(appointment);
            }}
            className={cn(
                "w-full text-left flex flex-col gap-0.5 px-2 py-1.5 rounded-md border text-xs transition-colors",
                colorClasses,
                selected && "ring-2 ring-brand-gold outline-none"
            )}
        >
            <div className="flex items-center justify-between gap-1">
                <span className="font-semibold truncate">{appointment.type}</span>
                <div className="flex items-center gap-1 shrink-0 opacity-80 text-[10px]">
                    <Clock className="w-3 h-3" />
                    <span>{timeString}</span>
                </div>
            </div>
            
            <span className="truncate opacity-90 text-[11px]">{clientName}</span>
            <span className="truncate opacity-70 text-[10px] mt-0.5">Com {userName}</span>
        </button>
    );
}
