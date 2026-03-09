import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildStoreCrmOrderNotes,
    buildStoreWhatsAppMessage,
    isStoreProductAvailable,
    normalizeStoreCustomerPhone,
    normalizeStoreSlug,
    resolveStorePriceCents,
} from './store.service.js';

test('normalizeStoreSlug creates stable slugs for public store entities', () => {
    assert.equal(normalizeStoreSlug('  Anel Solitário 18k  '), 'anel-solitario-18k');
    assert.equal(normalizeStoreSlug('Coleção Luxo / Ouro Branco'), 'colecao-luxo-ouro-branco');
});

test('resolveStorePriceCents prioritizes direct price over price from', () => {
    assert.equal(resolveStorePriceCents({ price_cents: 480000, price_from_cents: 350000 }), 480000);
    assert.equal(resolveStorePriceCents({ price_cents: null, price_from_cents: 350000 }), 350000);
    assert.equal(resolveStorePriceCents({ price_cents: null, price_from_cents: null }), null);
});

test('isStoreProductAvailable keeps custom products purchasable by WhatsApp', () => {
    assert.equal(isStoreProductAvailable({ is_custom: true, stock_quantity: 0 }), true);
    assert.equal(isStoreProductAvailable({ is_custom: false, stock_quantity: 2 }), true);
    assert.equal(isStoreProductAvailable({ is_custom: false, stock_quantity: 0 }), false);
});

test('buildStoreWhatsAppMessage interpolates the product template', () => {
    const message = buildStoreWhatsAppMessage(
        'Olá! Quero {{product_name}}. Veja: {{product_url}}',
        {
            product_name: 'Anel Solitário',
            product_url: 'https://loja.local/produto/anel-solitario',
        }
    );

    assert.equal(message, 'Olá! Quero Anel Solitário. Veja: https://loja.local/produto/anel-solitario');
});

test('normalizeStoreCustomerPhone sanitizes real phones and generates deterministic fallback', () => {
    assert.equal(normalizeStoreCustomerPhone('(11) 98888-7777', 'store-order-1'), '+5511988887777');
    assert.equal(normalizeStoreCustomerPhone('+55 21 97777-6666', 'store-order-2'), '+5521977776666');
    assert.equal(normalizeStoreCustomerPhone(undefined, 'c5b4085e-6d2c-4bcb-9fca-4dd7f7a12345'), '+5554085624947');
});

test('buildStoreCrmOrderNotes appends store source metadata without losing manual notes', () => {
    assert.equal(
        buildStoreCrmOrderNotes({
            storeOrderId: 'store-order-123',
            paymentId: 'payment-456',
            existingNotes: 'Cliente pediu embalagem premium.',
        }),
        'Cliente pediu embalagem premium.\n\nOrigem: Loja ORION\nStore order: store-order-123\nPagamento MP: payment-456'
    );

    assert.equal(
        buildStoreCrmOrderNotes({
            storeOrderId: 'store-order-789',
            paymentId: null,
            existingNotes: null,
        }),
        'Origem: Loja ORION\nStore order: store-order-789'
    );
});
