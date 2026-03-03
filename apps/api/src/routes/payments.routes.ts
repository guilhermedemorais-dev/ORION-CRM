import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import {
    applyApprovedPaymentEffects,
    createPaymentRecord,
    MANUAL_PAYMENT_METHODS,
    type ManualPaymentMethod,
} from '../services/order-financial.service.js';

const router = Router();

const paymentMethodSchema = z.enum(MANUAL_PAYMENT_METHODS);
const paymentStatusSchema = z.enum(['PENDING', 'APPROVED', 'CANCELLED']);

const listPaymentsSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED']).optional(),
    order_id: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const paymentParamsSchema = z.object({
    id: z.string().uuid(),
});

const createPaymentSchema = z.object({
    order_id: z.string().uuid(),
    amount_cents: z.coerce.number().int().positive(),
    payment_method: paymentMethodSchema,
    status: paymentStatusSchema.default('PENDING'),
    idempotency_key: z.string().trim().min(4).max(255).optional(),
});

const updatePaymentSchema = z.object({
    status: paymentStatusSchema,
    payment_method: paymentMethodSchema.optional(),
});

interface PaymentRow {
    id: string;
    order_id: string;
    mp_payment_id: string | null;
    mp_preference_id: string | null;
    amount_cents: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED';
    payment_method: string | null;
    paid_at: Date | null;
    idempotency_key: string;
    created_at: Date;
    updated_at: Date;
    order_number: string;
    order_status: string;
    assigned_user_id: string;
    assigned_user_name: string;
}

function assertCanAccessPayment(req: Request, assignedUserId: string): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ADMIN' || req.user.role === 'FINANCEIRO') {
        return;
    }

    if (assignedUserId !== req.user.id) {
        throw AppError.forbidden('Acesso não autorizado para este pagamento.');
    }
}

function mapPayment(row: PaymentRow) {
    return {
        id: row.id,
        order_id: row.order_id,
        mp_payment_id: row.mp_payment_id,
        mp_preference_id: row.mp_preference_id,
        amount_cents: row.amount_cents,
        status: row.status,
        payment_method: row.payment_method,
        paid_at: row.paid_at,
        idempotency_key: row.idempotency_key,
        created_at: row.created_at,
        updated_at: row.updated_at,
        order: {
            id: row.order_id,
            order_number: row.order_number,
            status: row.order_status,
            assigned_to: {
                id: row.assigned_user_id,
                name: row.assigned_user_name,
            },
        },
    };
}

async function fetchPaymentRow(paymentId: string): Promise<PaymentRow | null> {
    const result = await query<PaymentRow>(
        `SELECT
            p.id,
            p.order_id,
            p.mp_payment_id,
            p.mp_preference_id,
            p.amount_cents,
            p.status,
            p.payment_method,
            p.paid_at,
            p.idempotency_key,
            p.created_at,
            p.updated_at,
            o.order_number,
            o.status AS order_status,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
         FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         INNER JOIN users u ON u.id = o.assigned_to
         WHERE p.id = $1
         LIMIT 1`,
        [paymentId]
    );

    return result.rows[0] ?? null;
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'payments-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listPaymentsSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const filters: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.status) {
                values.push(parsed.data.status);
                filters.push(`p.status = $${values.length}`);
            }

            if (parsed.data.order_id) {
                values.push(parsed.data.order_id);
                filters.push(`p.order_id = $${values.length}`);
            }

            if (req.user?.role === 'ATENDENTE') {
                values.push(req.user.id);
                filters.push(`o.assigned_to = $${values.length}`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM payments p
                 INNER JOIN orders o ON o.id = p.order_id
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<PaymentRow>(
                `SELECT
                    p.id,
                    p.order_id,
                    p.mp_payment_id,
                    p.mp_preference_id,
                    p.amount_cents,
                    p.status,
                    p.payment_method,
                    p.paid_at,
                    p.idempotency_key,
                    p.created_at,
                    p.updated_at,
                    o.order_number,
                    o.status AS order_status,
                    u.id AS assigned_user_id,
                    u.name AS assigned_user_name
                 FROM payments p
                 INNER JOIN orders o ON o.id = p.order_id
                 INNER JOIN users u ON u.id = o.assigned_to
                 ${whereClause}
                 ORDER BY p.created_at DESC
                 LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapPayment),
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
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = paymentParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Pagamento inválido.'));
                return;
            }

            const payment = await fetchPaymentRow(parsed.data.id);
            if (!payment) {
                next(AppError.notFound('Pagamento não encontrado.'));
                return;
            }

            assertCanAccessPayment(req, payment.assigned_user_id);
            res.json(mapPayment(payment));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'payments-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createPaymentSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do pagamento.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const scopedOrder = await query<{ assigned_to: string }>(
                'SELECT assigned_to FROM orders WHERE id = $1 LIMIT 1',
                [parsed.data.order_id]
            );

            const assignedUserId = scopedOrder.rows[0]?.assigned_to;
            if (!assignedUserId) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessPayment(req, assignedUserId);

            const payment = await transaction(async (client) => {
                const created = await createPaymentRecord(client, {
                    orderId: parsed.data.order_id,
                    amountCents: parsed.data.amount_cents,
                    status: parsed.data.status,
                    paymentMethod: parsed.data.payment_method,
                    idempotencyKey: parsed.data.idempotency_key,
                });

                if (parsed.data.status === 'APPROVED') {
                    await applyApprovedPaymentEffects(client, {
                        paymentId: created.id,
                        orderId: created.order_id,
                        amountCents: created.amount_cents,
                        paymentMethod: parsed.data.payment_method,
                        actorUserId: req.user?.id ?? assignedUserId,
                    });
                }

                return created;
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'payments',
                    entityId: payment.id,
                    oldValue: null,
                    newValue: {
                        order_id: payment.order_id,
                        status: payment.status,
                        payment_method: payment.payment_method,
                    },
                    req,
                });
            }

            const createdPayment = await fetchPaymentRow(payment.id);
            res.status(201).json(mapPayment(createdPayment as PaymentRow));
        } catch (error) {
            const databaseError = error as { code?: string };

            if (databaseError.code === '23505') {
                next(AppError.conflict('DUPLICATE_PAYMENT', 'Já existe um pagamento com a mesma chave de idempotência.'));
                return;
            }

            next(error);
        }
    }
);

router.patch(
    '/:id/status',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'payments-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = paymentParamsSchema.safeParse(req.params);
            const body = updatePaymentSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest(
                    'Não foi possível atualizar o pagamento.',
                    body.success ? [] : body.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const before = await fetchPaymentRow(params.data.id);
            if (!before) {
                next(AppError.notFound('Pagamento não encontrado.'));
                return;
            }

            assertCanAccessPayment(req, before.assigned_user_id);

            const after = await transaction(async (client) => {
                if (body.data.status === 'APPROVED') {
                    if (!before.payment_method && !body.data.payment_method) {
                        throw AppError.badRequest('Informe a forma de pagamento para aprovar a cobrança.');
                    }

                    await applyApprovedPaymentEffects(client, {
                        paymentId: before.id,
                        orderId: before.order_id,
                        amountCents: before.amount_cents,
                        paymentMethod: (body.data.payment_method ?? before.payment_method) as ManualPaymentMethod,
                        actorUserId: req.user?.id ?? before.assigned_user_id,
                    });
                } else {
                    await client.query(
                        `UPDATE payments
                         SET
                           status = $2,
                           payment_method = COALESCE($3, payment_method),
                           updated_at = NOW()
                         WHERE id = $1`,
                        [before.id, body.data.status, body.data.payment_method ?? null]
                    );
                }

                return fetchPaymentRow(before.id);
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_STATUS',
                    entityType: 'payments',
                    entityId: before.id,
                    oldValue: {
                        status: before.status,
                    },
                    newValue: {
                        status: body.data.status,
                    },
                    req,
                });
            }

            res.json(mapPayment(after as PaymentRow));
        } catch (error) {
            next(error);
        }
    }
);

export default router;
