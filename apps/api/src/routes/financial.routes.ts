import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
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

const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Math.min(env().MAX_FILE_SIZE_MB, 5) * 1024 * 1024,
        files: 1,
    },
}).single('file');

const createExpenseSchema = z.object({
    type: z.literal('SAIDA'),
    amount_cents: z.coerce.number().int().positive(),
    description: z.string().trim().min(5).max(2000),
    competence_date: z.string().date(),
    category: z.string().trim().min(2).max(100),
    payment_method: z.enum([
        'PIX',
        'CARTAO_CREDITO',
        'CARTAO_DEBITO',
        'DINHEIRO',
        'TRANSFERENCIA',
        'BOLETO',
        'LINK_PAGAMENTO',
    ]).optional(),
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
    payment_method: z.enum([
        'PIX',
        'CARTAO_CREDITO',
        'CARTAO_DEBITO',
        'DINHEIRO',
        'TRANSFERENCIA',
        'BOLETO',
        'LINK_PAGAMENTO',
    ]).optional().or(z.literal('')),
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
    payment_method: string | null;
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
        payment_method: row.payment_method,
        created_at: row.created_at,
        created_by: {
            id: row.created_by_user_id,
            name: row.created_by_user_name,
        },
    };
}

function runReceiptUpload(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
        receiptUpload(req, res, (err) => {
            if (!err) {
                resolve();
                return;
            }

            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Arquivo excede o limite de 5MB.'));
                    return;
                }

                reject(AppError.badRequest('Upload inválido do comprovante.'));
                return;
            }

            reject(err);
        });
    });
}

function detectReceiptFile(buffer: Buffer): { ext: 'png' | 'jpg' | 'pdf'; mimeType: string } | null {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpgSignature = Buffer.from([0xff, 0xd8, 0xff]);
    const pdfSignature = Buffer.from('%PDF-');

    if (buffer.length >= pngSignature.length && buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
        return { ext: 'png', mimeType: 'image/png' };
    }

    if (buffer.length >= jpgSignature.length && buffer.subarray(0, jpgSignature.length).equals(jpgSignature)) {
        return { ext: 'jpg', mimeType: 'image/jpeg' };
    }

    if (buffer.length >= pdfSignature.length && buffer.subarray(0, pdfSignature.length).equals(pdfSignature)) {
        return { ext: 'pdf', mimeType: 'application/pdf' };
    }

    return null;
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
            fe.payment_method,
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
                    fe.payment_method,
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
                    payment_method,
                    created_by
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
                    payment_method,
                    created_at,
                    $8::uuid AS created_by_user_id,
                    $9::text AS created_by_user_name`,
                [
                    parsed.data.tipo === 'receita' ? 'ENTRADA' : 'SAIDA',
                    parsed.data.valor,
                    parsed.data.categoria.trim().toUpperCase(),
                    parsed.data.descricao,
                    parsed.data.data,
                    parsed.data.comprovante?.trim() || null,
                    parsed.data.payment_method ? parsed.data.payment_method : null,
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
                        payment_method: entry.payment_method,
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

const updateLaunchSchema = z.object({
    tipo: z.enum(['receita', 'despesa']),
    valor: z.coerce.number().int().positive(),
    descricao: z.string().trim().min(5).max(2000),
    data: z.string().date(),
    categoria: z.string().trim().min(2).max(100),
    payment_method: z.enum([
        'PIX',
        'CARTAO_CREDITO',
        'CARTAO_DEBITO',
        'DINHEIRO',
        'TRANSFERENCIA',
        'BOLETO',
        'LINK_PAGAMENTO',
    ]).optional().or(z.literal('')),
});

router.put(
    '/lancamentos/:id',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'financial-launches-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const paramsParsed = financialParamsSchema.safeParse(req.params);
            if (!paramsParsed.success) {
                next(AppError.badRequest('Lançamento inválido.'));
                return;
            }

            const parsed = updateLaunchSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do lançamento.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const existing = await fetchFinancialEntry(paramsParsed.data.id);
            if (!existing) {
                next(AppError.notFound('Lançamento financeiro não encontrado.'));
                return;
            }

            const result = await query<FinancialEntryRow>(
                `UPDATE financial_entries
                 SET type = $1,
                     amount_cents = $2,
                     category = $3,
                     description = $4,
                     competence_date = $5,
                     payment_method = $6
                 WHERE id = $7
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
                    payment_method,
                    created_at,
                    created_by AS created_by_user_id,
                    (SELECT name FROM users WHERE id = financial_entries.created_by) AS created_by_user_name`,
                [
                    parsed.data.tipo === 'receita' ? 'ENTRADA' : 'SAIDA',
                    parsed.data.valor,
                    parsed.data.categoria.trim().toUpperCase(),
                    parsed.data.descricao,
                    parsed.data.data,
                    parsed.data.payment_method ? parsed.data.payment_method : null,
                    paramsParsed.data.id,
                ]
            );

            const updated = result.rows[0];

            if (req.user && updated) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'financial_entries',
                    entityId: updated.id,
                    oldValue: {
                        type: existing.type,
                        amount_cents: existing.amount_cents,
                        category: existing.category,
                        description: existing.description,
                        competence_date: existing.competence_date,
                        payment_method: (existing as FinancialEntryRow).payment_method ?? null,
                    },
                    newValue: {
                        type: updated.type,
                        amount_cents: updated.amount_cents,
                        category: updated.category,
                        description: updated.description,
                        competence_date: updated.competence_date,
                        payment_method: updated.payment_method,
                    },
                    req,
                });
            }

            res.json(mapFinancialEntry(updated as FinancialEntryRow));
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/lancamentos/:id',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'financial-launches-delete' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const paramsParsed = financialParamsSchema.safeParse(req.params);
            if (!paramsParsed.success) {
                next(AppError.badRequest('Lançamento inválido.'));
                return;
            }

            const existing = await fetchFinancialEntry(paramsParsed.data.id);
            if (!existing) {
                next(AppError.notFound('Lançamento financeiro não encontrado.'));
                return;
            }

            // Block deletion of system-generated entries (linked to orders/payments)
            if (existing.order_id || existing.payment_id) {
                next(new AppError(
                    409,
                    'FINANCIAL_ENTRY_LINKED',
                    'Lançamentos vinculados a pedidos ou pagamentos não podem ser excluídos.'
                ));
                return;
            }

            await query('DELETE FROM financial_entries WHERE id = $1', [paramsParsed.data.id]);

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    entityType: 'financial_entries',
                    entityId: paramsParsed.data.id,
                    oldValue: {
                        type: existing.type,
                        amount_cents: existing.amount_cents,
                        category: existing.category,
                        description: existing.description,
                    },
                    newValue: null,
                    req,
                });
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/lancamentos/:id/comprovante',
    authenticate,
    requireRole(['ADMIN', 'FINANCEIRO']),
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'financial-launches-receipt-upload' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await runReceiptUpload(req, res);

            if (!req.file?.buffer) {
                next(AppError.badRequest('Arquivo obrigatório.'));
                return;
            }

            const parsed = financialParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Lançamento inválido para upload do comprovante.'));
                return;
            }

            const entry = await fetchFinancialEntry(parsed.data.id);
            if (!entry) {
                next(AppError.notFound('Lançamento financeiro não encontrado.'));
                return;
            }

            const fileInfo = detectReceiptFile(req.file.buffer);
            if (!fileInfo) {
                next(AppError.badRequest('Formato inválido. Envie PNG, JPG ou PDF com até 5MB.'));
                return;
            }

            const safeBaseName = path.parse(req.file.originalname || 'comprovante')
                .name
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .slice(0, 80) || 'comprovante';
            const filename = `${Date.now()}-${safeBaseName}.${fileInfo.ext}`;
            const dir = path.join(env().UPLOAD_PATH, 'financeiro', entry.id);
            const diskPath = path.join(dir, filename);
            const publicPath = `/uploads/financeiro/${entry.id}/${filename}`;

            await mkdir(dir, { recursive: true });
            await writeFile(diskPath, req.file.buffer);

            await query(
                `UPDATE financial_entries
                 SET receipt_url = $1
                 WHERE id = $2`,
                [publicPath, entry.id]
            );

            const updated = await fetchFinancialEntry(entry.id);

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPLOAD',
                    entityType: 'financial_entries',
                    entityId: entry.id,
                    oldValue: {
                        receipt_url: entry.receipt_url,
                    },
                    newValue: {
                        receipt_url: publicPath,
                        mime_type: fileInfo.mimeType,
                        file_size: req.file.size,
                    },
                    req,
                });
            }

            res.status(201).json({
                receipt_url: publicPath,
                entry: updated ? mapFinancialEntry(updated) : mapFinancialEntry({ ...entry, receipt_url: publicPath }),
            });
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
                    payment_method,
                    created_by
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
                    payment_method,
                    created_at,
                    $8::uuid AS created_by_user_id,
                    $9::text AS created_by_user_name`,
                [
                    data.type,
                    data.amount_cents,
                    data.category.toUpperCase(),
                    data.description,
                    data.competence_date,
                    data.receipt_url ?? null,
                    data.payment_method ?? null,
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
