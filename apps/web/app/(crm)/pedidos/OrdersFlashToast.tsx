'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

type FlashType = 'success' | 'error';

export function OrdersFlashToast({
    initialMessage,
    initialType,
}: {
    initialMessage?: string;
    initialType?: FlashType;
}) {
    const [toast, setToast] = useState(
        initialMessage
            ? {
                message: initialMessage,
                type: initialType ?? 'error',
            }
            : null
    );
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!initialMessage) {
            return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.delete('notice');
        params.delete('noticeType');
        params.delete('error');
        const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.replace(nextUrl, { scroll: false });
    }, [initialMessage, pathname, router, searchParams]);

    useEffect(() => {
        if (!toast) {
            return;
        }

        const timer = window.setTimeout(() => setToast(null), 4500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    if (!toast) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:top-6">
            <div
                role="status"
                aria-live="polite"
                className={cn(
                    'pointer-events-auto flex w-full max-w-md items-start justify-between gap-3 rounded-lg border px-4 py-3 shadow-lg sm:w-[360px]',
                    toast.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-900'
                )}
            >
                <p className="text-sm leading-5">{toast.message}</p>
                <button
                    type="button"
                    onClick={() => setToast(null)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-current/70 transition hover:bg-black/5 hover:text-current"
                >
                    Fechar
                </button>
            </div>
        </div>
    );
}
