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
import { sendWhatsAppMessage } from '../services/whatsapp-sender.service.js';
import { checkFlowRules } from '../services/flow-rules.service.js';
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
    paused: z.enum(['1', '0', 'true', 'false']).optional(),
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
    customer_whatsapp_number: string | null;
    assigned_user_id: string;
    assigned_user_name: string;
    production_order_id: string | null;
    paused_at: Date | null;
    paused_reason: string | null;
    paused_by: string | null;
    cancelled_at: Date | null;
    cancellation_reason: string | null;
    payment_status: 'nao_pago' | 'parcial' | 'pago' | 'estornado' | 'isento';
    flow_id: string | null;
    current_stage_id: string | null;
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

    if (req.user.role === 'ROOT' || req.user.role === 'ADMIN' || req.user.role === 'FINANCEIRO') {
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
            whatsapp_number: row.customer_whatsapp_number,
        },
        assigned_to: {
            id: row.assigned_user_id,
            name: row.assigned_user_name,
        },
        production_order_id: row.production_order_id,
        paused_at: row.paused_at,
        paused_reason: row.paused_reason,
        paused_by: row.paused_by,
        cancelled_at: row.cancelled_at,
        cancellation_reason: row.cancellation_reason,
        payment_status: row.payment_status,
        flow_id: row.flow_id,
        current_stage_id: row.current_stage_id,
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
            o.paused_at,
            o.paused_reason,
            o.paused_by,
            o.cancelled_at,
            o.cancellation_reason,
            o.payment_status,
            o.flow_id,
            o.current_stage_id,
            c.id AS customer_id,
            c.name AS customer_name,
            c.whatsapp_number AS customer_whatsapp_number,
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

            if (parsed.data.paused === '1' || parsed.data.paused === 'true') {
                filters.push(`o.paused_at IS NOT NULL`);
            } else if (parsed.data.paused === '0' || parsed.data.paused === 'false') {
                filters.push(`o.paused_at IS NULL`);
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
                    o.paused_at,
                    o.paused_reason,
                    o.paused_by,
                    o.cancelled_at,
                    o.cancellation_reason,
            o.payment_status,
            o.flow_id,
            o.current_stage_id,
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.whatsapp_number AS customer_whatsapp_number,
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

// ── GET /orders/stats ─────────────────────────────────────────────────────────
// (definido antes de /:id para não colidir com o parâmetro de rota)
router.get(
    '/stats',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<{
                active: string;
                awaiting_payment: string;
                in_production: string;
                paused: string;
                open_value_cents: string;
            }>(
                `SELECT
                    COUNT(*) FILTER (
                        WHERE o.status NOT IN ('CANCELADO', 'RETIRADO')
                          AND o.paused_at IS NULL
                    )::text AS active,
                    COUNT(*) FILTER (WHERE o.status = 'AGUARDANDO_PAGAMENTO')::text AS awaiting_payment,
                    COUNT(*) FILTER (WHERE o.status IN ('EM_PRODUCAO', 'CONTROLE_QUALIDADE'))::text AS in_production,
                    COUNT(*) FILTER (WHERE o.paused_at IS NOT NULL)::text AS paused,
                    COALESCE(SUM(o.final_amount_cents) FILTER (
                        WHERE o.status NOT IN ('CANCELADO', 'RETIRADO')
                    ), 0)::text AS open_value_cents
                 FROM orders o`
            );

            const row = result.rows[0];
            res.json({
                active: Number(row?.active ?? 0),
                awaiting_payment: Number(row?.awaiting_payment ?? 0),
                in_production: Number(row?.in_production ?? 0),
                paused: Number(row?.paused ?? 0),
                open_value_cents: Number(row?.open_value_cents ?? 0),
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── GET /orders/export ────────────────────────────────────────────────────────
// (definido antes de /:id para não colidir com o parâmetro de rota)
router.get(
    '/export',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const scopedAssignedTo = getScopedAssignedTo(req);
            const filters: string[] = [];
            const values: unknown[] = [];

            if (scopedAssignedTo) {
                values.push(scopedAssignedTo);
                filters.push(`o.assigned_to = $${values.length}`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const result = await query<{
                order_number: string;
                type: OrderType;
                status: OrderStatus;
                customer_name: string;
                assigned_user_name: string;
                final_amount_cents: number;
                delivery_type: DeliveryType;
                paused_at: Date | null;
                cancelled_at: Date | null;
                created_at: Date;
            }>(
                `SELECT
                    o.order_number,
                    o.type,
                    o.status,
                    c.name AS customer_name,
                    u.name AS assigned_user_name,
                    o.final_amount_cents,
                    o.delivery_type,
                    o.paused_at,
                    o.cancelled_at,
                    o.created_at
                 FROM orders o
                 INNER JOIN customers c ON c.id = o.customer_id
                 INNER JOIN users u ON u.id = o.assigned_to
                 ${whereClause}
                 ORDER BY o.created_at DESC`,
                values
            );

            const escape = (v: unknown): string => {
                const s = v === null || v === undefined ? '' : String(v);
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const fmtBrl = (c: number) =>
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
            const fmtIso = (d: Date | null) => (d ? new Date(d).toISOString() : '');

            const header = 'Pedido,Tipo,Status,Cliente,Responsavel,Valor,Entrega,Pausado em,Cancelado em,Criado em\n';
            const lines = result.rows.map((r) =>
                [
                    escape(r.order_number),
                    escape(r.type),
                    escape(r.status),
                    escape(r.customer_name),
                    escape(r.assigned_user_name),
                    escape(fmtBrl(r.final_amount_cents)),
                    escape(r.delivery_type),
                    escape(fmtIso(r.paused_at)),
                    escape(fmtIso(r.cancelled_at)),
                    escape(fmtIso(r.created_at)),
                ].join(',')
            );

            const csv = header + lines.join('\n') + '\n';
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="pedidos.csv"');
            res.send(csv);
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

            if (!['ROOT', 'ADMIN', 'ATENDENTE'].includes(assignee.role)) {
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

                // Auto-associa ao fluxo ativo do módulo Pedidos (se houver),
                // posicionando na primeira etapa do pipeline associado.
                const activeFlowRes = await client.query<{ id: string; pipeline_id: string; first_stage_id: string | null }>(
                    `SELECT
                        f.id,
                        f.pipeline_id,
                        (SELECT s.id FROM pipeline_stages s WHERE s.pipeline_id = f.pipeline_id ORDER BY s.position ASC LIMIT 1) AS first_stage_id
                     FROM flows f
                     WHERE f.active_module = 'pedidos'
                     LIMIT 1`
                );
                const activeFlow = activeFlowRes.rows[0];
                if (activeFlow) {
                    await client.query(
                        `UPDATE orders SET flow_id = $2, current_stage_id = $3, updated_at = NOW() WHERE id = $1`,
                        [orderId, activeFlow.id, activeFlow.first_stage_id]
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

// ── POST /orders/:id/nfe ─────────────────────────────────────────────────────
router.post(
    '/:id/nfe',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const orderRes = await query<{ id: string; customer_id: string | null }>(
                `SELECT id, customer_id FROM orders WHERE id = $1 LIMIT 1`,
                [orderId]
            );
            const o = orderRes.rows[0];
            if (!o) { next(AppError.notFound('Pedido não encontrado.')); return; }
            if (!o.customer_id) {
                next(new AppError(422, 'NFE_NO_CUSTOMER', 'Pedido sem cliente vinculado. Vincule um cliente antes de emitir NF-e.'));
                return;
            }

            const customerRes = await query<{ cpf: string | null }>(
                `SELECT cpf FROM customers WHERE id = $1 LIMIT 1`,
                [o.customer_id]
            );
            if (!customerRes.rows[0]?.cpf) {
                next(new AppError(422, 'NFE_NO_CPF', 'Cliente sem CPF/CNPJ cadastrado.'));
                return;
            }

            const existing = await query<{ id: string }>(
                `SELECT id FROM fiscal_documents WHERE order_id = $1 AND status IN ('PENDENTE','PROCESSANDO','EMITIDA') LIMIT 1`,
                [orderId]
            );
            if (existing.rows[0]) {
                res.json({ status: 'PENDENTE', message: 'NF-e já solicitada para este pedido.' });
                return;
            }

            const result = await query<{ id: string }>(
                `INSERT INTO fiscal_documents (order_id, customer_id, requested_by) VALUES ($1, $2, $3) RETURNING id`,
                [orderId, o.customer_id, req.user!.id]
            );

            res.status(201).json({
                id: result.rows[0]?.id,
                status: 'PENDENTE',
                message: 'NF-e solicitada. Você será notificado quando emitida.',
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── POST /orders/:id/send-receipt ─────────────────────────────────────────────
const sendReceiptSchema = z.object({ channel: z.enum(['whatsapp', 'email']) });

router.post(
    '/:id/send-receipt',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const parsed = sendReceiptSchema.safeParse(req.body);
            if (!parsed.success) { next(AppError.badRequest('Canal inválido.')); return; }

            const orderRes = await query<{
                id: string; order_number: string; customer_id: string | null;
                final_amount_cents: number; created_at: Date;
            }>(
                `SELECT id, order_number, customer_id, final_amount_cents, created_at FROM orders WHERE id = $1 LIMIT 1`,
                [orderId]
            );
            const o = orderRes.rows[0];
            if (!o) { next(AppError.notFound('Pedido não encontrado.')); return; }
            if (!o.customer_id) {
                next(new AppError(422, 'RECEIPT_NO_CUSTOMER', 'Pedido sem cliente vinculado.')); return;
            }

            const cRes = await query<{ name: string; whatsapp_number: string; email: string | null }>(
                `SELECT name, whatsapp_number, email FROM customers WHERE id = $1 LIMIT 1`,
                [o.customer_id]
            );
            const customer = cRes.rows[0];
            if (!customer) { next(AppError.notFound('Cliente não encontrado.')); return; }

            const sRes = await query<{ company_name: string; receipt_thanks_message: string | null }>(
                `SELECT company_name, receipt_thanks_message FROM settings LIMIT 1`
            );
            const s = sRes.rows[0];
            const storeName = s?.company_name ?? 'nossa loja';

            const fmtCurrency = (c: number) =>
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
            const fmtDate = (d: Date) =>
                new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));

            if (parsed.data.channel === 'whatsapp') {
                if (!customer.whatsapp_number) {
                    next(new AppError(422, 'RECEIPT_NO_PHONE', 'Cliente sem WhatsApp cadastrado.')); return;
                }
                const phone = customer.whatsapp_number.replace(/\D/g, '').replace(/^55/, '');
                const thanks = s?.receipt_thanks_message ?? 'Obrigado pela preferência!';
                const msg = `Olá ${customer.name.split(' ')[0]}! Segue o comprovante da sua compra na ${storeName}:`
                    + ` Pedido ${o.order_number} · Total: ${fmtCurrency(o.final_amount_cents)} · Data: ${fmtDate(o.created_at)}.`
                    + ` ${thanks}`;
                res.json({ url: `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` });
                return;
            }

            // email — sem infra de envio; retorna endereço para mailto no front
            if (!customer.email) {
                next(new AppError(422, 'RECEIPT_NO_EMAIL', 'Cliente sem e-mail cadastrado.')); return;
            }
            res.json({ sent: true, email: customer.email });
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

// ── POST /orders/:id/pause ────────────────────────────────────────────────────
const pauseOrderSchema = z.object({
    reason: z.string().trim().min(2).max(500),
});

router.post(
    '/:id/pause',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const parsed = pauseOrderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Informe o motivo da pausa.'));
                return;
            }

            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);

            if (order.status === 'CANCELADO' || order.status === 'RETIRADO') {
                next(AppError.conflict('ORDER_FINALIZED', 'Pedidos finalizados não podem ser pausados.'));
                return;
            }

            if (order.paused_at) {
                next(AppError.conflict('ORDER_ALREADY_PAUSED', 'Este pedido já está pausado.'));
                return;
            }

            await query(
                `UPDATE orders
                 SET paused_at = NOW(), paused_reason = $2, paused_by = $3, updated_at = NOW()
                 WHERE id = $1`,
                [order.id, parsed.data.reason, req.user!.id]
            );

            await createAuditLog({
                userId: req.user!.id,
                action: 'PAUSE_ORDER',
                entityType: 'orders',
                entityId: order.id,
                oldValue: { paused_at: null },
                newValue: { paused_at: new Date().toISOString(), paused_reason: parsed.data.reason },
                req,
            });

            const updated = await fetchOrderRow(order.id);
            const items = await fetchOrderItems(order.id);
            res.json({
                ...mapOrder(updated as OrderDetailRow),
                custom_details: updated?.custom_detail_id
                    ? {
                        id: updated.custom_detail_id,
                        design_description: updated.design_description,
                        metal_type: updated.metal_type,
                        production_deadline: updated.production_deadline,
                        approved_at: updated.approved_at,
                        approved_by_customer: updated.approved_by_customer,
                    }
                    : null,
                order_items: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── POST /orders/:id/resume ───────────────────────────────────────────────────
router.post(
    '/:id/resume',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);

            if (!order.paused_at) {
                next(AppError.conflict('ORDER_NOT_PAUSED', 'Este pedido não está pausado.'));
                return;
            }

            await query(
                `UPDATE orders
                 SET paused_at = NULL, paused_reason = NULL, paused_by = NULL, updated_at = NOW()
                 WHERE id = $1`,
                [order.id]
            );

            await createAuditLog({
                userId: req.user!.id,
                action: 'RESUME_ORDER',
                entityType: 'orders',
                entityId: order.id,
                oldValue: { paused_at: order.paused_at, paused_reason: order.paused_reason },
                newValue: { paused_at: null },
                req,
            });

            const updated = await fetchOrderRow(order.id);
            const items = await fetchOrderItems(order.id);
            res.json({
                ...mapOrder(updated as OrderDetailRow),
                custom_details: updated?.custom_detail_id
                    ? {
                        id: updated.custom_detail_id,
                        design_description: updated.design_description,
                        metal_type: updated.metal_type,
                        production_deadline: updated.production_deadline,
                        approved_at: updated.approved_at,
                        approved_by_customer: updated.approved_by_customer,
                    }
                    : null,
                order_items: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── POST /orders/:id/cancel ───────────────────────────────────────────────────
const cancelOrderSchema = z.object({
    reason: z.string().trim().min(2).max(500),
});

router.post(
    '/:id/cancel',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const parsed = cancelOrderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Informe o motivo do cancelamento.'));
                return;
            }

            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);

            if (order.status === 'CANCELADO') {
                next(AppError.conflict('ORDER_ALREADY_CANCELLED', 'Este pedido já está cancelado.'));
                return;
            }

            if (order.status === 'RETIRADO') {
                next(AppError.conflict('ORDER_FINALIZED', 'Pedidos retirados não podem ser cancelados.'));
                return;
            }

            await query(
                `UPDATE orders
                 SET status = 'CANCELADO',
                     cancelled_at = NOW(),
                     cancellation_reason = $2,
                     paused_at = NULL,
                     paused_reason = NULL,
                     paused_by = NULL,
                     updated_at = NOW()
                 WHERE id = $1`,
                [order.id, parsed.data.reason]
            );

            await createAuditLog({
                userId: req.user!.id,
                action: 'CANCEL_ORDER',
                entityType: 'orders',
                entityId: order.id,
                oldValue: { status: order.status },
                newValue: { status: 'CANCELADO', cancellation_reason: parsed.data.reason },
                req,
            });

            const updated = await fetchOrderRow(order.id);
            const items = await fetchOrderItems(order.id);
            res.json({
                ...mapOrder(updated as OrderDetailRow),
                custom_details: updated?.custom_detail_id
                    ? {
                        id: updated.custom_detail_id,
                        design_description: updated.design_description,
                        metal_type: updated.metal_type,
                        production_deadline: updated.production_deadline,
                        approved_at: updated.approved_at,
                        approved_by_customer: updated.approved_by_customer,
                    }
                    : null,
                order_items: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── POST /orders/:id/notify-whatsapp ──────────────────────────────────────────
// Preview + envio manual de notificação de etapa para o cliente.
const notifyWhatsAppSchema = z.object({
    message: z.string().trim().min(2).max(3000).optional(),
});

function buildStageMessage(params: {
    customerFirstName: string;
    orderNumber: string;
    status: OrderStatus;
    paused: boolean;
    storeName: string;
}): string {
    const { customerFirstName, orderNumber, status, paused, storeName } = params;

    if (paused) {
        return `Olá ${customerFirstName}! Seu pedido ${orderNumber} na ${storeName} foi temporariamente pausado. Entraremos em contato em breve com mais informações.`;
    }

    const labelByStatus: Record<OrderStatus, string> = {
        RASCUNHO: 'em rascunho',
        AGUARDANDO_PAGAMENTO: 'aguardando pagamento',
        PAGO: 'foi pago e em breve entrará em separação',
        SEPARANDO: 'em separação',
        ENVIADO: 'a caminho',
        RETIRADO: 'pronto e retirado',
        CANCELADO: 'cancelado',
        AGUARDANDO_APROVACAO_DESIGN: 'aguardando sua aprovação de design',
        APROVADO: 'aprovado e seguindo para produção',
        EM_PRODUCAO: 'em produção',
        CONTROLE_QUALIDADE: 'em controle de qualidade',
    };

    return `Olá ${customerFirstName}! Seu pedido ${orderNumber} na ${storeName} está ${labelByStatus[status]}. Qualquer dúvida estamos à disposição.`;
}

router.get(
    '/:id/notify-whatsapp/preview',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);

            if (!order.customer_whatsapp_number) {
                next(new AppError(422, 'NOTIFY_NO_PHONE', 'Cliente sem WhatsApp cadastrado.'));
                return;
            }

            const settingsRes = await query<{ company_name: string }>(
                `SELECT company_name FROM settings LIMIT 1`
            );
            const storeName = settingsRes.rows[0]?.company_name ?? 'nossa loja';
            const firstName = (order.customer_name ?? '').split(' ')[0] || 'cliente';
            const message = buildStageMessage({
                customerFirstName: firstName,
                orderNumber: order.order_number,
                status: order.status,
                paused: order.paused_at !== null,
                storeName,
            });

            res.json({
                whatsapp_number: order.customer_whatsapp_number,
                message,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/notify-whatsapp',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'orders-notify' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const parsed = notifyWhatsAppSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                next(AppError.badRequest('Mensagem inválida.'));
                return;
            }

            const order = await fetchOrderRow(orderId);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_user_id);

            if (!order.customer_whatsapp_number) {
                next(new AppError(422, 'NOTIFY_NO_PHONE', 'Cliente sem WhatsApp cadastrado.'));
                return;
            }

            let messageText = parsed.data.message;
            if (!messageText) {
                const settingsRes = await query<{ company_name: string }>(
                    `SELECT company_name FROM settings LIMIT 1`
                );
                const storeName = settingsRes.rows[0]?.company_name ?? 'nossa loja';
                const firstName = (order.customer_name ?? '').split(' ')[0] || 'cliente';
                messageText = buildStageMessage({
                    customerFirstName: firstName,
                    orderNumber: order.order_number,
                    status: order.status,
                    paused: order.paused_at !== null,
                    storeName,
                });
            }

            const result = await sendWhatsAppMessage({
                to: order.customer_whatsapp_number,
                text: messageText,
            });

            await createAuditLog({
                userId: req.user!.id,
                action: 'NOTIFY_WHATSAPP',
                entityType: 'orders',
                entityId: order.id,
                oldValue: null,
                newValue: {
                    status: order.status,
                    message_length: messageText.length,
                    provider_type: result.provider_type,
                    provider_id: result.provider_id,
                },
                req,
            });

            res.json({
                sent: true,
                provider_message_id: result.provider_message_id,
                provider_type: result.provider_type,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── PATCH /orders/:id/stage ───────────────────────────────────────────────────
// Move o pedido pra uma etapa específica do pipeline do fluxo associado.
// Aplica validação de regras (payment_rule etc.) — pode ser ignorada com override.
const moveStageSchema = z.object({
    stage_id: z.string().uuid(),
    override: z.boolean().optional(),
    override_reason: z.string().trim().min(2).max(500).optional(),
});

router.patch(
    '/:id/stage',
    authenticate,
    requireRole(['ROOT', 'ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'orders-stage' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orderId = String(req.params['id'] ?? '');
            const parsed = moveStageSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const { stage_id, override, override_reason } = parsed.data;

            const order = await fetchOrderRow(orderId);
            if (!order) { next(AppError.notFound('Pedido não encontrado.')); return; }
            assertCanAccessOrder(req, order.assigned_user_id);

            // Verifica regras do fluxo
            const ruleCheck = await checkFlowRules({ orderId, targetStageId: stage_id });

            if (!ruleCheck.ok) {
                const canOverride = req.user?.role === 'ROOT' || req.user?.role === 'ADMIN';
                if (!override) {
                    res.status(409).json({
                        error: 'FLOW_RULES_VIOLATED',
                        message: 'Não foi possível mover este pedido para esta etapa.',
                        violations: ruleCheck.violations,
                        can_override: canOverride,
                        requestId: req.requestId,
                    });
                    return;
                }
                if (!canOverride) {
                    next(AppError.forbidden('Apenas ROOT ou ADMIN podem forçar movimentação.'));
                    return;
                }
                if (!override_reason || override_reason.trim().length < 2) {
                    next(AppError.badRequest('Override exige um motivo (mínimo 2 caracteres).'));
                    return;
                }
            }

            await query(
                `UPDATE orders SET current_stage_id = $2, updated_at = NOW() WHERE id = $1`,
                [orderId, stage_id]
            );

            await createAuditLog({
                userId: req.user!.id,
                action: override ? 'OVERRIDE_STAGE_MOVE' : 'MOVE_STAGE',
                entityType: 'orders',
                entityId: orderId,
                oldValue: { current_stage_id: order.current_stage_id },
                newValue: {
                    current_stage_id: stage_id,
                    overridden_violations: override ? ruleCheck.violations : undefined,
                    override_reason: override ? override_reason : undefined,
                },
                req,
            });

            const updated = await fetchOrderRow(orderId);
            const items = await fetchOrderItems(orderId);
            res.json({
                ...mapOrder(updated as OrderDetailRow),
                custom_details: updated?.custom_detail_id
                    ? {
                        id: updated.custom_detail_id,
                        design_description: updated.design_description,
                        metal_type: updated.metal_type,
                        production_deadline: updated.production_deadline,
                        approved_at: updated.approved_at,
                        approved_by_customer: updated.approved_by_customer,
                    }
                    : null,
                order_items: items,
                rule_check: ruleCheck,
            });
        } catch (err) { next(err); }
    }
);

export default router;
