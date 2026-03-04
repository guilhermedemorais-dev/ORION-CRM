'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { capturePublicLead } from '@/lib/api';

const publicLeadSchema = z.object({
    name: z.string().trim().min(2).max(255),
    whatsapp_number: z.string().trim().min(8).max(25),
    email: z.string().trim().email().max(255).optional().or(z.literal('')),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function capturePublicLeadAction(formData: FormData) {
    const parsed = publicLeadSchema.safeParse({
        name: formData.get('name'),
        whatsapp_number: formData.get('whatsapp_number'),
        email: formData.get('email') || '',
        notes: formData.get('notes') || '',
    });

    if (!parsed.success) {
        redirect('/?lead_status=error&message=Verifique os dados informados no formulario.');
    }

    try {
        const result = await capturePublicLead({
            name: parsed.data.name,
            whatsapp_number: parsed.data.whatsapp_number,
            email: parsed.data.email || undefined,
            notes: parsed.data.notes || undefined,
        });

        const params = new URLSearchParams();
        params.set('lead_status', result.automation_failed ? 'degraded' : 'success');
        params.set(
            'message',
            result.duplicate_prevented
                ? 'Seu contato ja estava registrado e foi atualizado com os dados mais recentes.'
                : 'Recebemos seu contato e a equipe ORION vai responder em breve.'
        );
        if (result.automation_failed) {
            params.set('fallback', result.fallback_whatsapp_url);
        }

        redirect(`/?${params.toString()}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel enviar seu contato agora.';
        redirect(`/?lead_status=error&message=${encodeURIComponent(message)}`);
    }
}
