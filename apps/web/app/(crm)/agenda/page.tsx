import { PageHeader } from "@/components/ui/PageHeader";
import { CalendarHeader } from "./components/CalendarHeader";
import { MonthView } from "./components/MonthView";
import { DayView } from "./components/views/DayView";
import { WeekView } from "./components/views/WeekView";
import { YearView } from "./components/views/YearView";
import { ScheduleView } from "./components/views/ScheduleView";
import { AppointmentSheet } from "./components/AppointmentSheet";
import { CreateAppointmentDialog } from "./components/CreateAppointmentDialog";
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { AppointmentRecord } from './types';
import { cn } from "@/lib/utils";
import { getDateRange, parseView, toDateParam, type AgendaView } from "./lib/dateRange";

export default async function AgendaPage({
    searchParams,
}: {
    searchParams: { view?: string; date?: string; selected?: string; create?: string };
}) {
    const session = requireSession();
    const currentUserId = session.user.id;

    let currentDate = new Date();
    if (searchParams.date) {
        currentDate = new Date(searchParams.date + 'T12:00:00');
    }
    const view: AgendaView = parseView(searchParams.view);

    const { start, end } = getDateRange(currentDate, view);
    const startDate = toDateParam(start);
    const endDate = toDateParam(end);

    const [appointmentsRes, selectedAppointment] = await Promise.all([
        apiRequest<{ data: AppointmentRecord[] }>(
            `/appointments?start_date=${startDate}&end_date=${endDate}&limit=500`
        ).catch(() => ({ data: [] })),
        searchParams.selected
            ? apiRequest<AppointmentRecord>(`/appointments/${searchParams.selected}`).catch(() => null)
            : Promise.resolve(null),
    ]);

    const appointments = appointmentsRes.data;
    const hasSelection = !!selectedAppointment;
    const closeHref = `/agenda?view=${view}${searchParams.date ? `&date=${searchParams.date}` : ''}`;

    return (
        <div className="flex-1 min-h-0 flex flex-col pt-4 overflow-hidden relative">
            <PageHeader
                title="Agenda"
                description="Gerencie seus agendamentos e horários para visitas e reuniões."
            />

            <div className={cn(
                'flex-1 overflow-hidden min-h-0 mt-4',
                hasSelection ? 'grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px] gap-4' : 'flex flex-col'
            )}>
                <div className="flex flex-col overflow-hidden p-0 min-w-0">
                    <CalendarHeader currentDate={currentDate} view={view} />
                    <div className="flex-1 overflow-hidden min-h-0">
                        {view === 'month' && (
                            <MonthView
                                currentDate={currentDate}
                                appointments={appointments}
                                selectedId={searchParams.selected ?? null}
                            />
                        )}
                        {view === 'day' && (
                            <DayView
                                currentDate={currentDate}
                                appointments={appointments}
                                selectedId={searchParams.selected ?? null}
                            />
                        )}
                        {view === 'week' && (
                            <WeekView
                                currentDate={currentDate}
                                appointments={appointments}
                                selectedId={searchParams.selected ?? null}
                                days={7}
                            />
                        )}
                        {view === '4days' && (
                            <WeekView
                                currentDate={currentDate}
                                appointments={appointments}
                                selectedId={searchParams.selected ?? null}
                                days={4}
                            />
                        )}
                        {view === 'year' && (
                            <YearView
                                currentDate={currentDate}
                                appointments={appointments}
                            />
                        )}
                        {view === 'schedule' && (
                            <ScheduleView
                                currentDate={currentDate}
                                appointments={appointments}
                                selectedId={searchParams.selected ?? null}
                            />
                        )}
                    </div>
                </div>

                {hasSelection && selectedAppointment && (
                    <AppointmentSheet
                        appointment={selectedAppointment}
                        closeHref={closeHref}
                    />
                )}
            </div>

            {searchParams.create === 'true' && <CreateAppointmentDialog currentUserId={currentUserId} />}
        </div>
    );
}
