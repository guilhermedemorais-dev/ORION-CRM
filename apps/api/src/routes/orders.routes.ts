import { randomInt } from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import type { DeliveryType, OrderStatus, OrderType } from '../types/entities.js';

const router = Router();

const orderTypeSchema = z.enum(['PRONTA_ENTREGA', 'PERSONALIZADO']);
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
const deliveryTypeSchema = z.enum(['RETIRADA', 'ENTREGA']);

const listOrdersSchema = z.object({
    status: orderStatusSchema.optional(),
    type: orderTypeSchema.optional(),
    customer_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const orderItemSchema = z.object({
    product_id: z.string().uuid().optional(),
    description: z.string().trim().min(2).max(500),
    quantity: z.coerce.number().int().min(1).max(999),
    unit_price_cents: z.coerce.number().int().min(1),
});

const createOrderSchema = z.object({
    type: orderTypeSchema,
    customer_id: z.string().uuid(),
    assigned_to: z.string().uuid().optional(),
    total_amount_cents: z.coerce.number().int().min(0),
    discount_cents: z.coerce.number().int().min(0).default(0),
    notes: z.string().trim().max(4000).optional(),
    delivery_type: deliveryTypeSchema.default('RETIRADA'),
    estimated_delivery_at: z.string().datetime().optional(),
    order_items: z.array(orderItemSchema).min(1),
    design_description: z.string().trim().min(10).max(5000).optional(),
    metal_type: z.string().trim().min(2).max(100).optional(),
    production_deadline: z.string().datetime().optional(),
});

const updateOrderStatusSchema = z.object({
    status: orderStatusSchema,
});

interface OrderListRow {
    id: string;
    order_number: string;
    type: OrderType;
    status: OrderStatus;
    total_amount_cents: number;
    discount_cents: number;
    final_amount_cents: number;
    delivery_type: DeliveryType;
    estimated_delivery_at: Date | null;
    created_at: Date;
    updated_at: Date;
    notes: string | null;
    customer_id: string;
    customer_name: string;
    assigned_user_id: string;
    assigned_user_name: string;
    production_order_id: string | null;
}

interface OrderDetailRow extends OrderListRow {
    custom_detail_id: string | null;
    design_description: string | null;
    metal_type: string | null;
    production_deadline: Date | null;
    approved_at: Date | null;
    approved_by_customer: boolean | null;
}

interface OrderItemRow {
    id: string;
    order_id: string;
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_price_cents: number;
}

function getScopedAssignedTo(req: Request, explicitAssignedTo?: string): string | undefined {
    if (!req.user) {
        return undefined;
    }

    if (req.user.role === 'ATENDENTE') {
        return req.user.id;
    }

    if (req.user.role === 'PRODUCAO') {
        return req.user.id;
    }

    return explicitAssignedTo;
}

function assertCanAccessOrder(req: Request, assignedTo: string): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ADMIN' || req.user.role === 'FINANCEIRO') {
        return;
    }

    if (assignedTo !== req.user.id) {
        throw AppError.forbidden('Acesso não autorizado para este pedido.');
    }
}

function mapOrder(row: OrderListRow) {
    return {
        id: row.id,
        order_number: row.order_number,
        type: row.type,
        status: row.status,
        total_amount_cents: row.total_amount_cents,
        discount_cents: row.discount_cents,
        final_amount_cents: row.final_amount_cents,
        delivery_type: row.delivery_type,
        estimated_delivery_at: row.estimated_delivery_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        notes: row.notes,
        customer: {
            id: row.customer_id,
            name: row.customer_name,
        },
        assigned_to: {
            id: row.assigned_user_id,
            name: row.assigned_user_name,
        },
        production_order_id: row.production_order_id,
    };
}

async function fetchOrderRow(orderId: string): Promise<OrderDetailRow | null> {
    const result = await query<OrderDetailRow>(
        `SELECT
            o.id,
            o.order_number,
            o.type,
            o.status,
            o.total_amount_cents,
            o.discount_cents,
            o.final_amount_cents,
            o.delivery_type,
            o.estimated_delivery_at,
            o.created_at,
            o.updated_at,
            o.notes,
            c.id AS customer_id,
            c.name AS customer_name,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name,
            po.id AS production_order_id,
            cod.id AS custom_detail_id,
            cod.design_description,
            cod.metal_type,
            cod.production_deadline,
            cod.approved_at,
            cod.approved_by_customer
          FROM orders o
          INNER JOIN customers c ON c.id = o.customer_id
          INNER JOIN users u ON u.id = o.assigned_to
          LEFT JOIN production_orders po ON po.order_id = o.id
          LEFT JOIN custom_order_details cod ON cod.order_id = o.id
          WHERE o.id = $1
          LIMIT 1`,
        [orderId]
    );

    return result.rows[0] ?? null;
}

async function fetchOrderItems(orderId: string): Promise<OrderItemRow[]> {
    const result = await query<OrderItemRow>(
        `SELECT id, order_id, product_id, description, quantity, unit_price_cents, total_price_cents
         FROM order_items
         WHERE order_id = $1
         ORDER BY id ASC`,
        [orderId]
    );

    return result.rows;
}

function validateOrderStatusTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): void {
    if (currentStatus === nextStatus) {
        return;
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        RASCUNHO: ['AGUARDANDO_PAGAMENTO', 'AGUARDANDO_APROVACAO_DESIGN', 'CANCELADO'],
        AGUARDANDO_PAGAMENTO: ['PAGO', 'CANCELADO', 'SEPARANDO'],
        PAGO: ['SEPARANDO', 'ENVIADO', 'RETIRADO', 'CANCELADO'],
        SEPARANDO: ['ENVIADO', 'RETIRADO', 'CANCELADO'],
        ENVIADO: ['RETIRADO'],
        RETIRADO: [],
        CANCELADO: [],
        AGUARDANDO_APROVACAO_DESIGN: ['APROVADO', 'CANCELADO'],
        APROVADO: ['EM_PRODUCAO', 'AGUARDANDO_PAGAMENTO', 'CANCELADO'],
        EM_PRODUCAO: ['CONTROLE_QUALIDADE', 'AGUARDANDO_PAGAMENTO', 'CANCELADO'],
        CONTROLE_QUALIDADE: ['AGUARDANDO_PAGAMENTO', 'EM_PRODUCAO', 'CANCELADO'],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
        throw AppError.conflict(
            'INVALID_ORDER_STATUS_TRANSITION',
            `Não é possível mover o pedido de ${currentStatus} para ${nextStatus}.`
        );
    }
}

function generateOrderNumber(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = String(randomInt(1000, 9999));
    return `OR-${yyyy}${mm}${dd}-${suffix}`;
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']),
    rateLimit({ windowMs: 60 * 1000, max: 90, name: 'orders-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listOrdersSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const filters: string[] = [];
            const values: unknown[] = [];
            const scopedAssignedTo = getScopedAssignedTo(req, parsed.data.assigned_to);

            if (parsed.data.status) {
                values.push(parsed.data.status);
                filters.push(`o.status = $${values.length}`);
            }

            if (parsed.data.type) {
                values.push(parsed.data.type);
                filters.push(`o.type = $${values.length}`);
            }

            if (parsed.data.customer_id) {
                values.push(parsed.data.customer_id);
                filters.push(`o.customer_id = $${values.length}`);
            }

            if (scopedAssignedTo) {
                values.push(scopedAssignedTo);
                filters.push(`o.assigned_to = $${values.length}`);
            }

            if (parsed.data.q) {
                values.push(`%${parsed.data.q}%`);
                const searchIndex = values.length;
                filters.push(`(
                    o.order_number ILIKE $${searchIndex}
                    OR c.name ILIKE $${searchIndex}
                    OR COALESCE(o.notes, '') ILIKE $${searchIndex}
                )`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM orders o
                 INNER JOIN customers c ON c.id = o.customer_id
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<OrderListRow>(
                `SELECT
                    o.id,
                    o.order_number,
                    o.type,
                    o.status,
                    o.total_amount_cents,
                    o.discount_cents,
                    o.final_amount_cents,
                    o.delivery_type,
                    o.estimated_delivery_at,
                    o.created_at,
                    o.updated_at,
                    o.notes,
                    c.id AS customer_id,
                    c.name AS customer_name,
                    u.id AS assigned_user_id,
                    u.name AS assigned_user_name,
                    po.id AS production_order_id
                  FROM orders o
                  INNER JOIN customers c ON c.id = o.customer_id
                  INNER JOIN users u ON u.id = o.assigned_to
                  LEFT JOIN production_orders po ON po.order_id = o.id
                  ${whereClause}
                  ORDER BY o.created_at DESC
                  LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapOrder),
                meta: {
                    total,
                    page: parsed.data.page,
                    limit: parsed.data.limit,
                    pages: Math.max(1, Math.ceil(total / parsed.data.limit)),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);
            const items = await fetchOrderItems(order.id);

            res.json({
                ...mapOrder(order),
                custom_details: order.custom_detail_id
                    ? {
                        id: order.custom_detail_id,
                        design_description: order.design_description,
                        metal_type: order.metal_type,
                        production_deadline: order.production_deadline,
                        approved_at: order.approved_at,
                        approved_by_customer: order.approved_by_customer,
                    }
                    : null,
                order_items: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'orders-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createOrderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do pedido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const data = parsed.data;
            const assignedTo = req.user?.role === 'ATENDENTE' ? req.user.id : data.assigned_to ?? req.user?.id ?? null;

            if (!assignedTo) {
                next(AppError.badRequest('Responsável pelo pedido é obrigatório.'));
                return;
            }

            const assigneeResult = await query<{ id: string; role: string }>(
                `SELECT id, role
                 FROM users
                 WHERE id = $1
                   AND status = 'active'
                 LIMIT 1`,
                [assignedTo]
            );

            const assignee = assigneeResult.rows[0];
            if (!assignee) {
                next(AppError.badRequest('O responsável informado não está disponível.'));
                return;
            }

            if (!['ADMIN', 'ATENDENTE'].includes(assignee.role)) {
                next(AppError.badRequest('Pedidos comerciais devem ficar atribuídos a um usuário comercial ativo.'));
                return;
            }

            const customerResult = await query<{ id: string }>(
                'SELECT id FROM customers WHERE id = $1 LIMIT 1',
                [data.customer_id]
            );
            if (!customerResult.rows[0]) {
                next(AppError.notFound('Cliente não encontrado.'));
                return;
            }

            if (data.type === 'PERSONALIZADO' && (!data.design_description || !data.metal_type)) {
                next(AppError.badRequest(
                    'Pedidos personalizados exigem descrição do design e tipo de metal.'
                ));
                return;
            }

            const calculatedTotal = data.order_items.reduce((sum, item) => sum + (item.quantity * item.unit_price_cents), 0);
            if (calculatedTotal !== data.total_amount_cents) {
                next(AppError.badRequest('O valor total informado não confere com os itens do pedido.'));
                return;
            }

            if (data.discount_cents > data.total_amount_cents) {
                next(AppError.badRequest('O desconto não pode ser maior que o total do pedido.'));
                return;
            }

            const orderNumber = generateOrderNumber();
            const initialStatus: OrderStatus = data.type === 'PRONTA_ENTREGA'
                ? 'AGUARDANDO_PAGAMENTO'
                : 'AGUARDANDO_APROVACAO_DESIGN';

            const createdOrder = await transaction(async (client) => {
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
                        delivery_type,
                        estimated_delivery_at
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                      RETURNING id`,
                    [
                        orderNumber,
                        data.type,
                        initialStatus,
                        data.customer_id,
                        assignedTo,
                        data.total_amount_cents,
                        data.discount_cents,
                        data.total_amount_cents - data.discount_cents,
                        data.notes ?? null,
                        data.delivery_type,
                        data.estimated_delivery_at ? new Date(data.estimated_delivery_at) : null,
                    ]
                );

                const orderId = orderResult.rows[0]?.id;
                if (!orderId) {
                    throw AppError.internal(req.requestId);
                }

                for (const item of data.order_items) {
                    await client.query(
                        `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price_cents)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [orderId, item.product_id ?? null, item.description, item.quantity, item.unit_price_cents]
                    );
                }

                if (data.type === 'PERSONALIZADO') {
                    await client.query(
                        `INSERT INTO custom_order_details (
                            order_id,
                            design_description,
                            design_images,
                            metal_type,
                            production_deadline
                          ) VALUES ($1, $2, '{}', $3, $4)`,
                        [
                            orderId,
                            data.design_description,
                            data.metal_type,
                            data.production_deadline ? new Date(data.production_deadline) : null,
                        ]
                    );
                }

                return orderId;
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'orders',
                    entityId: createdOrder,
                    oldValue: null,
                    newValue: {
                        order_number: orderNumber,
                        status: initialStatus,
                        type: data.type,
                    },
                    req,
                });
            }

            const order = await fetchOrderRow(createdOrder);
            if (!order) {
                throw AppError.internal(req.requestId);
            }

            const items = await fetchOrderItems(order.id);

            res.status(201).json({
                ...mapOrder(order),
                custom_details: order.custom_detail_id
                    ? {
                        id: order.custom_detail_id,
                        design_description: order.design_description,
                        metal_type: order.metal_type,
                        production_deadline: order.production_deadline,
                        approved_at: order.approved_at,
                        approved_by_customer: order.approved_by_customer,
                    }
                    : null,
                order_items: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:id/status',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'orders-status' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const parsed = updateOrderStatusSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Status inválido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);
            validateOrderStatusTransition(order.status, parsed.data.status);

            if (
                order.type === 'PERSONALIZADO'
                && parsed.data.status === 'APROVADO'
                && !order.custom_detail_id
            ) {
                next(AppError.conflict('MISSING_CUSTOM_ORDER_DETAILS', 'O pedido personalizado ainda não possui detalhes de design.'));
                return;
            }

            await transaction(async (client) => {
                await client.query(
                    `UPDATE orders
                     SET
                       status = $2::order_status,
                       updated_at = NOW(),
                       cancelled_at = CASE WHEN $2::order_status = 'CANCELADO' THEN NOW() ELSE cancelled_at END
                     WHERE id = $1`,
                    [order.id, parsed.data.status]
                );

                if (order.type === 'PERSONALIZADO' && parsed.data.status === 'APROVADO') {
                    const productionAssigneeResult = await client.query<{ id: string }>(
                        `SELECT id
                         FROM users
                         WHERE id = $1
                           AND status = 'active'
                           AND role = 'PRODUCAO'
                         LIMIT 1`,
                        [order.assigned_user_id]
                    );

                    await client.query(
                        `UPDATE custom_order_details
                         SET
                           approved_at = COALESCE(approved_at, NOW()),
                           approved_by_customer = true
                         WHERE order_id = $1`,
                        [order.id]
                    );

                    await client.query(
                        `INSERT INTO production_orders (order_id, assigned_to, current_step, status, deadline)
                         VALUES ($1, $2, 'SOLDA', 'PENDENTE', $3)
                         ON CONFLICT (order_id) DO NOTHING`,
                        [order.id, productionAssigneeResult.rows[0]?.id ?? null, order.production_deadline]
                    );
                }
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_STATUS',
                    entityType: 'orders',
                    entityId: order.id,
                    oldValue: {
                        status: order.status,
                    },
                    newValue: {
                        status: parsed.data.status,
                    },
                    req,
                });
            }

            const updatedOrder = await fetchOrderRow(order.id);
            const items = await fetchOrderItems(order.id);

            res.json({
                ...mapOrder(updatedOrder as OrderDetailRow),
                custom_details: updatedOrder?.custom_detail_id
                    ? {
                        id: updatedOrder.custom_detail_id,
                        design_description: updatedOrder.design_description,
                        metal_type: updatedOrder.metal_type,
                        production_deadline: updatedOrder.production_deadline,
                        approved_at: updatedOrder.approved_at,
                        approved_by_customer: updatedOrder.approved_by_customer,
                    }
                    : null,
                order_items: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
