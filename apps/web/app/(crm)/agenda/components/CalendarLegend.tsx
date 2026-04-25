"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
    { label: 'Agendado',       color: 'bg-blue-500',    glow: 'rgba(59,130,246,0.6)' },
    { label: 'Confirmado',     color: 'bg-emerald-500', glow: 'rgba(16,185,129,0.6)' },
    { label: 'Em Atendimento', color: 'bg-amber-500',   glow: 'rgba(245,158,11,0.6)' },
    { label: 'Concluído',      color: 'bg-green-500',   glow: 'rgba(34,197,94,0.6)' },
    { label: 'No Show',        color: 'bg-rose-500',    glow: 'rgba(244,63,94,0.6)' },
    { label: 'Cancelado',      color: 'bg-gray-500',    glow: 'rgba(107,114,128,0.4)' },
];

/** Inline (xl+) — full labels visible. */
export function CalendarLegendInline({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center gap-3 text-[11px] text-gray-400", className)}>
            {ITEMS.map((it) => (
                <div key={it.label} className="flex items-center gap-1.5">
                    <span
                        className={cn("h-2 w-2 rounded-full", it.color)}
                        style={{ boxShadow: `0 0 6px ${it.glow}` }}
                    />
                    {it.label}
                </div>
            ))}
        </div>
    );
}

/** Dots-only (lg) — color pills with tooltip on hover. */
export function CalendarLegendDots({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            {ITEMS.map((it) => (
                <span
                    key={it.label}
                    className={cn("h-2 w-2 rounded-full cursor-help", it.color)}
                    style={{ boxShadow: `0 0 6px ${it.glow}` }}
                    title={it.label}
                />
            ))}
        </div>
    );
}

/** Popover trigger (md and below) — info icon opens a small panel. */
export function CalendarLegendPopover({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    return (
        <div ref={ref} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "h-9 w-9 inline-flex items-center justify-center rounded-md border text-gray-400 transition-colors",
                    open
                        ? "bg-white/10 border-white/15 text-white"
                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:text-white"
                )}
                aria-label="Legenda de status"
                aria-expanded={open}
            >
                <Info className="h-4 w-4" />
            </button>

            {open && (
                <div
                    role="dialog"
                    className="absolute right-0 top-full mt-2 z-30 w-52 rounded-lg border border-white/10 bg-surface-sidebar shadow-xl shadow-black/40 p-3"
                >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Legenda
                    </div>
                    <div className="space-y-1.5">
                        {ITEMS.map((it) => (
                            <div key={it.label} className="flex items-center gap-2 text-[12px] text-gray-300">
                                <span
                                    className={cn("h-2.5 w-2.5 rounded-full shrink-0", it.color)}
                                    style={{ boxShadow: `0 0 6px ${it.glow}` }}
                                />
                                {it.label}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Default export remains the inline variant for legacy imports. */
export function CalendarLegend() {
    return (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 text-xs text-gray-400">
            <span className="font-medium text-gray-300 text-[10px] uppercase tracking-wider">Legenda:</span>
            <CalendarLegendInline />
        </div>
    );
}
