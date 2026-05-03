'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, HelpCircle, Sparkles } from 'lucide-react';
import { AssistantDock } from '@/components/layout/AssistantDock';
import { MainWrapper } from '@/components/layout/MainWrapper';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import type { PipelineRecord } from '@/lib/api';

const AI_ENABLED = process.env.NEXT_PUBLIC_ORION_AI_ENABLED !== 'false';
const mobileUtilityFabClassName =
    'flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] text-[color:var(--orion-text-secondary)] shadow-[0_12px_30px_rgba(0,0,0,0.28)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]';

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
            <div className="fixed bottom-4 right-4 z-40 lg:hidden">
                <div className="flex flex-col items-end gap-3">
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-help-panel'))}
                        title="Ajuda"
                        aria-label="Abrir ajuda"
                        className={mobileUtilityFabClassName}
                    >
                        <HelpCircle className="h-4.5 w-4.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('toggle-topbar-notifications'))}
                        title="Notificações"
                        aria-label="Abrir notificações"
                        className={mobileUtilityFabClassName}
                    >
                        <Bell className="h-4.5 w-4.5" />
                    </button>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (AI_ENABLED) {
                                    window.dispatchEvent(new CustomEvent('toggle-ai-assistant'));
                                }
                            }}
                            disabled={!AI_ENABLED}
                            title={AI_ENABLED ? 'Assistente IA (Ctrl+J)' : 'Assistente temporariamente indisponível'}
                            aria-label="Abrir assistente IA"
                            className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-[0_16px_40px_rgba(0,0,0,0.35)] outline-none transition-colors duration-120 ${
                                AI_ENABLED
                                    ? 'border-[color:var(--orion-border-mid)] bg-[color:var(--orion-gold-bg)] text-[color:var(--orion-gold)] hover:bg-[color:rgba(191,160,106,0.14)] hover:border-[color:rgba(191,160,106,0.35)]'
                                    : 'cursor-not-allowed border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] text-[color:var(--orion-text-muted)] opacity-70'
                            }`}
                        >
                            <Sparkles className="h-5 w-5" />
                        </button>
                        {!AI_ENABLED && (
                            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wide text-black">
                                manutenção
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <AssistantDock userName={user.name} userRole={user.role} />
        </div>
    );
}
