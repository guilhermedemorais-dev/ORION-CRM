'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { AssistantDock } from '@/components/layout/AssistantDock';
import { MainWrapper } from '@/components/layout/MainWrapper';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import type { PipelineRecord } from '@/lib/api';

export function AppShell({
    children,
    companyName,
    logoUrl,
    pipelines,
    user,
}: {
    children: ReactNode;
    companyName: string;
    logoUrl: string | null;
    pipelines: PipelineRecord[];
    user: {
        name: string;
        role: string;
    };
}) {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[color:var(--orion-void)]" style={{ fontFamily: 'var(--font-orion-sans)' }}>
            <Sidebar
                companyName={companyName}
                logoUrl={logoUrl}
                pipelines={pipelines}
                userName={user.name}
                userRole={user.role}
                mobileOpen={mobileSidebarOpen}
                onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            {mobileSidebarOpen ? (
                <button
                    type="button"
                    aria-label="Fechar menu lateral"
                    className="fixed inset-0 z-30 bg-black/60 lg:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            ) : null}
            <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[color:var(--orion-void)] lg:ml-[220px]">
                <Topbar userName={user.name} onMenuClick={() => setMobileSidebarOpen((prev) => !prev)} />
                <MainWrapper>{children}</MainWrapper>
            </div>
            <AssistantDock userName={user.name} userRole={user.role} />
        </div>
    );
}
