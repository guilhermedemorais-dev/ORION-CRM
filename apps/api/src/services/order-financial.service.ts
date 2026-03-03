import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AppError } from '../lib/errors.js';

export const MANUAL_PAYMENT_METHODS = [
    'DINHEIRO',
    'CARTAO_DEBITO',
    'CARTAO_CREDITO',
    'PIX',
    'LINK_PAGAMENTO',
] as const;

export type ManualPaymentMethod = typeof MANUAL_PAYMENT_METHODS[number];

interface OrderSettlementRow {
    id: string;
    order_number: string;
    type: 'PRONTA_ENTREGA' | 'PERSONALIZADO';
    status: string;
    assigned_to: string | null;
    final_amount_cents: number;
    commission_rate: number | null;
}

interface OrderItemProductRow {
    id: string;
    product_id: string | null;
    description: string;
    quantity: number;
}

interface ProductStockRow {
    id: string;
    code: string;
    name: string;
    stock_quantity: number;
}

interface PaymentRow {
    id: string;
    order_id: string;
    amount_cents: number;
    status: string;
    payment_method: string | null;
    paid_at: Date | null;
    idempotency_key: string;
}

interface PdvItemInput {
    productId: string;
    quantity: number;
}

export interface CreatePaymentRecordInput {
    orderId: string;
    amountCents: number;
    status: 'PENDING' | 'APPROVED' | 'CANCELLED';
    paymentMethod: ManualPaymentMethod;
    idempotencyKey?: string;
    webhookPayload?: Record<string, unknown> | null;
}

export interface ApplyApprovedPaymentInput {
    paymentId: string;
    orderId: string;
    amountCents: number;
    paymentMethod: ManualPaymentMethod;
    actorUserId: string;
}

export interface FinalizePdvSaleInput {
    customerId: string | null;
    items: PdvItemInput[];
    paymentMethod: ManualPaymentMethod;
    discountCents: number;
    notes?: string | null;
    actorUserId: string;
}

export function generateOrderNumber(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = String(randomInt(1000, 9999));
    return `OR-${yyyy}${mm}${dd}-${suffix}`;
}

async function getOrderForSettlement(client: PoolClient, orderId: string): Promise<OrderSettlementRow> {
    const result = await client.query<Omit<OrderSettlementRow, 'commission_rate'>>(
        `SELECT
            id,
            order_number,
            type,
            status,
            assigned_to,
            final_amount_cents
          FROM orders
          WHERE id = $1
          FOR UPDATE`,
        [orderId]
    );

    const order = result.rows[0];
    if (!order) {
        throw AppError.notFound('Pedido não encontrado.');
    }

    let commissionRate: number | null = null;

    if (order.assigned_to) {
        const commissionResult = await client.query<{ commission_rate: number }>(
            `SELECT commission_rate
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [order.assigned_to]
        );

        commissionRate = commissionResult.rows[0]?.commission_rate ?? null;
    }

    return {
        ...order,
        commission_rate: commissionRate,
    };
}

async function getOrderItems(client: PoolClient, orderId: string): Promise<OrderItemProductRow[]> {
    const result = await client.query<OrderItemProductRow>(
        `SELECT id, product_id, description, quantity
         FROM order_items
         WHERE order_id = $1
         ORDER BY id ASC`,
        [orderId]
    );

    return result.rows;
}

async function ensureFinancialEntry(
    client: PoolClient,
    input: {
        order: OrderSettlementRow;
        paymentId: string;
        amountCents: number;
        paymentMethod: ManualPaymentMethod;
        createdBy: string;
    }
): Promise<void> {
    const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM financial_entries
         WHERE payment_id = $1
         LIMIT 1`,
        [input.paymentId]
    );

    if (existing.rows[0]) {
        return;
    }

    const commissionRate = input.order.commission_rate ?? 0;
    const commissionAmountCents = input.order.assigned_to
        ? Math.round(input.order.final_amount_cents * (commissionRate / 100))
        : null;

    await client.query(
        `INSERT INTO financial_entries (
            type,
            amount_cents,
            category,
            description,
            order_id,
            payment_id,
            commission_user_id,
            commission_amount_cents,
            competence_date,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9)`,
        [
            'ENTRADA',
            input.amountCents,
            input.paymentMethod === 'LINK_PAGAMENTO' ? 'VENDAS_ONLINE' : 'VENDAS_BALCAO',
            `Recebimento do pedido ${input.order.order_number}`,
            input.order.id,
            input.paymentId,
            input.order.assigned_to,
            commissionAmountCents,
            input.createdBy,
        ]
    );
}

async function applyProntaEntregaStockDecrease(
    client: PoolClient,
    order: OrderSettlementRow,
    createdBy: string
): Promise<void> {
    const existingMovements = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM stock_movements
         WHERE order_id = $1
           AND type = 'SAIDA'`,
        [order.id]
    );

    if (Number.parseInt(existingMovements.rows[0]?.total ?? '0', 10) > 0) {
        return;
    }

    const items = await getOrderItems(client, order.id);
    if (items.length === 0) {
        throw AppError.conflict('ORDER_WITHOUT_ITEMS', 'O pedido não possui itens válidos para baixa de estoque.');
    }

    if (items.some((item) => !item.product_id)) {
        throw AppError.conflict(
            'ORDER_ITEM_MISSING_PRODUCT',
            'Pedido de pronta entrega exige item vinculado a produto para movimentar estoque.'
        );
    }

    for (const item of items) {
        const productResult = await client.query<ProductStockRow>(
            `SELECT id, code, name, stock_quantity
             FROM products
             WHERE id = $1
             FOR UPDATE`,
            [item.product_id]
        );

        const product = productResult.rows[0];
        if (!product) {
            throw AppError.notFound(`Produto do item "${item.description}" não encontrado.`);
        }

        if (product.stock_quantity < item.quantity) {
            throw AppError.conflict(
                'INSUFFICIENT_STOCK',
                `Estoque insuficiente. Disponível: ${product.stock_quantity}`
            );
        }

        const newStock = product.stock_quantity - item.quantity;

        await client.query(
            `UPDATE products
             SET
               stock_quantity = $2,
               updated_at = NOW()
             WHERE id = $1`,
            [product.id, newStock]
        );

        await client.query(
            `INSERT INTO stock_movements (
                product_id,
                type,
                quantity,
                previous_stock,
                new_stock,
                reason,
                order_id,
                created_by
              ) VALUES ($1, 'SAIDA', $2, $3, $4, $5, $6, $7)`,
            [
                product.id,
                item.quantity,
                product.stock_quantity,
                newStock,
                `Baixa automática do pedido ${order.order_number}`,
                order.id,
                createdBy,
            ]
        );
    }
}

export async function createPaymentRecord(
    client: PoolClient,
    input: CreatePaymentRecordInput
): Promise<PaymentRow> {
    const order = await getOrderForSettlement(client, input.orderId);

    if (input.amountCents !== order.final_amount_cents) {
        throw AppError.badRequest('O valor do pagamento deve ser igual ao valor final do pedido.');
    }

    const idempotencyKey = input.idempotencyKey ?? randomUUID();

    const existing = await client.query<PaymentRow>(
        `SELECT id, order_id, amount_cents, status, payment_method, paid_at, idempotency_key
         FROM payments
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
    );

    if (existing.rows[0]) {
        return existing.rows[0];
    }

    const result = await client.query<PaymentRow>(
        `INSERT INTO payments (
            order_id,
            amount_cents,
            status,
            payment_method,
            paid_at,
            idempotency_key,
            webhook_payload
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, order_id, amount_cents, status, payment_method, paid_at, idempotency_key`,
        [
            input.orderId,
            input.amountCents,
            input.status,
            input.paymentMethod,
            input.status === 'APPROVED' ? new Date() : null,
            idempotencyKey,
            input.webhookPayload ? JSON.stringify(input.webhookPayload) : null,
        ]
    );

    return result.rows[0] as PaymentRow;
}

export async function applyApprovedPaymentEffects(
    client: PoolClient,
    input: ApplyApprovedPaymentInput
): Promise<void> {
    const order = await getOrderForSettlement(client, input.orderId);

    if (input.amountCents !== order.final_amount_cents) {
        throw AppError.badRequest('O valor aprovado não confere com o valor final do pedido.');
    }

    if (!['AGUARDANDO_PAGAMENTO', 'PAGO'].includes(order.status)) {
        throw AppError.conflict(
            'INVALID_ORDER_PAYMENT_STATE',
            'O pedido não está em um estado elegível para confirmação de pagamento.'
        );
    }

    const paymentResult = await client.query<{ status: string }>(
        `SELECT status
         FROM payments
         WHERE id = $1
         FOR UPDATE`,
        [input.paymentId]
    );

    const payment = paymentResult.rows[0];
    if (!payment) {
        throw AppError.notFound('Pagamento não encontrado.');
    }

    if (payment.status !== 'APPROVED') {
        await client.query(
            `UPDATE payments
             SET
               status = 'APPROVED',
               payment_method = $2,
               paid_at = COALESCE(paid_at, NOW()),
               updated_at = NOW()
             WHERE id = $1`,
            [input.paymentId, input.paymentMethod]
        );
    }

    if (order.type === 'PRONTA_ENTREGA') {
        await applyProntaEntregaStockDecrease(client, order, input.actorUserId);
    }

    await ensureFinancialEntry(client, {
        order,
        paymentId: input.paymentId,
        amountCents: input.amountCents,
        paymentMethod: input.paymentMethod,
        createdBy: input.actorUserId,
    });

    if (order.status !== 'PAGO') {
        await client.query(
            `UPDATE orders
             SET
               status = 'PAGO',
               updated_at = NOW()
             WHERE id = $1`,
            [order.id]
        );
    }
}

async function resolvePdvCustomerId(client: PoolClient, customerId: string | null): Promise<string> {
    if (customerId) {
        const existingCustomer = await client.query<{ id: string }>(
            'SELECT id FROM customers WHERE id = $1 LIMIT 1',
            [customerId]
        );

        if (!existingCustomer.rows[0]) {
            throw AppError.notFound('Cliente não encontrado.');
        }

        return customerId;
    }

    const existingWalkIn = await client.query<{ id: string }>(
        `SELECT id
         FROM customers
         WHERE whatsapp_number = '+5500000000000'
         LIMIT 1`
    );

    if (existingWalkIn.rows[0]) {
        return existingWalkIn.rows[0].id;
    }

    const created = await client.query<{ id: string }>(
        `INSERT INTO customers (name, whatsapp_number, notes)
         VALUES ('Cliente Balcão', '+5500000000000', 'Cliente padrão para vendas de balcão sem identificação')
         RETURNING id`
    );

    const createdId = created.rows[0]?.id;
    if (!createdId) {
        throw AppError.serviceUnavailable('PDV_CUSTOMER_CREATE_FAILED', 'Não foi possível criar o cliente padrão do PDV.');
    }

    return createdId;
}

export async function finalizePdvSale(
    client: PoolClient,
    input: FinalizePdvSaleInput
): Promise<{
    orderId: string;
    paymentId: string;
    orderNumber: string;
    totalCents: number;
}> {
    if (input.items.length === 0) {
        throw AppError.badRequest('Adicione ao menos um item no carrinho do PDV.');
    }

    const customerId = await resolvePdvCustomerId(client, input.customerId);

    const normalizedItems: Array<{
        productId: string;
        product: ProductStockRow & { price_cents: number };
        quantity: number;
    }> = [];

    let totalCents = 0;

    for (const item of input.items) {
        const productResult = await client.query<ProductStockRow & { price_cents: number }>(
            `SELECT id, code, name, stock_quantity, price_cents
             FROM products
             WHERE id = $1
               AND is_active = true
             FOR UPDATE`,
            [item.productId]
        );

        const product = productResult.rows[0];
        if (!product) {
            throw AppError.notFound('Produto não encontrado para a venda de balcão.');
        }

        if (product.stock_quantity < item.quantity) {
            throw AppError.conflict(
                'INSUFFICIENT_STOCK',
                `Estoque insuficiente. Disponível: ${product.stock_quantity}`
            );
        }

        normalizedItems.push({
            productId: item.productId,
            product,
            quantity: item.quantity,
        });

        totalCents += product.price_cents * item.quantity;
    }

    if (input.discountCents > totalCents) {
        throw AppError.badRequest('O desconto do PDV não pode ser maior que o total da venda.');
    }

    const orderNumber = generateOrderNumber();

    const orderResult = await client.query<{ id: string }>(
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
            delivery_type
          ) VALUES ($1, 'PRONTA_ENTREGA', 'RETIRADO', $2, $3, $4, $5, $6, $7, 'RETIRADA')
          RETURNING id`,
        [
            orderNumber,
            customerId,
            input.actorUserId,
            totalCents,
            input.discountCents,
            totalCents - input.discountCents,
            input.notes ?? null,
        ]
    );

    const orderId = orderResult.rows[0]?.id;
    if (!orderId) {
        throw AppError.serviceUnavailable('PDV_ORDER_CREATE_FAILED', 'Não foi possível registrar a venda do PDV.');
    }

    for (const item of normalizedItems) {
        const unitPrice = item.product.price_cents;
        const itemTotal = unitPrice * item.quantity;

        await client.query(
            `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price_cents)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, item.productId, item.product.name, item.quantity, unitPrice]
        );

        const newStock = item.product.stock_quantity - item.quantity;

        await client.query(
            `UPDATE products
             SET
               stock_quantity = $2,
               updated_at = NOW()
             WHERE id = $1`,
            [item.productId, newStock]
        );

        await client.query(
            `INSERT INTO stock_movements (
                product_id,
                type,
                quantity,
                previous_stock,
                new_stock,
                reason,
                order_id,
                created_by
              ) VALUES ($1, 'SAIDA', $2, $3, $4, $5, $6, $7)`,
            [
                item.productId,
                item.quantity,
                item.product.stock_quantity,
                newStock,
                `Venda PDV ${orderNumber}`,
                orderId,
                input.actorUserId,
            ]
        );
    }

    const payment = await createPaymentRecord(client, {
        orderId,
        amountCents: totalCents - input.discountCents,
        status: 'APPROVED',
        paymentMethod: input.paymentMethod,
        idempotencyKey: `pdv:${orderId}`,
    });

    const order: OrderSettlementRow = {
        id: orderId,
        order_number: orderNumber,
        type: 'PRONTA_ENTREGA',
        status: 'RETIRADO',
        assigned_to: input.actorUserId,
        final_amount_cents: totalCents - input.discountCents,
        commission_rate: 0,
    };

    const userResult = await client.query<{ commission_rate: number }>(
        `SELECT commission_rate
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [input.actorUserId]
    );

    order.commission_rate = userResult.rows[0]?.commission_rate ?? 0;

    await ensureFinancialEntry(client, {
        order,
        paymentId: payment.id,
        amountCents: totalCents - input.discountCents,
        paymentMethod: input.paymentMethod,
        createdBy: input.actorUserId,
    });

    return {
        orderId,
        paymentId: payment.id,
        orderNumber,
        totalCents: totalCents - input.discountCents,
    };
}
