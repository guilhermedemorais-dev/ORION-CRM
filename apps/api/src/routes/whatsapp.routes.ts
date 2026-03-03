import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import {
    assertMetaConfigured,
    getMetaWebhookVerifyToken,
    verifyMetaSignature,
} from '../services/meta-whatsapp.service.js';
import { enqueueWhatsAppWebhookJob } from '../workers/whatsappWebhook.worker.js';

const router = Router();

router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            assertMetaConfigured();

            const verifyToken = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (verifyToken !== getMetaWebhookVerifyToken() || typeof challenge !== 'string') {
                next(AppError.forbidden('Token de verificação inválido.'));
                return;
            }

            res.type('text/plain').send(challenge);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            assertMetaConfigured();

            const signatureHeader = req.header('X-Hub-Signature-256');

            if (!signatureHeader || !req.rawBody || !verifyMetaSignature(req.rawBody, signatureHeader)) {
                next(AppError.unauthorized('Assinatura do webhook do WhatsApp inválida.'));
                return;
            }

            await enqueueWhatsAppWebhookJob({
                rawEvent: (req.body ?? {}) as Record<string, unknown>,
                receivedAt: new Date().toISOString(),
                requestId: req.requestId,
            });

            logger.info(
                {
                    requestId: req.requestId,
                },
                'WhatsApp webhook accepted'
            );

            res.status(200).json({
                status: 'received',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
