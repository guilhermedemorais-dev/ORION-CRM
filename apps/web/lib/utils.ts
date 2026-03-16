import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: Array<string | false | null | undefined>) {
    return twMerge(clsx(inputs));
}

export function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value / 100);
}

export const ORION_TIME_ZONE = 'America/Sao_Paulo';

export function formatDate(value: string | Date | null | undefined): string {
    if (!value) {
        return 'Sem data';
    }

    const date = typeof value === 'string' ? new Date(value) : value;

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ORION_TIME_ZONE,
    }).format(date);
}

export function formatPhone(value: string): string {
    return value.replace(/^(\+\d{2})(\d{2})(\d{4,5})(\d{4})$/, '$1 $2 $3-$4');
}

export function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export function daysSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'hoje';
    if (d === 1) return 'ontem';
    if (d < 30) return `${d}d atrás`;
    if (d < 365) return `${Math.floor(d / 30)}m atrás`;
    return `${Math.floor(d / 365)}a atrás`;
}

export function formatCurrencyShort(cents: number): string {
    if (cents >= 100000000) return `R$${(cents / 100000000).toFixed(1)}M`;
    if (cents >= 100000) return `R$${(cents / 100000).toFixed(0)}k`;
    return formatCurrencyFromCents(cents);
}
