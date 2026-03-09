import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildStoreWhatsAppMessage,
    isStoreProductAvailable,
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
