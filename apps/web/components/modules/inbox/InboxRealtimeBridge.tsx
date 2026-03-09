'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function InboxRealtimeBridge() {
    const router = useRouter();
    const refreshTimerRef = useRef<number | null>(null);

    useEffect(() => {
        const source = new EventSource('/api/internal/inbox/stream');

        const scheduleRefresh = () => {
            if (refreshTimerRef.current !== null) {
                window.clearTimeout(refreshTimerRef.current);
            }

            refreshTimerRef.current = window.setTimeout(() => {
                router.refresh();
                refreshTimerRef.current = null;
            }, 250);
        };

        const handleInboxEvent = () => {
            if (document.visibilityState === 'visible') {
                scheduleRefresh();
            }
        };

        source.addEventListener('conversation.created', handleInboxEvent);
        source.addEventListener('conversation.updated', handleInboxEvent);
        source.addEventListener('message.created', handleInboxEvent);

        return () => {
            source.removeEventListener('conversation.created', handleInboxEvent);
            source.removeEventListener('conversation.updated', handleInboxEvent);
            source.removeEventListener('message.created', handleInboxEvent);
            source.close();

            if (refreshTimerRef.current !== null) {
                window.clearTimeout(refreshTimerRef.current);
            }
        };
    }, [router]);

    return null;
}
