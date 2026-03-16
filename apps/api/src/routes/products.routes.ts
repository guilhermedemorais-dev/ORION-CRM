import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import multer from 'multer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

const listProductsSchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    low_stock: z.coerce.boolean().optional(),
    inStock: z.coerce.boolean().optional(),
    active_only: z.coerce.boolean().optional(),
    status: z.enum(['in_stock', 'critical', 'out_of_stock']).optional(),
    sort: z.enum(['name', 'price_cents', 'stock_quantity', 'updated_at']).optional(),
    dir: z.enum(['asc', 'desc']).optional(),
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
    cost_price_cents: z.coerce.number().int().min(0).optional(),
    stock_quantity: z.coerce.number().int().min(0).default(0),
    minimum_stock: z.coerce.number().int().min(0).default(0),
    category: z.string().trim().max(100).optional(),
    collection: z.string().trim().max(100).optional(),
    metal: z.string().trim().max(50).optional(),
    weight_grams: z.coerce.number().positive().optional(),
    location: z.string().trim().max(100).optional(),
    size_info: z.string().trim().max(200).optional(),
    stones: z.string().trim().max(500).optional(),
    is_active: z.coerce.boolean().optional().default(true),
    pdv_enabled: z.coerce.boolean().optional().default(true),
    requires_production: z.coerce.boolean().optional().default(false),
});

const updateProductSchema = createProductSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'Informe ao menos um campo para atualizar.'
);

const stockAdjustmentSchema = z.object({
    type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA', 'DEVOLUCAO', 'ENTRADA_INICIAL']),
    quantity: z.coerce.number().int().positive(),
    reason: z.string().trim().min(3).max(2000),
    notes: z.string().trim().max(2000).optional(),
    is_absolute: z.coerce.boolean().optional(),
});

const stockAdjustLegacySchema = z.object({
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
    cost_price_cents: number;
    stock_quantity: number;
    minimum_stock: number;
    category: string | null;
    collection: string | null;
    metal: string | null;
    weight_grams: number | null;
    location: string | null;
    size_info: string | null;
    stones: string | null;
    images: string[];
    photo_url: string | null;
    is_active: boolean;
    pdv_enabled: boolean;
    requires_production: boolean;
    created_at: Date;
    updated_at: Date;
}

interface StockMovementRow {
    id: string;
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'PERDA' | 'DEVOLUCAO' | 'ENTRADA_INICIAL';
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string;
    notes: string | null;
    order_id: string | null;
    created_at: Date;
    created_by_id: string;
    created_by_name: string;
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
            COALESCE(cost_price_cents, 0) AS cost_price_cents,
            stock_quantity,
            minimum_stock,
            category,
            collection,
            metal,
            weight_grams,
            location,
            size_info,
            stones,
            images,
            photo_url,
            is_active,
            COALESCE(pdv_enabled, true) AS pdv_enabled,
            COALESCE(requires_production, false) AS requires_production,
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
            sm.notes,
            sm.order_id,
            sm.created_at,
            u.id AS created_by_id,
            u.name AS created_by_name
         FROM stock_movements sm
         INNER JOIN users u ON u.id = sm.created_by
         WHERE sm.product_id = $1
         ORDER BY sm.created_at DESC
         LIMIT 15`,
        [productId]
    );

    return result.rows;
}

function mapMovement(movement: StockMovementRow) {
    return {
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity,
        previous_stock: movement.previous_stock,
        new_stock: movement.new_stock,
        reason: movement.reason,
        notes: movement.notes,
        order_id: movement.order_id,
        created_at: movement.created_at,
        created_by: {
            id: movement.created_by_id,
            name: movement.created_by_name,
        },
    };
}

async function applyStockMovement(
    productId: string,
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'PERDA' | 'DEVOLUCAO' | 'ENTRADA_INICIAL',
    quantity: number,
    reason: string,
    userId: string,
    notes?: string,
    isAbsolute?: boolean
): Promise<{ before: ProductRow; after: ProductRow }> {
    return transaction(async (client) => {
        const productResult = await client.query<ProductRow>(
            `SELECT
                id,
                code,
                name,
                description,
                price_cents,
                COALESCE(cost_price_cents, 0) AS cost_price_cents,
                stock_quantity,
                minimum_stock,
                category,
                collection,
                metal,
                weight_grams,
                location,
                size_info,
                stones,
                images,
                photo_url,
                is_active,
                COALESCE(pdv_enabled, true) AS pdv_enabled,
                COALESCE(requires_production, false) AS requires_production,
                created_at,
                updated_at
             FROM products
             WHERE id = $1
             FOR UPDATE`,
            [productId]
        );

        const current = productResult.rows[0];
        if (!current) {
            throw AppError.notFound('Produto não encontrado.');
        }

        let newStock: number;

        if (type === 'ENTRADA' || type === 'DEVOLUCAO' || type === 'ENTRADA_INICIAL') {
            newStock = current.stock_quantity + quantity;
        } else if (type === 'SAIDA' || type === 'PERDA') {
            if (current.stock_quantity < quantity) {
                throw AppError.conflict(
                    'INSUFFICIENT_STOCK',
                    `Estoque insuficiente. Disponível: ${current.stock_quantity}`
                );
            }
            newStock = current.stock_quantity - quantity;
        } else {
            // AJUSTE
            if (isAbsolute) {
                newStock = quantity;
            } else {
                newStock = current.stock_quantity + quantity;
            }
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
                notes,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                current.id,
                type,
                quantity,
                current.stock_quantity,
                newStock,
                reason,
                notes ?? null,
                userId,
            ]
        );

        const updatedResult = await client.query<ProductRow>(
            `SELECT
                id,
                code,
                name,
                description,
                price_cents,
                COALESCE(cost_price_cents, 0) AS cost_price_cents,
                stock_quantity,
                minimum_stock,
                category,
                collection,
                metal,
                weight_grams,
                location,
                size_info,
                stones,
                images,
                photo_url,
                is_active,
                COALESCE(pdv_enabled, true) AS pdv_enabled,
                COALESCE(requires_production, false) AS requires_production,
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
}

// ─── GET /stats ───────────────────────────────────────────────────────────────

router.get(
    '/stats',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<{
                active: number;
                critical: number;
                out_of_stock: number;
                total_cost_cents: string;
            }>(
                `SELECT
                  COUNT(*) FILTER (WHERE is_active = true)::int AS active,
                  COUNT(*) FILTER (WHERE stock_quantity <= minimum_stock AND stock_quantity > 0 AND is_active = true)::int AS critical,
                  COUNT(*) FILTER (WHERE stock_quantity = 0 AND is_active = true)::int AS out_of_stock,
                  COALESCE(SUM(COALESCE(cost_price_cents,0) * stock_quantity), 0)::bigint AS total_cost_cents
                FROM products`,
                []
            );

            const row = result.rows[0];
            if (!row) { res.json({ active: 0, critical: 0, out_of_stock: 0, total_cost_cents: 0 }); return; }
            res.json({
                active: Number(row.active),
                critical: Number(row.critical),
                out_of_stock: Number(row.out_of_stock),
                total_cost_cents: Number(row.total_cost_cents),
            });
        } catch (error) {
            next(error);
        }
    }
);

// ─── GET /check-code ──────────────────────────────────────────────────────────

router.get(
    '/check-code',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const checkCodeSchema = z.object({
                code: z.string().trim().min(1).max(50),
                exclude_id: z.string().uuid().optional(),
            });

            const parsed = checkCodeSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos.'));
                return;
            }

            const values: unknown[] = [parsed.data.code.toUpperCase()];
            let sql = `SELECT id FROM products WHERE code = $1`;
            if (parsed.data.exclude_id) {
                values.push(parsed.data.exclude_id);
                sql += ` AND id != $2`;
            }
            sql += ` LIMIT 1`;

            const result = await query<{ id: string }>(sql, values);

            res.json({ available: result.rows.length === 0 });
        } catch (error) {
            next(error);
        }
    }
);

// ─── GET /export ─────────────────────────────────────────────────────────────

router.get(
    '/export',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<ProductRow>(
                `SELECT
                    code,
                    name,
                    category,
                    collection,
                    price_cents,
                    COALESCE(cost_price_cents, 0) AS cost_price_cents,
                    stock_quantity,
                    minimum_stock,
                    metal,
                    weight_grams,
                    location,
                    size_info,
                    stones,
                    is_active,
                    COALESCE(pdv_enabled, true) AS pdv_enabled
                 FROM products
                 ORDER BY code ASC`,
                []
            );

            const header = 'code,name,category,collection,price_cents,cost_price_cents,stock_quantity,minimum_stock,metal,weight_grams,location,size_info,stones,is_active,pdv_enabled';

            const escapeField = (value: unknown): string => {
                if (value === null || value === undefined) return '';
                const str = String(value);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const rows = result.rows.map((row) =>
                [
                    escapeField(row.code),
                    escapeField(row.name),
                    escapeField(row.category),
                    escapeField(row.collection),
                    escapeField(row.price_cents),
                    escapeField(row.cost_price_cents),
                    escapeField(row.stock_quantity),
                    escapeField(row.minimum_stock),
                    escapeField(row.metal),
                    escapeField(row.weight_grams),
                    escapeField(row.location),
                    escapeField(row.size_info),
                    escapeField(row.stones),
                    escapeField(row.is_active),
                    escapeField(row.pdv_enabled),
                ].join(',')
            );

            const csv = [header, ...rows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="estoque.csv"');
            res.send(csv);
        } catch (error) {
            next(error);
        }
    }
);

// ─── POST /import ─────────────────────────────────────────────────────────────

router.post(
    '/import',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const rawBody: string = typeof req.body === 'string' ? req.body : '';
            const lines = rawBody.split('\n').map((l) => l.trim()).filter(Boolean);

            if (lines.length < 2) {
                next(AppError.badRequest('CSV inválido. Deve conter cabeçalho e ao menos uma linha.'));
                return;
            }

            const headers = (lines[0] ?? '').split(',').map((h) => h.trim().toLowerCase());

            const requiredColumns = ['code', 'name', 'price_cents', 'stock_quantity'];
            for (const col of requiredColumns) {
                if (!headers.includes(col)) {
                    next(AppError.badRequest(`CSV inválido. Coluna obrigatória ausente: ${col}`));
                    return;
                }
            }

            const getCol = (cols: string[], header: string): string | undefined => {
                const idx = headers.indexOf(header);
                if (idx === -1) return undefined;
                return cols[idx]?.trim() ?? undefined;
            };

            let imported = 0;
            const errors: Array<{ line: number; error: string }> = [];

            for (let i = 1; i < lines.length; i++) {
                const lineNumber = i + 1;
                const cols = (lines[i] ?? '').split(',');

                try {
                    const code = getCol(cols, 'code');
                    const name = getCol(cols, 'name');
                    const priceCentsRaw = getCol(cols, 'price_cents');
                    const stockQtyRaw = getCol(cols, 'stock_quantity');

                    if (!code || !name || !priceCentsRaw || !stockQtyRaw) {
                        errors.push({ line: lineNumber, error: 'Campos obrigatórios ausentes (code, name, price_cents, stock_quantity).' });
                        continue;
                    }

                    const priceCents = Number.parseInt(priceCentsRaw, 10);
                    const stockQty = Number.parseInt(stockQtyRaw, 10);

                    if (Number.isNaN(priceCents) || priceCents < 0) {
                        errors.push({ line: lineNumber, error: 'price_cents inválido.' });
                        continue;
                    }
                    if (Number.isNaN(stockQty) || stockQty < 0) {
                        errors.push({ line: lineNumber, error: 'stock_quantity inválido.' });
                        continue;
                    }

                    const category = getCol(cols, 'category') || null;
                    const metalVal = getCol(cols, 'metal') || null;
                    const weightRaw = getCol(cols, 'weight_grams');
                    const weightGrams = weightRaw ? Number.parseFloat(weightRaw) : null;
                    const isActiveRaw = getCol(cols, 'is_active');
                    const isActive = isActiveRaw !== undefined ? isActiveRaw !== 'false' && isActiveRaw !== '0' : true;
                    const pdvEnabledRaw = getCol(cols, 'pdv_enabled');
                    const pdvEnabled = pdvEnabledRaw !== undefined ? pdvEnabledRaw !== 'false' && pdvEnabledRaw !== '0' : true;

                    await query(
                        `INSERT INTO products (code, name, price_cents, stock_quantity, category, metal, weight_grams, is_active, pdv_enabled)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                         ON CONFLICT (code) DO UPDATE SET
                           name = EXCLUDED.name,
                           price_cents = EXCLUDED.price_cents,
                           stock_quantity = EXCLUDED.stock_quantity,
                           category = EXCLUDED.category,
                           metal = EXCLUDED.metal,
                           weight_grams = EXCLUDED.weight_grams,
                           is_active = EXCLUDED.is_active,
                           pdv_enabled = EXCLUDED.pdv_enabled,
                           updated_at = NOW()`,
                        [
                            code.toUpperCase(),
                            name,
                            priceCents,
                            stockQty,
                            category,
                            metalVal,
                            weightGrams,
                            isActive,
                            pdvEnabled,
                        ]
                    );

                    imported++;
                } catch (rowError) {
                    const msg = rowError instanceof Error ? rowError.message : 'Erro desconhecido.';
                    errors.push({ line: lineNumber, error: msg });
                }
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'IMPORT',
                    entityType: 'products',
                    entityId: 'bulk',
                    oldValue: null,
                    newValue: { imported, errors: errors.length },
                    req,
                });
            }

            res.json({ imported, errors });
        } catch (error) {
            next(error);
        }
    }
);

// ─── GET / ───────────────────────────────────────────────────────────────────

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

            if (parsed.data.active_only) {
                filters.push('p.is_active = true');
            }

            if (parsed.data.status === 'in_stock') {
                filters.push('p.stock_quantity > 0');
            } else if (parsed.data.status === 'critical') {
                filters.push('p.stock_quantity <= p.minimum_stock AND p.stock_quantity > 0');
            } else if (parsed.data.status === 'out_of_stock') {
                filters.push('p.stock_quantity = 0');
            }

            if (parsed.data.low_stock) {
                filters.push('p.stock_quantity <= p.minimum_stock');
            }

            if (parsed.data.inStock) {
                filters.push('p.stock_quantity > 0');
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

            const allowedSortCols: Record<string, string> = {
                name: 'p.name',
                price_cents: 'p.price_cents',
                stock_quantity: 'p.stock_quantity',
                updated_at: 'p.updated_at',
            };

            const sortCol = parsed.data.sort ? (allowedSortCols[parsed.data.sort] ?? 'p.updated_at') : 'p.updated_at';
            const sortDir = parsed.data.dir === 'asc' ? 'ASC' : 'DESC';
            const orderClause = `ORDER BY ${sortCol} ${sortDir}`;

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
                    COALESCE(p.cost_price_cents, 0) AS cost_price_cents,
                    p.stock_quantity,
                    p.minimum_stock,
                    p.category,
                    p.collection,
                    p.metal,
                    p.weight_grams,
                    p.location,
                    p.size_info,
                    p.stones,
                    p.images,
                    p.photo_url,
                    p.is_active,
                    COALESCE(p.pdv_enabled, true) AS pdv_enabled,
                    COALESCE(p.requires_production, false) AS requires_production,
                    p.created_at,
                    p.updated_at
                 FROM products p
                 ${whereClause}
                 ${orderClause}
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

// ─── POST / ───────────────────────────────────────────────────────────────────

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
                    cost_price_cents,
                    stock_quantity,
                    minimum_stock,
                    category,
                    collection,
                    metal,
                    weight_grams,
                    location,
                    size_info,
                    stones,
                    is_active,
                    pdv_enabled,
                    requires_production
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                  RETURNING
                    id,
                    code,
                    name,
                    description,
                    price_cents,
                    COALESCE(cost_price_cents, 0) AS cost_price_cents,
                    stock_quantity,
                    minimum_stock,
                    category,
                    collection,
                    metal,
                    weight_grams,
                    location,
                    size_info,
                    stones,
                    images,
                    photo_url,
                    is_active,
                    COALESCE(pdv_enabled, true) AS pdv_enabled,
                    COALESCE(requires_production, false) AS requires_production,
                    created_at,
                    updated_at`,
                [
                    data.code.toUpperCase(),
                    data.name,
                    data.description ?? null,
                    data.price_cents,
                    data.cost_price_cents ?? 0,
                    data.stock_quantity,
                    data.minimum_stock,
                    data.category ?? null,
                    data.collection ?? null,
                    data.metal ?? null,
                    data.weight_grams ?? null,
                    data.location ?? null,
                    data.size_info ?? null,
                    data.stones ?? null,
                    data.is_active,
                    data.pdv_enabled,
                    data.requires_production,
                ]
            );

            const product = result.rows[0];

            if (product && data.stock_quantity > 0 && req.user) {
                await query(
                    `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, created_by)
                     VALUES ($1, 'ENTRADA_INICIAL', $2, 0, $2, 'Estoque inicial do produto', $3)`,
                    [product.id, data.stock_quantity, req.user.id]
                );
            }

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

// ─── GET /:id ─────────────────────────────────────────────────────────────────

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
                recent_stock_movements: recentMovements.map(mapMovement),
            });
        } catch (error) {
            next(error);
        }
    }
);

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

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
            if (data.cost_price_cents !== undefined) {
                values.push(data.cost_price_cents);
                updates.push(`cost_price_cents = $${values.length}`);
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
            if (data.collection !== undefined) {
                values.push(data.collection || null);
                updates.push(`collection = $${values.length}`);
            }
            if (data.metal !== undefined) {
                values.push(data.metal || null);
                updates.push(`metal = $${values.length}`);
            }
            if (data.weight_grams !== undefined) {
                values.push(data.weight_grams ?? null);
                updates.push(`weight_grams = $${values.length}`);
            }
            if (data.location !== undefined) {
                values.push(data.location || null);
                updates.push(`location = $${values.length}`);
            }
            if (data.size_info !== undefined) {
                values.push(data.size_info || null);
                updates.push(`size_info = $${values.length}`);
            }
            if (data.stones !== undefined) {
                values.push(data.stones || null);
                updates.push(`stones = $${values.length}`);
            }
            if (data.is_active !== undefined) {
                values.push(data.is_active);
                updates.push(`is_active = $${values.length}`);
            }
            if (data.pdv_enabled !== undefined) {
                values.push(data.pdv_enabled);
                updates.push(`pdv_enabled = $${values.length}`);
            }
            if (data.requires_production !== undefined) {
                values.push(data.requires_production);
                updates.push(`requires_production = $${values.length}`);
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
                    COALESCE(cost_price_cents, 0) AS cost_price_cents,
                    stock_quantity,
                    minimum_stock,
                    category,
                    collection,
                    metal,
                    weight_grams,
                    location,
                    size_info,
                    stones,
                    images,
                    photo_url,
                    is_active,
                    COALESCE(pdv_enabled, true) AS pdv_enabled,
                    COALESCE(requires_production, false) AS requires_production,
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

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = productParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Produto inválido.'));
                return;
            }

            const before = await fetchProduct(parsed.data.id);
            if (!before) {
                next(AppError.notFound('Produto não encontrado.'));
                return;
            }

            await query(
                `UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1`,
                [parsed.data.id]
            );

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    entityType: 'products',
                    entityId: parsed.data.id,
                    oldValue: { is_active: true },
                    newValue: { is_active: false },
                    req,
                });
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

// ─── GET /:id/movements ───────────────────────────────────────────────────────

router.get(
    '/:id/movements',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = productParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Produto inválido.'));
                return;
            }

            const pageSchema = z.object({
                page: z.coerce.number().int().min(1).default(1),
                limit: z.coerce.number().int().min(1).max(100).default(20),
            });

            const pagination = pageSchema.safeParse(req.query);
            if (!pagination.success) {
                next(AppError.badRequest('Parâmetros de paginação inválidos.'));
                return;
            }

            const product = await fetchProduct(params.data.id);
            if (!product) {
                next(AppError.notFound('Produto não encontrado.'));
                return;
            }

            const { page, limit } = pagination.data;
            const offset = (page - 1) * limit;

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total FROM stock_movements WHERE product_id = $1`,
                [params.data.id]
            );

            const result = await query<StockMovementRow>(
                `SELECT sm.id, sm.type, sm.quantity, sm.previous_stock, sm.new_stock, sm.reason, sm.notes, sm.order_id, sm.created_at,
                        u.id AS created_by_id, u.name AS created_by_name
                 FROM stock_movements sm
                 INNER JOIN users u ON u.id = sm.created_by
                 WHERE sm.product_id = $1
                 ORDER BY sm.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [params.data.id, limit, offset]
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map(mapMovement),
                meta: {
                    total,
                    page,
                    limit,
                    pages: Math.max(1, Math.ceil(total / limit)),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// ─── POST /:id/movements ──────────────────────────────────────────────────────

router.post(
    '/:id/movements',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'products-movements' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = productParamsSchema.safeParse(req.params);
            const body = stockAdjustmentSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest(
                    'Não foi possível registrar a movimentação.',
                    body.success ? [] : body.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            if (!req.user) {
                next(AppError.unauthorized('Não autenticado.'));
                return;
            }

            const data = body.data;

            const result = await applyStockMovement(
                params.data.id,
                data.type,
                data.quantity,
                data.reason,
                req.user.id,
                data.notes,
                data.is_absolute
            );

            await createAuditLog({
                userId: req.user.id,
                action: 'STOCK_ADJUST',
                entityType: 'stock_movements',
                entityId: params.data.id,
                oldValue: { stock_quantity: result.before.stock_quantity },
                newValue: {
                    stock_quantity: result.after.stock_quantity,
                    adjustment_type: data.type,
                    quantity: data.quantity,
                },
                req,
            });

            const recentMovements = await fetchRecentStockMovements(params.data.id);

            res.status(201).json({
                ...mapProduct(result.after),
                recent_stock_movements: recentMovements.map(mapMovement),
            });
        } catch (error) {
            next(error);
        }
    }
);

// ─── POST /:id/stock-adjust (legacy) ─────────────────────────────────────────

router.post(
    '/:id/stock-adjust',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'products-stock-adjust' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = productParamsSchema.safeParse(req.params);
            const body = stockAdjustLegacySchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest(
                    'Não foi possível ajustar o estoque.',
                    body.success ? [] : body.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            if (!req.user) {
                next(AppError.unauthorized('Não autenticado.'));
                return;
            }

            const data = body.data;
            const isAbsolute = data.type === 'AJUSTE';

            const result = await applyStockMovement(
                params.data.id,
                data.type,
                data.quantity,
                data.reason,
                req.user.id,
                undefined,
                isAbsolute
            );

            await createAuditLog({
                userId: req.user.id,
                action: 'STOCK_ADJUST',
                entityType: 'stock_movements',
                entityId: params.data.id,
                oldValue: { stock_quantity: result.before.stock_quantity },
                newValue: {
                    stock_quantity: result.after.stock_quantity,
                    adjustment_type: data.type,
                    quantity: data.quantity,
                },
                req,
            });

            const recentMovements = await fetchRecentStockMovements(params.data.id);

            res.json({
                ...mapProduct(result.after),
                recent_stock_movements: recentMovements.map(mapMovement),
            });
        } catch (error) {
            next(error);
        }
    }
);

// ─── POST /:id/photo ──────────────────────────────────────────────────────────

router.post(
    '/:id/photo',
    authenticate,
    requireRole(['ADMIN']),
    upload.single('photo'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = productParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Produto inválido.'));
                return;
            }

            const product = await fetchProduct(params.data.id);
            if (!product) {
                next(AppError.notFound('Produto não encontrado.'));
                return;
            }

            if (!req.file) {
                next(AppError.badRequest('Nenhum arquivo enviado.'));
                return;
            }

            const buffer = req.file.buffer;
            if (buffer.length < 4) {
                next(AppError.badRequest('Arquivo inválido.'));
                return;
            }

            // Validate magic bytes
            const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
            const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
            const isWebp =
                buffer.length >= 12 &&
                buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

            if (!isPng && !isJpeg && !isWebp) {
                next(AppError.badRequest('Tipo de arquivo inválido. Apenas PNG, JPEG e WebP são aceitos.'));
                return;
            }

            let ext = 'jpg';
            if (isPng) ext = 'png';
            else if (isWebp) ext = 'webp';

            const uploadDir = join('/uploads/products', params.data.id);
            mkdirSync(uploadDir, { recursive: true });

            const filename = `photo.${ext}`;
            const filePath = join(uploadDir, filename);
            writeFileSync(filePath, buffer);

            const photoUrl = `/uploads/products/${params.data.id}/${filename}`;

            await query(
                `UPDATE products SET photo_url = $2, updated_at = NOW() WHERE id = $1`,
                [params.data.id, photoUrl]
            );

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'products',
                    entityId: params.data.id,
                    oldValue: { photo_url: product.photo_url },
                    newValue: { photo_url: photoUrl },
                    req,
                });
            }

            res.json({ photo_url: photoUrl });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
