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
    ends_at: z.string().optional().nullable(),
    duration_minutes: z.number().int().min(5).max(480).optional().nullable(),
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

const updateAppointmentSchema = z.object({
    type: z.string().min(1).optional(),
    starts_at: z.string().min(1).optional(),
    ends_at: z.string().optional().nullable(),
    duration_minutes: z.number().int().min(5).max(480).optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    pipeline_id: z.string().uuid().optional().nullable(),
    contact_name: z.string().max(255).optional().nullable(),
    contact_phone: z.string().max(80).optional().nullable(),
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
    pipeline_name: string | null;
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
        pipeline: row.pipeline_id ? { id: row.pipeline_id, name: row.pipeline_name || 'Sem nome' } : null,
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
        a.pipeline_id, p.name AS pipeline_name,
        a.ai_context, a.cancelled_at, a.cancel_reason,
        a.reminder_sent_at, a.created_at, a.updated_at
    FROM appointments a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN users u ON u.id = a.assigned_to
    LEFT JOIN pipelines p ON p.id = a.pipeline_id
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

        // Resolve ends_at: prioridade ends_at explícito > duration_minutes > settings default
        // Validação de tempo coerente: starts_at deve ser parseável; ends_at > starts_at.
        const startsAtDate = new Date(data.starts_at);
        if (Number.isNaN(startsAtDate.getTime())) {
            throw AppError.badRequest('Data/hora de início inválida.', [
                { field: 'starts_at', message: 'Formato inválido.' },
            ]);
        }

        let resolvedEndsAt: string;
        let resolvedDurationMinutes: number;
        if (data.ends_at) {
            const endsAtDate = new Date(data.ends_at);
            if (Number.isNaN(endsAtDate.getTime())) {
                throw AppError.badRequest('Data/hora de fim inválida.', [
                    { field: 'ends_at', message: 'Formato inválido.' },
                ]);
            }
            if (endsAtDate.getTime() <= startsAtDate.getTime()) {
                throw AppError.badRequest('A hora final deve ser depois da hora inicial.', [
                    { field: 'ends_at', message: 'Fim precisa ser maior que o início.' },
                ]);
            }
            resolvedEndsAt = endsAtDate.toISOString();
            resolvedDurationMinutes = Math.round((endsAtDate.getTime() - startsAtDate.getTime()) / 60000);
        } else {
            let durationMinutes = data.duration_minutes ?? null;
            if (!durationMinutes) {
                const defaults = await query<{ default_appointment_duration_minutes: number | null }>(
                    `SELECT default_appointment_duration_minutes FROM settings LIMIT 1`
                );
                durationMinutes = defaults.rows[0]?.default_appointment_duration_minutes ?? 60;
            }
            resolvedDurationMinutes = durationMinutes;
            resolvedEndsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
        }

        // Validar conflito de horário (overlap) — só conta agendamentos ativos.
        // Regra: [starts_a, ends_a) ∩ [starts_b, ends_b) ≠ ∅ ⇔ starts_a < ends_b AND ends_a > starts_b
        const assignedTo = data.assigned_to || req.user!.id;
        const conflict = await query<{ id: string; type: string; starts_at: string; ends_at: string }>(
            `SELECT id, type, starts_at, ends_at
             FROM appointments
             WHERE assigned_to = $1
               AND status NOT IN ('CANCELADO', 'NAO_COMPARECEU', 'CONCLUIDO')
               AND starts_at < $3::timestamptz
               AND ends_at > $2::timestamptz
             LIMIT 1`,
            [assignedTo, startsAtDate.toISOString(), resolvedEndsAt]
        );
        if (conflict.rows[0]) {
            const c = conflict.rows[0];
            const conflictStart = new Date(c.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            const conflictEnd = new Date(c.ends_at).toLocaleString('pt-BR', { timeStyle: 'short' });
            throw AppError.badRequest(
                `Conflito de horário: já existe "${c.type}" de ${conflictStart} até ${conflictEnd}.`,
                [{ field: 'starts_at', message: 'Esse horário sobrepõe um agendamento existente.' }]
            );
        }

        const appointment = await transaction(async (client) => {
            let resolvedLeadId = data.lead_id || null;
            let resolvedCustomerId = data.customer_id || null;

            // pipeline_id explícito > settings.default_appointment_pipeline_id > null
            // Se ficar null, o agendamento ainda é criado, só não cria/vincula lead.
            let pipelineId = data.pipeline_id || null;
            let configuredStageId: string | null = null;
            if (!pipelineId) {
                const fallback = await client.query<{
                    default_appointment_pipeline_id: string | null;
                    default_appointment_stage_id: string | null;
                }>(
                    `SELECT default_appointment_pipeline_id, default_appointment_stage_id FROM settings LIMIT 1`
                );
                pipelineId = fallback.rows[0]?.default_appointment_pipeline_id ?? null;
                configuredStageId = fallback.rows[0]?.default_appointment_stage_id ?? null;
            }

            // Resolve a etapa-alvo: configurada em settings > primeira etapa do pipeline.
            // Calculada uma única vez pra reusar nos ramos abaixo.
            let targetStageId: string | null = configuredStageId;
            if (pipelineId && !targetStageId) {
                const firstStage = await client.query<{ id: string }>(
                    `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1`,
                    [pipelineId]
                );
                targetStageId = firstStage.rows[0]?.id || null;
            }

            // If no lead_id provided but contact_phone is, try to find or create a lead
            if (!resolvedLeadId && data.contact_phone) {
                const phone = normalizePhone(data.contact_phone);

                // Busca lead já existente NESTE pipeline (a constraint unique é por
                // whatsapp_number + pipeline_id, então só pode haver um por pipeline).
                let existingInPipeline: { id: string; stage_id: string | null } | undefined;
                if (pipelineId) {
                    const r = await client.query<{ id: string; stage_id: string | null }>(
                        `SELECT id, stage_id FROM leads WHERE whatsapp_number = $1 AND pipeline_id = $2 LIMIT 1`,
                        [phone, pipelineId]
                    );
                    existingInPipeline = r.rows[0];
                }

                if (existingInPipeline) {
                    resolvedLeadId = existingInPipeline.id;
                    // Move o lead para a etapa configurada se ainda não estiver lá.
                    if (targetStageId && existingInPipeline.stage_id !== targetStageId) {
                        await client.query(
                            `UPDATE leads SET stage_id = $1, last_interaction_at = NOW(), updated_at = NOW() WHERE id = $2`,
                            [targetStageId, resolvedLeadId]
                        );
                        await client.query(
                            `INSERT INTO lead_timeline (lead_id, type, title, body, created_by)
                             VALUES ($1, 'STAGE_CHANGED', 'Etapa atualizada', 'Lead movido para a etapa configurada da Agenda pelo novo agendamento.', $2)`,
                            [resolvedLeadId, req.user!.id]
                        ).catch(() => { /* silencia se constraint do timeline barrar */ });
                    }
                } else if (pipelineId) {
                    // Lead novo no pipeline configurado.
                    const newLead = await client.query<{ id: string }>(
                        `INSERT INTO leads (whatsapp_number, name, source, stage, pipeline_id, stage_id, assigned_to, last_interaction_at)
                         VALUES ($1, $2, 'BALCAO', 'NOVO', $3, $4, $5, NOW())
                         RETURNING id`,
                        [phone, data.contact_name || null, pipelineId, targetStageId, req.user!.id]
                    );
                    resolvedLeadId = newLead.rows[0]!.id;

                    await client.query(
                        `INSERT INTO lead_timeline (lead_id, type, title, body, created_by)
                         VALUES ($1, 'LEAD_CREATED', 'Lead criado', 'Lead criado automaticamente pelo agendamento.', $2)`,
                        [resolvedLeadId, req.user!.id]
                    ).catch(() => { /* silencia se constraint do timeline barrar */ });
                }
            } else if (resolvedLeadId && pipelineId && targetStageId) {
                // Lead já vinculado (vindo da ficha) — garante que ele esteja no
                // pipeline+etapa configurados, sem criar duplicatas.
                const lead = await client.query<{ pipeline_id: string; stage_id: string | null }>(
                    `SELECT pipeline_id, stage_id FROM leads WHERE id = $1 LIMIT 1`,
                    [resolvedLeadId]
                );
                const current = lead.rows[0];
                if (current && current.pipeline_id === pipelineId && current.stage_id !== targetStageId) {
                    await client.query(
                        `UPDATE leads SET stage_id = $1, last_interaction_at = NOW(), updated_at = NOW() WHERE id = $2`,
                        [targetStageId, resolvedLeadId]
                    );
                    await client.query(
                        `INSERT INTO lead_timeline (lead_id, type, title, body, created_by)
                         VALUES ($1, 'STAGE_CHANGED', 'Etapa atualizada', 'Lead movido para a etapa configurada da Agenda pelo novo agendamento.', $2)`,
                        [resolvedLeadId, req.user!.id]
                    ).catch(() => { /* silencia */ });
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
                    startsAtDate.toISOString(),
                    resolvedEndsAt,
                    data.notes || null,
                    resolvedLeadId,
                    resolvedCustomerId,
                    assignedTo,
                    pipelineId,
                    { duration_minutes: resolvedDurationMinutes },
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

// ── PATCH /appointments/:id ────────────────────────────────────────────────────
// Edição completa de agendamento (tipo, datas, responsável, notas, etc).
// Mantém validação de overlap como o POST e roda em transação.

router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const parsed = updateAppointmentSchema.safeParse(req.body);
        if (!parsed.success) {
            throw AppError.badRequest('Dados inválidos.', parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }
        const data = parsed.data;

        const current = await query<{
            id: string;
            type: string;
            starts_at: string;
            ends_at: string;
            assigned_to: string | null;
            pipeline_id: string | null;
            notes: string | null;
            status: string;
        }>(
            `SELECT id, type, starts_at, ends_at, assigned_to, pipeline_id, notes, status
             FROM appointments WHERE id = $1`,
            [id]
        );
        if (!current.rows[0]) {
            throw AppError.notFound('Agendamento não encontrado.');
        }
        const previous = current.rows[0];

        if (['CONCLUIDO', 'CANCELADO'].includes(previous.status)) {
            throw AppError.badRequest('Agendamentos concluídos ou cancelados não podem ser editados.');
        }

        // Resolve novos starts_at / ends_at (mantendo o anterior se não vier no body)
        const newStartsAtRaw = data.starts_at ?? previous.starts_at;
        const startsAtDate = new Date(newStartsAtRaw);
        if (Number.isNaN(startsAtDate.getTime())) {
            throw AppError.badRequest('Data/hora de início inválida.', [{ field: 'starts_at', message: 'Formato inválido.' }]);
        }

        let resolvedEndsAt: string;
        if (data.ends_at) {
            const endsAtDate = new Date(data.ends_at);
            if (Number.isNaN(endsAtDate.getTime())) {
                throw AppError.badRequest('Data/hora de fim inválida.', [{ field: 'ends_at', message: 'Formato inválido.' }]);
            }
            if (endsAtDate.getTime() <= startsAtDate.getTime()) {
                throw AppError.badRequest('A hora final deve ser depois da hora inicial.', [{ field: 'ends_at', message: 'Fim precisa ser maior que o início.' }]);
            }
            resolvedEndsAt = endsAtDate.toISOString();
        } else if (data.duration_minutes) {
            resolvedEndsAt = new Date(startsAtDate.getTime() + data.duration_minutes * 60000).toISOString();
        } else if (data.starts_at) {
            // starts_at mudou mas duration não veio: mantém a duração anterior
            const prevStart = new Date(previous.starts_at).getTime();
            const prevEnd = new Date(previous.ends_at).getTime();
            const prevDuration = Math.max(prevEnd - prevStart, 5 * 60000);
            resolvedEndsAt = new Date(startsAtDate.getTime() + prevDuration).toISOString();
        } else {
            resolvedEndsAt = new Date(previous.ends_at).toISOString();
        }

        const assignedTo = data.assigned_to ?? previous.assigned_to ?? req.user!.id;

        // Overlap: ignora o próprio agendamento
        const conflict = await query<{ id: string; type: string; starts_at: string; ends_at: string }>(
            `SELECT id, type, starts_at, ends_at
             FROM appointments
             WHERE id <> $1
               AND assigned_to = $2
               AND status NOT IN ('CANCELADO', 'NAO_COMPARECEU', 'CONCLUIDO')
               AND starts_at < $4::timestamptz
               AND ends_at > $3::timestamptz
             LIMIT 1`,
            [id, assignedTo, startsAtDate.toISOString(), resolvedEndsAt]
        );
        if (conflict.rows[0]) {
            const c = conflict.rows[0];
            const conflictStart = new Date(c.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            const conflictEnd = new Date(c.ends_at).toLocaleString('pt-BR', { timeStyle: 'short' });
            throw AppError.badRequest(
                `Conflito de horário: já existe "${c.type}" de ${conflictStart} até ${conflictEnd}.`,
                [{ field: 'starts_at', message: 'Esse horário sobrepõe um agendamento existente.' }]
            );
        }

        // Monta UPDATE dinâmico apenas com campos enviados
        const sets: string[] = [];
        const params: unknown[] = [];
        let idx = 1;
        const push = (col: string, value: unknown) => {
            sets.push(`${col} = $${idx}`);
            params.push(value);
            idx++;
        };

        if (data.type !== undefined) push('type', data.type);
        push('starts_at', startsAtDate.toISOString());
        push('ends_at', resolvedEndsAt);
        if (data.notes !== undefined) push('notes', data.notes);
        if (data.assigned_to !== undefined) push('assigned_to', data.assigned_to);
        if (data.pipeline_id !== undefined) push('pipeline_id', data.pipeline_id);
        sets.push(`updated_at = NOW()`);

        params.push(id);
        await query(
            `UPDATE appointments SET ${sets.join(', ')} WHERE id = $${idx}`,
            params
        );

        void createAuditLog({
            userId: req.user!.id,
            action: 'UPDATE',
            entityType: 'appointment',
            entityId: id as string,
            oldValue: {
                type: previous.type,
                starts_at: previous.starts_at,
                ends_at: previous.ends_at,
                assigned_to: previous.assigned_to,
                pipeline_id: previous.pipeline_id,
                notes: previous.notes,
            },
            newValue: {
                type: data.type ?? previous.type,
                starts_at: startsAtDate.toISOString(),
                ends_at: resolvedEndsAt,
                assigned_to: assignedTo,
                pipeline_id: data.pipeline_id ?? previous.pipeline_id,
                notes: data.notes ?? previous.notes,
            },
            req,
        });

        const result = await query<AppointmentRow>(`${BASE_SELECT} WHERE a.id = $1`, [id]);
        res.json(formatAppointment(result.rows[0]!));
    } catch (err) {
        next(err);
    }
});

export default router;
