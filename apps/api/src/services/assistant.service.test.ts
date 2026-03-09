import assert from 'node:assert/strict';
import test from 'node:test';

process.env['NODE_ENV'] ??= 'test';
process.env['DATABASE_URL'] ??= 'postgres://postgres:postgres@localhost:5432/orion_test';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';
process.env['JWT_SECRET'] ??= 'jwt-secret-jwt-secret-jwt-secret-1234';
process.env['JWT_REFRESH_SECRET'] ??= 'jwt-refresh-secret-jwt-refresh-secret-1234';
process.env['OPERATOR_WEBHOOK_SECRET'] ??= 'operator-webhook-secret-operator-1234';
process.env['APP_URL'] ??= 'http://localhost:3000';
process.env['FRONTEND_URL'] ??= 'http://localhost:3000';

async function loadAssistantModule() {
    const module = await import('./assistant.service.js');
    return (module.default ?? module) as typeof import('./assistant.service.js');
}

test('getAvailableAssistantToolNames respects role-based access', async () => {
    const { getAvailableAssistantToolNames } = await loadAssistantModule();

    assert.deepEqual(
        getAvailableAssistantToolNames('ATENDENTE'),
        ['getLeadsStats', 'getMyLeads', 'getOrdersStats', 'getPendingOrders', 'getCommissions']
    );

    assert.equal(getAvailableAssistantToolNames('PRODUCAO').includes('getFinancialSummary'), false);
    assert.equal(getAvailableAssistantToolNames('ADMIN').includes('getStockAlerts'), true);
});

test('periodToSqlInterval supports quarter queries', async () => {
    const { periodToSqlInterval } = await loadAssistantModule();

    assert.equal(periodToSqlInterval('today'), '1 day');
    assert.equal(periodToSqlInterval('week'), '7 days');
    assert.equal(periodToSqlInterval('month'), '30 days');
    assert.equal(periodToSqlInterval('quarter'), '90 days');
});

test('selectFallbackAssistantTool picks the right tool for typical prompts', async () => {
    const { selectFallbackAssistantTool } = await loadAssistantModule();

    assert.equal(selectFallbackAssistantTool('Como está o financeiro este mês?', 'FINANCEIRO'), 'getFinancialSummary');
    assert.equal(selectFallbackAssistantTool('Quais são meus leads?', 'ATENDENTE'), 'getMyLeads');
    assert.equal(selectFallbackAssistantTool('Tem alerta de estoque?', 'ADMIN'), 'getStockAlerts');
    assert.equal(selectFallbackAssistantTool('Qual a fila de produção atrasada?', 'PRODUCAO'), 'getProductionOrders');
});

test('resolveCommissionTargetUserId enforces RBAC for commission queries', async () => {
    const { resolveCommissionTargetUserId } = await loadAssistantModule();

    assert.equal(resolveCommissionTargetUserId('target-user', 'current-user', 'ATENDENTE'), 'current-user');
    assert.equal(resolveCommissionTargetUserId(undefined, 'current-user', 'ATENDENTE'), 'current-user');
    assert.equal(resolveCommissionTargetUserId('target-user', 'current-user', 'ADMIN'), 'target-user');
    assert.equal(resolveCommissionTargetUserId(undefined, 'current-user', 'FINANCEIRO'), undefined);
});

test('buildAnthropicMessages avoids duplicating the latest user message', async () => {
    const { buildAnthropicMessages } = await loadAssistantModule();

    const history = [
        { role: 'assistant' as const, content: 'Como posso ajudar?' },
        { role: 'user' as const, content: 'Quero ver meus leads' },
    ];

    assert.deepEqual(
        buildAnthropicMessages(history, 'Quero ver meus leads'),
        history
    );

    assert.deepEqual(
        buildAnthropicMessages(history, 'E os pedidos?'),
        [...history, { role: 'user' as const, content: 'E os pedidos?' }]
    );
});

test('buildAssistantUsage returns token estimates and latency payload', async () => {
    const { buildAssistantUsage } = await loadAssistantModule();

    assert.deepEqual(
        buildAssistantUsage({
            message: 'Quantos leads novos hoje?',
            history: [{ role: 'assistant', content: 'Posso ajudar.' }],
            answer: 'Hoje chegaram 8 leads novos.',
            latencyMs: 420,
        }),
        {
            inputTokens: 10,
            outputTokens: 7,
            latencyMs: 420,
        }
    );
});
