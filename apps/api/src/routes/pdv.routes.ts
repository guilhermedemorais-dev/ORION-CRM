import { Router } from 'express';
import { z } from 'zod';
import { transaction } from '../db/pool.js';
import { createAuditLog } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireRole } from '../middleware/rbac.js';
import { finalizePdvSale, MANUAL_PAYMENT_METHODS } from '../services/order-financial.service.js';

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

export default router;
