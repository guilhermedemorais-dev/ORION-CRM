import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const ACTIVE_MODULES = ['pedidos', 'producao'] as const;
type ActiveModule = typeof ACTIVE_MODULES[number];

const PAYMENT_RULES = ['none', 'not_overdue', 'requires_partial', 'requires_paid_in_full', 'requires_refunded'] as const;
const STAGE_ROLES = ['none', 'in_production', 'finalized', 'cancelled'] as const;

const stageRuleSchema = z.object({
    stage_id: z.string().uuid(),
    payment_rule: z.enum(PAYMENT_RULES).default('none'),
    stage_role: z.enum(STAGE_ROLES).default('none'),
    notify_on_enter: z.boolean().default(false),
});

const createFlowSchema = z.object({
    name: z.string().trim().min(2).max(120),
    pipeline_id: z.string().uuid(),
    active_module: z.enum(ACTIVE_MODULES).nullable().optional(),
    description: z.string().trim().max(2000).optional(),
    stage_rules: z.array(stageRuleSchema).default([]),
});

const updateFlowSchema = createFlowSchema.partial().extend({
    stage_rules: z.array(stageRuleSchema).optional(),
});

interface FlowRow {
    id: string;
    name: string;
    pipeline_id: string;
    pipeline_name: string;
    pipeline_slug: string;
    active_module: ActiveModule | null;
    description: string | null;
    stage_count: number;
    rule_count: number;
    created_at: Date;
    updated_at: Date;
}

interface FlowDetailRow extends FlowRow {
    rules: Array<{
        stage_id: string;
        stage_name: string;
        stage_position: number;
        stage_color: string;
        payment_rule: string;
        stage_role: string;
        notify_on_enter: boolean;
    }>;
}

async function loadFlowDetail(flowId: string): Promise<FlowDetailRow | null> {
    const flowRes = await query<FlowRow>(
        `SELECT
            f.id, f.name, f.pipeline_id, f.active_module, f.description,
            f.created_at, f.updated_at,
            p.name AS pipeline_name, p.slug AS pipeline_slug,
            (SELECT COUNT(*)::int FROM pipeline_stages WHERE pipeline_id = f.pipeline_id) AS stage_count,
            (SELECT COUNT(*)::int FROM flow_stage_rules WHERE flow_id = f.id) AS rule_count
         FROM flows f
         INNER JOIN pipelines p ON p.id = f.pipeline_id
         WHERE f.id = $1
         LIMIT 1`,
        [flowId]
    );
    const flow = flowRes.rows[0];
    if (!flow) return null;

    const rulesRes = await query<{
        stage_id: string;
        stage_name: string;
        stage_position: number;
        stage_color: string;
        payment_rule: string;
        stage_role: string;
        notify_on_enter: boolean;
    }>(
        `SELECT
            s.id AS stage_id,
            s.name AS stage_name,
            s.position AS stage_position,
            s.color AS stage_color,
            COALESCE(r.payment_rule::text, 'none') AS payment_rule,
            COALESCE(r.stage_role::text, 'none') AS stage_role,
            COALESCE(r.notify_on_enter, false) AS notify_on_enter
         FROM pipeline_stages s
         LEFT JOIN flow_stage_rules r ON r.stage_id = s.id AND r.flow_id = $1
         WHERE s.pipeline_id = $2
         ORDER BY s.position ASC`,
        [flowId, flow.pipeline_id]
    );

    return { ...flow, rules: rulesRes.rows };
}

// ── GET /flows ────────────────────────────────────────────────────────────────
router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<FlowRow>(
                `SELECT
                    f.id, f.name, f.pipeline_id, f.active_module, f.description,
                    f.created_at, f.updated_at,
                    p.name AS pipeline_name, p.slug AS pipeline_slug,
                    (SELECT COUNT(*)::int FROM pipeline_stages WHERE pipeline_id = f.pipeline_id) AS stage_count,
                    (SELECT COUNT(*)::int FROM flow_stage_rules WHERE flow_id = f.id) AS rule_count
                 FROM flows f
                 INNER JOIN pipelines p ON p.id = f.pipeline_id
                 ORDER BY f.created_at DESC`
            );
            res.json({ data: result.rows });
        } catch (err) { next(err); }
    }
);

// ── GET /flows/active/:module ─────────────────────────────────────────────────
// Retorna o fluxo ativo num módulo específico (ou null).
router.get(
    '/active/:module',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const moduleKey = String(req.params['module'] ?? '');
            if (!ACTIVE_MODULES.includes(moduleKey as ActiveModule)) {
                next(AppError.badRequest('Módulo inválido.'));
                return;
            }
            const flowRes = await query<{ id: string }>(
                `SELECT id FROM flows WHERE active_module = $1 LIMIT 1`,
                [moduleKey]
            );
            const flow = flowRes.rows[0];
            if (!flow) { res.json(null); return; }
            const detail = await loadFlowDetail(flow.id);
            res.json(detail);
        } catch (err) { next(err); }
    }
);

// ── GET /flows/:id ────────────────────────────────────────────────────────────
router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const flowId = String(req.params['id'] ?? '');
            const detail = await loadFlowDetail(flowId);
            if (!detail) { next(AppError.notFound('Fluxo não encontrado.')); return; }
            res.json(detail);
        } catch (err) { next(err); }
    }
);

// ── POST /flows ───────────────────────────────────────────────────────────────
router.post(
    '/',
    authenticate,
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createFlowSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const data = parsed.data;

            // Pipeline existe?
            const pipelineRes = await query<{ id: string }>(
                `SELECT id FROM pipelines WHERE id = $1 LIMIT 1`,
                [data.pipeline_id]
            );
            if (!pipelineRes.rows[0]) {
                next(AppError.badRequest('Pipeline informado não existe.'));
                return;
            }

            const flowId = await transaction(async (client) => {
                // Se for marcar como ativo num módulo, desativa o anterior daquele módulo.
                if (data.active_module) {
                    await client.query(
                        `UPDATE flows SET active_module = NULL, updated_at = NOW() WHERE active_module = $1`,
                        [data.active_module]
                    );
                }

                const created = await client.query<{ id: string }>(
                    `INSERT INTO flows (name, pipeline_id, active_module, description, created_by)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id`,
                    [data.name, data.pipeline_id, data.active_module ?? null, data.description ?? null, req.user?.id ?? null]
                );
                const id = created.rows[0]!.id;

                for (const rule of data.stage_rules) {
                    if (rule.payment_rule === 'none' && rule.stage_role === 'none' && !rule.notify_on_enter) continue;
                    await client.query(
                        `INSERT INTO flow_stage_rules (flow_id, stage_id, payment_rule, stage_role, notify_on_enter)
                         VALUES ($1, $2, $3::flow_payment_rule, $4::flow_stage_role, $5)`,
                        [id, rule.stage_id, rule.payment_rule, rule.stage_role, rule.notify_on_enter]
                    );
                }
                return id;
            });

            await createAuditLog({
                userId: req.user!.id,
                action: 'CREATE',
                entityType: 'flows',
                entityId: flowId,
                oldValue: null,
                newValue: { name: data.name, pipeline_id: data.pipeline_id, active_module: data.active_module },
                req,
            });

            const detail = await loadFlowDetail(flowId);
            res.status(201).json(detail);
        } catch (err) { next(err); }
    }
);

// ── PATCH /flows/:id ──────────────────────────────────────────────────────────
router.patch(
    '/:id',
    authenticate,
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const flowId = String(req.params['id'] ?? '');
            const parsed = updateFlowSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            const data = parsed.data;

            const existsRes = await query<{ id: string; pipeline_id: string }>(
                `SELECT id, pipeline_id FROM flows WHERE id = $1 LIMIT 1`,
                [flowId]
            );
            const existing = existsRes.rows[0];
            if (!existing) { next(AppError.notFound('Fluxo não encontrado.')); return; }

            await transaction(async (client) => {
                if (data.active_module !== undefined) {
                    if (data.active_module) {
                        await client.query(
                            `UPDATE flows SET active_module = NULL, updated_at = NOW() WHERE active_module = $1 AND id <> $2`,
                            [data.active_module, flowId]
                        );
                    }
                }

                const sets: string[] = [];
                const values: unknown[] = [];
                if (data.name !== undefined) { values.push(data.name); sets.push(`name = $${values.length}`); }
                if (data.pipeline_id !== undefined) { values.push(data.pipeline_id); sets.push(`pipeline_id = $${values.length}`); }
                if (data.active_module !== undefined) { values.push(data.active_module); sets.push(`active_module = $${values.length}`); }
                if (data.description !== undefined) { values.push(data.description); sets.push(`description = $${values.length}`); }
                if (sets.length > 0) {
                    sets.push(`updated_at = NOW()`);
                    values.push(flowId);
                    await client.query(`UPDATE flows SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
                }

                if (data.stage_rules !== undefined) {
                    await client.query(`DELETE FROM flow_stage_rules WHERE flow_id = $1`, [flowId]);
                    for (const rule of data.stage_rules) {
                        if (rule.payment_rule === 'none' && rule.stage_role === 'none' && !rule.notify_on_enter) continue;
                        await client.query(
                            `INSERT INTO flow_stage_rules (flow_id, stage_id, payment_rule, stage_role, notify_on_enter)
                             VALUES ($1, $2, $3::flow_payment_rule, $4::flow_stage_role, $5)`,
                            [flowId, rule.stage_id, rule.payment_rule, rule.stage_role, rule.notify_on_enter]
                        );
                    }
                }
            });

            await createAuditLog({
                userId: req.user!.id,
                action: 'UPDATE',
                entityType: 'flows',
                entityId: flowId,
                oldValue: null,
                newValue: { name: data.name, active_module: data.active_module, rules_count: data.stage_rules?.length },
                req,
            });

            const detail = await loadFlowDetail(flowId);
            res.json(detail);
        } catch (err) { next(err); }
    }
);

// ── DELETE /flows/:id ─────────────────────────────────────────────────────────
router.delete(
    '/:id',
    authenticate,
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const flowId = String(req.params['id'] ?? '');
            const ordersRes = await query<{ count: string }>(
                `SELECT COUNT(*)::text AS count FROM orders WHERE flow_id = $1`,
                [flowId]
            );
            const inUse = Number.parseInt(ordersRes.rows[0]?.count ?? '0', 10);
            if (inUse > 0) {
                next(new AppError(409, 'FLOW_IN_USE', `Não é possível excluir: ${inUse} pedido(s) ainda usam este fluxo.`));
                return;
            }
            const result = await query(`DELETE FROM flows WHERE id = $1`, [flowId]);
            if (result.rowCount === 0) { next(AppError.notFound('Fluxo não encontrado.')); return; }

            await createAuditLog({
                userId: req.user!.id,
                action: 'DELETE',
                entityType: 'flows',
                entityId: flowId,
                oldValue: null,
                newValue: null,
                req,
            });

            res.status(204).send();
        } catch (err) { next(err); }
    }
);

export default router;
