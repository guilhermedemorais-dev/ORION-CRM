import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createPaymentPreference, fetchMercadoPagoPayment, verifyMercadoPagoSignature } from '../services/mercadopago.service.js';
import {
    buildStoreWhatsAppMessage,
    isStoreProductAvailable,
    resolveStorePriceCents,
} from '../services/store.service.js';

const router = Router();

const listStoreProductsSchema = z.object({
    search: z.string().trim().max(120).optional(),
    category: z.string().trim().max(100).optional(),
    badge: z.enum(['novo', 'sale', 'hot']).optional(),
    is_custom: z.coerce.boolean().optional(),
    featured: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
});

const productSlugSchema = z.object({
    slug: z.string().trim().min(1).max(255),
});

const checkoutPreferenceSchema = z.object({
    product_id: z.string().uuid(),
    customer_name: z.string().trim().min(2).max(255),
    customer_email: z.string().trim().email().max(255).optional(),
    customer_phone: z.string().trim().min(8).max(30).optional(),
    shipping_address: z.object({
        cep: z.string().trim().min(8).max(9),
        street: z.string().trim().min(2).max(255),
        number: z.string().trim().min(1).max(30),
        complement: z.string().trim().max(120).optional(),
        neighborhood: z.string().trim().min(2).max(120),
        city: z.string().trim().min(2).max(120),
        state: z.string().trim().min(2).max(2),
    }),
});

const webhookBodySchema = z.object({
    data: z.object({
        id: z.union([z.string(), z.number()]),
    }).optional(),
    type: z.string().optional(),
});

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
}

interface StoreProductRow {
    id: string;
    stock_product_id: string | null;
    category_id: string | null;
    category_name: string | null;
    category_slug: string | null;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number | null;
    price_from_cents: number | null;
    base_price_cents: number | null;
    images: string[];
    badge: 'novo' | 'sale' | 'hot' | null;
    is_custom: boolean;
    is_published: boolean;
    is_featured: boolean;
    position: number;
    wa_message_tpl: string | null;
    seo_title: string | null;
    seo_description: string | null;
    stock_quantity: number | null;
    minimum_stock: number | null;
    metal: string | null;
    weight_grams: number | null;
    created_at: Date;
    updated_at: Date;
}

interface StoreOrderRow {
    id: string;
    mp_preference_id: string | null;
    mp_payment_id: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
    amount_cents: number;
}

function mapStoreConfig(row: StoreConfigRow | null) {
    return {
        is_active: row?.is_active ?? false,
        theme: row?.theme ?? 'dark',
        accent_color: row?.accent_color ?? '#BFA06A',
        logo_url: row?.logo_url ?? null,
        store_name: row?.store_name ?? 'Minha Joalheria',
        slogan: row?.slogan ?? null,
        custom_domain: row?.custom_domain ?? null,
        hero_image_url: row?.hero_image_url ?? null,
        hero_title: row?.hero_title ?? 'Coleção ORION',
        hero_subtitle: row?.hero_subtitle ?? null,
        hero_cta_label: row?.hero_cta_label ?? 'Ver Coleção',
        wa_number: row?.wa_number ?? null,
        seo_title: row?.seo_title ?? row?.store_name ?? 'Minha Joalheria',
        seo_description: row?.seo_description ?? null,
    };
}

function buildStoreProductUrl(slug: string): string {
    const base = env().FRONTEND_URL.replace(/\/$/, '');
    return `${base}/loja/produto/${slug}`;
}

function buildWhatsAppUrl(waNumber: string | null, message: string | null): string | null {
    if (!waNumber || !message) {
        return null;
    }

    const digits = waNumber.replace(/\D/g, '');
    if (!digits) {
        return null;
    }

    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function mapPublicStoreProduct(row: StoreProductRow, config: StoreConfigRow | null) {
    const resolvedPrice = resolveStorePriceCents({
        price_cents: row.price_cents ?? row.base_price_cents,
        price_from_cents: row.price_from_cents,
    });
    const whatsappMessage = buildStoreWhatsAppMessage(row.wa_message_tpl ?? config?.wa_message_tpl, {
        product_name: row.name,
        product_url: buildStoreProductUrl(row.slug),
    });

    return {
        id: row.id,
        stock_product_id: row.stock_product_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price_cents: resolvedPrice,
        price_from_cents: row.price_from_cents,
        images: row.images,
        cover_image: row.images[0] ?? null,
        badge: row.badge,
        is_custom: row.is_custom,
        is_featured: row.is_featured,
        is_available: isStoreProductAvailable({
            is_custom: row.is_custom,
            stock_quantity: row.stock_quantity,
        }),
        category: row.category_name
            ? {
                id: row.category_id,
                name: row.category_name,
                slug: row.category_slug,
            }
            : null,
        stock_quantity: row.stock_quantity,
        minimum_stock: row.minimum_stock,
        metal: row.metal,
        weight_grams: row.weight_grams,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        whatsapp_url: buildWhatsAppUrl(config?.wa_number ?? null, whatsappMessage),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function mapStoreOrderStatus(status: string): StoreOrderRow['status'] {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    if (status === 'refunded') return 'refunded';
    if (status === 'cancelled') return 'cancelled';
    return 'pending';
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
            seo_title,
            seo_description
         FROM store_config
         ORDER BY created_at ASC
         LIMIT 1`
    );

    return result.rows[0] ?? null;
}

async function fetchStoreCategories(): Promise<StoreCategoryRow[]> {
    const result = await query<StoreCategoryRow>(
        `SELECT id, name, slug, description, image_url, position, is_active
         FROM store_categories
         WHERE is_active = TRUE
         ORDER BY position ASC, name ASC`
    );

    return result.rows;
}

async function fetchStoreProductBySlug(slug: string): Promise<StoreProductRow | null> {
    const result = await query<StoreProductRow>(
        `SELECT
            sp.id,
            sp.stock_product_id,
            sp.category_id,
            sc.name AS category_name,
            sc.slug AS category_slug,
            sp.name,
            sp.slug,
            sp.description,
            sp.price_cents,
            sp.price_from_cents,
            p.price_cents AS base_price_cents,
            sp.images,
            sp.badge,
            sp.is_custom,
            sp.is_published,
            sp.is_featured,
            sp.position,
            sp.wa_message_tpl,
            sp.seo_title,
            sp.seo_description,
            p.stock_quantity,
            p.minimum_stock,
            p.metal,
            p.weight_grams,
            sp.created_at,
            sp.updated_at
         FROM store_products sp
         LEFT JOIN store_categories sc ON sc.id = sp.category_id
         LEFT JOIN products p ON p.id = sp.stock_product_id
         WHERE sp.slug = $1
           AND sp.is_published = TRUE
         LIMIT 1`,
        [slug]
    );

    return result.rows[0] ?? null;
}

async function fetchStoreProductById(id: string): Promise<StoreProductRow | null> {
    const result = await query<StoreProductRow>(
        `SELECT
            sp.id,
            sp.stock_product_id,
            sp.category_id,
            sc.name AS category_name,
            sc.slug AS category_slug,
            sp.name,
            sp.slug,
            sp.description,
            sp.price_cents,
            sp.price_from_cents,
            p.price_cents AS base_price_cents,
            sp.images,
            sp.badge,
            sp.is_custom,
            sp.is_published,
            sp.is_featured,
            sp.position,
            sp.wa_message_tpl,
            sp.seo_title,
            sp.seo_description,
            p.stock_quantity,
            p.minimum_stock,
            p.metal,
            p.weight_grams,
            sp.created_at,
            sp.updated_at
         FROM store_products sp
         LEFT JOIN store_categories sc ON sc.id = sp.category_id
         LEFT JOIN products p ON p.id = sp.stock_product_id
         WHERE sp.id = $1
         LIMIT 1`,
        [id]
    );

    return result.rows[0] ?? null;
}

router.get(
    '/config',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'store-config-public' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const config = await fetchStoreConfig();
            res.json(mapStoreConfig(config));
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/categories',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'store-categories-public' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const categories = await fetchStoreCategories();
            res.json({
                data: categories.map((row) => ({
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    description: row.description,
                    image_url: row.image_url,
                    position: row.position,
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/products',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'store-products-public' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listStoreProductsSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos para a loja.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const config = await fetchStoreConfig();
            if (!config?.is_active) {
                res.json({
                    data: [],
                    meta: {
                        total: 0,
                        page: parsed.data.page,
                        limit: parsed.data.limit,
                        pages: 1,
                    },
                });
                return;
            }

            const filters = ['sp.is_published = TRUE'];
            const values: unknown[] = [];

            if (parsed.data.search) {
                values.push(`%${parsed.data.search}%`);
                filters.push(`(sp.name ILIKE $${values.length} OR sp.slug ILIKE $${values.length})`);
            }

            if (parsed.data.category) {
                values.push(parsed.data.category);
                filters.push(`sc.slug = $${values.length}`);
            }

            if (parsed.data.badge) {
                values.push(parsed.data.badge);
                filters.push(`sp.badge = $${values.length}`);
            }

            if (typeof parsed.data.is_custom === 'boolean') {
                values.push(parsed.data.is_custom);
                filters.push(`sp.is_custom = $${values.length}`);
            }

            if (parsed.data.featured) {
                filters.push('sp.is_featured = TRUE');
            }

            const whereClause = `WHERE ${filters.join(' AND ')}`;

            const countResult = await query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM store_products sp
                 LEFT JOIN store_categories sc ON sc.id = sp.category_id
                 ${whereClause}`,
                values
            );

            values.push(parsed.data.limit);
            const limitIndex = values.length;
            values.push((parsed.data.page - 1) * parsed.data.limit);
            const offsetIndex = values.length;

            const result = await query<StoreProductRow>(
                `SELECT
                    sp.id,
                    sp.stock_product_id,
                    sp.category_id,
                    sc.name AS category_name,
                    sc.slug AS category_slug,
                    sp.name,
                    sp.slug,
                    sp.description,
                    sp.price_cents,
                    sp.price_from_cents,
                    p.price_cents AS base_price_cents,
                    sp.images,
                    sp.badge,
                    sp.is_custom,
                    sp.is_published,
                    sp.is_featured,
                    sp.position,
                    sp.wa_message_tpl,
                    sp.seo_title,
                    sp.seo_description,
                    p.stock_quantity,
                    p.minimum_stock,
                    p.metal,
                    p.weight_grams,
                    sp.created_at,
                    sp.updated_at
                 FROM store_products sp
                 LEFT JOIN store_categories sc ON sc.id = sp.category_id
                 LEFT JOIN products p ON p.id = sp.stock_product_id
                 ${whereClause}
                 ORDER BY sp.is_featured DESC, sp.position ASC, sp.created_at DESC
                 LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
                values
            );

            const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

            res.json({
                data: result.rows.map((row) => mapPublicStoreProduct(row, config)),
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
    '/products/:slug',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'store-product-detail-public' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = productSlugSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Produto inválido.'));
                return;
            }

            const config = await fetchStoreConfig();
            if (!config?.is_active) {
                next(AppError.notFound('Loja pública inativa.'));
                return;
            }

            const product = await fetchStoreProductBySlug(parsed.data.slug);
            if (!product) {
                next(AppError.notFound('Produto da loja não encontrado.'));
                return;
            }

            res.json(mapPublicStoreProduct(product, config));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/checkout/preference',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'store-checkout-preference' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = checkoutPreferenceSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do checkout.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const config = await fetchStoreConfig();
            if (!config?.is_active) {
                next(AppError.conflict('STORE_INACTIVE', 'A loja pública está inativa.'));
                return;
            }

            const product = await fetchStoreProductById(parsed.data.product_id);
            if (!product || !product.is_published) {
                next(AppError.notFound('Produto da loja não encontrado.'));
                return;
            }

            if (product.is_custom) {
                next(AppError.conflict('STORE_CUSTOM_PRODUCT', 'Produtos personalizados devem seguir pelo WhatsApp.'));
                return;
            }

            if (!isStoreProductAvailable({ is_custom: product.is_custom, stock_quantity: product.stock_quantity })) {
                next(AppError.conflict('STORE_OUT_OF_STOCK', 'Produto indisponível no momento.'));
                return;
            }

            const amountCents = resolveStorePriceCents({
                price_cents: product.price_cents ?? product.base_price_cents,
                price_from_cents: product.price_from_cents,
            });

            if (!amountCents) {
                next(AppError.conflict('STORE_PRODUCT_WITHOUT_PRICE', 'Produto sem preço configurado para checkout.'));
                return;
            }

            const storeOrder = await transaction(async (client) => {
                const created = await client.query<{ id: string }>(
                    `INSERT INTO store_orders (
                        store_product_id,
                        customer_name,
                        customer_email,
                        customer_phone,
                        shipping_address,
                        amount_cents
                     ) VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [
                        product.id,
                        parsed.data.customer_name,
                        parsed.data.customer_email ?? null,
                        parsed.data.customer_phone ?? null,
                        JSON.stringify(parsed.data.shipping_address),
                        amountCents,
                    ]
                );

                return created.rows[0] as { id: string };
            });

            const preference = await createPaymentPreference({
                orderId: storeOrder.id,
                orderNumber: storeOrder.id.slice(0, 8).toUpperCase(),
                amountCents,
                payerEmail: parsed.data.customer_email ?? null,
                itemTitle: product.name,
                externalReference: storeOrder.id,
            });

            await query(
                `UPDATE store_orders
                 SET mp_preference_id = $2, updated_at = NOW()
                 WHERE id = $1`,
                [storeOrder.id, preference.preferenceId]
            );

            res.status(201).json({
                store_order_id: storeOrder.id,
                preference_id: preference.preferenceId,
                payment_url: preference.checkoutUrl,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/webhook/mercadopago',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const signature = req.headers['x-signature'];
            const headerValue = Array.isArray(signature) ? signature[0] : signature;

            if (!verifyMercadoPagoSignature(req.rawBody ?? '', headerValue)) {
                next(AppError.unauthorized('Assinatura do webhook do Mercado Pago inválida.'));
                return;
            }

            const parsed = webhookBodySchema.safeParse(req.body);
            const queryPaymentId = req.query['id'];
            const paymentId = parsed.success
                ? String(parsed.data.data?.id ?? '')
                : typeof queryPaymentId === 'string'
                    ? queryPaymentId
                    : '';

            if (!paymentId) {
                next(AppError.badRequest('Webhook da loja sem payment id.'));
                return;
            }

            const paymentPayload = await fetchMercadoPagoPayment(paymentId);
            if (!paymentPayload.orderId) {
                res.status(202).json({ ok: true, ignored: true });
                return;
            }

            const result = await query<StoreOrderRow>(
                `UPDATE store_orders
                 SET
                    mp_payment_id = $2,
                    status = $3,
                    paid_at = CASE WHEN $3 = 'approved' THEN NOW() ELSE paid_at END,
                    updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, mp_preference_id, mp_payment_id, status, amount_cents`,
                [paymentPayload.orderId, paymentPayload.paymentId, mapStoreOrderStatus(paymentPayload.status)]
            );

            if (!result.rows[0]) {
                res.status(202).json({ ok: true, ignored: true });
                return;
            }

            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
