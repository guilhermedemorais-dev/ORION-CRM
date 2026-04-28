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

const router = Router();

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
