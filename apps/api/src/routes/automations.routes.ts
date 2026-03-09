import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { getAutomationCatalog } from '../services/automation-catalog.service.js';
import { N8nService, type N8nConnections, type N8nWorkflow } from '../services/n8n.service.js';

const router = Router();

const nodeSchema = z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    typeVersion: z.coerce.number().positive(),
    position: z.tuple([z.coerce.number(), z.coerce.number()]),
    parameters: z.record(z.string(), z.unknown()).default({}),
    credentials: z.record(z.string(), z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
    })).optional(),
});

const flowSchema = z.object({
    name: z.string().trim().min(3).max(255),
    active: z.boolean().optional(),
    nodes: z.array(nodeSchema).min(1),
    connections: z.record(z.string(), z.object({
        main: z.array(z.array(z.object({
            node: z.string().trim().min(1),
            type: z.string().trim().min(1),
            index: z.coerce.number().int().min(0),
        }))).optional(),
    })).default({}),
    settings: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string().trim().min(1).max(64)).optional(),
});

const toggleSchema = z.object({
    active: z.boolean(),
});

const executionListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

function normalizeTags(tags: N8nWorkflow['tags']): string[] {
    if (!tags) return [];
    const names = tags.map((tag) => typeof tag === 'string' ? tag : tag.name).filter(Boolean);
    return Array.from(new Set(names.map((name) => name.trim().toLowerCase())));
}

function isSystemWorkflow(workflow: N8nWorkflow): boolean {
    const tags = normalizeTags(workflow.tags);
    if (tags.includes('sistema') || tags.includes('system')) {
        return true;
    }

    const normalized = workflow.name.trim().toUpperCase();
    return normalized.startsWith('WF-A-')
        || normalized.startsWith('WF-B-')
        || normalized.startsWith('WF-C-')
        || normalized.startsWith('WF-D-');
}

function detectTriggerType(workflow: Pick<N8nWorkflow, 'nodes'>): string {
    const firstNode = workflow.nodes[0];
    if (!firstNode) return 'manual';
    if (firstNode.type.includes('webhook')) return 'webhook';
    if (firstNode.type.includes('schedule')) return 'schedule';
    return firstNode.type;
}

function getWorkflowIdParam(req: Request): string {
    const workflowId = req.params['workflowId'];
    if (!workflowId || Array.isArray(workflowId)) {
        throw AppError.badRequest('Identificador do workflow inválido.');
    }
    return workflowId;
}

async function upsertAutomationFlow(workflow: N8nWorkflow, userId: string): Promise<void> {
    if (!workflow.id) return;

    const status = workflow.active ? 'active' : 'inactive';
    const triggerType = detectTriggerType(workflow);

    await query(
        `INSERT INTO automation_flows (
            name,
            status,
            n8n_workflow_id,
            flow_definition,
            trigger_type,
            last_deployed_at,
            created_by
         ) VALUES (
            $1, $2::flow_status, $3, $4::jsonb, $5, NOW(), $6
         )
         ON CONFLICT (n8n_workflow_id)
         DO UPDATE SET
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            flow_definition = EXCLUDED.flow_definition,
            trigger_type = EXCLUDED.trigger_type,
            last_deployed_at = NOW(),
            updated_at = NOW()`,
        [
            workflow.name,
            status,
            workflow.id,
            JSON.stringify(workflow),
            triggerType,
            userId,
        ]
    );
}

router.use(authenticate, requireRole(['ADMIN']));

router.get('/catalog', async (_req: Request, res: Response): Promise<void> => {
    res.json({
        data: getAutomationCatalog(),
        meta: {
            total: 3,
        },
    });
});

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const n8n = new N8nService();
        const workflows = await n8n.listWorkflows();
        const workflowIds = workflows
            .map((workflow) => workflow.id)
            .filter((id): id is string => typeof id === 'string');

        const localByN8nId = new Map<string, {
            execution_count: number;
            error_count: number;
            last_execution_at: string | null;
            status: string;
        }>();

        if (workflowIds.length > 0) {
            const local = await query<{
                n8n_workflow_id: string;
                execution_count: number;
                error_count: number;
                last_execution_at: Date | null;
                status: string;
            }>(
                `SELECT n8n_workflow_id, execution_count, error_count, last_execution_at, status
                 FROM automation_flows
                 WHERE n8n_workflow_id = ANY($1::varchar[])`,
                [workflowIds]
            );

            for (const row of local.rows) {
                localByN8nId.set(row.n8n_workflow_id, {
                    execution_count: row.execution_count,
                    error_count: row.error_count,
                    last_execution_at: row.last_execution_at?.toISOString() ?? null,
                    status: row.status,
                });
            }
        }

        const data = workflows.map((workflow) => {
            const local = workflow.id ? localByN8nId.get(workflow.id) : undefined;
            const tags = normalizeTags(workflow.tags);
            return {
                id: workflow.id ?? null,
                name: workflow.name,
                active: workflow.active,
                is_system: isSystemWorkflow(workflow),
                tags,
                nodes_count: workflow.nodes?.length ?? 0,
                created_at: workflow.createdAt ?? null,
                updated_at: workflow.updatedAt ?? null,
                execution_count: local?.execution_count ?? 0,
                error_count: local?.error_count ?? 0,
                last_execution_at: local?.last_execution_at ?? null,
                status: local?.status ?? (workflow.active ? 'active' : 'inactive'),
            };
        });

        res.json({
            data,
            meta: {
                total: data.length,
            },
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:workflowId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const n8n = new N8nService();
        const workflow = await n8n.getWorkflow(getWorkflowIdParam(req));
        res.json({
            ...workflow,
            is_system: isSystemWorkflow(workflow),
            tags: normalizeTags(workflow.tags),
        });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            next(AppError.unauthorized());
            return;
        }

        const parsed = flowSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest('Payload inválido para criação de automação.'));
            return;
        }

        const n8n = new N8nService();
        const payload: N8nWorkflow = {
            name: parsed.data.name,
            active: parsed.data.active ?? false,
            nodes: parsed.data.nodes,
            connections: parsed.data.connections as N8nConnections,
            settings: parsed.data.settings,
            tags: Array.from(new Set(['orion-custom', ...(parsed.data.tags ?? [])])),
        };

        const created = await n8n.createWorkflow(payload);
        await upsertAutomationFlow(created, req.user.id);

        res.status(201).json({
            ...created,
            is_system: false,
            tags: normalizeTags(created.tags),
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:workflowId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            next(AppError.unauthorized());
            return;
        }

        const parsed = flowSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest('Payload inválido para atualização de automação.'));
            return;
        }

        const n8n = new N8nService();
        const workflowId = getWorkflowIdParam(req);
        const current = await n8n.getWorkflow(workflowId);

        const updated = await n8n.updateWorkflow(workflowId, {
            ...current,
            name: parsed.data.name,
            nodes: parsed.data.nodes,
            connections: parsed.data.connections as N8nConnections,
            settings: parsed.data.settings ?? current.settings,
            tags: Array.from(new Set([
                ...(normalizeTags(current.tags)),
                ...(parsed.data.tags ?? []),
                'orion-custom',
            ])),
        });

        await upsertAutomationFlow(updated, req.user.id);

        res.json({
            ...updated,
            is_system: isSystemWorkflow(updated),
            tags: normalizeTags(updated.tags),
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/:workflowId/toggle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            next(AppError.unauthorized());
            return;
        }

        const parsed = toggleSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest('Payload inválido para ativação da automação.'));
            return;
        }

        const n8n = new N8nService();
        const workflow = await n8n.toggleWorkflow(getWorkflowIdParam(req), parsed.data.active);
        await upsertAutomationFlow(workflow, req.user.id);

        res.json({
            ...workflow,
            is_system: isSystemWorkflow(workflow),
            tags: normalizeTags(workflow.tags),
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/:workflowId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const n8n = new N8nService();
        const workflowId = getWorkflowIdParam(req);
        const workflow = await n8n.getWorkflow(workflowId);

        if (isSystemWorkflow(workflow)) {
            next(AppError.forbidden('Fluxos de sistema não podem ser deletados. Desative-o se necessário.'));
            return;
        }

        await n8n.deleteWorkflow(workflowId);
        await query('DELETE FROM automation_flows WHERE n8n_workflow_id = $1', [workflowId]);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

router.get('/:workflowId/executions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = executionListSchema.safeParse(req.query);
        if (!parsed.success) {
            next(AppError.badRequest('Filtro de execuções inválido.'));
            return;
        }

        const n8n = new N8nService();
        const executions = await n8n.listExecutions(getWorkflowIdParam(req), parsed.data.limit);

        res.json({
            data: executions,
            meta: {
                total: executions.length,
                limit: parsed.data.limit,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
