import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';
import {
    assertPublishablePipelineFlow,
    isPipelineVisibleForRole,
    normalizePipelineSlug,
} from './pipelines.service.js';

test('normalizePipelineSlug creates a stable slug from display names', () => {
    assert.equal(normalizePipelineSlug('  Pós Venda VIP  '), 'pos-venda-vip');
    assert.equal(normalizePipelineSlug('Pedidos / Produção'), 'pedidos-producao');
});

test('assertPublishablePipelineFlow rejects flows without nodes', () => {
    assert.throws(
        () => assertPublishablePipelineFlow({ nodes: [] }),
        (error: unknown) => error instanceof AppError && error.message.includes('ao menos um nó')
    );
});

test('assertPublishablePipelineFlow accepts minimal valid flow payload', () => {
    const flow = assertPublishablePipelineFlow({
        nodes: [{ id: 'node-1', type: 'lead-entry' }],
        connections: {},
    });

    assert.equal(flow.nodes.length, 1);
    assert.deepEqual(flow.connections, {});
});

test('isPipelineVisibleForRole hides inactive pipelines for non-admin users', () => {
    assert.equal(isPipelineVisibleForRole(false, 'ATENDENTE'), false);
    assert.equal(isPipelineVisibleForRole(true, 'ATENDENTE'), true);
    assert.equal(isPipelineVisibleForRole(false, 'ADMIN'), true);
});
