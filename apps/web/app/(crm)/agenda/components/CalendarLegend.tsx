/**
 * CalendarLegend — Moved from bottom of page to header area for better discoverability.
 * Compact inline layout designed to sit near the calendar controls.
 */
export function CalendarLegend() {
    return (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 text-xs text-gray-400 shrink-0">
            <span className="font-medium text-gray-300 text-[10px] uppercase tracking-wider">Legenda:</span>
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                Agendado
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                Confirmado
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                Em Atendimento
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                Concluído
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                No Show
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                Cancelado
            </div>
        </div>
    );
}
