"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, CalendarDays, CalendarRange, List, Grid3x3, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaView } from "../lib/dateRange";

interface ViewOption {
    value: AgendaView;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
}

const VIEW_OPTIONS: ViewOption[] = [
    { value: 'day',      label: 'Dia',          shortcut: 'D', icon: <Sun className="w-3.5 h-3.5" /> },
    { value: 'week',     label: 'Semana',       shortcut: 'W', icon: <CalendarRange className="w-3.5 h-3.5" /> },
    { value: 'month',    label: 'Mês',          shortcut: 'M', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
    { value: 'year',     label: 'Ano',          shortcut: 'Y', icon: <Grid3x3 className="w-3.5 h-3.5" /> },
    { value: 'schedule', label: 'Programação',  shortcut: 'A', icon: <List className="w-3.5 h-3.5" /> },
    { value: '4days',    label: '4 dias',       shortcut: 'X', icon: <CalendarDays className="w-3.5 h-3.5" /> },
];

interface ViewSelectorProps {
    view: AgendaView;
    onChange: (view: AgendaView) => void;
    /** When true, shows only the icon (mobile/compact). */
    compact?: boolean;
}

export function ViewSelector({ view, onChange, compact = false }: ViewSelectorProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = VIEW_OPTIONS.find((o) => o.value === view) ?? VIEW_OPTIONS[2];

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
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "h-9 inline-flex items-center gap-2 rounded-md border text-[12px] font-medium transition-colors",
                    open
                        ? "bg-white/10 border-white/15 text-white"
                        : "bg-white/[0.03] border-white/5 text-gray-300 hover:bg-white/[0.06] hover:text-white",
                    compact ? "px-2.5" : "px-3"
                )}
                aria-haspopup="listbox"
                aria-expanded={open}
                title={`${current.label} (atalho ${current.shortcut})`}
            >
                {current.icon}
                {!compact && <span>{current.label}</span>}
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute right-0 top-full mt-2 z-30 w-44 rounded-lg border border-white/10 bg-surface-sidebar shadow-xl shadow-black/40 p-1"
                >
                    {VIEW_OPTIONS.map((opt) => {
                        const active = opt.value === view;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                role="option"
                                aria-selected={active}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[12px] transition-colors",
                                    active
                                        ? "bg-brand-gold/10 text-brand-gold"
                                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    {opt.icon}
                                    {opt.label}
                                </span>
                                <kbd className="text-[10px] font-mono text-gray-500 bg-black/30 border border-white/5 rounded px-1.5 py-0.5">
                                    {opt.shortcut}
                                </kbd>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
