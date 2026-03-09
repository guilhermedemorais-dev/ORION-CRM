import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const allRoles = ['ADMIN', 'ATENDENTE', 'PRODUCAO', 'FINANCEIRO'] as const;

const stageBaseSchema = z.object({
    name: z.string().trim().min(2).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    position: z.coerce.number().int().min(1),
    is_won: z.boolean().optional(),
    is_lost: z.boolean().optional(),
});

const stageCreateSchema = stageBaseSchema.refine((data) => !(data.is_won && data.is_lost), {
    message: 'Uma etapa não pode ser de ganho e perda ao mesmo tempo.',
});

const stageUpdateSchema = stageBaseSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo informado para atualizar.',
});

const stageReorderSchema = z.object({
    stages: z.array(z.object({
        id: z.string().uuid(),
        position: z.coerce.number().int().min(1),
    })).min(1),
});

const customFieldCreateSchema = z.object({
    name: z.string().trim().min(2).max(100),
    field_key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/),
    field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox']),
    options: z.array(z.string().trim().min(1).max(100)).optional(),
    required: z.boolean().default(false),
    position: z.coerce.number().int().min(1),
});

const customFieldUpdateSchema = customFieldCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo informado para atualizar.',
});

async function getLegacyPipelineId(): Promise<string> {
    const result = await query<{ id: string }>(
        `SELECT id
         FROM pipelines
         WHERE slug = 'leads'
         LIMIT 1`
    );

    const id = result.rows[0]?.id;
    if (!id) {
        throw AppError.serviceUnavailable('PIPELINE_NOT_READY', 'Pipeline padrão ainda não foi inicializado.');
    }

    return id;
}

router.get(
    '/stages',
    authenticate,
    requireRole([...allRoles]),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = await getLegacyPipelineId();
            const result = await query(
                `SELECT id, name, color, position, is_won, is_lost, created_at
                 FROM pipeline_stages
                 WHERE pipeline_id = $1
                 ORDER BY position ASC, created_at ASC`,
                [pipelineId]
            );
            res.json({ data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/stages',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = await getLegacyPipelineId();
            const parsed = stageCreateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Etapa inválida.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            if (parsed.data.is_won) {
                await query('UPDATE pipeline_stages SET is_won = false WHERE pipeline_id = $1 AND is_won = true', [pipelineId]);
            }
            if (parsed.data.is_lost) {
                await query('UPDATE pipeline_stages SET is_lost = false WHERE pipeline_id = $1 AND is_lost = true', [pipelineId]);
            }

            const result = await query(
                `INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_won, is_lost)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, name, color, position, is_won, is_lost, created_at`,
                [
                    pipelineId,
                    parsed.data.name,
                    parsed.data.color,
                    parsed.data.position,
                    parsed.data.is_won ?? false,
                    parsed.data.is_lost ?? false,
                ]
            );

            res.status(201).json({ data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

router.put(
    '/stages/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = await getLegacyPipelineId();
            const parsed = stageUpdateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Etapa inválida.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const stageId = req.params['id'];
            if (!stageId) {
                next(AppError.badRequest('Etapa inválida.'));
                return;
            }

            const existing = await query<{ id: string }>(
                `SELECT id FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2 LIMIT 1`,
                [stageId, pipelineId]
            );
            if (!existing.rows[0]) {
                next(AppError.notFound('Etapa não encontrada.'));
                return;
            }

            if (parsed.data.is_won === true) {
                await query('UPDATE pipeline_stages SET is_won = false WHERE pipeline_id = $1 AND is_won = true AND id <> $2', [pipelineId, stageId]);
            }
            if (parsed.data.is_lost === true) {
                await query('UPDATE pipeline_stages SET is_lost = false WHERE pipeline_id = $1 AND is_lost = true AND id <> $2', [pipelineId, stageId]);
            }

            const fields: string[] = [];
            const values: unknown[] = [];
            if (parsed.data.name !== undefined) {
                values.push(parsed.data.name);
                fields.push(`name = $${values.length}`);
            }
            if (parsed.data.color !== undefined) {
                values.push(parsed.data.color);
                fields.push(`color = $${values.length}`);
            }
            if (parsed.data.position !== undefined) {
                values.push(parsed.data.position);
                fields.push(`position = $${values.length}`);
            }
            if (parsed.data.is_won !== undefined) {
                values.push(parsed.data.is_won);
                fields.push(`is_won = $${values.length}`);
            }
            if (parsed.data.is_lost !== undefined) {
                values.push(parsed.data.is_lost);
                fields.push(`is_lost = $${values.length}`);
            }

            values.push(stageId);
            values.push(pipelineId);
            const result = await query(
                `UPDATE pipeline_stages
                 SET ${fields.join(', ')}
                 WHERE id = $${values.length - 1}
                   AND pipeline_id = $${values.length}
                 RETURNING id, name, color, position, is_won, is_lost, created_at`,
                values
            );

            res.json({ data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/stages/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = await getLegacyPipelineId();
            const stageId = req.params['id'];
            if (!stageId) {
                next(AppError.badRequest('Etapa inválida.'));
                return;
            }

            const stageResult = await query<{ id: string; is_won: boolean; is_lost: boolean }>(
                `SELECT id, is_won, is_lost
                 FROM pipeline_stages
                 WHERE id = $1 AND pipeline_id = $2
                 LIMIT 1`,
                [stageId, pipelineId]
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
                 WHERE stage_id = $1`,
                [stageId]
            );

            if (Number(leadsCount.rows[0]?.total ?? '0') > 0) {
                next(AppError.badRequest('Existem leads nesta etapa. Mova-os antes de excluir.'));
                return;
            }

            await query('DELETE FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2', [stageId, pipelineId]);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/stages/reorder',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pipelineId = await getLegacyPipelineId();
            const parsed = stageReorderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Payload de reordenação inválido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            await transaction(async (client) => {
                for (const stage of parsed.data.stages) {
                    await client.query(
                        `UPDATE pipeline_stages
                         SET position = $1
                         WHERE id = $2 AND pipeline_id = $3`,
                        [stage.position, stage.id, pipelineId]
                    );
                }
            });

            const result = await query(
                `SELECT id, name, color, position, is_won, is_lost, created_at
                 FROM pipeline_stages
                 WHERE pipeline_id = $1
                 ORDER BY position ASC, created_at ASC`,
                [pipelineId]
            );

            res.json({ data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/custom-fields',
    authenticate,
    requireRole([...allRoles]),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query(
                `SELECT id, name, field_key, field_type, options, required, position, created_at
                 FROM pipeline_custom_fields
                 ORDER BY position ASC, created_at ASC`
            );
            res.json({ data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/custom-fields',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = customFieldCreateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Campo customizado inválido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            if (parsed.data.field_type === 'select' && (!parsed.data.options || parsed.data.options.length === 0)) {
                next(AppError.badRequest('Campo do tipo select exige opções.'));
                return;
            }

            const result = await query(
                `INSERT INTO pipeline_custom_fields (name, field_key, field_type, options, required, position)
                 VALUES ($1, $2, $3, $4::jsonb, $5, $6)
                 RETURNING id, name, field_key, field_type, options, required, position, created_at`,
                [
                    parsed.data.name,
                    parsed.data.field_key,
                    parsed.data.field_type,
                    parsed.data.options ? JSON.stringify(parsed.data.options) : null,
                    parsed.data.required,
                    parsed.data.position,
                ]
            );

            res.status(201).json({ data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

router.put(
    '/custom-fields/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = customFieldUpdateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Campo customizado inválido.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            if (parsed.data.field_type === 'select' && parsed.data.options && parsed.data.options.length === 0) {
                next(AppError.badRequest('Campo do tipo select exige opções.'));
                return;
            }

            const id = req.params['id'];
            if (!id) {
                next(AppError.badRequest('Campo customizado inválido.'));
                return;
            }

            const fields: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.name !== undefined) {
                values.push(parsed.data.name);
                fields.push(`name = $${values.length}`);
            }
            if (parsed.data.field_key !== undefined) {
                values.push(parsed.data.field_key);
                fields.push(`field_key = $${values.length}`);
            }
            if (parsed.data.field_type !== undefined) {
                values.push(parsed.data.field_type);
                fields.push(`field_type = $${values.length}`);
            }
            if (parsed.data.options !== undefined) {
                values.push(parsed.data.options ? JSON.stringify(parsed.data.options) : null);
                fields.push(`options = $${values.length}::jsonb`);
            }
            if (parsed.data.required !== undefined) {
                values.push(parsed.data.required);
                fields.push(`required = $${values.length}`);
            }
            if (parsed.data.position !== undefined) {
                values.push(parsed.data.position);
                fields.push(`position = $${values.length}`);
            }

            values.push(id);
            const result = await query(
                `UPDATE pipeline_custom_fields
                 SET ${fields.join(', ')}
                 WHERE id = $${values.length}
                 RETURNING id, name, field_key, field_type, options, required, position, created_at`,
                values
            );

            if (!result.rows[0]) {
                next(AppError.notFound('Campo customizado não encontrado.'));
                return;
            }

            res.json({ data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/custom-fields/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'];
            if (!id) {
                next(AppError.badRequest('Campo customizado inválido.'));
                return;
            }

            const result = await query(
                `DELETE FROM pipeline_custom_fields
                 WHERE id = $1`,
                [id]
            );

            if (!result.rowCount) {
                next(AppError.notFound('Campo customizado não encontrado.'));
                return;
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

export default router;
