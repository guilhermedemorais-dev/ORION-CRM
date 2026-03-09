'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const createFinancialLaunchSchema = z.object({
    tipo: z.enum(['receita', 'despesa']),
    descricao: z.string().trim().min(5).max(2000),
    valor: z.string().trim().min(1),
    data: z.string().date(),
    categoria: z.string().trim().min(2).max(100),
    comprovante: z.string().trim().url().max(500).optional().or(z.literal('')),
});

function parseCurrencyToCents(value: string): number | null {
    const cleanedValue = value.replace(/[R$\s]/g, '');
    if (!cleanedValue) {
        return null;
    }

    let normalizedValue = cleanedValue;

    if (normalizedValue.includes(',') && normalizedValue.includes('.')) {
        normalizedValue = normalizedValue.replace(/\./g, '').replace(',', '.');
    } else if (normalizedValue.includes(',')) {
        normalizedValue = normalizedValue.replace(',', '.');
    } else {
        const parts = normalizedValue.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1] && parts[1].length > 2)) {
            normalizedValue = parts.join('');
        }
    }

    const amount = Number(normalizedValue);

    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    return Math.round(amount * 100);
}

export async function createFinancialLaunchAction(formData: FormData) {
    const parsed = createFinancialLaunchSchema.safeParse({
        tipo: formData.get('tipo'),
        descricao: formData.get('descricao'),
        valor: formData.get('valor'),
        data: formData.get('data'),
        categoria: formData.get('categoria'),
        comprovante: formData.get('comprovante'),
    });

    if (!parsed.success) {
        redirect('/financeiro?error=Verifique%20os%20dados%20do%20lan%C3%A7amento.');
    }

    const amountCents = parseCurrencyToCents(parsed.data.valor);
    if (!amountCents) {
        redirect('/financeiro?error=Valor%20inv%C3%A1lido%20para%20o%20lan%C3%A7amento.');
    }

    try {
        await apiRequest('/financeiro/lancamentos', {
            method: 'POST',
            body: JSON.stringify({
                tipo: parsed.data.tipo,
                descricao: parsed.data.descricao,
                valor: amountCents,
                data: parsed.data.data,
                categoria: parsed.data.categoria,
                comprovante: parsed.data.comprovante || undefined,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao registrar lançamento.';
        redirect(`/financeiro?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/financeiro');
    redirect('/financeiro');
}

export const createExpenseAction = createFinancialLaunchAction;
