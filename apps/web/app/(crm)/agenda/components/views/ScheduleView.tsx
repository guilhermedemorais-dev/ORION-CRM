"use client";

import { CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AppointmentRecord } from "../../types";
import { toDateParam } from "../../lib/dateRange";

const STATUS_DOT: Record<string, string> = {
    AGENDADO:           'bg-blue-500',
    CONFIRMADO_CLIENTE: 'bg-emerald-500',
    EM_ATENDIMENTO:     'bg-amber-500',
    CONCLUIDO:          'bg-green-500',
    CANCELADO:          'bg-gray-500',
    NAO_COMPARECEU:     'bg-rose-500',
};

const STATUS_LABEL: Record<string, string> = {
    AGENDADO:           'Agendado',
    CONFIRMADO_CLIENTE: 'Confirmado',
    EM_ATENDIMENTO:     'Em atendimento',
    CONCLUIDO:          'Concluído',
    CANCELADO:          'Cancelado',
    NAO_COMPARECEU:     'No show',
};

function formatTypeName(raw: string): string {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayHeader(d: Date, todayStr: string): string {
    const ds = toDateParam(d);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (ds === todayStr) return 'Hoje';
    if (ds === toDateParam(tomorrow)) return 'Amanhã';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ScheduleView({
    currentDate,
    appointments,
    selectedId,
}: {
    currentDate: Date;
    appointments: AppointmentRecord[];
    selectedId?: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const todayStr = toDateParam(new Date());

    // Group by date string
    const grouped = new Map<string, AppointmentRecord[]>();
    const sorted = [...appointments]
        .filter((a) => a.starts_at)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    for (const ap of sorted) {
        const key = ap.starts_at.slice(0, 10);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(ap);
    }

    const handleClick = (app: AppointmentRecord) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('selected', app.id);
        router.push(`${pathname}?${params.toString()}`);
    };

    if (grouped.size === 0) {
        return (
            <div className="h-full rounded-xl border border-white/5 bg-surface-sidebar shadow-lg flex flex-col items-center justify-center text-center p-8">
                <CalendarX className="w-10 h-10 text-gray-600 mb-3" />
                <h3 className="text-base font-semibold text-gray-300">Nenhum agendamento</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Não há agendamentos nos próximos 30 dias a partir de {currentDate.toLocaleDateString('pt-BR')}.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto rounded-xl border border-white/5 bg-surface-sidebar shadow-lg">
            <div className="divide-y divide-white/5">
                {Array.from(grouped.entries()).map(([dateKey, items]) => {
                    const date = new Date(dateKey + 'T12:00:00');
                    const isToday = dateKey === todayStr;
                    return (
                        <div key={dateKey} className="px-4 sm:px-6 py-4">
                            <div className="flex items-baseline gap-3 mb-3">
                                <span className={cn(
                                    "text-[13px] font-semibold capitalize",
                                    isToday ? "text-brand-gold" : "text-white"
                                )}>
                                    {dayHeader(date, todayStr)}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                    {date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="text-[11px] text-gray-600">
                                    {items.length} {items.length === 1 ? 'evento' : 'eventos'}
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {items.map((ap) => {
                                    const time = new Date(ap.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                    const endTime = new Date(ap.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                    const clientName = ap.customer?.name || ap.lead?.name || '';
                                    const typeName = formatTypeName(ap.type);
                                    return (
                                        <button
                                            key={ap.id}
                                            type="button"
                                            onClick={() => handleClick(ap)}
                                            className={cn(
                                                "w-full flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] hover:border-white/10",
                                                ap.id === selectedId && "bg-brand-gold/10 border-brand-gold/30"
                                            )}
                                        >
                                            <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", STATUS_DOT[ap.status] ?? STATUS_DOT.AGENDADO)} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                    <span className="text-[13px] font-semibold text-white truncate">
                                                        {clientName || typeName}
                                                    </span>
                                                    <span className="text-[11px] text-gray-500">
                                                        {time}–{endTime}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 mt-0.5">
                                                    <span>{typeName}</span>
                                                    <span className="text-gray-600">•</span>
                                                    <span>{STATUS_LABEL[ap.status] ?? ap.status}</span>
                                                    {ap.assigned_to?.name && (
                                                        <>
                                                            <span className="text-gray-600">•</span>
                                                            <span className="truncate">{ap.assigned_to.name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
