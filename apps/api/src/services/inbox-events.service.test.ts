import test from 'node:test';
import assert from 'node:assert/strict';
import { publishInboxEvent, subscribeInboxEvents } from './inbox-events.service.js';

test('publishInboxEvent broadcasts payloads to subscribers', async () => {
    await new Promise<void>((resolve, reject) => {
        const unsubscribe = subscribeInboxEvents((event) => {
            try {
                assert.equal(event.type, 'message.created');
                assert.equal(event.conversationId, 'conversation-1');
                assert.equal(event.source, 'inbound');
                assert.ok(event.at.length > 0);
                unsubscribe();
                resolve();
            } catch (error) {
                unsubscribe();
                reject(error);
            }
        });

        publishInboxEvent({
            type: 'message.created',
            conversationId: 'conversation-1',
            source: 'inbound',
        });
    });
});
