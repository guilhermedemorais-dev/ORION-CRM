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

interface AssistantUsage {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
}

type Period = 'today' | 'week' | 'month' | 'quarter';
type ProductionFilter = 'all' | 'mine' | 'late' | 'today';

type AssistantToolName =
    | 'getLeadsStats'
    | 'getMyLeads'
    | 'getOrdersStats'
    | 'getPendingOrders'
    | 'getProductionOrders'
    | 'getFinancialSummary'
    | 'getCommissions'
    | 'getStockAlerts'
    | 'getConversionRate'
    | 'getTopProducts';

interface AssistantToolContext {
    userId: string;
    role: UserRole;
}

interface AssistantToolDefinition {
    name: AssistantToolName;
    description: string;
    roles: UserRole[];
    fallbackPriority?: number;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
    };
    matcher: (message: string) => boolean;
    buildFallbackInput: (message: string) => Record<string, unknown>;
    execute: (input: Record<string, unknown>, context: AssistantToolContext) => Promise<unknown>;
    formatFallbackResult: (result: unknown, input: Record<string, unknown>, context: AssistantToolContext) => string;
}

interface AnthropicTextBlock {
    type: 'text';
    text: string;
}

interface AnthropicToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

interface AnthropicToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
}

type AnthropicIncomingBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: string; [key: string]: unknown };
type AnthropicOutgoingBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

interface AnthropicMessagePayload {
    role: 'user' | 'assistant';
    content: string | AnthropicOutgoingBlock[];
}

interface AnthropicMessagesResponse {
    id: string;
    model: string;
    role: 'assistant';
    stop_reason: string | null;
    content: AnthropicIncomingBlock[];
}

function assertAssistantAvailable(): void {
    if (!env().ANTHROPIC_API_KEY && !env().OPENAI_API_KEY) {
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
    if (normalized.includes('trimestre') || normalized.includes('quarter')) return 'quarter';
    if (normalized.includes('semana')) return 'week';
    if (normalized.includes('mês') || normalized.includes('mes')) return 'month';
    return 'today';
}

export function periodToSqlInterval(period: Period): string {
    if (period === 'today') return '1 day';
    if (period === 'week') return '7 days';
    if (period === 'quarter') return '90 days';
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

async function getLeadsStats(userId: string, role: UserRole, period: Period, stage?: string): Promise<{
    total: number;
    qualified: number;
    converted: number;
}> {
    const params: unknown[] = [periodToSqlInterval(period)];
    const filters = ['created_at >= NOW() - ($1::interval)'];

    if (role === 'ATENDENTE') {
        params.push(userId);
        filters.push(`assigned_to = $${params.length}`);
    }

    if (stage) {
        params.push(stage);
        filters.push(`stage = $${params.length}`);
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
         WHERE ${filters.join(' AND ')}`,
        params
    );

    return {
        total: parseInteger(result.rows[0]?.total),
        qualified: parseInteger(result.rows[0]?.qualified),
        converted: parseInteger(result.rows[0]?.converted),
    };
}

async function getMyLeads(userId: string, role: UserRole, stage?: string, limit = 10): Promise<Array<{
    id: string;
    name: string | null;
    whatsapp_number: string;
    stage: string;
    created_at: Date;
}>> {
    const params: unknown[] = [];
    const filters: string[] = [];

    if (role === 'ATENDENTE') {
        params.push(userId);
        filters.push(`assigned_to = $${params.length}`);
    }

    if (stage) {
        params.push(stage);
        filters.push(`stage = $${params.length}`);
    }

    params.push(limit);
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query<{
        id: string;
        name: string | null;
        whatsapp_number: string;
        stage: string;
        created_at: Date;
    }>(
        `SELECT id, name, whatsapp_number, stage, created_at
         FROM leads
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params
    );

    return result.rows;
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

async function getPendingOrders(userId: string, role: UserRole, status?: string): Promise<Array<{
    id: string;
    order_number: string;
    status: string;
    final_amount_cents: number;
    created_at: Date;
}>> {
    const params: unknown[] = [];
    const filters = [`status IN ('AGUARDANDO_PAGAMENTO', 'RASCUNHO', 'AGUARDANDO_APROVACAO_DESIGN')`];

    if (role === 'ATENDENTE') {
        params.push(userId);
        filters.push(`assigned_to = $${params.length}`);
    }

    if (status) {
        params.push(status);
        filters.push(`status = $${params.length}`);
    }

    const result = await query<{
        id: string;
        order_number: string;
        status: string;
        final_amount_cents: number;
        created_at: Date;
    }>(
        `SELECT id, order_number, status, final_amount_cents, created_at
         FROM orders
         WHERE ${filters.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT 10`,
        params
    );

    return result.rows;
}

async function getProductionOrders(userId: string, role: UserRole, filter: ProductionFilter): Promise<Array<{
    id: string;
    order_number: string;
    status: string;
    current_step: string;
    deadline: Date | null;
}>> {
    const params: unknown[] = [];
    const filters: string[] = [];

    if (role === 'PRODUCAO' || filter === 'mine') {
        params.push(userId);
        filters.push(`po.assigned_to = $${params.length}`);
    } else if (filter === 'today') {
        filters.push(`po.deadline::date = CURRENT_DATE`);
    } else if (filter === 'late') {
        filters.push(`po.deadline IS NOT NULL AND po.deadline < NOW() AND po.status != 'CONCLUIDA'`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query<{
        id: string;
        order_number: string;
        status: string;
        current_step: string;
        deadline: Date | null;
    }>(
        `SELECT po.id, o.order_number, po.status, po.current_step, po.deadline
         FROM production_orders po
         INNER JOIN orders o ON o.id = po.order_id
         ${whereClause}
         ORDER BY COALESCE(po.deadline, NOW()) ASC
         LIMIT 10`,
        params
    );

    return result.rows;
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

export function resolveCommissionTargetUserId(
    requestedUserId: string | undefined,
    currentUserId: string,
    role: UserRole
): string | undefined {
    if (role === 'ATENDENTE') {
        return currentUserId;
    }

    return requestedUserId;
}

async function getCommissions(userId: string, role: UserRole, period: Period, targetUserId?: string): Promise<{
    totalCents: number;
    attendants: Array<{ user_id: string; name: string; amount_cents: number }>;
}> {
    const params: unknown[] = [periodToSqlInterval(period)];
    const scopedUserId = resolveCommissionTargetUserId(targetUserId, userId, role);
    let scopeSql = '';

    if (scopedUserId) {
        params.push(scopedUserId);
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

async function getStockAlerts(): Promise<Array<{
    id: string;
    name: string;
    stock_quantity: number;
    minimum_stock: number;
}>> {
    const result = await query<{
        id: string;
        name: string;
        stock_quantity: number;
        minimum_stock: number;
    }>(
        `SELECT id, name, stock_quantity, minimum_stock
         FROM products
         WHERE is_active = TRUE
           AND stock_quantity <= minimum_stock
         ORDER BY stock_quantity ASC, name ASC
         LIMIT 10`
    );

    return result.rows;
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

function buildAssistantSystemPrompt(role: UserRole): string {
    const currentDate = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date());

    return [
        'Você é o Assistente ORION, assistente interno do CRM de uma joalheria.',
        `Role do usuário atual: ${role}.`,
        `Data atual: ${currentDate}.`,
        'Responda sempre em português brasileiro, de forma direta, objetiva e específica.',
        'Formate valores monetários como R$ 1.800,00.',
        'Use as ferramentas disponíveis quando precisar consultar dados reais.',
        'Nunca invente números. Se não houver ferramenta ou acesso para responder, diga isso claramente.',
        'O RBAC é obrigatório: você só pode usar as ferramentas disponíveis ao role atual.',
    ].join(' ');
}

const assistantTools: AssistantToolDefinition[] = [
    {
        name: 'getLeadsStats',
        description: 'Retorna estatísticas de leads por período, opcionalmente filtrando por stage.',
        roles: ['ADMIN', 'ATENDENTE'],
        fallbackPriority: 10,
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['today', 'week', 'month'] },
                stage: { type: 'string' },
            },
            required: ['period'],
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['lead', 'leads']),
        buildFallbackInput: (message) => ({
            period: detectPeriod(message) === 'quarter' ? 'month' : detectPeriod(message),
        }),
        execute: async (input, context) => getLeadsStats(
            context.userId,
            context.role,
            (input['period'] as Period) ?? 'today',
            typeof input['stage'] === 'string' ? input['stage'] : undefined
        ),
        formatFallbackResult: (result) => {
            const stats = result as Awaited<ReturnType<typeof getLeadsStats>>;
            return `Leads: ${stats.total} novos, ${stats.qualified} qualificados e ${stats.converted} convertidos no período consultado.`;
        },
    },
    {
        name: 'getMyLeads',
        description: 'Lista leads do atendente logado ou todos os leads mais recentes para ADMIN.',
        roles: ['ADMIN', 'ATENDENTE'],
        fallbackPriority: 20,
        inputSchema: {
            type: 'object',
            properties: {
                stage: { type: 'string' },
                limit: { type: 'number' },
            },
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['meus leads', 'meu lead', 'listar leads']),
        buildFallbackInput: () => ({
            limit: 10,
        }),
        execute: async (input, context) => getMyLeads(
            context.userId,
            context.role,
            typeof input['stage'] === 'string' ? input['stage'] : undefined,
            typeof input['limit'] === 'number' ? input['limit'] : 10
        ),
        formatFallbackResult: (result) => {
            const leads = result as Awaited<ReturnType<typeof getMyLeads>>;
            if (leads.length === 0) {
                return 'Não encontrei leads nesse recorte.';
            }

            return `Leads recentes: ${leads
                .map((lead) => `${lead.name ?? lead.whatsapp_number} (${lead.stage})`)
                .join(' | ')}.`;
        },
    },
    {
        name: 'getOrdersStats',
        description: 'Retorna estatísticas de pedidos por período.',
        roles: ['ADMIN', 'ATENDENTE', 'FINANCEIRO'],
        fallbackPriority: 10,
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['today', 'week', 'month'] },
            },
            required: ['period'],
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['pedido', 'pedidos']) && !messageIncludes(message, ['pendente', 'aguardando']),
        buildFallbackInput: (message) => ({
            period: detectPeriod(message) === 'quarter' ? 'month' : detectPeriod(message),
        }),
        execute: async (input, context) => getOrdersStats(context.userId, context.role, (input['period'] as Period) ?? 'today'),
        formatFallbackResult: (result) => {
            const stats = result as Awaited<ReturnType<typeof getOrdersStats>>;
            return `Pedidos: ${stats.total} total, ${stats.paid} pagos, ${stats.pending} aguardando pagamento, movimentando ${formatCurrencyFromCents(stats.valueCents)}.`;
        },
    },
    {
        name: 'getPendingOrders',
        description: 'Lista pedidos aguardando pagamento ou alguma ação comercial.',
        roles: ['ADMIN', 'ATENDENTE'],
        fallbackPriority: 20,
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string' },
            },
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['pedido pendente', 'pedidos pendentes', 'aguardando pagamento']),
        buildFallbackInput: () => ({}),
        execute: async (input, context) => getPendingOrders(
            context.userId,
            context.role,
            typeof input['status'] === 'string' ? input['status'] : undefined
        ),
        formatFallbackResult: (result) => {
            const orders = result as Awaited<ReturnType<typeof getPendingOrders>>;
            if (orders.length === 0) {
                return 'Não encontrei pedidos pendentes neste escopo.';
            }

            return `Pedidos pendentes: ${orders
                .map((order) => `${order.order_number} (${order.status} · ${formatCurrencyFromCents(order.final_amount_cents)})`)
                .join(' | ')}.`;
        },
    },
    {
        name: 'getProductionOrders',
        description: 'Lista ordens de produção por filtro de escopo, atraso ou prazo.',
        roles: ['ADMIN', 'PRODUCAO'],
        inputSchema: {
            type: 'object',
            properties: {
                filter: { type: 'string', enum: ['all', 'mine', 'late', 'today'] },
            },
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['produção', 'producao', 'ordem de produção', 'ordens de produção']),
        buildFallbackInput: (message) => ({
            filter: messageIncludes(message, ['atras']) ? 'late' : messageIncludes(message, ['hoje']) ? 'today' : 'mine',
        }),
        execute: async (input, context) => getProductionOrders(
            context.userId,
            context.role,
            (input['filter'] as ProductionFilter) ?? 'mine'
        ),
        formatFallbackResult: (result) => {
            const orders = result as Awaited<ReturnType<typeof getProductionOrders>>;
            if (orders.length === 0) {
                return 'Nenhuma ordem de produção encontrada nesse filtro.';
            }

            return `Produção: ${orders
                .map((order) => `${order.order_number} (${order.current_step} · ${order.status})`)
                .join(' | ')}.`;
        },
    },
    {
        name: 'getFinancialSummary',
        description: 'Retorna resumo financeiro com entradas, saídas e saldo.',
        roles: ['ADMIN', 'FINANCEIRO'],
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['today', 'week', 'month', 'quarter'] },
            },
            required: ['period'],
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['financeiro', 'faturamento', 'saldo', 'despesa', 'receita']),
        buildFallbackInput: (message) => ({
            period: detectPeriod(message),
        }),
        execute: async (input) => getFinancialSummary((input['period'] as Period) ?? 'today'),
        formatFallbackResult: (result) => {
            const summary = result as Awaited<ReturnType<typeof getFinancialSummary>>;
            return `Resumo financeiro: entradas ${formatCurrencyFromCents(summary.inCents)}, saídas ${formatCurrencyFromCents(summary.outCents)} e saldo ${formatCurrencyFromCents(summary.balanceCents)}.`;
        },
    },
    {
        name: 'getCommissions',
        description: 'Retorna comissões por atendente ou a própria comissão do usuário.',
        roles: ['ADMIN', 'ATENDENTE', 'FINANCEIRO'],
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['week', 'month'] },
                userId: { type: 'string' },
            },
            required: ['period'],
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['comissão', 'comissao']),
        buildFallbackInput: (message) => ({
            period: detectPeriod(message) === 'today' ? 'week' : 'month',
        }),
        execute: async (input, context) => getCommissions(
            context.userId,
            context.role,
            (input['period'] as Period) ?? 'week',
            typeof input['userId'] === 'string' ? input['userId'] : undefined
        ),
        formatFallbackResult: (result, _input, context) => {
            const commissions = result as Awaited<ReturnType<typeof getCommissions>>;
            if (context.role === 'ATENDENTE') {
                return `Sua comissão acumulada no período é ${formatCurrencyFromCents(commissions.totalCents)}.`;
            }

            const top = commissions.attendants.slice(0, 3).map((item) => `${item.name}: ${formatCurrencyFromCents(item.amount_cents)}`);
            return `Comissões no período: total ${formatCurrencyFromCents(commissions.totalCents)}. ${top.length > 0 ? `Top atendentes: ${top.join(' | ')}.` : 'Sem dados de comissão.'}`;
        },
    },
    {
        name: 'getStockAlerts',
        description: 'Lista produtos com estoque abaixo do mínimo.',
        roles: ['ADMIN'],
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['estoque', 'baixo estoque', 'alerta de estoque']),
        buildFallbackInput: () => ({}),
        execute: async () => getStockAlerts(),
        formatFallbackResult: (result) => {
            const products = result as Awaited<ReturnType<typeof getStockAlerts>>;
            if (products.length === 0) {
                return 'Nenhum alerta de estoque no momento.';
            }

            return `Alertas de estoque: ${products
                .map((product) => `${product.name} (${product.stock_quantity}/${product.minimum_stock})`)
                .join(' | ')}.`;
        },
    },
    {
        name: 'getConversionRate',
        description: 'Retorna a taxa de conversão de leads em clientes por período.',
        roles: ['ADMIN'],
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['week', 'month'] },
            },
            required: ['period'],
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['conversão', 'conversao', 'taxa de conversão']),
        buildFallbackInput: (message) => ({
            period: detectPeriod(message) === 'today' ? 'week' : 'month',
        }),
        execute: async (input) => getConversionRate((input['period'] as Period) ?? 'week'),
        formatFallbackResult: (result) => {
            const conversion = result as Awaited<ReturnType<typeof getConversionRate>>;
            return `Taxa de conversão: ${conversion.ratePercent.toFixed(1)}% (${conversion.converted} convertidos de ${conversion.total} leads).`;
        },
    },
    {
        name: 'getTopProducts',
        description: 'Retorna os produtos mais vendidos no período.',
        roles: ['ADMIN', 'FINANCEIRO'],
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['month', 'quarter'] },
                limit: { type: 'number' },
            },
            required: ['period'],
            additionalProperties: false,
        },
        matcher: (message) => messageIncludes(message, ['top produto', 'mais vendido', 'produtos mais vendidos']),
        buildFallbackInput: (message) => ({
            period: detectPeriod(message) === 'quarter' ? 'quarter' : 'month',
            limit: 5,
        }),
        execute: async (input) => getTopProducts(
            (input['period'] as Period) ?? 'month',
            typeof input['limit'] === 'number' ? input['limit'] : 5
        ),
        formatFallbackResult: (result) => {
            const products = result as Awaited<ReturnType<typeof getTopProducts>>;
            if (products.length === 0) {
                return 'Não encontrei produtos vendidos no período consultado.';
            }

            return `Top produtos: ${products
                .map((product) => `${product.description} (${product.quantity} un · ${formatCurrencyFromCents(product.revenue_cents)})`)
                .join(' | ')}.`;
        },
    },
];

function isToolAvailableForRole(tool: AssistantToolDefinition, role: UserRole): boolean {
    return tool.roles.includes(role);
}

function getAvailableAssistantTools(role: UserRole): AssistantToolDefinition[] {
    return assistantTools.filter((tool) => isToolAvailableForRole(tool, role));
}

export function getAvailableAssistantToolNames(role: UserRole): AssistantToolName[] {
    return getAvailableAssistantTools(role).map((tool) => tool.name);
}

function findFallbackAssistantToolDefinition(message: string, role: UserRole): AssistantToolDefinition | undefined {
    return getAvailableAssistantTools(role)
        .slice()
        .sort((left, right) => (right.fallbackPriority ?? 0) - (left.fallbackPriority ?? 0))
        .find((entry) => entry.matcher(message));
}

export function selectFallbackAssistantTool(message: string, role: UserRole): AssistantToolName | null {
    const normalized = message.toLowerCase();
    const tool = findFallbackAssistantToolDefinition(normalized, role);
    return tool?.name ?? null;
}

function fallbackAnswer(role: UserRole): string {
    if (role === 'ADMIN') {
        return 'Posso responder sobre leads, pedidos, produção, financeiro, comissões, produtos, estoque e conversão.';
    }
    if (role === 'ATENDENTE') {
        return 'Posso responder sobre seus leads, seus pedidos e sua comissão.';
    }
    if (role === 'PRODUCAO') {
        return 'Posso responder sobre fila de produção, ordens ativas e atrasos.';
    }
    return 'Posso responder sobre financeiro, pedidos e comissões.';
}

export function buildAnthropicMessages(history: AssistantMessage[], message: string): AnthropicMessagePayload[] {
    if (history.length === 0) {
        return [{ role: 'user', content: message }];
    }

    const lastEntry = history[history.length - 1];
    const normalizedHistory = history.map((entry) => ({
        role: entry.role,
        content: entry.content,
    }));

    if (lastEntry?.role === 'user' && lastEntry.content.trim() === message) {
        return normalizedHistory;
    }

    return [...normalizedHistory, { role: 'user', content: message }];
}

export function buildAssistantUsage(input: {
    message: string;
    history: AssistantMessage[];
    answer: string;
    latencyMs: number;
}): AssistantUsage {
    return {
        inputTokens: estimateTokens([
            input.message,
            ...input.history.map((entry) => entry.content),
        ].join(' ')),
        outputTokens: estimateTokens(input.answer),
        latencyMs: input.latencyMs,
    };
}

async function callAnthropicMessagesApi(payload: {
    system: string;
    messages: AnthropicMessagePayload[];
    tools: Array<{
        name: string;
        description: string;
        input_schema: AssistantToolDefinition['inputSchema'];
    }>;
}): Promise<AnthropicMessagesResponse> {
    const anthropicApiKey = env().ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
        throw new Error('Anthropic API key não configurada.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: payload.system,
            tools: payload.tools,
            messages: payload.messages,
        }),
    });

    if (!response.ok) {
        const errorPayload = await response.text();
        throw new Error(`Anthropic API retornou erro ${response.status}: ${errorPayload}`);
    }

    return response.json() as Promise<AnthropicMessagesResponse>;
}

async function runAnthropicAssistant(context: AssistantContext, history: AssistantMessage[], message: string): Promise<{
    answer: string;
    tools_used: string[];
}> {
    const availableTools = getAvailableAssistantTools(context.role);
    const availableToolMap = new Map(availableTools.map((tool) => [tool.name, tool]));
    const toolsUsed: string[] = [];
    const systemPrompt = buildAssistantSystemPrompt(context.role);
    let conversation = buildAnthropicMessages(history, message);
    let lastTextResponse = '';

    for (let index = 0; index < 3; index += 1) {
        const response = await callAnthropicMessagesApi({
            system: systemPrompt,
            messages: conversation,
            tools: availableTools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            })),
        });

        const textBlocks = response.content.filter((block): block is AnthropicTextBlock => block.type === 'text');
        const toolUseBlocks = response.content.filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use');
        const currentText = textBlocks.map((block) => block.text).join('\n').trim();

        if (currentText) {
            lastTextResponse = currentText;
        }

        if (toolUseBlocks.length === 0) {
            return {
                answer: currentText || lastTextResponse || fallbackAnswer(context.role),
                tools_used: toolsUsed,
            };
        }

        const toolResults: AnthropicToolResultBlock[] = [];

        for (const block of toolUseBlocks) {
            const tool = availableToolMap.get(block.name as AssistantToolName);

            if (!tool) {
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify({ error: 'Ferramenta não autorizada para este perfil.' }),
                    is_error: true,
                });
                continue;
            }

            try {
                const result = await tool.execute(block.input ?? {}, {
                    userId: context.userId,
                    role: context.role,
                });

                if (!toolsUsed.includes(tool.name)) {
                    toolsUsed.push(tool.name);
                }
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            } catch (error) {
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify({
                        error: error instanceof Error ? error.message : 'Falha ao executar a ferramenta.',
                    }),
                    is_error: true,
                });
            }
        }

        conversation = [
            ...conversation,
            {
                role: 'assistant',
                content: response.content as AnthropicOutgoingBlock[],
            },
            {
                role: 'user',
                content: toolResults,
            },
        ];
    }

    return {
        answer: lastTextResponse || fallbackAnswer(context.role),
        tools_used: toolsUsed,
    };
}

async function runFallbackAssistant(context: AssistantContext, message: string): Promise<{
    answer: string;
    tools_used: string[];
}> {
    const normalized = message.toLowerCase();
    const tool = findFallbackAssistantToolDefinition(normalized, context.role);

    if (!tool) {
        return {
            answer: fallbackAnswer(context.role),
            tools_used: [],
        };
    }

    const input = tool.buildFallbackInput(normalized);
    const result = await tool.execute(input, {
        userId: context.userId,
        role: context.role,
    });

    return {
        answer: tool.formatFallbackResult(result, input, {
            userId: context.userId,
            role: context.role,
        }),
        tools_used: [tool.name],
    };
}

export async function runAssistant(context: AssistantContext): Promise<{
    answer: string;
    tools_used: string[];
    reply: string;
    usage: AssistantUsage;
}> {
    assertAssistantAvailable();

    const startedAt = Date.now();
    const history = normalizeMessageHistory(context.messages);
    const message = getLatestUserMessage(history, context.message);

    if (!message) {
        throw AppError.badRequest('Envie uma mensagem para o assistente.');
    }

    let result: {
        answer: string;
        tools_used: string[];
    };

    try {
        if (env().ANTHROPIC_API_KEY) {
            result = await runAnthropicAssistant(context, history, message);
        } else {
            result = await runFallbackAssistant(context, message);
        }
    } catch {
        result = await runFallbackAssistant(context, message);
    }

    const usage = buildAssistantUsage({
        message,
        history,
        answer: result.answer,
        latencyMs: Date.now() - startedAt,
    });

    await logAssistantUsage({
        userId: context.userId,
        role: context.role,
        toolsUsed: result.tools_used,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: usage.latencyMs,
    }).catch(() => undefined);

    return {
        answer: result.answer,
        reply: result.answer,
        tools_used: result.tools_used,
        usage,
    };
}
