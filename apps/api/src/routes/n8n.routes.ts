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
    channel: z.enum(['whatsapp', 'instagram', 'telegram', 'tiktok', 'messenger']).default('whatsapp'),
    whatsapp_number: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1).max(4096),
    type: z.string().optional(),
    profile_name: z.string().trim().max(255).optional(),
    meta_message_id: z.string().trim().max(255).optional(),
    external_message_id: z.string().trim().min(4).max(255).optional(),
    external_conversation_id: z.string().trim().min(2).max(255).optional(),
    contact_handle: z.string().trim().max(100).optional(),
});

const botReplySchema = z.object({
    whatsapp_number: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1).max(4096),
    classificacao: z.string().trim().max(50).optional(),
});

const updateLeadSchema = z.object({
    whatsapp_number: z.string().trim().min(1).max(80),
    stage: z.string().trim().max(50),
    interest: z.string().trim().max(100).optional(),
    dados_coletados: z.record(z.unknown()).optional(),
});

const handoffSchema = z.object({
    whatsapp_number: z.string().trim().min(1).max(80),
    reason: z.string().trim().max(100).optional(),
    resumo_ia: z.string().trim().max(4096).optional(),
});

async function assertN8nAuthorized(req: Request): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        throw AppError.unauthorized('Token interno do n8n inválido.');
    }
    const provided = header.slice(7);

    // Check new webhook_keys table first
    const keysResult = await query<{ key_value: string }>(
        'SELECT key_value FROM webhook_keys WHERE revoked_at IS NULL'
    );
    if (keysResult.rows.some(r => r.key_value === provided)) {
        // Update last_used_at asynchronously (fire-and-forget)
        void query('UPDATE webhook_keys SET last_used_at = NOW() WHERE key_value = $1', [provided]);
        return;
    }

    // Legacy: settings.internal_webhook_key (backward compat)
    const settingsResult = await query<{ internal_webhook_key: string | null }>(
        'SELECT internal_webhook_key FROM settings LIMIT 1'
    );
    const legacyKey = settingsResult.rows[0]?.internal_webhook_key;
    if (legacyKey && provided === legacyKey) return;

    // Fallback: env var (legacy / env-only deployments)
    const envKey = env().N8N_API_KEY;
    if (envKey && provided === envKey) return;

    if (keysResult.rows.length === 0 && !legacyKey && !envKey) {
        throw AppError.serviceUnavailable(
            'N8N_NOT_CONFIGURED',
            'Nenhuma chave de webhook configurada. Gere uma chave em Ajustes → Integrações.'
        );
    }

    throw AppError.unauthorized('Token interno do n8n inválido.');
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

function normalizeChannelContact(
    channel: 'whatsapp' | 'instagram' | 'telegram' | 'tiktok' | 'messenger',
    input: string
): string {
    if (channel === 'whatsapp') {
        return normalizeWhatsapp(input);
    }

    return input.trim();
}

router.post(
    '/webhook/new-message',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const parsed = newMessageSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para o webhook interno de mensagem.'));
                return;
            }

            const inbound = {
                meta_message_id: parsed.data.meta_message_id ?? parsed.data.external_message_id ?? `n8n-${Date.now()}`,
                channel: parsed.data.channel,
                external_conversation_id: parsed.data.external_conversation_id
                    ?? normalizeChannelContact(parsed.data.channel, parsed.data.whatsapp_number),
                whatsapp_number: normalizeChannelContact(parsed.data.channel, parsed.data.whatsapp_number),
                contact_phone: parsed.data.channel === 'whatsapp'
                    ? normalizeWhatsapp(parsed.data.whatsapp_number)
                    : null,
                contact_handle: parsed.data.contact_handle ?? null,
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
            await assertN8nAuthorized(req);

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

// Mapeamento de stages enviados pelo bot para valores válidos do enum
const STAGE_MAP: Record<string, string> = {
    CURIOSO: 'NOVO',
    QUALIFICADO: 'QUALIFICADO',
    PROPOSTA_ENVIADA: 'PROPOSTA_ENVIADA',
    NEGOCIACAO: 'NEGOCIACAO',
    CONVERTIDO: 'CONVERTIDO',
    PERDIDO: 'PERDIDO',
};

router.get(
    '/webhook/conversation-status',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const rawNumber = String(req.query['whatsapp_number'] ?? '').trim();
            if (!rawNumber) {
                next(AppError.badRequest('whatsapp_number é obrigatório.'));
                return;
            }

            const number = normalizeWhatsapp(rawNumber);

            const convResult = await query<{
                id: string;
                status: string;
                lead_id: string | null;
            }>(
                `SELECT id, status, lead_id
                 FROM conversations
                 WHERE whatsapp_number = $1
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [number]
            );

            const conversation = convResult.rows[0];

            if (!conversation) {
                res.json({
                    whatsapp_number: number,
                    status: 'BOT',
                    message_count: 0,
                    conversation_id: null,
                    lead_id: null,
                });
                return;
            }

            const countResult = await query<{ count: string }>(
                `SELECT COUNT(*) AS count FROM messages WHERE conversation_id = $1`,
                [conversation.id]
            );

            res.json({
                whatsapp_number: number,
                status: conversation.status,
                message_count: parseInt(countResult.rows[0]?.count ?? '0', 10),
                conversation_id: conversation.id,
                lead_id: conversation.lead_id,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/webhook/bot-reply',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const parsed = botReplySchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para bot-reply.'));
                return;
            }

            const number = normalizeWhatsapp(parsed.data.whatsapp_number);

            const convResult = await query<{ id: string }>(
                `SELECT id FROM conversations WHERE whatsapp_number = $1 ORDER BY created_at DESC LIMIT 1`,
                [number]
            );

            const conversation = convResult.rows[0];
            if (!conversation) {
                res.status(202).json({ accepted: true, message_id: null, note: 'conversa não encontrada' });
                return;
            }

            const msgResult = await query<{ id: string }>(
                `INSERT INTO messages (conversation_id, direction, type, content, is_automated, status)
                 VALUES ($1, 'OUTBOUND', 'TEXT', $2, true, 'SENT')
                 RETURNING id`,
                [conversation.id, parsed.data.content]
            );

            await query(
                `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [conversation.id]
            );

            logger.info({ conversationId: conversation.id, classificacao: parsed.data.classificacao }, 'n8n bot-reply registered');

            res.status(202).json({ accepted: true, message_id: msgResult.rows[0]?.id ?? null });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/webhook/update-lead',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const parsed = updateLeadSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para update-lead.'));
                return;
            }

            const number = normalizeWhatsapp(parsed.data.whatsapp_number);
            const mappedStage = STAGE_MAP[parsed.data.stage] ?? 'NOVO';
            const notesAppend = parsed.data.dados_coletados
                ? `[bot] ${JSON.stringify(parsed.data.dados_coletados)}`
                : null;

            // Buscar pipeline 'leads' padrão e o stage_id correspondente
            const pipelineResult = await query<{ pipeline_id: string; stage_id: string | null }>(
                `SELECT p.id AS pipeline_id, ps.id AS stage_id
                 FROM pipelines p
                 LEFT JOIN pipeline_stages ps
                   ON ps.pipeline_id = p.id
                  AND UPPER(REPLACE(ps.name, ' ', '_')) = $2
                 WHERE p.slug = 'leads'
                 LIMIT 1`,
                ['leads', mappedStage]
            );

            const pipelineId = pipelineResult.rows[0]?.pipeline_id ?? null;
            const stageId = pipelineResult.rows[0]?.stage_id ?? null;

            if (!pipelineId) {
                next(AppError.internal('Pipeline padrão de leads não encontrada.'));
                return;
            }

            const result = await query<{ id: string; stage: string }>(
                `INSERT INTO leads (whatsapp_number, stage, pipeline_id, stage_id, notes, last_interaction_at)
                 VALUES ($1, $2::lead_stage, $3, $4, $5, NOW())
                 ON CONFLICT (whatsapp_number) DO UPDATE
                   SET stage = EXCLUDED.stage,
                       stage_id = EXCLUDED.stage_id,
                       notes = CASE
                         WHEN $5 IS NULL THEN leads.notes
                         WHEN leads.notes IS NULL THEN $5
                         ELSE leads.notes || E'\\n' || $5
                       END,
                       last_interaction_at = NOW(),
                       updated_at = NOW()
                 RETURNING id, stage`,
                [number, mappedStage, pipelineId, stageId, notesAppend]
            );

            logger.info({ whatsappNumber: number, stage: mappedStage, pipelineId, stageId }, 'n8n update-lead accepted');

            res.status(202).json({
                accepted: true,
                lead_id: result.rows[0]?.id ?? null,
                stage: result.rows[0]?.stage ?? mappedStage,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/webhook/handoff',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const parsed = handoffSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para handoff.'));
                return;
            }

            const number = normalizeWhatsapp(parsed.data.whatsapp_number);
            const resumo = parsed.data.resumo_ia ?? null;

            const convResult = await query<{ id: string }>(
                `UPDATE conversations
                 SET status = 'AGUARDANDO_HUMANO', updated_at = NOW()
                 WHERE whatsapp_number = $1
                   AND status = 'BOT'
                 RETURNING id`,
                [number]
            );

            if (resumo && convResult.rows[0]) {
                await query(
                    `UPDATE leads
                     SET notes = CASE WHEN notes IS NULL THEN $2 ELSE notes || E'\\n[handoff] ' || $2 END,
                         last_interaction_at = NOW(), updated_at = NOW()
                     WHERE whatsapp_number = $1`,
                    [number, resumo]
                );
            }

            logger.info({
                whatsappNumber: number,
                reason: parsed.data.reason,
                conversationId: convResult.rows[0]?.id,
            }, 'n8n handoff accepted');

            res.status(202).json({
                accepted: true,
                conversation_id: convResult.rows[0]?.id ?? null,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
