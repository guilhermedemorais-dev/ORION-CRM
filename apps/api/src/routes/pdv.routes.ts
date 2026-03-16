import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { createAuditLog } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireRole } from '../middleware/rbac.js';
import { finalizePdvSale, MANUAL_PAYMENT_METHODS } from '../services/order-financial.service.js';
import { createPaymentPreference } from '../services/mercadopago.service.js';

const router = Router();

const pdvSaleSchema = z.object({
    customer_id: z.string().uuid().nullable().optional().default(null),
    items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
    })).min(1, 'Adicione ao menos um item na venda.'),
    payment_method: z.enum(MANUAL_PAYMENT_METHODS),
    discount_cents: z.coerce.number().int().min(0).default(0),
    notes: z.string().trim().max(500).nullable().optional().default(null),
});

router.post(
    '/sales',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req, res, next) => {
        try {
            if (!req.user) {
                throw AppError.unauthorized();
            }
            const currentUser = req.user;

            const data = pdvSaleSchema.parse(req.body);

            const sale = await transaction(async (client) => finalizePdvSale(client, {
                customerId: data.customer_id,
                items: data.items.map((item) => ({
                    productId: item.product_id,
                    quantity: item.quantity,
                })),
                paymentMethod: data.payment_method,
                discountCents: data.discount_cents,
                notes: data.notes,
                actorUserId: currentUser.id,
            }));

            await createAuditLog({
                userId: currentUser.id,
                action: 'CREATE',
                entityType: 'pdv_sales',
                entityId: sale.orderId,
                oldValue: null,
                newValue: {
                    order_id: sale.orderId,
                    payment_id: sale.paymentId,
                    total_cents: sale.totalCents,
                    payment_method: data.payment_method,
                },
                req,
            });

            res.status(201).json({
                order_id: sale.orderId,
                payment_id: sale.paymentId,
                receipt: {
                    order_number: sale.orderNumber,
                    total_cents: sale.totalCents,
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                next(AppError.badRequest('Dados inválidos para a venda no PDV.'));
                return;
            }

            if (error instanceof AppError) {
                next(error);
                return;
            }

            logger.error({ err: error, requestId: req.requestId }, 'Failed to register PDV sale');
            next(AppError.serviceUnavailable('PDV_SALE_FAILED', 'Não foi possível finalizar a venda do PDV.'));
        }
    }
);

const pdvMpLinkSchema = z.object({
    customer_id: z.string().uuid().nullable().optional().default(null),
    items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
    })).min(1, 'Adicione ao menos um item na venda.'),
    discount_cents: z.coerce.number().int().min(0).default(0),
    notes: z.string().trim().max(500).nullable().optional().default(null),
});

router.post(
    '/mp-link',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req, res, next) => {
        try {
            if (!req.user) {
                throw AppError.unauthorized();
            }
            const currentUser = req.user;

            const data = pdvMpLinkSchema.parse(req.body);

            const sale = await transaction(async (client) => finalizePdvSale(client, {
                customerId: data.customer_id,
                items: data.items.map((item) => ({
                    productId: item.product_id,
                    quantity: item.quantity,
                })),
                paymentMethod: 'LINK_PAGAMENTO',
                discountCents: data.discount_cents,
                notes: data.notes,
                actorUserId: currentUser.id,
            }));

            const { preferenceId, checkoutUrl } = await createPaymentPreference({
                orderId: sale.orderId,
                orderNumber: sale.orderNumber,
                amountCents: sale.totalCents,
            });

            await createAuditLog({
                userId: currentUser.id,
                action: 'CREATE',
                entityType: 'pdv_sales',
                entityId: sale.orderId,
                oldValue: null,
                newValue: {
                    order_id: sale.orderId,
                    payment_id: sale.paymentId,
                    total_cents: sale.totalCents,
                    payment_method: 'LINK_PAGAMENTO',
                    preference_id: preferenceId,
                },
                req,
            });

            res.status(201).json({
                order_id: sale.orderId,
                order_number: sale.orderNumber,
                payment_url: checkoutUrl,
                preference_id: preferenceId,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                next(AppError.badRequest('Dados inválidos para o link de pagamento.'));
                return;
            }

            if (error instanceof AppError) {
                next(error);
                return;
            }

            logger.error({ err: error, requestId: req.requestId }, 'Failed to generate PDV MP link');
            next(AppError.serviceUnavailable('PDV_MP_LINK_FAILED', 'Não foi possível gerar o link de pagamento.'));
        }
    }
);

// ── GET /pdv/custom-orders?q= ──────────────────────────────────────────────
router.get(
    '/custom-orders',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req, res, next) => {
        try {
            const q = String(req.query['q'] ?? '').trim();
            const values: unknown[] = [];
            const filters: string[] = [
                `o.type = 'PERSONALIZADO'`,
                `o.status NOT IN ('RETIRADO', 'CANCELADO', 'RASCUNHO')`,
            ];

            if (q) {
                values.push(`%${q}%`);
                const idx = values.length;
                filters.push(`(o.order_number ILIKE $${idx} OR c.name ILIKE $${idx} OR COALESCE(cod.design_description,'') ILIKE $${idx})`);
            }

            const whereClause = `WHERE ${filters.join(' AND ')}`;

            const result = await query<{
                id: string;
                order_number: string;
                customer_name: string;
                design_description: string | null;
                total_amount_cents: number;
                signal_amount_cents: number;
                remaining_amount_cents: number;
            }>(
                `SELECT
                    o.id,
                    o.order_number,
                    c.name AS customer_name,
                    cod.design_description,
                    o.final_amount_cents AS total_amount_cents,
                    COALESCE(o.signal_amount_cents, 0) AS signal_amount_cents,
                    COALESCE(o.remaining_amount_cents, o.final_amount_cents) AS remaining_amount_cents
                 FROM orders o
                 INNER JOIN customers c ON c.id = o.customer_id
                 LEFT JOIN custom_order_details cod ON cod.order_id = o.id
                 ${whereClause}
                 ORDER BY o.created_at DESC
                 LIMIT 8`,
                values
            );

            res.json({ data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

// ── POST /pdv/quick-customer (dedup-aware create) ─────────────────────────
const quickCustomerSchema = z.object({
    name: z.string().trim().min(2).max(255),
    phone: z.string().trim().min(8).max(20),
    email: z.string().email().optional().nullable(),
    cpf: z.string().trim().min(11).max(14).optional().nullable(),
});

router.post(
    '/quick-customer',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req, res, next) => {
        try {
            const parsed = quickCustomerSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Verifique os campos informados.'));
                return;
            }
            const { name, phone, email, cpf } = parsed.data;

            // Deduplicação: busca por phone ou cpf
            const existing = await query<{ id: string; name: string; whatsapp_number: string; cpf: string | null }>(
                `SELECT id, name, whatsapp_number, cpf FROM customers
                 WHERE whatsapp_number = $1 ${cpf ? 'OR cpf = $2' : ''}
                 LIMIT 1`,
                cpf ? [phone, cpf] : [phone]
            );

            if (existing.rows[0]) {
                const c = existing.rows[0];
                res.json({ id: c.id, name: c.name, phone: c.whatsapp_number, cpf: c.cpf, existing: true });
                return;
            }

            const result = await query<{ id: string; name: string; whatsapp_number: string; cpf: string | null }>(
                `INSERT INTO customers (name, whatsapp_number, email, cpf, assigned_to)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, name, whatsapp_number, cpf`,
                [name, phone, email ?? null, cpf ?? null, req.user?.id ?? null]
            );

            const customer = result.rows[0];
            if (!customer) throw AppError.internal(req.requestId);

            res.status(201).json({ id: customer.id, name: customer.name, phone: customer.whatsapp_number, cpf: customer.cpf, existing: false });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
