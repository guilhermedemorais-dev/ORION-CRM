import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requirePermission } from '../middleware/permissions.js';
import {
    RULE_ACTION_TYPES,
    RULE_LINK_STRATEGIES,
    RULE_TRIGGER_EVENTS,
    getBuilderOrganizationId,
    normalizeRuleCreateInput,
    simulateRuleExecution,
    type RuleNormalized,
} from '../services/pipeline-rules.service.js';

// PRD: PRD.DOCS/Build Pipeline/PRD-PIPELINE-BUILDER-V2.md §8.4 / §9
// Rotas CRUD + dry-run de simulação para regras simples entre pipelines.
// Não dispara o executor real (Fase 3) — apenas configura e valida.

type QueryFn = typeof query;
type AuthMiddleware = typeof authenticate;
type PermissionFactory = typeof requirePermission;
type AuditFn = typeof createAuditLog;
type OrganizationIdFn = typeof getBuilderOrganizationId;

interface PipelineRulesRouterDeps {
    query: QueryFn;
    authenticate: AuthMiddleware;
    requirePermission: PermissionFactory;
    createAuditLog: AuditFn;
    getOrganizationId: OrganizationIdFn;
}

const createSchema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    source_stage_id: z.string().uuid(),
    trigger_event: z.enum(RULE_TRIGGER_EVENTS),
    action_type: z.enum(RULE_ACTION_TYPES),
    target_pipeline_id: z.string().uuid(),
    target_stage_id: z.string().uuid(),
    link_strategy: z.enum(RULE_LINK_STRATEGIES).optional(),
    is_active: z.boolean().optional(),
});

const updateSchema = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    source_stage_id: z.string().uuid().optional(),
    trigger_event: z.enum(RULE_TRIGGER_EVENTS).optional(),
    action_type: z.enum(RULE_ACTION_TYPES).optional(),
    target_pipeline_id: z.string().uuid().optional(),
    target_stage_id: z.string().uuid().optional(),
    link_strategy: z.enum(RULE_LINK_STRATEGIES).optional(),
    is_active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo informado.' });

const simulateSchema = z.object({
    lead_id: z.string().uuid(),
});

interface RuleRow {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    source_pipeline_id: string;
    source_stage_id: string;
    trigger_event: string;
    action_type: string;
    target_pipeline_id: string;
    target_stage_id: string;
    link_strategy: string;
    is_active: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
}

function mapRule(row: RuleRow) {
    return {
        id: row.id,
        organization_id: row.organization_id,
        name: row.name,
        description: row.description,
        source_pipeline_id: row.source_pipeline_id,
        source_stage_id: row.source_stage_id,
        trigger_event: row.trigger_event,
        action_type: row.action_type,
        target_pipeline_id: row.target_pipeline_id,
        target_stage_id: row.target_stage_id,
        link_strategy: row.link_strategy,
        is_active: row.is_active,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function getPipelineId(req: Request): string {
    const id = req.params['id'];
    if (!id || Array.isArray(id)) {
        throw AppError.badRequest('Pipeline inválido.');
    }
    return id;
}

function getRuleId(req: Request): string {
    const id = req.params['ruleId'];
    if (!id || Array.isArray(id)) {
        throw AppError.badRequest('Regra inválida.');
    }
    return id;
}

async function assertPipelineExists(deps: PipelineRulesRouterDeps, id: string): Promise<void> {
    const result = await deps.query<{ id: string }>('SELECT id FROM pipelines WHERE id = $1 LIMIT 1', [id]);
    if (!result.rows[0]) {
        throw AppError.notFound('Pipeline não encontrado.');
    }
}

async function assertStageBelongsToPipeline(deps: PipelineRulesRouterDeps, stageId: string, pipelineId: string): Promise<void> {
    const result = await deps.query<{ id: string }>(
        'SELECT id FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2 LIMIT 1',
        [stageId, pipelineId]
    );
    if (!result.rows[0]) {
        throw AppError.badRequest('Etapa não pertence ao pipeline informado.');
    }
}

async function fetchRule(deps: PipelineRulesRouterDeps, ruleId: string, sourcePipelineId: string): Promise<RuleRow | null> {
    const organizationId = await deps.getOrganizationId();
    const result = await deps.query<RuleRow>(
        `SELECT * FROM pipeline_automation_rules
         WHERE id = $1
           AND source_pipeline_id = $2
           AND organization_id = $3
         LIMIT 1`,
        [ruleId, sourcePipelineId, organizationId]
    );
    return result.rows[0] ?? null;
}

export function createPipelineRulesRouter(overrides: Partial<PipelineRulesRouterDeps> = {}) {
    const deps: PipelineRulesRouterDeps = {
        query,
        authenticate,
        requirePermission,
        createAuditLog,
        getOrganizationId: getBuilderOrganizationId,
        ...overrides,
    };

    const router = Router({ mergeParams: true });

router.use(deps.authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const pipelineId = getPipelineId(req);
        const organizationId = await deps.getOrganizationId();
        await assertPipelineExists(deps, pipelineId);
        const result = await deps.query<RuleRow>(
            `SELECT * FROM pipeline_automation_rules
             WHERE source_pipeline_id = $1
               AND organization_id = $2
             ORDER BY created_at DESC`,
            [pipelineId, organizationId]
        );
        res.json({ data: result.rows.map(mapRule) });
    } catch (err) {
        next(err);
    }
});

router.post(
    '/',
    deps.requirePermission('pipeline.configure'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = getPipelineId(req);
            const organizationId = await deps.getOrganizationId();
            const parsed = createSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Regra inválida.',
                    parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            await assertPipelineExists(deps, pipelineId);
            await assertStageBelongsToPipeline(deps, parsed.data.source_stage_id, pipelineId);
            await assertPipelineExists(deps, parsed.data.target_pipeline_id);
            await assertStageBelongsToPipeline(deps, parsed.data.target_stage_id, parsed.data.target_pipeline_id);

            const normalized: RuleNormalized = normalizeRuleCreateInput({
                name: parsed.data.name,
                description: parsed.data.description ?? null,
                sourcePipelineId: pipelineId,
                sourceStageId: parsed.data.source_stage_id,
                triggerEvent: parsed.data.trigger_event,
                actionType: parsed.data.action_type,
                targetPipelineId: parsed.data.target_pipeline_id,
                targetStageId: parsed.data.target_stage_id,
                linkStrategy: parsed.data.link_strategy,
                isActive: parsed.data.is_active,
            });

            const result = await deps.query<RuleRow>(
                `INSERT INTO pipeline_automation_rules
                    (organization_id, name, description, source_pipeline_id, source_stage_id, trigger_event,
                     action_type, target_pipeline_id, target_stage_id, link_strategy,
                     is_active, created_by, updated_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
                 RETURNING *`,
                [
                    organizationId,
                    normalized.name,
                    normalized.description,
                    normalized.sourcePipelineId,
                    normalized.sourceStageId,
                    normalized.triggerEvent,
                    normalized.actionType,
                    normalized.targetPipelineId,
                    normalized.targetStageId,
                    normalized.linkStrategy,
                    normalized.isActive,
                    req.user?.id ?? null,
                ]
            );

            const created = result.rows[0];
            if (!created) throw AppError.internal(req.requestId);

            if (req.user) {
                await deps.createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE_PIPELINE_RULE',
                    entityType: 'pipeline_automation_rules',
                    entityId: created.id,
                    oldValue: null,
                    newValue: mapRule(created),
                    req,
                });
            }

            res.status(201).json({ data: mapRule(created) });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:ruleId',
    deps.requirePermission('pipeline.configure'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = getPipelineId(req);
            const ruleId = getRuleId(req);
            const parsed = updateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Regra inválida.'));
                return;
            }

            const existing = await fetchRule(deps, ruleId, pipelineId);
            if (!existing) {
                next(AppError.notFound('Regra não encontrada.'));
                return;
            }

            const merged = {
                source_stage_id: parsed.data.source_stage_id ?? existing.source_stage_id,
                target_pipeline_id: parsed.data.target_pipeline_id ?? existing.target_pipeline_id,
                target_stage_id: parsed.data.target_stage_id ?? existing.target_stage_id,
            };

            await assertStageBelongsToPipeline(deps, merged.source_stage_id, pipelineId);
            await assertPipelineExists(deps, merged.target_pipeline_id);
            await assertStageBelongsToPipeline(deps, merged.target_stage_id, merged.target_pipeline_id);

            // re-validate via service (distinctness, name length, link strategy)
            normalizeRuleCreateInput({
                name: parsed.data.name ?? existing.name,
                description: parsed.data.description ?? existing.description,
                sourcePipelineId: pipelineId,
                sourceStageId: merged.source_stage_id,
                triggerEvent: (parsed.data.trigger_event ?? existing.trigger_event) as RuleNormalized['triggerEvent'],
                actionType: (parsed.data.action_type ?? existing.action_type) as RuleNormalized['actionType'],
                targetPipelineId: merged.target_pipeline_id,
                targetStageId: merged.target_stage_id,
                linkStrategy: (parsed.data.link_strategy ?? existing.link_strategy) as RuleNormalized['linkStrategy'],
                isActive: parsed.data.is_active ?? existing.is_active,
            });

            const fields: string[] = [];
            const values: unknown[] = [];
            const add = (col: string, val: unknown) => {
                values.push(val);
                fields.push(`${col} = $${values.length}`);
            };

            if (parsed.data.name !== undefined) add('name', parsed.data.name.trim());
            if (parsed.data.description !== undefined) add('description', parsed.data.description);
            if (parsed.data.source_stage_id !== undefined) add('source_stage_id', parsed.data.source_stage_id);
            if (parsed.data.trigger_event !== undefined) add('trigger_event', parsed.data.trigger_event);
            if (parsed.data.action_type !== undefined) add('action_type', parsed.data.action_type);
            if (parsed.data.target_pipeline_id !== undefined) add('target_pipeline_id', parsed.data.target_pipeline_id);
            if (parsed.data.target_stage_id !== undefined) add('target_stage_id', parsed.data.target_stage_id);
            if (parsed.data.link_strategy !== undefined) add('link_strategy', parsed.data.link_strategy);
            if (parsed.data.is_active !== undefined) add('is_active', parsed.data.is_active);

            add('updated_by', req.user?.id ?? null);
            fields.push('updated_at = NOW()');

            values.push(ruleId, pipelineId);
            const result = await deps.query<RuleRow>(
                `UPDATE pipeline_automation_rules
                 SET ${fields.join(', ')}
                 WHERE id = $${values.length - 1}
                   AND source_pipeline_id = $${values.length}
                 RETURNING *`,
                values
            );

            const updated = result.rows[0];
            if (!updated) {
                next(AppError.notFound('Regra não encontrada.'));
                return;
            }

            if (req.user) {
                await deps.createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_PIPELINE_RULE',
                    entityType: 'pipeline_automation_rules',
                    entityId: updated.id,
                    oldValue: mapRule(existing),
                    newValue: mapRule(updated),
                    req,
                });
            }

            res.json({ data: mapRule(updated) });
        } catch (err) {
            next(err);
        }
    }
);

router.delete(
    '/:ruleId',
    deps.requirePermission('pipeline.configure'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = getPipelineId(req);
            const ruleId = getRuleId(req);
            const existing = await fetchRule(deps, ruleId, pipelineId);
            if (!existing) {
                next(AppError.notFound('Regra não encontrada.'));
                return;
            }

            await deps.query('DELETE FROM pipeline_automation_rules WHERE id = $1', [ruleId]);

            if (req.user) {
                await deps.createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE_PIPELINE_RULE',
                    entityType: 'pipeline_automation_rules',
                    entityId: ruleId,
                    oldValue: mapRule(existing),
                    newValue: null,
                    req,
                });
            }

            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/:ruleId/test',
    deps.requirePermission('pipeline.configure'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = getPipelineId(req);
            const ruleId = getRuleId(req);
            const parsed = simulateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Informe lead_id válido.'));
                return;
            }

            const rule = await fetchRule(deps, ruleId, pipelineId);
            if (!rule) {
                next(AppError.notFound('Regra não encontrada.'));
                return;
            }

            const leadResult = await deps.query<{
                id: string;
                name: string | null;
                pipeline_id: string;
                stage_id: string | null;
            }>(
                `SELECT id, name, pipeline_id, stage_id FROM leads WHERE id = $1 LIMIT 1`,
                [parsed.data.lead_id]
            );
            const lead = leadResult.rows[0];
            if (!lead) {
                next(AppError.notFound('Lead não encontrado.'));
                return;
            }

            const result = simulateRuleExecution({
                rule: {
                    name: rule.name,
                    description: rule.description,
                    sourcePipelineId: rule.source_pipeline_id,
                    sourceStageId: rule.source_stage_id,
                    triggerEvent: rule.trigger_event as RuleNormalized['triggerEvent'],
                    actionType: rule.action_type as RuleNormalized['actionType'],
                    targetPipelineId: rule.target_pipeline_id,
                    targetStageId: rule.target_stage_id,
                    linkStrategy: rule.link_strategy as RuleNormalized['linkStrategy'],
                    isActive: rule.is_active,
                },
                leadSnapshot: {
                    id: lead.id,
                    name: lead.name,
                    pipelineId: lead.pipeline_id,
                    stageId: lead.stage_id,
                },
            });

            res.json({ data: result });
        } catch (err) {
            next(err);
        }
    }
);

    return router;
}

export default createPipelineRulesRouter();
