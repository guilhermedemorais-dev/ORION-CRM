'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createStoreCheckoutPreference } from '@/lib/api';

const checkoutSchema = z.object({
    product_id: z.string().uuid(),
    product_slug: z.string().trim().min(1),
    customer_name: z.string().trim().min(2).max(255),
    customer_email: z.string().trim().email().max(255).optional().or(z.literal('')),
    customer_phone: z.string().trim().min(8).max(30).optional().or(z.literal('')),
    cep: z.string().trim().min(8).max(9),
    street: z.string().trim().min(2).max(255),
    number: z.string().trim().min(1).max(30),
    complement: z.string().trim().max(120).optional().or(z.literal('')),
    neighborhood: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(2),
});

export async function createStoreCheckoutAction(formData: FormData) {
    const parsed = checkoutSchema.safeParse({
        product_id: formData.get('product_id'),
        product_slug: formData.get('product_slug'),
        customer_name: formData.get('customer_name'),
        customer_email: formData.get('customer_email') || '',
        customer_phone: formData.get('customer_phone') || '',
        cep: formData.get('cep'),
        street: formData.get('street'),
        number: formData.get('number'),
        complement: formData.get('complement') || '',
        neighborhood: formData.get('neighborhood'),
        city: formData.get('city'),
        state: formData.get('state'),
    });

    if (!parsed.success) {
        redirect(`/loja/produto/${formData.get('product_slug')}?checkout=error&message=Verifique os dados do checkout.`);
    }

    try {
        const response = await createStoreCheckoutPreference({
            product_id: parsed.data.product_id,
            customer_name: parsed.data.customer_name,
            customer_email: parsed.data.customer_email || undefined,
            customer_phone: parsed.data.customer_phone || undefined,
            shipping_address: {
                cep: parsed.data.cep,
                street: parsed.data.street,
                number: parsed.data.number,
                complement: parsed.data.complement || undefined,
                neighborhood: parsed.data.neighborhood,
                city: parsed.data.city,
                state: parsed.data.state.toUpperCase(),
            },
        });

        redirect(response.payment_url);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel iniciar o checkout.';
        redirect(`/loja/produto/${parsed.data.product_slug}?checkout=error&message=${encodeURIComponent(message)}`);
    }
}
