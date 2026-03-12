import type { ReactNode } from 'react';
import { AssistantDock } from '@/components/layout/AssistantDock';
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
    return (
        <div className="flex h-screen overflow-hidden bg-canvas">
            <Sidebar
                companyName={companyName}
                logoUrl={logoUrl}
                pipelines={pipelines}
                userName={user.name}
                userRole={user.role}
            />
            <div className="ml-64 flex min-h-screen flex-1 flex-col">
                <Topbar userName={user.name} />
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>
            </div>
            <AssistantDock userRole={user.role} />
        </div>
    );
}
