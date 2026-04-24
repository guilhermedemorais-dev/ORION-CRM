'use client';

import { useState, useEffect } from 'react';
import { Bell, Search, HelpCircle, LayoutGrid, Sparkles, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { HelpPanel } from '@/components/help/HelpPanel';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { useHelpContext } from '@/hooks/useHelpContext';

const routeLabels: Array<{ match: RegExp; label: string; section: string }> = [
    { match: /^\/pipeline\//, label: 'Pipeline', section: 'Operação comercial' },
    { match: /^\/inbox/, label: 'Inbox', section: 'Atendimento multicanal' },
    { match: /^\/financeiro/, label: 'Financeiro', section: 'Caixa e comissões' },
    { match: /^\/analytics/, label: 'Analytics', section: 'Leitura executiva' },
    { match: /^\/ajustes/, label: 'Ajustes', section: 'Configuração do sistema' },
    { match: /^\/settings\/loja/, label: 'Loja', section: 'Operação e-commerce' },
    { match: /^\/agenda/, label: 'Agenda', section: 'Gestão de horários' },
    { match: /^\/automacoes/, label: 'Automações', section: 'Workflows operativos' },
    { match: /^\/clientes/, label: 'Clientes', section: 'Base de contatos' },
    { match: /^\/dashboard/, label: 'Dashboard', section: 'Visão geral' },
    { match: /^\/estoque/, label: 'Estoque', section: 'Materiais e inventário' },
    { match: /^\/leads/, label: 'Leads', section: 'Captura comercial' },
    { match: /^\/pdv/, label: 'PDV', section: 'Frente de caixa' },
    { match: /^\/pedidos/, label: 'Pedidos', section: 'Gestão de vendas' },
    { match: /^\/producao/, label: 'Produção', section: 'Controle de bancada' },
];

function resolvePathMeta(pathname: string) {
    return routeLabels.find((item) => item.match.test(pathname)) ?? {
        label: 'CRM',
        section: 'Painel operacional',
    };
}

export function Topbar({
    userName,
    onMenuClick,
}: {
    userName: string;
    onMenuClick: () => void;
}) {
    const pathname = usePathname();
    const meta = resolvePathMeta(pathname);
    const [helpOpen, setHelpOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const helpContext = useHelpContext();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
        <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] px-6 lg:px-7 gap-4">
            {/* Left: section + page label */}
            <div className="flex min-w-0 flex-1">
                <button
                    type="button"
                    onClick={onMenuClick}
                    className="mr-3 flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-secondary)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)] lg:hidden"
                    aria-label="Abrir menu de navegação"
                >
                    <Menu className="h-4 w-4" />
                </button>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">
                        {meta.section}
                    </p>
                    <p className="truncate text-[12px] font-medium text-[color:var(--orion-text)]">{meta.label}</p>
                </div>
            </div>

            {/* Center: search bar */}
            <div className="flex flex-[2] items-center justify-center">
                <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="flex h-9 w-full max-w-2xl items-center gap-3 rounded-md border border-[color:var(--orion-border-sub)] bg-[color:var(--orion-base)] px-3 text-[12px] text-[color:var(--orion-text-secondary)] outline-none transition-colors hover:bg-[color:var(--orion-hover)]"
                    title="Busca global (Cmd+K)"
                >
                    <LayoutGrid className="h-4 w-4 text-[color:var(--orion-text-muted)]" />
                    <span className="flex-1 text-left text-[12px] font-medium">Pesquise no sistema</span>
                    <div className="flex items-center text-[color:var(--orion-text-secondary)]">
                        <Search className="h-4 w-4" />
                    </div>
                </button>
            </div>

            {/* Right: actions */}
            <div className="flex flex-1 items-center justify-end gap-2">
                {/* Help button */}
                <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    title="Ajuda"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-secondary)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]"
                    aria-label="Ajuda"
                >
                    <HelpCircle className="h-4 w-4" />
                </button>
                {/* Notifications */}
                <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-secondary)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]"
                    aria-label="Notificações"
                >
                    <Bell className="h-4 w-4" />
                </button>
                {/* AI Assistant */}
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('toggle-ai-assistant'))}
                    className="ml-1 flex h-8 items-center gap-2 rounded-md border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-gold-bg)] px-3 text-[11px] font-bold text-[color:var(--orion-gold)] outline-none transition-colors duration-120 hover:bg-[color:rgba(191,160,106,0.14)] hover:border-[color:rgba(191,160,106,0.35)]"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Pergunte
                </button>
            </div>
        </header>
        {helpOpen && <HelpPanel context={helpContext} onClose={() => setHelpOpen(false)} />}
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
