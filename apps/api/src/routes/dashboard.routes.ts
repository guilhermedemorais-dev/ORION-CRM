import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();


async function getAdminDashboard() {
    const [leadsToday, openOrders, overdueProduction, monthRevenue, stockAlerts, activity, topProducts] = await Promise.all([
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM leads
             WHERE created_at::date = CURRENT_DATE`
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM orders
             WHERE status NOT IN ('RETIRADO', 'CANCELADO')`
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM production_orders
             WHERE deadline IS NOT NULL
               AND deadline < NOW()
               AND status NOT IN ('CONCLUIDA')`
        ),
        query<{ total: string }>(
            `SELECT COALESCE(SUM(amount_cents), 0)::text AS total
             FROM financial_entries
             WHERE type = 'ENTRADA'
               AND date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM products
             WHERE is_active = true
               AND stock_quantity <= minimum_stock`
        ),
        query<{
            kind: string;
            label: string;
            created_at: Date;
        }>(
            `SELECT *
             FROM (
               SELECT 'lead'::text AS kind, COALESCE(name, whatsapp_number) AS label, created_at
               FROM leads
               UNION ALL
               SELECT 'order'::text AS kind, order_number AS label, created_at
               FROM orders
             ) recent
             ORDER BY created_at DESC
             LIMIT 8`
        ),
        query<{ name: string; total_sold: string }>(
            `SELECT p.name, COUNT(oi.id)::text AS total_sold
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             JOIN orders o ON o.id = oi.order_id
             WHERE o.status NOT IN ('CANCELADO')
               AND date_trunc('month', o.created_at) = date_trunc('month', CURRENT_DATE)
             GROUP BY p.id, p.name
             ORDER BY COUNT(oi.id) DESC
             LIMIT 5`
        ),
    ]);

    return {
        role: 'ADMIN',
        kpis: {
            leads_today: Number(leadsToday.rows[0]?.total ?? '0'),
            open_orders: Number(openOrders.rows[0]?.total ?? '0'),
            overdue_production: Number(overdueProduction.rows[0]?.total ?? '0'),
            month_revenue_cents: Number(monthRevenue.rows[0]?.total ?? '0'),
            stock_alerts: Number(stockAlerts.rows[0]?.total ?? '0'),
        },
        alerts: {
            stock_alerts: Number(stockAlerts.rows[0]?.total ?? '0'),
            overdue_production: Number(overdueProduction.rows[0]?.total ?? '0'),
        },
        activity: activity.rows.map((entry) => ({
            kind: entry.kind,
            label: entry.label,
            created_at: entry.created_at,
        })),
        topProducts: topProducts.rows.map((p) => ({
            name: p.name,
            total_sold: Number(p.total_sold),
        })),
    };
}

async function getAtendenteDashboard(userId: string) {
    const [myLeads, myOrders, waitingInbox, myRevenue] = await Promise.all([
        query<{ total: string }>('SELECT COUNT(*)::text AS total FROM leads WHERE assigned_to = $1', [userId]),
        query<{ total: string }>('SELECT COUNT(*)::text AS total FROM orders WHERE assigned_to = $1', [userId]),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM conversations
             WHERE (assigned_to = $1 OR (status = 'AGUARDANDO_HUMANO' AND assigned_to IS NULL))
               AND status != 'ENCERRADA'`,
            [userId]
        ),
        query<{ total: string }>(
            `SELECT COALESCE(SUM(commission_amount_cents), 0)::text AS total
             FROM financial_entries
             WHERE commission_user_id = $1
               AND date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`,
            [userId]
        ),
    ]);

    return {
        role: 'ATENDENTE',
        kpis: {
            my_leads: Number(myLeads.rows[0]?.total ?? '0'),
            my_orders: Number(myOrders.rows[0]?.total ?? '0'),
            waiting_inbox: Number(waitingInbox.rows[0]?.total ?? '0'),
            estimated_commission_cents: Number(myRevenue.rows[0]?.total ?? '0'),
        },
        alerts: {
            waiting_inbox: Number(waitingInbox.rows[0]?.total ?? '0'),
        },
        activity: [],
    };
}

async function getProducaoDashboard(userId: string) {
    const [assigned, overdue, queueOpen, finishedToday] = await Promise.all([
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM production_orders
             WHERE assigned_to = $1
               AND status IN ('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA')`,
            [userId]
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM production_orders
             WHERE assigned_to = $1
               AND deadline IS NOT NULL
               AND deadline < NOW()
               AND status != 'CONCLUIDA'`,
            [userId]
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM production_orders
             WHERE assigned_to IS NULL
               AND status IN ('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA')`
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM production_steps
             WHERE completed_by = $1
               AND completed_at::date = CURRENT_DATE`,
            [userId]
        ),
    ]);

    return {
        role: 'PRODUCAO',
        kpis: {
            assigned_orders: Number(assigned.rows[0]?.total ?? '0'),
            overdue_orders: Number(overdue.rows[0]?.total ?? '0'),
            open_queue: Number(queueOpen.rows[0]?.total ?? '0'),
            steps_completed_today: Number(finishedToday.rows[0]?.total ?? '0'),
        },
        alerts: {
            overdue_orders: Number(overdue.rows[0]?.total ?? '0'),
            open_queue: Number(queueOpen.rows[0]?.total ?? '0'),
        },
        activity: [],
    };
}

async function getFinanceiroDashboard() {
    const [monthIn, monthOut, balance, pendingPayments] = await Promise.all([
        query<{ total: string }>(
            `SELECT COALESCE(SUM(amount_cents), 0)::text AS total
             FROM financial_entries
             WHERE type = 'ENTRADA'
               AND date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`
        ),
        query<{ total: string }>(
            `SELECT COALESCE(SUM(amount_cents), 0)::text AS total
             FROM financial_entries
             WHERE type = 'SAIDA'
               AND date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`
        ),
        query<{ total: string }>(
            `SELECT COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_cents ELSE -amount_cents END), 0)::text AS total
             FROM financial_entries
             WHERE date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`
        ),
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM payments
             WHERE status = 'PENDING'`
        ),
    ]);

    return {
        role: 'FINANCEIRO',
        kpis: {
            month_in_cents: Number(monthIn.rows[0]?.total ?? '0'),
            month_out_cents: Number(monthOut.rows[0]?.total ?? '0'),
            balance_cents: Number(balance.rows[0]?.total ?? '0'),
            pending_payments: Number(pendingPayments.rows[0]?.total ?? '0'),
        },
        alerts: {
            pending_payments: Number(pendingPayments.rows[0]?.total ?? '0'),
        },
        activity: [],
    };
}

router.get(
    '/',
    authenticate,
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'dashboard' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                next(AppError.unauthorized());
                return;
            }

            let payload: unknown;
            const role = req.user.role;

            if (role === 'ADMIN' || role === 'ROOT' || role === 'GERENTE') {
                payload = await getAdminDashboard();
            } else if (role === 'ATENDENTE' || role === 'VENDEDOR') {
                payload = await getAtendenteDashboard(req.user.id);
            } else if (role === 'PRODUCAO') {
                payload = await getProducaoDashboard(req.user.id);
            } else if (role === 'FINANCEIRO') {
                payload = await getFinanceiroDashboard();
            } else {
                payload = await getAdminDashboard();
            }

            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
