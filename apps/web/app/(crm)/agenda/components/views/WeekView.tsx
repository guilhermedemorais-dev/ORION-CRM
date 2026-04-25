"use client";

import type { AppointmentRecord } from "../../types";
import { TimeGridView } from "./TimeGridView";

interface WeekViewProps {
    currentDate: Date;
    appointments: AppointmentRecord[];
    selectedId?: string | null;
    /** 7 = full week starting Sunday, 4 = 4 consecutive days starting at currentDate. */
    days?: 4 | 7;
}

export function WeekView({ currentDate, appointments, selectedId, days = 7 }: WeekViewProps) {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    if (days === 7) {
        start.setDate(start.getDate() - start.getDay());
    }
    const list: Date[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        list.push(d);
    }
    return <TimeGridView days={list} appointments={appointments} selectedId={selectedId} />;
}
