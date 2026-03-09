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
    const [ordersResult, storeResult] = await Promise.all([
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
    ]);

    return {
        revenue_cents: parseInteger(ordersResult.rows[0]?.revenue_cents) + parseInteger(storeResult.rows[0]?.revenue_cents),
        total_orders: parseInteger(ordersResult.rows[0]?.total_orders) + parseInteger(storeResult.rows[0]?.total_orders),
        revenue_orders: parseInteger(ordersResult.rows[0]?.revenue_orders) + parseInteger(storeResult.rows[0]?.revenue_orders),
        cancelled_orders: parseInteger(ordersResult.rows[0]?.cancelled_orders) + parseInteger(storeResult.rows[0]?.cancelled_orders),
    };
}

async function fetchSalesTimeline(range: AnalyticsPeriodRange): Promise<SalesTimelineRow[]> {
    const bucketExpression = range.bucket === 'month'
        ? `to_char(date_trunc('month', created_at), 'YYYY-MM-01')`
        : `to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`;

    const result = await executeQuery<SalesTimelineRow>(
        `SELECT
            raw.bucket,
            raw.scope,
            COALESCE(SUM(raw.amount_cents), 0)::text AS revenue_cents,
            COUNT(*)::text AS orders_count
         FROM (
            SELECT
                ${bucketExpression} AS bucket,
                'current'::text AS scope,
                final_amount_cents AS amount_cents
            FROM orders
            WHERE created_at >= $1
              AND created_at < $2
              AND status IN ${REVENUE_ORDER_STATUS_SQL}

            UNION ALL

            SELECT
                ${bucketExpression} AS bucket,
                'current'::text AS scope,
                amount_cents
            FROM store_orders
            WHERE created_at >= $1
              AND created_at < $2
              AND status = 'approved'

            UNION ALL

            SELECT
                ${bucketExpression} AS bucket,
                'previous'::text AS scope,
                final_amount_cents AS amount_cents
            FROM orders
            WHERE created_at >= $3
              AND created_at < $4
              AND status IN ${REVENUE_ORDER_STATUS_SQL}

            UNION ALL

            SELECT
                ${bucketExpression} AS bucket,
                'previous'::text AS scope,
                amount_cents
            FROM store_orders
            WHERE created_at >= $3
              AND created_at < $4
              AND status = 'approved'
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
         ) combined
         GROUP BY combined.channel`,
        [start, endExclusive]
    );

    const byChannel = new Map([
        ['Loja Online', { channel: 'Loja Online', revenue_cents: 0, orders: 0 }],
        ['PDV', { channel: 'PDV', revenue_cents: 0, orders: 0 }],
        ['WhatsApp', { channel: 'WhatsApp', revenue_cents: 0, orders: 0 }],
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
