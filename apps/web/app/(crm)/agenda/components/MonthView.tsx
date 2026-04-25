"use client"
import type { AppointmentRecord } from "../types";
import { AppointmentPill } from "./AppointmentPill";
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

    const handleAppointmentClick = (appointment: AppointmentRecord) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('selected', appointment.id);
        router.push(`${pathname}?${params.toString()}`);
    };
    
    const handleMoreClick = (dateStr: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', 'day');
        params.set('date', dateStr);
        router.push(`${pathname}?${params.toString()}`);
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
                            className={cn(
                                "flex flex-col border-r border-b border-white/5 p-2 transition-colors hover:bg-white/[0.02]",
                                !isCurrentMonth && "bg-black/10 text-gray-600",
                                isToday && "bg-brand-gold/5" // Highlight row or just the cell
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                                    isToday ? "bg-brand-gold text-black font-bold outline outline-2 outline-offset-2 outline-brand-gold/30" : (isCurrentMonth ? "text-gray-300" : "text-gray-600")
                                )}>
                                    {date.getDate()}
                                </span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                                {visibleApps.map((app) => (
                                    <AppointmentPill 
                                        key={app.id} 
                                        appointment={app} 
                                        selected={app.id === selectedId}
                                        onClick={handleAppointmentClick}
                                    />
                                ))}
                                {hiddenCount > 0 && (
                                    <div 
                                        className="text-[10px] text-center text-gray-500 font-medium py-0.5 mt-1 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleMoreClick(dateStr)}
                                    >
                                        Ver mais (+{hiddenCount})
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
