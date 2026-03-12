import type { QueryResult, QueryResultRow } from 'pg';
import type { FinancialEntryType } from '../types/entities.js';

export type FinancePeriod = '7d' | 'mes' | 'trimestre' | 'ano';
export type FinanceLaunchFilter = 'todos' | 'receitas' | 'despesas' | 'pendentes';
export type FinanceLaunchStatus = 'confirmado' | 'pendente';

export interface FinanceDashboardMetric {
    total_cents: number;
    delta_percent: number;
    count?: number;
    ticket_medio_cents?: number;
    attendants?: number;
    due_date?: string;
}

export interface FinanceBarPoint {
    label: string;
    receitas_cents: number;
    despesas_cents: number;
}

export interface FinancePiePoint {
    categoria: string;
    valor_cents: number;
    percentual: number;
}

export interface FinanceDashboardResponse {
    periodo: FinancePeriod;
    receitas: FinanceDashboardMetric;
    despesas: FinanceDashboardMetric;
    saldo: FinanceDashboardMetric;
    comissoes: FinanceDashboardMetric;
    grafico_barras: FinanceBarPoint[];
    grafico_pizza: FinancePiePoint[];
}

export interface FinanceCommissionRecord {
    user_id: string;
    nome: string;
    vendas: number;
    total_vendido_cents: number;
    comissao_cents: number;
    percentual: number;
}

export interface FinanceLaunchRecord {
    id: string;
    source_id: string;
    status: FinanceLaunchStatus;
    type: FinancialEntryType;
    description: string;
    category: string;
    amount_cents: number;
    competence_date: string;
    created_at: string;
    receipt_url: string | null;
    responsible: {
        id: string;
        name: string;
    } | null;
    reference: {
        order_id: string | null;
        order_number: string | null;
        payment_id: string | null;
    };
}

export interface FinanceLaunchesResponse {
    data: FinanceLaunchRecord[];
    meta: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

interface FinancePeriodRange {
    periodo: FinancePeriod;
    current_start: string;
    current_end_exclusive: string;
    previous_start: string;
    previous_end_exclusive: string;
}

interface FinancialAnalyticsRow {
    type: FinancialEntryType;
    amount_cents: number;
    category: string;
    competence_date: string;
    commission_user_id: string | null;
    commission_amount_cents: number | null;
}

interface FinancialEntryLaunchRow {
    id: string;
    type: FinancialEntryType;
    amount_cents: number;
    category: string;
    description: string;
    order_id: string | null;
    order_number: string | null;
    payment_id: string | null;
    competence_date: string;
    receipt_url: string | null;
    created_at: string;
    created_by_user_id: string;
    created_by_user_name: string;
}

interface PendingPaymentLaunchRow {
    id: string;
    amount_cents: number;
    payment_method: string | null;
    created_at: string;
    order_id: string;
    order_number: string;
    responsible_id: string | null;
    responsible_name: string | null;
}

interface FinanceCommissionRow {
    user_id: string;
    nome: string;
    vendas: string;
    total_vendido_cents: string;
    percentual: string;
    comissao_cents: string;
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

function startOfQuarter(date: Date): Date {
    const month = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), month, 1);
}

function startOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 0, 1);
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

function addYears(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + amount);
    return next;
}

function formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateValue(value: string | Date): Date {
    if (value instanceof Date) {
        return value;
    }

    if (value.includes('T')) {
        return new Date(value);
    }

    return new Date(`${value}T12:00:00`);
}

function normalizeSearchValue(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

function humanizeCategory(value: string): string {
    return value
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function calculateDeltaPercent(currentValue: number, previousValue: number): number {
    if (previousValue === 0) {
        return currentValue === 0 ? 0 : 100;
    }

    return Math.round((((currentValue - previousValue) / previousValue) * 100) * 10) / 10;
}

export function resolveFinancePeriodRange(periodo: FinancePeriod, referenceDate = new Date()): FinancePeriodRange {
    const today = startOfDay(referenceDate);

    if (periodo === '7d') {
        const currentStart = addDays(today, -6);
        const currentEnd = addDays(today, 1);
        const previousStart = addDays(currentStart, -7);

        return {
            periodo,
            current_start: formatDateOnly(currentStart),
            current_end_exclusive: formatDateOnly(currentEnd),
            previous_start: formatDateOnly(previousStart),
            previous_end_exclusive: formatDateOnly(currentStart),
        };
    }

    if (periodo === 'trimestre') {
        const currentStartDate = startOfQuarter(today);
        const currentEndDate = addMonths(currentStartDate, 3);
        const previousStartDate = addMonths(currentStartDate, -3);

        return {
            periodo,
            current_start: formatDateOnly(currentStartDate),
            current_end_exclusive: formatDateOnly(currentEndDate),
            previous_start: formatDateOnly(previousStartDate),
            previous_end_exclusive: formatDateOnly(currentStartDate),
        };
    }

    if (periodo === 'ano') {
        const currentStartDate = startOfYear(today);
        const currentEndDate = addYears(currentStartDate, 1);
        const previousStartDate = addYears(currentStartDate, -1);

        return {
            periodo,
            current_start: formatDateOnly(currentStartDate),
            current_end_exclusive: formatDateOnly(currentEndDate),
            previous_start: formatDateOnly(previousStartDate),
            previous_end_exclusive: formatDateOnly(currentStartDate),
        };
    }

    const currentStartDate = startOfMonth(today);
    const currentEndDate = addMonths(currentStartDate, 1);
    const previousStartDate = addMonths(currentStartDate, -1);

    return {
        periodo: 'mes',
        current_start: formatDateOnly(currentStartDate),
        current_end_exclusive: formatDateOnly(currentEndDate),
        previous_start: formatDateOnly(previousStartDate),
        previous_end_exclusive: formatDateOnly(currentStartDate),
    };
}

export function buildFinanceBarSeries(
    rows: Pick<FinancialAnalyticsRow, 'type' | 'amount_cents' | 'competence_date'>[],
    periodo: FinancePeriod,
    periodStart: string
): FinanceBarPoint[] {
    const buckets = new Map<string, FinanceBarPoint>();
    const periodStartDate = parseDateValue(periodStart);

    for (const row of rows) {
        const date = parseDateValue(row.competence_date);
        let key = row.competence_date;
        let label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
            .format(date)
            .replace('.', '');

        if (periodo === 'trimestre') {
            const diffDays = Math.max(0, Math.floor((date.getTime() - periodStartDate.getTime()) / 86_400_000));
            const weekIndex = Math.floor(diffDays / 7) + 1;
            key = `semana-${weekIndex}`;
            label = `Sem ${weekIndex}`;
        }

        if (periodo === 'ano') {
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            key = monthKey;
            label = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
                .format(date)
                .replace('.', '')
                .replace(/^\w/, (letter) => letter.toUpperCase());
        }

        const current = buckets.get(key) ?? {
            label,
            receitas_cents: 0,
            despesas_cents: 0,
        };

        if (row.type === 'ENTRADA') {
            current.receitas_cents += row.amount_cents;
        } else {
            current.despesas_cents += Math.abs(row.amount_cents);
        }

        buckets.set(key, current);
    }

    return Array.from(buckets.values());
}

export function buildFinancePieSeries(
    rows: Pick<FinancialAnalyticsRow, 'type' | 'amount_cents' | 'category'>[]
): FinancePiePoint[] {
    const expenseRows = rows.filter((row) => row.type === 'SAIDA');
    const totalExpenses = expenseRows.reduce((sum, row) => sum + Math.abs(row.amount_cents), 0);

    if (totalExpenses === 0) {
        return [];
    }

    const totalsByCategory = new Map<string, number>();

    for (const row of expenseRows) {
        const key = humanizeCategory(row.category);
        totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + Math.abs(row.amount_cents));
    }

    return Array.from(totalsByCategory.entries())
        .map(([categoria, valor_cents]) => ({
            categoria,
            valor_cents,
            percentual: Math.round((valor_cents / totalExpenses) * 1000) / 10,
        }))
        .sort((left, right) => right.valor_cents - left.valor_cents);
}

function buildCommissionsDueDate(periodEndExclusive: string): string {
    const endDate = parseDateValue(periodEndExclusive);
    const dueDate = new Date(endDate.getFullYear(), endDate.getMonth(), 5);
    return formatDateOnly(dueDate);
}

async function fetchAnalyticsRows(startDate: string, endDateExclusive: string): Promise<FinancialAnalyticsRow[]> {
    const result = await executeQuery<FinancialAnalyticsRow>(
        `SELECT
            type,
            amount_cents,
            category,
            competence_date,
            commission_user_id,
            commission_amount_cents
         FROM financial_entries
         WHERE competence_date >= $1
           AND competence_date < $2
         ORDER BY competence_date ASC, created_at ASC`,
        [startDate, endDateExclusive]
    );

    return result.rows;
}

async function fetchCommissionRows(startDate: string, endDateExclusive: string): Promise<FinanceCommissionRecord[]> {
    const result = await executeQuery<FinanceCommissionRow>(
        `SELECT
            u.id AS user_id,
            u.name AS nome,
            COUNT(fe.id)::text AS vendas,
            COALESCE(SUM(fe.amount_cents), 0)::text AS total_vendido_cents,
            COALESCE(MAX(u.commission_rate), 0)::text AS percentual,
            COALESCE(
                SUM(fe.commission_amount_cents),
                ROUND(COALESCE(SUM(fe.amount_cents), 0) * (COALESCE(MAX(u.commission_rate), 0) / 100.0))
            )::text AS comissao_cents
         FROM financial_entries fe
         INNER JOIN users u ON u.id = fe.commission_user_id
         WHERE fe.type = 'ENTRADA'
           AND fe.commission_user_id IS NOT NULL
           AND fe.competence_date >= $1
           AND fe.competence_date < $2
         GROUP BY u.id, u.name
         ORDER BY COALESCE(SUM(fe.amount_cents), 0) DESC, u.name ASC`,
        [startDate, endDateExclusive]
    );

    return result.rows.map((row) => ({
        user_id: row.user_id,
        nome: row.nome,
        vendas: Number.parseInt(row.vendas, 10),
        total_vendido_cents: Number.parseInt(row.total_vendido_cents, 10),
        percentual: Number.parseFloat(row.percentual),
        comissao_cents: Number.parseInt(row.comissao_cents, 10),
    }));
}

async function fetchFinancialLaunchRows(startDate: string, endDateExclusive: string): Promise<FinancialEntryLaunchRow[]> {
    const result = await executeQuery<FinancialEntryLaunchRow>(
        `SELECT
            fe.id,
            fe.type,
            fe.amount_cents,
            fe.category,
            fe.description,
            fe.order_id,
            o.order_number,
            fe.payment_id,
            fe.competence_date,
            fe.receipt_url,
            fe.created_at,
            u.id AS created_by_user_id,
            u.name AS created_by_user_name
         FROM financial_entries fe
         INNER JOIN users u ON u.id = fe.created_by
         LEFT JOIN orders o ON o.id = fe.order_id
         WHERE fe.competence_date >= $1
           AND fe.competence_date < $2
         ORDER BY fe.competence_date DESC, fe.created_at DESC`,
        [startDate, endDateExclusive]
    );

    return result.rows;
}

async function fetchPendingPaymentRows(startDate: string, endDateExclusive: string): Promise<PendingPaymentLaunchRow[]> {
    const result = await executeQuery<PendingPaymentLaunchRow>(
        `SELECT
            p.id,
            p.amount_cents,
            p.payment_method,
            p.created_at,
            o.id AS order_id,
            o.order_number,
            u.id AS responsible_id,
            u.name AS responsible_name
         FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         LEFT JOIN users u ON u.id = o.assigned_to
         WHERE p.status = 'PENDING'
           AND p.created_at::date >= $1
           AND p.created_at::date < $2
           AND NOT EXISTS (
                SELECT 1
                FROM financial_entries fe
                WHERE fe.payment_id = p.id
           )
         ORDER BY p.created_at DESC`,
        [startDate, endDateExclusive]
    );

    return result.rows;
}

function summarizeFinanceRows(rows: FinancialAnalyticsRow[]) {
    const receitasTotal = rows
        .filter((row) => row.type === 'ENTRADA')
        .reduce((sum, row) => sum + row.amount_cents, 0);
    const despesasTotal = rows
        .filter((row) => row.type === 'SAIDA')
        .reduce((sum, row) => sum + Math.abs(row.amount_cents), 0);
    const receitasCount = rows.filter((row) => row.type === 'ENTRADA').length;
    const despesasCount = rows.filter((row) => row.type === 'SAIDA').length;
    const comissoesTotal = rows.reduce((sum, row) => sum + (row.commission_amount_cents ?? 0), 0);
    const comissoesUsers = new Set(
        rows
            .map((row) => row.commission_user_id)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
    );

    return {
        receitasTotal,
        receitasCount,
        despesasTotal,
        despesasCount,
        saldoTotal: receitasTotal - despesasTotal,
        ticketMedioCents: receitasCount > 0 ? Math.round(receitasTotal / receitasCount) : 0,
        comissoesTotal,
        comissoesUsersCount: comissoesUsers.size,
    };
}

function buildLaunchRecords(
    financialRows: FinancialEntryLaunchRow[],
    pendingRows: PendingPaymentLaunchRow[]
): FinanceLaunchRecord[] {
    const confirmed = financialRows.map<FinanceLaunchRecord>((row) => ({
        id: row.id,
        source_id: row.id,
        status: 'confirmado',
        type: row.type,
        description: row.description,
        category: row.category,
        amount_cents: row.amount_cents,
        competence_date: row.competence_date,
        created_at: row.created_at,
        receipt_url: row.receipt_url,
        responsible: {
            id: row.created_by_user_id,
            name: row.created_by_user_name,
        },
        reference: {
            order_id: row.order_id,
            order_number: row.order_number,
            payment_id: row.payment_id,
        },
    }));

    const pending = pendingRows.map<FinanceLaunchRecord>((row) => ({
        id: `pending-${row.id}`,
        source_id: row.id,
        status: 'pendente',
        type: 'ENTRADA',
        description: `Pagamento pendente do pedido ${row.order_number}`,
        category: row.payment_method ?? 'LINK_PAGAMENTO',
        amount_cents: row.amount_cents,
        competence_date: row.created_at,
        created_at: row.created_at,
        receipt_url: null,
        responsible: row.responsible_id && row.responsible_name
            ? {
                id: row.responsible_id,
                name: row.responsible_name,
            }
            : null,
        reference: {
            order_id: row.order_id,
            order_number: row.order_number,
            payment_id: row.id,
        },
    }));

    return [...confirmed, ...pending].sort((left, right) => {
        const leftTime = new Date(left.created_at).getTime();
        const rightTime = new Date(right.created_at).getTime();
        return rightTime - leftTime;
    });
}

export async function getFinanceDashboard(periodo: FinancePeriod): Promise<FinanceDashboardResponse> {
    const range = resolveFinancePeriodRange(periodo);
    const [currentRows, previousRows] = await Promise.all([
        fetchAnalyticsRows(range.current_start, range.current_end_exclusive),
        fetchAnalyticsRows(range.previous_start, range.previous_end_exclusive),
    ]);

    const currentSummary = summarizeFinanceRows(currentRows);
    const previousSummary = summarizeFinanceRows(previousRows);

    return {
        periodo,
        receitas: {
            total_cents: currentSummary.receitasTotal,
            delta_percent: calculateDeltaPercent(currentSummary.receitasTotal, previousSummary.receitasTotal),
            count: currentSummary.receitasCount,
        },
        despesas: {
            total_cents: currentSummary.despesasTotal,
            delta_percent: calculateDeltaPercent(currentSummary.despesasTotal, previousSummary.despesasTotal),
            count: currentSummary.despesasCount,
        },
        saldo: {
            total_cents: currentSummary.saldoTotal,
            delta_percent: calculateDeltaPercent(currentSummary.saldoTotal, previousSummary.saldoTotal),
            ticket_medio_cents: currentSummary.ticketMedioCents,
        },
        comissoes: {
            total_cents: currentSummary.comissoesTotal,
            delta_percent: calculateDeltaPercent(currentSummary.comissoesTotal, previousSummary.comissoesTotal),
            attendants: currentSummary.comissoesUsersCount,
            due_date: buildCommissionsDueDate(range.current_end_exclusive),
        },
        grafico_barras: buildFinanceBarSeries(currentRows, periodo, range.current_start),
        grafico_pizza: buildFinancePieSeries(currentRows),
    };
}

export async function getFinanceCommissions(periodo: FinancePeriod): Promise<FinanceCommissionRecord[]> {
    const range = resolveFinancePeriodRange(periodo);
    return fetchCommissionRows(range.current_start, range.current_end_exclusive);
}

export async function listFinanceLaunches(input: {
    periodo: FinancePeriod;
    tipo: FinanceLaunchFilter;
    search?: string;
    page: number;
    limit: number;
}): Promise<FinanceLaunchesResponse> {
    const range = resolveFinancePeriodRange(input.periodo);
    const [financialRows, pendingRows] = await Promise.all([
        fetchFinancialLaunchRows(range.current_start, range.current_end_exclusive),
        fetchPendingPaymentRows(range.current_start, range.current_end_exclusive),
    ]);

    const searchValue = normalizeSearchValue(input.search ?? '');
    const records = buildLaunchRecords(financialRows, pendingRows);
    const filtered = records.filter((record) => {
        if (input.tipo === 'receitas' && !(record.type === 'ENTRADA' && record.status === 'confirmado')) {
            return false;
        }

        if (input.tipo === 'despesas' && !(record.type === 'SAIDA' && record.status === 'confirmado')) {
            return false;
        }

        if (input.tipo === 'pendentes' && record.status !== 'pendente') {
            return false;
        }

        if (!searchValue) {
            return true;
        }

        const haystack = normalizeSearchValue([
            record.description,
            record.category,
            record.responsible?.name ?? '',
            record.reference.order_number ?? '',
        ].join(' '));

        return haystack.includes(searchValue);
    });

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / input.limit));
    const safePage = Math.min(input.page, pages);
    const offset = (safePage - 1) * input.limit;

    return {
        data: filtered.slice(offset, offset + input.limit),
        meta: {
            total,
            page: safePage,
            limit: input.limit,
            pages,
        },
    };
}
