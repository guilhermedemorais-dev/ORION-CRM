'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PaymentLinkResponse } from '@/lib/api';
import { apiRequest } from '@/lib/api';

const orderStatusSchema = z.enum([
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
]);

const orderTypeSchema = z.enum(['PRONTA_ENTREGA', 'PERSONALIZADO']);

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
    status: orderStatusSchema,
});

const createPaymentLinkSchema = z.object({
    order_id: z.string().uuid(),
});

const returnContextSchema = z.object({
    selected: z.string().uuid().optional(),
    status: orderStatusSchema.optional().or(z.literal('')),
    type: orderTypeSchema.optional().or(z.literal('')),
});

const sendOrderReceiptSchema = z.object({
    order_id: z.string().uuid(),
    channel: z.enum(['whatsapp', 'email']),
});

type OrdersReturnContext = {
    selected?: string;
    status?: z.infer<typeof orderStatusSchema>;
    type?: z.infer<typeof orderTypeSchema>;
};

type NoticeType = 'success' | 'error';

function extractReturnContext(formData: FormData): OrdersReturnContext {
    const parsed = returnContextSchema.safeParse({
        selected: formData.get('selected') || undefined,
        status: formData.get('return_status') || '',
        type: formData.get('return_type') || '',
    });

    if (!parsed.success) {
        return {};
    }

    return {
        selected: parsed.data.selected,
        status: parsed.data.status || undefined,
        type: parsed.data.type || undefined,
    };
}

function redirectToOrders({
    selected,
    status,
    type,
    notice,
    noticeType,
}: OrdersReturnContext & {
    notice?: string;
    noticeType?: NoticeType;
}): never {
    const params = new URLSearchParams();

    if (selected) {
        params.set('selected', selected);
    }

    if (status) {
        params.set('status', status);
    }

    if (type) {
        params.set('type', type);
    }

    if (notice) {
        params.set('notice', notice);
    }

    if (noticeType) {
        params.set('noticeType', noticeType);
    }

    redirect(`/pedidos${params.toString() ? `?${params.toString()}` : ''}`);
}

function redirectWithNotice(message: string, noticeType: NoticeType, context?: OrdersReturnContext): never {
    redirectToOrders({
        ...context,
        notice: message,
        noticeType,
    });
}

function redirectWithError(message: string, context?: OrdersReturnContext): never {
    redirectWithNotice(message, 'error', context);
}

function redirectWithSuccess(message: string, context?: OrdersReturnContext): never {
    redirectWithNotice(message, 'success', context);
}

export async function createReadyOrderAction(formData: FormData) {
    const returnContext = extractReturnContext(formData);
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
        redirectWithError('Verifique os dados do pedido de pronta entrega.', returnContext);
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
        redirectWithSuccess('Pedido criado com sucesso.', {
            ...returnContext,
            selected: order.id,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar pedido.';
        redirectWithError(message, returnContext);
    }
}

export async function createCustomOrderAction(formData: FormData) {
    const returnContext = extractReturnContext(formData);
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
        redirectWithError('Verifique os dados do pedido personalizado.', returnContext);
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
        redirectWithSuccess('Pedido personalizado criado com sucesso.', {
            ...returnContext,
            selected: order.id,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar pedido personalizado.';
        redirectWithError(message, returnContext);
    }
}

export async function updateOrderStatusAction(formData: FormData) {
    const returnContext = extractReturnContext(formData);
    const parsed = updateOrderStatusSchema.safeParse({
        order_id: formData.get('order_id'),
        status: formData.get('status'),
    });

    if (!parsed.success) {
        redirectWithError('Não foi possível atualizar o status do pedido.', returnContext);
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
        redirectWithError(message, {
            ...returnContext,
            selected: data.order_id,
        });
    }

    revalidatePath('/pedidos');
    revalidatePath('/producao');
    redirectWithSuccess('Status do pedido atualizado.', {
        ...returnContext,
        selected: data.order_id,
    });
}

export async function createMercadoPagoPaymentLinkAction(formData: FormData) {
    const returnContext = extractReturnContext(formData);
    const parsed = createPaymentLinkSchema.safeParse({
        order_id: formData.get('order_id'),
    });

    if (!parsed.success) {
        redirectWithError('Não foi possível gerar o link de pagamento.', returnContext);
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
        redirectWithError(message, {
            ...returnContext,
            selected: parsed.data.order_id,
        });
    }
}

export async function requestOrderNfeAction(formData: FormData) {
    const returnContext = extractReturnContext(formData);
    const orderId = String(formData.get('order_id') ?? '');

    if (!z.string().uuid().safeParse(orderId).success) {
        redirectWithError('Não foi possível solicitar a NF-e.', returnContext);
    }

    try {
        const response = await apiRequest<{ message?: string }>(`/orders/${orderId}/nfe`, {
            method: 'POST',
        });

        revalidatePath('/pedidos');
        redirectWithSuccess(response.message || 'NF-e solicitada com sucesso.', {
            ...returnContext,
            selected: orderId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao solicitar NF-e.';
        redirectWithError(message, {
            ...returnContext,
            selected: orderId,
        });
    }
}

export async function sendOrderReceiptAction(formData: FormData) {
    const returnContext = extractReturnContext(formData);
    const parsed = sendOrderReceiptSchema.safeParse({
        order_id: formData.get('order_id'),
        channel: formData.get('channel'),
    });

    if (!parsed.success) {
        redirectWithError('Não foi possível preparar o comprovante.', returnContext);
    }

    try {
        const response = await apiRequest<{ url?: string; email?: string }>(`/orders/${parsed.data.order_id}/send-receipt`, {
            method: 'POST',
            body: JSON.stringify({
                channel: parsed.data.channel,
            }),
        });

        if (parsed.data.channel === 'whatsapp' && response.url) {
            redirect(response.url);
        }

        if (parsed.data.channel === 'email' && response.email) {
            redirect(`mailto:${response.email}`);
        }

        redirectWithError('O comprovante não retornou um destino válido.', {
            ...returnContext,
            selected: parsed.data.order_id,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao preparar o comprovante.';
        redirectWithError(message, {
            ...returnContext,
            selected: parsed.data.order_id,
        });
    }
}
