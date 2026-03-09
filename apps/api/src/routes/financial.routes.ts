import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import {
    getFinanceCommissions,
    getFinanceDashboard,
    listFinanceLaunches,
} from '../services/financeiro.service.js';

const router = Router();

const listFinancialSchema = z.object({
    type: z.enum(['ENTRADA', 'SAIDA']).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    date_from: z.string().date().optional(),
    date_to: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const financialParamsSchema = z.object({
    id: z.string().uuid(),
});

const createExpenseSchema = z.object({
    type: z.literal('SAIDA'),
    amount_cents: z.coerce.number().int().positive(),
    description: z.string().trim().min(5).max(2000),
    competence_date: z.string().date(),
    category: z.string().trim().min(2).max(100),
    receipt_url: z.string().trim().url().max(500).optional(),
});

const canonicalPeriodSchema = z.object({
    periodo: z.enum(['7d', 'mes', 'trimestre', 'ano']).default('mes'),
});

const canonicalLaunchesSchema = z.object({
    periodo: z.enum(['7d', 'mes', 'trimestre', 'ano']).default('mes'),
    tipo: z.enum(['todos', 'receitas', 'despesas', 'pendentes']).default('todos'),
    search: z.string().trim().max(120).default(''),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createLaunchSchema = z.object({
    tipo: z.enum(['receita', 'despesa']),
    valor: z.coerce.number().int().positive(),
    descricao: z.string().trim().min(5).max(2000),
    data: z.string().date(),
    categoria: z.string().trim().min(2).max(100),
    comprovante: z.string().trim().url().max(500).optional().or(z.literal('')),
});

interface FinancialEntryRow {
    id: string;
    type: 'ENTRADA' | 'SAIDA';
    amount_cents: number;
    category: string;
    description: string;
    order_id: string | null;
    payment_id: string | null;
    commission_user_id: string | null;
    commission_amount_cents: number | null;
    competence_date: Date;
    created_by_user_id: string;
    created_by_user_name: string;
    receipt_url: string | null;
    created_at: Date;
}

function mapFinancialEntry(row: FinancialEntryRow) {
    return {
        id: row.id,
        type: row.type,
        amount_cents: row.amount_cents,
        category: row.category,
        description: row.description,
        order_id: row.order_id,
        payment_id: row.payment_id,
        commission_user_id: row.commission_user_id,
        commission_amount_cents: row.commission_amount_cents,
        competence_date: row.competence_date,
        receipt_url: row.receipt_url,
        created_at: row.created_at,
        created_by: {
            id: row.created_by_user_id,
            name: row.created_by_user_name,
        },
    };
}

async function fetchFinancialEntry(financialEntryId: string): Promise<FinancialEntryRow | null> {
    const result = await query<FinancialEntryRow>(
        `SELECT
            fe.id,
            fe.type,
            fe.amount_cents,
            fe.category,
            fe.description,
            fe.order_id,
            fe.payment_id,
            fe.commission_user_id,
            fe.commission_amount_cents,
            fe.competence_date,
            fe.receipt_url,
            fe.created_at,
            u.id AS created_by_user_id,
            u.name AS created_by_user_name
         FROM financial_entries fe
         INNER JOIN users u ON u.id = fe.created_by
         WHERE fe.id = $1
         LIMIT 1`,
        [financialEntryId]
    );

    return result.rows[0] ?? null;
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'financial-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listFinancialSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const filters: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.type) {
                values.push(parsed.data.type);
                filters.push(`fe.type = $${values.length}`);
            }

            if (parsed.data.category) {
                values.push(parsed.data.category);
                filters.push(`fe.category = $${values.length}`);
            }

            if (parsed.data.date_from) {
                values.push(parsed.data.date_from);
                filters.push(`fe.competence_date >= $${values.length}`);
            }

            if (parsed.data.date_to) {
                values.push(parsed.data.date_to);
                filters.push(`fe.competence_date <= $${values.length}`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM financial_entries fe
                 ${whereClause}`,
                values
            );

            const summaryResult = await query<{ total_in: string; total_out: string }>(
                `SELECT
                    COALESCE(SUM(CASE WHEN fe.type = 'ENTRADA' THEN fe.amount_cents ELSE 0 END), 0)::text AS total_in,
                    COALESCE(SUM(CASE WHEN fe.type = 'SAIDA' THEN ABS(fe.amount_cents) ELSE 0 END), 0)::text AS total_out
                 FROM financial_entries fe
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<FinancialEntryRow>(
                `SELECT
                    fe.id,
                    fe.type,
                    fe.amount_cents,
                    fe.category,
                    fe.description,
                    fe.order_id,
                    fe.payment_id,
                    fe.commission_user_id,
                    fe.commission_amount_cents,
                    fe.competence_date,
                    fe.receipt_url,
                    fe.created_at,
                    u.id AS created_by_user_id,
                    u.name AS created_by_user_name
                 FROM financial_entries fe
                 INNER JOIN users u ON u.id = fe.created_by
                 ${whereClause}
                 ORDER BY fe.competence_date DESC, fe.created_at DESC
                 LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);
            const totalIn = Number.parseInt(summaryResult.rows[0]?.total_in ?? '0', 10);
            const totalOut = Number.parseInt(summaryResult.rows[0]?.total_out ?? '0', 10);

            res.json({
                data: result.rows.map(mapFinancialEntry),
                meta: {
                    total,
                    page: parsed.data.page,
                    limit: parsed.data.limit,
                    pages: Math.max(1, Math.ceil(total / parsed.data.limit)),
                },
                summary: {
                    total_in_cents: totalIn,
                    total_out_cents: totalOut,
                    balance_cents: totalIn - totalOut,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/dashboard',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'financial-dashboard' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = canonicalPeriodSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Período inválido para o dashboard financeiro.'));
                return;
            }

            const payload = await getFinanceDashboard(parsed.data.periodo);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/comissoes',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'financial-commissions' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = canonicalPeriodSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Período inválido para as comissões.'));
                return;
            }

            const payload = await getFinanceCommissions(parsed.data.periodo);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/lancamentos',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 90, name: 'financial-launches' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = canonicalLaunchesSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos para a consulta financeira.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const payload = await listFinanceLaunches(parsed.data);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/lancamentos',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'financial-launches-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createLaunchSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do lançamento.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const result = await query<FinancialEntryRow>(
                `INSERT INTO financial_entries (
                    type,
                    amount_cents,
                    category,
                    description,
                    competence_date,
                    receipt_url,
                    created_by
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                  RETURNING
                    id,
                    type,
                    amount_cents,
                    category,
                    description,
                    order_id,
                    payment_id,
                    commission_user_id,
                    commission_amount_cents,
                    competence_date,
                    receipt_url,
                    created_at,
                    $7::uuid AS created_by_user_id,
                    $8::text AS created_by_user_name`,
                [
                    parsed.data.tipo === 'receita' ? 'ENTRADA' : 'SAIDA',
                    parsed.data.valor,
                    parsed.data.categoria.trim().toUpperCase(),
                    parsed.data.descricao,
                    parsed.data.data,
                    parsed.data.comprovante?.trim() || null,
                    req.user?.id,
                    req.user?.name,
                ]
            );

            const entry = result.rows[0];

            if (req.user && entry) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'financial_entries',
                    entityId: entry.id,
                    oldValue: null,
                    newValue: {
                        type: entry.type,
                        amount_cents: entry.amount_cents,
                        category: entry.category,
                        receipt_url: entry.receipt_url,
                    },
                    req,
                });
            }

            res.status(201).json(mapFinancialEntry(entry as FinancialEntryRow));
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = financialParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Lançamento inválido.'));
                return;
            }

            const entry = await fetchFinancialEntry(parsed.data.id);
            if (!entry) {
                next(AppError.notFound('Lançamento financeiro não encontrado.'));
                return;
            }

            res.json(mapFinancialEntry(entry));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'financial-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createExpenseSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados da despesa.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const data = parsed.data;

            const result = await query<FinancialEntryRow>(
                `INSERT INTO financial_entries (
                    type,
                    amount_cents,
                    category,
                    description,
                    competence_date,
                    receipt_url,
                    created_by
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                  RETURNING
                    id,
                    type,
                    amount_cents,
                    category,
                    description,
                    order_id,
                    payment_id,
                    commission_user_id,
                    commission_amount_cents,
                    competence_date,
                    receipt_url,
                    created_at,
                    $7::uuid AS created_by_user_id,
                    $8::text AS created_by_user_name`,
                [
                    data.type,
                    data.amount_cents,
                    data.category.toUpperCase(),
                    data.description,
                    data.competence_date,
                    data.receipt_url ?? null,
                    req.user?.id,
                    req.user?.name,
                ]
            );

            const entry = result.rows[0];

            if (req.user && entry) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'financial_entries',
                    entityId: entry.id,
                    oldValue: null,
                    newValue: {
                        type: entry.type,
                        amount_cents: entry.amount_cents,
                        category: entry.category,
                    },
                    req,
                });
            }

            res.status(201).json(mapFinancialEntry(entry as FinancialEntryRow));
        } catch (error) {
            next(error);
        }
    }
);

export default router;
