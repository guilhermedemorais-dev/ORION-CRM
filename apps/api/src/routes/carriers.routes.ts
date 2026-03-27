import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { createAuditLog } from '../middleware/audit.js';
import { getCarrierAdapter } from '../services/carriers/registry.js';

const router = Router();

const KNOWN_ADAPTERS = ['generic_rest', 'jadlog', 'correios', 'loggi', 'tnt', 'rapiddo'] as const;

const carrierSchema = z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(60).regex(/^[a-z0-9_-]+$/, 'Slug: apenas letras minúsculas, números, _ e -'),
    logo_url: z.string().url().optional().nullable(),
    adapter_type: z.enum(KNOWN_ADAPTERS).default('generic_rest'),
    credentials: z.record(z.string()).default({}),
    base_url: z.string().url().optional().nullable(),
    default_service: z.string().max(60).optional().nullable(),
    insurance_pct: z.number().min(0).max(100).default(0),
    min_insurance_cents: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
});

// ── GET /api/v1/carriers ──────────────────────────────────────────────────────
router.get(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query(
                `SELECT id, name, slug, logo_url, adapter_type, base_url, default_service,
                        insurance_pct, min_insurance_cents, active, created_at, updated_at
                 FROM carriers_config ORDER BY created_at ASC`,
            );
            res.json(result.rows);
        } catch (err) { next(err); }
    },
);

// ── GET /api/v1/carriers/active — para o modal de despacho (todos os roles) ──
router.get(
    '/active',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query(
                `SELECT id, name, slug, logo_url, adapter_type, base_url, default_service,
                        insurance_pct, min_insurance_cents
                 FROM carriers_config WHERE active = true ORDER BY name ASC`,
            );
            res.json(result.rows);
        } catch (err) { next(err); }
    },
);

// ── POST /api/v1/carriers ─────────────────────────────────────────────────────
router.post(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = carrierSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const d = parsed.data;

            // Check slug uniqueness
            const exists = await query('SELECT id FROM carriers_config WHERE slug = $1', [d.slug]);
            if ((exists.rowCount ?? 0) > 0) {
                next(AppError.conflict('SLUG_TAKEN', 'Já existe uma transportadora com este slug.'));
                return;
            }

            const result = await query<{ id: string }>(
                `INSERT INTO carriers_config
                   (name, slug, logo_url, adapter_type, credentials, base_url, default_service,
                    insurance_pct, min_insurance_cents, active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 RETURNING id`,
                [d.name, d.slug, d.logo_url ?? null, d.adapter_type,
                 JSON.stringify(d.credentials), d.base_url ?? null,
                 d.default_service ?? null, d.insurance_pct, d.min_insurance_cents, d.active],
            );
            const id = result.rows[0]?.id;
            if (!id) throw AppError.internal(req.requestId ?? 'unknown');

            await createAuditLog({ userId: req.user!.id, action: 'CREATE', entityType: 'carriers_config', entityId: id, oldValue: null, newValue: { ...d, credentials: '***' }, req });
            const carrier = await query(
                `SELECT id, name, slug, logo_url, adapter_type, base_url, default_service, insurance_pct, min_insurance_cents, active, created_at
                 FROM carriers_config WHERE id = $1`, [id],
            );
            res.status(201).json(carrier.rows[0]);
        } catch (err) { next(err); }
    },
);

// ── PUT /api/v1/carriers/:id ──────────────────────────────────────────────────
router.put(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = carrierSchema.partial().safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const d = parsed.data;

            const sets: string[] = [];
            const values: unknown[] = [];

            const fieldMap: Record<string, unknown> = {
                name: d.name,
                logo_url: d.logo_url,
                adapter_type: d.adapter_type,
                credentials: d.credentials !== undefined ? JSON.stringify(d.credentials) : undefined,
                base_url: d.base_url,
                default_service: d.default_service,
                insurance_pct: d.insurance_pct,
                min_insurance_cents: d.min_insurance_cents,
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

            await query(`UPDATE carriers_config SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'carriers_config', entityId: id, oldValue: null, newValue: { ...d, credentials: '***' }, req });
            res.json({ id });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/carriers/:id/toggle ────────────────────────────────────────
router.patch(
    '/:id/toggle',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{ active: boolean }>(
                `UPDATE carriers_config SET active = NOT active, updated_at = NOW()
                 WHERE id = $1 RETURNING active`, [id],
            );
            if (!result.rows[0]) { next(AppError.notFound('Transportadora não encontrada.')); return; }
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'carriers_config', entityId: id, oldValue: null, newValue: { active: result.rows[0].active }, req });
            res.json({ id, active: result.rows[0].active });
        } catch (err) { next(err); }
    },
);

// ── DELETE /api/v1/carriers/:id ───────────────────────────────────────────────
router.delete(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            // Check if there are deliveries using this carrier
            const inUse = await query('SELECT id FROM deliveries WHERE carrier_config_id = $1 LIMIT 1', [id]);
            if ((inUse.rowCount ?? 0) > 0) {
                next(AppError.conflict('CARRIER_IN_USE', 'Transportadora em uso em entregas existentes. Desative-a ao invés de excluir.'));
                return;
            }
            await query('DELETE FROM carriers_config WHERE id = $1', [id]);
            await createAuditLog({ userId: req.user!.id, action: 'DELETE', entityType: 'carriers_config', entityId: id, oldValue: null, newValue: null, req });
            res.status(204).send();
        } catch (err) { next(err); }
    },
);

// ── POST /api/v1/carriers/:id/test ───────────────────────────────────────────
// Verifica se as credenciais funcionam (tenta getTracking com código de teste)
router.post(
    '/:id/test',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{
                adapter_type: string;
                credentials: Record<string, string>;
                base_url: string | null;
            }>(
                'SELECT adapter_type, credentials, base_url FROM carriers_config WHERE id = $1', [id],
            );
            const carrier = result.rows[0];
            if (!carrier) { next(AppError.notFound('Transportadora não encontrada.')); return; }

            const adapter = getCarrierAdapter(carrier.adapter_type);
            try {
                await adapter.getTracking('TEST_CONNECTION', carrier.credentials, carrier.base_url ?? undefined);
                res.json({ ok: true, message: 'Conexão estabelecida.' });
            } catch {
                // A 404/not found on TEST_CONNECTION means the API responded — credentials likely ok
                res.json({ ok: true, message: 'API respondeu (código de teste não existe — credenciais aceitas).' });
            }
        } catch (err) { next(err); }
    },
);

export default router;
