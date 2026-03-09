import Link from 'next/link';
import {
    BarChart3,
    Circle,
    DollarSign,
    Gem,
    LayoutDashboard,
    MessageCircle,
    Monitor,
    Package,
    PencilLine,
    PlusCircle,
    Settings,
    ShoppingBag,
    UserCheck,
    Users,
    Zap,
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
            { icon: Zap, label: 'Automações', href: '/automacoes' },
            { icon: BarChart3, label: 'Analytics', href: '/analytics' },
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
}: {
    companyName: string;
    logoUrl: string | null;
    pipelines: PipelineRecord[];
    userName: string;
    userRole: string;
}) {
    const visibleGroups = navGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.href !== '/analytics' || userRole === 'ADMIN'),
    })).filter((group) => group.items.length > 0);

    return (
        <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-white/5 bg-surface-sidebar text-white">
            <div className="border-b border-white/5 px-5 py-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">ORION CRM</p>
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt="Logo da empresa"
                        className="mt-3 h-12 w-auto rounded bg-white/95 p-1"
                    />
                ) : null}
                <p className="mt-2 font-serif text-xl font-semibold text-brand-gold">{companyName}</p>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-5">
                <div className="mb-6">
                    <div className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">
                        Pipeline
                    </div>
                    <div className="space-y-1">
                        {pipelines.map((pipeline) => {
                            const Icon = pipelineAccent(pipeline.icon);

                            return (
                                <div
                                    key={pipeline.id}
                                    className={`rounded-lg border px-3 py-2 ${
                                        pipeline.is_active
                                            ? 'border-white/5 bg-transparent'
                                            : 'border-white/10 bg-white/[0.03] opacity-80'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <Link
                                            href={`/pipeline/${pipeline.slug}`}
                                            className="flex min-w-0 items-center gap-3 text-sm text-gray-300 transition hover:text-white"
                                        >
                                            <Icon className="h-4 w-4 shrink-0 text-brand-gold" />
                                            <span className="truncate">{pipeline.name}</span>
                                        </Link>
                                        {userRole === 'ADMIN' ? (
                                            <Link
                                                href={`/pipeline/${pipeline.slug}/builder`}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-gray-400 transition hover:text-white"
                                                aria-label={`Abrir builder do pipeline ${pipeline.name}`}
                                            >
                                                <PencilLine className="h-3.5 w-3.5" />
                                            </Link>
                                        ) : null}
                                    </div>
                                    {!pipeline.is_active ? (
                                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                                            Inativo
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                        {userRole === 'ADMIN' ? (
                            <Link
                                href="/pipeline/novo/builder"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
                            >
                                <PlusCircle className="h-4 w-4 text-brand-gold" />
                                <span>Novo pipeline</span>
                            </Link>
                        ) : null}
                    </div>
                </div>

                {visibleGroups.map((group) => (
                    <div key={group.label ?? 'main'} className="mb-6 last:mb-0">
                        {group.label ? (
                            <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">
                                {group.label}
                            </p>
                        ) : null}
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
                                    >
                                        <Icon className="h-4 w-4 text-brand-gold" />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="border-t border-white/5 px-5 py-4">
                <p className="text-sm font-medium text-white">{userName}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{userRole}</p>
            </div>
        </aside>
    );
}
