import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../lib/errors.js';
import { runAssistant } from '../services/assistant.service.js';

const router = Router();

const assistantChatSchema = z.object({
    message: z.string().trim().min(1).max(4000),
});

router.post(
    '/chat',
    authenticate,
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'assistant-chat' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                next(AppError.unauthorized());
                return;
            }

            const parsed = assistantChatSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Mensagem inválida para o assistente.'));
                return;
            }

            const result = await runAssistant({
                userId: req.user.id,
                role: req.user.role,
                message: parsed.data.message,
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
