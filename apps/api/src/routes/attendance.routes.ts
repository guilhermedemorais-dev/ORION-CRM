import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────

async function generateSONumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `SO-${today}-`;
    const last = await query<{ so_number: string }>(
        `SELECT so_number FROM attendance_blocks WHERE so_number LIKE $1 ORDER BY so_number DESC LIMIT 1`,
        [`${prefix}%`]
    );
    const seq = last.rows[0]
        ? parseInt(last.rows[0].so_number.split('-')[3] ?? '0', 10) + 1
        : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
}

const PIPELINE_STATUSES = ['ATENDIMENTO', 'PROPOSTA', 'PEDIDO', 'OS', 'ENTREGA'] as const;
type PipelineStatus = typeof PIPELINE_STATUSES[number];

// ── GET /api/v1/customers/:id/blocks ─────────────────────────────────────────
router.get(
    '/:customerId/blocks',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { customerId } = req.params as { customerId: string };
            const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10));
            const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query['limit'] ?? '20'), 10)));
            const offset = (page - 1) * limit;

            // Optional filter: ?pipeline_status=ATENDIMENTO,PROPOSTA
            const pipelineStatusParam = req.query['pipeline_status'];
            let pipelineFilter = '';
            const filterValues: unknown[] = [customerId];
            if (pipelineStatusParam && typeof pipelineStatusParam === 'string') {
                const statuses = pipelineStatusParam.split(',').map((s) => s.trim().toUpperCase());
                const placeholders = statuses.map((_, i) => `$${i + 2}`).join(', ');
                pipelineFilter = ` AND ab.pipeline_status IN (${placeholders})`;
                filterValues.push(...statuses);
            }

            const countParams = filterValues;
            const countRes = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total FROM attendance_blocks ab
                 WHERE ab.customer_id = $1 AND ab.status != 'deleted'${pipelineFilter}`,
                countParams
            );
            const total = Number.parseInt(countRes.rows[0]?.total ?? '0', 10);

            const dataParams = [...filterValues, limit, offset];
            const result = await query(
                `SELECT
                   ab.*,
                   u_created.name  AS created_by_name,
                   u_designer.name AS designer_name,
                   u_jeweler.name  AS jeweler_name
                 FROM attendance_blocks ab
                 LEFT JOIN users u_created  ON u_created.id  = ab.created_by
                 LEFT JOIN users u_designer ON u_designer.id = ab.designer_id
                 LEFT JOIN users u_jeweler  ON u_jeweler.id  = ab.jeweler_id
                 WHERE ab.customer_id = $1 AND ab.status != 'deleted'${pipelineFilter}
                 ORDER BY ab.created_at DESC
                 LIMIT $${filterValues.length + 1} OFFSET $${filterValues.length + 2}`,
                dataParams
            );

            res.json({ data: result.rows, meta: { total, page, limit } });
        } catch (err) { next(err); }
    }
);

// ── POST /api/v1/customers/:id/blocks ────────────────────────────────────────
const createBlockSchema = z.object({
    title: z.string().trim().min(1).max(200),
    block_type: z.enum(['atendimento', 'consulta_peca', 'ligacao', 'visita', 'email']).default('atendimento'),
    content: z.string().optional(),
    status: z.enum(['open', 'done', 'ai']).default('open'),
    priority: z.enum(['normal', 'urgente']).default('normal'),
    channel: z.enum(['whatsapp', 'presencial', 'email']).optional(),
    lead_id: z.string().uuid().optional(),
    // pipeline fields
    pipeline_status: z.enum(PIPELINE_STATUSES).default('ATENDIMENTO'),
    product_name: z.string().max(200).optional(),
    due_date: z.string().optional(),
    metal: z.string().max(50).optional(),
    stone: z.string().max(100).optional(),
    ring_size: z.string().max(10).optional(),
    weight_grams: z.number().optional(),
    finish: z.string().max(50).optional(),
    engraving: z.string().max(100).optional(),
    prong_count: z.number().int().optional(),
    band_thickness: z.number().optional(),
    tech_notes: z.string().optional(),
    designer_id: z.string().uuid().optional(),
    jeweler_id: z.string().uuid().optional(),
    deposit_cents: z.number().int().min(0).default(0),
    total_cents: z.number().int().min(0).default(0),
});

router.post(
    '/:customerId/blocks',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { customerId } = req.params as { customerId: string };
            const parsed = createBlockSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const {
                title, block_type, content, status, priority, channel, lead_id,
                pipeline_status, product_name, due_date, metal, stone, ring_size,
                weight_grams, finish, engraving, prong_count, band_thickness, tech_notes,
                designer_id, jeweler_id, deposit_cents, total_cents,
            } = parsed.data;

            const userId = req.user!.id;

            // Validate for OS transition
            let soNumber: string | null = null;
            let soApprovedAt: string | null = null;
            if (pipeline_status === 'OS') {
                if (!product_name?.trim()) {
                    next(AppError.badRequest('Preencha o nome do produto antes de avançar para OS.'));
                    return;
                }
                soNumber = await generateSONumber();
                soApprovedAt = new Date().toISOString();
            }

            const result = await query<{ id: string; pipeline_status: string; so_number: string | null }>(
                `INSERT INTO attendance_blocks (
                   customer_id, lead_id, title, block_type, content, status, priority, channel, created_by,
                   pipeline_status, product_name, due_date, metal, stone, ring_size,
                   weight_grams, finish, engraving, prong_count, band_thickness, tech_notes,
                   designer_id, jeweler_id, deposit_cents, total_cents, so_number, so_approved_at
                 ) VALUES (
                   $1, $2, $3, $4, $5, $6, $7, $8, $9,
                   $10, $11, $12, $13, $14, $15,
                   $16, $17, $18, $19, $20, $21,
                   $22, $23, $24, $25, $26, $27
                 )
                 RETURNING *`,
                [
                    customerId, lead_id ?? null, title, block_type, content ?? null, status, priority, channel ?? null, userId,
                    pipeline_status, product_name ?? null, due_date ?? null, metal ?? null, stone ?? null, ring_size ?? null,
                    weight_grams ?? null, finish ?? null, engraving ?? null, prong_count ?? null, band_thickness ?? null, tech_notes ?? null,
                    designer_id ?? null, jeweler_id ?? null, deposit_cents, total_cents, soNumber, soApprovedAt,
                ]
            );

            const block = result.rows[0];
            if (!block) throw AppError.internal(req.requestId);

            // If moving to OS, create delivery stub when status = ENTREGA
            if (pipeline_status === 'ENTREGA') {
                await query(
                    `INSERT INTO deliveries (customer_id, so_id, type, status, created_by)
                     SELECT $1, so.id, 'store_pickup', 'pending', $2
                     FROM service_orders so
                     WHERE so.attendance_block_id = $3
                     LIMIT 1`,
                    [customerId, userId, block.id]
                ).catch(() => {/* ignore if no linked SO */});
            }

            await createAuditLog({ userId, action: 'CREATE', entityType: 'attendance_blocks', entityId: block.id, oldValue: null, newValue: { title, block_type, pipeline_status }, req });

            res.status(201).json(block);
        } catch (err) { next(err); }
    }
);

// ── PATCH /api/v1/blocks/:id ──────────────────────────────────────────────────
const updateBlockSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    block_type: z.string().optional(),
    content: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    channel: z.string().optional(),
    // pipeline fields
    pipeline_status: z.enum(PIPELINE_STATUSES).optional(),
    product_name: z.string().max(200).optional(),
    due_date: z.string().optional(),
    metal: z.string().max(50).optional(),
    stone: z.string().max(100).optional(),
    ring_size: z.string().max(10).optional(),
    weight_grams: z.number().optional(),
    finish: z.string().max(50).optional(),
    engraving: z.string().max(100).optional(),
    prong_count: z.number().int().optional(),
    band_thickness: z.number().optional(),
    tech_notes: z.string().optional(),
    designer_id: z.string().uuid().optional(),
    jeweler_id: z.string().uuid().optional(),
    deposit_cents: z.number().int().min(0).optional(),
    total_cents: z.number().int().min(0).optional(),
});

async function patchBlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params as { id: string };
        const parsed = updateBlockSchema.safeParse(req.body);
        if (!parsed.success) { next(AppError.badRequest('Dados inválidos.')); return; }

        const {
            title, block_type, content, status, priority, channel,
            pipeline_status, product_name, due_date, metal, stone, ring_size,
            weight_grams, finish, engraving, prong_count, band_thickness, tech_notes,
            designer_id, jeweler_id, deposit_cents, total_cents,
        } = parsed.data;

        // Fetch existing to check pipeline transition
        const existing = await query<{ pipeline_status: string; so_number: string | null; product_name: string | null; customer_id: string }>(
            `SELECT pipeline_status, so_number, product_name, customer_id FROM attendance_blocks WHERE id = $1`,
            [id]
        );
        if (!existing.rows[0]) { next(AppError.notFound('Bloco não encontrado.')); return; }

        const prev = existing.rows[0];
        const nextStatus = pipeline_status ?? prev.pipeline_status as PipelineStatus;

        // Validate OS transition
        let soNumber = prev.so_number;
        let soApprovedAt: string | null = null;
        const effectiveProductName = product_name ?? prev.product_name ?? '';

        if (nextStatus === 'OS' && !prev.so_number) {
            if (!effectiveProductName.trim()) {
                next(AppError.badRequest('Preencha o nome do produto antes de avançar para OS.'));
                return;
            }
            soNumber = await generateSONumber();
            soApprovedAt = new Date().toISOString();
        }

        const sets: string[] = [];
        const values: unknown[] = [];

        function addSet(col: string, val: unknown) {
            values.push(val);
            sets.push(`${col} = $${values.length}`);
        }

        if (title !== undefined) addSet('title', title);
        if (block_type !== undefined) addSet('block_type', block_type);
        if (content !== undefined) addSet('content', content);
        if (status !== undefined) addSet('status', status);
        if (priority !== undefined) addSet('priority', priority);
        if (channel !== undefined) addSet('channel', channel);
        if (pipeline_status !== undefined) addSet('pipeline_status', pipeline_status);
        if (product_name !== undefined) addSet('product_name', product_name);
        if (due_date !== undefined) addSet('due_date', due_date);
        if (metal !== undefined) addSet('metal', metal);
        if (stone !== undefined) addSet('stone', stone);
        if (ring_size !== undefined) addSet('ring_size', ring_size);
        if (weight_grams !== undefined) addSet('weight_grams', weight_grams);
        if (finish !== undefined) addSet('finish', finish);
        if (engraving !== undefined) addSet('engraving', engraving);
        if (prong_count !== undefined) addSet('prong_count', prong_count);
        if (band_thickness !== undefined) addSet('band_thickness', band_thickness);
        if (tech_notes !== undefined) addSet('tech_notes', tech_notes);
        if (designer_id !== undefined) addSet('designer_id', designer_id);
        if (jeweler_id !== undefined) addSet('jeweler_id', jeweler_id);
        if (deposit_cents !== undefined) addSet('deposit_cents', deposit_cents);
        if (total_cents !== undefined) addSet('total_cents', total_cents);

        // Auto-set so_number and so_approved_at when advancing to OS
        if (soNumber && soNumber !== prev.so_number) {
            addSet('so_number', soNumber);
            addSet('so_approved_at', soApprovedAt);
        }

        if (sets.length === 0) { res.json({ message: 'Nenhuma alteração.' }); return; }

        sets.push(`updated_at = NOW()`);
        values.push(id);

        const result = await query<{ id: string }>(
            `UPDATE attendance_blocks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (!result.rows[0]) { next(AppError.notFound('Bloco não encontrado.')); return; }

        // OS → ENTREGA: create delivery record
        if (nextStatus === 'ENTREGA' && prev.pipeline_status !== 'ENTREGA') {
            await query(
                `INSERT INTO deliveries (customer_id, type, status, created_by)
                 VALUES ($1, 'store_pickup', 'pending', $2)
                 ON CONFLICT DO NOTHING`,
                [prev.customer_id, req.user!.id]
            ).catch(() => {/* non-fatal */});
        }

        await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'attendance_blocks', entityId: id, oldValue: null, newValue: parsed.data, req });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

router.patch('/:id', authenticate, requireRole(['ADMIN', 'ATENDENTE', 'GERENTE', 'PRODUCAO']), patchBlock);
router.patch('/blocks/:id', authenticate, requireRole(['ADMIN', 'ATENDENTE', 'GERENTE', 'PRODUCAO']), patchBlock);

// ── DELETE /api/v1/blocks/:id (soft delete) ───────────────────────────────────
async function deleteBlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params as { id: string };
        await query(`UPDATE attendance_blocks SET status = 'deleted', updated_at = NOW() WHERE id = $1`, [id]);
        await createAuditLog({ userId: req.user!.id, action: 'DELETE', entityType: 'attendance_blocks', entityId: id, oldValue: null, newValue: null, req });
        res.json({ message: 'Bloco removido.' });
    } catch (err) { next(err); }
}

router.delete('/:id', authenticate, requireRole(['ADMIN', 'GERENTE']), deleteBlock);
router.delete('/blocks/:id', authenticate, requireRole(['ADMIN', 'GERENTE']), deleteBlock);

export default router;
