'use client';

import { useEffect } from 'react';

const REPORT_ENDPOINT = '/api/internal/system/errors/report';
const SEEN = new Set<string>();
const MAX_SEEN = 100;

function fingerprint(message: string, stack?: string): string {
    return `${message.slice(0, 120)}::${(stack ?? '').slice(0, 200)}`;
}

async function report(payload: {
    message: string;
    stack?: string | null;
    path?: string | null;
    statusCode?: number | null;
    method?: string | null;
    severity?: 'error' | 'fatal' | 'warn';
}): Promise<void> {
    const fp = fingerprint(payload.message, payload.stack ?? undefined);
    if (SEEN.has(fp)) return;
    SEEN.add(fp);
    if (SEEN.size > MAX_SEEN) {
        const first = SEEN.values().next().value;
        if (first) SEEN.delete(first);
    }
    try {
        await fetch(REPORT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: payload.message,
                stack: payload.stack ?? null,
                path: payload.path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
                statusCode: payload.statusCode ?? null,
                method: payload.method ?? null,
                severity: payload.severity ?? 'error',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            }),
            keepalive: true,
        });
    } catch {
        // swallow — we don't want the reporter itself to throw.
    }
}

export default function ClientErrorReporter(): null {
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            void report({
                message: event.message || event.error?.message || 'window.onerror',
                stack: event.error?.stack ?? null,
            });
        };

        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message = reason instanceof Error ? reason.message : String(reason ?? 'unhandledrejection');
            const stack = reason instanceof Error ? reason.stack ?? null : null;
            void report({ message, stack });
        };

        const originalFetch = window.fetch.bind(window);
        const wrappedFetch: typeof window.fetch = async (input, init) => {
            const response = await originalFetch(input, init);
            if (response.status >= 500) {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                            ? input.toString()
                            : (input as Request).url;
                let body = '';
                try {
                    body = await response.clone().text();
                } catch {
                    // ignore
                }
                void report({
                    message: `HTTP ${response.status} on ${init?.method ?? 'GET'} ${url} — ${body.slice(0, 500)}`,
                    path: url,
                    method: init?.method ?? 'GET',
                    statusCode: response.status,
                });
            }
            return response;
        };
        window.fetch = wrappedFetch;

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            window.fetch = originalFetch;
        };
    }, []);

    return null;
}
