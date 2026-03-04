import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const listCatalogSchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(60).default(24),
});

const createPublicLeadSchema = z.object({
    name: z.string().trim().min(2).max(255),
    whatsapp_number: z.string().trim().min(8).max(25),
    email: z.string().email().max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
});

interface PublicCatalogRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_cents: number;
    category: string | null;
    metal: string | null;
    weight_grams: number | null;
    images: string[];
    stock_quantity: number;
    minimum_stock: number;
}

interface PublicLeadRow {
    id: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
    source: string;
    created_at: Date;
}

function normalizeWhatsappNumber(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.startsWith('+')) {
        const digits = trimmed.slice(1).replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 15) {
            return `+${digits}`;
        }
        return null;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 11) {
        return `+55${digits}`;
    }

    if (digits.length >= 12 && digits.length <= 15) {
        return `+${digits}`;
    }

    return null;
}

async function triggerN8nLeadWebhook(payload: {
    leadId: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
}): Promise<{ attempted: boolean; failed: boolean }> {
    const config = env();

    if (!config.N8N_API_KEY || !config.N8N_WEBHOOK_URL) {
        return { attempted: false, failed: false };
    }

    try {
        const response = await fetch(config.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.N8N_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
            logger.warn({
                status: response.status,
                leadId: payload.leadId,
            }, 'n8n lead webhook returned non-success status');
            return { attempted: true, failed: true };
        }

        return { attempted: true, failed: false };
    } catch (error) {
        logger.warn({
            err: error,
            leadId: payload.leadId,
        }, 'n8n lead webhook request failed');
        return { attempted: true, failed: true };
    }
}

router.get(
    '/catalog',
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'public-catalog' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listCatalogSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Parâmetros inválidos para o catálogo público.'));
                return;
            }

            const values: unknown[] = [];
            const filters = ['p.is_active = TRUE'];

            if (parsed.data.q) {
                values.push(`%${parsed.data.q}%`);
                filters.push(`(p.name ILIKE $${values.length} OR p.code ILIKE $${values.length})`);
            }

            if (parsed.data.category) {
                values.push(parsed.data.category);
                filters.push(`p.category = $${values.length}`);
            }

            values.push(parsed.data.limit);

            const result = await query<PublicCatalogRow>(
                `SELECT
                    p.id,
                    p.code,
                    p.name,
                    p.description,
                    p.price_cents,
                    p.category,
                    p.metal,
                    p.weight_grams,
                    p.images,
                    p.stock_quantity,
                    p.minimum_stock
                 FROM products p
                 WHERE ${filters.join(' AND ')}
                 ORDER BY p.updated_at DESC
                 LIMIT $${values.length}`,
                values
            );

            res.json({
                data: result.rows.map((row) => ({
                    ...row,
                    is_available: row.stock_quantity > 0,
                    cover_image: row.images[0] ?? null,
                })),
                meta: {
                    total: result.rows.length,
                    limit: parsed.data.limit,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/leads',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'public-lead-capture' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createPublicLeadSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados enviados no formulário.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const normalizedWhatsapp = normalizeWhatsappNumber(parsed.data.whatsapp_number);
            if (!normalizedWhatsapp) {
                next(AppError.badRequest('Informe um WhatsApp válido, com DDD e código do país quando necessário.'));
                return;
            }

            const duplicate = await query<PublicLeadRow>(
                `SELECT id, name, whatsapp_number, email, source, created_at
                 FROM leads
                 WHERE whatsapp_number = $1
                 LIMIT 1`,
                [normalizedWhatsapp]
            );

            let lead = duplicate.rows[0];
            let duplicatePrevented = false;

            if (!lead) {
                const inserted = await query<PublicLeadRow>(
                    `INSERT INTO leads (
                        whatsapp_number,
                        name,
                        email,
                        stage,
                        source,
                        notes,
                        last_interaction_at
                     ) VALUES ($1, $2, $3, 'NOVO', 'OUTRO', $4, NOW())
                     RETURNING id, name, whatsapp_number, email, source, created_at`,
                    [
                        normalizedWhatsapp,
                        parsed.data.name,
                        parsed.data.email ?? null,
                        parsed.data.notes ?? 'Lead captado pela landing pública.',
                    ]
                );

                lead = inserted.rows[0];
            } else {
                duplicatePrevented = true;
                await query(
                    `UPDATE leads
                     SET
                       name = COALESCE(name, $2),
                       email = COALESCE(email, $3),
                       notes = CASE
                         WHEN $4::text IS NULL OR $4::text = '' THEN notes
                         WHEN notes IS NULL OR notes = '' THEN $4
                         ELSE notes || E'\\n\\n' || $4
                       END,
                       last_interaction_at = NOW(),
                       updated_at = NOW()
                     WHERE id = $1`,
                    [
                        lead.id,
                        parsed.data.name,
                        parsed.data.email ?? null,
                        parsed.data.notes ?? null,
                    ]
                );
            }

            if (!lead) {
                throw AppError.internal(req.requestId);
            }

            const automation = await triggerN8nLeadWebhook({
                leadId: lead.id,
                name: lead.name,
                whatsapp_number: lead.whatsapp_number,
                email: lead.email,
            });

            res.status(duplicatePrevented ? 200 : 201).json({
                lead: {
                    id: lead.id,
                    name: lead.name,
                    whatsapp_number: lead.whatsapp_number,
                    email: lead.email,
                },
                duplicate_prevented: duplicatePrevented,
                automation_triggered: automation.attempted && !automation.failed,
                automation_failed: automation.failed,
                fallback_whatsapp_url: `https://wa.me/${lead.whatsapp_number.replace(/\D/g, '')}`,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
