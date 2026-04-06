import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { appendInboundMessage, upsertConversationFromInbound } from '../services/inbox.service.js';
import { enqueueAppointmentReminderJob } from '../workers/appointmentReminder.worker.js';

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
                  AND UPPER(REPLACE(ps.name, ' ', '_')) = $1
                 WHERE p.slug = 'leads'
                 LIMIT 1`,
                [mappedStage]
            );

            const pipelineId = pipelineResult.rows[0]?.pipeline_id ?? null;
            const stageId = pipelineResult.rows[0]?.stage_id ?? null;

            if (!pipelineId) {
                next(AppError.serviceUnavailable('PIPELINE_NOT_FOUND', 'Pipeline padrão de leads não encontrada.'));
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

// ── Ação 1: GET /webhook/lead-context ────────────────────────────────────────
// Retorna lead + últimas 20 mensagens + próximo agendamento para eliminar
// dependência do staticData do n8n como fonte de histórico.

router.get(
    '/webhook/lead-context',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const rawNumber = String(req.query['whatsapp_number'] ?? '').trim();
            if (!rawNumber) {
                next(AppError.badRequest('whatsapp_number é obrigatório.'));
                return;
            }
            const number = normalizeWhatsapp(rawNumber);

            // Lead
            const leadResult = await query<{
                id: string;
                stage: string;
                notes: string | null;
                name: string | null;
                pipeline_id: string | null;
                stage_id: string | null;
                last_interaction_at: string | null;
            }>(
                `SELECT id, stage, notes, name, pipeline_id, stage_id, last_interaction_at
                 FROM leads
                 WHERE whatsapp_number = $1
                 LIMIT 1`,
                [number]
            );
            const lead = leadResult.rows[0] ?? null;

            // Extrair dados_coletados do campo notes (armazenado como "[bot] {...}")
            let dados_coletados: Record<string, unknown> | null = null;
            if (lead?.notes) {
                const matches = [...lead.notes.matchAll(/\[bot\]\s*(\{.*?\})/gs)];
                if (matches.length > 0) {
                    try {
                        const lastMatchGroup = matches[matches.length - 1]?.[1];
                        if (lastMatchGroup) {
                            dados_coletados = JSON.parse(lastMatchGroup) as Record<string, unknown>;
                        }
                    } catch {
                        // notes malformado — ignorar silenciosamente
                    }
                }
            }

            // Últimas 20 mensagens da conversa mais recente
            const convResult = await query<{ id: string }>(
                `SELECT id FROM conversations
                 WHERE whatsapp_number = $1
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [number]
            );
            const conversationId = convResult.rows[0]?.id ?? null;

            type MessageRow = {
                id: string;
                direction: string;
                type: string;
                content: string | null;
                is_automated: boolean;
                created_at: string;
            };
            const messages: MessageRow[] = [];
            if (conversationId) {
                const msgResult = await query<MessageRow>(
                    `SELECT id, direction, type, content, is_automated, created_at
                     FROM messages
                     WHERE conversation_id = $1
                     ORDER BY created_at DESC
                     LIMIT 20`,
                    [conversationId]
                );
                messages.push(...msgResult.rows.reverse());
            }

            // Próximo agendamento vinculado ao lead
            type AppointmentRow = {
                id: string;
                type: string;
                status: string;
                starts_at: string;
                ends_at: string;
                notes: string | null;
            };
            let next_appointment: AppointmentRow | null = null;
            if (lead?.id) {
                const apptResult = await query<AppointmentRow>(
                    `SELECT id, type, status, starts_at, ends_at, notes
                     FROM appointments
                     WHERE lead_id = $1
                       AND status NOT IN ('CANCELADO', 'CONCLUIDO')
                       AND starts_at > NOW()
                     ORDER BY starts_at ASC
                     LIMIT 1`,
                    [lead.id]
                );
                next_appointment = apptResult.rows[0] ?? null;
            }

            res.json({
                whatsapp_number: number,
                lead: lead
                    ? {
                        id: lead.id,
                        stage: lead.stage,
                        name: lead.name,
                        notes: lead.notes,
                        dados_coletados,
                        pipeline_id: lead.pipeline_id,
                        stage_id: lead.stage_id,
                        last_interaction_at: lead.last_interaction_at,
                    }
                    : null,
                conversation_id: conversationId,
                messages,
                next_appointment,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── Ação 2: GET /webhook/available-slots ─────────────────────────────────────
// Substitui o stub GCal (node A2). Calcula horários livres com base nos
// appointments já cadastrados no CRM para o dia solicitado.

const availableSlotsQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve ser YYYY-MM-DD'),
    period: z.enum(['manha', 'tarde']).optional(),
});

router.get(
    '/webhook/available-slots',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const parsed = availableSlotsQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos: ' + parsed.error.issues[0]?.message));
                return;
            }
            const { date, period } = parsed.data;

            // Determinar horário de funcionamento pelo dia da semana (fuso SP)
            const dayDate = new Date(`${date}T12:00:00-03:00`);
            const dayOfWeek = dayDate.getDay(); // 0=dom … 6=sab

            if (dayOfWeek === 0) {
                res.json({ date, slots: [], message: 'Aos domingos estamos fechados.' });
                return;
            }

            const openHour = 9;
            const closeHour = dayOfWeek === 6 ? 13 : 18;

            // Gerar todos os slots candidatos (45 min de duração, passo de 60 min)
            const allSlots: string[] = [];
            let minutesCursor = openHour * 60;
            while (minutesCursor + 45 <= closeHour * 60) {
                const h = Math.floor(minutesCursor / 60);
                const m = minutesCursor % 60;
                allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                minutesCursor += 60;
            }

            // Buscar appointments do dia que não estejam cancelados
            type BusyRow = { starts_at: string; ends_at: string };
            const busyResult = await query<BusyRow>(
                `SELECT starts_at, ends_at
                 FROM appointments
                 WHERE starts_at >= $1::date
                   AND starts_at <  $1::date + INTERVAL '1 day'
                   AND status NOT IN ('CANCELADO')`,
                [date]
            );

            // Filtrar slots conflitantes
            const available = allSlots.filter(slot => {
                const slotStart = new Date(`${date}T${slot}:00-03:00`);
                const slotEnd = new Date(slotStart.getTime() + 45 * 60_000);
                return !busyResult.rows.some(b => {
                    const bStart = new Date(b.starts_at);
                    const bEnd = new Date(b.ends_at);
                    return slotStart < bEnd && slotEnd > bStart;
                });
            });

            // Filtrar por período
            const filtered = period === 'manha'
                ? available.filter(s => parseInt(s.split(':')[0] ?? '0', 10) < 12)
                : period === 'tarde'
                    ? available.filter(s => parseInt(s.split(':')[0] ?? '0', 10) >= 12)
                    : available;

            res.json({ date, period: period ?? 'all', slots: filtered });
        } catch (error) {
            next(error);
        }
    }
);

// ── Ação 3: POST /webhook/create-appointment ──────────────────────────────────
// Substitui o stub GCal (node A7). Cria o appointment, registra na
// lead_timeline e enfileira o job de reminder 24h antes via BullMQ.

const createAppointmentN8nSchema = z.object({
    whatsapp_number: z.string().trim().min(1).max(80),
    type: z.string().trim().min(1).max(50),
    starts_at: z.string().min(1, 'starts_at obrigatório'),
    ends_at: z.string().min(1, 'ends_at obrigatório'),
    notes: z.string().trim().max(4000).optional().nullable(),
    ai_context: z.record(z.unknown()).optional().nullable(),
});

router.post(
    '/webhook/create-appointment',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await assertN8nAuthorized(req);

            const parsed = createAppointmentN8nSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para create-appointment.'));
                return;
            }
            const { whatsapp_number, type, starts_at, ends_at, notes, ai_context } = parsed.data;
            const number = normalizeWhatsapp(whatsapp_number);

            // Resolver lead_id pelo número
            const leadResult = await query<{ id: string }>(
                `SELECT id FROM leads WHERE whatsapp_number = $1 LIMIT 1`,
                [number]
            );
            const leadId = leadResult.rows[0]?.id ?? null;

            // Criar appointment
            const apptResult = await query<{ id: string }>(
                `INSERT INTO appointments (type, starts_at, ends_at, notes, lead_id, ai_context, source)
                 VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, 'BOT')
                 RETURNING id`,
                [type, starts_at, ends_at, notes ?? null, leadId, ai_context ? JSON.stringify(ai_context) : null]
            );
            const appointmentId = apptResult.rows[0]?.id;
            if (!appointmentId) {
                next(AppError.internal('Falha ao criar agendamento.'));
                return;
            }

            // Registrar na lead_timeline
            if (leadId) {
                const startsAtDate = new Date(starts_at);
                const dateFmt = startsAtDate.toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
                });
                const timeFmt = startsAtDate.toLocaleTimeString('pt-BR', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
                });
                await query(
                    `INSERT INTO lead_timeline (lead_id, type, title, body, metadata)
                     VALUES ($1, 'TASK_CREATED', $2, $3, $4)`,
                    [
                        leadId,
                        `Agendamento criado pelo bot: ${type}`,
                        `📅 ${dateFmt} às ${timeFmt}${notes ? ` — ${notes}` : ''}`,
                        JSON.stringify({ appointment_id: appointmentId, source: 'bot', type }),
                    ]
                );
            }

            // Enfileirar reminder 24h antes (delayMs mínimo de 0 se já passou)
            const startsAtMs = new Date(starts_at).getTime();
            const reminderAt = startsAtMs - 24 * 60 * 60 * 1_000;
            const delayMs = Math.max(0, reminderAt - Date.now());
            await enqueueAppointmentReminderJob({ appointmentId, delayMs });

            logger.info(
                { appointmentId, leadId, whatsappNumber: number, delayMs },
                'n8n create-appointment accepted'
            );

            res.status(201).json({
                accepted: true,
                appointment_id: appointmentId,
                lead_id: leadId,
                reminder_delay_ms: delayMs,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
