import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';

const router = Router();

const CATEGORIES = ['payment', 'automation', 'ai', 'erp'] as const;

const providerSchema = z.object({
    name: z.string().min(2).max(100),
    provider_type: z.string().min(2).max(60),
    category: z.enum(CATEGORIES),
    credentials: z.record(z.string()).default({}),
    config: z.record(z.unknown()).default({}),
    is_primary: z.boolean().default(false),
    active: z.boolean().default(true),
});

// ── GET /api/v1/integration-providers ─────────────────────────────────────────
router.get(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const category = req.query['category'] as string | undefined;
            const params: string[] = [];
            const where = category ? 'WHERE category = $1' : '';
            if (category) params.push(category);

            const result = await query(
                `SELECT id, name, provider_type, category, config,
                        is_primary, active, status, last_tested_at,
                        created_at, updated_at
                 FROM integration_providers
                 ${where}
                 ORDER BY category, is_primary DESC, created_at ASC`,
                params,
            );
            res.json(result.rows);
        } catch (err) { next(err); }
    },
);

// ── POST /api/v1/integration-providers ────────────────────────────────────────
router.post(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = providerSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const d = parsed.data;

            if (d.is_primary) {
                await query(
                    'UPDATE integration_providers SET is_primary = false WHERE category = $1 AND is_primary = true',
                    [d.category],
                );
            }

            const result = await query<{ id: string }>(
                `INSERT INTO integration_providers
                   (name, provider_type, category, credentials, config, is_primary, active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 RETURNING id`,
                [d.name, d.provider_type, d.category,
                 JSON.stringify(d.credentials), JSON.stringify(d.config),
                 d.is_primary, d.active],
            );
            const id = result.rows[0]?.id;
            if (!id) throw AppError.internal(req.requestId ?? 'unknown');

            await createAuditLog({
                userId: req.user!.id, action: 'CREATE',
                entityType: 'integration_providers', entityId: id,
                oldValue: null, newValue: { ...d, credentials: '***' }, req,
            });

            const row = await query(
                `SELECT id, name, provider_type, category, config, is_primary, active, status, created_at
                 FROM integration_providers WHERE id = $1`, [id],
            );
            res.status(201).json(row.rows[0]);
        } catch (err) { next(err); }
    },
);

// ── PUT /api/v1/integration-providers/:id ─────────────────────────────────────
router.put(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = providerSchema.partial().safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const d = parsed.data;

            // Fetch current row to get category if not in body
            const current = await query<{ category: string }>(
                'SELECT category FROM integration_providers WHERE id = $1', [id],
            );
            if (!current.rows[0]) { next(AppError.notFound('Integração não encontrada.')); return; }
            const category = d.category ?? current.rows[0].category;

            if (d.is_primary === true) {
                await query(
                    'UPDATE integration_providers SET is_primary = false WHERE category = $1 AND is_primary = true AND id <> $2',
                    [category, id],
                );
            }

            const sets: string[] = [];
            const values: unknown[] = [];

            const fieldMap: Record<string, unknown> = {
                name: d.name,
                provider_type: d.provider_type,
                category: d.category,
                credentials: d.credentials !== undefined ? JSON.stringify(d.credentials) : undefined,
                config: d.config !== undefined ? JSON.stringify(d.config) : undefined,
                is_primary: d.is_primary,
                active: d.active,
            };

            for (const [col, val] of Object.entries(fieldMap)) {
                if (val !== undefined) {
                    values.push(val);
                    sets.push(`${col} = $${values.length}`);
                }
            }

            if (sets.length === 0) { res.json({ message: 'Nenhuma alteração.' }); return; }
            sets.push('updated_at = NOW()');
            values.push(id);

            await query(`UPDATE integration_providers SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
            await createAuditLog({
                userId: req.user!.id, action: 'UPDATE',
                entityType: 'integration_providers', entityId: id,
                oldValue: null, newValue: { ...d, credentials: '***' }, req,
            });
            res.json({ id });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/integration-providers/:id/toggle ────────────────────────────
router.patch(
    '/:id/toggle',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{ active: boolean }>(
                `UPDATE integration_providers SET active = NOT active, updated_at = NOW()
                 WHERE id = $1 RETURNING active`, [id],
            );
            if (!result.rows[0]) { next(AppError.notFound('Integração não encontrada.')); return; }
            await createAuditLog({
                userId: req.user!.id, action: 'UPDATE',
                entityType: 'integration_providers', entityId: id,
                oldValue: null, newValue: { active: result.rows[0].active }, req,
            });
            res.json({ id, active: result.rows[0].active });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/integration-providers/:id/set-primary ───────────────────────
router.patch(
    '/:id/set-primary',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const row = await query<{ category: string }>(
                'SELECT category FROM integration_providers WHERE id = $1', [id],
            );
            if (!row.rows[0]) { next(AppError.notFound('Integração não encontrada.')); return; }
            const { category } = row.rows[0];
            await query('UPDATE integration_providers SET is_primary = false WHERE category = $1 AND is_primary = true', [category]);
            const result = await query<{ id: string }>(
                `UPDATE integration_providers SET is_primary = true, updated_at = NOW()
                 WHERE id = $1 RETURNING id`, [id],
            );
            if (!result.rows[0]) { next(AppError.notFound('Integração não encontrada.')); return; }
            await createAuditLog({
                userId: req.user!.id, action: 'UPDATE',
                entityType: 'integration_providers', entityId: id,
                oldValue: null, newValue: { is_primary: true }, req,
            });
            res.json({ id, is_primary: true });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/integration-providers/:id/test ──────────────────────────────
router.patch(
    '/:id/test',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            // Mark as tested — actual connectivity logic would go here per provider
            await query(
                `UPDATE integration_providers SET last_tested_at = NOW(), updated_at = NOW()
                 WHERE id = $1`, [id],
            );
            res.json({ id, tested_at: new Date().toISOString(), message: 'Teste registrado.' });
        } catch (err) { next(err); }
    },
);

// ── DELETE /api/v1/integration-providers/:id ──────────────────────────────────
router.delete(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            await query('DELETE FROM integration_providers WHERE id = $1', [id]);
            await createAuditLog({
                userId: req.user!.id, action: 'DELETE',
                entityType: 'integration_providers', entityId: id,
                oldValue: null, newValue: null, req,
            });
            res.status(204).send();
        } catch (err) { next(err); }
    },
);

export default router;
