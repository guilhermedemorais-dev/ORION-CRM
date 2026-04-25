"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AppointmentRecord } from "../../types";
import { toDateParam } from "../../lib/dateRange";

const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_BG: Record<string, string> = {
    AGENDADO:           'bg-blue-500/20 border-blue-500/60 text-blue-100',
    CONFIRMADO_CLIENTE: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-100',
    EM_ATENDIMENTO:     'bg-amber-500/25 border-amber-500/60 text-amber-100',
    CONCLUIDO:          'bg-green-500/20 border-green-500/60 text-green-100',
    CANCELADO:          'bg-gray-500/15 border-gray-500/40 text-gray-300 line-through opacity-70',
    NAO_COMPARECEU:     'bg-rose-500/15 border-rose-500/50 text-rose-200 opacity-80',
};

interface PositionedEvent {
    appointment: AppointmentRecord;
    top: number;
    height: number;
    col: number;
    totalCols: number;
}

function formatTypeName(raw: string): string {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** Layout overlapping events into stacked columns within each cluster of overlap. */
function layoutDayEvents(events: AppointmentRecord[], dayStart: Date): PositionedEvent[] {
    const dayMs = dayStart.getTime();
    const dayEndMs = dayMs + 24 * 60 * 60 * 1000;

    const sorted = [...events]
        .filter((ev) => {
            const s = new Date(ev.starts_at).getTime();
            const e = new Date(ev.ends_at).getTime();
            return e > dayMs && s < dayEndMs;
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const result: PositionedEvent[] = [];
    let cluster: AppointmentRecord[] = [];
    let clusterEnd = 0;

    const flush = () => {
        if (!cluster.length) return;
        const cols: AppointmentRecord[][] = [];
        const positions = new Map<string, number>();
        for (const ev of cluster) {
            const s = new Date(ev.starts_at).getTime();
            let placed = false;
            for (let i = 0; i < cols.length; i++) {
                const last = cols[i][cols[i].length - 1];
                if (new Date(last.ends_at).getTime() <= s) {
                    cols[i].push(ev);
                    positions.set(ev.id, i);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                positions.set(ev.id, cols.length);
                cols.push([ev]);
            }
        }
        const totalCols = cols.length;
        for (const ev of cluster) {
            const s = Math.max(new Date(ev.starts_at).getTime(), dayMs);
            const e = Math.min(new Date(ev.ends_at).getTime(), dayEndMs);
            const startMin = (s - dayMs) / 60000;
            const durationMin = Math.max((e - s) / 60000, 15);
            result.push({
                appointment: ev,
                top: startMin * PX_PER_MIN,
                height: durationMin * PX_PER_MIN,
                col: positions.get(ev.id) ?? 0,
                totalCols,
            });
        }
        cluster = [];
        clusterEnd = 0;
    };

    for (const ev of sorted) {
        const s = new Date(ev.starts_at).getTime();
        const e = new Date(ev.ends_at).getTime();
        if (cluster.length && s >= clusterEnd) flush();
        cluster.push(ev);
        clusterEnd = Math.max(clusterEnd, e);
    }
    flush();

    return result;
}

interface TimeGridViewProps {
    days: Date[];
    appointments: AppointmentRecord[];
    selectedId?: string | null;
}

export function TimeGridView({ days, appointments, selectedId }: TimeGridViewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(id);
    }, []);

    // Auto-scroll to ~7am on first render
    useEffect(() => {
        if (scrollerRef.current) {
            scrollerRef.current.scrollTop = 7 * HOUR_PX;
        }
    }, []);

    const handleClick = (app: AppointmentRecord) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('selected', app.id);
        router.push(`${pathname}?${params.toString()}`);
    };

    const todayStr = now ? toDateParam(now) : '';

    return (
        <div className="flex flex-col rounded-xl border border-white/5 bg-surface-sidebar overflow-hidden h-full shadow-lg">
            {/* Day headers */}
            <div className="grid border-b border-white/5 bg-black/20 shrink-0" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="py-2.5" />
                {days.map((d, i) => {
                    const dayStr = toDateParam(d);
                    const isToday = dayStr === todayStr;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "py-2 text-center border-l border-white/5",
                                isToday && "bg-brand-gold/5"
                            )}
                        >
                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                {WEEKDAYS_SHORT[d.getDay()]}
                            </div>
                            <div className={cn(
                                "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold",
                                isToday ? "bg-brand-gold text-black" : "text-gray-200"
                            )}>
                                {d.getDate()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Time grid scroller */}
            <div ref={scrollerRef} className="flex-1 overflow-y-auto relative">
                <div
                    className="grid relative"
                    style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`, height: HOUR_PX * 24 }}
                >
                    {/* Hours column */}
                    <div className="border-r border-white/5">
                        {HOURS.map((h) => (
                            <div
                                key={h}
                                style={{ height: HOUR_PX }}
                                className="text-[10px] text-gray-500 text-right pr-2 -translate-y-1.5"
                            >
                                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {days.map((day, idx) => {
                        const dayStart = startOfDay(day);
                        const positioned = layoutDayEvents(appointments, dayStart);
                        const dayStr = toDateParam(day);
                        const isToday = dayStr === todayStr;
                        const nowMin = now && isToday ? now.getHours() * 60 + now.getMinutes() : null;

                        return (
                            <div
                                key={idx}
                                className={cn(
                                    "relative border-l border-white/5",
                                    isToday && "bg-brand-gold/[0.03]"
                                )}
                            >
                                {/* Hour grid lines */}
                                {HOURS.map((h) => (
                                    <div
                                        key={h}
                                        style={{ top: h * HOUR_PX, height: HOUR_PX }}
                                        className="absolute left-0 right-0 border-t border-white/5"
                                    />
                                ))}

                                {/* Now indicator */}
                                {nowMin !== null && (
                                    <div
                                        className="absolute left-0 right-0 z-20 pointer-events-none"
                                        style={{ top: nowMin * PX_PER_MIN }}
                                    >
                                        <div className="relative">
                                            <div className="h-[2px] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                            <div className="absolute -top-[4px] -left-1 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                                        </div>
                                    </div>
                                )}

                                {/* Events */}
                                {positioned.map(({ appointment, top, height, col, totalCols }) => {
                                    const widthPct = 100 / totalCols;
                                    const leftPct = widthPct * col;
                                    const colorClass = STATUS_BG[appointment.status] ?? STATUS_BG.AGENDADO;
                                    const time = new Date(appointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                    const clientName = appointment.customer?.name || appointment.lead?.name || '';
                                    const typeName = formatTypeName(appointment.type);
                                    const label = clientName || typeName;
                                    const tooltip = clientName ? `${time} — ${clientName} (${typeName})` : `${time} — ${typeName}`;
                                    const compact = height < 36;
                                    return (
                                        <button
                                            type="button"
                                            key={appointment.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleClick(appointment);
                                            }}
                                            title={tooltip}
                                            className={cn(
                                                "absolute z-10 rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11px] transition-all hover:z-20 hover:shadow-lg overflow-hidden",
                                                colorClass,
                                                appointment.id === selectedId && "ring-1 ring-brand-gold ring-offset-1 ring-offset-transparent z-20"
                                            )}
                                            style={{
                                                top,
                                                height: Math.max(height - 2, 22),
                                                left: `calc(${leftPct}% + 2px)`,
                                                width: `calc(${widthPct}% - 4px)`,
                                            }}
                                        >
                                            {compact ? (
                                                <div className="flex items-center gap-1 truncate">
                                                    <span className="opacity-75 shrink-0">{time}</span>
                                                    <span className="font-semibold truncate">{label}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-[10px] opacity-75">{time}</div>
                                                    <div className="font-semibold truncate">{label}</div>
                                                    {height > 60 && clientName && (
                                                        <div className="text-[10px] opacity-70 truncate">{typeName}</div>
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
