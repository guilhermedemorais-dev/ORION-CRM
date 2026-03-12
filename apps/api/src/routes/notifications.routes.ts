import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const updatePreferencesSchema = z.object({
    notify_new_lead_whatsapp: z.boolean().optional(),
    notify_order_paid: z.boolean().optional(),
    notify_production_delayed: z.boolean().optional(),
    notify_low_stock: z.boolean().optional(),
    notify_lead_inactive: z.boolean().optional(),
    notify_goal_reached: z.boolean().optional(),
    quiet_hours_enabled: z.boolean().optional(),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

async function ensurePreferences(userId: string) {
    const result = await query(
        `SELECT *
         FROM user_notification_preferences
         WHERE user_id = $1`,
        [userId]
    );
    if (result.rows[0]) {
        return result.rows[0];
    }

    const insert = await query(
        `INSERT INTO user_notification_preferences (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
    );
    return insert.rows[0];
}

router.get(
    '/preferences',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.query['user_id'] ? String(req.query['user_id']) : req.user?.id;
            if (!userId) {
                throw AppError.unauthorized();
            }

            if (req.query['user_id'] && req.user?.role !== 'ADMIN') {
                throw AppError.forbidden('Apenas ADMIN pode acessar preferências de outros usuários.');
            }

            const prefs = await ensurePreferences(userId);
            res.json(prefs);
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/preferences',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.query['user_id'] ? String(req.query['user_id']) : req.user?.id;
            if (!userId) {
                throw AppError.unauthorized();
            }

            if (req.query['user_id'] && req.user?.role !== 'ADMIN') {
                throw AppError.forbidden('Apenas ADMIN pode editar preferências de outros usuários.');
            }

            const parsed = updatePreferencesSchema.safeParse(req.body);
            if (!parsed.success) {
                throw AppError.badRequest('Verifique os campos informados.');
            }

            await ensurePreferences(userId);
            const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
            if (fields.length === 0) {
                throw AppError.badRequest('Nenhum campo para atualizar.');
            }

            const setClauses = fields.map(([key], index) => `${key} = $${index + 2}`);
            setClauses.push('updated_at = NOW()');
            const values = fields.map(([, value]) => value);
            await query(
                `UPDATE user_notification_preferences
                 SET ${setClauses.join(', ')}
                 WHERE user_id = $1`,
                [userId, ...values]
            );

            const updated = await query(
                `SELECT *
                 FROM user_notification_preferences
                 WHERE user_id = $1`,
                [userId]
            );
            res.json(updated.rows[0]);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
