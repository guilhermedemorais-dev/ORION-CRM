'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PaymentLinkResponse } from '@/lib/api';
import { apiRequest } from '@/lib/api';

const createReadyOrderSchema = z.object({
    customer_id: z.string().uuid(),
    item_description: z.string().trim().min(2).max(500),
    quantity: z.coerce.number().int().min(1).max(999),
    unit_price_cents: z.coerce.number().int().min(1),
    discount_cents: z.coerce.number().int().min(0).default(0),
    notes: z.string().trim().max(4000).optional(),
    delivery_type: z.enum(['RETIRADA', 'ENTREGA']).default('RETIRADA'),
});

const createCustomOrderSchema = z.object({
    customer_id: z.string().uuid(),
    item_description: z.string().trim().min(2).max(500),
    quantity: z.coerce.number().int().min(1).max(999),
    unit_price_cents: z.coerce.number().int().min(1),
    discount_cents: z.coerce.number().int().min(0).default(0),
    design_description: z.string().trim().min(10).max(5000),
    metal_type: z.string().trim().min(2).max(100),
    notes: z.string().trim().max(4000).optional(),
    production_deadline: z.string().datetime().optional().or(z.literal('')),
});

const updateOrderStatusSchema = z.object({
    order_id: z.string().uuid(),
    status: z.enum([
        'RASCUNHO',
        'AGUARDANDO_PAGAMENTO',
        'PAGO',
        'SEPARANDO',
        'ENVIADO',
        'RETIRADO',
        'CANCELADO',
        'AGUARDANDO_APROVACAO_DESIGN',
        'APROVADO',
        'EM_PRODUCAO',
        'CONTROLE_QUALIDADE',
    ]),
});

const createPaymentLinkSchema = z.object({
    order_id: z.string().uuid(),
});

function redirectWithError(message: string, selected?: string): never {
    const params = new URLSearchParams();
    params.set('error', message);
    if (selected) {
        params.set('selected', selected);
    }
    redirect(`/pedidos?${params.toString()}`);
}

export async function createReadyOrderAction(formData: FormData) {
    const parsed = createReadyOrderSchema.safeParse({
        customer_id: formData.get('customer_id'),
        item_description: formData.get('item_description'),
        quantity: formData.get('quantity'),
        unit_price_cents: formData.get('unit_price_cents'),
        discount_cents: formData.get('discount_cents') || 0,
        notes: formData.get('notes') || undefined,
        delivery_type: formData.get('delivery_type') || 'RETIRADA',
    });

    if (!parsed.success) {
        redirectWithError('Verifique os dados do pedido de pronta entrega.');
    }

    const data = parsed.data;
    const total = data.quantity * data.unit_price_cents;

    try {
        const order = await apiRequest<{ id: string }>('/orders', {
            method: 'POST',
            body: JSON.stringify({
                type: 'PRONTA_ENTREGA',
                customer_id: data.customer_id,
                total_amount_cents: total,
                discount_cents: data.discount_cents,
                notes: data.notes,
                delivery_type: data.delivery_type,
                order_items: [
                    {
                        description: data.item_description,
                        quantity: data.quantity,
                        unit_price_cents: data.unit_price_cents,
                    },
                ],
            }),
        });

        revalidatePath('/pedidos');
        redirect(`/pedidos?selected=${order.id}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar pedido.';
        redirectWithError(message);
    }
}

export async function createCustomOrderAction(formData: FormData) {
    const parsed = createCustomOrderSchema.safeParse({
        customer_id: formData.get('customer_id'),
        item_description: formData.get('item_description'),
        quantity: formData.get('quantity'),
        unit_price_cents: formData.get('unit_price_cents'),
        discount_cents: formData.get('discount_cents') || 0,
        design_description: formData.get('design_description'),
        metal_type: formData.get('metal_type'),
        notes: formData.get('notes') || undefined,
        production_deadline: formData.get('production_deadline') || '',
    });

    if (!parsed.success) {
        redirectWithError('Verifique os dados do pedido personalizado.');
    }

    const data = parsed.data;
    const total = data.quantity * data.unit_price_cents;

    try {
        const order = await apiRequest<{ id: string }>('/orders', {
            method: 'POST',
            body: JSON.stringify({
                type: 'PERSONALIZADO',
                customer_id: data.customer_id,
                total_amount_cents: total,
                discount_cents: data.discount_cents,
                notes: data.notes,
                order_items: [
                    {
                        description: data.item_description,
                        quantity: data.quantity,
                        unit_price_cents: data.unit_price_cents,
                    },
                ],
                design_description: data.design_description,
                metal_type: data.metal_type,
                production_deadline: data.production_deadline || undefined,
            }),
        });

        revalidatePath('/pedidos');
        revalidatePath('/producao');
        redirect(`/pedidos?selected=${order.id}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar pedido personalizado.';
        redirectWithError(message);
    }
}

export async function updateOrderStatusAction(formData: FormData) {
    const parsed = updateOrderStatusSchema.safeParse({
        order_id: formData.get('order_id'),
        status: formData.get('status'),
    });

    if (!parsed.success) {
        redirectWithError('Não foi possível atualizar o status do pedido.');
    }

    const data = parsed.data;

    try {
        await apiRequest(`/orders/${data.order_id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
                status: data.status,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao atualizar pedido.';
        redirectWithError(message, data.order_id);
    }

    revalidatePath('/pedidos');
    revalidatePath('/producao');
    redirect(`/pedidos?selected=${data.order_id}`);
}

export async function createMercadoPagoPaymentLinkAction(formData: FormData) {
    const parsed = createPaymentLinkSchema.safeParse({
        order_id: formData.get('order_id'),
    });

    if (!parsed.success) {
        redirectWithError('Não foi possível gerar o link de pagamento.');
    }

    try {
        const payment = await apiRequest<PaymentLinkResponse>('/payments/link', {
            method: 'POST',
            body: JSON.stringify({
                order_id: parsed.data.order_id,
            }),
        });

        redirect(payment.payment_url);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao gerar link de pagamento.';
        redirectWithError(message, parsed.data.order_id);
    }
}
