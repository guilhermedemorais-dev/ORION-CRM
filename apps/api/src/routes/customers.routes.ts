import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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
                filters.push(`(c.name ILIKE $${searchIndex} OR c.whatsapp_number ILIKE $${searchIndex} OR COALESCE(c.email, '') ILIKE $${searchIndex})`);
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

export default router;
