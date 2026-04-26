import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();


async function getAdminDashboard() {
    const [
        // KPIs principais
        leadsToday,
        openOrders,
        overdueProduction,
        monthRevenue,
        stockAlertsCount,
        
        // PDV - Vendas de hoje
        pdvSalesToday,
        pdvOrdersToday,
        
        // Atividade recente
        activity,
        
        // Produtos mais vendidos
        topProducts,
        
        // Alertas de estoque detalhados
        stockAlerts,
        
        // Pedidos prontos para retirada
        readyOrders,
        
        // Produção por etapa
        productionByStage,
        
        // Top clientes do mês
        topClients,
        
        // Leads por origem
        leadsBySource,
        
        // Formas de pagamento
        paymentMethods,

        // Receita diária dos últimos 30 dias
        revenueLast30Days,
    ] = await Promise.all([
        // Leads de hoje
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM leads
             WHERE created_at::date = CURRENT_DATE`
        ),
        // Pedidos em aberto
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM orders
             WHERE status NOT IN ('RETIRADO', 'CANCELADO')`
        ),
        // Produção atrasada
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM production_orders
             WHERE deadline IS NOT NULL
               AND deadline < NOW()
               AND status NOT IN ('CONCLUIDA')`
        ),
        // Faturamento do mês
        query<{ total: string }>(
            `SELECT COALESCE(SUM(amount_cents), 0)::text AS total
             FROM financial_entries
             WHERE type = 'ENTRADA'
               AND date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`
        ),
        // Contagem de alertas de estoque
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM products
             WHERE is_active = true
               AND stock_quantity <= minimum_stock`
        ),
        
        // PDV - Vendas de hoje
        query<{ total: string; average: string }>(
            `SELECT 
                COALESCE(SUM(total_cents), 0)::text AS total,
                COALESCE(AVG(total_cents), 0)::text AS average
             FROM orders
             WHERE created_at::date = CURRENT_DATE
               AND status NOT IN ('CANCELADO')`
        ),
        // PDV - Pedidos de hoje
        query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM orders
             WHERE created_at::date = CURRENT_DATE
               AND status NOT IN ('CANCELADO')`
        ),
        
        // Atividade recente
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
        
        // Produtos mais vendidos no mês
        query<{ name: string; total_sold: string; revenue_cents: string }>(
            `SELECT p.name, COUNT(oi.id)::text AS total_sold, COALESCE(SUM(oi.unit_price_cents * oi.quantity), 0)::text AS revenue_cents
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             JOIN orders o ON o.id = oi.order_id
             WHERE o.status NOT IN ('CANCELADO')
               AND date_trunc('month', o.created_at) = date_trunc('month', CURRENT_DATE)
             GROUP BY p.id, p.name
             ORDER BY COUNT(oi.id) DESC
             LIMIT 5`
        ),
        
        // Alertas de estoque detalhados
        query<{ id: string; name: string; stock_quantity: number; minimum_stock: number }>(
            `SELECT id, name, stock_quantity, minimum_stock
             FROM products
             WHERE is_active = true
               AND stock_quantity <= minimum_stock
             ORDER BY stock_quantity ASC
             LIMIT 10`
        ),
        
        // Pedidos prontos para retirada
        query<{ id: string; order_number: string; client_name: string; total_cents: string; ready_days: string }>(
            `SELECT 
                o.id,
                o.order_number,
                COALESCE(c.name, 'Cliente') AS client_name,
                o.total_cents,
                EXTRACT(DAY FROM NOW() - o.updated_at)::text AS ready_days
             FROM orders o
             LEFT JOIN clients c ON c.id = o.client_id
             WHERE o.status = 'PRONTO'
               AND o.updated_at IS NOT NULL
             ORDER BY o.updated_at ASC
             LIMIT 5`
        ),
        
        // Produção por etapa
        query<{ stage: string; total: string }>(
            `SELECT 
                CASE 
                    WHEN status = 'PENDENTE' THEN 'Pendente'
                    WHEN status = 'EM_ANDAMENTO' THEN 'Em Andamento'
                    WHEN status = 'PAUSADA' THEN 'Pausada'
                    WHEN status = 'CONCLUIDA' THEN 'Concluída'
                    ELSE status
                END AS stage,
                COUNT(*)::text AS total
             FROM production_orders
             WHERE status NOT IN ('CANCELADA')
             GROUP BY status
             ORDER BY 
                CASE status 
                    WHEN 'PENDENTE' THEN 1 
                    WHEN 'EM_ANDAMENTO' THEN 2 
                    WHEN 'PAUSADA' THEN 3 
                    ELSE 4 
                END`
        ),
        
        // Top clientes do mês
        query<{ client_id: string; client_name: string; order_count: string; total_cents: string }>(
            `SELECT 
                c.id AS client_id,
                COALESCE(c.name, 'Cliente') AS client_name,
                COUNT(DISTINCT o.id)::text AS order_count,
                COALESCE(SUM(fe.amount_cents), 0)::text AS total_cents
             FROM financial_entries fe
             JOIN orders o ON o.id = fe.order_id
             JOIN clients c ON c.id = o.client_id
             WHERE fe.type = 'ENTRADA'
               AND date_trunc('month', fe.competence_date) = date_trunc('month', CURRENT_DATE)
             GROUP BY c.id, c.name
             ORDER BY SUM(fe.amount_cents) DESC
             LIMIT 5`
        ),
        
        // Leads por origem
        query<{ source: string; total: string }>(
            `SELECT 
                COALESCE(source, 'outros') AS source,
                COUNT(*)::text AS total
             FROM leads
             GROUP BY source
             ORDER BY COUNT(*) DESC`
        ),
        
        // Formas de pagamento do mês
        query<{ method: string; total: string }>(
            `SELECT 
                COALESCE(payment_method, 'outros') AS method,
                COALESCE(SUM(amount_cents), 0)::text AS total
             FROM payments
             WHERE status = 'APPROVED'
               AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
             GROUP BY payment_method
             ORDER BY SUM(amount_cents) DESC`
        ),

        // Faturamento diário (últimos 30 dias) - mesma fonte do KPI mensal
        query<{ bucket: string; total: string }>(
            `SELECT
                d::date::text AS bucket,
                COALESCE(SUM(fe.amount_cents), 0)::text AS total
             FROM generate_series(CURRENT_DATE - interval '29 day', CURRENT_DATE, interval '1 day') d
             LEFT JOIN financial_entries fe
               ON fe.type = 'ENTRADA'
              AND fe.competence_date = d::date
             GROUP BY d
             ORDER BY d ASC`
        ),
    ]);

    // Calcular ticket médio
    const pdvTicketAvg = pdvOrdersToday.rows[0]?.total !== '0' 
        ? Number(pdvSalesToday.rows[0]?.average ?? 0) 
        : 0;

    // Calcular percentual de cada forma de pagamento
    const totalPaymentMethod = paymentMethods.rows.reduce((acc, r) => acc + Number(r.total), 0);
    const paymentMethodsWithPct = paymentMethods.rows.map(r => ({
        method: r.method,
        amount_cents: Number(r.total),
        percentage: totalPaymentMethod > 0 ? Math.round((Number(r.total) / totalPaymentMethod) * 100) : 0
    }));

    // Calcular total de leads por fonte
    const totalLeadsBySource = leadsBySource.rows.reduce((acc, r) => acc + Number(r.total), 0);
    const leadsBySourceWithPct = leadsBySource.rows.map(r => ({
        source: r.source,
        count: Number(r.total),
        percentage: totalLeadsBySource > 0 ? Math.round((Number(r.total) / totalLeadsBySource) * 100) : 0
    }));

    // Calcular total em pedidos prontos
    const readyOrdersTotal = readyOrders.rows.reduce((acc, r) => acc + Number(r.total_cents), 0);

    // Mapeamento de estágios para o frontend
    const stageMap: Record<string, string> = {
        'Pendente': 'PENDENTE',
        'Em Andamento': 'EM_ANDAMENTO',
        'Pausada': 'PAUSADA',
        'Concluída': 'CONCLUIDA'
    };

    const productionStages = productionByStage.rows.map(s => ({
        stage: stageMap[s.stage] || s.stage,
        stage_label: s.stage,
        count: Number(s.total)
    }));

    return {
        role: 'ADMIN',
        kpis: {
            leads_today: Number(leadsToday.rows[0]?.total ?? '0'),
            open_orders: Number(openOrders.rows[0]?.total ?? '0'),
            overdue_production: Number(overdueProduction.rows[0]?.total ?? '0'),
            month_revenue_cents: Number(monthRevenue.rows[0]?.total ?? '0'),
            stock_alerts: Number(stockAlertsCount.rows[0]?.total ?? '0'),
            // PDV
            pdv_sales_today_cents: Number(pdvSalesToday.rows[0]?.total ?? '0'),
            pdv_orders_today: Number(pdvOrdersToday.rows[0]?.total ?? '0'),
            pdv_ticket_avg_cents: Math.round(pdvTicketAvg),
        },
        alerts: {
            stock_alerts: Number(stockAlertsCount.rows[0]?.total ?? '0'),
            overdue_production: Number(overdueProduction.rows[0]?.total ?? '0'),
            ready_orders_value_cents: readyOrdersTotal,
        },
        activity: activity.rows.map((entry) => ({
            kind: entry.kind,
            label: entry.label,
            created_at: entry.created_at,
        })),
        topProducts: topProducts.rows.map((p) => ({
            name: p.name,
            total_sold: Number(p.total_sold),
            revenue_cents: Number(p.revenue_cents),
        })),
        // Dados novos para o frontend
        stock_alerts_detail: stockAlerts.rows.map(s => ({
            product_id: s.id,
            product_name: s.name,
            current_stock: s.stock_quantity,
            minimum_stock: s.minimum_stock,
        })),
        ready_orders: readyOrders.rows.map(o => ({
            id: o.id,
            order_number: o.order_number,
            client_name: o.client_name,
            total_cents: Number(o.total_cents),
            ready_days: Number(o.ready_days),
        })),
        production_by_stage: productionStages,
        top_clients: topClients.rows.map(c => ({
            client_id: c.client_id,
            client_name: c.client_name,
            order_count: Number(c.order_count),
            total_cents: Number(c.total_cents),
        })),
        leads_by_source: leadsBySourceWithPct,
        payment_methods: paymentMethodsWithPct,
        revenue_last_30_days: revenueLast30Days.rows.map((row) => ({
            date: row.bucket,
            amount_cents: Number(row.total),
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
