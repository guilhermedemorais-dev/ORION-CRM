import { PageHeader } from "@/components/ui/PageHeader";
import { CalendarHeader } from "./components/CalendarHeader";
import { MonthView } from "./components/MonthView";
import { CalendarLegend } from "./components/CalendarLegend";
import { AppointmentSheet } from "./components/AppointmentSheet";
import { CreateAppointmentDialog } from "./components/CreateAppointmentDialog";
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { AppointmentRecord } from './types';
import { cn } from "@/lib/utils";

// Calcular range baseado na view
function getDateRange(date: Date, view: 'month' | 'week' | 'day') {
    if (view === 'month') {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        // Expandir para incluir dias visíveis de meses adjacentes
        start.setDate(start.getDate() - start.getDay()); // voltar ao domingo
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        end.setDate(end.getDate() + (6 - end.getDay())); // avançar ao sábado
        return { start, end };
    }
    // week e day: implementar quando as views forem adicionadas
    return {
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end:   new Date(date.getFullYear(), date.getMonth() + 1, 0),
    };
}

export default async function AgendaPage({ 
    searchParams 
}: { 
    searchParams: { view?: string; date?: string; selected?: string; create?: string } 
}) {
    const session = requireSession();
    const currentUserId = session.user.id;

    let currentDate = new Date();
    if (searchParams.date) {
        currentDate = new Date(searchParams.date + 'T12:00:00');
    }
    const view = (searchParams.view ?? 'month') as 'month' | 'week' | 'day';

    const { start, end } = getDateRange(currentDate, view);
    const startDate = start.toISOString().split('T')[0];
    const endDate   = end.toISOString().split('T')[0];

    const [appointmentsRes, selectedAppointment] = await Promise.all([
        apiRequest<{ data: AppointmentRecord[] }>(
            `/appointments?start_date=${startDate}&end_date=${endDate}&limit=200`
        ).catch(() => ({ data: [] })),
        searchParams.selected
            ? apiRequest<AppointmentRecord>(`/appointments/${searchParams.selected}`).catch(() => null)
            : Promise.resolve(null),
    ]);

    const appointments = appointmentsRes.data;
    const hasSelection = !!selectedAppointment;

    return (
        <div className="h-[calc(100vh-60px)] flex flex-col pt-4 overflow-hidden relative">
            <PageHeader
                title="Agenda"
                description="Gerencie seus agendamentos e horários para visitas e reuniões."
            />

            {/* FIX: Legend moved from bottom to top, next to header for better discoverability */}
            <div className="mt-4 mb-3 px-0">
                <CalendarLegend />
            </div>

            <div className={cn(
                'flex-1 overflow-hidden min-h-0',
                // FIX: Responsive grid — use min-width to prevent header compression on smaller desktops
                hasSelection ? 'grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]' : 'flex flex-col'
            )}>
                <div className="flex flex-col overflow-hidden p-0">
                    <CalendarHeader currentDate={currentDate} view={view} />
                    <div className="flex-1 overflow-hidden min-h-0 shrink">
                        <MonthView
                            currentDate={currentDate}
                            appointments={appointments}
                            selectedId={searchParams.selected ?? null}
                        />
                    </div>
                </div>

                {hasSelection && selectedAppointment && (
                    <AppointmentSheet
                        appointment={selectedAppointment}
                        closeHref={`/agenda?view=${view}&date=${searchParams.date ?? ''}`}
                    />
                )}
            </div>

            {searchParams.create === 'true' && <CreateAppointmentDialog currentUserId={currentUserId} />}
        </div>
    );
}
