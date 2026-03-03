'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const createLeadSchema = z.object({
    whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/),
    name: z.string().trim().min(2).max(255),
    source: z.enum(['WHATSAPP', 'BALCAO', 'INDICACAO', 'OUTRO']).default('WHATSAPP'),
});

const updateStageSchema = z.object({
    lead_id: z.string().uuid(),
    stage: z.enum(['NOVO', 'QUALIFICADO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'CONVERTIDO', 'PERDIDO']),
});

const convertLeadSchema = z.object({
    lead_id: z.string().uuid(),
});

export async function createLeadAction(formData: FormData) {
    const parsed = createLeadSchema.safeParse({
        whatsapp_number: formData.get('whatsapp_number'),
        name: formData.get('name'),
        source: formData.get('source') ?? 'WHATSAPP',
    });

    if (!parsed.success) {
        redirect('/leads?error=Verifique%20os%20campos%20do%20novo%20lead.');
    }

    try {
        await apiRequest('/leads', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar lead.';
        redirect(`/leads?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/leads');
    redirect('/leads');
}

export async function updateLeadStageAction(formData: FormData) {
    const parsed = updateStageSchema.safeParse({
        lead_id: formData.get('lead_id'),
        stage: formData.get('stage'),
    });

    if (!parsed.success) {
        redirect('/leads?error=Não%20foi%20possível%20atualizar%20o%20stage.');
    }

    try {
        await apiRequest(`/leads/${parsed.data.lead_id}/stage`, {
            method: 'PATCH',
            body: JSON.stringify({ stage: parsed.data.stage }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao atualizar lead.';
        redirect(`/leads?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/leads');
    redirect(`/leads?selected=${parsed.data.lead_id}`);
}

export async function convertLeadAction(formData: FormData) {
    const parsed = convertLeadSchema.safeParse({
        lead_id: formData.get('lead_id'),
    });

    if (!parsed.success) {
        redirect('/leads?error=Lead%20inválido%20para%20conversão.');
    }

    try {
        const response = await apiRequest<{ customer?: { id: string } }>(`/leads/${parsed.data.lead_id}/convert`, {
            method: 'POST',
        });

        revalidatePath('/leads');
        revalidatePath('/clientes');

        if (response.customer?.id) {
            redirect(`/clientes/${response.customer.id}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao converter lead.';
        redirect(`/leads?error=${encodeURIComponent(message)}&selected=${parsed.data.lead_id}`);
    }

    redirect('/clientes');
}
