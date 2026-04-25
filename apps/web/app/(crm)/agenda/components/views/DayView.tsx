"use client";

import type { AppointmentRecord } from "../../types";
import { TimeGridView } from "./TimeGridView";

export function DayView({
    currentDate,
    appointments,
    selectedId,
}: {
    currentDate: Date;
    appointments: AppointmentRecord[];
    selectedId?: string | null;
}) {
    const day = new Date(currentDate);
    day.setHours(0, 0, 0, 0);
    return <TimeGridView days={[day]} appointments={appointments} selectedId={selectedId} />;
}
