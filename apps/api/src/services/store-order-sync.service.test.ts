import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSimulatedStorePaymentPayload,
    canSimulateStorePayments,
} from './store-order-sync.service.js';

test('canSimulateStorePayments blocks production and allows non-production envs', () => {
    assert.equal(canSimulateStorePayments('production'), false);
    assert.equal(canSimulateStorePayments('development'), true);
    assert.equal(canSimulateStorePayments('test'), true);
});

test('buildSimulatedStorePaymentPayload creates deterministic local approval payload', () => {
    assert.deepEqual(
        buildSimulatedStorePaymentPayload({
            storeOrderId: 'store-order-123',
            amountCents: 259900,
            now: new Date('2026-03-09T14:30:00.000Z'),
        }),
        {
            paymentId: 'sim_store-order-123_1773066600000',
            status: 'approved',
            amountCents: 259900,
            paymentMethod: 'simulated-link',
            orderId: 'store-order-123',
        }
    );
});
