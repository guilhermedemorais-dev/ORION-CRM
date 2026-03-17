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
    assigned_to: string | null;
    assigned_user_name: string | null;
    lifetime_value_cents: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

function getScopedAssignedTo(req: Request): string | undefined {
    if (!req.user) {
        return undefined;
    }

    return req.user.role === 'ATENDENTE' ? req.user.id : undefined;
}

function assertCanAccessCustomer(req: Request, assignedTo: string | null): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ADMIN') {
        return;
    }

    if (!assignedTo || assignedTo !== req.user.id) {
        throw AppError.forbidden('Acesso não autorizado para este cliente.');
    }
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

            const scopedAssignedTo = getScopedAssignedTo(req);
            const filters: string[] = [];
            const values: unknown[] = [];

            if (scopedAssignedTo) {
                values.push(scopedAssignedTo);
                filters.push(`c.assigned_to = $${values.length}`);
            }

            if (parsed.data.q) {
                values.push(`%${parsed.data.q}%`);
                const searchIndex = values.length;
                filters.push(`(c.name ILIKE $${searchIndex} OR c.whatsapp_number ILIKE $${searchIndex} OR COALESCE(c.email, '') ILIKE $${searchIndex} OR COALESCE(c.cpf, '') ILIKE $${searchIndex})`);
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

            assertCanAccessCustomer(req, customer.assigned_to);

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
                    p.method AS payment_method,
                    o.created_at,
                    fd.status AS nfe_status,
                    fd.id AS nfe_id
                 FROM orders o
                 LEFT JOIN LATERAL (
                     SELECT method FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
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
            }>(
                `SELECT c.*,
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

            res.json({
                ...customer,
                lifetime_value_cents: Number.parseInt(customer.lifetime_value_cents, 10),
                orders_count: Number.parseInt(customer.orders_count, 10),
                assigned_to: customer.assigned_to && customer.assigned_user_name
                    ? { id: customer.assigned_to, name: customer.assigned_user_name }
                    : null,
            });
        } catch (err) { next(err); }
    }
);

// ── PATCH /customers/:id ──────────────────────────────────────────────────────
const patchCustomerSchema = z.object({
    name: z.string().trim().min(2).max(255).optional(),
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
    assigned_to: z.string().uuid().optional().nullable(),
});

router.patch(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = patchCustomerSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const fields = parsed.data as Record<string, unknown>;
            const sets: string[] = [];
            const values: unknown[] = [];

            for (const [k, v] of Object.entries(fields)) {
                if (v !== undefined) { values.push(v); sets.push(`${k} = $${values.length}`); }
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const type = String(req.query['type'] ?? 'log');
            const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10));
            const limit = 30;
            const offset = (page - 1) * limit;

            if (type === 'log') {
                const result = await query(
                    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.new_value,
                            al.created_at, u.name AS user_name
                     FROM audit_logs al
                     LEFT JOIN users u ON u.id = al.user_id
                     WHERE al.entity_id = $1 OR al.entity_id IN (
                         SELECT id FROM attendance_blocks WHERE customer_id = $1
                     )
                     ORDER BY al.created_at DESC
                     LIMIT $2 OFFSET $3`,
                    [id, limit, offset]
                );
                res.json({ data: result.rows, type });
            } else if (type === 'whatsapp') {
                const result = await query(
                    `SELECT m.id, m.direction, m.message_type, m.content, m.status,
                            m.created_at, c.name AS contact_name
                     FROM messages m
                     JOIN conversations cv ON cv.id = m.conversation_id
                     LEFT JOIN customers ct ON ct.whatsapp_number = cv.contact_phone
                     LEFT JOIN contacts c ON c.id = cv.contact_id
                     WHERE ct.id = $1
                     ORDER BY m.created_at DESC
                     LIMIT $2 OFFSET $3`,
                    [id, limit, offset]
                ).catch(() => ({ rows: [] }));
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Stub — retornar 201 até tabela de feedback ser criada
            res.status(201).json({ message: 'Feedback registrado.' });
        } catch (err) { next(err); }
    }
);

export default router;

// ── Multer config for proposal attachments ──────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'proposals');
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF são aceitos'));
        }
    },
});

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(() => {});

// ── GET /customers/:id/proposals/attachments ────────────────────────────────
router.get(
    '/:id/proposals/attachments',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const file = req.file;

            if (!file) {
                throw new AppError(400, 'FILE_MISSING', 'Arquivo não enviado');
            }

            // Generate unique filename
            const ext = path.extname(file.originalname);
            const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
            const filePath = path.join('proposals', filename);

            // Move file to final location
            const finalPath = path.join(uploadDir, filename);
            await fs.rename(file.path, finalPath);

            // Insert into database
            const result = await query(
                `INSERT INTO proposal_attachments (customer_id, filename, original_name, mime_type, file_size, file_path, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, filename, original_name, file_size, created_at`,
                [id, filename, file.originalname, file.mimetype, file.size, filePath, req.user!.id]
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
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, attachmentId } = req.params;
            const customerId = id;
            const attId = attachmentId;

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
            const filePathStr = fileInfo['file_path'] as string;
            const filePath = path.join(process.cwd(), 'uploads', filePathStr);
            await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist

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
