'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const createCustomerSchema = z.object({
    name: z.string().trim().min(2).max(255),
    whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/),
    email: z.string().email().optional().or(z.literal('')),
});

export async function createCustomerAction(formData: FormData) {
    const parsed = createCustomerSchema.safeParse({
        name: formData.get('name'),
        whatsapp_number: formData.get('whatsapp_number'),
        email: formData.get('email'),
    });

    if (!parsed.success) {
        redirect('/clientes?error=Verifique%20os%20campos%20do%20novo%20cliente.');
    }

    try {
        await apiRequest('/customers', {
            method: 'POST',
            body: JSON.stringify({
                ...parsed.data,
                email: parsed.data.email || undefined,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar cliente.';
        redirect(`/clientes?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/clientes');
    redirect('/clientes');
}
