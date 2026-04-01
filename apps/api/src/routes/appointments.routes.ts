import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { enqueueAppointmentReminderJob } from '../workers/appointmentReminder.worker.js';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const appointmentTypeSchema = z.enum([
    'VISITA_PRESENCIAL', 'CONSULTA_ONLINE', 'RETORNO', 'ENTREGA', 'OUTRO',
    'Visita Showroom', 'Reunião Online', 'Retirada',
]);

const appointmentStatusSchema = z.enum([
    'AGENDADO', 'CONFIRMADO_CLIENTE', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU',
]);

const createAppointmentSchema = z.object({
    type: z.string().min(1, 'Tipo é obrigatório'),
    starts_at: z.string().min(1, 'Data/hora início obrigatória'),
    ends_at: z.string().min(1, 'Data/hora fim obrigatória'),
    notes: z.string().max(4000).optional().nullable(),
    lead_id: z.string().uuid().optional().nullable(),
    customer_id: z.string().uuid().optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    pipeline_id: z.string().uuid().optional().nullable(),
    contact_name: z.string().max(255).optional().nullable(),
    contact_phone: z.string().max(80).optional().nullable(),
    source: z.string().max(50).default('CRM'),
}).refine(
    (data) => !!data.lead_id || !!data.customer_id || (!!data.contact_name && !!data.contact_phone),
    {
        message: 'Nome e telefone do contato são obrigatórios quando não há lead/cliente vinculado.',
        path: ['contact_phone'],
    }
);

const updateStatusSchema = z.object({
    status: appointmentStatusSchema,
    cancel_reason: z.string().max(500).optional().nullable(),
});

const listQuerySchema = z.object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    lead_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
    status: appointmentStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizePhone(input: string): string {
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

interface AppointmentRow {
    id: string;
    type: string;
    status: string;
    source: string;
    starts_at: string;
    ends_at: string;
    notes: string | null;
    lead_id: string | null;
    lead_name: string | null;
    lead_whatsapp: string | null;
    customer_id: string | null;
    customer_name: string | null;
    customer_whatsapp: string | null;
    assigned_to_id: string | null;
    assigned_to_name: string | null;
    pipeline_id: string | null;
    ai_context: Record<string, unknown> | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    reminder_sent_at: string | null;
    created_at: string;
    updated_at: string;
}

function formatAppointment(row: AppointmentRow) {
    return {
        id: row.id,
        type: row.type,
        status: row.status,
        source: row.source,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        notes: row.notes,
        lead: row.lead_id ? { id: row.lead_id, name: row.lead_name || 'Sem nome', whatsapp_number: row.lead_whatsapp } : null,
        customer: row.customer_id ? { id: row.customer_id, name: row.customer_name || 'Sem nome', whatsapp_number: row.customer_whatsapp } : null,
        assigned_to: row.assigned_to_id ? { id: row.assigned_to_id, name: row.assigned_to_name || '' } : null,
        pipeline_id: row.pipeline_id,
        ai_context: row.ai_context,
        cancelled_at: row.cancelled_at,
        cancel_reason: row.cancel_reason,
        reminder_sent_at: row.reminder_sent_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

const BASE_SELECT = `
    SELECT
        a.id, a.type, a.status, a.source,
        a.starts_at, a.ends_at, a.notes,
        a.lead_id, l.name AS lead_name, l.whatsapp_number AS lead_whatsapp,
        a.customer_id, c.name AS customer_name, c.whatsapp_number AS customer_whatsapp,
        a.assigned_to AS assigned_to_id, u.name AS assigned_to_name,
        a.pipeline_id,
        a.ai_context, a.cancelled_at, a.cancel_reason,
        a.reminder_sent_at, a.created_at, a.updated_at
    FROM appointments a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN users u ON u.id = a.assigned_to
`;

// ── GET /appointments ──────────────────────────────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            throw AppError.badRequest('Parâmetros inválidos.', parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const { start_date, end_date, lead_id, customer_id, status, limit, offset } = parsed.data;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (start_date) {
            conditions.push(`a.starts_at >= $${idx}::timestamptz`);
            params.push(`${start_date}T00:00:00Z`);
            idx++;
        }
        if (end_date) {
            conditions.push(`a.starts_at <= $${idx}::timestamptz`);
            params.push(`${end_date}T23:59:59Z`);
            idx++;
        }
        if (lead_id) {
            conditions.push(`a.lead_id = $${idx}`);
            params.push(lead_id);
            idx++;
        }
        if (customer_id) {
            conditions.push(`a.customer_id = $${idx}`);
            params.push(customer_id);
            idx++;
        }
        if (status) {
            conditions.push(`a.status = $${idx}`);
            params.push(status);
            idx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `${BASE_SELECT} ${where} ORDER BY a.starts_at ASC LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(limit, offset);

        const result = await query<AppointmentRow>(sql, params);

        res.json({ data: result.rows.map(formatAppointment) });
    } catch (err) {
        next(err);
    }
});

// ── GET /appointments/:id ──────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await query<AppointmentRow>(`${BASE_SELECT} WHERE a.id = $1`, [id]);

        if (!result.rows[0]) {
            throw AppError.notFound('Agendamento não encontrado.');
        }

        res.json(formatAppointment(result.rows[0]));
    } catch (err) {
        next(err);
    }
});

// ── POST /appointments ─────────────────────────────────────────────────────────

router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = createAppointmentSchema.safeParse(req.body);
        if (!parsed.success) {
            throw AppError.badRequest('Dados inválidos.', parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const data = parsed.data;

        const appointment = await transaction(async (client) => {
            let resolvedLeadId = data.lead_id || null;
            let resolvedCustomerId = data.customer_id || null;
            const pipelineId = data.pipeline_id || null;

            // If no lead_id provided but contact_phone is, try to find or create a lead
            if (!resolvedLeadId && data.contact_phone) {
                const phone = normalizePhone(data.contact_phone);

                // Try to find existing lead by phone
                const existingLead = await client.query<{ id: string }>(
                    `SELECT id FROM leads WHERE whatsapp_number = $1 LIMIT 1`,
                    [phone]
                );

                if (existingLead.rows[0]) {
                    resolvedLeadId = existingLead.rows[0].id;
                } else if (pipelineId) {
                    // Create a new lead in the specified pipeline
                    // Find default stage for the pipeline
                    const stageResult = await client.query<{ id: string }>(                        `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1`,
                        [pipelineId]
                    );
                    const stageId = stageResult.rows[0]?.id || null;

                    const newLead = await client.query<{ id: string }>(                        `INSERT INTO leads (whatsapp_number, name, source, stage, pipeline_id, stage_id, assigned_to, last_interaction_at)
                         VALUES ($1, $2, 'BALCAO', 'NOVO', $3, $4, $5, NOW())
                         RETURNING id`,
                        [phone, data.contact_name || null, pipelineId, stageId, req.user!.id]
                    );
                    resolvedLeadId = newLead.rows[0]!.id;

                    // Create timeline event for lead creation
                    await client.query(
                        `INSERT INTO lead_timeline (lead_id, type, title, body, created_by)
                         VALUES ($1, 'LEAD_CREATED', 'Lead criado', 'Lead criado automaticamente pelo agendamento.', $2)`,
                        [resolvedLeadId, req.user!.id]
                    ).catch(() => { /* timeline insert may fail on constraint, silently fail */ });
                }
            }

            // If we have a lead but no customer, try to link via lead's converted_customer_id
            if (resolvedLeadId && !resolvedCustomerId) {
                const leadRow = await client.query<{ converted_customer_id: string | null }>(
                    `SELECT converted_customer_id FROM leads WHERE id = $1`,
                    [resolvedLeadId]
                );
                if (leadRow.rows[0]?.converted_customer_id) {
                    resolvedCustomerId = leadRow.rows[0].converted_customer_id;
                }
            }

            // Insert appointment
            const insertResult = await client.query<{ id: string; starts_at: string }>(
                `INSERT INTO appointments (type, status, source, starts_at, ends_at, notes, lead_id, customer_id, assigned_to, pipeline_id, ai_context)
                 VALUES ($1, 'AGENDADO', $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id, starts_at`,
                [
                    data.type,
                    data.source || 'CRM',
                    data.starts_at,
                    data.ends_at,
                    data.notes || null,
                    resolvedLeadId,
                    resolvedCustomerId,
                    data.assigned_to || req.user!.id,
                    pipelineId,
                    null, // ai_context
                ]
            );

            const appointmentId = insertResult.rows[0]!.id;
            const startsAt = insertResult.rows[0]!.starts_at;

            // Create timeline event on lead
            if (resolvedLeadId) {
                await client.query(
                    `INSERT INTO lead_timeline (lead_id, type, title, body, created_by)
                     VALUES ($1, 'LEAD_CREATED', 'Agendamento criado', $2, $3)`,
                    [resolvedLeadId, `Agendamento "${data.type}" criado para ${new Date(data.starts_at).toLocaleDateString('pt-BR')}.`, req.user!.id]
                ).catch(() => { /* silently fail if constraint issue */ });
            }

            return { id: appointmentId, starts_at: startsAt };
        });

        // Schedule reminder job (24h before starts_at)
        try {
            const startsAtMs = new Date(appointment.starts_at).getTime();
            const reminderDelay = startsAtMs - 24 * 60 * 60 * 1000 - Date.now();
            if (reminderDelay > 0) {
                await enqueueAppointmentReminderJob({
                    appointmentId: appointment.id,
                    delayMs: reminderDelay,
                });
            }
        } catch (err) {
            logger.warn({ err, appointmentId: appointment.id }, 'Failed to schedule reminder job (non-blocking)');
        }

        // Audit log
        void createAuditLog({
            userId: req.user!.id,
            action: 'CREATE',
            entityType: 'appointment',
            entityId: appointment.id,
            oldValue: null,
            newValue: { ...parsed.data },
            req,
        });

        // Return the full appointment
        const result = await query<AppointmentRow>(`${BASE_SELECT} WHERE a.id = $1`, [appointment.id]);
        res.status(201).json(formatAppointment(result.rows[0]!));

    } catch (err) {
        next(err);
    }
});

// ── PATCH /appointments/:id/status ─────────────────────────────────────────────

router.patch('/:id/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const parsed = updateStatusSchema.safeParse(req.body);
        if (!parsed.success) {
            throw AppError.badRequest('Dados inválidos.', parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const { status, cancel_reason } = parsed.data;

        const current = await query<{ id: string; status: string }>('SELECT id, status FROM appointments WHERE id = $1', [id]);
        if (!current.rows[0]) {
            throw AppError.notFound('Agendamento não encontrado.');
        }

        const updates: string[] = [`status = $2`, `updated_at = NOW()`];
        const params: unknown[] = [id, status];
        let idx = 3;

        if (status === 'CANCELADO') {
            updates.push(`cancelled_at = NOW()`);
            if (cancel_reason) {
                updates.push(`cancel_reason = $${idx}`);
                params.push(cancel_reason);
                idx++;
            }
        }

        await query(
            `UPDATE appointments SET ${updates.join(', ')} WHERE id = $1`,
            params
        );

        void createAuditLog({
            userId: req.user!.id,
            action: 'UPDATE_STATUS',
            entityType: 'appointment',
            entityId: id as string,
            oldValue: { status: current.rows[0].status },
            newValue: { status, cancel_reason: cancel_reason ?? null },
            req,
        });

        const result = await query<AppointmentRow>(`${BASE_SELECT} WHERE a.id = $1`, [id]);
        res.json(formatAppointment(result.rows[0]!));
    } catch (err) {
        next(err);
    }
});

// ── POST /appointments/:id/notify ──────────────────────────────────────────────

router.post('/:id/notify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const result = await query<AppointmentRow>(`${BASE_SELECT} WHERE a.id = $1`, [id]);
        if (!result.rows[0]) {
            throw AppError.notFound('Agendamento não encontrado.');
        }

        const appt = result.rows[0];
        const whatsappNumber = appt.lead_whatsapp || appt.customer_whatsapp;

        if (!whatsappNumber) {
            throw AppError.badRequest('Nenhum número de WhatsApp vinculado ao agendamento.');
        }

        const contactName = appt.lead_name || appt.customer_name || 'Cliente';
        const dateStr = new Date(appt.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = new Date(appt.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Try to send via n8n webhook
        const settings = await query<{ internal_webhook_key: string | null }>('SELECT internal_webhook_key FROM settings LIMIT 1');
        const webhookKeys = await query<{ key_value: string }>('SELECT key_value FROM webhook_keys WHERE revoked_at IS NULL LIMIT 1');
        const apiKey = webhookKeys.rows[0]?.key_value || settings.rows[0]?.internal_webhook_key || env().N8N_API_KEY;

        if (!apiKey) {
            throw AppError.serviceUnavailable('N8N_NOT_CONFIGURED', 'Nenhuma chave de webhook configurada.');
        }

        // Send message via the n8n bot-reply endpoint (internal call)
        const message = `Olá ${contactName}! 👋\n\nLembramos que você tem um agendamento marcado:\n📅 ${dateStr}\n🕐 ${timeStr}\n📝 ${appt.type}\n\nConfirme sua presença respondendo essa mensagem. Até lá! ✨`;

        // Call internal n8n route
        const n8nUrl = env().N8N_WEBHOOK_URL || `http://localhost:${env().PORT}/api/v1/n8n/bot-reply`;

        try {
            await fetch(n8nUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    whatsapp_number: whatsappNumber,
                    content: message,
                }),
            });
        } catch (fetchErr) {
            logger.warn({ err: fetchErr, appointmentId: id }, 'Failed to send n8n notification (non-blocking)');
        }

        void createAuditLog({
            userId: req.user!.id,
            action: 'NOTIFY',
            entityType: 'appointment',
            entityId: id as string,
            oldValue: null,
            newValue: { whatsapp_number: whatsappNumber as string, type: 'reminder' },
            req,
        });

        res.json({ sent: true, whatsapp_number: whatsappNumber });
    } catch (err) {
        next(err);
    }
});

export default router;
