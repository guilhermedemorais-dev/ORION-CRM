import test from 'node:test';
import assert from 'node:assert/strict';
import { getAutomationCatalog } from './automation-catalog.service.js';

test('getAutomationCatalog returns the curated builder groups with items', () => {
    const groups = getAutomationCatalog();

    assert.equal(groups.length, 3);
    assert.deepEqual(groups.map((group) => group.key), ['triggers', 'actions', 'control']);
    assert.ok(groups.every((group) => group.items.length > 0));
    assert.equal(groups[0]?.items[0]?.label, 'Nova Mensagem WhatsApp');
});
