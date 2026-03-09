import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildFinanceBarSeries,
    buildFinancePieSeries,
    calculateDeltaPercent,
    resolveFinancePeriodRange,
} from './financeiro.service.js';

test('resolveFinancePeriodRange returns month bounds with previous comparison window', () => {
    const range = resolveFinancePeriodRange('mes', new Date('2026-03-09T10:00:00-03:00'));

    assert.equal(range.current_start, '2026-03-01');
    assert.equal(range.current_end_exclusive, '2026-04-01');
    assert.equal(range.previous_start, '2026-02-01');
    assert.equal(range.previous_end_exclusive, '2026-03-01');
});

test('calculateDeltaPercent handles empty previous windows without infinity', () => {
    assert.equal(calculateDeltaPercent(0, 0), 0);
    assert.equal(calculateDeltaPercent(150_000, 0), 100);
    assert.equal(calculateDeltaPercent(80_000, 100_000), -20);
});

test('buildFinanceBarSeries groups annual data by month', () => {
    const result = buildFinanceBarSeries(
        [
            { type: 'ENTRADA', amount_cents: 120_000, competence_date: '2026-01-10' },
            { type: 'SAIDA', amount_cents: 30_000, competence_date: '2026-01-15' },
            { type: 'ENTRADA', amount_cents: 90_000, competence_date: '2026-02-03' },
        ],
        'ano',
        '2026-01-01'
    );

    assert.equal(result.length, 2);
    assert.equal(result[0]?.receitas_cents, 120_000);
    assert.equal(result[0]?.despesas_cents, 30_000);
    assert.equal(result[1]?.receitas_cents, 90_000);
});

test('buildFinancePieSeries calculates expense percentages by category', () => {
    const result = buildFinancePieSeries([
        { type: 'SAIDA', amount_cents: 40_000, category: 'MATERIAIS' },
        { type: 'SAIDA', amount_cents: 10_000, category: 'MARKETING' },
        { type: 'ENTRADA', amount_cents: 70_000, category: 'VENDAS_BALCAO' },
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0]?.categoria, 'Materiais');
    assert.equal(result[0]?.percentual, 80);
    assert.equal(result[1]?.categoria, 'Marketing');
    assert.equal(result[1]?.percentual, 20);
});
