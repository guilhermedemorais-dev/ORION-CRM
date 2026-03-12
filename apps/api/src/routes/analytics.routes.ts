import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import {
    getAnalyticsAgents,
    getAnalyticsLeads,
    getAnalyticsProduction,
    getAnalyticsSales,
    getAnalyticsStore,
} from '../services/analytics.service.js';

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

const analyticsBaseSchema = z.object({
    periodo: z.enum(['7d', '30d', '90d', '12m', 'custom']).default('30d'),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
});

router.get(
    '/leads',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'analytics-leads' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = analyticsBaseSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos para analytics de leads.'));
                return;
            }
            const payload = await getAnalyticsLeads(parsed.data);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/production',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'analytics-production' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = analyticsBaseSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos para analytics de produção.'));
                return;
            }
            const payload = await getAnalyticsProduction(parsed.data);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/store',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'analytics-store' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = analyticsBaseSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos para analytics da loja.'));
                return;
            }
            const payload = await getAnalyticsStore(parsed.data);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/agents',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'analytics-agents' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = analyticsBaseSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos para analytics de atendentes.'));
                return;
            }
            const payload = await getAnalyticsAgents(parsed.data);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
