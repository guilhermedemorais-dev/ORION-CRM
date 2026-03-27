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

    return (
        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${isFullBleed ? 'p-0' : 'p-6'}`}>
            {children}
        </main>
    );
}
