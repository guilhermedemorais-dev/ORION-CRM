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
    return (
        <div className="flex h-screen overflow-hidden bg-canvas">
            <Sidebar
                companyName={companyName}
                logoUrl={logoUrl}
                pipelines={pipelines}
                userName={user.name}
                userRole={user.role}
            />
            <div className="ml-64 flex min-h-screen min-w-0 flex-1 flex-col">
                <Topbar userName={user.name} />
                <MainWrapper>{children}</MainWrapper>
            </div>
            <AssistantDock userRole={user.role} />
        </div>
    );
}
