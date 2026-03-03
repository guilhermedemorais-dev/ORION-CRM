'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const advanceProductionSchema = z.object({
    production_order_id: z.string().uuid(),
    approved: z.enum(['true', 'false']).default('true'),
    notes: z.string().trim().max(2000).optional(),
    rejection_reason: z.string().trim().max(2000).optional(),
});

function redirectProduction(message?: string, selected?: string): never {
    const params = new URLSearchParams();
    if (message) {
        params.set('error', message);
    }
    if (selected) {
        params.set('selected', selected);
    }
    const suffix = params.toString();
    redirect(suffix ? `/producao?${suffix}` : '/producao');
}

export async function advanceProductionStepAction(formData: FormData) {
    const parsed = advanceProductionSchema.safeParse({
        production_order_id: formData.get('production_order_id'),
        approved: formData.get('approved') || 'true',
        notes: formData.get('notes') || undefined,
        rejection_reason: formData.get('rejection_reason') || undefined,
    });

    if (!parsed.success) {
        redirectProduction('Verifique os dados da etapa.', String(formData.get('production_order_id') ?? ''));
    }

    const data = parsed.data;

    try {
        await apiRequest(`/production-orders/${data.production_order_id}/advance`, {
            method: 'POST',
            body: JSON.stringify({
                approved: data.approved === 'true',
                notes: data.notes,
                rejection_reason: data.rejection_reason,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao avançar a etapa.';
        redirectProduction(message, data.production_order_id);
    }

    revalidatePath('/producao');
    revalidatePath('/pedidos');
    redirectProduction(undefined, data.production_order_id);
}
