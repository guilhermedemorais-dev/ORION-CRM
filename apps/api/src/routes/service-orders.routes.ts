import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

function generateOSNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `OS-${date}-${rand}`;
}

// ── GET /api/v1/customers/:id/service-orders ─────────────────────────────────
router.get(
    '/:customerId/service-orders',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { customerId } = req.params as { customerId: string };
            const statusFilter = req.query['status'] ? String(req.query['status']) : null;
            const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10));
            const limit = 20;
            const offset = (page - 1) * limit;

            const filters = ['so.customer_id = $1'];
            const values: unknown[] = [customerId];

            if (statusFilter) {
                values.push(statusFilter);
                filters.push(`so.status = $${values.length}`);
            }

            const where = `WHERE ${filters.join(' AND ')}`;

            const countRes = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total FROM service_orders so ${where}`, values
            );
            const total = Number.parseInt(countRes.rows[0]?.total ?? '0', 10);

            values.push(limit, offset);
            const result = await query(
                `SELECT so.*,
                        d.name AS designer_name,
                        j.name AS jeweler_name,
                        EXTRACT(DAY FROM NOW() - so.created_at)::int AS days_open
                 FROM service_orders so
                 LEFT JOIN users d ON d.id = so.designer_id
                 LEFT JOIN users j ON j.id = so.jeweler_id
                 ${where}
                 ORDER BY so.created_at DESC
                 LIMIT $${values.length - 1} OFFSET $${values.length}`,
                values
            );

            res.json({ data: result.rows, meta: { total, page, limit } });
        } catch (err) { next(err); }
    }
);

// ── POST /api/v1/service-orders ───────────────────────────────────────────────
const createSOSchema = z.object({
    customer_id: z.string().uuid(),
    order_id: z.string().uuid().optional(),
    attendance_block_id: z.string().uuid().optional(),
    ai_render_id: z.string().uuid().optional(),
    product_name: z.string().trim().min(1).max(200),
    priority: z.enum(['normal', 'alta', 'urgente']).default('normal'),
    specs: z.record(z.unknown()).default({}),
    designer_id: z.string().uuid().optional(),
    jeweler_id: z.string().uuid().optional(),
    due_date: z.string().optional(),
    deposit_cents: z.number().int().min(0).default(0),
    total_cents: z.number().int().min(0).default(0),
});

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createSOSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const d = parsed.data;
            let orderNumber = generateOSNumber();
            // Ensure unique
            let exists = await query<{ id: string }>(`SELECT id FROM service_orders WHERE order_number = $1`, [orderNumber]);
            while (exists.rows[0]) {
                orderNumber = generateOSNumber();
                exists = await query<{ id: string }>(`SELECT id FROM service_orders WHERE order_number = $1`, [orderNumber]);
            }

            const result = await query<{ id: string }>(
                `INSERT INTO service_orders
                 (order_number, customer_id, order_id, attendance_block_id, ai_render_id,
                  product_name, priority, specs, designer_id, jeweler_id, due_date,
                  deposit_cents, total_cents, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                 RETURNING id`,
                [
                    orderNumber, d.customer_id, d.order_id ?? null,
                    d.attendance_block_id ?? null, d.ai_render_id ?? null,
                    d.product_name, d.priority, JSON.stringify(d.specs),
                    d.designer_id ?? null, d.jeweler_id ?? null, d.due_date ?? null,
                    d.deposit_cents, d.total_cents, req.user!.id,
                ]
            );

            const soId = result.rows[0]?.id;
            if (!soId) throw AppError.internal(req.requestId);

            await createAuditLog({ userId: req.user!.id, action: 'CREATE', entityType: 'service_orders', entityId: soId, oldValue: null, newValue: { order_number: orderNumber, product_name: d.product_name }, req });

            const so = await query(`SELECT * FROM service_orders WHERE id = $1`, [soId]);
            res.status(201).json(so.rows[0]);
        } catch (err) { next(err); }
    }
);

// ── PATCH /api/v1/service-orders/:id ─────────────────────────────────────────
router.patch(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const allowed = ['product_name', 'priority', 'specs', 'designer_id', 'jeweler_id', 'due_date', 'deposit_cents', 'total_cents', 'status'];
            const sets: string[] = [];
            const values: unknown[] = [];

            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    values.push(key === 'specs' ? JSON.stringify(req.body[key]) : req.body[key]);
                    sets.push(`${key} = $${values.length}`);
                }
            }
            if (sets.length === 0) { res.json({ message: 'Nenhuma alteração.' }); return; }
            sets.push(`updated_at = NOW()`);
            values.push(id);

            const result = await query<{ id: string }>(
                `UPDATE service_orders SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`, values
            );
            if (!result.rows[0]) { next(AppError.notFound('OS não encontrada.')); return; }

            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'service_orders', entityId: id, oldValue: null, newValue: req.body, req });
            res.json({ id });
        } catch (err) { next(err); }
    }
);

// ── PATCH /api/v1/service-orders/:id/step ────────────────────────────────────
const STEPS = ['design', '3d_modeling', 'material', 'casting', 'setting', 'polishing', 'qc', 'packaging', 'ready', 'delivered'] as const;

router.patch(
    '/:id/step',
    authenticate,
    requireRole(['ADMIN', 'GERENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const step = String(req.body['step'] ?? '');
            if (!STEPS.includes(step as (typeof STEPS)[number])) {
                next(AppError.badRequest('Etapa inválida.')); return;
            }

            const soRes = await query<{ steps_done: string[]; current_step: string }>(
                `SELECT steps_done, current_step FROM service_orders WHERE id = $1`, [id]
            );
            if (!soRes.rows[0]) { next(AppError.notFound('OS não encontrada.')); return; }

            const stepsDone = soRes.rows[0].steps_done ?? [];
            if (!stepsDone.includes(step)) stepsDone.push(step);

            await query(
                `UPDATE service_orders SET current_step = $1, steps_done = $2, updated_at = NOW() WHERE id = $3`,
                [step, stepsDone, id]
            );

            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'service_orders', entityId: id, oldValue: { step: soRes.rows[0].current_step }, newValue: { step }, req });
            res.json({ id, current_step: step, steps_done: stepsDone });
        } catch (err) { next(err); }
    }
);

export default router;
