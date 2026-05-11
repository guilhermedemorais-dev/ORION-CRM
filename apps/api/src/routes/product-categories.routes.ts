import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const createSchema = z.object({
    name: z.string().trim().min(1).max(100),
    parent_id: z.string().uuid().nullable().optional(),
    position: z.coerce.number().int().min(0).optional(),
});

const updateSchema = createSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'Informe ao menos um campo para atualizar.'
);

interface CategoryRow {
    id: string;
    name: string;
    parent_id: string | null;
    position: number;
    created_at: Date;
    updated_at: Date;
}

router.use(authenticate);

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query<CategoryRow>(
            `SELECT id, name, parent_id, position, created_at, updated_at
             FROM product_categories
             ORDER BY position ASC, name ASC`
        );
        res.json({ data: result.rows });
    } catch (err) {
        next(err);
    }
});

router.post(
    '/',
    requireRole(['ROOT', 'ADMIN', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados da categoria.',
                    parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            if (parsed.data.parent_id) {
                const parent = await query<{ id: string }>(
                    'SELECT id FROM product_categories WHERE id = $1 LIMIT 1',
                    [parsed.data.parent_id]
                );
                if (!parent.rows[0]) {
                    next(AppError.badRequest('Categoria pai não encontrada.'));
                    return;
                }
            }

            const result = await query<CategoryRow>(
                `INSERT INTO product_categories (name, parent_id, position)
                 VALUES ($1, $2, $3)
                 RETURNING id, name, parent_id, position, created_at, updated_at`,
                [
                    parsed.data.name.trim(),
                    parsed.data.parent_id ?? null,
                    parsed.data.position ?? 0,
                ]
            );

            const created = result.rows[0];
            if (!created) throw AppError.internal(req.requestId);

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'product_categories',
                    entityId: created.id,
                    oldValue: null,
                    newValue: { ...created },
                    req,
                });
            }

            res.status(201).json({ data: created });
        } catch (err) {
            const error = err as { code?: string };
            if (error.code === '23505') {
                next(AppError.badRequest('Já existe uma categoria com esse nome neste nível.'));
                return;
            }
            next(err);
        }
    }
);

router.patch(
    '/:id',
    requireRole(['ROOT', 'ADMIN', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'];
            if (!id || typeof id !== 'string') {
                next(AppError.badRequest('ID da categoria inválido.'));
                return;
            }

            const parsed = updateSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados da categoria.',
                    parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            // Evita ciclo: parent_id não pode ser o próprio id.
            if (parsed.data.parent_id === id) {
                next(AppError.badRequest('Categoria não pode ser pai dela mesma.'));
                return;
            }

            const updates: string[] = [];
            const values: unknown[] = [id];

            if (parsed.data.name !== undefined) {
                values.push(parsed.data.name.trim());
                updates.push(`name = $${values.length}`);
            }
            if (parsed.data.parent_id !== undefined) {
                values.push(parsed.data.parent_id ?? null);
                updates.push(`parent_id = $${values.length}`);
            }
            if (parsed.data.position !== undefined) {
                values.push(parsed.data.position);
                updates.push(`position = $${values.length}`);
            }
            updates.push('updated_at = NOW()');

            const result = await query<CategoryRow>(
                `UPDATE product_categories
                 SET ${updates.join(', ')}
                 WHERE id = $1
                 RETURNING id, name, parent_id, position, created_at, updated_at`,
                values
            );

            const row = result.rows[0];
            if (!row) {
                next(AppError.notFound('Categoria não encontrada.'));
                return;
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'product_categories',
                    entityId: row.id,
                    oldValue: null,
                    newValue: { ...row },
                    req,
                });
            }

            res.json({ data: row });
        } catch (err) {
            const error = err as { code?: string };
            if (error.code === '23505') {
                next(AppError.badRequest('Já existe uma categoria com esse nome neste nível.'));
                return;
            }
            next(err);
        }
    }
);

router.delete(
    '/:id',
    requireRole(['ROOT', 'ADMIN', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'];
            if (!id || typeof id !== 'string') {
                next(AppError.badRequest('ID da categoria inválido.'));
                return;
            }

            const inUse = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total FROM products WHERE category_id = $1`,
                [id]
            );
            if (Number(inUse.rows[0]?.total ?? '0') > 0) {
                next(AppError.badRequest('Categoria em uso por produtos. Reatribua os produtos antes de excluir.'));
                return;
            }

            const result = await query<{ id: string }>(
                `DELETE FROM product_categories WHERE id = $1 RETURNING id`,
                [id]
            );
            if (!result.rows[0]) {
                next(AppError.notFound('Categoria não encontrada.'));
                return;
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    entityType: 'product_categories',
                    entityId: id,
                    oldValue: { id },
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

export default router;
