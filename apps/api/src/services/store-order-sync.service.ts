import type { PoolClient } from 'pg';
import { AppError } from '../lib/errors.js';
import { applyApprovedPaymentEffects, createPaymentRecord, generateOrderNumber } from './order-financial.service.js';
import {
    buildStoreCrmOrderNotes,
    normalizeStoreCustomerPhone,
    resolveStorePriceCents,
} from './store.service.js';

interface ActiveCommercialUserRow {
    id: string;
}

interface StoreOrderSyncRow {
    id: string;
    store_product_id: string;
    stock_product_id: string | null;
    product_name: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    shipping_address: Record<string, unknown> | null;
    amount_cents: number;
    customer_id: string | null;
    crm_order_id: string | null;
    crm_payment_id: string | null;
}

interface StoreProductSimulationRow {
    id: string;
    stock_product_id: string | null;
    name: string;
    is_published: boolean;
    is_custom: boolean;
    price_cents: number | null;
    price_from_cents: number | null;
    base_price_cents: number | null;
}

export interface StorePaymentSyncPayload {
    paymentId: string;
    status: 'approved';
    amountCents: number;
    paymentMethod: string | null;
    orderId: string;
}

export function canSimulateStorePayments(nodeEnv: string): boolean {
    return nodeEnv !== 'production';
}

export function buildSimulatedStorePaymentPayload(input: {
    storeOrderId: string;
    amountCents: number;
    now?: Date;
}): StorePaymentSyncPayload {
    const now = input.now ?? new Date();

    return {
        paymentId: `sim_${input.storeOrderId}_${now.getTime()}`,
        status: 'approved',
        amountCents: input.amountCents,
        paymentMethod: 'simulated-link',
        orderId: input.storeOrderId,
    };
}

async function resolveStoreAssigneeUserId(client: PoolClient): Promise<string> {
    const result = await client.query<ActiveCommercialUserRow>(
        `SELECT id
         FROM users
         WHERE status = 'active'
           AND role IN ('ADMIN', 'ATENDENTE')
         ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, created_at ASC
         LIMIT 1`
    );

    const userId = result.rows[0]?.id;
    if (!userId) {
        throw AppError.serviceUnavailable(
            'STORE_SYNC_WITHOUT_ASSIGNEE',
            'Nenhum usuário comercial ativo disponível para receber pedidos da loja.'
        );
    }

    return userId;
}

async function resolveStoreCustomerId(
    client: PoolClient,
    storeOrder: StoreOrderSyncRow,
    assignedTo: string
): Promise<string> {
    if (storeOrder.customer_id) {
        return storeOrder.customer_id;
    }

    if (storeOrder.customer_email) {
        const emailMatch = await client.query<{ id: string }>(
            `SELECT id
             FROM customers
             WHERE email = $1
             LIMIT 1`,
            [storeOrder.customer_email]
        );

        if (emailMatch.rows[0]?.id) {
            return emailMatch.rows[0].id;
        }
    }

    const normalizedPhone = normalizeStoreCustomerPhone(storeOrder.customer_phone, storeOrder.id);
    const phoneMatch = await client.query<{ id: string }>(
        `SELECT id
         FROM customers
         WHERE whatsapp_number = $1
         LIMIT 1`,
        [normalizedPhone]
    );

    if (phoneMatch.rows[0]?.id) {
        return phoneMatch.rows[0].id;
    }

    const created = await client.query<{ id: string }>(
        `INSERT INTO customers (
            name,
            whatsapp_number,
            email,
            address,
            assigned_to,
            notes
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
            storeOrder.customer_name?.trim() || `Cliente Loja ${storeOrder.id.slice(0, 8)}`,
            normalizedPhone,
            storeOrder.customer_email ?? null,
            storeOrder.shipping_address ? JSON.stringify(storeOrder.shipping_address) : null,
            assignedTo,
            `Cliente criado automaticamente a partir da loja pública. Store order ${storeOrder.id}.`,
        ]
    );

    const customerId = created.rows[0]?.id;
    if (!customerId) {
        throw AppError.serviceUnavailable(
            'STORE_CUSTOMER_CREATE_FAILED',
            'Não foi possível criar o cliente da loja pública.'
        );
    }

    return customerId;
}

async function createCrmOrderFromStoreOrder(
    client: PoolClient,
    storeOrder: StoreOrderSyncRow,
    customerId: string,
    assignedTo: string,
    paymentId: string
): Promise<string> {
    if (storeOrder.crm_order_id) {
        return storeOrder.crm_order_id;
    }

    if (!storeOrder.stock_product_id) {
        throw AppError.conflict(
            'STORE_PRODUCT_NOT_LINKED',
            'O produto da loja precisa estar vinculado a um produto de estoque para gerar pedido.'
        );
    }

    const orderNumber = generateOrderNumber();
    const created = await client.query<{ id: string }>(
        `INSERT INTO orders (
            order_number,
            type,
            status,
            customer_id,
            assigned_to,
            total_amount_cents,
            discount_cents,
            final_amount_cents,
            notes,
            delivery_type,
            delivery_address
         ) VALUES ($1, 'PRONTA_ENTREGA', 'AGUARDANDO_PAGAMENTO', $2, $3, $4, 0, $4, $5, 'ENTREGA', $6)
         RETURNING id`,
        [
            orderNumber,
            customerId,
            assignedTo,
            storeOrder.amount_cents,
            buildStoreCrmOrderNotes({
                storeOrderId: storeOrder.id,
                paymentId,
                existingNotes: null,
            }),
            storeOrder.shipping_address ? JSON.stringify(storeOrder.shipping_address) : null,
        ]
    );

    const orderId = created.rows[0]?.id;
    if (!orderId) {
        throw AppError.serviceUnavailable(
            'STORE_ORDER_SYNC_FAILED',
            'Não foi possível gerar o pedido interno da loja.'
        );
    }

    await client.query(
        `INSERT INTO order_items (
            order_id,
            product_id,
            description,
            quantity,
            unit_price_cents
         ) VALUES ($1, $2, $3, 1, $4)`,
        [orderId, storeOrder.stock_product_id, storeOrder.product_name, storeOrder.amount_cents]
    );

    return orderId;
}

export async function syncApprovedStoreOrderToCrm(
    client: PoolClient,
    storeOrderId: string,
    paymentPayload: StorePaymentSyncPayload
): Promise<void> {
    const result = await client.query<StoreOrderSyncRow>(
        `SELECT
            so.id,
            so.store_product_id,
            sp.stock_product_id,
            sp.name AS product_name,
            so.customer_name,
            so.customer_email,
            so.customer_phone,
            so.shipping_address,
            so.amount_cents,
            so.customer_id,
            so.crm_order_id,
            so.crm_payment_id
         FROM store_orders so
         INNER JOIN store_products sp ON sp.id = so.store_product_id
         WHERE so.id = $1
         LIMIT 1
         FOR UPDATE`,
        [storeOrderId]
    );

    const storeOrder = result.rows[0];
    if (!storeOrder) {
        throw AppError.notFound('Pedido da loja não encontrado para sincronização.');
    }

    const assignedTo = await resolveStoreAssigneeUserId(client);
    const customerId = await resolveStoreCustomerId(client, storeOrder, assignedTo);
    const orderId = await createCrmOrderFromStoreOrder(
        client,
        storeOrder,
        customerId,
        assignedTo,
        paymentPayload.paymentId
    );

    const payment = await createPaymentRecord(client, {
        orderId,
        amountCents: storeOrder.amount_cents,
        status: 'APPROVED',
        paymentMethod: 'LINK_PAGAMENTO',
        idempotencyKey: `store:${storeOrder.id}:${paymentPayload.paymentId}`,
        webhookPayload: {
            source: paymentPayload.paymentMethod ?? 'storefront',
            store_order_id: storeOrder.id,
            mercado_pago_payment_id: paymentPayload.paymentId,
            mercado_pago_status: paymentPayload.status,
        },
    });

    await applyApprovedPaymentEffects(client, {
        paymentId: payment.id,
        orderId,
        amountCents: storeOrder.amount_cents,
        paymentMethod: 'LINK_PAGAMENTO',
        actorUserId: assignedTo,
    });

    await client.query(
        `UPDATE store_orders
         SET
            customer_id = $2,
            crm_order_id = $3,
            crm_payment_id = $4,
            updated_at = NOW()
         WHERE id = $1`,
        [storeOrder.id, customerId, orderId, payment.id]
    );
}

export async function createSimulatedApprovedStoreOrder(
    client: PoolClient,
    input: {
        storeProductId: string;
        customerName?: string | null;
        customerEmail?: string | null;
        customerPhone?: string | null;
        shippingAddress?: Record<string, unknown> | null;
        now?: Date;
    }
): Promise<{
    storeOrderId: string;
    paymentId: string;
}> {
    const result = await client.query<StoreProductSimulationRow>(
        `SELECT
            sp.id,
            sp.stock_product_id,
            sp.name,
            sp.is_published,
            sp.is_custom,
            sp.price_cents,
            sp.price_from_cents,
            p.price_cents AS base_price_cents
         FROM store_products sp
         LEFT JOIN products p ON p.id = sp.stock_product_id
         WHERE sp.id = $1
         LIMIT 1
         FOR UPDATE`,
        [input.storeProductId]
    );

    const product = result.rows[0];
    if (!product) {
        throw AppError.notFound('Produto da loja não encontrado para simulação.');
    }

    if (!product.is_published) {
        throw AppError.conflict('STORE_PRODUCT_NOT_PUBLISHED', 'Publique o produto antes de simular a venda.');
    }

    if (product.is_custom) {
        throw AppError.conflict('STORE_PRODUCT_CUSTOM_ONLY', 'A simulação automática não cobre produtos personalizados.');
    }

    if (!product.stock_product_id) {
        throw AppError.conflict('STORE_PRODUCT_NOT_LINKED', 'Vincule o produto da loja a um item de estoque antes da simulação.');
    }

    const amountCents = resolveStorePriceCents({
        price_cents: product.price_cents ?? product.base_price_cents,
        price_from_cents: product.price_from_cents,
    });

    if (!amountCents) {
        throw AppError.conflict('STORE_PRODUCT_WITHOUT_PRICE', 'Configure o preço do produto antes da simulação.');
    }

    const created = await client.query<{ id: string }>(
        `INSERT INTO store_orders (
            store_product_id,
            mp_payment_id,
            status,
            customer_name,
            customer_email,
            customer_phone,
            shipping_address,
            amount_cents,
            paid_at
         ) VALUES ($1, $2, 'approved', $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [
            product.id,
            null,
            input.customerName?.trim() || 'Cliente Teste Loja',
            input.customerEmail ?? 'teste.loja@orion.local',
            input.customerPhone ?? '+5511999999999',
            input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
            amountCents,
        ]
    );

    const storeOrderId = created.rows[0]?.id;
    if (!storeOrderId) {
        throw AppError.serviceUnavailable(
            'STORE_SIMULATION_CREATE_FAILED',
            'Não foi possível criar o pedido simulado da loja.'
        );
    }

    const paymentPayload = buildSimulatedStorePaymentPayload({
        storeOrderId,
        amountCents,
        now: input.now,
    });

    await client.query(
        `UPDATE store_orders
         SET mp_payment_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [storeOrderId, paymentPayload.paymentId]
    );

    await syncApprovedStoreOrderToCrm(client, storeOrderId, paymentPayload);

    return {
        storeOrderId,
        paymentId: paymentPayload.paymentId,
    };
}
