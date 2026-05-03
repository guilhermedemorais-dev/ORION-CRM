'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function MainWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    
    // Define routes that should be full-bleed (no padding)
    const isFullBleed =
        pathname.startsWith('/clientes/') ||
        pathname.startsWith('/leads/') ||
        pathname === '/dashboard';

    // Inbox and Agenda manage their own internal scroll — prevent main from scrolling
    const isNoScroll = pathname === '/inbox' || pathname === '/agenda';

    return (
        <main className={`min-h-0 flex-1 overflow-x-hidden ${isNoScroll ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'} ${isFullBleed ? 'p-0' : 'p-6'}`}>
            {children}
        </main>
    );
}
