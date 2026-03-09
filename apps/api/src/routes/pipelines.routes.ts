import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';
import type { LeadSource, LeadStage } from '../types/entities.js';
import {
    assertPublishablePipelineFlow,
    isPipelineVisibleForRole,
    normalizePipelineSlug,
} from '../services/pipelines.service.js';

const router = Router();

const pipelineCreateSchema = z.object({
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    icon: z.string().trim().min(1).max(32).optional(),
});

const pipelineUpdateSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    icon: z.string().trim().min(1).max(32).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo informado para atualizar.',
});

const pipelineToggleSchema = z.object({
    is_active: z.boolean(),
});

const flowSaveSchema = z.object({
    flow_json: z.unknown().optional(),
    flow: z.unknown().optional(),
}).refine((data) => data.flow_json !== undefined || data.flow !== undefined, {
    message: 'Informe o flow do pipeline.',
});

const pipelineStageCreateSchema = z.object({
    name: z.string().trim().min(2).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    position: z.coerce.number().int().min(1),
    is_won: z.boolean().optional(),
    is_lost: z.boolean().optional(),
}).refine((data) => !(data.is_won && data.is_lost), {
    message: 'Uma etapa não pode ser de ganho e perda ao mesmo tempo.',
});

const pipelineStageReorderSchema = z.object({
    stages: z.array(z.object({
        id: z.string().uuid(),
        position: z.coerce.number().int().min(1),
    })).min(1),
});

const pipelineStageParamsSchema = z.object({
    id: z.string().uuid(),
    stageId: z.string().uuid(),
});

const pipelineLeadsQuerySchema = z.object({
    stage_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface PipelineRow {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string;
    is_active: boolean;
    is_default: boolean;
    flow_json: Record<string, unknown>;
    published_at: Date | null;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
}

interface PipelineStageRow {
    id: string;
    pipeline_id: string;
    name: string;
    color: string;
    position: number;
    is_won: boolean;
    is_lost: boolean;
    created_at: Date;
}

interface LeadBoardRow {
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

function getPipelineIdParam(req: Request): string {
    const id = req.params['id'];
    if (!id || Array.isArray(id)) {
        throw AppError.badRequest('Pipeline inválido.');
    }
    return id;
}

function mapPipeline(row: PipelineRow) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        icon: row.icon,
        is_active: row.is_active,
        is_default: row.is_default,
        flow_json: row.flow_json ?? {},
        published_at: row.published_at,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function mapPipelineStage(row: PipelineStageRow) {
    return {
        id: row.id,
        pipeline_id: row.pipeline_id,
        name: row.name,
        color: row.color,
        position: row.position,
        is_won: row.is_won,
        is_lost: row.is_lost,
        created_at: row.created_at,
    };
}

function mapLead(row: LeadBoardRow) {
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

async function fetchPipelineById(id: string): Promise<PipelineRow | null> {
    const result = await query<PipelineRow>(
        `SELECT id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at
         FROM pipelines
         WHERE id = $1
         LIMIT 1`,
        [id]
    );

    return result.rows[0] ?? null;
}

async function fetchPipelineBySlug(slug: string): Promise<PipelineRow | null> {
    const result = await query<PipelineRow>(
        `SELECT id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at
         FROM pipelines
         WHERE slug = $1
         LIMIT 1`,
        [slug]
    );

    return result.rows[0] ?? null;
}

async function assertPipelineAccess(req: Request, pipeline: PipelineRow): Promise<void> {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (!isPipelineVisibleForRole(pipeline.is_active, req.user.role)) {
        throw AppError.forbidden('Você não pode acessar este pipeline.');
    }
}

router.use(authenticate);

router.get(
    '/',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'pipelines-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<PipelineRow>(
                `SELECT id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at
                 FROM pipelines
                 ORDER BY is_default DESC, created_at ASC`
            );

            const data = result.rows
                .filter((row) => isPipelineVisibleForRole(row.is_active, req.user?.role ?? 'ATENDENTE'))
                .map(mapPipeline);

            res.json({
                data,
                meta: {
                    total: data.length,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/slug/:slug',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const slug = req.params['slug'];
            if (!slug || Array.isArray(slug)) {
                next(AppError.badRequest('Slug de pipeline inválido.'));
                return;
            }

            const pipeline = await fetchPipelineBySlug(slug);
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            await assertPipelineAccess(req, pipeline);
            res.json(mapPipeline(pipeline));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineCreateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Pipeline inválido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const slug = normalizePipelineSlug(parsed.data.slug ?? parsed.data.name);
            if (!slug) {
                next(AppError.badRequest('Não foi possível gerar um slug válido para o pipeline.'));
                return;
            }

            const result = await query<PipelineRow>(
                `INSERT INTO pipelines (name, slug, description, icon, created_by)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at`,
                [
                    parsed.data.name,
                    slug,
                    parsed.data.description ?? null,
                    parsed.data.icon ?? 'workflow',
                    req.user?.id ?? null,
                ]
            );

            const created = result.rows[0];
            if (!created) {
                throw AppError.internal(req.requestId);
            }

            res.status(201).json(mapPipeline(created));
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipeline = await fetchPipelineById(getPipelineIdParam(req));
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            await assertPipelineAccess(req, pipeline);
            res.json(mapPipeline(pipeline));
        } catch (error) {
            next(error);
        }
    }
);

router.put(
    '/:id',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineUpdateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Dados inválidos para atualizar o pipeline.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const fields: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.name !== undefined) {
                values.push(parsed.data.name);
                fields.push(`name = $${values.length}`);
            }
            if (parsed.data.description !== undefined) {
                values.push(parsed.data.description);
                fields.push(`description = $${values.length}`);
            }
            if (parsed.data.icon !== undefined) {
                values.push(parsed.data.icon);
                fields.push(`icon = $${values.length}`);
            }

            fields.push('updated_at = NOW()');
            values.push(getPipelineIdParam(req));

            const result = await query<PipelineRow>(
                `UPDATE pipelines
                 SET ${fields.join(', ')}
                 WHERE id = $${values.length}
                 RETURNING id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at`,
                values
            );

            if (!result.rows[0]) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            res.json(mapPipeline(result.rows[0]));
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:id/toggle',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineToggleSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Toggle de pipeline inválido.'));
                return;
            }

            const result = await query<PipelineRow>(
                `UPDATE pipelines
                 SET is_active = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at`,
                [parsed.data.is_active, getPipelineIdParam(req)]
            );

            if (!result.rows[0]) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            res.json(mapPipeline(result.rows[0]));
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/:id',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipeline = await fetchPipelineById(getPipelineIdParam(req));
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            if (pipeline.is_default) {
                next(AppError.forbidden('Pipelines padrão não podem ser removidos.'));
                return;
            }

            const [stagesResult, leadsResult] = await Promise.all([
                query<{ total: string }>('SELECT COUNT(*)::text AS total FROM pipeline_stages WHERE pipeline_id = $1', [pipeline.id]),
                query<{ total: string }>('SELECT COUNT(*)::text AS total FROM leads WHERE pipeline_id = $1', [pipeline.id]),
            ]);

            if (Number(stagesResult.rows[0]?.total ?? '0') > 0 || Number(leadsResult.rows[0]?.total ?? '0') > 0) {
                next(AppError.badRequest('O pipeline só pode ser removido quando estiver vazio.'));
                return;
            }

            await query('DELETE FROM pipelines WHERE id = $1', [pipeline.id]);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.put(
    '/:id/flow',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = flowSaveSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Flow inválido para salvar.'));
                return;
            }

            const flowJson = (parsed.data.flow_json ?? parsed.data.flow) as Record<string, unknown>;
            const result = await query<PipelineRow>(
                `UPDATE pipelines
                 SET flow_json = $1::jsonb,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at`,
                [JSON.stringify(flowJson ?? {}), getPipelineIdParam(req)]
            );

            if (!result.rows[0]) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            res.json(mapPipeline(result.rows[0]));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/publish',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipeline = await fetchPipelineById(getPipelineIdParam(req));
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            const stages = await query<{ total: string }>(
                'SELECT COUNT(*)::text AS total FROM pipeline_stages WHERE pipeline_id = $1',
                [pipeline.id]
            );

            if (Number(stages.rows[0]?.total ?? '0') === 0) {
                next(AppError.badRequest('O pipeline precisa ter etapas antes da publicação.'));
                return;
            }

            assertPublishablePipelineFlow(pipeline.flow_json);

            const result = await query<PipelineRow>(
                `UPDATE pipelines
                 SET published_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, name, slug, description, icon, is_active, is_default, flow_json, published_at, created_by, created_at, updated_at`,
                [pipeline.id]
            );

            const published = result.rows[0];
            if (!published) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            res.json(mapPipeline(published));
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id/stages',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipeline = await fetchPipelineById(getPipelineIdParam(req));
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            await assertPipelineAccess(req, pipeline);

            const result = await query<PipelineStageRow>(
                `SELECT id, pipeline_id, name, color, position, is_won, is_lost, created_at
                 FROM pipeline_stages
                 WHERE pipeline_id = $1
                 ORDER BY position ASC, created_at ASC`,
                [pipeline.id]
            );

            res.json({ data: result.rows.map(mapPipelineStage) });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/stages',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineStageCreateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Etapa inválida.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const pipeline = await fetchPipelineById(getPipelineIdParam(req));
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            if (parsed.data.is_won) {
                await query('UPDATE pipeline_stages SET is_won = false WHERE pipeline_id = $1 AND is_won = true', [pipeline.id]);
            }
            if (parsed.data.is_lost) {
                await query('UPDATE pipeline_stages SET is_lost = false WHERE pipeline_id = $1 AND is_lost = true', [pipeline.id]);
            }

            const result = await query<PipelineStageRow>(
                `INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_won, is_lost)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, pipeline_id, name, color, position, is_won, is_lost, created_at`,
                [
                    pipeline.id,
                    parsed.data.name,
                    parsed.data.color,
                    parsed.data.position,
                    parsed.data.is_won ?? false,
                    parsed.data.is_lost ?? false,
                ]
            );

            const createdStage = result.rows[0];
            if (!createdStage) {
                throw AppError.internal(req.requestId);
            }

            res.status(201).json({ data: mapPipelineStage(createdStage) });
        } catch (error) {
            next(error);
        }
    }
);

router.put(
    '/:id/stages/reorder',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineStageReorderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload de reordenação inválido.'));
                return;
            }

            const pipelineId = getPipelineIdParam(req);

            await transaction(async (client) => {
                for (const stage of parsed.data.stages) {
                    await client.query(
                        `UPDATE pipeline_stages
                         SET position = $1
                         WHERE id = $2
                           AND pipeline_id = $3`,
                        [stage.position, stage.id, pipelineId]
                    );
                }
            });

            const result = await query<PipelineStageRow>(
                `SELECT id, pipeline_id, name, color, position, is_won, is_lost, created_at
                 FROM pipeline_stages
                 WHERE pipeline_id = $1
                 ORDER BY position ASC, created_at ASC`,
                [pipelineId]
            );

            res.json({ data: result.rows.map(mapPipelineStage) });
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/:id/stages/:stageId',
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineStageParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Etapa inválida.'));
                return;
            }

            const stageResult = await query<{ id: string; is_won: boolean; is_lost: boolean }>(
                `SELECT id, is_won, is_lost
                 FROM pipeline_stages
                 WHERE id = $1 AND pipeline_id = $2
                 LIMIT 1`,
                [parsed.data.stageId, parsed.data.id]
            );

            const stage = stageResult.rows[0];
            if (!stage) {
                next(AppError.notFound('Etapa não encontrada.'));
                return;
            }

            if (stage.is_won || stage.is_lost) {
                next(AppError.forbidden('Etapas de ganho/perda não podem ser removidas.'));
                return;
            }

            const leadsCount = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM leads
                 WHERE pipeline_id = $1
                   AND stage_id = $2`,
                [parsed.data.id, parsed.data.stageId]
            );

            if (Number(leadsCount.rows[0]?.total ?? '0') > 0) {
                next(AppError.badRequest('Existem leads nesta etapa. Mova-os antes de excluir.'));
                return;
            }

            await query(
                `DELETE FROM pipeline_stages
                 WHERE id = $1 AND pipeline_id = $2`,
                [parsed.data.stageId, parsed.data.id]
            );

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id/leads',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'pipeline-leads' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = pipelineLeadsQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const pipeline = await fetchPipelineById(getPipelineIdParam(req));
            if (!pipeline) {
                next(AppError.notFound('Pipeline não encontrado.'));
                return;
            }

            await assertPipelineAccess(req, pipeline);

            const filters: string[] = ['l.pipeline_id = $1'];
            const values: unknown[] = [pipeline.id];

            if (parsed.data.stage_id) {
                values.push(parsed.data.stage_id);
                filters.push(`l.stage_id = $${values.length}`);
            }

            const assignedTo = req.user?.role === 'ATENDENTE'
                ? req.user.id
                : parsed.data.assigned_to;

            if (assignedTo) {
                values.push(assignedTo);
                filters.push(`l.assigned_to = $${values.length}`);
            }

            if (parsed.data.q) {
                values.push(`%${parsed.data.q}%`);
                filters.push(`(
                    COALESCE(l.name, '') ILIKE $${values.length}
                    OR l.whatsapp_number ILIKE $${values.length}
                    OR COALESCE(l.email, '') ILIKE $${values.length}
                    OR COALESCE(l.notes, '') ILIKE $${values.length}
                    OR COALESCE(l.quick_note, '') ILIKE $${values.length}
                )`);
            }

            const whereClause = `WHERE ${filters.join(' AND ')}`;

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM leads l
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<LeadBoardRow>(
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
                 LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
                 LEFT JOIN users u ON u.id = l.assigned_to
                 ${whereClause}
                 ORDER BY COALESCE(ps.position, 999) ASC, l.updated_at DESC
                 LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapLead),
                meta: {
                    total,
                    page: parsed.data.page,
                    limit: parsed.data.limit,
                    pages: Math.max(1, Math.ceil(total / parsed.data.limit)),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
