"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppointmentPill } from "./AppointmentPill";
import type { AppointmentRecord } from "../types";

const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface AnchorRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

interface DayPopoverProps {
    date: Date;
    appointments: AppointmentRecord[];
    selectedId?: string | null;
    anchor: AnchorRect;
    onClose: () => void;
    onAppointmentClick: (a: AppointmentRecord) => void;
}

/** Mini-popup ancorado na célula do dia (estilo Google Agenda).
 *  Posicionado em fixed coords usando o boundingRect da célula clicada,
 *  ajustado para não sair da viewport. */
export function DayPopover({ date, appointments, selectedId, anchor, onClose, onAppointmentClick }: DayPopoverProps) {
    const weekday = WEEKDAYS_FULL[date.getDay()];
    const dayNumber = date.getDate();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: anchor.top, left: anchor.left });

    // Fecha com ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Reposiciona o popup pra caber na viewport — centraliza na célula horizontalmente,
    // desce abaixo dela se houver espaço; senão, sobe.
    useLayoutEffect(() => {
        const el = popoverRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 8;

        // Centraliza horizontalmente na célula.
        let left = anchor.left + anchor.width / 2 - rect.width / 2;
        if (left < margin) left = margin;
        if (left + rect.width > vw - margin) left = vw - margin - rect.width;

        // Tenta abaixo da célula; se não couber, acima.
        let top = anchor.top + anchor.height + 6;
        if (top + rect.height > vh - margin) {
            const above = anchor.top - rect.height - 6;
            top = above >= margin ? above : Math.max(margin, vh - margin - rect.height);
        }

        setPos({ top, left });
    }, [anchor.left, anchor.top, anchor.width, anchor.height, appointments.length]);

    return (
        <>
            {/* Backdrop transparente — só capta clique fora pra fechar. */}
            <div
                className="fixed inset-0 z-[55]"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={popoverRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Agendamentos de ${weekday}, dia ${dayNumber}`}
                style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 60 }}
                className="w-[260px] bg-surface-sidebar border border-white/15 rounded-xl shadow-2xl flex flex-col max-h-[60vh] min-h-0 animate-in zoom-in-95 fade-in duration-100 origin-top"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-3 pt-2.5 pb-1.5 shrink-0">
                    <div className="leading-tight">
                        <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">{weekday.slice(0, 3)}.</div>
                        <div className="text-xl font-bold text-white">{dayNumber}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 pt-1 space-y-1">
                    {appointments.length === 0 ? (
                        <p className="text-center text-xs text-gray-500 py-3">Sem agendamentos.</p>
                    ) : (
                        appointments.map((app) => (
                            <AppointmentPill
                                key={app.id}
                                appointment={app}
                                selected={app.id === selectedId}
                                onClick={(a) => {
                                    onAppointmentClick(a);
                                    onClose();
                                }}
                                compact
                            />
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
