import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSalesTimeline,
    calculateAnalyticsDelta,
    resolveAnalyticsPeriodRange,
} from './analytics.service.js';

test('resolveAnalyticsPeriodRange returns rolling 30d window with previous comparison', () => {
    const range = resolveAnalyticsPeriodRange('30d', undefined, undefined, new Date('2026-03-09T10:00:00-03:00'));

    assert.equal(range.current_start, '2026-02-08');
    assert.equal(range.current_end_exclusive, '2026-03-10');
    assert.equal(range.previous_start, '2026-01-09');
    assert.equal(range.previous_end_exclusive, '2026-02-08');
    assert.equal(range.bucket, 'day');
});

test('resolveAnalyticsPeriodRange validates custom windows', () => {
    const range = resolveAnalyticsPeriodRange('custom', '2026-02-01', '2026-02-10');

    assert.equal(range.current_start, '2026-02-01');
    assert.equal(range.current_end_exclusive, '2026-02-11');
    assert.equal(range.previous_start, '2026-01-22');
    assert.equal(range.previous_end_exclusive, '2026-02-01');
});

test('calculateAnalyticsDelta handles empty comparison baselines', () => {
    assert.equal(calculateAnalyticsDelta(0, 0), 0);
    assert.equal(calculateAnalyticsDelta(120_000, 0), 100);
    assert.equal(calculateAnalyticsDelta(80_000, 100_000), -20);
});

test('buildSalesTimeline aligns current and previous buckets by index', () => {
    const range = resolveAnalyticsPeriodRange('7d', undefined, undefined, new Date('2026-03-09T10:00:00-03:00'));
    const result = buildSalesTimeline([
        { bucket: '2026-03-03', scope: 'current', revenue_cents: '1000', orders_count: '1' },
        { bucket: '2026-03-04', scope: 'current', revenue_cents: '1500', orders_count: '2' },
        { bucket: '2026-02-24', scope: 'previous', revenue_cents: '400', orders_count: '1' },
        { bucket: '2026-02-25', scope: 'previous', revenue_cents: '900', orders_count: '1' },
    ], range);

    assert.equal(result.length, 7);
    assert.equal(result[0]?.current_cents, 1000);
    assert.equal(result[0]?.previous_cents, 400);
    assert.equal(result[1]?.current_cents, 1500);
    assert.equal(result[1]?.previous_cents, 900);
});
