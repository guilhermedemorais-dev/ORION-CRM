import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
    captureSystemError,
    clearSystemErrors,
    listSystemErrors,
} from '../services/systemErrors.service.js';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from '../middleware/audit.js';
import { query } from '../db/pool.js';

const router = Router();

const exportErrorsSchema = z.object({
    mode: z.enum(['all', 'selected']),
    errorIds: z.array(z.string().uuid()).max(1000).optional(),
    source: z.enum(['api', 'web', 'worker']).optional(),
    search: z.string().max(500).optional(),
}).superRefine((value, ctx) => {
    if (value.mode === 'selected' && (!value.errorIds || value.errorIds.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['errorIds'],
            message: 'Selecione ao menos um erro para exportar.',
        });
    }
});

interface ExportErrorRow {
    id: string;
    occurred_at: string;
    source: string;
    severity: string;
    request_id: string | null;
    user_id: string | null;
    method: string | null;
    path: string | null;
    status_code: number | null;
    message: string;
    stack: string | null;
    context: Record<string, unknown> | null;
}

function markdownCode(value: string): string {
    return value.replace(/```/g, '``\\`');
}

function formatErrorMarkdown(rows: ExportErrorRow[]): string {
    const lines: string[] = [
        '# Erros exportados do Debug ao vivo',
        '',
        `Exportado em: ${new Date().toISOString()}`,
        `Total de erros: ${rows.length}`,
        '',
    ];

    for (const row of rows) {
        const route = [row.method, row.path].filter(Boolean).join(' ');
        lines.push(
            `## ${row.message.split('\n')[0]?.slice(0, 180) || 'Erro sem mensagem'}`,
            '',
            `- ID: ${row.id}`,
            `- Origem: ${row.source}`,
            `- Severidade: ${row.severity}`,
            `- Ocorrido em: ${row.occurred_at}`,
            `- Status HTTP: ${row.status_code ?? 'N/A'}`,
            `- Rota: ${route || 'N/A'}`,
            `- Request ID: ${row.request_id ?? 'N/A'}`,
            `- User ID: ${row.user_id ?? 'N/A'}`,
            '',
            '### Mensagem',
            '',
            '```text',
            markdownCode(row.message),
            '```',
            '',
        );

        if (row.stack) {
            lines.push(
                '### Stack',
                '',
                '```text',
                markdownCode(row.stack),
                '```',
                '',
            );
        }

        if (row.context && Object.keys(row.context).length > 0) {
            lines.push(
                '### Contexto',
                '',
                '```json',
                markdownCode(JSON.stringify(row.context, null, 2)),
                '```',
                '',
            );
        }
    }

    return `${lines.join('\n')}\n`;
}

// ── GET /system/errors ─────────────────────────────────────────────────────────
router.get(
    '/',
    authenticate,
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const limit = req.query['limit'] ? Number(req.query['limit']) : 100;
            const sinceId = typeof req.query['sinceId'] === 'string' ? req.query['sinceId'] : null;
            const source = typeof req.query['source'] === 'string' ? req.query['source'] : null;
            const search = typeof req.query['search'] === 'string' ? req.query['search'] : null;

            const rows = await listSystemErrors({ limit, sinceId, source, search });
            res.json({ data: rows });
        } catch (err) {
            next(err);
        }
    }
);

// ── DELETE /system/errors ──────────────────────────────────────────────────────
router.delete(
    '/',
    authenticate,
    requireRole(['ROOT']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const deleted = await clearSystemErrors();
            res.json({ deleted });
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /system/errors/export ────────────────────────────────────────────────
router.post(
    '/export',
    authenticate,
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = exportErrorsSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parametros de exportacao invalidos.',
                    parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            const { mode, errorIds, source, search } = parsed.data;
            const rows = mode === 'selected'
                ? query<ExportErrorRow>(
                    `SELECT id, occurred_at, source, severity, request_id, user_id, method, path,
                            status_code, message, stack, context
                       FROM system_errors
                      WHERE id = ANY($1::uuid[])
                      ORDER BY occurred_at DESC`,
                    [errorIds]
                )
                : Promise.resolve({ rows: await listSystemErrors({ limit: 2000, source: source ?? null, search: search ?? null }) });

            const result = await rows;
            if (result.rows.length === 0) {
                next(AppError.notFound('Nenhum erro encontrado para exportacao.'));
                return;
            }

            await createAuditLog({
                userId: req.user!.id,
                action: 'EXPORT_SYSTEM_ERRORS',
                entityType: 'system_errors',
                entityId: null,
                oldValue: null,
                newValue: {
                    mode,
                    source: source ?? null,
                    search: search ?? null,
                    error_count: result.rows.length,
                    error_ids: result.rows.map(row => row.id),
                },
                req,
            });

            const stamp = new Date().toISOString().slice(0, 10);
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="orion-debug-errors-${stamp}.md"`);
            res.send(formatErrorMarkdown(result.rows));
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /system/errors/report (web client error capture) ─────────────────────
const reportSchema = z.object({
    message: z.string().min(1).max(4000),
    stack: z.string().max(16000).optional().nullable(),
    path: z.string().max(500).optional().nullable(),
    userAgent: z.string().max(500).optional().nullable(),
    statusCode: z.number().int().optional().nullable(),
    method: z.string().max(10).optional().nullable(),
    severity: z.enum(['error', 'fatal', 'warn']).optional(),
});

router.post(
    '/report',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = reportSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido.'));
                return;
            }
            await captureSystemError({
                source: 'web',
                severity: parsed.data.severity ?? 'error',
                requestId: req.requestId,
                userId: req.user?.id ?? null,
                method: parsed.data.method ?? null,
                path: parsed.data.path ?? null,
                statusCode: parsed.data.statusCode ?? null,
                message: parsed.data.message,
                stack: parsed.data.stack ?? null,
                context: { userAgent: parsed.data.userAgent ?? null },
            });
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    }
);

export default router;
