import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const searchSchema = z.object({
    q: z.string().trim().min(2).max(100),
});

interface SearchResult {
    id: string;
    type: 'customer' | 'product' | 'order' | 'lead';
    title: string;
    subtitle: string;
    url: string;
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'search-global' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = searchSchema.safeParse(req.query);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'INVALID_PARAMS',
                    message: 'Parâmetros de busca inválidos',
                    requestId: req.requestId,
                    details: parsed.error.errors
                });
                return;
            }

            const { q } = parsed.data;
            const results: SearchResult[] = [];

            // Search customers
            try {
                const customerResults = await query(
                    `SELECT id, name, whatsapp_number, email
                     FROM customers
                     WHERE name ILIKE $1 OR whatsapp_number ILIKE $1 OR COALESCE(email, '') ILIKE $1
                     ORDER BY name
                     LIMIT 5`,
                    [`%${q}%`]
                );

                for (const row of customerResults.rows) {
                    results.push({
                        id: row['id'] as string,
                        type: 'customer',
                        title: row['name'] as string,
                        subtitle: `WhatsApp: ${row['whatsapp_number'] as string}${row['email'] ? ` • ${row['email'] as string}` : ''}`,
                        url: `/clientes/${row['id'] as string}`
                    });
                }
            } catch (err) {
                console.warn('Customer search error:', err);
            }

            // Search products
            try {
                const productResults = await query(
                    `SELECT id, name, sku, price_cents
                     FROM products
                     WHERE name ILIKE $1 OR sku ILIKE $1
                     ORDER BY name
                     LIMIT 5`,
                    [`%${q}%`]
                );

                for (const row of productResults.rows) {
                    const price = row['price_cents'] ? `R$ ${(Number(row['price_cents']) / 100).toFixed(2)}` : '';
                    results.push({
                        id: row['id'] as string,
                        type: 'product',
                        title: row['name'] as string,
                        subtitle: `SKU: ${row['sku'] as string}${price ? ` • ${price}` : ''}`,
                        url: `/estoque/produtos/${row['id'] as string}`
                    });
                }
            } catch (err) {
                console.warn('Product search error:', err);
            }

            // Search orders
            try {
                const orderResults = await query(
                    `SELECT o.id, o.order_number, c.name as customer_name, o.total_price_cents, o.status
                     FROM orders o
                     LEFT JOIN customers c ON o.customer_id = c.id
                     WHERE o.order_number ILIKE $1 OR c.name ILIKE $1
                     ORDER BY o.created_at DESC
                     LIMIT 5`,
                    [`%${q}%`]
                );

                for (const row of orderResults.rows) {
                    const total = `R$ ${(Number(row['total_price_cents']) / 100).toFixed(2)}`;
                    results.push({
                        id: row['id'] as string,
                        type: 'order',
                        title: `Pedido #${row['order_number'] as string}`,
                        subtitle: `${row['customer_name'] as string || 'Cliente não informado'} • ${total} • ${row['status'] as string}`,
                        url: `/pedidos/${row['id'] as string}`
                    });
                }
            } catch (err) {
                console.warn('Order search error:', err);
            }

            // Search leads
            try {
                const leadResults = await query(
                    `SELECT id, name, whatsapp_number, stage
                     FROM leads
                     WHERE name ILIKE $1 OR whatsapp_number ILIKE $1
                     ORDER BY created_at DESC
                     LIMIT 5`,
                    [`%${q}%`]
                );

                for (const row of leadResults.rows) {
                    results.push({
                        id: row['id'] as string,
                        type: 'lead',
                        title: row['name'] as string,
                        subtitle: `WhatsApp: ${row['whatsapp_number'] as string} • ${row['stage'] as string}`,
                        url: `/pipeline/leads/${row['id'] as string}`
                    });
                }
            } catch (err) {
                console.warn('Lead search error:', err);
            }

            res.json({ results });
        } catch (err) {
            next(err);
        }
    }
);

export default router;