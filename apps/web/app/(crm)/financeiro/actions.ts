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
    });

    if (!parsed.success) {
        redirect('/financeiro?error=Verifique%20os%20dados%20do%20lan%C3%A7amento.');
    }

    const amountCents = parseCurrencyToCents(parsed.data.valor);
    if (!amountCents) {
        redirect('/financeiro?error=Valor%20inv%C3%A1lido%20para%20o%20lan%C3%A7amento.');
    }

    const receiptFile = formData.get('comprovante');
    const hasReceiptFile = receiptFile instanceof File && receiptFile.size > 0;

    if (hasReceiptFile && receiptFile.size > 5 * 1024 * 1024) {
        redirect('/financeiro?error=Arquivo%20excede%20o%20limite%20de%205MB.');
    }

    let createdEntry: { id: string } | null = null;

    try {
        createdEntry = await apiRequest<{ id: string }>('/financeiro/lancamentos', {
            method: 'POST',
            body: JSON.stringify({
                tipo: parsed.data.tipo,
                descricao: parsed.data.descricao,
                valor: amountCents,
                data: parsed.data.data,
                categoria: parsed.data.categoria,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao registrar lançamento.';
        redirect(`/financeiro?error=${encodeURIComponent(message)}`);
    }

    if (hasReceiptFile && createdEntry) {
        try {
            const uploadData = new FormData();
            uploadData.set('file', receiptFile, receiptFile.name || 'comprovante');

            await apiRequest(`/financeiro/lancamentos/${createdEntry.id}/comprovante`, {
                method: 'POST',
                body: uploadData,
            });
        } catch (error) {
            revalidatePath('/financeiro');
            const message = error instanceof Error ? error.message : 'Falha ao enviar comprovante.';
            redirect(`/financeiro?error=${encodeURIComponent(`Lançamento criado, mas o comprovante falhou: ${message}`)}`);
        }
    }

    revalidatePath('/financeiro');
    redirect('/financeiro');
}

export const createExpenseAction = createFinancialLaunchAction;
