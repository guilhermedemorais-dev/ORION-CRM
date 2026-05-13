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

// ── Materiais consumidos por OS ───────────────────────────────────────────────
//
// Cada matéria-prima ou peça pronta usada na produção é gravada em
// service_order_materials com snapshot de custo/preço (preserva histórico mesmo
// que o produto seja repreçado depois).
//
// O subtotal de materiais e o total da OS são recalculados a cada mudança:
//   materials_subtotal_cents = Σ (unit_price_snapshot_cents × quantity)
//   total_cents              = materials_subtotal_cents + labor_cents
//                              + (materials_subtotal_cents + labor_cents) × markup_percent / 100
//
// A baixa real de estoque NÃO acontece aqui — só quando o pedido é faturado no
// PDV (próxima fase). Aqui é só catálogo de "o que vai/foi usado".

const addMaterialSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    notes: z.string().trim().max(500).optional(),
});

const updateMaterialSchema = z.object({
    quantity: z.coerce.number().positive().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');

async function recalcOSTotals(serviceOrderId: string): Promise<void> {
    const subtotalResult = await query<{ subtotal: string | null }>(
        `SELECT COALESCE(SUM(quantity * unit_price_snapshot_cents), 0)::text AS subtotal
         FROM service_order_materials
         WHERE service_order_id = $1`,
        [serviceOrderId]
    );
    const subtotal = Math.round(Number(subtotalResult.rows[0]?.subtotal ?? '0'));

    const soResult = await query<{ labor_cents: number; markup_percent: string }>(
        `SELECT labor_cents, markup_percent::text FROM service_orders WHERE id = $1`,
        [serviceOrderId]
    );
    const so = soResult.rows[0];
    if (!so) return;

    const labor = Number(so.labor_cents ?? 0);
    const markup = Number(so.markup_percent ?? 0);
    const subtotalWithLabor = subtotal + labor;
    const total = Math.round(subtotalWithLabor + (subtotalWithLabor * markup) / 100);

    await query(
        `UPDATE service_orders
         SET materials_subtotal_cents = $1,
             total_cents = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [subtotal, total, serviceOrderId]
    );
}

// GET /api/v1/service-orders/:id/materials — lista materiais da OS
router.get(
    '/:id/materials',
    authenticate,
    requireRole(['ADMIN', 'GERENTE', 'ATENDENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query(
                `SELECT som.id,
                        som.product_id,
                        som.quantity::text AS quantity,
                        som.unit_cost_snapshot_cents,
                        som.unit_price_snapshot_cents,
                        som.notes,
                        som.created_at,
                        p.code AS product_code,
                        p.name AS product_name,
                        p.is_raw_material AS product_is_raw_material,
                        p.stock_quantity AS product_stock_quantity,
                        p.metal AS product_metal
                 FROM service_order_materials som
                 INNER JOIN products p ON p.id = som.product_id
                 WHERE som.service_order_id = $1
                 ORDER BY som.created_at ASC`,
                [id]
            );
            res.json({ data: result.rows });
        } catch (err) { next(err); }
    }
);

// POST /api/v1/service-orders/:id/materials — adiciona material à OS
router.post(
    '/:id/materials',
    authenticate,
    requireRole(['ADMIN', 'GERENTE', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = addMaterialSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Verifique os dados do material.', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            // Garante que a OS existe.
            const soResult = await query<{ id: string }>(
                `SELECT id FROM service_orders WHERE id = $1 LIMIT 1`,
                [id]
            );
            if (!soResult.rows[0]) { next(AppError.notFound('OS não encontrada.')); return; }

            // Snapshot do preço/custo do produto AGORA.
            const productResult = await query<{ id: string; cost_price_cents: number | null; price_cents: number }>(
                `SELECT id, cost_price_cents, price_cents FROM products WHERE id = $1 LIMIT 1`,
                [parsed.data.product_id]
            );
            const product = productResult.rows[0];
            if (!product) { next(AppError.badRequest('Produto não encontrado.')); return; }

            const inserted = await query<{ id: string }>(
                `INSERT INTO service_order_materials
                    (service_order_id, product_id, quantity, unit_cost_snapshot_cents, unit_price_snapshot_cents, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [
                    id,
                    parsed.data.product_id,
                    parsed.data.quantity,
                    product.cost_price_cents ?? 0,
                    product.price_cents,
                    parsed.data.notes ?? null,
                ]
            );

            await recalcOSTotals(id);

            await createAuditLog({
                userId: req.user!.id,
                action: 'CREATE',
                entityType: 'service_order_materials',
                entityId: inserted.rows[0]!.id,
                oldValue: null,
                newValue: { service_order_id: id, product_id: parsed.data.product_id, quantity: parsed.data.quantity },
                req,
            });

            res.status(201).json({ data: { id: inserted.rows[0]!.id } });
        } catch (err) { next(err); }
    }
);

// PATCH /api/v1/service-orders/:id/materials/:materialId — atualiza quantidade/notas
router.patch(
    '/:id/materials/:materialId',
    authenticate,
    requireRole(['ADMIN', 'GERENTE', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, materialId } = req.params as { id: string; materialId: string };
            const parsed = updateMaterialSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Verifique os campos.', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const updates: string[] = [];
            const values: unknown[] = [materialId, id];
            if (parsed.data.quantity !== undefined) {
                values.push(parsed.data.quantity);
                updates.push(`quantity = $${values.length}`);
            }
            if (parsed.data.notes !== undefined) {
                values.push(parsed.data.notes);
                updates.push(`notes = $${values.length}`);
            }
            updates.push('updated_at = NOW()');

            const result = await query<{ id: string }>(
                `UPDATE service_order_materials
                 SET ${updates.join(', ')}
                 WHERE id = $1 AND service_order_id = $2
                 RETURNING id`,
                values
            );
            if (!result.rows[0]) { next(AppError.notFound('Material não encontrado nesta OS.')); return; }

            await recalcOSTotals(id);

            await createAuditLog({
                userId: req.user!.id,
                action: 'UPDATE',
                entityType: 'service_order_materials',
                entityId: materialId,
                oldValue: null,
                newValue: { ...parsed.data },
                req,
            });

            res.json({ data: { id: materialId } });
        } catch (err) { next(err); }
    }
);

// DELETE /api/v1/service-orders/:id/materials/:materialId — remove material
router.delete(
    '/:id/materials/:materialId',
    authenticate,
    requireRole(['ADMIN', 'GERENTE', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, materialId } = req.params as { id: string; materialId: string };
            const result = await query<{ id: string }>(
                `DELETE FROM service_order_materials
                 WHERE id = $1 AND service_order_id = $2
                 RETURNING id`,
                [materialId, id]
            );
            if (!result.rows[0]) { next(AppError.notFound('Material não encontrado nesta OS.')); return; }

            await recalcOSTotals(id);

            await createAuditLog({
                userId: req.user!.id,
                action: 'DELETE',
                entityType: 'service_order_materials',
                entityId: materialId,
                oldValue: { id: materialId },
                newValue: null,
                req,
            });

            res.status(204).send();
        } catch (err) { next(err); }
    }
);

// PATCH /api/v1/service-orders/:id/labor — atualiza mão de obra ou markup
const updateLaborSchema = z.object({
    labor_cents: z.coerce.number().int().min(0).optional(),
    markup_percent: z.coerce.number().min(0).max(999).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

router.patch(
    '/:id/labor',
    authenticate,
    requireRole(['ADMIN', 'GERENTE', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = updateLaborSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Verifique os campos.', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const updates: string[] = [];
            const values: unknown[] = [id];
            if (parsed.data.labor_cents !== undefined) {
                values.push(parsed.data.labor_cents);
                updates.push(`labor_cents = $${values.length}`);
            }
            if (parsed.data.markup_percent !== undefined) {
                values.push(parsed.data.markup_percent);
                updates.push(`markup_percent = $${values.length}`);
            }
            updates.push('updated_at = NOW()');

            const result = await query<{ id: string }>(
                `UPDATE service_orders SET ${updates.join(', ')} WHERE id = $1 RETURNING id`,
                values
            );
            if (!result.rows[0]) { next(AppError.notFound('OS não encontrada.')); return; }

            await recalcOSTotals(id);

            await createAuditLog({
                userId: req.user!.id,
                action: 'UPDATE',
                entityType: 'service_orders',
                entityId: id,
                oldValue: null,
                newValue: { ...parsed.data },
                req,
            });

            res.json({ data: { id } });
        } catch (err) { next(err); }
    }
);

export default router;
