'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const optionalString = (max: number) =>
    z.preprocess((value) => {
        if (typeof value !== 'string') {
            return undefined;
        }

        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
    }, z.string().max(max).optional());

const optionalPositiveNumber = z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim() === '') {
        return undefined;
    }

    return value;
}, z.coerce.number().positive().optional());

const createProductSchema = z.object({
    code: z.string().trim().min(2).max(50),
    name: z.string().trim().min(2).max(255),
    description: optionalString(5000),
    price_cents: z.coerce.number().int().min(1),
    stock_quantity: z.coerce.number().int().min(0),
    minimum_stock: z.coerce.number().int().min(0),
    category: optionalString(100),
    metal: optionalString(50),
    weight_grams: optionalPositiveNumber,
    is_active: z.preprocess((value) => value === 'on' || value === 'true' || value === true, z.boolean()),
});

const updateProductSchema = createProductSchema.extend({
    product_id: z.string().uuid(),
});

const adjustStockSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().int().min(1),
    type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
    reason: z.string().trim().min(10).max(2000),
});

function toStockError(message: string, selected?: string) {
    const params = new URLSearchParams({ error: message });

    if (selected) {
        params.set('selected', selected);
    }

    return `/estoque?${params.toString()}`;
}

export async function createProductAction(formData: FormData) {
    const parsed = createProductSchema.safeParse({
        code: formData.get('code'),
        name: formData.get('name'),
        description: formData.get('description'),
        price_cents: formData.get('price_cents'),
        stock_quantity: formData.get('stock_quantity'),
        minimum_stock: formData.get('minimum_stock'),
        category: formData.get('category'),
        metal: formData.get('metal'),
        weight_grams: formData.get('weight_grams'),
        is_active: formData.get('is_active'),
    });

    if (!parsed.success) {
        redirect(toStockError('Verifique os campos do novo produto.'));
    }

    try {
        const product = await apiRequest<{ id: string }>('/products', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
        });

        revalidatePath('/estoque');
        redirect(`/estoque?selected=${product.id}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao cadastrar produto.';
        redirect(toStockError(message));
    }
}

export async function updateProductAction(formData: FormData) {
    const parsed = updateProductSchema.safeParse({
        product_id: formData.get('product_id'),
        code: formData.get('code'),
        name: formData.get('name'),
        description: formData.get('description'),
        price_cents: formData.get('price_cents'),
        stock_quantity: formData.get('stock_quantity'),
        minimum_stock: formData.get('minimum_stock'),
        category: formData.get('category'),
        metal: formData.get('metal'),
        weight_grams: formData.get('weight_grams'),
        is_active: formData.get('is_active'),
    });

    if (!parsed.success) {
        redirect(toStockError('Não foi possível atualizar o produto.', String(formData.get('product_id') ?? '')));
    }

    try {
        await apiRequest(`/products/${parsed.data.product_id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                code: parsed.data.code,
                name: parsed.data.name,
                description: parsed.data.description,
                price_cents: parsed.data.price_cents,
                stock_quantity: parsed.data.stock_quantity,
                minimum_stock: parsed.data.minimum_stock,
                category: parsed.data.category,
                metal: parsed.data.metal,
                weight_grams: parsed.data.weight_grams,
                is_active: parsed.data.is_active,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao atualizar produto.';
        redirect(toStockError(message, parsed.data.product_id));
    }

    revalidatePath('/estoque');
    redirect(`/estoque?selected=${parsed.data.product_id}`);
}

export async function adjustStockAction(formData: FormData) {
    const parsed = adjustStockSchema.safeParse({
        product_id: formData.get('product_id'),
        quantity: formData.get('quantity'),
        type: formData.get('type'),
        reason: formData.get('reason'),
    });

    if (!parsed.success) {
        redirect(toStockError('Não foi possível ajustar o estoque.', String(formData.get('product_id') ?? '')));
    }

    try {
        await apiRequest(`/products/${parsed.data.product_id}/stock-adjust`, {
            method: 'POST',
            body: JSON.stringify({
                quantity: parsed.data.quantity,
                type: parsed.data.type,
                reason: parsed.data.reason,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao ajustar estoque.';
        redirect(toStockError(message, parsed.data.product_id));
    }

    revalidatePath('/estoque');
    redirect(`/estoque?selected=${parsed.data.product_id}`);
}
