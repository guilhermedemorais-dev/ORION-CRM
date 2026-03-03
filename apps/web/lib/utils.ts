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
    }).format(date);
}

export function formatPhone(value: string): string {
    return value.replace(/^(\+\d{2})(\d{2})(\d{4,5})(\d{4})$/, '$1 $2 $3-$4');
}
