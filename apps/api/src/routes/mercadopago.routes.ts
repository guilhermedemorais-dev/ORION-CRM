import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import { applyApprovedPaymentEffects, createPaymentRecord } from '../services/order-financial.service.js';
import {
    createPaymentPreference,
    fetchMercadoPagoPayment,
    verifyMercadoPagoSignature,
} from '../services/mercadopago.service.js';

const router = Router();

const createPaymentLinkSchema = z.object({
    order_id: z.string().uuid(),
});

const webhookBodySchema = z.object({
    data: z.object({
        id: z.union([z.string(), z.number()]),
    }).optional(),
    type: z.string().optional(),
});

interface ScopedOrderRow {
    id: string;
    order_number: string;
    status: string;
    final_amount_cents: number;
    assigned_to: string;
    customer_email: string | null;
}

interface PaymentLookupRow {
    id: string;
    order_id: string;
    amount_cents: number;
    status: string;
    mp_payment_id: string | null;
}

interface OrderAssignmentRow {
    assigned_to: string;
}

function assertCanAccessOrder(req: Request, assignedTo: string): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ADMIN' || req.user.role === 'FINANCEIRO') {
        return;
    }

    if (req.user.id !== assignedTo) {
        throw AppError.forbidden('Acesso não autorizado para este pedido.');
    }
}

async function fetchScopedOrder(orderId: string): Promise<ScopedOrderRow | null> {
    const result = await query<ScopedOrderRow>(
        `SELECT
            o.id,
            o.order_number,
            o.status,
            o.final_amount_cents,
            o.assigned_to,
            c.email AS customer_email
         FROM orders o
         INNER JOIN customers c ON c.id = o.customer_id
         WHERE o.id = $1
         LIMIT 1`,
        [orderId]
    );

    return result.rows[0] ?? null;
}

router.post(
    '/payments/link',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 40, name: 'mp-link-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createPaymentLinkSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Pedido inválido para geração do link.'));
                return;
            }

            const order = await fetchScopedOrder(parsed.data.order_id);
            if (!order) {
                next(AppError.notFound('Pedido não encontrado.'));
                return;
            }

            assertCanAccessOrder(req, order.assigned_to);

            if (!['AGUARDANDO_PAGAMENTO', 'RASCUNHO'].includes(order.status)) {
                next(AppError.conflict(
                    'INVALID_ORDER_PAYMENT_STATE',
                    'O pedido não está elegível para gerar link de pagamento.'
                ));
                return;
            }

            const preference = await createPaymentPreference({
                orderId: order.id,
                orderNumber: order.order_number,
                amountCents: order.final_amount_cents,
                payerEmail: order.customer_email,
            });

            const payment = await transaction(async (client) => {
                const created = await createPaymentRecord(client, {
                    orderId: order.id,
                    amountCents: order.final_amount_cents,
                    status: 'PENDING',
                    paymentMethod: 'LINK_PAGAMENTO',
                    idempotencyKey: `mp:link:${order.id}`,
                });

                await client.query(
                    `UPDATE payments
                     SET
                       mp_preference_id = $2,
                       updated_at = NOW()
                     WHERE id = $1`,
                    [created.id, preference.preferenceId]
                );

                const result = await client.query<PaymentLookupRow>(
                    `SELECT id, order_id, amount_cents, status, mp_payment_id
                     FROM payments
                     WHERE id = $1
                     LIMIT 1`,
                    [created.id]
                );

                return result.rows[0] as PaymentLookupRow;
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE_LINK',
                    entityType: 'payments',
                    entityId: payment.id,
                    oldValue: null,
                    newValue: {
                        order_id: order.id,
                        mp_preference_id: preference.preferenceId,
                    },
                    req,
                });
            }

            res.status(201).json({
                payment_id: payment.id,
                payment_url: preference.checkoutUrl,
                preference_id: preference.preferenceId,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/webhooks/mercadopago',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const signature = req.headers['x-signature'];
            const headerValue = Array.isArray(signature) ? signature[0] : signature;

            if (!verifyMercadoPagoSignature(req.rawBody ?? '', headerValue)) {
                next(AppError.unauthorized('Assinatura do webhook do Mercado Pago inválida.'));
                return;
            }

            const parsed = webhookBodySchema.safeParse(req.body);
            const queryPaymentId = req.query['id'];
            const paymentId = parsed.success
                ? String(parsed.data.data?.id ?? '')
                : typeof queryPaymentId === 'string'
                    ? queryPaymentId
                    : '';

            if (!paymentId) {
                next(AppError.badRequest('Webhook do Mercado Pago sem payment id.'));
                return;
            }

            const paymentPayload = await fetchMercadoPagoPayment(paymentId);

            if (!paymentPayload.orderId) {
                next(AppError.badRequest('Pagamento do Mercado Pago sem referência de pedido.'));
                return;
            }
            const orderId = paymentPayload.orderId;

            await transaction(async (client) => {
                const existingByMp = await client.query<PaymentLookupRow>(
                    `SELECT id, order_id, amount_cents, status, mp_payment_id
                     FROM payments
                     WHERE mp_payment_id = $1
                     LIMIT 1
                     FOR UPDATE`,
                    [paymentPayload.paymentId]
                );

                let payment = existingByMp.rows[0];

                if (!payment) {
                    const existingByOrder = await client.query<PaymentLookupRow>(
                        `SELECT id, order_id, amount_cents, status, mp_payment_id
                         FROM payments
                         WHERE order_id = $1
                         ORDER BY created_at DESC
                         LIMIT 1
                         FOR UPDATE`,
                        [orderId]
                    );

                    payment = existingByOrder.rows[0];
                }

                if (!payment) {
                    const created = await createPaymentRecord(client, {
                        orderId,
                        amountCents: paymentPayload.amountCents,
                        status: paymentPayload.status === 'approved' ? 'APPROVED' : 'PENDING',
                        paymentMethod: 'LINK_PAGAMENTO',
                        idempotencyKey: `mp:webhook:${paymentPayload.paymentId}`,
                    });

                    payment = {
                        id: created.id,
                        order_id: created.order_id,
                        amount_cents: created.amount_cents,
                        status: created.status,
                        mp_payment_id: null,
                    };
                }

                await client.query(
                    `UPDATE payments
                     SET
                       mp_payment_id = $2,
                       status = CASE
                         WHEN $3 = 'approved' THEN 'APPROVED'::payment_status
                         WHEN $3 = 'rejected' THEN 'REJECTED'::payment_status
                         WHEN $3 = 'cancelled' THEN 'CANCELLED'::payment_status
                         ELSE status
                       END,
                       payment_method = COALESCE($4, payment_method),
                       paid_at = CASE WHEN $3 = 'approved' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
                       webhook_payload = $5,
                       updated_at = NOW()
                     WHERE id = $1`,
                    [
                        payment.id,
                        paymentPayload.paymentId,
                        paymentPayload.status,
                        paymentPayload.paymentMethod,
                        JSON.stringify(req.body),
                    ]
                );

                if (paymentPayload.status === 'approved' && payment.status !== 'APPROVED') {
                    const orderOwnerResult = await client.query<OrderAssignmentRow>(
                        `SELECT assigned_to
                         FROM orders
                         WHERE id = $1
                         LIMIT 1`,
                        [orderId]
                    );

                    const actorUserId = orderOwnerResult.rows[0]?.assigned_to;
                    if (!actorUserId) {
                        throw AppError.notFound('Pedido do pagamento não encontrado.');
                    }

                    await applyApprovedPaymentEffects(client, {
                        paymentId: payment.id,
                        orderId,
                        amountCents: paymentPayload.amountCents,
                        paymentMethod: 'LINK_PAGAMENTO',
                        actorUserId,
                    });
                }
            });

            res.json({ status: 'processed' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
