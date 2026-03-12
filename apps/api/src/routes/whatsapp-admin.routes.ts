import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
    disconnectEvolutionInstance,
    fetchEvolutionQrCode,
    fetchEvolutionStatus,
} from '../services/evolution.service.js';

const router = Router();

router.get(
    '/status',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'whatsapp-status' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const payload = await fetchEvolutionStatus();
            res.json(payload);
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/reconnect',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'whatsapp-reconnect' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const payload = await fetchEvolutionQrCode();
            res.json(payload);
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/disconnect',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 15, name: 'whatsapp-disconnect' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await disconnectEvolutionInstance();
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

export default router;

