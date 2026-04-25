export type AgendaView = 'day' | 'week' | 'month' | 'year' | 'schedule' | '4days';

export const VALID_VIEWS: AgendaView[] = ['day', 'week', 'month', 'year', 'schedule', '4days'];

export function parseView(input: string | undefined): AgendaView {
    if (!input) return 'month';
    return (VALID_VIEWS as string[]).includes(input) ? (input as AgendaView) : 'month';
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

export function getDateRange(date: Date, view: AgendaView): { start: Date; end: Date } {
    switch (view) {
        case 'day': {
            return { start: startOfDay(date), end: endOfDay(date) };
        }
        case 'week': {
            const start = startOfDay(date);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case '4days': {
            const start = startOfDay(date);
            const end = new Date(start);
            end.setDate(start.getDate() + 3);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'month': {
            const start = new Date(date.getFullYear(), date.getMonth(), 1);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            end.setDate(end.getDate() + (6 - end.getDay()));
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'year': {
            const start = new Date(date.getFullYear(), 0, 1);
            const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
            return { start, end };
        }
        case 'schedule': {
            const start = startOfDay(date);
            const end = new Date(start);
            end.setDate(start.getDate() + 30);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
    }
}

export function navigateDate(date: Date, view: AgendaView, direction: -1 | 1): Date {
    const next = new Date(date);
    switch (view) {
        case 'day':
        case 'schedule':
            next.setDate(next.getDate() + direction);
            break;
        case 'week':
            next.setDate(next.getDate() + 7 * direction);
            break;
        case '4days':
            next.setDate(next.getDate() + 4 * direction);
            break;
        case 'month':
            next.setMonth(next.getMonth() + direction);
            break;
        case 'year':
            next.setFullYear(next.getFullYear() + direction);
            break;
    }
    return next;
}

export function getPeriodLabel(date: Date, view: AgendaView): string {
    switch (view) {
        case 'day':
            return date.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        case 'week': {
            const start = new Date(date);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            const sameMonth = start.getMonth() === end.getMonth();
            const sameYear = start.getFullYear() === end.getFullYear();
            if (sameMonth) {
                return `${start.getDate()} – ${end.getDate()} de ${end.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
            }
            const startFmt = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
            const endFmt = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
            return `${startFmt} – ${endFmt}${sameYear ? ' de ' + end.getFullYear() : ''}`;
        }
        case '4days': {
            const start = new Date(date);
            const end = new Date(start);
            end.setDate(start.getDate() + 3);
            const startFmt = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
            const endFmt = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${startFmt} – ${endFmt}`;
        }
        case 'month':
            return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        case 'year':
            return String(date.getFullYear());
        case 'schedule':
            return 'Programação';
    }
}

export function toDateParam(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
