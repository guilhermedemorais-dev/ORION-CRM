import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import type { LeadSource, LeadStage } from '../types/entities.js';

const router = Router();

const leadStageSchema = z.enum(['NOVO', 'QUALIFICADO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'CONVERTIDO', 'PERDIDO']);
const leadSourceSchema = z.enum(['WHATSAPP', 'BALCAO', 'INDICACAO', 'INSTAGRAM', 'OUTRO']);

const listLeadsSchema = z.object({
    stage: leadStageSchema.optional(),
    stage_id: z.string().uuid().optional(),
    pipeline_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createLeadSchema = z.object({
    whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'WhatsApp deve estar em formato E.164'),
    name: z.string().trim().min(2).max(255).optional(),
    email: z.string().email().max(255).optional(),
    source: leadSourceSchema.default('WHATSAPP'),
    pipeline_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).optional(),
});

const updateLeadStageSchema = z.object({
    stageId: z.string().uuid().optional(),
    stage: leadStageSchema.optional(),
}).refine((data) => Boolean(data.stageId || data.stage), {
    message: 'Informe stageId ou stage.',
});

const quickNoteSchema = z.object({
    quickNote: z.string().trim().max(4000).nullable(),
});

const customFieldsSchema = z.object({
    customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const estimatedValueSchema = z.object({
    estimatedValue: z.coerce.number().int().min(0),
});

const taskCreateSchema = z.object({
    title: z.string().trim().min(3).max(255),
    dueDate: z.string().datetime().optional(),
    assignedTo: z.string().uuid().optional(),
});

const taskPatchSchema = z.object({
    title: z.string().trim().min(3).max(255).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    done: z.boolean().optional(),
}).refine((data) => data.title !== undefined || data.dueDate !== undefined || data.done !== undefined, {
    message: 'Nenhum campo informado para atualização.',
});

const timelineQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().datetime().optional(),
});

const attachmentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
    },
}).single('file');

interface LeadRow {
    id: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
    stage: LeadStage;
    pipeline_id: string;
    stage_id: string | null;
    stage_name: string | null;
    stage_color: string | null;
    stage_is_won: boolean | null;
    stage_is_lost: boolean | null;
    estimated_value: number;
    quick_note: string | null;
    custom_fields: Record<string, unknown>;
    open_tasks_count: number;
    last_task_at: Date | null;
    source: LeadSource;
    notes: string | null;
    converted_customer_id: string | null;
    last_interaction_at: Date | null;
    created_at: Date;
    updated_at: Date;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
}

interface StageRow {
    id: string;
    name: string;
    color: string;
    is_won: boolean;
    is_lost: boolean;
}

function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, '_')
        .trim();
}

function mapStageToLegacy(stage: StageRow, current: LeadStage): LeadStage {
    if (stage.is_won) return 'CONVERTIDO';
    if (stage.is_lost) return 'PERDIDO';

    const normalized = normalize(stage.name);
    if (normalized === 'NOVO') return 'NOVO';
    if (normalized === 'QUALIFICADO') return 'QUALIFICADO';
    if (normalized === 'PROPOSTA_ENVIADA') return 'PROPOSTA_ENVIADA';
    if (normalized === 'NEGOCIACAO') return 'NEGOCIACAO';

    return current;
}

function stageNameToLegacy(name: string): LeadStage {
    const normalized = normalize(name);
    if (normalized === 'NOVO') return 'NOVO';
    if (normalized === 'QUALIFICADO') return 'QUALIFICADO';
    if (normalized === 'PROPOSTA_ENVIADA') return 'PROPOSTA_ENVIADA';
    if (normalized === 'NEGOCIACAO') return 'NEGOCIACAO';
    if (normalized === 'CONVERTIDO') return 'CONVERTIDO';
    return 'PERDIDO';
}

function mapLead(row: LeadRow) {
    return {
        id: row.id,
        name: row.name,
        whatsapp_number: row.whatsapp_number,
        email: row.email,
        stage: row.stage,
        pipeline_id: row.pipeline_id,
        stage_id: row.stage_id,
        stage_name: row.stage_name,
        stage_color: row.stage_color,
        stage_is_won: row.stage_is_won,
        stage_is_lost: row.stage_is_lost,
        estimated_value: row.estimated_value,
        quick_note: row.quick_note,
        custom_fields: row.custom_fields ?? {},
        open_tasks_count: row.open_tasks_count,
        last_task_at: row.last_task_at,
        source: row.source,
        notes: row.notes,
        converted_customer_id: row.converted_customer_id,
        last_interaction_at: row.last_interaction_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assigned_to: row.assigned_user_id && row.assigned_user_name
            ? { id: row.assigned_user_id, name: row.assigned_user_name }
            : null,
    };
}

function getLeadIdParam(req: Request): string {
    const id = req.params['id'];
    if (!id || Array.isArray(id)) {
        throw AppError.badRequest('Lead inválido.');
    }
    return id;
}

function getPathParam(req: Request, key: string): string {
    const value = req.params[key];
    if (!value || Array.isArray(value)) {
        throw AppError.badRequest('Parâmetro inválido.');
    }
    return value;
}

function getScopedAssignedTo(req: Request, requestedAssignedTo?: string): string | undefined {
    if (!req.user) {
        return undefined;
    }

    if (req.user.role === 'ATENDENTE') {
        return req.user.id;
    }

    return requestedAssignedTo;
}

function assertCanAccessAssignedRecord(req: Request, ownerId: string | null): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ROOT' || req.user.role === 'ADMIN' || req.user.role === 'GERENTE') {
        return;
    }

    if (!ownerId || ownerId !== req.user.id) {
        throw AppError.forbidden('Acesso não autorizado para este lead.');
    }
}

async function fetchLeadById(leadId: string): Promise<LeadRow | null> {
    const result = await query<LeadRow>(
        `SELECT
            l.id,
            l.name,
            l.whatsapp_number,
            l.email,
            l.stage,
            l.pipeline_id,
            l.stage_id,
            ps.name AS stage_name,
            ps.color AS stage_color,
            ps.is_won AS stage_is_won,
            ps.is_lost AS stage_is_lost,
            l.estimated_value,
            l.quick_note,
            l.custom_fields,
            l.open_tasks_count,
            l.last_task_at,
            l.source,
            l.notes,
            l.converted_customer_id,
            l.last_interaction_at,
            l.created_at,
            l.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
         LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
         WHERE l.id = $1
         LIMIT 1`,
        [leadId]
    );

    return result.rows[0] ?? null;
}

async function createLeadTimelineEvent(params: {
    leadId: string;
    type: 'STAGE_CHANGED' | 'NOTE_ADDED' | 'TASK_CREATED' | 'TASK_DONE' | 'ATTACHMENT_ADDED' | 'LEAD_CREATED' | 'LEAD_CONVERTED' | 'FIELD_UPDATED';
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
    createdBy?: string | null;
}): Promise<void> {
    await query(
        `INSERT INTO lead_timeline (lead_id, type, title, body, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
            params.leadId,
            params.type,
            params.title,
            params.body ?? null,
            params.metadata ? JSON.stringify(params.metadata) : null,
            params.createdBy ?? null,
        ]
    );
}

async function resolveDefaultPipelineId(): Promise<string> {
    const pipeline = await query<{ id: string }>(
        `SELECT id
         FROM pipelines
         WHERE slug = 'leads'
         LIMIT 1`
    );

    const pipelineId = pipeline.rows[0]?.id;
    if (!pipelineId) {
        throw AppError.serviceUnavailable('PIPELINE_NOT_READY', 'Pipeline padrão ainda não foi inicializado.');
    }

    return pipelineId;
}

async function resolveDefaultStageId(pipelineId?: string | null): Promise<string | null> {
    const stage = await query<{ id: string }>(
        `SELECT id
         FROM pipeline_stages
         WHERE position = 1
           AND ($1::uuid IS NULL OR pipeline_id = $1)
         ORDER BY created_at ASC
         LIMIT 1`
        ,
        [pipelineId ?? null]
    );

    return stage.rows[0]?.id ?? null;
}

function runAttachmentUpload(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
        attachmentUpload(req, res, (err) => {
            if (!err) {
                resolve();
                return;
            }

            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Arquivo excede o limite de 10MB.'));
                return;
            }

            reject(AppError.badRequest('Upload inválido.'));
        });
    });
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'leads-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listLeadsSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const { stage, stage_id, pipeline_id, q, page, limit } = parsed.data;
            const scopedAssignedTo = getScopedAssignedTo(req, parsed.data.assigned_to);
            const filters: string[] = [];
            const values: unknown[] = [];

            if (stage) {
                values.push(stage);
                filters.push(`l.stage = $${values.length}`);
            }

            if (stage_id) {
                values.push(stage_id);
                filters.push(`l.stage_id = $${values.length}`);
            }

            if (pipeline_id) {
                values.push(pipeline_id);
                filters.push(`l.pipeline_id = $${values.length}`);
            }

            if (scopedAssignedTo) {
                values.push(scopedAssignedTo);
                filters.push(`l.assigned_to = $${values.length}`);
            }

            if (q) {
                values.push(`%${q}%`);
                const searchIndex = values.length;
                filters.push(`(
                    COALESCE(l.name, '') ILIKE $${searchIndex}
                    OR l.whatsapp_number ILIKE $${searchIndex}
                    OR COALESCE(l.email, '') ILIKE $${searchIndex}
                )`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM leads l
                 ${whereClause}`,
                values
            );

            values.push(limit);
            values.push((page - 1) * limit);
            const limitIndex = values.length - 1;
            const offsetIndex = values.length;

            const result = await query<LeadRow>(
                `SELECT
                    l.id,
                    l.name,
                    l.whatsapp_number,
                    l.email,
                    l.stage,
                    l.pipeline_id,
                    l.stage_id,
                    ps.name AS stage_name,
                    ps.color AS stage_color,
                    ps.is_won AS stage_is_won,
                    ps.is_lost AS stage_is_lost,
                    l.estimated_value,
                    l.quick_note,
                    l.custom_fields,
                    l.open_tasks_count,
                    l.last_task_at,
                    l.source,
                    l.notes,
                    l.converted_customer_id,
                    l.last_interaction_at,
                    l.created_at,
                    l.updated_at,
                    u.id AS assigned_user_id,
                    u.name AS assigned_user_name
                 FROM leads l
                 LEFT JOIN users u ON u.id = l.assigned_to
                 LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
                 ${whereClause}
                 ORDER BY COALESCE(ps.position, 9999), l.updated_at DESC, l.created_at DESC
                 LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapLead),
                meta: {
                    total,
                    page,
                    limit,
                    pages: Math.max(1, Math.ceil(total / limit)),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const lead = await fetchLeadById(getLeadIdParam(req));
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            assertCanAccessAssignedRecord(req, lead.assigned_user_id);
            res.json(mapLead(lead));
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'leads-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createLeadSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const assignedTo = getScopedAssignedTo(req, parsed.data.assigned_to) ?? null;
            const pipelineId = parsed.data.pipeline_id ?? await resolveDefaultPipelineId();
            const duplicate = await query<{ id: string }>(
                `SELECT id
                 FROM leads
                 WHERE whatsapp_number = $1
                 LIMIT 1`,
                [parsed.data.whatsapp_number]
            );

            if (duplicate.rows[0]) {
                const lead = await fetchLeadById(duplicate.rows[0].id);
                res.status(200).json({
                    data: lead ? mapLead(lead) : null,
                    duplicate_prevented: true,
                });
                return;
            }

            const defaultStageId = await resolveDefaultStageId(pipelineId);
            const insertResult = await query<{ id: string }>(
                `INSERT INTO leads (
                    whatsapp_number,
                    name,
                    email,
                    stage,
                    pipeline_id,
                    stage_id,
                    assigned_to,
                    source,
                    notes,
                    last_interaction_at
                 )
                 VALUES ($1, $2, $3, 'NOVO', $4, $5, $6, $7, $8, NOW())
                 RETURNING id`,
                [
                    parsed.data.whatsapp_number,
                    parsed.data.name ?? null,
                    parsed.data.email ?? null,
                    pipelineId,
                    defaultStageId,
                    assignedTo,
                    parsed.data.source,
                    parsed.data.notes ?? null,
                ]
            );

            const leadId = insertResult.rows[0]?.id;
            if (!leadId) {
                throw AppError.internal(req.requestId);
            }

            if (req.user) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'LEAD_CREATED',
                    title: 'Lead criado',
                    body: 'Lead incluído no pipeline.',
                    metadata: {
                        source: parsed.data.source,
                    },
                    createdBy: req.user.id,
                });

                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'leads',
                    entityId: leadId,
                    oldValue: null,
                    newValue: {
                        whatsapp_number: parsed.data.whatsapp_number,
                        name: parsed.data.name ?? null,
                        stage: 'NOVO',
                        pipeline_id: pipelineId,
                    },
                    req,
                });
            }

            const lead = await fetchLeadById(leadId);
            res.status(201).json({
                data: lead ? mapLead(lead) : null,
                duplicate_prevented: false,
            });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id/stage',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'leads-stage' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = updateLeadStageSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getLeadIdParam(req);
            const currentLead = await fetchLeadById(leadId);
            if (!currentLead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            assertCanAccessAssignedRecord(req, currentLead.assigned_user_id);

            let nextStageId = currentLead.stage_id;
            let nextLegacyStage = currentLead.stage;
            let nextStageName = currentLead.stage_name ?? currentLead.stage;

            if (parsed.data.stageId) {
                const stageResult = await query<StageRow>(
                    `SELECT id, name, color, is_won, is_lost
                     FROM pipeline_stages
                     WHERE id = $1
                     LIMIT 1`,
                    [parsed.data.stageId]
                );
                const stage = stageResult.rows[0];

                if (!stage) {
                    next(AppError.notFound('Etapa do pipeline não encontrada.'));
                    return;
                }

                nextStageId = stage.id;
                nextLegacyStage = mapStageToLegacy(stage, currentLead.stage);
                nextStageName = stage.name;
            } else if (parsed.data.stage) {
                nextLegacyStage = parsed.data.stage;
                const stagesResult = await query<StageRow>(
                    `SELECT id, name, color, is_won, is_lost
                     FROM pipeline_stages`
                );
                const expected = normalize(stageNameToLegacy(parsed.data.stage).replaceAll('_', ' '));
                const matched = stagesResult.rows.find((stage) => normalize(stage.name) === expected) ?? null;
                nextStageId = matched?.id ?? currentLead.stage_id;
                nextStageName = matched?.name ?? parsed.data.stage;
            }

            await query(
                `UPDATE leads
                 SET stage = $1, stage_id = $2, updated_at = NOW()
                 WHERE id = $3`,
                [nextLegacyStage, nextStageId, leadId]
            );

            if (req.user) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'STAGE_CHANGED',
                    title: 'Etapa atualizada',
                    body: `${currentLead.stage_name ?? currentLead.stage} → ${nextStageName}`,
                    metadata: {
                        from_stage_id: currentLead.stage_id,
                        to_stage_id: nextStageId,
                        from_stage: currentLead.stage,
                        to_stage: nextLegacyStage,
                    },
                    createdBy: req.user.id,
                });

                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_STAGE',
                    entityType: 'leads',
                    entityId: leadId,
                    oldValue: { stage: currentLead.stage, stage_id: currentLead.stage_id },
                    newValue: { stage: nextLegacyStage, stage_id: nextStageId },
                    req,
                });
            }

            const updatedLead = await fetchLeadById(leadId);
            res.json({ data: updatedLead ? mapLead(updatedLead) : null });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id/quick-note',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = quickNoteSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Quick note inválida.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getLeadIdParam(req);
            const currentLead = await fetchLeadById(leadId);
            if (!currentLead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, currentLead.assigned_user_id);

            await query(
                `UPDATE leads
                 SET quick_note = $1, updated_at = NOW()
                 WHERE id = $2`,
                [parsed.data.quickNote, leadId]
            );

            if (req.user) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'NOTE_ADDED',
                    title: 'Nota rápida atualizada',
                    body: parsed.data.quickNote,
                    createdBy: req.user.id,
                });
            }

            const updatedLead = await fetchLeadById(leadId);
            res.json({ data: updatedLead ? mapLead(updatedLead) : null });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id/custom-fields',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = customFieldsSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Campos customizados inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getLeadIdParam(req);
            const currentLead = await fetchLeadById(leadId);
            if (!currentLead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, currentLead.assigned_user_id);

            const defsResult = await query<{
                field_key: string;
                required: boolean;
                field_type: string;
                options: unknown;
            }>(
                `SELECT field_key, required, field_type, options
                 FROM pipeline_custom_fields`
            );
            const defs = defsResult.rows;
            const validKeys = new Set(defs.map((field) => field.field_key));

            for (const key of Object.keys(parsed.data.customFields)) {
                if (!validKeys.has(key)) {
                    next(AppError.badRequest(`Campo customizado inválido: ${key}.`));
                    return;
                }
            }

            for (const field of defs) {
                const value = parsed.data.customFields[field.field_key];
                if (field.required && (value === undefined || value === null || value === '')) {
                    next(AppError.badRequest(`Campo obrigatório não informado: ${field.field_key}.`));
                    return;
                }

                if (value === undefined || value === null) {
                    continue;
                }

                if (field.field_type === 'text' && typeof value !== 'string') {
                    next(AppError.badRequest(`Campo ${field.field_key} deve ser texto.`));
                    return;
                }

                if (field.field_type === 'number' && typeof value !== 'number') {
                    next(AppError.badRequest(`Campo ${field.field_key} deve ser número.`));
                    return;
                }

                if (field.field_type === 'checkbox' && typeof value !== 'boolean') {
                    next(AppError.badRequest(`Campo ${field.field_key} deve ser booleano.`));
                    return;
                }

                if (field.field_type === 'date' && typeof value !== 'string') {
                    next(AppError.badRequest(`Campo ${field.field_key} deve ser data em string.`));
                    return;
                }

                if (field.field_type === 'select') {
                    const options = Array.isArray(field.options) ? field.options : [];
                    if (typeof value !== 'string' || !options.includes(value)) {
                        next(AppError.badRequest(`Campo ${field.field_key} deve conter uma opção válida.`));
                        return;
                    }
                }
            }

            await query(
                `UPDATE leads
                 SET custom_fields = $1::jsonb, updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify(parsed.data.customFields), leadId]
            );

            if (req.user) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'FIELD_UPDATED',
                    title: 'Campos customizados atualizados',
                    metadata: parsed.data.customFields,
                    createdBy: req.user.id,
                });
            }

            const updatedLead = await fetchLeadById(leadId);
            res.json({ data: updatedLead ? mapLead(updatedLead) : null });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id/value',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = estimatedValueSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Valor estimado inválido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getLeadIdParam(req);
            const currentLead = await fetchLeadById(leadId);
            if (!currentLead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, currentLead.assigned_user_id);

            await query(
                `UPDATE leads
                 SET estimated_value = $1, updated_at = NOW()
                 WHERE id = $2`,
                [parsed.data.estimatedValue, leadId]
            );

            if (req.user) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'FIELD_UPDATED',
                    title: 'Valor estimado atualizado',
                    body: `Novo valor: ${parsed.data.estimatedValue}`,
                    metadata: { estimated_value: parsed.data.estimatedValue },
                    createdBy: req.user.id,
                });
            }

            const updatedLead = await fetchLeadById(leadId);
            res.json({ data: updatedLead ? mapLead(updatedLead) : null });
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/:id/tasks',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadId = getLeadIdParam(req);
            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const tasks = await query<{
                id: string;
                title: string;
                due_date: Date | null;
                done: boolean;
                done_at: Date | null;
                assigned_to: string | null;
                created_by: string;
                created_at: Date;
            }>(
                `SELECT id, title, due_date, done, done_at, assigned_to, created_by, created_at
                 FROM lead_tasks
                 WHERE lead_id = $1
                 ORDER BY done ASC, due_date ASC NULLS LAST, created_at DESC`,
                [leadId]
            );

            res.json({ data: tasks.rows });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/tasks',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                next(AppError.unauthorized());
                return;
            }

            const parsed = taskCreateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Tarefa inválida.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getLeadIdParam(req);
            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const task = await query<{
                id: string;
                title: string;
                due_date: Date | null;
                done: boolean;
                done_at: Date | null;
                assigned_to: string | null;
                created_by: string;
                created_at: Date;
            }>(
                `INSERT INTO lead_tasks (lead_id, title, due_date, done, assigned_to, created_by)
                 VALUES ($1, $2, $3, false, $4, $5)
                 RETURNING id, title, due_date, done, done_at, assigned_to, created_by, created_at`,
                [
                    leadId,
                    parsed.data.title,
                    parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
                    parsed.data.assignedTo ?? null,
                    req.user.id,
                ]
            );

            await createLeadTimelineEvent({
                leadId,
                type: 'TASK_CREATED',
                title: `Tarefa criada: ${parsed.data.title}`,
                metadata: {
                    due_date: parsed.data.dueDate ?? null,
                    assigned_to: parsed.data.assignedTo ?? null,
                },
                createdBy: req.user.id,
            });

            res.status(201).json({ data: task.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:leadId/tasks/:taskId',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                next(AppError.unauthorized());
                return;
            }

            const parsed = taskPatchSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Atualização de tarefa inválida.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getPathParam(req, 'leadId');
            const taskId = getPathParam(req, 'taskId');

            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const existingTask = await query<{
                id: string;
                title: string;
                done: boolean;
            }>(
                `SELECT id, title, done
                 FROM lead_tasks
                 WHERE id = $1 AND lead_id = $2
                 LIMIT 1`,
                [taskId, leadId]
            );

            if (!existingTask.rows[0]) {
                next(AppError.notFound('Tarefa não encontrada para este lead.'));
                return;
            }

            const fields: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.title !== undefined) {
                values.push(parsed.data.title);
                fields.push(`title = $${values.length}`);
            }

            if (parsed.data.dueDate !== undefined) {
                values.push(parsed.data.dueDate ? new Date(parsed.data.dueDate) : null);
                fields.push(`due_date = $${values.length}`);
            }

            if (parsed.data.done !== undefined) {
                values.push(parsed.data.done);
                fields.push(`done = $${values.length}`);
                fields.push(`done_at = ${parsed.data.done ? 'NOW()' : 'NULL'}`);
            }

            values.push(taskId, leadId);
            const updated = await query(
                `UPDATE lead_tasks
                 SET ${fields.join(', ')}
                 WHERE id = $${values.length - 1}
                   AND lead_id = $${values.length}`,
                values
            );

            if (!updated.rowCount) {
                next(AppError.notFound('Tarefa não encontrada para este lead.'));
                return;
            }

            if (parsed.data.done === true && existingTask.rows[0].done === false) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'TASK_DONE',
                    title: `Tarefa concluída: ${existingTask.rows[0].title}`,
                    createdBy: req.user.id,
                });
            }

            const refreshedTask = await query(
                `SELECT id, title, due_date, done, done_at, assigned_to, created_by, created_at
                 FROM lead_tasks
                 WHERE id = $1
                 LIMIT 1`,
                [taskId]
            );

            res.json({ data: refreshedTask.rows[0] ?? null });
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/:leadId/tasks/:taskId',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadId = getPathParam(req, 'leadId');
            const taskId = getPathParam(req, 'taskId');

            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            await query(
                `DELETE FROM lead_tasks
                 WHERE id = $1 AND lead_id = $2`,
                [taskId, leadId]
            );

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/attachments',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'leads-attachments-upload' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                next(AppError.unauthorized());
                return;
            }

            await runAttachmentUpload(req, res);
            if (!req.file?.buffer) {
                next(AppError.badRequest('Arquivo obrigatório.'));
                return;
            }

            const leadId = getLeadIdParam(req);
            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filename = `${Date.now()}-${safeName}`;
            const dir = path.join(env().UPLOAD_PATH, 'leads', leadId);
            const diskPath = path.join(dir, filename);
            const publicPath = `/uploads/leads/${leadId}/${filename}`;

            await mkdir(dir, { recursive: true });
            await writeFile(diskPath, req.file.buffer);

            const attachment = await query<{
                id: string;
                lead_id: string;
                filename: string;
                file_path: string;
                file_size: number;
                mime_type: string;
                uploaded_by: string;
                created_at: Date;
            }>(
                `INSERT INTO lead_attachments (lead_id, filename, file_path, file_size, mime_type, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, lead_id, filename, file_path, file_size, mime_type, uploaded_by, created_at`,
                [leadId, safeName, publicPath, req.file.size, req.file.mimetype, req.user.id]
            );

            await createLeadTimelineEvent({
                leadId,
                type: 'ATTACHMENT_ADDED',
                title: 'Arquivo anexado ao lead',
                body: safeName,
                metadata: {
                    file_path: publicPath,
                    mime_type: req.file.mimetype,
                    file_size: req.file.size,
                },
                createdBy: req.user.id,
            });

            res.status(201).json({ data: attachment.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id/attachments',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadId = getLeadIdParam(req);
            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const attachments = await query(
                `SELECT id, lead_id, filename, file_path, file_size, mime_type, uploaded_by, created_at
                 FROM lead_attachments
                 WHERE lead_id = $1
                 ORDER BY created_at DESC`,
                [leadId]
            );

            res.json({ data: attachments.rows });
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/:leadId/attachments/:attachmentId',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadId = getPathParam(req, 'leadId');
            const attachmentId = getPathParam(req, 'attachmentId');

            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const existing = await query<{ file_path: string }>(
                `SELECT file_path
                 FROM lead_attachments
                 WHERE id = $1 AND lead_id = $2
                 LIMIT 1`,
                [attachmentId, leadId]
            );
            const filePath = existing.rows[0]?.file_path;

            await query(
                `DELETE FROM lead_attachments
                 WHERE id = $1 AND lead_id = $2`,
                [attachmentId, leadId]
            );

            if (filePath) {
                const diskPath = path.join(env().UPLOAD_PATH, filePath.replace(/^\/uploads\//, ''));
                await unlink(diskPath).catch(() => null);
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id/timeline',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = timelineQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros de timeline inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const leadId = getLeadIdParam(req);
            const lead = await fetchLeadById(leadId);
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }
            assertCanAccessAssignedRecord(req, lead.assigned_user_id);

            const cursorDate = parsed.data.cursor ? new Date(parsed.data.cursor) : null;
            const timelineValues: unknown[] = [leadId];
            let timelineCursorFilter = '';
            let messageCursorFilter = '';

            if (cursorDate) {
                timelineValues.push(cursorDate);
                timelineCursorFilter = ` AND lt.created_at < $${timelineValues.length}`;
            }

            const timelineResult = await query<{
                id: string;
                type: string;
                title: string;
                body: string | null;
                metadata: Record<string, unknown> | null;
                created_by: string | null;
                created_at: Date;
            }>(
                `SELECT
                    lt.id,
                    lt.type,
                    lt.title,
                    lt.body,
                    lt.metadata,
                    lt.created_by,
                    lt.created_at
                 FROM lead_timeline lt
                 WHERE lt.lead_id = $1
                 ${timelineCursorFilter}
                 ORDER BY lt.created_at DESC
                 LIMIT $${timelineValues.length + 1}`,
                [...timelineValues, parsed.data.limit]
            );

            if (cursorDate) {
                messageCursorFilter = ` AND m.created_at < $2`;
            }

            const messageRows = await query<{
                id: string;
                direction: 'INBOUND' | 'OUTBOUND';
                content: string | null;
                created_at: Date;
            }>(
                `SELECT
                    m.id,
                    m.direction,
                    m.content,
                    m.created_at
                 FROM messages m
                 INNER JOIN conversations c ON c.id = m.conversation_id
                 WHERE c.lead_id = $1
                 ${messageCursorFilter}
                 ORDER BY m.created_at DESC
                 LIMIT $${cursorDate ? 3 : 2}`,
                cursorDate ? [leadId, cursorDate, parsed.data.limit] : [leadId, parsed.data.limit]
            );

            const merged = [
                ...timelineResult.rows.map((row) => ({
                    id: row.id,
                    source: 'timeline',
                    type: row.type,
                    title: row.title,
                    body: row.body,
                    metadata: row.metadata,
                    created_by: row.created_by,
                    created_at: row.created_at,
                })),
                ...messageRows.rows.map((row) => ({
                    id: row.id,
                    source: 'whatsapp',
                    type: row.direction === 'INBOUND' ? 'MESSAGE_RECEIVED' : 'MESSAGE_SENT',
                    title: row.direction === 'INBOUND' ? 'Mensagem WhatsApp recebida' : 'Mensagem WhatsApp enviada',
                    body: row.content,
                    metadata: null,
                    created_by: null,
                    created_at: row.created_at,
                })),
            ]
                .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
                .slice(0, parsed.data.limit);

            const last = merged[merged.length - 1];
            const nextCursor = last ? last.created_at.toISOString() : null;

            res.json({
                data: merged,
                meta: {
                    limit: parsed.data.limit,
                    next_cursor: nextCursor,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// ── POST /leads/:id/won ───────────────────────────────────────────────────────
router.post(
    '/:id/won',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadId = req.params['id'] as string;
            const wonStage = await query<{ id: string }>(
                `SELECT id FROM pipeline_stages WHERE is_won = true ORDER BY position ASC LIMIT 1`
            );
            const wonStageId = wonStage.rows[0]?.id ?? null;

            await query(
                `UPDATE leads SET stage = 'CONVERTIDO', stage_id = COALESCE($1, stage_id), updated_at = NOW() WHERE id = $2`,
                [wonStageId, leadId]
            );
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'leads', entityId: leadId, oldValue: null, newValue: { stage: 'CONVERTIDO' }, req });
            res.json({ message: 'Lead marcado como ganho.' });
        } catch (err) { next(err); }
    }
);

// ── POST /leads/:id/lost ──────────────────────────────────────────────────────
router.post(
    '/:id/lost',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadId = req.params['id'] as string;
            const reason = String(req.body['reason'] ?? '');
            const lostStage = await query<{ id: string }>(
                `SELECT id FROM pipeline_stages WHERE is_lost = true ORDER BY position ASC LIMIT 1`
            );
            const lostStageId = lostStage.rows[0]?.id ?? null;

            await query(
                `UPDATE leads SET stage = 'PERDIDO', stage_id = COALESCE($1, stage_id), updated_at = NOW() WHERE id = $2`,
                [lostStageId, leadId]
            );
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'leads', entityId: leadId, oldValue: null, newValue: { stage: 'PERDIDO', reason }, req });
            res.json({ message: 'Lead marcado como perdido.' });
        } catch (err) { next(err); }
    }
);

router.post(
    '/:id/convert',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'leads-convert' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const leadParam = req.params['id'];
            const leadId = Array.isArray(leadParam) ? leadParam[0] : leadParam;
            if (!leadId) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            const result = await transaction(async (client) => {
                const leadResult = await client.query<{
                    id: string;
                    name: string | null;
                    whatsapp_number: string;
                    email: string | null;
                    stage: LeadStage;
                    stage_id: string | null;
                    assigned_to: string | null;
                    converted_customer_id: string | null;
                }>(
                    `SELECT id, name, whatsapp_number, email, stage, stage_id, assigned_to, converted_customer_id
                     FROM leads
                     WHERE id = $1
                     LIMIT 1`,
                    [leadId]
                );

                const lead = leadResult.rows[0];
                if (!lead) {
                    throw AppError.notFound('Lead não encontrado.');
                }

                assertCanAccessAssignedRecord(req, lead.assigned_to);

                if (lead.converted_customer_id) {
                    const existingCustomerResult = await client.query<{
                        id: string;
                        name: string;
                        whatsapp_number: string;
                        email: string | null;
                        assigned_to: string | null;
                        lifetime_value_cents: string;
                        created_at: Date;
                        updated_at: Date;
                    }>(
                        `SELECT id, name, whatsapp_number, email, assigned_to, lifetime_value_cents::text, created_at, updated_at
                         FROM customers
                         WHERE id = $1
                         LIMIT 1`,
                        [lead.converted_customer_id]
                    );

                    return {
                        statusCode: 200,
                        customer: existingCustomerResult.rows[0] ?? null,
                    };
                }

                if (!lead.name) {
                    throw AppError.badRequest('O lead precisa ter nome antes de ser convertido em cliente.');
                }

                const existingCustomer = await client.query<{
                    id: string;
                    name: string;
                    whatsapp_number: string;
                    email: string | null;
                    assigned_to: string | null;
                    lifetime_value_cents: string;
                    created_at: Date;
                    updated_at: Date;
                }>(
                    `SELECT id, name, whatsapp_number, email, assigned_to, lifetime_value_cents::text, created_at, updated_at
                     FROM customers
                     WHERE whatsapp_number = $1
                     LIMIT 1`,
                    [lead.whatsapp_number]
                );

                let customer = existingCustomer.rows[0] ?? null;

                if (!customer) {
                    const customerInsertResult = await client.query<{
                        id: string;
                        name: string;
                        whatsapp_number: string;
                        email: string | null;
                        assigned_to: string | null;
                        lifetime_value_cents: string;
                        created_at: Date;
                        updated_at: Date;
                    }>(
                        `INSERT INTO customers (name, whatsapp_number, email, assigned_to)
                         VALUES ($1, $2, $3, $4)
                         RETURNING id, name, whatsapp_number, email, assigned_to, lifetime_value_cents::text, created_at, updated_at`,
                        [lead.name, lead.whatsapp_number, lead.email, lead.assigned_to]
                    );
                    customer = customerInsertResult.rows[0] ?? null;
                }

                if (!customer) {
                    throw AppError.internal(req.requestId);
                }

                const wonStage = await client.query<{ id: string }>(
                    `SELECT id FROM pipeline_stages WHERE is_won = true ORDER BY position ASC LIMIT 1`
                );

                await client.query(
                    `UPDATE leads
                     SET stage = 'CONVERTIDO',
                         stage_id = COALESCE($1, stage_id),
                         converted_customer_id = $2,
                         updated_at = NOW()
                     WHERE id = $3`,
                    [wonStage.rows[0]?.id ?? null, customer.id, lead.id]
                );

                return {
                    statusCode: 201,
                    customer,
                };
            });

            if (req.user && result.customer) {
                await createLeadTimelineEvent({
                    leadId,
                    type: 'LEAD_CONVERTED',
                    title: 'Lead convertido em cliente',
                    metadata: { customer_id: result.customer.id },
                    createdBy: req.user.id,
                });

                await createAuditLog({
                    userId: req.user.id,
                    action: 'CONVERT',
                    entityType: 'leads',
                    entityId: leadId,
                    oldValue: { stage: 'NEGOCIACAO' },
                    newValue: { stage: 'CONVERTIDO', customer_id: result.customer.id },
                    req,
                });
            }

            res.status(result.statusCode).json({ customer: result.customer });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
