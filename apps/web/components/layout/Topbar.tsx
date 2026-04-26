'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Search, HelpCircle, LayoutGrid, Sparkles, Menu, X } from 'lucide-react';
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
    { match: /^\/agenda/, label: 'Agenda', section: 'Agenda' },
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

/* TASK-009: AI availability check via env var.
 * Set NEXT_PUBLIC_ORION_AI_ENABLED=false in .env to show maintenance badge. */
const AI_ENABLED = process.env.NEXT_PUBLIC_ORION_AI_ENABLED !== 'false';

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
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const helpContext = useHelpContext();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setNotifOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    /* TASK-007: Close notification panel on outside click */
    useEffect(() => {
        if (!notifOpen) return;
        function handleClickOutside(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [notifOpen]);

    return (
        <>
        <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] px-6 lg:px-7 gap-4">
            {/* Left: section + page label */}
            <div className="flex min-w-0 flex-1">
                <button
                    type="button"
                    onClick={onMenuClick}
                    className="mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-secondary)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)] lg:hidden"
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
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-secondary)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)] lg:h-8 lg:w-8 lg:min-h-0 lg:min-w-0"
                    aria-label="Ajuda"
                >
                    <HelpCircle className="h-4 w-4" />
                </button>

                {/* TASK-007: Notifications with dropdown panel */}
                <div className="relative" ref={notifRef}>
                    <button
                        type="button"
                        onClick={() => setNotifOpen((prev) => !prev)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-secondary)] outline-none transition-colors duration-120 hover:border-[color:var(--orion-border-mid)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)] lg:h-8 lg:w-8 lg:min-h-0 lg:min-w-0"
                        aria-label="Notificações"
                        aria-haspopup="true"
                        aria-expanded={notifOpen}
                    >
                        <Bell className="h-4 w-4" />
                    </button>

                    {notifOpen && (
                        <div
                            role="dialog"
                            aria-label="Painel de notificações"
                            className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-[color:var(--orion-border-low)] px-4 py-3">
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--orion-text-muted)]">Notificações</span>
                                <button
                                    type="button"
                                    onClick={() => setNotifOpen(false)}
                                    className="flex h-6 w-6 items-center justify-center rounded text-[color:var(--orion-text-muted)] hover:text-[color:var(--orion-text)]"
                                    aria-label="Fechar notificações"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                                <Bell className="mb-3 h-8 w-8 text-[color:var(--orion-text-muted)] opacity-30" />
                                <p className="text-[12px] font-medium text-[color:var(--orion-text-secondary)]">Nenhuma notificação</p>
                                <p className="mt-1 text-[11px] text-[color:var(--orion-text-muted)]">Você está em dia com tudo.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* TASK-009: AI Assistant with maintenance badge when unavailable */}
                <div className="relative ml-1">
                    <button
                        type="button"
                        onClick={() => {
                            if (AI_ENABLED) {
                                window.dispatchEvent(new CustomEvent('toggle-ai-assistant'));
                            }
                        }}
                        disabled={!AI_ENABLED}
                        title={AI_ENABLED ? 'Assistente IA (Ctrl+J)' : 'Assistente temporariamente indisponível'}
                        className={`flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-[11px] font-bold outline-none transition-colors duration-120 lg:h-8 lg:min-h-0 ${
                            AI_ENABLED
                                ? 'border-[color:var(--orion-border-mid)] bg-[color:var(--orion-gold-bg)] text-[color:var(--orion-gold)] hover:bg-[color:rgba(191,160,106,0.14)] hover:border-[color:rgba(191,160,106,0.35)]'
                                : 'cursor-not-allowed border-[color:var(--orion-border-low)] bg-white/5 text-[color:var(--orion-text-muted)] opacity-60'
                        }`}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Pergunte
                    </button>
                    {!AI_ENABLED && (
                        <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wide text-black">
                            manutenção
                        </span>
                    )}
                </div>
            </div>
        </header>
        {helpOpen && <HelpPanel context={helpContext} onClose={() => setHelpOpen(false)} />}
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
