import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

interface AssistantContext {
    userId: string;
    role: UserRole;
    message: string;
}

function assertAssistantAvailable(): void {
    if (!env().OPENAI_API_KEY) {
        throw AppError.serviceUnavailable(
            'AI_UNAVAILABLE',
            'Assistente temporariamente indisponível.'
        );
    }
}

async function getMyLeadsCount(userId: string): Promise<number> {
    const result = await query<{ total: string }>(
        'SELECT COUNT(*)::text AS total FROM leads WHERE assigned_to = $1',
        [userId]
    );

    return Number(result.rows[0]?.total ?? '0');
}

async function getMyOrdersCount(userId: string): Promise<number> {
    const result = await query<{ total: string }>(
        'SELECT COUNT(*)::text AS total FROM orders WHERE assigned_to = $1',
        [userId]
    );

    return Number(result.rows[0]?.total ?? '0');
}

async function getFinancialSummary(): Promise<{ inCents: number; outCents: number; balanceCents: number }> {
    const result = await query<{ in_total: string; out_total: string; balance_total: string }>(
        `SELECT
            COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_cents ELSE 0 END), 0)::text AS in_total,
            COALESCE(SUM(CASE WHEN type = 'SAIDA' THEN amount_cents ELSE 0 END), 0)::text AS out_total,
            COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_cents ELSE -amount_cents END), 0)::text AS balance_total
         FROM financial_entries
         WHERE date_trunc('month', competence_date) = date_trunc('month', CURRENT_DATE)`
    );

    return {
        inCents: Number(result.rows[0]?.in_total ?? '0'),
        outCents: Number(result.rows[0]?.out_total ?? '0'),
        balanceCents: Number(result.rows[0]?.balance_total ?? '0'),
    };
}

async function getProductionSummary(userId: string): Promise<{ active: number; overdue: number }> {
    const [active, overdue] = await Promise.all([
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
    ]);

    return {
        active: Number(active.rows[0]?.total ?? '0'),
        overdue: Number(overdue.rows[0]?.total ?? '0'),
    };
}

function messageIncludes(message: string, terms: string[]): boolean {
    const normalized = message.toLowerCase();
    return terms.some((term) => normalized.includes(term));
}

export async function runAssistant(context: AssistantContext): Promise<{
    answer: string;
    tools_used: string[];
}> {
    assertAssistantAvailable();

    const toolsUsed: string[] = [];
    const message = context.message.trim();

    if (!message) {
        throw AppError.badRequest('Envie uma mensagem para o assistente.');
    }

    if (messageIncludes(message, ['financeiro', 'faturamento', 'entrou', 'saldo', 'despesa'])) {
        if (!['ADMIN', 'FINANCEIRO'].includes(context.role)) {
            return {
                answer: 'Este perfil não pode acessar dados financeiros globais.',
                tools_used: [],
            };
        }

        const summary = await getFinancialSummary();
        toolsUsed.push('getFinancialSummary');

        return {
            answer: `Resumo financeiro do mês: entradas ${summary.inCents} centavos, saídas ${summary.outCents} centavos, saldo ${summary.balanceCents} centavos.`,
            tools_used: toolsUsed,
        };
    }

    if (messageIncludes(message, ['lead', 'leads'])) {
        if (!['ADMIN', 'ATENDENTE'].includes(context.role)) {
            return {
                answer: 'Este perfil não pode consultar leads.',
                tools_used: [],
            };
        }

        const total = context.role === 'ADMIN'
            ? Number((await query<{ total: string }>('SELECT COUNT(*)::text AS total FROM leads')).rows[0]?.total ?? '0')
            : await getMyLeadsCount(context.userId);
        toolsUsed.push(context.role === 'ADMIN' ? 'getAllLeadsCount' : 'getMyLeads');

        return {
            answer: `Existem ${total} lead(s) no escopo disponível para este usuário.`,
            tools_used: toolsUsed,
        };
    }

    if (messageIncludes(message, ['pedido', 'pedidos'])) {
        if (!['ADMIN', 'ATENDENTE', 'FINANCEIRO'].includes(context.role)) {
            return {
                answer: 'Este perfil não pode consultar pedidos comerciais.',
                tools_used: [],
            };
        }

        const total = context.role === 'ADMIN' || context.role === 'FINANCEIRO'
            ? Number((await query<{ total: string }>('SELECT COUNT(*)::text AS total FROM orders')).rows[0]?.total ?? '0')
            : await getMyOrdersCount(context.userId);
        toolsUsed.push(context.role === 'ATENDENTE' ? 'getMyOrders' : 'getAllOrdersCount');

        return {
            answer: `Existem ${total} pedido(s) no escopo disponível para este usuário.`,
            tools_used: toolsUsed,
        };
    }

    if (messageIncludes(message, ['produção', 'producao', 'ordem'])) {
        if (!['ADMIN', 'PRODUCAO'].includes(context.role)) {
            return {
                answer: 'Este perfil não pode consultar a fila de produção.',
                tools_used: [],
            };
        }

        const summary = context.role === 'PRODUCAO'
            ? await getProductionSummary(context.userId)
            : {
                active: Number((await query<{ total: string }>(
                    `SELECT COUNT(*)::text AS total
                     FROM production_orders
                     WHERE status IN ('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA')`
                )).rows[0]?.total ?? '0'),
                overdue: Number((await query<{ total: string }>(
                    `SELECT COUNT(*)::text AS total
                     FROM production_orders
                     WHERE deadline IS NOT NULL
                       AND deadline < NOW()
                       AND status != 'CONCLUIDA'`
                )).rows[0]?.total ?? '0'),
            };

        toolsUsed.push('getProductionSummary');

        return {
            answer: `Produção: ${summary.active} ordem(ns) ativa(s) e ${summary.overdue} atrasada(s) no escopo disponível.`,
            tools_used: toolsUsed,
        };
    }

    return {
        answer: 'Posso ajudar com leads, pedidos, produção e financeiro dentro do escopo permitido para o seu perfil.',
        tools_used: [],
    };
}
