import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import { resolveUploadDir, ensureUploadDir, sniffPdf, sniffImage, publicUploadUrl } from '../lib/uploads.js';

const router = Router();

const listCustomersSchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createCustomerSchema = z.object({
    name: z.string().trim().min(2).max(255),
    whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'WhatsApp deve estar em formato E.164'),
    email: z.string().email().max(255).optional(),
    cpf: z.string().trim().min(11).max(14).optional(),
    assigned_to: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).optional(),
});

interface CustomerRow {
    id: string;
    name: string;
    whatsapp_number: string;
    email: string | null;
    cpf: string | null;
    photo_url: string | null;
    assigned_to: string | null;
    assigned_user_name: string | null;
    lifetime_value_cents: string;
    notes: string | null;
    tags: string[] | null;
    created_at: Date;
    updated_at: Date;
}

// Política única do módulo de clientes:
//   LEITURA  → qualquer usuário autenticado com capability `client.view` lê
//              qualquer cliente (sem escopo de carteira).
//   ESCRITA  → apenas:
//              · ROOT/ADMIN, OU
//              · o atendente dono (`assigned_to === user.id`), OU
//              · usuário com toggle `custom_permissions.clientes_outros = true`
//                (configurado no painel Ajustes → Usuários).
async function assertCanEditCustomer(req: Request, assignedTo: string | null): Promise<void> {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    // ROOT e ADMIN sempre podem
    if (req.user.role === 'ROOT' || req.user.role === 'ADMIN') {
        return;
    }

    // Dono da carteira sempre pode
    if (assignedTo && assignedTo === req.user.id) {
        return;
    }

    // Toggle em users.custom_permissions habilita escrita fora da carteira.
    // Carrega lazy do DB porque o JWT não traz custom_permissions.
    const permsResult = await query<{ custom_permissions: Record<string, boolean> | null }>(
        'SELECT custom_permissions FROM users WHERE id = $1 LIMIT 1',
        [req.user.id]
    );
    const customPerms = permsResult.rows[0]?.custom_permissions ?? {};
    if (customPerms['clientes_outros'] === true) {
        return;
    }

    throw AppError.forbidden('Apenas ADMIN, ROOT ou o atendente responsável pelo cliente podem alterar este registro.');
}

async function assertCanEditCustomerById(req: Request, customerId: string): Promise<void> {
    const result = await query<{ assigned_to: string | null }>(
        'SELECT assigned_to FROM customers WHERE id = $1 LIMIT 1',
        [customerId]
    );
    const row = result.rows[0];
    if (!row) {
        throw AppError.notFound('Cliente não encontrado.');
    }
    await assertCanEditCustomer(req, row.assigned_to);
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'customers-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listCustomersSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            // Listagem aberta: qualquer usuário com capability `client.view`
            // enxerga todos os clientes (escopo de carteira só restringe escrita).
            const filters: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.q) {
                const normalizedQuery = parsed.data.q.trim();
                const digitsQuery = normalizedQuery.replace(/\D/g, '');

                values.push(`%${normalizedQuery}%`);
                const searchIndex = values.length;

                const conditions = [
                    `c.name ILIKE $${searchIndex}`,
                    `c.whatsapp_number ILIKE $${searchIndex}`,
                    `COALESCE(c.email, '') ILIKE $${searchIndex}`,
                    `COALESCE(c.cpf, '') ILIKE $${searchIndex}`,
                ];

                if (digitsQuery.length >= 3) {
                    values.push(`%${digitsQuery}%`);
                    const digitsIndex = values.length;
                    conditions.push(`regexp_replace(c.whatsapp_number, '\\D', '', 'g') ILIKE $${digitsIndex}`);
                    conditions.push(`regexp_replace(COALESCE(c.cpf, ''), '\\D', '', 'g') ILIKE $${digitsIndex}`);
                }

                filters.push(`(${conditions.join(' OR ')})`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
         FROM customers c
         ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const limitIndex = values.length - 1;
            const offsetIndex = values.length;

            const result = await query<CustomerRow>(
                `SELECT
            c.id,
            c.name,
            c.whatsapp_number,
            c.email,
            c.cpf,
            c.photo_url,
            c.assigned_to,
            u.name AS assigned_user_name,
            c.lifetime_value_cents::text,
            c.notes,
            c.created_at,
            c.updated_at
          FROM customers c
          LEFT JOIN users u ON u.id = c.assigned_to
          ${whereClause}
          ORDER BY c.updated_at DESC, c.created_at DESC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map((row) => ({
                    ...row,
                    lifetime_value_cents: Number.parseInt(row.lifetime_value_cents, 10),
                    assigned_to: row.assigned_to && row.assigned_user_name
                        ? { id: row.assigned_to, name: row.assigned_user_name }
                        : null,
                })),
                meta: {
                    total,
                    page: parsed.data.page,
                    limit: parsed.data.limit,
                    pages: Math.max(1, Math.ceil(total / parsed.data.limit)),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<CustomerRow>(
                `SELECT
            c.id,
            c.name,
            c.whatsapp_number,
            c.email,
            c.cpf,
            c.photo_url,
            c.assigned_to,
            u.name AS assigned_user_name,
            c.lifetime_value_cents::text,
            c.notes,
            c.created_at,
            c.updated_at
          FROM customers c
          LEFT JOIN users u ON u.id = c.assigned_to
          WHERE c.id = $1
          LIMIT 1`,
                [req.params['id']]
            );

            const customer = result.rows[0];
            if (!customer) {
                next(AppError.notFound('Cliente não encontrado.'));
                return;
            }

            // Leitura aberta — escopo de carteira aplica só na escrita.

            const ordersResult = await query<{ total_orders: string }>(
                'SELECT COUNT(*)::text AS total_orders FROM orders WHERE customer_id = $1',
                [customer.id]
            );

            res.json({
                ...customer,
                lifetime_value_cents: Number.parseInt(customer.lifetime_value_cents, 10),
                assigned_to: customer.assigned_to && customer.assigned_user_name
                    ? { id: customer.assigned_to, name: customer.assigned_user_name }
                    : null,
                total_orders: Number.parseInt(ordersResult.rows[0]?.total_orders ?? '0', 10),
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /customers/:id/orders — histórico de compras ─────────────────────────
router.get(
    '/:id/orders',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const customerId = String(req.params['id'] ?? '');
            const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10));
            const limit = 20;
            const offset = (page - 1) * limit;

            // Confirma existência (leitura aberta).
            const customerRes = await query<{ id: string }>(
                'SELECT id FROM customers WHERE id = $1 LIMIT 1',
                [customerId]
            );
            if (!customerRes.rows[0]) { next(AppError.notFound('Cliente não encontrado.')); return; }

            const countRes = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total FROM orders WHERE customer_id = $1`,
                [customerId]
            );
            const total = Number.parseInt(countRes.rows[0]?.total ?? '0', 10);

            const result = await query<{
                id: string;
                order_number: string;
                type: string;
                status: string;
                final_amount_cents: number;
                payment_method: string | null;
                created_at: Date;
                nfe_status: string | null;
                nfe_id: string | null;
            }>(
                `SELECT
                    o.id,
                    o.order_number,
                    o.type,
                    o.status,
                    o.final_amount_cents,
                    p.payment_method AS payment_method,
                    o.created_at,
                    fd.status AS nfe_status,
                    fd.id AS nfe_id
                 FROM orders o
                 LEFT JOIN LATERAL (
                     SELECT payment_method FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
                 ) p ON true
                 LEFT JOIN LATERAL (
                     SELECT id, status FROM fiscal_documents WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
                 ) fd ON true
                 WHERE o.customer_id = $1
                 ORDER BY o.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [customerId, limit, offset]
            );

            res.json({
                data: result.rows,
                meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
            });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'customers-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createCustomerSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const assignedTo = req.user?.role === 'ATENDENTE'
                ? req.user.id
                : parsed.data.assigned_to ?? null;

            if (parsed.data.cpf) {
                const existingCpf = await query<{ id: string }>(
                    'SELECT id FROM customers WHERE cpf = $1 LIMIT 1',
                    [parsed.data.cpf]
                );

                if (existingCpf.rows[0]) {
                    next(AppError.conflict('DUPLICATE_CPF', `CPF já vinculado ao cliente ${existingCpf.rows[0].id}.`));
                    return;
                }
            }

            const existingCustomer = await query<{ id: string }>(
                'SELECT id FROM customers WHERE whatsapp_number = $1 LIMIT 1',
                [parsed.data.whatsapp_number]
            );
            if (existingCustomer.rows[0]) {
                next(AppError.conflict('DUPLICATE_CUSTOMER', 'Já existe um cliente com este WhatsApp.'));
                return;
            }

            const result = await query<CustomerRow>(
                `INSERT INTO customers (name, whatsapp_number, email, cpf, assigned_to, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, whatsapp_number, email, cpf, assigned_to, NULL::text AS assigned_user_name, lifetime_value_cents::text, notes, created_at, updated_at`,
                [
                    parsed.data.name,
                    parsed.data.whatsapp_number,
                    parsed.data.email ?? null,
                    parsed.data.cpf ?? null,
                    assignedTo,
                    parsed.data.notes ?? null,
                ]
            );

            const customer = result.rows[0];
            if (!customer) {
                throw AppError.internal(req.requestId);
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'customers',
                    entityId: customer.id,
                    oldValue: null,
                    newValue: {
                        name: customer.name,
                        whatsapp_number: customer.whatsapp_number,
                    },
                    req,
                });
            }

            res.status(201).json({
                ...customer,
                lifetime_value_cents: Number.parseInt(customer.lifetime_value_cents, 10),
                assigned_to: customer.assigned_to,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /customers/:id/full ───────────────────────────────────────────────────
router.get(
    '/:id/full',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<CustomerRow & {
                social_name: string | null; rg: string | null; gender: string | null;
                instagram: string | null; phone_landline: string | null;
                zip_code: string | null; city: string | null; state: string | null;
                address_full: string | null; cnpj: string | null; company_name: string | null;
                company_address: string | null; preferred_metal: string | null;
                ring_size: string | null; preferred_channel: string | null;
                special_dates: string | null; remarketing_notes: string | null;
                origin: string | null; is_converted: boolean; converted_at: Date | null;
                ltv_cents: number;
                orders_count: string; last_order_at: Date | null; has_pending_os: boolean;
                birth_date_str: string | null;
            }>(
                `SELECT c.*,
                        TO_CHAR(c.birth_date, 'YYYY-MM-DD') AS birth_date_str,
                        u.name AS assigned_user_name,
                        (SELECT COUNT(*)::text FROM orders WHERE customer_id = c.id) AS orders_count,
                        (SELECT MAX(created_at) FROM orders WHERE customer_id = c.id) AS last_order_at,
                        EXISTS(SELECT 1 FROM service_orders WHERE customer_id = c.id AND status NOT IN ('delivered','cancelled')) AS has_pending_os
                 FROM customers c
                 LEFT JOIN users u ON u.id = c.assigned_to
                 WHERE c.id = $1 LIMIT 1`,
                [req.params['id']]
            );

            const customer = result.rows[0];
            if (!customer) { next(AppError.notFound('Cliente não encontrado.')); return; }

            // Leitura aberta — escopo de carteira aplica só na escrita.

            // Responsável derivado: cruza pedidos, conversas e blocos de atendimento.
            // "Começou a atender" = atividade mais antiga; "atendendo agora" = a mais recente.
            type Attendant = { id: string; name: string | null; at: string } | null;
            const attendantsRes = await query<{ first_attendant: Attendant; current_attendant: Attendant }>(
                `WITH acts AS (
                    SELECT assigned_to AS uid, created_at AS ts FROM orders WHERE customer_id = $1 AND assigned_to IS NOT NULL
                    UNION ALL
                    SELECT assigned_to, COALESCE(assigned_at, created_at) FROM conversations WHERE customer_id = $1 AND assigned_to IS NOT NULL
                    UNION ALL
                    SELECT created_by, created_at FROM attendance_blocks WHERE customer_id = $1 AND created_by IS NOT NULL
                 )
                 SELECT
                    (SELECT json_build_object('id', f.uid, 'name', uf.name, 'at', f.ts)
                       FROM (SELECT uid, ts FROM acts ORDER BY ts ASC LIMIT 1) f
                       LEFT JOIN users uf ON uf.id = f.uid) AS first_attendant,
                    (SELECT json_build_object('id', l.uid, 'name', ul.name, 'at', l.ts)
                       FROM (SELECT uid, ts FROM acts ORDER BY ts DESC LIMIT 1) l
                       LEFT JOIN users ul ON ul.id = l.uid) AS current_attendant`,
                [req.params['id']]
            );

            res.json({
                ...customer,
                // birth_date vem do Postgres como DATE; força YYYY-MM-DD para o <input type="date">.
                birth_date: customer.birth_date_str,
                lifetime_value_cents: Number.parseInt(customer.lifetime_value_cents, 10),
                orders_count: Number.parseInt(customer.orders_count, 10),
                assigned_to: customer.assigned_to && customer.assigned_user_name
                    ? { id: customer.assigned_to, name: customer.assigned_user_name }
                    : null,
                first_attendant: attendantsRes.rows[0]?.first_attendant ?? null,
                current_attendant: attendantsRes.rows[0]?.current_attendant ?? null,
            });
        } catch (err) { next(err); }
    }
);

// ── PATCH /customers/:id ──────────────────────────────────────────────────────
const patchCustomerSchema = z.object({
    name: z.string().trim().min(2).max(255).optional(),
    whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'WhatsApp deve estar em formato E.164').optional().nullable(),
    email: z.string().email().optional().nullable(),
    cpf: z.string().optional().nullable(),
    social_name: z.string().max(100).optional().nullable(),
    rg: z.string().max(30).optional().nullable(),
    birth_date: z.string().optional().nullable(),
    gender: z.string().max(20).optional().nullable(),
    instagram: z.string().max(100).optional().nullable(),
    phone_landline: z.string().max(30).optional().nullable(),
    zip_code: z.string().max(10).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(2).optional().nullable(),
    address_full: z.string().max(300).optional().nullable(),
    cnpj: z.string().max(20).optional().nullable(),
    company_name: z.string().max(200).optional().nullable(),
    company_address: z.string().max(300).optional().nullable(),
    preferred_metal: z.string().max(50).optional().nullable(),
    ring_size: z.string().max(10).optional().nullable(),
    preferred_channel: z.string().max(20).optional().nullable(),
    special_dates: z.string().optional().nullable(),
    remarketing_notes: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    assigned_to: z.string().uuid().optional().nullable(),
});

router.patch(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Campos opcionais vazios chegam como "" do formulário. Convertê-los em null
            // ANTES da validação evita que constraints de formato (ex.: email) rejeitem
            // string vazia e derrubem o PATCH inteiro com 400 — perdendo todas as edições.
            const rawBody = (req.body ?? {}) as Record<string, unknown>;
            const cleanedBody: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(rawBody)) {
                cleanedBody[k] = typeof v === 'string' && v.trim() === '' ? null : v;
            }

            const parsed = patchCustomerSchema.safeParse(cleanedBody);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            // Escrita: precisa ser ROOT/ADMIN, dono ou ter clientes_outros.
            await assertCanEditCustomerById(req, req.params['id'] as string);

            const { tags, ...fields } = parsed.data as Record<string, unknown> & { tags?: string[] };
            const sets: string[] = [];
            const values: unknown[] = [];

            for (const [k, v] of Object.entries(fields)) {
                if (v === undefined) continue;
                values.push(v);
                sets.push(`${k} = $${values.length}`);
            }

            // tags é JSONB: normaliza (remove vazios/duplicatas) e serializa com cast explícito.
            if (tags !== undefined) {
                const cleaned = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)));
                values.push(JSON.stringify(cleaned));
                sets.push(`tags = $${values.length}::jsonb`);
            }
            if (sets.length === 0) { res.json({ message: 'Nenhuma alteração.' }); return; }
            sets.push('updated_at = NOW()');
            values.push(req.params['id']);

            const result = await query<{ id: string }>(
                `UPDATE customers SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
                values
            );
            if (!result.rows[0]) { next(AppError.notFound('Cliente não encontrado.')); return; }

            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'customers', entityId: req.params['id'] as string, oldValue: null, newValue: parsed.data, req });
            res.json({ id: req.params['id'] });
        } catch (err) { next(err); }
    }
);

// ── GET /customers/:id/stats ──────────────────────────────────────────────────
router.get(
    '/:id/stats',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;

            // Confirma existência (leitura aberta).
            const customerRes = await query<{ id: string }>(
                'SELECT id FROM customers WHERE id = $1 LIMIT 1',
                [id]
            );
            if (!customerRes.rows[0]) { next(AppError.notFound('Cliente não encontrado.')); return; }

            const [ltvRes, osRes, lastIntRes, proposalRes] = await Promise.all([
                query<{ ltv: string; orders_count: string }>(
                    `SELECT lifetime_value_cents::text AS ltv, (SELECT COUNT(*) FROM orders WHERE customer_id = $1)::text AS orders_count FROM customers WHERE id = $1`,
                    [id]
                ),
                query<{ pending_os: string }>(
                    `SELECT COUNT(*)::text AS pending_os FROM service_orders WHERE customer_id = $1 AND status NOT IN ('delivered','cancelled')`,
                    [id]
                ),
                query<{ last_interaction_days: string }>(
                    `SELECT EXTRACT(DAY FROM NOW() - MAX(created_at))::text AS last_interaction_days FROM attendance_blocks WHERE customer_id = $1`,
                    [id]
                ),
                query<{ open_proposals: string }>(
                    `SELECT COUNT(*)::text AS open_proposals FROM orders WHERE customer_id = $1 AND status IN ('AGUARDANDO_PAGAMENTO', 'RASCUNHO')`,
                    [id]
                ),
            ]);

            res.json({
                ltv_cents: Number.parseInt(ltvRes.rows[0]?.ltv ?? '0', 10),
                orders_count: Number.parseInt(ltvRes.rows[0]?.orders_count ?? '0', 10),
                pending_os: Number.parseInt(osRes.rows[0]?.pending_os ?? '0', 10),
                last_interaction_days: Number.parseInt(lastIntRes.rows[0]?.last_interaction_days ?? '0', 10),
                open_proposals: Number.parseInt(proposalRes.rows[0]?.open_proposals ?? '0', 10),
            });
        } catch (err) { next(err); }
    }
);

// ── GET /customers/:id/history ────────────────────────────────────────────────
router.get(
    '/:id/history',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const requestedType = String(req.query['type'] ?? 'log');
            const type = requestedType;
            const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10));
            const requestedLimit = Number.parseInt(String(req.query['limit'] ?? '30'), 10);
            const limit = Number.isNaN(requestedLimit) ? 30 : Math.min(200, Math.max(1, requestedLimit));

            // Confirma existência (leitura aberta).
            const customerRes = await query<{ id: string }>(
                'SELECT id FROM customers WHERE id = $1 LIMIT 1',
                [id]
            );
            if (!customerRes.rows[0]) { next(AppError.notFound('Cliente não encontrado.')); return; }

            const offset = (page - 1) * limit;

            if (type === 'log' || type === 'all') {
                const result = await query(
                    `SELECT al.id,
                            CASE
                                WHEN al.entity_type IN ('customer', 'customers') AND al.action = 'CREATE' THEN 'created'
                                WHEN al.entity_type IN ('customer', 'customers') AND al.action = 'UPDATE' THEN 'updated'
                                WHEN al.entity_type = 'attendance_block' AND al.action = 'CREATE' THEN 'attendance_created'
                                WHEN al.entity_type = 'attendance_block' AND al.action = 'UPDATE' THEN 'attendance_updated'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'CREATE' THEN 'order_created'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'UPDATE_STATUS' THEN 'order_status_changed'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'MOVE_STAGE' THEN 'order_stage_moved'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'OVERRIDE_STAGE_MOVE' THEN 'order_stage_overridden'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'PAUSE_ORDER' THEN 'order_paused'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'RESUME_ORDER' THEN 'order_resumed'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'CANCEL_ORDER' THEN 'order_cancelled'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'NOTIFY_WHATSAPP' THEN 'order_whatsapp_notified'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'UPDATE' THEN 'order_updated'
                                WHEN al.entity_type = 'service_order' AND al.action = 'CREATE' THEN 'os_created'
                                WHEN al.entity_type = 'service_order' AND al.action = 'UPDATE' THEN 'os_updated'
                                WHEN al.entity_type = 'delivery' AND al.action = 'CREATE' THEN 'delivery_created'
                                WHEN al.entity_type = 'delivery' AND al.action = 'UPDATE' THEN 'delivery_updated'
                                WHEN al.entity_type = 'proposal' AND al.action = 'CREATE' THEN 'proposal_created'
                                ELSE LOWER(al.entity_type)
                            END AS type,
                            CASE
                                WHEN al.entity_type IN ('customer', 'customers') AND al.action = 'CREATE' THEN 'Cliente cadastrado.'
                                WHEN al.entity_type IN ('customer', 'customers') AND al.action = 'UPDATE' THEN 'Cadastro do cliente atualizado.'
                                WHEN al.entity_type = 'attendance_block' AND al.action = 'CREATE' THEN 'Atendimento registrado.'
                                WHEN al.entity_type = 'attendance_block' AND al.action = 'UPDATE' THEN 'Atendimento atualizado.'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'CREATE' THEN
                                    CONCAT('Pedido criado: ', COALESCE(al.new_value->>'order_number', SUBSTRING(al.entity_id::text, 1, 8)))
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'UPDATE_STATUS' THEN
                                    CONCAT('Status do pedido alterado para ', COALESCE(al.new_value->>'status', 'desconhecido'), '.')
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'MOVE_STAGE' THEN 'Pedido avançou de etapa no fluxo.'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'OVERRIDE_STAGE_MOVE' THEN
                                    CONCAT('Etapa do pedido movida com OVERRIDE de regras. Motivo: ', COALESCE(al.new_value->>'override_reason', '—'))
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'PAUSE_ORDER' THEN
                                    CONCAT('Pedido pausado. Motivo: ', COALESCE(al.new_value->>'paused_reason', '—'))
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'RESUME_ORDER' THEN 'Pedido retomado.'
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'CANCEL_ORDER' THEN
                                    CONCAT('Pedido cancelado. Motivo: ', COALESCE(al.new_value->>'cancellation_reason', '—'))
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'NOTIFY_WHATSAPP' THEN
                                    CONCAT('Notificação enviada ao cliente via WhatsApp (provedor: ', COALESCE(al.new_value->>'provider_type', 'desconhecido'), ').')
                                WHEN al.entity_type IN ('order', 'orders') AND al.action = 'UPDATE' THEN 'Pedido atualizado.'
                                WHEN al.entity_type = 'service_order' AND al.action = 'CREATE' THEN 'Ordem de serviço criada.'
                                WHEN al.entity_type = 'service_order' AND al.action = 'UPDATE' THEN 'Ordem de serviço atualizada.'
                                WHEN al.entity_type = 'delivery' AND al.action = 'CREATE' THEN 'Entrega criada.'
                                WHEN al.entity_type = 'delivery' AND al.action = 'UPDATE' THEN 'Entrega atualizada.'
                                WHEN al.entity_type = 'proposal' AND al.action = 'CREATE' THEN 'Proposta criada.'
                                ELSE CONCAT(INITCAP(REPLACE(al.entity_type, '_', ' ')), ' ', LOWER(al.action), '.')
                            END AS description,
                            al.created_at,
                            u.name AS user_name,
                            jsonb_strip_nulls(jsonb_build_object(
                                'action', al.action,
                                'entity_type', al.entity_type,
                                'entity_id', al.entity_id,
                                'new_value', al.new_value
                            )) AS metadata
                     FROM audit_logs al
                     LEFT JOIN users u ON u.id = al.user_id
                     WHERE al.entity_id = $1
                        OR al.entity_id IN (SELECT id FROM attendance_blocks WHERE customer_id = $1)
                        OR al.entity_id IN (SELECT id FROM orders WHERE customer_id = $1)
                     ORDER BY al.created_at DESC
                     LIMIT $2 OFFSET $3`,
                    [id, limit, offset]
                );
                res.json({ data: result.rows, type });
            } else if (type === 'whatsapp') {
                const result = await query(
                    `SELECT m.id,
                            CASE
                                WHEN m.direction = 'INBOUND' THEN 'inbound'
                                ELSE 'outbound'
                            END AS type,
                            COALESCE(NULLIF(BTRIM(m.content), ''), '[Mensagem sem texto]') AS description,
                            m.created_at,
                            u.name AS user_name,
                            jsonb_strip_nulls(jsonb_build_object(
                                'direction', LOWER(m.direction::text),
                                'message_type', LOWER(m.type::text),
                                'status', LOWER(m.status::text),
                                'conversation_id', m.conversation_id,
                                'channel', cv.channel,
                                'contact_name', cv.contact_name,
                                'contact_phone', cv.contact_phone
                            )) AS metadata
                     FROM messages m
                     JOIN conversations cv ON cv.id = m.conversation_id
                     LEFT JOIN users u ON u.id = m.sent_by
                     WHERE cv.channel = 'whatsapp'
                       AND (
                           cv.customer_id = $1
                           OR (
                               cv.customer_id IS NULL
                               AND EXISTS (
                                   SELECT 1
                                   FROM customers ct
                                   WHERE ct.id = $1
                                     AND ct.whatsapp_number IS NOT NULL
                                     AND ct.whatsapp_number = cv.contact_phone
                               )
                           )
                       )
                     ORDER BY m.created_at DESC
                     LIMIT $2 OFFSET $3`,
                    [id, limit, offset]
                );
                res.json({ data: result.rows, type });
            } else {
                res.json({ data: [], type });
            }
        } catch (err) { next(err); }
    }
);

// ── GET+POST /customers/:id/feedback ─────────────────────────────────────────
router.get(
    '/:id/feedback',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Stub — tabela de feedback pode não existir ainda
            res.json({ data: [], meta: { total: 0 } });
        } catch (err) { next(err); }
    }
);

router.post(
    '/:id/feedback',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertCanEditCustomerById(req, req.params['id'] as string);
            // Stub — retornar 201 até tabela de feedback ser criada
            res.status(201).json({ message: 'Feedback registrado.' });
        } catch (err) { next(err); }
    }
);

// ── POST/DELETE /customers/:id/photo ────────────────────────────────────────
// Foto de perfil do cliente. Memory storage (5 MB), magic bytes obrigatório,
// gravada em <UPLOAD_PATH>/customers/<id>/photo.<ext>.
const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
    '/:id/photo',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    photoUpload.single('photo'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
                throw AppError.badRequest('Cliente inválido.');
            }
            await assertCanEditCustomerById(req, id);

            if (!req.file) {
                throw AppError.badRequest('Nenhum arquivo enviado.');
            }
            const kind = sniffImage(req.file.buffer);
            if (!kind) {
                throw AppError.badRequest('Tipo de arquivo inválido. Apenas PNG, JPEG e WebP são aceitos.');
            }

            const current = await query<{ photo_url: string | null }>(
                `SELECT photo_url FROM customers WHERE id = $1`,
                [id]
            );
            if (current.rows.length === 0) {
                throw AppError.notFound('Cliente não encontrado.');
            }
            const previousUrl = current.rows[0]?.photo_url ?? null;

            const ext = kind === 'jpeg' ? 'jpg' : kind;
            const uploadDir = await ensureUploadDir('customers', id);
            const filename = `photo.${ext}`;
            const absolutePath = path.join(uploadDir, filename);
            await fs.writeFile(absolutePath, req.file.buffer);

            // Se a extensão mudou (PNG → JPG, por ex.), o arquivo antigo precisa ser removido
            // pra não vazar storage. Best-effort.
            if (previousUrl && !previousUrl.endsWith(`/${filename}`)) {
                const oldName = previousUrl.split('/').pop();
                if (oldName) {
                    await fs.unlink(path.join(uploadDir, oldName)).catch(() => {});
                }
            }

            const photoUrl = publicUploadUrl('customers', id, filename);
            await query(
                `UPDATE customers SET photo_url = $2, updated_at = NOW() WHERE id = $1`,
                [id, photoUrl]
            );

            await createAuditLog({
                req,
                userId: req.user!.id,
                action: 'UPDATE',
                entityType: 'customer',
                entityId: id,
                oldValue: { photo_url: previousUrl },
                newValue: { photo_url: photoUrl },
            });

            res.json({ photo_url: photoUrl });
        } catch (err) { next(err); }
    }
);

router.delete(
    '/:id/photo',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
                throw AppError.badRequest('Cliente inválido.');
            }
            await assertCanEditCustomerById(req, id);

            const current = await query<{ photo_url: string | null }>(
                `SELECT photo_url FROM customers WHERE id = $1`,
                [id]
            );
            if (current.rows.length === 0) {
                throw AppError.notFound('Cliente não encontrado.');
            }
            const previousUrl = current.rows[0]?.photo_url ?? null;
            if (!previousUrl) {
                res.json({ photo_url: null });
                return;
            }

            await query(
                `UPDATE customers SET photo_url = NULL, updated_at = NOW() WHERE id = $1`,
                [id]
            );

            // Remove o arquivo do disco — best-effort.
            try {
                const segments = previousUrl.replace(/^\/?uploads\//, '').split('/').filter(Boolean);
                if (segments.length > 0) {
                    const absolutePath = resolveUploadDir(...segments);
                    await fs.unlink(absolutePath).catch(() => {});
                }
            } catch {
                // resolveUploadDir lança se escapar da raiz — ignora silenciosamente.
            }

            await createAuditLog({
                req,
                userId: req.user!.id,
                action: 'DELETE',
                entityType: 'customer',
                entityId: id,
                oldValue: { photo_url: previousUrl },
                newValue: { photo_url: null },
            });

            res.json({ photo_url: null });
        } catch (err) { next(err); }
    }
);

export default router;

// ── Multer config for proposal attachments ──────────────────────────────────
// Disk storage no diretório canônico de uploads (volume Docker servido por NGINX).
// Magic bytes do PDF são validados após o multer escrever o arquivo;
// validar antes só dá pra fazer com memoryStorage, e PDFs podem ser grandes.
const proposalsDir = resolveUploadDir('proposals');
const upload = multer({
    dest: proposalsDir,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF são aceitos'));
        }
    },
});

// Garante diretório no boot (best-effort; ensureUploadDir reforça em cada request)
void ensureUploadDir('proposals');

// ── GET /customers/:id/proposals/attachments ────────────────────────────────
router.get(
    '/:id/proposals/attachments',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;

            const result = await query(
                `SELECT id, filename, original_name, file_size, created_at
                 FROM proposal_attachments
                 WHERE customer_id = $1
                 ORDER BY created_at DESC`,
                [id]
            );

            res.json(result.rows);
        } catch (err) { next(err); }
    }
);

// ── POST /customers/:id/proposals/attachments ───────────────────────────────
router.post(
    '/:id/proposals/attachments',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            await assertCanEditCustomerById(req, id);
            const file = req.file;

            if (!file) {
                throw new AppError(400, 'FILE_MISSING', 'Arquivo não enviado');
            }

            // Magic bytes — defense in depth contra arquivos disfarçados de PDF.
            // Lê só os primeiros bytes; não carrega o PDF inteiro na memória.
            const fh = await fs.open(file.path, 'r');
            const head = Buffer.alloc(8);
            try {
                await fh.read(head, 0, 8, 0);
            } finally {
                await fh.close();
            }
            if (!sniffPdf(head)) {
                await fs.unlink(file.path).catch(() => {});
                throw new AppError(400, 'INVALID_FILE_TYPE', 'O arquivo enviado não é um PDF válido.');
            }

            // Generate unique filename (forçando extensão .pdf — magic bytes já confirmaram)
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.pdf`;
            const filePath = path.posix.join('proposals', filename);

            // Move file to final location
            const finalPath = path.join(proposalsDir, filename);
            await fs.rename(file.path, finalPath);

            // Insert into database
            const result = await query(
                `INSERT INTO proposal_attachments (customer_id, filename, original_name, mime_type, file_size, file_path, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, filename, original_name, file_size, created_at`,
                [id, filename, file.originalname, 'application/pdf', file.size, filePath, req.user!.id]
            );

            const attachment = result.rows[0];
            if (!attachment) {
                throw new AppError(500, 'INSERT_FAILED', 'Falha ao salvar anexo');
            }

            await createAuditLog({
                req,
                userId: req.user!.id,
                action: 'CREATE',
                entityType: 'proposal_attachment',
                entityId: attachment['id'],
                oldValue: null,
                newValue: attachment
            });

            res.status(201).json(attachment);
        } catch (err) { next(err); }
    }
);

// ── DELETE /customers/:id/proposals/attachments/:attachmentId ──────────────
router.delete(
    '/:id/proposals/attachments/:attachmentId',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, attachmentId } = req.params;
            const customerId = id;
            const attId = attachmentId;

            await assertCanEditCustomerById(req, customerId as string);

            // Get file info before deleting
            const fileResult = await query(
                `SELECT file_path FROM proposal_attachments WHERE id = $1 AND customer_id = $2`,
                [attId, customerId]
            );

            if (fileResult.rows.length === 0) {
                throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Anexo não encontrado');
            }

            const fileInfo = fileResult.rows[0] as Record<string, unknown>;

            // Delete from database
            await query(
                `DELETE FROM proposal_attachments WHERE id = $1 AND customer_id = $2`,
                [attId, customerId]
            );

            // Delete file from disk
            // `file_path` é gravado como caminho relativo "proposals/<filename>".
            // resolveUploadDir prefixa com a raiz canônica e bloqueia traversal.
            const filePathStr = fileInfo['file_path'] as string;
            try {
                const absolutePath = resolveUploadDir(...filePathStr.split('/').filter(Boolean));
                await fs.unlink(absolutePath).catch(() => {});
            } catch {
                // resolveUploadDir lança se o caminho escapar da raiz — ignora.
            }

            await createAuditLog({
                req,
                userId: req.user!.id,
                action: 'DELETE',
                entityType: 'proposal_attachment',
                entityId: attId as string,
                oldValue: fileInfo,
                newValue: null
            });

            res.json({ message: 'Anexo removido com sucesso' });
        } catch (err) { next(err); }
    }
);
