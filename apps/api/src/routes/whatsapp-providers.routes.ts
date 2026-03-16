import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';

const router = Router();

const PROVIDER_TYPES = [
    'evolution',
    'uazapi',
    'meta',
    'baileys',
    'zapi',
    'twilio',
    'generic_rest',
] as const;

const providerSchema = z.object({
    name: z.string().min(2).max(100),
    provider_type: z.enum(PROVIDER_TYPES).default('evolution'),
    credentials: z.record(z.string()).default({}),
    base_url: z.string().url().optional().nullable(),
    instance_name: z.string().max(100).optional().nullable(),
    is_primary: z.boolean().default(false),
    active: z.boolean().default(true),
});

// ── GET /api/v1/whatsapp-providers ────────────────────────────────────────────
router.get(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query(
                `SELECT id, name, provider_type, base_url, instance_name,
                        is_primary, active, status, connected_number, connected_at,
                        created_at, updated_at
                 FROM whatsapp_providers ORDER BY is_primary DESC, created_at ASC`,
            );
            res.json(result.rows);
        } catch (err) { next(err); }
    },
);

// ── POST /api/v1/whatsapp-providers ──────────────────────────────────────────
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

            // If setting as primary, unset previous primary
            if (d.is_primary) {
                await query('UPDATE whatsapp_providers SET is_primary = false WHERE is_primary = true');
            }

            const result = await query<{ id: string }>(
                `INSERT INTO whatsapp_providers
                   (name, provider_type, credentials, base_url, instance_name, is_primary, active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 RETURNING id`,
                [d.name, d.provider_type, JSON.stringify(d.credentials),
                 d.base_url ?? null, d.instance_name ?? null, d.is_primary, d.active],
            );
            const id = result.rows[0]?.id;
            if (!id) throw AppError.internal(req.requestId ?? 'unknown');

            await createAuditLog({ userId: req.user!.id, action: 'CREATE', entityType: 'whatsapp_providers', entityId: id, oldValue: null, newValue: { ...d, credentials: '***' }, req });

            const provider = await query(
                `SELECT id, name, provider_type, base_url, instance_name, is_primary, active, status, connected_number, created_at
                 FROM whatsapp_providers WHERE id = $1`, [id],
            );
            res.status(201).json(provider.rows[0]);
        } catch (err) { next(err); }
    },
);

// ── PUT /api/v1/whatsapp-providers/:id ───────────────────────────────────────
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

            // If setting as primary, unset previous primary (excluding this one)
            if (d.is_primary === true) {
                await query('UPDATE whatsapp_providers SET is_primary = false WHERE is_primary = true AND id <> $1', [id]);
            }

            const sets: string[] = [];
            const values: unknown[] = [];

            const fieldMap: Record<string, unknown> = {
                name: d.name,
                provider_type: d.provider_type,
                credentials: d.credentials !== undefined ? JSON.stringify(d.credentials) : undefined,
                base_url: d.base_url,
                instance_name: d.instance_name,
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

            await query(`UPDATE whatsapp_providers SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'whatsapp_providers', entityId: id, oldValue: null, newValue: { ...d, credentials: '***' }, req });
            res.json({ id });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/whatsapp-providers/:id/toggle ───────────────────────────────
router.patch(
    '/:id/toggle',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{ active: boolean }>(
                `UPDATE whatsapp_providers SET active = NOT active, updated_at = NOW()
                 WHERE id = $1 RETURNING active`, [id],
            );
            if (!result.rows[0]) { next(AppError.notFound('Provedor não encontrado.')); return; }
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'whatsapp_providers', entityId: id, oldValue: null, newValue: { active: result.rows[0].active }, req });
            res.json({ id, active: result.rows[0].active });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/whatsapp-providers/:id/set-primary ─────────────────────────
router.patch(
    '/:id/set-primary',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            await query('UPDATE whatsapp_providers SET is_primary = false WHERE is_primary = true');
            const result = await query<{ id: string }>(
                `UPDATE whatsapp_providers SET is_primary = true, updated_at = NOW()
                 WHERE id = $1 RETURNING id`, [id],
            );
            if (!result.rows[0]) { next(AppError.notFound('Provedor não encontrado.')); return; }
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'whatsapp_providers', entityId: id, oldValue: null, newValue: { is_primary: true }, req });
            res.json({ id, is_primary: true });
        } catch (err) { next(err); }
    },
);

// ── DELETE /api/v1/whatsapp-providers/:id ────────────────────────────────────
router.delete(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            await query('DELETE FROM whatsapp_providers WHERE id = $1', [id]);
            await createAuditLog({ userId: req.user!.id, action: 'DELETE', entityType: 'whatsapp_providers', entityId: id, oldValue: null, newValue: null, req });
            res.status(204).send();
        } catch (err) { next(err); }
    },
);

export default router;
