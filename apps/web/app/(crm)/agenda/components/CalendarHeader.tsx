"use client";

import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarLegendInline, CalendarLegendDots, CalendarLegendPopover } from "./CalendarLegend";
import { ViewSelector } from "./ViewSelector";
import {
    type AgendaView,
    getPeriodLabel,
    navigateDate,
    toDateParam,
} from "../lib/dateRange";

const SHORTCUT_MAP: Record<string, AgendaView> = {
    d: 'day',
    w: 'week',
    m: 'month',
    y: 'year',
    a: 'schedule',
    x: '4days',
};

export function CalendarHeader({
    currentDate,
    view = 'month',
}: {
    currentDate: Date;
    view?: AgendaView;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const periodLabel = useMemo(() => getPeriodLabel(currentDate, view), [currentDate, view]);

    const updateParams = (updater: (p: URLSearchParams) => void) => {
        const params = new URLSearchParams(searchParams.toString());
        updater(params);
        router.push(`${pathname}?${params.toString()}`);
    };

    const navigate = (direction: -1 | 1) => {
        const next = navigateDate(currentDate, view, direction);
        updateParams((p) => {
            p.set('date', toDateParam(next));
            p.set('view', view);
        });
    };

    const goToday = () => {
        updateParams((p) => {
            p.delete('date');
            p.set('view', view);
        });
    };

    const setView = (next: AgendaView) => {
        updateParams((p) => {
            p.set('view', next);
        });
    };

    const openNewAppointment = () => {
        updateParams((p) => p.set('create', 'true'));
    };

    // Keyboard shortcuts — D/W/M/Y/A/X switch views, T or H = today, ←/→ = prev/next
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
            }
            const key = e.key.toLowerCase();
            if (SHORTCUT_MAP[key]) {
                e.preventDefault();
                setView(SHORTCUT_MAP[key]);
            } else if (key === 't' || key === 'h') {
                e.preventDefault();
                goToday();
            } else if (key === 'arrowleft' || key === 'j') {
                e.preventDefault();
                navigate(-1);
            } else if (key === 'arrowright' || key === 'k') {
                e.preventDefault();
                navigate(1);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, currentDate, searchParams.toString()]);

    return (
        <div className="flex items-center gap-2 sm:gap-3 mb-3 min-w-0">
            {/* Title + nav */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
                <h1 className="text-lg sm:text-xl xl:text-2xl font-semibold text-white capitalize truncate">
                    {periodLabel}
                </h1>
                <div className="flex items-center gap-0.5 bg-surface-sidebar rounded-md p-0.5 border border-white/5 shrink-0">
                    <button
                        onClick={() => navigate(-1)}
                        className="h-8 w-8 inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                        title="Anterior"
                        aria-label="Período anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={goToday}
                        className="h-8 px-3 text-[12px] text-gray-300 hover:text-white hover:bg-white/5 rounded font-medium transition-colors"
                        title="Hoje (T)"
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => navigate(1)}
                        className="h-8 w-8 inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                        title="Próximo"
                        aria-label="Próximo período"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Spacer + responsive legend slot */}
            <div className="flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3">
                <CalendarLegendInline className="hidden 2xl:flex" />
                <CalendarLegendDots   className="hidden lg:flex 2xl:hidden" />
                <CalendarLegendPopover className="lg:hidden" />

                <ViewSelector view={view} onChange={setView} compact={false} />

                <Button
                    onClick={openNewAppointment}
                    icon={<Plus className="w-4 h-4" />}
                    className="shrink-0"
                >
                    <span className="hidden sm:inline">Novo Agendamento</span>
                    <span className="sm:hidden">Novo</span>
                </Button>
            </div>
        </div>
    );
}
