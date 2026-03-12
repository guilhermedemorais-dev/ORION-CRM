'use client';

import { Bell, Command, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

const routeLabels: Array<{ match: RegExp; label: string; section: string }> = [
    { match: /^\/pipeline\//, label: 'Pipeline', section: 'Operação comercial' },
    { match: /^\/inbox/, label: 'Inbox', section: 'Atendimento multicanal' },
    { match: /^\/financeiro/, label: 'Financeiro', section: 'Caixa e comissões' },
    { match: /^\/analytics/, label: 'Analytics', section: 'Leitura executiva' },
    { match: /^\/ajustes/, label: 'Ajustes', section: 'Configuração do sistema' },
    { match: /^\/settings\/loja/, label: 'Loja', section: 'Operação e-commerce' },
];

function resolvePathMeta(pathname: string) {
    return routeLabels.find((item) => item.match.test(pathname)) ?? {
        label: 'CRM',
        section: 'Painel operacional',
    };
}

export function Topbar({ userName }: { userName: string }) {
    const pathname = usePathname();
    const meta = resolvePathMeta(pathname);

    return (
        <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-white/5 bg-[color:var(--orion-nav)] px-5 lg:px-7">
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">
                    {meta.section}
                </p>
                <p className="truncate text-sm font-medium text-[color:var(--orion-text)]">{meta.label}</p>
            </div>

            <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[color:var(--orion-text-secondary)] lg:flex">
                    <Search className="h-3.5 w-3.5" />
                    <span>Busca global</span>
                    <span className="rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--orion-text-muted)]">
                        <Command className="mr-1 inline h-3 w-3" />
                        K
                    </span>
                </div>
                <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)] transition hover:text-[color:var(--orion-text)]"
                    aria-label="Notificações"
                >
                    <Bell className="h-4 w-4" />
                </button>
                <div className="rounded-full border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                    {userName}
                </div>
            </div>
        </header>
    );
}
