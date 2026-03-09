import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import { normalizeStoreSlug } from '../services/store.service.js';
import { canSimulateStorePayments, createSimulatedApprovedStoreOrder } from '../services/store-order-sync.service.js';

const router = Router();

const uuidParamsSchema = z.object({
    id: z.string().uuid(),
});

const updateStoreConfigSchema = z.object({
    is_active: z.boolean().optional(),
    theme: z.enum(['dark', 'light']).optional(),
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    logo_url: z.string().trim().url().nullable().optional(),
    store_name: z.string().trim().min(2).max(150).optional(),
    slogan: z.string().trim().max(255).nullable().optional(),
    custom_domain: z.string().trim().max(255).nullable().optional(),
    hero_image_url: z.string().trim().url().nullable().optional(),
    hero_title: z.string().trim().max(255).nullable().optional(),
    hero_subtitle: z.string().trim().max(255).nullable().optional(),
    hero_cta_label: z.string().trim().min(2).max(80).optional(),
    wa_number: z.string().trim().max(30).nullable().optional(),
    wa_message_tpl: z.string().trim().max(3000).nullable().optional(),
    pipeline_id: z.string().uuid().nullable().optional(),
    stage_id: z.string().uuid().nullable().optional(),
    mp_access_token: z.string().trim().max(255).nullable().optional(),
    mp_public_key: z.string().trim().max(255).nullable().optional(),
    checkout_success_url: z.string().trim().url().nullable().optional(),
    checkout_failure_url: z.string().trim().url().nullable().optional(),
    seo_title: z.string().trim().max(255).nullable().optional(),
    seo_description: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');

const createStoreCategorySchema = z.object({
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    image_url: z.string().trim().url().optional(),
    position: z.coerce.number().int().min(0).default(0),
    is_active: z.boolean().optional().default(true),
});

const updateStoreCategorySchema = createStoreCategorySchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'Informe ao menos um campo para atualizar.'
);

const reorderSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});

const createStoreProductSchema = z.object({
    stock_product_id: z.string().uuid().nullable().optional(),
    category_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(2).max(255),
    slug: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().max(5000).optional(),
    price_cents: z.coerce.number().int().positive().nullable().optional(),
    price_from_cents: z.coerce.number().int().positive().nullable().optional(),
    images: z.array(z.string().trim().url()).max(10).optional().default([]),
    badge: z.enum(['novo', 'sale', 'hot']).nullable().optional(),
    is_custom: z.boolean().optional().default(false),
    is_published: z.boolean().optional().default(false),
    is_featured: z.boolean().optional().default(false),
    position: z.coerce.number().int().min(0).default(0),
    wa_message_tpl: z.string().trim().max(3000).optional(),
    seo_title: z.string().trim().max(255).optional(),
    seo_description: z.string().trim().max(2000).optional(),
});

const updateStoreProductSchema = createStoreProductSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'Informe ao menos um campo para atualizar.'
);

const simulateApprovedOrderSchema = z.object({
    customer_name: z.string().trim().min(2).max(255).optional(),
    customer_email: z.string().trim().email().max(255).optional(),
    customer_phone: z.string().trim().min(8).max(30).optional(),
}).default({});

interface StoreConfigRow {
    id: string;
    is_active: boolean;
    theme: 'dark' | 'light';
    accent_color: string;
    logo_url: string | null;
    store_name: string | null;
    slogan: string | null;
    custom_domain: string | null;
    hero_image_url: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    hero_cta_label: string;
    wa_number: string | null;
    wa_message_tpl: string | null;
    pipeline_id: string | null;
    stage_id: string | null;
    mp_access_token: string | null;
    mp_public_key: string | null;
    checkout_success_url: string | null;
    checkout_failure_url: string | null;
    seo_title: string | null;
    seo_description: string | null;
}

interface StoreCategoryRow {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    position: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

interface StoreProductRow {
    id: string;
    stock_product_id: string | null;
    stock_product_name: string | null;
    category_id: string | null;
    category_name: string | null;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number | null;
    price_from_cents: number | null;
    images: string[];
    badge: 'novo' | 'sale' | 'hot' | null;
    is_custom: boolean;
    is_published: boolean;
    is_featured: boolean;
    position: number;
    wa_message_tpl: string | null;
    seo_title: string | null;
    seo_description: string | null;
    created_at: Date;
    updated_at: Date;
}

interface StoreOrderRow {
    id: string;
    store_product_id: string;
    product_name: string;
    mp_preference_id: string | null;
    mp_payment_id: string | null;
    customer_id: string | null;
    crm_order_id: string | null;
    crm_payment_id: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    shipping_address: Record<string, unknown> | null;
    amount_cents: number;
    paid_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

function mapStoreCategory(row: StoreCategoryRow) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        image_url: row.image_url,
        position: row.position,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function mapStoreProduct(row: StoreProductRow) {
    return {
        id: row.id,
        stock_product_id: row.stock_product_id,
        stock_product_name: row.stock_product_name,
        category: row.category_id && row.category_name
            ? {
                id: row.category_id,
                name: row.category_name,
            }
            : null,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price_cents: row.price_cents,
        price_from_cents: row.price_from_cents,
        images: row.images,
        badge: row.badge,
        is_custom: row.is_custom,
        is_published: row.is_published,
        is_featured: row.is_featured,
        position: row.position,
        wa_message_tpl: row.wa_message_tpl,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function fetchStoreConfig(): Promise<StoreConfigRow | null> {
    const result = await query<StoreConfigRow>(
        `SELECT
            id,
            is_active,
            theme,
            accent_color,
            logo_url,
            store_name,
            slogan,
            custom_domain,
            hero_image_url,
            hero_title,
            hero_subtitle,
            hero_cta_label,
            wa_number,
            wa_message_tpl,
            pipeline_id,
            stage_id,
            mp_access_token,
            mp_public_key,
            checkout_success_url,
            checkout_failure_url,
            seo_title,
            seo_description
         FROM store_config
         ORDER BY created_at ASC
         LIMIT 1`
    );

    return result.rows[0] ?? null;
}

async function fetchStoreProduct(productId: string): Promise<StoreProductRow | null> {
    const result = await query<StoreProductRow>(
        `SELECT
            sp.id,
            sp.stock_product_id,
            p.name AS stock_product_name,
            sp.category_id,
            sc.name AS category_name,
            sp.name,
            sp.slug,
            sp.description,
            sp.price_cents,
            sp.price_from_cents,
            sp.images,
            sp.badge,
            sp.is_custom,
            sp.is_published,
            sp.is_featured,
            sp.position,
            sp.wa_message_tpl,
            sp.seo_title,
            sp.seo_description,
            sp.created_at,
            sp.updated_at
         FROM store_products sp
         LEFT JOIN products p ON p.id = sp.stock_product_id
         LEFT JOIN store_categories sc ON sc.id = sp.category_id
         WHERE sp.id = $1
         LIMIT 1`,
        [productId]
    );

    return result.rows[0] ?? null;
}

router.use(authenticate, requireRole(['ADMIN']));

router.get(
    '/',
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const config = await fetchStoreConfig();
            if (!config) {
                next(AppError.notFound('Configuração da loja não encontrada.'));
                return;
            }

            res.json(config);
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'store-settings-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = updateStoreConfigSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados da configuração da loja.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const current = await fetchStoreConfig();
            if (!current) {
                next(AppError.notFound('Configuração da loja não encontrada.'));
                return;
            }

            const fields = Object.entries(parsed.data);
            const setClauses = fields.map(([key], index) => `${key} = $${index + 1}`);
            setClauses.push(`updated_at = NOW()`);
            const values = fields.map(([, value]) => value);
            values.push(current.id);

            await query(
                `UPDATE store_config
                 SET ${setClauses.join(', ')}
                 WHERE id = $${values.length}`,
                values
            );

            const updated = await fetchStoreConfig();

            if (req.user && updated) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'store_config',
                    entityId: updated.id,
                    oldValue: current as unknown as Record<string, unknown>,
                    newValue: parsed.data as Record<string, unknown>,
                    req,
                });
            }

            res.json(updated);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/categories',
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<StoreCategoryRow>(
                `SELECT id, name, slug, description, image_url, position, is_active, created_at, updated_at
                 FROM store_categories
                 ORDER BY position ASC, created_at ASC`
            );

            res.json({
                data: result.rows.map(mapStoreCategory),
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/categories',
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'store-category-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createStoreCategorySchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados da categoria da loja.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const result = await query<StoreCategoryRow>(
                `INSERT INTO store_categories (
                    name,
                    slug,
                    description,
                    image_url,
                    position,
                    is_active
                 ) VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, name, slug, description, image_url, position, is_active, created_at, updated_at`,
                [
                    parsed.data.name,
                    parsed.data.slug ? normalizeStoreSlug(parsed.data.slug) : normalizeStoreSlug(parsed.data.name),
                    parsed.data.description ?? null,
                    parsed.data.image_url ?? null,
                    parsed.data.position,
                    parsed.data.is_active,
                ]
            );

            const category = result.rows[0] as StoreCategoryRow;

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'store_categories',
                    entityId: category.id,
                    oldValue: null,
                    newValue: category as unknown as Record<string, unknown>,
                    req,
                });
            }

            res.status(201).json(mapStoreCategory(category));
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/categories/reorder',
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'store-category-reorder' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = reorderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para reordenar categorias.'));
                return;
            }

            await Promise.all(
                parsed.data.ids.map((id, index) =>
                    query(`UPDATE store_categories SET position = $2, updated_at = NOW() WHERE id = $1`, [id, index + 1])
                )
            );

            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/categories/:id',
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'store-category-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = uuidParamsSchema.safeParse(req.params);
            const parsed = updateStoreCategorySchema.safeParse(req.body);

            if (!params.success || !parsed.success) {
                next(AppError.badRequest('Dados inválidos para atualizar categoria.'));
                return;
            }

            const currentResult = await query<StoreCategoryRow>(
                `SELECT id, name, slug, description, image_url, position, is_active, created_at, updated_at
                 FROM store_categories
                 WHERE id = $1
                 LIMIT 1`,
                [params.data.id]
            );
            const current = currentResult.rows[0];

            if (!current) {
                next(AppError.notFound('Categoria da loja não encontrada.'));
                return;
            }

            const normalizedData = {
                ...parsed.data,
                slug: parsed.data.slug ? normalizeStoreSlug(parsed.data.slug) : undefined,
            };

            const fields = Object.entries(normalizedData).filter(([, value]) => value !== undefined);
            const setClauses = fields.map(([key], index) => `${key} = $${index + 1}`);
            setClauses.push('updated_at = NOW()');
            const values = fields.map(([, value]) => value);
            values.push(params.data.id);

            await query(
                `UPDATE store_categories
                 SET ${setClauses.join(', ')}
                 WHERE id = $${values.length}`,
                values
            );

            const updatedResult = await query<StoreCategoryRow>(
                `SELECT id, name, slug, description, image_url, position, is_active, created_at, updated_at
                 FROM store_categories
                 WHERE id = $1
                 LIMIT 1`,
                [params.data.id]
            );

            const updated = updatedResult.rows[0] as StoreCategoryRow;

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'store_categories',
                    entityId: updated.id,
                    oldValue: current as unknown as Record<string, unknown>,
                    newValue: normalizedData as Record<string, unknown>,
                    req,
                });
            }

            res.json(mapStoreCategory(updated));
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/categories/:id',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'store-category-delete' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = uuidParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Categoria inválida.'));
                return;
            }

            const currentResult = await query<StoreCategoryRow>(
                `SELECT id, name, slug, description, image_url, position, is_active, created_at, updated_at
                 FROM store_categories
                 WHERE id = $1
                 LIMIT 1`,
                [params.data.id]
            );

            const current = currentResult.rows[0];
            if (!current) {
                next(AppError.notFound('Categoria da loja não encontrada.'));
                return;
            }

            await query('DELETE FROM store_categories WHERE id = $1', [params.data.id]);

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    entityType: 'store_categories',
                    entityId: current.id,
                    oldValue: current as unknown as Record<string, unknown>,
                    newValue: null,
                    req,
                });
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/products/:id/simulate-approved-order',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'store-simulate-approved-order' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!canSimulateStorePayments(env().NODE_ENV)) {
                next(AppError.forbidden('Simulação de pagamentos da loja desabilitada em produção.'));
                return;
            }

            const params = uuidParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Produto da loja inválido para simulação.'));
                return;
            }

            const parsed = simulateApprovedOrderSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Dados inválidos para a simulação da loja.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const order = await transaction(async (client) => {
                const simulation = await createSimulatedApprovedStoreOrder(client, {
                    storeProductId: params.data.id,
                    customerName: parsed.data.customer_name,
                    customerEmail: parsed.data.customer_email,
                    customerPhone: parsed.data.customer_phone,
                });

                const result = await client.query<StoreOrderRow>(
                    `SELECT
                        so.id,
                        so.store_product_id,
                        sp.name AS product_name,
                        so.mp_preference_id,
                        so.mp_payment_id,
                        so.customer_id,
                        so.crm_order_id,
                        so.crm_payment_id,
                        so.status,
                        so.customer_name,
                        so.customer_email,
                        so.customer_phone,
                        so.shipping_address,
                        so.amount_cents,
                        so.paid_at,
                        so.created_at,
                        so.updated_at
                     FROM store_orders so
                     INNER JOIN store_products sp ON sp.id = so.store_product_id
                     WHERE so.id = $1
                     LIMIT 1`,
                    [simulation.storeOrderId]
                );

                return result.rows[0] ?? null;
            });

            if (!order) {
                next(AppError.serviceUnavailable(
                    'STORE_SIMULATION_READ_FAILED',
                    'A simulação foi criada, mas o pedido não pôde ser relido.'
                ));
                return;
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'store_orders',
                    entityId: order.id,
                    oldValue: null,
                    newValue: {
                        mode: 'simulated-approved-order',
                        store_product_id: order.store_product_id,
                        crm_order_id: order.crm_order_id,
                        crm_payment_id: order.crm_payment_id,
                    },
                    req,
                });
            }

            res.status(201).json(order);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/products',
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<StoreProductRow>(
                `SELECT
                    sp.id,
                    sp.stock_product_id,
                    p.name AS stock_product_name,
                    sp.category_id,
                    sc.name AS category_name,
                    sp.name,
                    sp.slug,
                    sp.description,
                    sp.price_cents,
                    sp.price_from_cents,
                    sp.images,
                    sp.badge,
                    sp.is_custom,
                    sp.is_published,
                    sp.is_featured,
                    sp.position,
                    sp.wa_message_tpl,
                    sp.seo_title,
                    sp.seo_description,
                    sp.created_at,
                    sp.updated_at
                 FROM store_products sp
                 LEFT JOIN products p ON p.id = sp.stock_product_id
                 LEFT JOIN store_categories sc ON sc.id = sp.category_id
                 ORDER BY sp.position ASC, sp.created_at DESC`
            );

            res.json({
                data: result.rows.map(mapStoreProduct),
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/products',
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'store-product-create' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createStoreProductSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do produto da loja.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const result = await query<{ id: string }>(
                `INSERT INTO store_products (
                    stock_product_id,
                    category_id,
                    name,
                    slug,
                    description,
                    price_cents,
                    price_from_cents,
                    images,
                    badge,
                    is_custom,
                    is_published,
                    is_featured,
                    position,
                    wa_message_tpl,
                    seo_title,
                    seo_description
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16)
                 RETURNING id`,
                [
                    parsed.data.stock_product_id ?? null,
                    parsed.data.category_id ?? null,
                    parsed.data.name,
                    parsed.data.slug ? normalizeStoreSlug(parsed.data.slug) : normalizeStoreSlug(parsed.data.name),
                    parsed.data.description ?? null,
                    parsed.data.price_cents ?? null,
                    parsed.data.price_from_cents ?? null,
                    JSON.stringify(parsed.data.images),
                    parsed.data.badge ?? null,
                    parsed.data.is_custom,
                    parsed.data.is_published,
                    parsed.data.is_featured,
                    parsed.data.position,
                    parsed.data.wa_message_tpl ?? null,
                    parsed.data.seo_title ?? null,
                    parsed.data.seo_description ?? null,
                ]
            );

            const product = await fetchStoreProduct(result.rows[0]!.id);

            if (req.user && product) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'store_products',
                    entityId: product.id,
                    oldValue: null,
                    newValue: product as unknown as Record<string, unknown>,
                    req,
                });
            }

            res.status(201).json(mapStoreProduct(product as StoreProductRow));
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/products/reorder',
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'store-product-reorder' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = reorderSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para reordenar produtos.'));
                return;
            }

            await Promise.all(
                parsed.data.ids.map((id, index) =>
                    query(`UPDATE store_products SET position = $2, updated_at = NOW() WHERE id = $1`, [id, index + 1])
                )
            );

            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/products/:id',
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'store-product-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = uuidParamsSchema.safeParse(req.params);
            const parsed = updateStoreProductSchema.safeParse(req.body);

            if (!params.success || !parsed.success) {
                next(AppError.badRequest('Dados inválidos para atualizar produto da loja.'));
                return;
            }

            const current = await fetchStoreProduct(params.data.id);
            if (!current) {
                next(AppError.notFound('Produto da loja não encontrado.'));
                return;
            }

            const normalizedData = {
                ...parsed.data,
                slug: parsed.data.slug ? normalizeStoreSlug(parsed.data.slug) : undefined,
                images: parsed.data.images ? JSON.stringify(parsed.data.images) : undefined,
            };

            const fields = Object.entries(normalizedData).filter(([, value]) => value !== undefined);
            const setClauses = fields.map(([key], index) => `${key} = $${index + 1}`);
            setClauses.push('updated_at = NOW()');
            const values = fields.map(([, value]) => value);
            values.push(params.data.id);

            await query(
                `UPDATE store_products
                 SET ${setClauses.join(', ')}
                 WHERE id = $${values.length}`,
                values
            );

            const updated = await fetchStoreProduct(params.data.id);

            if (req.user && updated) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'store_products',
                    entityId: updated.id,
                    oldValue: current as unknown as Record<string, unknown>,
                    newValue: parsed.data as Record<string, unknown>,
                    req,
                });
            }

            res.json(mapStoreProduct(updated as StoreProductRow));
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/products/:id',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'store-product-delete' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = uuidParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Produto inválido.'));
                return;
            }

            const current = await fetchStoreProduct(params.data.id);
            if (!current) {
                next(AppError.notFound('Produto da loja não encontrado.'));
                return;
            }

            await query('DELETE FROM store_products WHERE id = $1', [params.data.id]);

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    entityType: 'store_products',
                    entityId: current.id,
                    oldValue: current as unknown as Record<string, unknown>,
                    newValue: null,
                    req,
                });
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/orders',
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<StoreOrderRow>(
                `SELECT
                    so.id,
                    so.store_product_id,
                    sp.name AS product_name,
                    so.mp_preference_id,
                    so.mp_payment_id,
                    so.customer_id,
                    so.crm_order_id,
                    so.crm_payment_id,
                    so.status,
                    so.customer_name,
                    so.customer_email,
                    so.customer_phone,
                    so.shipping_address,
                    so.amount_cents,
                    so.paid_at,
                    so.created_at,
                    so.updated_at
                 FROM store_orders so
                 INNER JOIN store_products sp ON sp.id = so.store_product_id
                 ORDER BY so.created_at DESC`
            );

            res.json({
                data: result.rows,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/orders/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = uuidParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Pedido da loja inválido.'));
                return;
            }

            const result = await query<StoreOrderRow>(
                `SELECT
                    so.id,
                    so.store_product_id,
                    sp.name AS product_name,
                    so.mp_preference_id,
                    so.mp_payment_id,
                    so.customer_id,
                    so.crm_order_id,
                    so.crm_payment_id,
                    so.status,
                    so.customer_name,
                    so.customer_email,
                    so.customer_phone,
                    so.shipping_address,
                    so.amount_cents,
                    so.paid_at,
                    so.created_at,
                    so.updated_at
                 FROM store_orders so
                 INNER JOIN store_products sp ON sp.id = so.store_product_id
                 WHERE so.id = $1
                 LIMIT 1`,
                [params.data.id]
            );

            const order = result.rows[0];
            if (!order) {
                next(AppError.notFound('Pedido da loja não encontrado.'));
                return;
            }

            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
