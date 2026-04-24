"use client";

import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function CalendarHeader({
    currentDate,
    view = 'month',
}: {
    currentDate: Date;
    view?: 'month' | 'week' | 'day';
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // ensure reliable uppercase month rendering
    const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    
    // helper to change month
    const changeMonth = (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + offset);
        
        const params = new URLSearchParams(searchParams.toString());
        // YYYY-MM-DD
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const day = String(newDate.getDate()).padStart(2, '0');
        params.set('date', `${year}-${month}-${day}`);
        params.set('view', searchParams.get('view') ?? 'month'); 
        router.push(`${pathname}?${params.toString()}`);
    };

    const goToday = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('date');
        params.set('view', searchParams.get('view') ?? 'month');
        router.push(`${pathname}?${params.toString()}`);
    };

    const openNewAppointment = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('create', 'true');
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            {/* Left controls */}
            <div className="flex items-center gap-4 min-w-0">
                {/* FIX: flex-shrink-0 + truncate on title to prevent wrapping when detail panel compresses layout */}
                <h1 className="text-2xl font-semibold text-white capitalize shrink-0 truncate max-w-[220px] lg:max-w-none">{monthLabel}</h1>
                <div className="flex items-center gap-1 bg-surface-sidebar rounded-md p-1 border border-white/5 shrink-0">
                    <button onClick={() => changeMonth(-1)} className="p-1 text-gray-400 hover:text-white transition-colors" title="Mês anterior">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={goToday} className="px-3 py-1 text-sm text-gray-300 hover:text-white font-medium transition-colors">
                        Hoje
                    </button>
                    <button onClick={() => changeMonth(1)} className="p-1 text-gray-400 hover:text-white transition-colors" title="Próximo mês">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 shrink-0">
                {/* FIX: Toggle visibility on mobile restored + "Semana" button now clearly disabled */}
                <div className="hidden sm:flex items-center bg-surface-sidebar rounded-md p-1 border border-white/5 mr-2">
                    <button className="px-3 py-1.5 text-xs font-medium bg-brand-gold/10 text-brand-gold rounded transition-colors flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        Mês
                    </button>
                    {/* FIX: Clear disabled state with opacity, cursor-not-allowed, and "(Em breve)" label */}
                    <button 
                        disabled
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors flex items-center gap-2 cursor-not-allowed opacity-40 relative"
                        title="Visualização semanal — Em breve"
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Semana
                        <span className="text-[8px] font-bold uppercase tracking-wide text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded-sm leading-none">
                            Em breve
                        </span>
                    </button>
                </div>
                <Button onClick={openNewAppointment} icon={<Plus className="w-4 h-4" />}>
                    <span className="hidden sm:inline">Novo Agendamento</span>
                    <span className="sm:hidden">Novo</span>
                </Button>
            </div>
        </div>
    );
}
