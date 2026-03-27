export function CalendarLegend() {
    return (
        <div className="mt-6 flex flex-wrap items-center gap-6 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-gray-400">
            <span className="font-medium text-gray-300">Legenda:</span>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                Agendado
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                Confirmado/Concluído
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                No Show
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                Cancelado/Reagendado
            </div>
        </div>
    );
}
