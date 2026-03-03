import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const listProductsSchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    low_stock: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const productParamsSchema = z.object({
    id: z.string().uuid(),
});

const createProductSchema = z.object({
    code: z.string().trim().min(2).max(50),
    name: z.string().trim().min(2).max(255),
    description: z.string().trim().max(5000).optional(),
    price_cents: z.coerce.number().int().min(1),
    stock_quantity: z.coerce.number().int().min(0).default(0),
    minimum_stock: z.coerce.number().int().min(0).default(0),
    category: z.string().trim().max(100).optional(),
    metal: z.string().trim().max(50).optional(),
    weight_grams: z.coerce.number().positive().optional(),
    is_active: z.coerce.boolean().optional().default(true),
});

const updateProductSchema = createProductSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'Informe ao menos um campo para atualizar.'
);

const stockAdjustmentSchema = z.object({
    quantity: z.coerce.number().int().min(1),
    reason: z.string().trim().min(10).max(2000),
    type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
});

interface ProductRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_cents: number;
    stock_quantity: number;
    minimum_stock: number;
    category: string | null;
    metal: string | null;
    weight_grams: number | null;
    images: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

interface StockMovementRow {
    id: string;
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string;
    order_id: string | null;
    created_at: Date;
    created_by_user_id: string;
    created_by_user_name: string;
}

function mapProduct(row: ProductRow) {
    return {
        ...row,
        is_low_stock: row.stock_quantity <= row.minimum_stock,
    };
}

async function fetchProduct(productId: string): Promise<ProductRow | null> {
    const result = await query<ProductRow>(
        `SELECT
            id,
            code,
            name,
            description,
            price_cents,
            stock_quantity,
            minimum_stock,
            category,
            metal,
            weight_grams,
            images,
            is_active,
            created_at,
            updated_at
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [productId]
    );

    return result.rows[0] ?? null;
}

async function fetchRecentStockMovements(productId: string): Promise<StockMovementRow[]> {
    const result = await query<StockMovementRow>(
        `SELECT
            sm.id,
            sm.type,
            sm.quantity,
            sm.previous_stock,
            sm.new_stock,
            sm.reason,
            sm.order_id,
            sm.created_at,
            u.id AS created_by_user_id,
            u.name AS created_by_user_name
         FROM stock_movements sm
         INNER JOIN users u ON u.id = sm.created_by
         WHERE sm.product_id = $1
         ORDER BY sm.created_at DESC
         LIMIT 15`,
        [productId]
    );

    return result.rows;
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'PRODUCAO']),
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'products-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listProductsSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const filters: string[] = [];
            const values: unknown[] = [];

            if (parsed.data.q) {
                values.push(`%${parsed.data.q}%`);
                const searchIndex = values.length;
                filters.push(`(p.name ILIKE $${searchIndex} OR p.code ILIKE $${searchIndex})`);
            }

            if (parsed.data.category) {
                values.push(parsed.data.category);
                filters.push(`p.category = $${values.length}`);
            }

            if (parsed.data.low_stock) {
                filters.push('p.stock_quantity <= p.minimum_stock');
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM products p
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<ProductRow>(
                `SELECT
                    p.id,
                    p.code,
                    p.name,
                    p.description,
                    p.price_cents,
                    p.stock_quantity,
                    p.minimum_stock,
                    p.category,
                    p.metal,
                    p.weight_grams,
                    p.images,
                    p.is_active,
                    p.created_at,
                    p.updated_at
                 FROM products p
                 ${whereClause}
                 ORDER BY p.stock_quantity <= p.minimum_stock DESC, p.updated_at DESC
                 LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapProduct),
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
    requireRole(['ADMIN', 'ATENDENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = productParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Produto inválido.'));
                return;
            }

            const product = await fetchProduct(parsed.data.id);
            if (!product) {
                next(AppError.notFound('Produto não encontrado.'));
                return;
            }

            const recentMovements = await fetchRecentStockMovements(product.id);

            res.json({
                ...mapProduct(product),
                recent_stock_movements: recentMovements.map((movement) => ({
                    id: movement.id,
                    type: movement.type,
                    quantity: movement.quantity,
                    previous_stock: movement.previous_stock,
                    new_stock: movement.new_stock,
                    reason: movement.reason,
                    order_id: movement.order_id,
                    created_at: movement.created_at,
                    created_by: {
                        id: movement.created_by_user_id,
                        name: movement.created_by_user_name,
                    },
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'products-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createProductSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do produto.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const data = parsed.data;

            const result = await query<ProductRow>(
                `INSERT INTO products (
                    code,
                    name,
                    description,
                    price_cents,
                    stock_quantity,
                    minimum_stock,
                    category,
                    metal,
                    weight_grams,
                    is_active
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                  RETURNING
                    id,
                    code,
                    name,
                    description,
                    price_cents,
                    stock_quantity,
                    minimum_stock,
                    category,
                    metal,
                    weight_grams,
                    images,
                    is_active,
                    created_at,
                    updated_at`,
                [
                    data.code.toUpperCase(),
                    data.name,
                    data.description ?? null,
                    data.price_cents,
                    data.stock_quantity,
                    data.minimum_stock,
                    data.category ?? null,
                    data.metal ?? null,
                    data.weight_grams ?? null,
                    data.is_active,
                ]
            );

            const product = result.rows[0];

            if (req.user && product) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'products',
                    entityId: product.id,
                    oldValue: null,
                    newValue: {
                        code: product.code,
                        stock_quantity: product.stock_quantity,
                    },
                    req,
                });
            }

            res.status(201).json(mapProduct(product as ProductRow));
        } catch (error) {
            const databaseError = error as { code?: string };

            if (databaseError.code === '23505') {
                next(AppError.conflict('DUPLICATE_PRODUCT_CODE', 'Já existe um produto com este código.'));
                return;
            }

            next(error);
        }
    }
);

router.patch(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'products-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = productParamsSchema.safeParse(req.params);
            const body = updateProductSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest(
                    'Não foi possível atualizar o produto.',
                    body.success ? [] : body.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const before = await fetchProduct(params.data.id);
            if (!before) {
                next(AppError.notFound('Produto não encontrado.'));
                return;
            }

            const data = body.data;
            const values: unknown[] = [params.data.id];
            const updates: string[] = [];

            if (data.code !== undefined) {
                values.push(data.code.toUpperCase());
                updates.push(`code = $${values.length}`);
            }
            if (data.name !== undefined) {
                values.push(data.name);
                updates.push(`name = $${values.length}`);
            }
            if (data.description !== undefined) {
                values.push(data.description || null);
                updates.push(`description = $${values.length}`);
            }
            if (data.price_cents !== undefined) {
                values.push(data.price_cents);
                updates.push(`price_cents = $${values.length}`);
            }
            if (data.stock_quantity !== undefined) {
                values.push(data.stock_quantity);
                updates.push(`stock_quantity = $${values.length}`);
            }
            if (data.minimum_stock !== undefined) {
                values.push(data.minimum_stock);
                updates.push(`minimum_stock = $${values.length}`);
            }
            if (data.category !== undefined) {
                values.push(data.category || null);
                updates.push(`category = $${values.length}`);
            }
            if (data.metal !== undefined) {
                values.push(data.metal || null);
                updates.push(`metal = $${values.length}`);
            }
            if (data.weight_grams !== undefined) {
                values.push(data.weight_grams ?? null);
                updates.push(`weight_grams = $${values.length}`);
            }
            if (data.is_active !== undefined) {
                values.push(data.is_active);
                updates.push(`is_active = $${values.length}`);
            }

            updates.push('updated_at = NOW()');

            const result = await query<ProductRow>(
                `UPDATE products
                 SET ${updates.join(', ')}
                 WHERE id = $1
                 RETURNING
                    id,
                    code,
                    name,
                    description,
                    price_cents,
                    stock_quantity,
                    minimum_stock,
                    category,
                    metal,
                    weight_grams,
                    images,
                    is_active,
                    created_at,
                    updated_at`,
                values
            );

            const product = result.rows[0];

            if (req.user && product) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'products',
                    entityId: product.id,
                    oldValue: {
                        code: before.code,
                        price_cents: before.price_cents,
                        stock_quantity: before.stock_quantity,
                        minimum_stock: before.minimum_stock,
                    },
                    newValue: {
                        code: product.code,
                        price_cents: product.price_cents,
                        stock_quantity: product.stock_quantity,
                        minimum_stock: product.minimum_stock,
                    },
                    req,
                });
            }

            res.json(mapProduct(product as ProductRow));
        } catch (error) {
            const databaseError = error as { code?: string };

            if (databaseError.code === '23505') {
                next(AppError.conflict('DUPLICATE_PRODUCT_CODE', 'Já existe um produto com este código.'));
                return;
            }

            next(error);
        }
    }
);

router.post(
    '/:id/stock-adjust',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'products-stock-adjust' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = productParamsSchema.safeParse(req.params);
            const body = stockAdjustmentSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest(
                    'Não foi possível ajustar o estoque.',
                    body.success ? [] : body.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const data = body.data;

            const product = await transaction(async (client) => {
                const productResult = await client.query<ProductRow>(
                    `SELECT
                        id,
                        code,
                        name,
                        description,
                        price_cents,
                        stock_quantity,
                        minimum_stock,
                        category,
                        metal,
                        weight_grams,
                        images,
                        is_active,
                        created_at,
                        updated_at
                     FROM products
                     WHERE id = $1
                     FOR UPDATE`,
                    [params.data.id]
                );

                const current = productResult.rows[0];
                if (!current) {
                    throw AppError.notFound('Produto não encontrado.');
                }

                let newStock = current.stock_quantity;

                if (data.type === 'ENTRADA') {
                    newStock = current.stock_quantity + data.quantity;
                } else if (data.type === 'SAIDA') {
                    if (current.stock_quantity < data.quantity) {
                        throw AppError.conflict(
                            'INSUFFICIENT_STOCK',
                            `Estoque insuficiente. Disponível: ${current.stock_quantity}`
                        );
                    }

                    newStock = current.stock_quantity - data.quantity;
                } else {
                    newStock = data.quantity;
                }

                await client.query(
                    `UPDATE products
                     SET
                       stock_quantity = $2,
                       updated_at = NOW()
                     WHERE id = $1`,
                    [current.id, newStock]
                );

                await client.query(
                    `INSERT INTO stock_movements (
                        product_id,
                        type,
                        quantity,
                        previous_stock,
                        new_stock,
                        reason,
                        created_by
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        current.id,
                        data.type,
                        data.quantity,
                        current.stock_quantity,
                        newStock,
                        data.reason,
                        req.user?.id,
                    ]
                );

                const updatedResult = await client.query<ProductRow>(
                    `SELECT
                        id,
                        code,
                        name,
                        description,
                        price_cents,
                        stock_quantity,
                        minimum_stock,
                        category,
                        metal,
                        weight_grams,
                        images,
                        is_active,
                        created_at,
                        updated_at
                     FROM products
                     WHERE id = $1`,
                    [current.id]
                );

                return {
                    before: current,
                    after: updatedResult.rows[0] as ProductRow,
                };
            });

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'STOCK_ADJUST',
                    entityType: 'stock_movements',
                    entityId: params.data.id,
                    oldValue: {
                        stock_quantity: product.before.stock_quantity,
                    },
                    newValue: {
                        stock_quantity: product.after.stock_quantity,
                        adjustment_type: data.type,
                        quantity: data.quantity,
                    },
                    req,
                });
            }

            const recentMovements = await fetchRecentStockMovements(params.data.id);

            res.json({
                ...mapProduct(product.after),
                recent_stock_movements: recentMovements.map((movement) => ({
                    id: movement.id,
                    type: movement.type,
                    quantity: movement.quantity,
                    previous_stock: movement.previous_stock,
                    new_stock: movement.new_stock,
                    reason: movement.reason,
                    order_id: movement.order_id,
                    created_at: movement.created_at,
                    created_by: {
                        id: movement.created_by_user_id,
                        name: movement.created_by_user_name,
                    },
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
