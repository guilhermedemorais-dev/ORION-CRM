"use client"
import type { AppointmentRecord } from "../types";
import { AppointmentPill } from "./AppointmentPill";
import { DayPopover } from "./DayPopover";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// helper to get all days to display in the month view grid
function getDaysInMonthView(currentDate: Date) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Previous month's trailing days
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    for (let i = firstDayOfWeek; i > 0; i--) {
        days.push(new Date(year, month, 1 - i));
    }
    
    // Current month's days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        days.push(new Date(year, month, i));
    }
    
    // Next month's leading days (to fill 35 or 42 grid cells)
    const totalDays = days.length;
    const remainingCells = totalDays > 35 ? 42 - totalDays : 35 - totalDays;
    
    for (let i = 1; i <= remainingCells; i++) {
        days.push(new Date(year, month + 1, i));
    }
    
    return days;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function MonthView({ 
    currentDate, 
    appointments,
    selectedId
}: { 
    currentDate: Date;
    appointments: AppointmentRecord[];
    selectedId?: string | null;
}) {
    const days = getDaysInMonthView(currentDate);
    const weeks = days.length / 7;
    const gridRowClass = weeks === 6 ? 'grid-rows-6' : 'grid-rows-5';

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // safe client-side date comparison
    const [todayStr, setTodayStr] = useState('');
    useEffect(() => {
        setTodayStr(new Date().toISOString().split('T')[0]);
    }, []);

    // DayPopover state — mini popup ancorado na célula do dia ao clicar "+N mais".
    const [popoverDay, setPopoverDay] = useState<{
        date: Date;
        items: AppointmentRecord[];
        anchor: { top: number; left: number; width: number; height: number };
    } | null>(null);

    const handleAppointmentClick = (appointment: AppointmentRecord) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('selected', appointment.id);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleMoreClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        date: Date,
        items: AppointmentRecord[]
    ) => {
        // Âncora = bounding rect da célula do dia (pai do botão até 2 níveis acima).
        // .closest('[data-day-cell]') é mais robusto que `currentTarget.parentElement`.
        const target = event.currentTarget;
        const cell = target.closest('[data-day-cell]') as HTMLElement | null;
        const rect = (cell ?? target).getBoundingClientRect();
        setPopoverDay({
            date,
            items,
            anchor: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        });
    };

    return (
        <div className="flex flex-col rounded-xl border border-white/5 bg-surface-sidebar overflow-hidden h-full shadow-lg">
            {/* Header / Weekdays */}
            <div className="grid grid-cols-7 border-b border-white/5 bg-black/20 shrink-0">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Grid */}
            <div className={cn("flex-1 grid grid-cols-7 overflow-y-auto", gridRowClass)}>
                {days.map((date, i) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                    const isToday = dateStr === todayStr;
                    
                    // FIX: Deduplicate events by ID to prevent duplicate rendering
                    const dayAppointments = appointments
                        .filter((app) => app.starts_at && app.starts_at.startsWith(dateStr))
                        .filter((app, idx, arr) => arr.findIndex(a => a.id === app.id) === idx)
                        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
                    
                    const visibleApps = dayAppointments.slice(0, 3);
                    const hiddenCount = dayAppointments.length - 3;
                    
                    return (
                        <div
                            key={i}
                            data-day-cell
                            className={cn(
                                "flex flex-col border-r border-b border-white/5 p-1.5 transition-colors hover:bg-white/[0.02] min-h-0",
                                !isCurrentMonth && "bg-black/10 text-gray-600",
                                isToday && "bg-brand-gold/5"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-medium shrink-0",
                                    isToday
                                        ? "bg-brand-gold text-black font-bold outline outline-1 outline-offset-1 outline-brand-gold/40"
                                        : (isCurrentMonth ? "text-gray-300" : "text-gray-600")
                                )}>
                                    {date.getDate()}
                                </span>
                            </div>
                            
                            <div className="flex-1 overflow-hidden flex flex-col gap-1 pr-0.5 min-h-0">
                                {visibleApps.map((app) => (
                                    <AppointmentPill
                                        key={app.id}
                                        appointment={app}
                                        selected={app.id === selectedId}
                                        onClick={handleAppointmentClick}
                                        compact
                                    />
                                ))}
                                {hiddenCount > 0 && (
                                    <button
                                        type="button"
                                        className="w-full text-[10px] text-gray-400 hover:text-white font-semibold py-0.5 text-left px-1 transition-colors shrink-0"
                                        onClick={(e) => handleMoreClick(e, date, dayAppointments)}
                                    >
                                        +{hiddenCount} mais
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {popoverDay && (
                <DayPopover
                    date={popoverDay.date}
                    appointments={popoverDay.items}
                    selectedId={selectedId ?? null}
                    anchor={popoverDay.anchor}
                    onClose={() => setPopoverDay(null)}
                    onAppointmentClick={handleAppointmentClick}
                />
            )}
        </div>
    );
}
