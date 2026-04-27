import type { QueryResult, QueryResultRow } from 'pg';
import { AppError } from '../lib/errors.js';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m' | 'custom';
type AnalyticsBucket = 'day' | 'month';

const REVENUE_ORDER_STATUS_SQL = `('PAGO', 'SEPARANDO', 'ENVIADO', 'RETIRADO', 'APROVADO', 'EM_PRODUCAO', 'CONTROLE_QUALIDADE')`;
const ACTIONABLE_ORDER_STATUS_SQL = `('AGUARDANDO_PAGAMENTO', 'PAGO', 'SEPARANDO', 'ENVIADO', 'RETIRADO', 'AGUARDANDO_APROVACAO_DESIGN', 'APROVADO', 'EM_PRODUCAO', 'CONTROLE_QUALIDADE', 'CANCELADO')`;

interface AnalyticsPeriodRange {
    periodo: AnalyticsPeriod;
    bucket: AnalyticsBucket;
    current_start: string;
    current_end_exclusive: string;
    previous_start: string;
    previous_end_exclusive: string;
}

interface SalesSummary {
    revenue_cents: number;
    total_orders: number;
    revenue_orders: number;
    cancelled_orders: number;
}

interface SalesTimelineRow {
    bucket: string;
    scope: 'current' | 'previous';
    revenue_cents: string;
    orders_count: string;
}

interface SalesChannelRow {
    channel: string;
    revenue_cents: string;
    orders_count: string;
}

interface SalesCategoryRow {
    category: string | null;
    revenue_cents: string;
}

interface SalesProductRow {
    product_name: string | null;
    category_name: string | null;
    quantity: string;
    revenue_cents: string;
}

export interface AnalyticsSalesResponse {
    period: {
        periodo: AnalyticsPeriod;
        from: string;
        to: string;
        comparison_from: string;
        comparison_to: string;
        bucket: AnalyticsBucket;
    };
    kpis: {
        revenue: {
            value_cents: number;
            delta_percent: number;
        };
        orders: {
            value: number;
            delta_percent: number;
        };
        average_ticket: {
            value_cents: number;
            delta_percent: number;
        };
        cancellation_rate: {
            value_percent: number;
            delta_percent: number;
        };
    };
    charts: {
        revenue_timeline: Array<{
            label: string;
            current_cents: number;
            previous_cents: number;
            current_orders: number;
            previous_orders: number;
        }>;
        revenue_by_channel: Array<{
            channel: string;
            revenue_cents: number;
            orders: number;
        }>;
        top_categories: Array<{
            category: string;
            revenue_cents: number;
        }>;
    };
    tables: {
        top_products: Array<{
            product: string;
            category: string;
            quantity: number;
            revenue_cents: number;
            share_percent: number;
        }>;
    };
}

async function executeQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<QueryResult<T>> {
    const { query } = await import('../db/pool.js');
    return query<T>(text, params);
}

function startOfDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function addMonths(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + amount);
    return next;
}

function parseDateValue(value: string): Date {
    if (value.includes('T')) {
        return new Date(value);
    }

    return new Date(`${value}T12:00:00`);
}

function formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseInteger(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
    return 0;
}

function normalizeLabel(value: string | null | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function humanizeMonth(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
    }).format(date);
}

function formatBucketLabel(bucket: string, mode: AnalyticsBucket): string {
    if (mode === 'month') {
        return humanizeMonth(bucket);
    }

    const date = new Date(`${bucket}T12:00:00`);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
    }).format(date);
}

function clampPercentage(value: number): number {
    return Math.round(value * 10) / 10;
}

export function calculateAnalyticsDelta(currentValue: number, previousValue: number): number {
    if (previousValue === 0) {
        return currentValue === 0 ? 0 : 100;
    }

    return clampPercentage(((currentValue - previousValue) / previousValue) * 100);
}

function getDayBucketKeys(start: string, endExclusive: string): string[] {
    const keys: string[] = [];
    let cursor = startOfDay(parseDateValue(start));
    const end = startOfDay(parseDateValue(endExclusive));

    while (cursor < end) {
        keys.push(formatDateOnly(cursor));
        cursor = addDays(cursor, 1);
    }

    return keys;
}

function getMonthBucketKeys(start: string, endExclusive: string): string[] {
    const keys: string[] = [];
    let cursor = startOfMonth(parseDateValue(start));
    const end = startOfMonth(parseDateValue(endExclusive));

    while (cursor < end) {
        keys.push(formatDateOnly(cursor));
        cursor = addMonths(cursor, 1);
    }

    return keys;
}

function getBucketKeys(start: string, endExclusive: string, bucket: AnalyticsBucket): string[] {
    if (bucket === 'month') {
        return getMonthBucketKeys(start, endExclusive);
    }

    return getDayBucketKeys(start, endExclusive);
}

export function resolveAnalyticsPeriodRange(
    periodo: AnalyticsPeriod,
    from?: string,
    to?: string,
    referenceDate = new Date()
): AnalyticsPeriodRange {
    const today = startOfDay(referenceDate);

    if (periodo === '7d') {
        const currentStart = addDays(today, -6);
        const currentEndExclusive = addDays(today, 1);
        const previousStart = addDays(currentStart, -7);

        return {
            periodo,
            bucket: 'day',
            current_start: formatDateOnly(currentStart),
            current_end_exclusive: formatDateOnly(currentEndExclusive),
            previous_start: formatDateOnly(previousStart),
            previous_end_exclusive: formatDateOnly(currentStart),
        };
    }

    if (periodo === '30d') {
        const currentStart = addDays(today, -29);
        const currentEndExclusive = addDays(today, 1);
        const previousStart = addDays(currentStart, -30);

        return {
            periodo,
            bucket: 'day',
            current_start: formatDateOnly(currentStart),
            current_end_exclusive: formatDateOnly(currentEndExclusive),
            previous_start: formatDateOnly(previousStart),
            previous_end_exclusive: formatDateOnly(currentStart),
        };
    }

    if (periodo === '90d') {
        const currentStart = addDays(today, -89);
        const currentEndExclusive = addDays(today, 1);
        const previousStart = addDays(currentStart, -90);

        return {
            periodo,
            bucket: 'day',
            current_start: formatDateOnly(currentStart),
            current_end_exclusive: formatDateOnly(currentEndExclusive),
            previous_start: formatDateOnly(previousStart),
            previous_end_exclusive: formatDateOnly(currentStart),
        };
    }

    if (periodo === '12m') {
        const currentMonth = startOfMonth(today);
        const currentStart = addMonths(currentMonth, -11);
        const currentEndExclusive = addMonths(currentMonth, 1);
        const previousStart = addMonths(currentStart, -12);

        return {
            periodo,
            bucket: 'month',
            current_start: formatDateOnly(currentStart),
            current_end_exclusive: formatDateOnly(currentEndExclusive),
            previous_start: formatDateOnly(previousStart),
            previous_end_exclusive: formatDateOnly(currentStart),
        };
    }

    if (!from || !to) {
        throw AppError.badRequest('Período customizado exige datas inicial e final.');
    }

    const currentStartDate = startOfDay(parseDateValue(from));
    const currentEndDate = startOfDay(parseDateValue(to));

    if (Number.isNaN(currentStartDate.getTime()) || Number.isNaN(currentEndDate.getTime())) {
        throw AppError.badRequest('Datas inválidas para analytics.');
    }

    if (currentEndDate < currentStartDate) {
        throw AppError.badRequest('A data final não pode ser anterior à inicial.');
    }

    const currentEndExclusiveDate = addDays(currentEndDate, 1);
    const daySpan = Math.max(1, Math.round((currentEndExclusiveDate.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24)));
    const previousStartDate = addDays(currentStartDate, -daySpan);

    return {
        periodo,
        bucket: daySpan > 120 ? 'month' : 'day',
        current_start: formatDateOnly(currentStartDate),
        current_end_exclusive: formatDateOnly(currentEndExclusiveDate),
        previous_start: formatDateOnly(previousStartDate),
        previous_end_exclusive: formatDateOnly(currentStartDate),
    };
}

async function fetchSalesSummary(start: string, endExclusive: string): Promise<SalesSummary> {
    const [ordersResult, storeResult, manualResult] = await Promise.all([
        executeQuery<{
            total_orders: string;
            revenue_orders: string;
            cancelled_orders: string;
            revenue_cents: string;
        }>(
            `SELECT
                COUNT(*) FILTER (WHERE status IN ${ACTIONABLE_ORDER_STATUS_SQL})::text AS total_orders,
                COUNT(*) FILTER (WHERE status IN ${REVENUE_ORDER_STATUS_SQL})::text AS revenue_orders,
                COUNT(*) FILTER (WHERE status = 'CANCELADO')::text AS cancelled_orders,
                COALESCE(SUM(CASE WHEN status IN ${REVENUE_ORDER_STATUS_SQL} THEN final_amount_cents ELSE 0 END), 0)::text AS revenue_cents
             FROM orders
             WHERE created_at >= $1
               AND created_at < $2`,
            [start, endExclusive]
        ),
        executeQuery<{
            total_orders: string;
            revenue_orders: string;
            cancelled_orders: string;
            revenue_cents: string;
        }>(
            `SELECT
                COUNT(*)::text AS total_orders,
                COUNT(*) FILTER (WHERE status = 'approved')::text AS revenue_orders,
                COUNT(*) FILTER (WHERE status IN ('cancelled', 'rejected', 'refunded'))::text AS cancelled_orders,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_cents ELSE 0 END), 0)::text AS revenue_cents
             FROM store_orders
             WHERE created_at >= $1
               AND created_at < $2`,
            [start, endExclusive]
        ),
        executeQuery<{ revenue_cents: string }>(
            `SELECT
                COALESCE(SUM(fe.amount_cents), 0)::text AS revenue_cents
             FROM financial_entries fe
             WHERE fe.type = 'ENTRADA'
               AND fe.order_id IS NULL
               AND fe.payment_id IS NULL
               AND fe.competence_date >= $1
               AND fe.competence_date < $2`,
            [start, endExclusive]
        ),
    ]);

    return {
        revenue_cents: parseInteger(ordersResult.rows[0]?.revenue_cents)
            + parseInteger(storeResult.rows[0]?.revenue_cents)
            + parseInteger(manualResult.rows[0]?.revenue_cents),
        total_orders: parseInteger(ordersResult.rows[0]?.total_orders) + parseInteger(storeResult.rows[0]?.total_orders),
        revenue_orders: parseInteger(ordersResult.rows[0]?.revenue_orders) + parseInteger(storeResult.rows[0]?.revenue_orders),
        cancelled_orders: parseInteger(ordersResult.rows[0]?.cancelled_orders) + parseInteger(storeResult.rows[0]?.cancelled_orders),
    };
}

async function fetchSalesTimeline(range: AnalyticsPeriodRange): Promise<SalesTimelineRow[]> {
    const orderBucketExpression = range.bucket === 'month'
        ? `to_char(date_trunc('month', created_at), 'YYYY-MM-01')`
        : `to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`;
    const financeBucketExpression = range.bucket === 'month'
        ? `to_char(date_trunc('month', competence_date), 'YYYY-MM-01')`
        : `to_char(date_trunc('day', competence_date), 'YYYY-MM-DD')`;

    const result = await executeQuery<SalesTimelineRow>(
        `SELECT
            raw.bucket,
            raw.scope,
            COALESCE(SUM(raw.amount_cents), 0)::text AS revenue_cents,
            COUNT(*)::text AS orders_count
         FROM (
            SELECT
                ${orderBucketExpression} AS bucket,
                'current'::text AS scope,
                final_amount_cents AS amount_cents
            FROM orders
            WHERE created_at >= $1
              AND created_at < $2
              AND status IN ${REVENUE_ORDER_STATUS_SQL}

            UNION ALL

            SELECT
                ${orderBucketExpression} AS bucket,
                'current'::text AS scope,
                amount_cents
            FROM store_orders
            WHERE created_at >= $1
              AND created_at < $2
              AND status = 'approved'

            UNION ALL

            SELECT
                ${financeBucketExpression} AS bucket,
                'current'::text AS scope,
                amount_cents
            FROM financial_entries
            WHERE competence_date >= $1
              AND competence_date < $2
              AND type = 'ENTRADA'
              AND order_id IS NULL
              AND payment_id IS NULL

            UNION ALL

            SELECT
                ${orderBucketExpression} AS bucket,
                'previous'::text AS scope,
                final_amount_cents AS amount_cents
            FROM orders
            WHERE created_at >= $3
              AND created_at < $4
              AND status IN ${REVENUE_ORDER_STATUS_SQL}

            UNION ALL

            SELECT
                ${orderBucketExpression} AS bucket,
                'previous'::text AS scope,
                amount_cents
            FROM store_orders
            WHERE created_at >= $3
              AND created_at < $4
              AND status = 'approved'

            UNION ALL

            SELECT
                ${financeBucketExpression} AS bucket,
                'previous'::text AS scope,
                amount_cents
            FROM financial_entries
            WHERE competence_date >= $3
              AND competence_date < $4
              AND type = 'ENTRADA'
              AND order_id IS NULL
              AND payment_id IS NULL
         ) raw
         GROUP BY raw.bucket, raw.scope
         ORDER BY raw.scope, raw.bucket`,
        [
            range.current_start,
            range.current_end_exclusive,
            range.previous_start,
            range.previous_end_exclusive,
        ]
    );

    return result.rows;
}

export function buildSalesTimeline(rows: SalesTimelineRow[], range: AnalyticsPeriodRange) {
    const currentBuckets = getBucketKeys(range.current_start, range.current_end_exclusive, range.bucket);
    const previousBuckets = getBucketKeys(range.previous_start, range.previous_end_exclusive, range.bucket);
    const currentMap = new Map<string, { revenue_cents: number; orders_count: number }>();
    const previousMap = new Map<string, { revenue_cents: number; orders_count: number }>();

    for (const row of rows) {
        const entry = {
            revenue_cents: parseInteger(row.revenue_cents),
            orders_count: parseInteger(row.orders_count),
        };

        if (row.scope === 'current') {
            currentMap.set(row.bucket, entry);
        } else {
            previousMap.set(row.bucket, entry);
        }
    }

    return currentBuckets.map((bucket, index) => {
        const previousBucket = previousBuckets[index] ?? bucket;
        const currentValue = currentMap.get(bucket);
        const previousValue = previousMap.get(previousBucket);

        return {
            label: formatBucketLabel(bucket, range.bucket),
            current_cents: currentValue?.revenue_cents ?? 0,
            previous_cents: previousValue?.revenue_cents ?? 0,
            current_orders: currentValue?.orders_count ?? 0,
            previous_orders: previousValue?.orders_count ?? 0,
        };
    });
}

async function fetchChannelRevenue(start: string, endExclusive: string) {
    const result = await executeQuery<SalesChannelRow>(
        `SELECT
            combined.channel,
            COALESCE(SUM(combined.amount_cents), 0)::text AS revenue_cents,
            COUNT(*)::text AS orders_count
         FROM (
            SELECT
                CASE
                    WHEN type = 'PRONTA_ENTREGA' THEN 'PDV'
                    ELSE 'WhatsApp'
                END AS channel,
                final_amount_cents AS amount_cents
            FROM orders
            WHERE created_at >= $1
              AND created_at < $2
              AND status IN ${REVENUE_ORDER_STATUS_SQL}

            UNION ALL

            SELECT
                'Loja Online' AS channel,
                amount_cents
            FROM store_orders
            WHERE created_at >= $1
              AND created_at < $2
              AND status = 'approved'

            UNION ALL

            SELECT
                'Financeiro' AS channel,
                amount_cents
            FROM financial_entries
            WHERE competence_date >= $1
              AND competence_date < $2
              AND type = 'ENTRADA'
              AND order_id IS NULL
              AND payment_id IS NULL
         ) combined
         GROUP BY combined.channel`,
        [start, endExclusive]
    );

    const byChannel = new Map([
        ['Loja Online', { channel: 'Loja Online', revenue_cents: 0, orders: 0 }],
        ['PDV', { channel: 'PDV', revenue_cents: 0, orders: 0 }],
        ['WhatsApp', { channel: 'WhatsApp', revenue_cents: 0, orders: 0 }],
        ['Financeiro', { channel: 'Financeiro', revenue_cents: 0, orders: 0 }],
    ]);

    for (const row of result.rows) {
        byChannel.set(row.channel, {
            channel: row.channel,
            revenue_cents: parseInteger(row.revenue_cents),
            orders: parseInteger(row.orders_count),
        });
    }

    return Array.from(byChannel.values());
}

async function fetchTopCategories(start: string, endExclusive: string) {
    const [manualResult, storeResult] = await Promise.all([
        executeQuery<SalesCategoryRow>(
            `SELECT
                COALESCE(p.category, 'Sem categoria') AS category,
                COALESCE(SUM(oi.total_price_cents), 0)::text AS revenue_cents
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE o.created_at >= $1
               AND o.created_at < $2
               AND o.status IN ${REVENUE_ORDER_STATUS_SQL}
             GROUP BY COALESCE(p.category, 'Sem categoria')`,
            [start, endExclusive]
        ),
        executeQuery<SalesCategoryRow>(
            `SELECT
                COALESCE(sc.name, 'Sem categoria') AS category,
                COALESCE(SUM(so.amount_cents), 0)::text AS revenue_cents
             FROM store_orders so
             INNER JOIN store_products sp ON sp.id = so.store_product_id
             LEFT JOIN store_categories sc ON sc.id = sp.category_id
             WHERE so.created_at >= $1
               AND so.created_at < $2
               AND so.status = 'approved'
             GROUP BY COALESCE(sc.name, 'Sem categoria')`,
            [start, endExclusive]
        ),
    ]);

    const categories = new Map<string, number>();

    for (const row of [...manualResult.rows, ...storeResult.rows]) {
        const category = normalizeLabel(row.category, 'Sem categoria');
        const currentValue = categories.get(category) ?? 0;
        categories.set(category, currentValue + parseInteger(row.revenue_cents));
    }

    return Array.from(categories.entries())
        .map(([category, revenue_cents]) => ({ category, revenue_cents }))
        .sort((left, right) => right.revenue_cents - left.revenue_cents)
        .slice(0, 5);
}

async function fetchTopProducts(start: string, endExclusive: string, totalRevenueCents: number) {
    const [manualResult, storeResult] = await Promise.all([
        executeQuery<SalesProductRow>(
            `SELECT
                COALESCE(p.name, oi.description) AS product_name,
                COALESCE(p.category, 'Sem categoria') AS category_name,
                COALESCE(SUM(oi.quantity), 0)::text AS quantity,
                COALESCE(SUM(oi.total_price_cents), 0)::text AS revenue_cents
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE o.created_at >= $1
               AND o.created_at < $2
               AND o.status IN ${REVENUE_ORDER_STATUS_SQL}
             GROUP BY COALESCE(p.name, oi.description), COALESCE(p.category, 'Sem categoria')`,
            [start, endExclusive]
        ),
        executeQuery<SalesProductRow>(
            `SELECT
                sp.name AS product_name,
                COALESCE(sc.name, 'Sem categoria') AS category_name,
                COUNT(*)::text AS quantity,
                COALESCE(SUM(so.amount_cents), 0)::text AS revenue_cents
             FROM store_orders so
             INNER JOIN store_products sp ON sp.id = so.store_product_id
             LEFT JOIN store_categories sc ON sc.id = sp.category_id
             WHERE so.created_at >= $1
               AND so.created_at < $2
               AND so.status = 'approved'
             GROUP BY sp.name, COALESCE(sc.name, 'Sem categoria')`,
            [start, endExclusive]
        ),
    ]);

    const products = new Map<string, { product: string; category: string; quantity: number; revenue_cents: number }>();

    for (const row of [...manualResult.rows, ...storeResult.rows]) {
        const product = normalizeLabel(row.product_name, 'Produto sem nome');
        const category = normalizeLabel(row.category_name, 'Sem categoria');
        const key = `${product}::${category}`;
        const current = products.get(key) ?? {
            product,
            category,
            quantity: 0,
            revenue_cents: 0,
        };

        current.quantity += parseInteger(row.quantity);
        current.revenue_cents += parseInteger(row.revenue_cents);
        products.set(key, current);
    }

    return Array.from(products.values())
        .sort((left, right) => right.revenue_cents - left.revenue_cents)
        .slice(0, 10)
        .map((row) => ({
            ...row,
            share_percent: totalRevenueCents > 0
                ? clampPercentage((row.revenue_cents / totalRevenueCents) * 100)
                : 0,
        }));
}

export async function getAnalyticsSales(params: {
    periodo: AnalyticsPeriod;
    from?: string;
    to?: string;
}): Promise<AnalyticsSalesResponse> {
    const range = resolveAnalyticsPeriodRange(params.periodo, params.from, params.to);

    const [currentSummary, previousSummary, timelineRows, channelRevenue, topCategories] = await Promise.all([
        fetchSalesSummary(range.current_start, range.current_end_exclusive),
        fetchSalesSummary(range.previous_start, range.previous_end_exclusive),
        fetchSalesTimeline(range),
        fetchChannelRevenue(range.current_start, range.current_end_exclusive),
        fetchTopCategories(range.current_start, range.current_end_exclusive),
    ]);

    const currentAverageTicket = currentSummary.revenue_orders > 0
        ? Math.round(currentSummary.revenue_cents / currentSummary.revenue_orders)
        : 0;
    const previousAverageTicket = previousSummary.revenue_orders > 0
        ? Math.round(previousSummary.revenue_cents / previousSummary.revenue_orders)
        : 0;
    const currentCancellationRate = currentSummary.total_orders > 0
        ? clampPercentage((currentSummary.cancelled_orders / currentSummary.total_orders) * 100)
        : 0;
    const previousCancellationRate = previousSummary.total_orders > 0
        ? clampPercentage((previousSummary.cancelled_orders / previousSummary.total_orders) * 100)
        : 0;

    return {
        period: {
            periodo: range.periodo,
            from: range.current_start,
            to: formatDateOnly(addDays(parseDateValue(range.current_end_exclusive), -1)),
            comparison_from: range.previous_start,
            comparison_to: formatDateOnly(addDays(parseDateValue(range.previous_end_exclusive), -1)),
            bucket: range.bucket,
        },
        kpis: {
            revenue: {
                value_cents: currentSummary.revenue_cents,
                delta_percent: calculateAnalyticsDelta(currentSummary.revenue_cents, previousSummary.revenue_cents),
            },
            orders: {
                value: currentSummary.total_orders,
                delta_percent: calculateAnalyticsDelta(currentSummary.total_orders, previousSummary.total_orders),
            },
            average_ticket: {
                value_cents: currentAverageTicket,
                delta_percent: calculateAnalyticsDelta(currentAverageTicket, previousAverageTicket),
            },
            cancellation_rate: {
                value_percent: currentCancellationRate,
                delta_percent: calculateAnalyticsDelta(currentCancellationRate, previousCancellationRate),
            },
        },
        charts: {
            revenue_timeline: buildSalesTimeline(timelineRows, range),
            revenue_by_channel: channelRevenue,
            top_categories: topCategories,
        },
        tables: {
            top_products: await fetchTopProducts(
                range.current_start,
                range.current_end_exclusive,
                currentSummary.revenue_cents
            ),
        },
    };
}

// ─── Analytics Leads ─────────────────────────────────────────────────────────

export interface AnalyticsLeadsResponse {
    period: { from: string; to: string };
    funnel: Array<{ stage: string; count: number; percent: number }>;
    lost_leads: Array<{ name: string | null; phone: string | null; lost_at: string; reason: string | null }>;
    new_leads_count: number;
    converted_count: number;
    lost_count: number;
    conversion_rate_percent: number;
}

export async function getAnalyticsLeads(
    params: { periodo: AnalyticsPeriod; from?: string; to?: string }
): Promise<AnalyticsLeadsResponse> {
    const range = resolveAnalyticsPeriodRange(params.periodo, params.from, params.to);
    const { current_start, current_end_exclusive } = range;

    const [funnelResult, lostResult, countsResult] = await Promise.all([
        executeQuery<{ stage: string; count: string }>(
            `SELECT COALESCE(ps.name, l.stage::text, 'Sem etapa') AS stage,
                    COUNT(l.id)::text AS count
             FROM leads l
             LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
             WHERE l.created_at >= $1 AND l.created_at < $2
               AND l.status != 'LOST'
             GROUP BY 1
             ORDER BY COUNT(l.id) DESC`,
            [current_start, current_end_exclusive]
        ),
        executeQuery<{ name: string | null; phone: string | null; lost_at: string; reason: string | null }>(
            `SELECT l.name, l.whatsapp_number AS phone,
                    l.updated_at::text AS lost_at,
                    l.lost_reason AS reason
             FROM leads l
             WHERE l.updated_at >= $1 AND l.updated_at < $2
               AND l.status = 'LOST'
             ORDER BY l.updated_at DESC
             LIMIT 20`,
            [current_start, current_end_exclusive]
        ),
        executeQuery<{ new_leads: string; converted: string; lost: string }>(
            `SELECT
               COUNT(*)::text AS new_leads,
               COUNT(*) FILTER (WHERE status = 'CONVERTED')::text AS converted,
               COUNT(*) FILTER (WHERE status = 'LOST')::text AS lost
             FROM leads
             WHERE created_at >= $1 AND created_at < $2`,
            [current_start, current_end_exclusive]
        ),
    ]);

    const total = funnelResult.rows.reduce((acc, row) => acc + parseInteger(row.count), 0);
    const funnel = funnelResult.rows.map((row) => ({
        stage: row.stage,
        count: parseInteger(row.count),
        percent: total > 0 ? clampPercentage((parseInteger(row.count) / total) * 100) : 0,
    }));

    const counts = countsResult.rows[0] ?? { new_leads: '0', converted: '0', lost: '0' };
    const newLeadsCount = parseInteger(counts.new_leads);
    const convertedCount = parseInteger(counts.converted);
    const lostCount = parseInteger(counts.lost);

    return {
        period: {
            from: current_start,
            to: formatDateOnly(addDays(parseDateValue(current_end_exclusive), -1)),
        },
        funnel,
        lost_leads: lostResult.rows,
        new_leads_count: newLeadsCount,
        converted_count: convertedCount,
        lost_count: lostCount,
        conversion_rate_percent: newLeadsCount > 0
            ? clampPercentage((convertedCount / newLeadsCount) * 100)
            : 0,
    };
}

// ─── Analytics Produção ───────────────────────────────────────────────────────

export interface AnalyticsProductionResponse {
    period: { from: string; to: string };
    status_distribution: Array<{ status: string; count: number; percent: number }>;
    late_orders: Array<{ id: string; client: string | null; deadline: string | null; days_late: number }>;
    total_orders: number;
    completed_count: number;
    in_progress_count: number;
    late_count: number;
}

export async function getAnalyticsProduction(
    params: { periodo: AnalyticsPeriod; from?: string; to?: string }
): Promise<AnalyticsProductionResponse> {
    const range = resolveAnalyticsPeriodRange(params.periodo, params.from, params.to);
    const { current_start, current_end_exclusive } = range;

    const [statusResult, lateResult] = await Promise.all([
        executeQuery<{ status: string; count: string }>(
            `SELECT status::text, COUNT(*)::text AS count
             FROM orders
             WHERE created_at >= $1 AND created_at < $2
             GROUP BY 1
             ORDER BY COUNT(*) DESC`,
            [current_start, current_end_exclusive]
        ),
        executeQuery<{ id: string; client: string | null; deadline: string | null; days_late: number }>(
            `SELECT o.id::text,
                    COALESCE(c.name, l.name) AS client,
                    o.deadline::text,
                    GREATEST(0, DATE_PART('day', NOW() - o.deadline))::int AS days_late
             FROM orders o
             LEFT JOIN customers c ON c.id = o.customer_id
             LEFT JOIN leads l ON l.id = o.lead_id
             WHERE o.deadline IS NOT NULL
               AND o.deadline < NOW()
               AND o.status NOT IN ('ENTREGUE', 'CANCELADO')
             ORDER BY o.deadline ASC
             LIMIT 20`,
            []
        ),
    ]);

    const total = statusResult.rows.reduce((acc, row) => acc + parseInteger(row.count), 0);
    const statusDistribution = statusResult.rows.map((row) => ({
        status: row.status,
        count: parseInteger(row.count),
        percent: total > 0 ? clampPercentage((parseInteger(row.count) / total) * 100) : 0,
    }));

    const completedStatuses = new Set(['ENTREGUE', 'RETIRADO', 'ENVIADO']);
    const inProgressStatuses = new Set(['EM_PRODUCAO', 'CONTROLE_QUALIDADE', 'SEPARANDO', 'APROVADO']);

    const completedCount = statusResult.rows
        .filter((r) => completedStatuses.has(r.status))
        .reduce((acc, r) => acc + parseInteger(r.count), 0);
    const inProgressCount = statusResult.rows
        .filter((r) => inProgressStatuses.has(r.status))
        .reduce((acc, r) => acc + parseInteger(r.count), 0);

    return {
        period: {
            from: current_start,
            to: formatDateOnly(addDays(parseDateValue(current_end_exclusive), -1)),
        },
        status_distribution: statusDistribution,
        late_orders: lateResult.rows,
        total_orders: total,
        completed_count: completedCount,
        in_progress_count: inProgressCount,
        late_count: lateResult.rows.length,
    };
}

// ─── Analytics Loja ───────────────────────────────────────────────────────────

export interface AnalyticsStoreResponse {
    period: { from: string; to: string };
    store_active: boolean;
    revenue_cents: number;
    orders_count: number;
    average_ticket_cents: number;
    top_products: Array<{ product: string; quantity: number; revenue_cents: number }>;
    status_breakdown: Array<{ status: string; count: number }>;
}

export async function getAnalyticsStore(
    params: { periodo: AnalyticsPeriod; from?: string; to?: string }
): Promise<AnalyticsStoreResponse> {
    const range = resolveAnalyticsPeriodRange(params.periodo, params.from, params.to);
    const { current_start, current_end_exclusive } = range;

    const [configResult, summaryResult, topProductsResult, statusResult] = await Promise.all([
        executeQuery<{ is_active: boolean }>(`SELECT is_active FROM store_config LIMIT 1`),
        executeQuery<{ revenue_cents: string; orders_count: string }>(
            `SELECT COALESCE(SUM(amount_cents), 0)::text AS revenue_cents,
                    COUNT(*)::text AS orders_count
             FROM store_orders
             WHERE created_at >= $1 AND created_at < $2
               AND status = 'approved'`,
            [current_start, current_end_exclusive]
        ),
        executeQuery<{ product: string; quantity: string; revenue_cents: string }>(
            `SELECT sp.name AS product,
                    COUNT(so.id)::text AS quantity,
                    COALESCE(SUM(so.amount_cents), 0)::text AS revenue_cents
             FROM store_orders so
             JOIN store_products sp ON sp.id = so.store_product_id
             WHERE so.created_at >= $1 AND so.created_at < $2
               AND so.status = 'approved'
             GROUP BY sp.name
             ORDER BY SUM(so.amount_cents) DESC
             LIMIT 10`,
            [current_start, current_end_exclusive]
        ),
        executeQuery<{ status: string; count: string }>(
            `SELECT status::text, COUNT(*)::text AS count
             FROM store_orders
             WHERE created_at >= $1 AND created_at < $2
             GROUP BY 1`,
            [current_start, current_end_exclusive]
        ),
    ]);

    const storeActive = configResult.rows[0]?.is_active ?? false;
    const summary = summaryResult.rows[0] ?? { revenue_cents: '0', orders_count: '0' };
    const revenueCents = parseInteger(summary.revenue_cents);
    const ordersCount = parseInteger(summary.orders_count);

    return {
        period: {
            from: current_start,
            to: formatDateOnly(addDays(parseDateValue(current_end_exclusive), -1)),
        },
        store_active: storeActive,
        revenue_cents: revenueCents,
        orders_count: ordersCount,
        average_ticket_cents: ordersCount > 0 ? Math.round(revenueCents / ordersCount) : 0,
        top_products: topProductsResult.rows.map((r) => ({
            product: r.product,
            quantity: parseInteger(r.quantity),
            revenue_cents: parseInteger(r.revenue_cents),
        })),
        status_breakdown: statusResult.rows.map((r) => ({
            status: r.status,
            count: parseInteger(r.count),
        })),
    };
}

// ─── Analytics Atendentes ─────────────────────────────────────────────────────

export interface AnalyticsAgentsResponse {
    period: { from: string; to: string };
    agents: Array<{
        id: string;
        name: string;
        conversations_handled: number;
        messages_sent: number;
        avg_response_time_min: number | null;
        leads_converted: number;
    }>;
}

export async function getAnalyticsAgents(
    params: { periodo: AnalyticsPeriod; from?: string; to?: string }
): Promise<AnalyticsAgentsResponse> {
    const range = resolveAnalyticsPeriodRange(params.periodo, params.from, params.to);
    const { current_start, current_end_exclusive } = range;

    const result = await executeQuery<{
        id: string;
        name: string;
        conversations_handled: string;
        messages_sent: string;
        leads_converted: string;
    }>(
        `SELECT
           u.id::text,
           u.name,
           COUNT(DISTINCT c.id)::text AS conversations_handled,
           COUNT(DISTINCT m.id)::text AS messages_sent,
           COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'CONVERTED')::text AS leads_converted
         FROM users u
         LEFT JOIN conversations c
           ON c.assigned_to = u.id
           AND c.assigned_at >= $1 AND c.assigned_at < $2
         LEFT JOIN messages m
           ON m.sent_by = u.id
           AND m.created_at >= $1 AND m.created_at < $2
           AND m.direction = 'OUTBOUND'
         LEFT JOIN leads l
           ON l.assigned_to = u.id
           AND l.updated_at >= $1 AND l.updated_at < $2
         WHERE u.role IN ('ADMIN', 'ATENDENTE')
           AND u.status = 'active'
         GROUP BY u.id, u.name
         ORDER BY COUNT(DISTINCT c.id) DESC`,
        [current_start, current_end_exclusive]
    );

    return {
        period: {
            from: current_start,
            to: formatDateOnly(addDays(parseDateValue(current_end_exclusive), -1)),
        },
        agents: result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            conversations_handled: parseInteger(row.conversations_handled),
            messages_sent: parseInteger(row.messages_sent),
            avg_response_time_min: null,
            leads_converted: parseInteger(row.leads_converted),
        })),
    };
}
