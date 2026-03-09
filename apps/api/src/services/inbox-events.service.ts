import { EventEmitter } from 'node:events';

export type InboxRealtimeEventType =
    | 'conversation.created'
    | 'conversation.updated'
    | 'message.created';

export interface InboxRealtimeEvent {
    type: InboxRealtimeEventType;
    conversationId: string;
    at: string;
    source: 'inbound' | 'outbound' | 'system';
}

type InboxRealtimeListener = (event: InboxRealtimeEvent) => void;

const inboxEvents = new EventEmitter();
inboxEvents.setMaxListeners(0);

export function publishInboxEvent(event: Omit<InboxRealtimeEvent, 'at'>): void {
    inboxEvents.emit('event', {
        ...event,
        at: new Date().toISOString(),
    } satisfies InboxRealtimeEvent);
}

export function subscribeInboxEvents(listener: InboxRealtimeListener): () => void {
    inboxEvents.on('event', listener);

    return () => {
        inboxEvents.off('event', listener);
    };
}
