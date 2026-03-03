import Link from 'next/link';
import {
    BarChart3,
    DollarSign,
    Gem,
    LayoutDashboard,
    MessageCircle,
    Monitor,
    Package,
    Settings,
    ShoppingBag,
    UserCheck,
    Users,
    Zap,
} from 'lucide-react';

const navGroups = [
    {
        label: null,
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
            { icon: Users, label: 'Leads', href: '/leads' },
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

export function Sidebar({
    companyName,
    userName,
    userRole,
}: {
    companyName: string;
    userName: string;
    userRole: string;
}) {
    return (
        <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-white/5 bg-surface-sidebar text-white">
            <div className="border-b border-white/5 px-5 py-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">ORION CRM</p>
                <p className="mt-2 font-serif text-xl font-semibold text-brand-gold">{companyName}</p>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-5">
                {navGroups.map((group) => (
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
