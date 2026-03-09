import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import { getAnalyticsSales } from '../services/analytics.service.js';

const router = Router();

const analyticsSalesSchema = z.object({
    periodo: z.enum(['7d', '30d', '90d', '12m', 'custom']).default('30d'),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
});

router.get(
    '/sales',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'analytics-sales' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = analyticsSalesSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos para analytics.'));
                return;
            }

            const payload = await getAnalyticsSales(parsed.data);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
