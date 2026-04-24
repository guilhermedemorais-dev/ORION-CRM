'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/(crm)/actions';
import {
    BarChart3,
    CalendarDays,
    Circle,
    DollarSign,
    Gem,
    LayoutDashboard,
    LogOut,
    MessageCircle,
    Monitor,
    Package,
    PencilLine,
    PlusCircle,
    Settings,
    Store,
    ShoppingBag,
    UserCheck,
    Users,
} from 'lucide-react';
import type { PipelineRecord } from '@/lib/api';

const navGroups = [
    {
        label: null,
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
            { icon: MessageCircle, label: 'Inbox', href: '/inbox' },
            { icon: UserCheck, label: 'Clientes', href: '/clientes' },
        ],
    },
    {
        label: 'Operação',
        items: [
            { icon: CalendarDays, label: 'Agenda', href: '/agenda' },
            { icon: ShoppingBag, label: 'Pedidos', href: '/pedidos' },
            { icon: Gem, label: 'Produção', href: '/producao' },
            { icon: Package, label: 'Estoque', href: '/estoque' },
            { icon: DollarSign, label: 'Financeiro', href: '/financeiro' },
            { icon: Monitor, label: 'PDV', href: '/pdv' },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { icon: BarChart3, label: 'Analytics', href: '/analytics' },
            { icon: Store, label: 'Loja', href: '/settings/loja' },
            { icon: Settings, label: 'Ajustes', href: '/ajustes' },
        ],
    },
];

function pipelineAccent(icon: string) {
    if (icon === 'users') return Users;
    if (icon === 'shopping-bag') return ShoppingBag;
    if (icon === 'gem') return Gem;
    return Circle;
}

export function Sidebar({
    companyName,
    logoUrl,
    pipelines,
    userName,
    userRole,
    mobileOpen,
    onCloseMobile,
}: {
    companyName: string;
    logoUrl: string | null;
    pipelines: PipelineRecord[];
    userName: string;
    userRole: string;
    mobileOpen: boolean;
    onCloseMobile: () => void;
}) {
    const pathname = usePathname();
    const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

    const visibleGroups = navGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
            if (item.href === '/analytics' || item.href === '/settings/loja') {
                return ['ROOT', 'ADMIN'].includes(userRole);
            }

            return true;
        }),
    })).filter((group) => group.items.length > 0);

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] text-white transition-transform duration-200 ease-out lg:translate-x-0 ${
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ fontFamily: 'var(--font-orion-sans)' }}
        >
            {/* Logo area */}
            <div className="px-5 py-5">
                {/* FIX: Hidden — prevents exposing platform name in white-label deployment */}
                {/* <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">ORION CRM</p> */}
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt="Logo da empresa"
                        className="mt-3 h-12 w-auto rounded bg-white/95 p-1"
                    />
                ) : null}
                <p className="mt-2 font-serif text-lg font-semibold text-[color:var(--orion-gold)]">{companyName}</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-0 py-5">
                {visibleGroups.length > 0 ? (
                    <div key={visibleGroups[0].label ?? 'main'} className="mb-6">
                        {visibleGroups[0].label ? (
                            <p className="mb-1 px-5 text-[9px] font-bold uppercase tracking-[0.15em] text-[color:var(--orion-text-disabled)]">
                                {visibleGroups[0].label}
                            </p>
                        ) : null}
                        <div className="space-y-[2px]">
                            {visibleGroups[0].items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onCloseMobile}
                                        className={`mx-0 flex h-8 items-center gap-[10px] px-5 text-[12px] font-medium transition-colors duration-120 ${
                                            active
                                                ? 'border-l-[2px] border-[color:var(--orion-gold)] bg-[color:var(--orion-active)] font-semibold text-[color:var(--orion-text)]'
                                                : 'border-l-[2px] border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]'
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 shrink-0 transition-opacity duration-120 ${active ? 'text-[color:var(--orion-gold)]' : 'opacity-50 text-[color:var(--orion-text-secondary)] group-hover:opacity-100'}`} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {/* Pipeline section */}
                <div className="mb-6">
                    <div className="mb-1 px-5 text-[9px] font-bold uppercase tracking-[0.15em] text-[color:var(--orion-text-disabled)]">
                        Pipeline
                    </div>
                    <div className="space-y-[2px] px-0">
                        {pipelines.map((pipeline) => {
                            const Icon = pipelineAccent(pipeline.icon);
                            const pipelineActive = pipeline.is_active;

                            return (
                                <div
                                    key={pipeline.id}
                                    className={`mx-0 rounded-none px-5 py-2 ${
                                        pipelineActive ? '' : 'opacity-80'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <Link
                                            href={`/pipeline/${pipeline.slug}`}
                                            onClick={onCloseMobile}
                                            className="flex min-w-0 items-center gap-3 text-[12px] font-medium text-[color:var(--orion-text-secondary)] transition-colors hover:text-[color:var(--orion-text)]"
                                        >
                                            <Icon className="h-4 w-4 shrink-0 text-[color:var(--orion-gold)]" />
                                            <span className="truncate">{pipeline.name}</span>
                                        </Link>
                                        {userRole === 'ROOT' ? (
                                            <Link
                                                href={`/pipeline/${pipeline.slug}/builder`}
                                                onClick={onCloseMobile}
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[color:var(--orion-border-mid)] bg-white/5 text-[color:var(--orion-text-secondary)] transition-colors hover:border-[color:var(--orion-border-strong)] hover:text-[color:var(--orion-text)]"
                                                aria-label={`Abrir builder do pipeline ${pipeline.name}`}
                                            >
                                                <PencilLine className="h-3.5 w-3.5" />
                                            </Link>
                                        ) : null}
                                    </div>
                                    {!pipelineActive ? (
                                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-muted)]">
                                            Inativo
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                        {userRole === 'ROOT' ? (
                            <Link
                                href="/pipeline/novo/builder"
                                onClick={onCloseMobile}
                                className="mx-0 flex h-8 items-center gap-[10px] px-5 text-[12px] font-medium text-[color:var(--orion-text-secondary)] transition-colors hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]"
                            >
                                <PlusCircle className="h-4 w-4 shrink-0 text-[color:var(--orion-gold)]" />
                                <span>Novo pipeline</span>
                            </Link>
                        ) : null}
                    </div>
                </div>

                {/* Remaining groups */}
                {visibleGroups.slice(1).map((group) => (
                    <div key={group.label ?? 'main'} className="mb-6 last:mb-0">
                        {group.label ? (
                            <p className="mb-1 px-5 text-[9px] font-bold uppercase tracking-[0.15em] text-[color:var(--orion-text-disabled)]">
                                {group.label}
                            </p>
                        ) : null}
                        <div className="space-y-[2px]">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onCloseMobile}
                                        className={`mx-0 flex h-8 items-center gap-[10px] px-5 text-[12px] font-medium transition-colors duration-120 ${
                                            active
                                                ? 'border-l-[2px] border-[color:var(--orion-gold)] bg-[color:var(--orion-active)] font-semibold text-[color:var(--orion-text)]'
                                                : 'border-l-[2px] border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]'
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 shrink-0 transition-opacity duration-120 ${active ? 'text-[color:var(--orion-gold)]' : 'opacity-50 text-[color:var(--orion-text-secondary)]'}`} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User footer */}
            <div className="border-t border-[color:var(--orion-border-low)] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-[color:var(--orion-text)]">{userName}</p>
                        <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">{userRole}</p>
                    </div>
                    <form action={logoutAction}>
                        <button
                            type="submit"
                            title="Sair do sistema"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[color:var(--orion-text-secondary)] outline-none transition-colors hover:bg-[color:var(--orion-hover)] hover:text-[color:var(--orion-text)]"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            </div>
        </aside>
    );
}
