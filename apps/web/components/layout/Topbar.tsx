'use client';

import { useState, useEffect } from 'react';
import { Bell, Search, HelpCircle, LayoutGrid, Sparkles } from 'lucide-react';
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

export function Topbar({ userName }: { userName: string }) {
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
        <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-white/5 bg-[color:var(--orion-nav)] px-5 lg:px-7 gap-4">
            <div className="flex min-w-0 flex-1">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">
                        {meta.section}
                    </p>
                    <p className="truncate text-sm font-medium text-[color:var(--orion-text)]">{meta.label}</p>
                </div>
            </div>

            <div className="flex flex-[2] items-center justify-center">
                <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="flex h-11 w-full max-w-2xl items-center gap-3 rounded-full border border-white/5 bg-white/5 px-4 text-sm text-gray-400 outline-none transition hover:bg-white/10"
                    title="Busca global (Cmd+K)"
                >
                    <LayoutGrid className="h-4 w-4 text-gray-500" />
                    <span className="flex-1 text-left text-[15px] font-medium">Pesquise no sistema</span>
                    <div className="flex items-center text-gray-400">
                        <Search className="h-4 w-4 text-white" />
                    </div>
                </button>
            </div>

            <div className="flex flex-1 items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    title="Ajuda"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)] transition hover:border-[color:var(--orion-gold-border)] hover:text-[color:var(--orion-gold)]"
                    aria-label="Ajuda"
                >
                    <HelpCircle className="h-[18px] w-[18px]" />
                </button>
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)] transition hover:text-[color:var(--orion-text)]"
                    aria-label="Notificações"
                >
                    <Bell className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('toggle-ai-assistant'))}
                    className="hidden sm:flex items-center gap-2 rounded-full border-2 border-transparent bg-clip-padding px-5 py-2 text-sm font-semibold tracking-wide text-brand-gold transition hover:scale-105 active:scale-95"
                    style={{
                        background: 'linear-gradient(#111111, #111111) padding-box, linear-gradient(to right, #D4AF37, #F5D061, #C5A028) border-box',
                    }}
                >
                    <Sparkles className="h-4 w-4" />
                    Pergunte
                </button>
            </div>
        </header>
        {helpOpen && <HelpPanel context={helpContext} onClose={() => setHelpOpen(false)} />}
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
