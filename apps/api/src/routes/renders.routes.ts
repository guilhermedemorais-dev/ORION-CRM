import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const createRenderSchema = z.object({
    piece_type: z.string().optional(),
    metal: z.string().optional(),
    stone: z.string().optional(),
    band_style: z.string().optional(),
    finish: z.string().optional(),
    ring_size: z.string().optional(),
    extra_details: z.string().optional(),
    band_thickness: z.number().optional(),
    setting_height: z.number().optional(),
    prong_count: z.number().int().optional(),
    band_profile: z.string().optional(),
});

// ── POST /api/v1/blocks/:block_id/render ─────────────────────────────────────
router.post(
    '/:block_id/render',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { block_id } = req.params as { block_id: string };
            const parsed = createRenderSchema.safeParse(req.body);
            if (!parsed.success) { next(AppError.badRequest('Dados inválidos.')); return; }

            const block = await query<{ customer_id: string }>(
                `SELECT customer_id FROM attendance_blocks WHERE id = $1`, [block_id]
            );
            if (!block.rows[0]) { next(AppError.notFound('Bloco não encontrado.')); return; }

            const result = await query<{ id: string }>(
                `INSERT INTO ai_renders
                 (attendance_block_id, customer_id, piece_type, metal, stone, band_style, finish,
                  ring_size, extra_details, band_thickness, setting_height, prong_count, band_profile,
                  status, render_url_front, render_url_top, render_url_side, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'generated',
                   '/static/placeholders/ring-front.png',
                   '/static/placeholders/ring-top.png',
                   '/static/placeholders/ring-side.png', $14)
                 RETURNING id`,
                [
                    block_id, block.rows[0].customer_id,
                    parsed.data.piece_type ?? null, parsed.data.metal ?? null,
                    parsed.data.stone ?? null, parsed.data.band_style ?? null,
                    parsed.data.finish ?? null, parsed.data.ring_size ?? null,
                    parsed.data.extra_details ?? null, parsed.data.band_thickness ?? null,
                    parsed.data.setting_height ?? null, parsed.data.prong_count ?? null,
                    parsed.data.band_profile ?? null, req.user!.id,
                ]
            );

            const renderId = result.rows[0]?.id;
            if (!renderId) throw AppError.internal(req.requestId);

            // Mark block as has_3d
            await query(`UPDATE attendance_blocks SET has_3d = true, ai_render_id = $1, updated_at = NOW() WHERE id = $2`, [renderId, block_id]);

            const render = await query(`SELECT * FROM ai_renders WHERE id = $1`, [renderId]);
            res.status(201).json(render.rows[0]);
        } catch (err) { next(err); }
    }
);

// ── GET /api/v1/renders/:id ───────────────────────────────────────────────────
router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE', 'DESIGNER_3D']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query(`SELECT * FROM ai_renders WHERE id = $1`, [req.params['id']]);
            if (!result.rows[0]) { next(AppError.notFound('Render não encontrado.')); return; }
            res.json(result.rows[0]);
        } catch (err) { next(err); }
    }
);

// ── PATCH /api/v1/renders/:id/approve ────────────────────────────────────────
router.patch(
    '/:id/approve',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            await query(
                `UPDATE ai_renders SET is_approved = true, approved_by = $1, approved_at = NOW(), status = 'approved' WHERE id = $2`,
                [req.user!.id, id]
            );
            const result = await query(`SELECT * FROM ai_renders WHERE id = $1`, [id]);
            res.json(result.rows[0]);
        } catch (err) { next(err); }
    }
);

// ── PATCH /api/v1/renders/:id/adjust ─────────────────────────────────────────
router.patch(
    '/:id/adjust',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = createRenderSchema.safeParse(req.body);
            if (!parsed.success) { next(AppError.badRequest('Dados inválidos.')); return; }

            const sets: string[] = [];
            const values: unknown[] = [];
            const fields = parsed.data as Record<string, unknown>;
            for (const [k, v] of Object.entries(fields)) {
                if (v !== undefined) { values.push(v); sets.push(`${k} = $${values.length}`); }
            }
            if (sets.length === 0) { res.json({ message: 'Nenhuma alteração.' }); return; }
            values.push(id);
            await query(`UPDATE ai_renders SET ${sets.join(', ')}, status = 'generated' WHERE id = $${values.length}`, values);
            const result = await query(`SELECT * FROM ai_renders WHERE id = $1`, [id]);
            res.json(result.rows[0]);
        } catch (err) { next(err); }
    }
);

export default router;
