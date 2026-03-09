import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

type AssistantMessage = {
    role: 'user' | 'assistant';
    content: string;
};

interface AssistantContext {
    userId: string;
    role: UserRole;
    message?: string;
    messages?: AssistantMessage[];
}

type Period = 'today' | 'week' | 'month';

function assertAssistantAvailable(): void {
    if (!env().OPENAI_API_KEY) {
        throw AppError.serviceUnavailable(
            'AI_UNAVAILABLE',
            'Assistente temporariamente indisponível.'
        );
    }
}

function normalizeMessageHistory(messages: AssistantMessage[] | undefined): AssistantMessage[] {
    if (!messages || messages.length === 0) return [];
    return messages
        .filter((entry) => entry && typeof entry.content === 'string' && entry.content.trim().length > 0)
        .slice(-20);
}

function getLatestUserMessage(history: AssistantMessage[], fallbackMessage: string | undefined): string {
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const entry = history[index];
        if (entry?.role === 'user') {
            return entry.content.trim();
        }
    }
    return (fallbackMessage ?? '').trim();
}

function messageIncludes(message: string, terms: string[]): boolean {
    const normalized = message.toLowerCase();
    return terms.some((term) => normalized.includes(term));
}

function detectPeriod(message: string): Period {
    const normalized = message.toLowerCase();
    if (normalized.includes('semana')) return 'week';
    if (normalized.includes('mês') || normalized.includes('mes')) return 'month';
    return 'today';
}

function periodToSqlInterval(period: Period): string {
    if (period === 'today') return '1 day';
    if (period === 'week') return '7 days';
    return '30 days';
}

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value / 100);
}

function parseInteger(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') return Number(value) || 0;
    return 0;
}

function estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
}

async function logAssistantUsage(input: {
    userId: string;
    role: UserRole;
    toolsUsed: string[];
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
}): Promise<void> {
    await query(
        `INSERT INTO assistant_logs (user_id, user_role, functions_called, input_tokens, output_tokens, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            input.userId,
            input.role,
            input.toolsUsed,
            input.inputTokens,
            input.outputTokens,
            input.latencyMs,
        ]
    );
}

async function getLeadsStats(userId: string, role: UserRole, period: Period): Promise<{
    total: number;
    qualified: number;
    converted: number;
}> {
    const params: unknown[] = [periodToSqlInterval(period)];
    let scopeSql = '';

    if (role === 'ATENDENTE') {
        params.push(userId);
        scopeSql = 'AND assigned_to = $2';
    }

    const result = await query<{
        total: string;
        qualified: string;
        converted: string;
    }>(
        `SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE stage = 'QUALIFICADO')::text AS qualified,
            COUNT(*) FILTER (WHERE stage = 'CONVERTIDO')::text AS converted
         FROM leads
         WHERE created_at >= NOW() - ($1::interval)
         ${scopeSql}`,
        params
    );

    return {
        total: parseInteger(result.rows[0]?.total),
        qualified: parseInteger(result.rows[0]?.qualified),
        converted: parseInteger(result.rows[0]?.converted),
    };
}

async function getOrdersStats(userId: string, role: UserRole, period: Period): Promise<{
    total: number;
    paid: number;
    pending: number;
    valueCents: number;
}> {
    const params: unknown[] = [periodToSqlInterval(period)];
    let scopeSql = '';

    if (role === 'ATENDENTE') {
        params.push(userId);
        scopeSql = 'AND assigned_to = $2';
    }

    const result = await query<{
        total: string;
        paid: string;
        pending: string;
        value_cents: string;
    }>(
        `SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'PAGO')::text AS paid,
            COUNT(*) FILTER (WHERE status = 'AGUARDANDO_PAGAMENTO')::text AS pending,
            COALESCE(SUM(final_amount_cents), 0)::text AS value_cents
         FROM orders
         WHERE created_at >= NOW() - ($1::interval)
         ${scopeSql}`,
        params
    );

    return {
        total: parseInteger(result.rows[0]?.total),
        paid: parseInteger(result.rows[0]?.paid),
        pending: parseInteger(result.rows[0]?.pending),
        valueCents: parseInteger(result.rows[0]?.value_cents),
    };
}

async function getProductionSummary(userId: string, role: UserRole): Promise<{ active: number; overdue: number }> {
    const params: unknown[] = [];
    let scopeSql = '';

    if (role === 'PRODUCAO') {
        params.push(userId);
        scopeSql = 'AND assigned_to = $1';
    }

    const result = await query<{ active: string; overdue: string }>(
        `SELECT
            COUNT(*) FILTER (WHERE status IN ('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA'))::text AS active,
            COUNT(*) FILTER (
                WHERE deadline IS NOT NULL
                  AND deadline < NOW()
                  AND status != 'CONCLUIDA'
            )::text AS overdue
         FROM production_orders
         WHERE 1 = 1
         ${scopeSql}`,
        params
    );

    return {
        active: parseInteger(result.rows[0]?.active),
        overdue: parseInteger(result.rows[0]?.overdue),
    };
}

async function getFinancialSummary(period: Period): Promise<{
    inCents: number;
    outCents: number;
    balanceCents: number;
}> {
    const result = await query<{ in_total: string; out_total: string; balance_total: string }>(
        `SELECT
            COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_cents ELSE 0 END), 0)::text AS in_total,
            COALESCE(SUM(CASE WHEN type = 'SAIDA' THEN amount_cents ELSE 0 END), 0)::text AS out_total,
            COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_cents ELSE -amount_cents END), 0)::text AS balance_total
         FROM financial_entries
         WHERE created_at >= NOW() - ($1::interval)`,
        [periodToSqlInterval(period)]
    );

    return {
        inCents: parseInteger(result.rows[0]?.in_total),
        outCents: parseInteger(result.rows[0]?.out_total),
        balanceCents: parseInteger(result.rows[0]?.balance_total),
    };
}

async function getCommissions(userId: string, role: UserRole, period: Period): Promise<{
    totalCents: number;
    attendants: Array<{ user_id: string; name: string; amount_cents: number }>;
}> {
    const params: unknown[] = [periodToSqlInterval(period)];
    let scopeSql = '';

    if (role === 'ATENDENTE') {
        params.push(userId);
        scopeSql = 'AND fe.commission_user_id = $2';
    }

    const result = await query<{
        user_id: string;
        name: string;
        amount_cents: string;
    }>(
        `SELECT
            fe.commission_user_id AS user_id,
            u.name,
            COALESCE(SUM(fe.commission_amount_cents), 0)::text AS amount_cents
         FROM financial_entries fe
         JOIN users u ON u.id = fe.commission_user_id
         WHERE fe.commission_user_id IS NOT NULL
           AND fe.created_at >= NOW() - ($1::interval)
           ${scopeSql}
         GROUP BY fe.commission_user_id, u.name
         ORDER BY amount_cents::bigint DESC`,
        params
    );

    const attendants = result.rows.map((row) => ({
        user_id: row.user_id,
        name: row.name,
        amount_cents: parseInteger(row.amount_cents),
    }));

    return {
        totalCents: attendants.reduce((sum, item) => sum + item.amount_cents, 0),
        attendants,
    };
}

async function getTopProducts(period: Period, limit = 5): Promise<Array<{ description: string; quantity: number; revenue_cents: number }>> {
    const result = await query<{ description: string; quantity: string; revenue_cents: string }>(
        `SELECT
            oi.description,
            COALESCE(SUM(oi.quantity), 0)::text AS quantity,
            COALESCE(SUM(oi.total_price_cents), 0)::text AS revenue_cents
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= NOW() - ($1::interval)
           AND o.status != 'CANCELADO'
         GROUP BY oi.description
         ORDER BY revenue_cents::bigint DESC
         LIMIT $2`,
        [periodToSqlInterval(period), limit]
    );

    return result.rows.map((row) => ({
        description: row.description,
        quantity: parseInteger(row.quantity),
        revenue_cents: parseInteger(row.revenue_cents),
    }));
}

async function getConversionRate(period: Period): Promise<{ converted: number; total: number; ratePercent: number }> {
    const result = await query<{ total: string; converted: string }>(
        `SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE stage = 'CONVERTIDO')::text AS converted
         FROM leads
         WHERE created_at >= NOW() - ($1::interval)`,
        [periodToSqlInterval(period)]
    );

    const total = parseInteger(result.rows[0]?.total);
    const converted = parseInteger(result.rows[0]?.converted);
    const ratePercent = total > 0 ? (converted / total) * 100 : 0;

    return {
        total,
        converted,
        ratePercent,
    };
}

function fallbackAnswer(role: UserRole): string {
    if (role === 'ADMIN') {
        return 'Posso responder sobre leads, pedidos, produção, financeiro, comissões, produtos e conversão.';
    }
    if (role === 'ATENDENTE') {
        return 'Posso responder sobre seus leads, seus pedidos e sua comissão.';
    }
    if (role === 'PRODUCAO') {
        return 'Posso responder sobre fila de produção, ordens ativas e atrasos.';
    }
    return 'Posso responder sobre financeiro, pedidos e comissões.';
}

export async function runAssistant(context: AssistantContext): Promise<{
    answer: string;
    tools_used: string[];
    reply: string;
}> {
    assertAssistantAvailable();

    const startedAt = Date.now();
    const history = normalizeMessageHistory(context.messages);
    const message = getLatestUserMessage(history, context.message);

    if (!message) {
        throw AppError.badRequest('Envie uma mensagem para o assistente.');
    }

    const toolsUsed: string[] = [];
    const period = detectPeriod(message);
    const normalized = message.toLowerCase();
    let answer = fallbackAnswer(context.role);

    if (messageIncludes(normalized, ['financeiro', 'faturamento', 'saldo', 'despesa', 'receita'])) {
        if (!['ADMIN', 'FINANCEIRO'].includes(context.role)) {
            answer = 'Este perfil não pode acessar dados financeiros globais.';
        } else {
            const summary = await getFinancialSummary(period);
            toolsUsed.push('getFinancialSummary');
            answer = `Resumo financeiro (${period}): entradas ${formatCurrencyFromCents(summary.inCents)}, saídas ${formatCurrencyFromCents(summary.outCents)} e saldo ${formatCurrencyFromCents(summary.balanceCents)}.`;
        }
    } else if (messageIncludes(normalized, ['comissão', 'comissao'])) {
        if (!['ADMIN', 'ATENDENTE', 'FINANCEIRO'].includes(context.role)) {
            answer = 'Este perfil não pode consultar comissões.';
        } else {
            const commissions = await getCommissions(context.userId, context.role, period === 'today' ? 'week' : period);
            toolsUsed.push('getCommissions');

            if (context.role === 'ATENDENTE') {
                answer = `Sua comissão acumulada no período é ${formatCurrencyFromCents(commissions.totalCents)}.`;
            } else {
                const top = commissions.attendants.slice(0, 3).map((item) => `${item.name}: ${formatCurrencyFromCents(item.amount_cents)}`);
                answer = `Comissões (${period}): total ${formatCurrencyFromCents(commissions.totalCents)}. Top atendentes: ${top.length > 0 ? top.join(' | ') : 'sem dados no período'}.`;
            }
        }
    } else if (messageIncludes(normalized, ['conversão', 'conversao', 'taxa'])) {
        if (context.role !== 'ADMIN') {
            answer = 'Este indicador é restrito ao perfil ADMIN.';
        } else {
            const conversion = await getConversionRate(period);
            toolsUsed.push('getConversionRate');
            answer = `Taxa de conversão (${period}): ${conversion.ratePercent.toFixed(1)}% (${conversion.converted} convertidos de ${conversion.total} leads).`;
        }
    } else if (messageIncludes(normalized, ['top produto', 'mais vendido', 'produto'])) {
        if (!['ADMIN', 'FINANCEIRO'].includes(context.role)) {
            answer = 'Este perfil não pode consultar ranking de produtos.';
        } else {
            const products = await getTopProducts(period === 'today' ? 'month' : period, 5);
            toolsUsed.push('getTopProducts');

            if (products.length === 0) {
                answer = 'Não encontrei produtos vendidos no período consultado.';
            } else {
                answer = `Top produtos (${period}): ${products
                    .map((product) => `${product.description} (${product.quantity} un · ${formatCurrencyFromCents(product.revenue_cents)})`)
                    .join(' | ')}.`;
            }
        }
    } else if (messageIncludes(normalized, ['produção', 'producao', 'ordem'])) {
        if (!['ADMIN', 'PRODUCAO'].includes(context.role)) {
            answer = 'Este perfil não pode consultar a fila de produção.';
        } else {
            const summary = await getProductionSummary(context.userId, context.role);
            toolsUsed.push('getProductionSummary');
            answer = `Produção: ${summary.active} ordem(ns) ativa(s) e ${summary.overdue} atrasada(s) no seu escopo.`;
        }
    } else if (messageIncludes(normalized, ['pedido', 'pedidos'])) {
        if (!['ADMIN', 'ATENDENTE', 'FINANCEIRO'].includes(context.role)) {
            answer = 'Este perfil não pode consultar pedidos.';
        } else {
            const stats = await getOrdersStats(context.userId, context.role, period);
            toolsUsed.push('getOrdersStats');
            answer = `Pedidos (${period}): ${stats.total} total, ${stats.paid} pagos, ${stats.pending} aguardando pagamento, valor ${formatCurrencyFromCents(stats.valueCents)}.`;
        }
    } else if (messageIncludes(normalized, ['lead', 'leads'])) {
        if (!['ADMIN', 'ATENDENTE'].includes(context.role)) {
            answer = 'Este perfil não pode consultar leads.';
        } else {
            const stats = await getLeadsStats(context.userId, context.role, period);
            toolsUsed.push('getLeadsStats');
            answer = `Leads (${period}): ${stats.total} novos, ${stats.qualified} qualificados, ${stats.converted} convertidos.`;
        }
    }

    const inputTokens = estimateTokens([
        message,
        ...history.map((entry) => entry.content),
    ].join(' '));
    const outputTokens = estimateTokens(answer);
    const latencyMs = Date.now() - startedAt;

    await logAssistantUsage({
        userId: context.userId,
        role: context.role,
        toolsUsed,
        inputTokens,
        outputTokens,
        latencyMs,
    }).catch(() => undefined);

    return {
        answer,
        reply: answer,
        tools_used: toolsUsed,
    };
}
