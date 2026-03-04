import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { appendInboundMessage, upsertConversationFromInbound } from '../services/inbox.service.js';

const router = Router();

const orderStatusSchema = z.object({
    order_id: z.string().uuid(),
    status: z.enum(['SEPARANDO', 'ENVIADO', 'RETIRADO', 'CANCELADO']),
    note: z.string().trim().max(1000).optional(),
});

const newMessageSchema = z.object({
    whatsapp_number: z.string().trim().min(8).max(25),
    content: z.string().trim().min(1).max(4096),
    profile_name: z.string().trim().max(255).optional(),
    external_message_id: z.string().trim().min(4).max(255).optional(),
});

function assertN8nAuthorized(req: Request): void {
    const apiKey = env().N8N_API_KEY;

    if (!apiKey) {
        throw AppError.serviceUnavailable(
            'N8N_NOT_CONFIGURED',
            'Integração n8n indisponível neste ambiente.'
        );
    }

    const header = req.headers.authorization;
    if (!header || header !== `Bearer ${apiKey}`) {
        throw AppError.unauthorized('Token interno do n8n inválido.');
    }
}

function normalizeWhatsapp(input: string): string {
    const trimmed = input.trim();

    if (trimmed.startsWith('+')) {
        return `+${trimmed.slice(1).replace(/\D/g, '')}`;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 11) {
        return `+55${digits}`;
    }

    return `+${digits}`;
}

router.post(
    '/webhook/new-message',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            assertN8nAuthorized(req);

            const parsed = newMessageSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para o webhook interno de mensagem.'));
                return;
            }

            const inbound = {
                meta_message_id: parsed.data.external_message_id ?? `n8n-${Date.now()}`,
                whatsapp_number: normalizeWhatsapp(parsed.data.whatsapp_number),
                type: 'TEXT' as const,
                content: parsed.data.content,
                media_url: null,
                profile_name: parsed.data.profile_name ?? parsed.data.whatsapp_number,
                received_at: new Date().toISOString(),
            };

            const conversation = await upsertConversationFromInbound(inbound);
            const message = await appendInboundMessage({
                conversationId: conversation.id,
                metaMessageId: inbound.meta_message_id,
                type: 'TEXT',
                content: inbound.content,
                mediaUrl: null,
                isAutomated: true,
            });

            res.status(202).json({
                accepted: true,
                conversation_id: conversation.id,
                message_id: message?.id ?? null,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/webhook/order-status',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            assertN8nAuthorized(req);

            const parsed = orderStatusSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para o webhook interno de status.'));
                return;
            }

            const current = await query<{ id: string; status: string; notes: string | null }>(
                `SELECT id, status, notes
                 FROM orders
                 WHERE id = $1
                 LIMIT 1`,
                [parsed.data.order_id]
            );

            const order = current.rows[0];
            if (!order) {
                next(AppError.notFound('Pedido não encontrado para automação interna.'));
                return;
            }

            if (order.status === parsed.data.status) {
                res.json({
                    accepted: true,
                    order_id: order.id,
                    status: order.status,
                    idempotent: true,
                });
                return;
            }

            const updated = await query<{ id: string; status: string }>(
                `UPDATE orders
                 SET
                   status = $2::order_status,
                   notes = CASE
                     WHEN $3::text IS NULL OR $3::text = '' THEN notes
                     WHEN notes IS NULL OR notes = '' THEN $3
                     ELSE notes || E'\\n\\n[n8n] ' || $3
                   END,
                   updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, status`,
                [parsed.data.order_id, parsed.data.status, parsed.data.note ?? null]
            );

            logger.info({
                orderId: parsed.data.order_id,
                status: parsed.data.status,
                requestId: req.requestId,
            }, 'n8n internal order status accepted');

            res.json({
                accepted: true,
                order_id: updated.rows[0]?.id ?? parsed.data.order_id,
                status: updated.rows[0]?.status ?? parsed.data.status,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
