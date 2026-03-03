'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PdvSaleResponse } from '@/lib/api';
import { apiRequest } from '@/lib/api';

const productLineSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
});

const createPdvSaleSchema = z.object({
    customer_id: z.preprocess((value) => {
        if (typeof value !== 'string' || value.trim() === '') {
            return null;
        }

        return value;
    }, z.string().uuid().nullable()),
    payment_method: z.enum(['DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'PIX', 'LINK_PAGAMENTO']),
    discount_cents: z.coerce.number().int().min(0),
    notes: z.preprocess((value) => {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
    }, z.string().max(500).nullable()),
});

function toPdvError(message: string) {
    return `/pdv?error=${encodeURIComponent(message)}`;
}

export async function createPdvSaleAction(formData: FormData) {
    const base = createPdvSaleSchema.safeParse({
        customer_id: formData.get('customer_id'),
        payment_method: formData.get('payment_method'),
        discount_cents: formData.get('discount_cents'),
        notes: formData.get('notes'),
    });

    if (!base.success) {
        redirect(toPdvError('Verifique os dados da venda.'));
    }

    const items = [1, 2, 3, 4, 5]
        .map((index) => {
            const productId = formData.get(`product_id_${index}`);
            const quantity = formData.get(`quantity_${index}`);

            if (typeof productId !== 'string' || productId.trim() === '') {
                return null;
            }

            const parsedLine = productLineSchema.safeParse({
                product_id: productId,
                quantity,
            });

            if (!parsedLine.success) {
                return 'invalid';
            }

            return parsedLine.data;
        });

    if (items.includes('invalid')) {
        redirect(toPdvError('Há itens inválidos no carrinho do PDV.'));
    }

    const normalizedItems = items.filter((item): item is z.infer<typeof productLineSchema> => Boolean(item));

    if (normalizedItems.length === 0) {
        redirect(toPdvError('Selecione ao menos um produto para finalizar a venda.'));
    }

    try {
        const response = await apiRequest<PdvSaleResponse>('/pdv/sales', {
            method: 'POST',
            body: JSON.stringify({
                customer_id: base.data.customer_id,
                items: normalizedItems,
                payment_method: base.data.payment_method,
                discount_cents: base.data.discount_cents,
                notes: base.data.notes,
            }),
        });

        revalidatePath('/pdv');
        revalidatePath('/orders');
        revalidatePath('/estoque');
        revalidatePath('/financeiro');

        const params = new URLSearchParams({
            receipt_order: response.receipt.order_number,
            receipt_payment: response.payment_id,
            receipt_total: String(response.receipt.total_cents),
        });

        redirect(`/pdv?${params.toString()}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao finalizar a venda no PDV.';
        redirect(toPdvError(message));
    }
}
