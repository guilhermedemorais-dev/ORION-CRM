'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const createExpenseSchema = z.object({
    type: z.literal('SAIDA'),
    amount_cents: z.coerce.number().int().positive(),
    description: z.string().trim().min(5).max(2000),
    competence_date: z.string().date(),
    category: z.string().trim().min(2).max(100),
});

export async function createExpenseAction(formData: FormData) {
    const parsed = createExpenseSchema.safeParse({
        type: 'SAIDA',
        amount_cents: formData.get('amount_cents'),
        description: formData.get('description'),
        competence_date: formData.get('competence_date'),
        category: formData.get('category'),
    });

    if (!parsed.success) {
        redirect('/financeiro?error=Verifique%20os%20dados%20da%20despesa.');
    }

    try {
        await apiRequest('/financial-entries', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao registrar despesa.';
        redirect(`/financeiro?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/financeiro');
    redirect('/financeiro');
}
