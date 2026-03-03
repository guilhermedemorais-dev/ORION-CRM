import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import type { LeadSource, LeadStage, UserRole } from '../types/entities.js';

const router = Router();

const leadStageSchema = z.enum(['NOVO', 'QUALIFICADO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'CONVERTIDO', 'PERDIDO']);
const leadSourceSchema = z.enum(['WHATSAPP', 'BALCAO', 'INDICACAO', 'OUTRO']);

const listLeadsSchema = z.object({
    stage: leadStageSchema.optional(),
    assigned_to: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createLeadSchema = z.object({
    whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'WhatsApp deve estar em formato E.164'),
    name: z.string().trim().min(2).max(255).optional(),
    email: z.string().email().max(255).optional(),
    source: leadSourceSchema.default('WHATSAPP'),
    assigned_to: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).optional(),
});

const updateLeadStageSchema = z.object({
    stage: leadStageSchema,
});

interface LeadRow {
    id: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
    stage: LeadStage;
    source: LeadSource;
    notes: string | null;
    converted_customer_id: string | null;
    last_interaction_at: Date | null;
    created_at: Date;
    updated_at: Date;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
}

interface LeadSummary {
    id: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
    stage: LeadStage;
    source: LeadSource;
    notes: string | null;
    converted_customer_id: string | null;
    last_interaction_at: Date | null;
    created_at: Date;
    updated_at: Date;
    assigned_to: {
        id: string;
        name: string;
    } | null;
}

function mapLead(row: LeadRow): LeadSummary {
    return {
        id: row.id,
        name: row.name,
        whatsapp_number: row.whatsapp_number,
        email: row.email,
        stage: row.stage,
        source: row.source,
        notes: row.notes,
        converted_customer_id: row.converted_customer_id,
        last_interaction_at: row.last_interaction_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assigned_to: row.assigned_user_id && row.assigned_user_name
            ? { id: row.assigned_user_id, name: row.assigned_user_name }
            : null,
    };
}

function getScopedAssignedTo(req: Request, requestedAssignedTo?: string): string | undefined {
    if (!req.user) {
        return undefined;
    }

    if (req.user.role === 'ATENDENTE') {
        return req.user.id;
    }

    return requestedAssignedTo;
}

function assertCanAccessAssignedRecord(req: Request, ownerId: string | null): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ADMIN') {
        return;
    }

    if (!ownerId || ownerId !== req.user.id) {
        throw AppError.forbidden('Acesso não autorizado para este lead.');
    }
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'leads-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listLeadsSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const { stage, q, page, limit } = parsed.data;
            const scopedAssignedTo = getScopedAssignedTo(req, parsed.data.assigned_to);
            const filters: string[] = [];
            const values: unknown[] = [];

            if (stage) {
                values.push(stage);
                filters.push(`l.stage = $${values.length}`);
            }

            if (scopedAssignedTo) {
                values.push(scopedAssignedTo);
                filters.push(`l.assigned_to = $${values.length}`);
            }

            if (q) {
                values.push(`%${q}%`);
                const searchIndex = values.length;
                filters.push(`(COALESCE(l.name, '') ILIKE $${searchIndex} OR l.whatsapp_number ILIKE $${searchIndex} OR COALESCE(l.email, '') ILIKE $${searchIndex})`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
         FROM leads l
         ${whereClause}`,
                values
            );

            values.push(limit);
            values.push((page - 1) * limit);
            const limitIndex = values.length - 1;
            const offsetIndex = values.length;

            const result = await query<LeadRow>(
                `SELECT
            l.id,
            l.name,
            l.whatsapp_number,
            l.email,
            l.stage,
            l.source,
            l.notes,
            l.converted_customer_id,
            l.last_interaction_at,
            l.created_at,
            l.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
          FROM leads l
          LEFT JOIN users u ON u.id = l.assigned_to
          ${whereClause}
          ORDER BY l.updated_at DESC, l.created_at DESC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapLead),
                meta: {
                    total,
                    page,
                    limit,
                    pages: Math.max(1, Math.ceil(total / limit)),
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
            const result = await query<LeadRow>(
                `SELECT
            l.id,
            l.name,
            l.whatsapp_number,
            l.email,
            l.stage,
            l.source,
            l.notes,
            l.converted_customer_id,
            l.last_interaction_at,
            l.created_at,
            l.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
          FROM leads l
          LEFT JOIN users u ON u.id = l.assigned_to
          WHERE l.id = $1
          LIMIT 1`,
                [req.params['id']]
            );

            const lead = result.rows[0];
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            assertCanAccessAssignedRecord(req, lead.assigned_user_id);
            res.json(mapLead(lead));
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'leads-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createLeadSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const assignedTo = getScopedAssignedTo(req, parsed.data.assigned_to) ?? null;
            const duplicate = await query<LeadRow>(
                `SELECT
            l.id,
            l.name,
            l.whatsapp_number,
            l.email,
            l.stage,
            l.source,
            l.notes,
            l.converted_customer_id,
            l.last_interaction_at,
            l.created_at,
            l.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
          FROM leads l
          LEFT JOIN users u ON u.id = l.assigned_to
          WHERE l.whatsapp_number = $1
          LIMIT 1`,
                [parsed.data.whatsapp_number]
            );

            if (duplicate.rows[0]) {
                res.status(200).json({
                    data: mapLead(duplicate.rows[0]),
                    duplicate_prevented: true,
                });
                return;
            }

            const insertResult = await query<LeadRow>(
                `INSERT INTO leads (whatsapp_number, name, email, stage, assigned_to, source, notes, last_interaction_at)
         VALUES ($1, $2, $3, 'NOVO', $4, $5, $6, NOW())
         RETURNING id, name, whatsapp_number, email, stage, source, notes, converted_customer_id, last_interaction_at, created_at, updated_at`,
                [
                    parsed.data.whatsapp_number,
                    parsed.data.name ?? null,
                    parsed.data.email ?? null,
                    assignedTo,
                    parsed.data.source,
                    parsed.data.notes ?? null,
                ]
            );

            const createdLead = insertResult.rows[0];
            if (!createdLead) {
                throw AppError.internal(req.requestId);
            }

            const hydratedResult = await query<LeadRow>(
                `SELECT
            l.id,
            l.name,
            l.whatsapp_number,
            l.email,
            l.stage,
            l.source,
            l.notes,
            l.converted_customer_id,
            l.last_interaction_at,
            l.created_at,
            l.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
          FROM leads l
          LEFT JOIN users u ON u.id = l.assigned_to
          WHERE l.id = $1
          LIMIT 1`,
                [createdLead.id]
            );

            const hydratedLead = hydratedResult.rows[0] ?? {
                ...createdLead,
                assigned_user_id: null,
                assigned_user_name: null,
            };

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'leads',
                    entityId: hydratedLead.id,
                    oldValue: null,
                    newValue: {
                        whatsapp_number: hydratedLead.whatsapp_number,
                        name: hydratedLead.name,
                        stage: hydratedLead.stage,
                    },
                    req,
                });
            }

            res.status(201).json({
                data: mapLead(hydratedLead),
                duplicate_prevented: false,
            });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id/stage',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'leads-stage' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = updateLeadStageSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const currentResult = await query<LeadRow>(
                `SELECT
            l.id,
            l.name,
            l.whatsapp_number,
            l.email,
            l.stage,
            l.source,
            l.notes,
            l.converted_customer_id,
            l.last_interaction_at,
            l.created_at,
            l.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
          FROM leads l
          LEFT JOIN users u ON u.id = l.assigned_to
          WHERE l.id = $1
          LIMIT 1`,
                [req.params['id']]
            );

            const currentLead = currentResult.rows[0];
            if (!currentLead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            assertCanAccessAssignedRecord(req, currentLead.assigned_user_id);

            const updatedResult = await query<LeadRow>(
                `UPDATE leads
         SET stage = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, whatsapp_number, email, stage, source, notes, converted_customer_id, last_interaction_at, created_at, updated_at`,
                [parsed.data.stage, currentLead.id]
            );

            const updatedLeadBase = updatedResult.rows[0];
            if (!updatedLeadBase) {
                throw AppError.internal(req.requestId);
            }

            const updatedLead: LeadRow = {
                ...updatedLeadBase,
                assigned_user_id: currentLead.assigned_user_id,
                assigned_user_name: currentLead.assigned_user_name,
            };

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_STAGE',
                    entityType: 'leads',
                    entityId: currentLead.id,
                    oldValue: { stage: currentLead.stage },
                    newValue: { stage: updatedLead.stage },
                    req,
                });
            }

            res.json({ data: mapLead(updatedLead) });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/:id/convert',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'leads-convert' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadParam = req.params['id'];
            const leadId = Array.isArray(leadParam) ? leadParam[0] : leadParam;
            if (!leadId) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            const result = await transaction(async (client) => {
                const leadResult = await client.query<{
                    id: string;
                    name: string | null;
                    whatsapp_number: string;
                    email: string | null;
                    stage: LeadStage;
                    assigned_to: string | null;
                    converted_customer_id: string | null;
                }>(
                    `SELECT id, name, whatsapp_number, email, stage, assigned_to, converted_customer_id
           FROM leads
           WHERE id = $1
           LIMIT 1`,
                    [leadId]
                );

                const lead = leadResult.rows[0];
                if (!lead) {
                    throw AppError.notFound('Lead não encontrado.');
                }

                assertCanAccessAssignedRecord(req, lead.assigned_to);

                if (lead.converted_customer_id) {
                    const existingCustomerResult = await client.query<{
                        id: string;
                        name: string;
                        whatsapp_number: string;
                        email: string | null;
                        assigned_to: string | null;
                        lifetime_value_cents: string;
                        created_at: Date;
                        updated_at: Date;
                    }>(
                        `SELECT id, name, whatsapp_number, email, assigned_to, lifetime_value_cents::text, created_at, updated_at
             FROM customers
             WHERE id = $1
             LIMIT 1`,
                        [lead.converted_customer_id]
                    );

                    return {
                        statusCode: 200,
                        customer: existingCustomerResult.rows[0] ?? null,
                    };
                }

                if (!lead.name) {
                    throw AppError.badRequest('O lead precisa ter nome antes de ser convertido em cliente.');
                }

                const existingCustomer = await client.query<{
                    id: string;
                    name: string;
                    whatsapp_number: string;
                    email: string | null;
                    assigned_to: string | null;
                    lifetime_value_cents: string;
                    created_at: Date;
                    updated_at: Date;
                }>(
                    `SELECT id, name, whatsapp_number, email, assigned_to, lifetime_value_cents::text, created_at, updated_at
             FROM customers
             WHERE whatsapp_number = $1
             LIMIT 1`,
                    [lead.whatsapp_number]
                );

                let customer = existingCustomer.rows[0] ?? null;

                if (!customer) {
                    const customerInsertResult = await client.query<{
                        id: string;
                        name: string;
                        whatsapp_number: string;
                        email: string | null;
                        assigned_to: string | null;
                        lifetime_value_cents: string;
                        created_at: Date;
                        updated_at: Date;
                    }>(
                        `INSERT INTO customers (name, whatsapp_number, email, assigned_to)
               VALUES ($1, $2, $3, $4)
               RETURNING id, name, whatsapp_number, email, assigned_to, lifetime_value_cents::text, created_at, updated_at`,
                        [lead.name, lead.whatsapp_number, lead.email, lead.assigned_to]
                    );
                    customer = customerInsertResult.rows[0] ?? null;
                }

                if (!customer) {
                    throw AppError.internal(req.requestId);
                }

                await client.query(
                    `UPDATE leads
             SET stage = 'CONVERTIDO', converted_customer_id = $1, updated_at = NOW()
             WHERE id = $2`,
                    [customer.id, lead.id]
                );

                return {
                    statusCode: 201,
                    customer,
                };
            });

            if (req.user && result.customer) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CONVERT',
                    entityType: 'leads',
                    entityId: leadId,
                    oldValue: { stage: 'NEGOCIACAO' },
                    newValue: { stage: 'CONVERTIDO', customer_id: result.customer.id },
                    req,
                });
            }

            res.status(result.statusCode).json({ customer: result.customer });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
