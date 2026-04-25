"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "../../types";
import { toDateParam } from "../../lib/dateRange";

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function buildMonthDays(year: number, month: number): (Date | null)[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

export function YearView({
    currentDate,
    appointments,
}: {
    currentDate: Date;
    appointments: AppointmentRecord[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const year = currentDate.getFullYear();
    const [todayStr, setTodayStr] = useState('');

    useEffect(() => {
        setTodayStr(toDateParam(new Date()));
    }, []);

    // Index appointments by date string for quick lookup
    const byDate = new Map<string, number>();
    for (const ap of appointments) {
        if (!ap.starts_at) continue;
        const key = ap.starts_at.slice(0, 10);
        byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }

    const goToDay = (d: Date) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', 'day');
        params.set('date', toDateParam(d));
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="h-full overflow-y-auto rounded-xl border border-white/5 bg-surface-sidebar p-4 sm:p-6 shadow-lg">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {MONTH_NAMES.map((name, idx) => {
                    const cells = buildMonthDays(year, idx);
                    return (
                        <div
                            key={idx}
                            className="rounded-lg border border-white/5 bg-black/20 p-3"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams.toString());
                                    params.set('view', 'month');
                                    params.set('date', toDateParam(new Date(year, idx, 1)));
                                    router.push(`${pathname}?${params.toString()}`);
                                }}
                                className="text-[12px] font-semibold text-gray-200 uppercase tracking-wide mb-2 hover:text-brand-gold transition-colors"
                            >
                                {name}
                            </button>
                            <div className="grid grid-cols-7 gap-0.5 text-[10px]">
                                {WEEKDAYS_MIN.map((w, i) => (
                                    <div key={`h-${i}`} className="text-center text-gray-500 font-semibold py-1">
                                        {w}
                                    </div>
                                ))}
                                {cells.map((d, i) => {
                                    if (!d) return <div key={`e-${i}`} />;
                                    const ds = toDateParam(d);
                                    const isToday = ds === todayStr;
                                    const count = byDate.get(ds) ?? 0;
                                    return (
                                        <button
                                            key={`d-${i}`}
                                            type="button"
                                            onClick={() => goToDay(d)}
                                            className={cn(
                                                "relative aspect-square flex items-center justify-center rounded text-[11px] transition-colors",
                                                isToday
                                                    ? "bg-brand-gold text-black font-bold"
                                                    : count > 0
                                                        ? "text-white hover:bg-white/10"
                                                        : "text-gray-500 hover:bg-white/5"
                                            )}
                                            title={count > 0 ? `${count} agendamento${count > 1 ? 's' : ''}` : undefined}
                                        >
                                            {d.getDate()}
                                            {!isToday && count > 0 && (
                                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-gold" />
                                            )}
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
