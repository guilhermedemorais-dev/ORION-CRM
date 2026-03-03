import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import type { ProductionStatus } from '../types/entities.js';

const router = Router();

const productionStatusSchema = z.enum(['PENDENTE', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'REPROVADA']);
const listProductionSchema = z.object({
    status: productionStatusSchema.optional(),
    assigned_to: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const advanceStepSchema = z.object({
    notes: z.string().trim().max(2000).optional(),
    approved: z.coerce.boolean().optional().default(true),
    rejection_reason: z.string().trim().min(5).max(2000).optional(),
});

const PRODUCTION_STEPS = ['SOLDA', 'MODELAGEM', 'CRAVACAO', 'POLIMENTO', 'CONTROLE_QUALIDADE', 'CONCLUIDO'] as const;

interface ProductionOrderRow {
    id: string;
    order_id: string;
    current_step: string;
    status: ProductionStatus;
    deadline: Date | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
    order_number: string;
    customer_name: string;
    order_status: string;
}

interface ProductionStepRow {
    id: string;
    production_order_id: string;
    step_name: string;
    completed_at: Date;
    notes: string | null;
    approved: boolean;
    rejection_reason: string | null;
    completed_by_user_id: string;
    completed_by_user_name: string;
}

function getScopedProductionAssignee(req: Request, explicitAssignedTo?: string): string | undefined {
    if (!req.user) {
        return undefined;
    }

    return req.user.role === 'PRODUCAO' ? req.user.id : explicitAssignedTo;
}

function buildProductionScopeFilter(req: Request, values: unknown[], explicitAssignedTo?: string): string | null {
    if (!req.user) {
        return null;
    }

    if (req.user.role === 'ADMIN') {
        if (!explicitAssignedTo) {
            return null;
        }

        values.push(explicitAssignedTo);
        return `po.assigned_to = $${values.length}`;
    }

    if (explicitAssignedTo && explicitAssignedTo !== req.user.id) {
        throw AppError.forbidden('Você só pode filtrar pelas suas próprias ordens de produção.');
    }

    values.push(req.user.id);
    const ownIndex = values.length;

    return `(po.assigned_to = $${ownIndex} OR po.assigned_to IS NULL)`;
}

function assertCanAccessProduction(req: Request, assignedTo: string | null): void {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    if (req.user.role === 'ADMIN') {
        return;
    }

    if (assignedTo && assignedTo !== req.user.id) {
        throw AppError.forbidden('Acesso não autorizado para esta ordem de produção.');
    }
}

function mapProductionOrder(row: ProductionOrderRow) {
    const progressIndex = Math.max(0, PRODUCTION_STEPS.indexOf(row.current_step as typeof PRODUCTION_STEPS[number]));
    const progressPercent = Math.round((progressIndex / (PRODUCTION_STEPS.length - 1)) * 100);

    return {
        id: row.id,
        order_id: row.order_id,
        current_step: row.current_step,
        status: row.status,
        deadline: row.deadline,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assigned_to: row.assigned_user_id && row.assigned_user_name
            ? {
                id: row.assigned_user_id,
                name: row.assigned_user_name,
            }
            : null,
        order: {
            id: row.order_id,
            order_number: row.order_number,
            status: row.order_status,
            customer_name: row.customer_name,
        },
        progress_percent: progressPercent,
        is_overdue: Boolean(row.deadline && row.deadline.getTime() < Date.now() && row.status !== 'CONCLUIDA'),
    };
}

async function fetchProductionOrder(productionOrderId: string): Promise<ProductionOrderRow | null> {
    const result = await query<ProductionOrderRow>(
        `SELECT
            po.id,
            po.order_id,
            po.current_step,
            po.status,
            po.deadline,
            po.notes,
            po.created_at,
            po.updated_at,
            u.id AS assigned_user_id,
            u.name AS assigned_user_name,
            o.order_number,
            o.status AS order_status,
            c.name AS customer_name
          FROM production_orders po
          INNER JOIN orders o ON o.id = po.order_id
          INNER JOIN customers c ON c.id = o.customer_id
          LEFT JOIN users u ON u.id = po.assigned_to
          WHERE po.id = $1
          LIMIT 1`,
        [productionOrderId]
    );

    return result.rows[0] ?? null;
}

async function fetchProductionSteps(productionOrderId: string): Promise<ProductionStepRow[]> {
    const result = await query<ProductionStepRow>(
        `SELECT
            ps.id,
            ps.production_order_id,
            ps.step_name,
            ps.completed_at,
            ps.notes,
            ps.approved,
            ps.rejection_reason,
            u.id AS completed_by_user_id,
            u.name AS completed_by_user_name
          FROM production_steps ps
          INNER JOIN users u ON u.id = ps.completed_by
          WHERE ps.production_order_id = $1
          ORDER BY ps.completed_at ASC, ps.id ASC`,
        [productionOrderId]
    );

    return result.rows;
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'PRODUCAO']),
    rateLimit({ windowMs: 60 * 1000, max: 90, name: 'production-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listProductionSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const filters: string[] = [];
            const values: unknown[] = [];
            const scopedAssignedTo = getScopedProductionAssignee(req, parsed.data.assigned_to);
            const scopeFilter = buildProductionScopeFilter(req, values, scopedAssignedTo);

            if (scopeFilter) {
                filters.push(scopeFilter);
            }

            if (parsed.data.status) {
                values.push(parsed.data.status);
                filters.push(`po.status = $${values.length}`);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM production_orders po
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<ProductionOrderRow>(
                `SELECT
                    po.id,
                    po.order_id,
                    po.current_step,
                    po.status,
                    po.deadline,
                    po.notes,
                    po.created_at,
                    po.updated_at,
                    u.id AS assigned_user_id,
                    u.name AS assigned_user_name,
                    o.order_number,
                    o.status AS order_status,
                    c.name AS customer_name
                  FROM production_orders po
                  INNER JOIN orders o ON o.id = po.order_id
                  INNER JOIN customers c ON c.id = o.customer_id
                  LEFT JOIN users u ON u.id = po.assigned_to
                  ${whereClause}
                  ORDER BY po.deadline ASC NULLS LAST, po.updated_at DESC
                  LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapProductionOrder),
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

router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const productionOrderId = String(req.params['id'] ?? '');
            const productionOrder = await fetchProductionOrder(productionOrderId);
            if (!productionOrder) {
                next(AppError.notFound('Ordem de produção não encontrada.'));
                return;
            }

            assertCanAccessProduction(req, productionOrder.assigned_user_id);
            const steps = await fetchProductionSteps(productionOrder.id);

            res.json({
                ...mapProductionOrder(productionOrder),
                steps: steps.map((step) => ({
                    id: step.id,
                    step_name: step.step_name,
                    completed_at: step.completed_at,
                    notes: step.notes,
                    approved: step.approved,
                    rejection_reason: step.rejection_reason,
                    completed_by: {
                        id: step.completed_by_user_id,
                        name: step.completed_by_user_name,
                    },
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/advance',
    authenticate,
    requireRole(['ADMIN', 'PRODUCAO']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'production-advance' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const productionOrderId = String(req.params['id'] ?? '');
            const parsed = advanceStepSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados da etapa.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const productionOrder = await fetchProductionOrder(productionOrderId);
            if (!productionOrder) {
                next(AppError.notFound('Ordem de produção não encontrada.'));
                return;
            }

            assertCanAccessProduction(req, productionOrder.assigned_user_id);

            const currentIndex = PRODUCTION_STEPS.indexOf(productionOrder.current_step as typeof PRODUCTION_STEPS[number]);
            if (currentIndex === -1) {
                throw AppError.conflict('INVALID_PRODUCTION_STEP', 'A etapa atual da ordem de produção é inválida.');
            }

            if (currentIndex === PRODUCTION_STEPS.length - 1) {
                next(AppError.conflict('PRODUCTION_ALREADY_COMPLETED', 'Esta ordem de produção já foi concluída.'));
                return;
            }

            if (!parsed.data.approved && !parsed.data.rejection_reason) {
                next(AppError.badRequest('Informe o motivo quando reprovar uma etapa.'));
                return;
            }

            const nextStep = parsed.data.approved
                ? PRODUCTION_STEPS[currentIndex + 1]
                : PRODUCTION_STEPS[Math.max(0, currentIndex - 1)];

            const nextStatus: ProductionStatus = parsed.data.approved
                ? (nextStep === 'CONCLUIDO' ? 'CONCLUIDA' : 'EM_ANDAMENTO')
                : 'REPROVADA';
            const implicitAssignee = req.user?.role === 'PRODUCAO' ? req.user.id : null;

            await transaction(async (client) => {
                await client.query(
                    `INSERT INTO production_steps (
                        production_order_id,
                        step_name,
                        completed_by,
                        notes,
                        approved,
                        rejection_reason
                      ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        productionOrder.id,
                        productionOrder.current_step,
                        req.user?.id,
                        parsed.data.notes ?? null,
                        parsed.data.approved,
                        parsed.data.approved ? null : parsed.data.rejection_reason ?? null,
                    ]
                );

                await client.query(
                    `UPDATE production_orders
                     SET
                       current_step = $2,
                       status = $3,
                       notes = COALESCE($4, notes),
                       assigned_to = COALESCE(assigned_to, $5::uuid),
                       updated_at = NOW()
                     WHERE id = $1`,
                    [productionOrder.id, nextStep, nextStatus, parsed.data.notes ?? null, implicitAssignee]
                );

                const mappedOrderStatus = nextStep === 'CONCLUIDO'
                    ? 'CONTROLE_QUALIDADE'
                    : nextStep === 'CONTROLE_QUALIDADE'
                        ? 'CONTROLE_QUALIDADE'
                        : 'EM_PRODUCAO';

                await client.query(
                    `UPDATE orders
                     SET
                       status = $2,
                       updated_at = NOW()
                     WHERE id = $1`,
                    [productionOrder.order_id, mappedOrderStatus]
                );
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'ADVANCE_STEP',
                    entityType: 'production_orders',
                    entityId: productionOrder.id,
                    oldValue: {
                        current_step: productionOrder.current_step,
                        status: productionOrder.status,
                    },
                    newValue: {
                        current_step: nextStep,
                        status: nextStatus,
                        approved: parsed.data.approved,
                    },
                    req,
                });
            }

            const updated = await fetchProductionOrder(productionOrder.id);
            const steps = await fetchProductionSteps(productionOrder.id);

            res.json({
                ...mapProductionOrder(updated as ProductionOrderRow),
                steps: steps.map((step) => ({
                    id: step.id,
                    step_name: step.step_name,
                    completed_at: step.completed_at,
                    notes: step.notes,
                    approved: step.approved,
                    rejection_reason: step.rejection_reason,
                    completed_by: {
                        id: step.completed_by_user_id,
                        name: step.completed_by_user_name,
                    },
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
