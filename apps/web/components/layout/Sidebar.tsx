'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/app/(crm)/actions';
import {
    BarChart3,
    CalendarDays,
    Circle,
    DollarSign,
    Gem,
    Headphones,
    Heart,
    LayoutDashboard,
    LogOut,
    MessageCircle,
    Monitor,
    Package,
    PencilLine,
    PlusCircle,
    Settings,
    Star,
    Store,
    ShoppingBag,
    Truck,
    UserCheck,
    Users,
    LifeBuoy,
    Workflow,
    Wrench,
} from 'lucide-react';
import type { PipelineRecord } from '@/lib/api';
import { extractApiError, type ExtractedApiError } from '@/lib/api-error';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';

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
            { icon: LifeBuoy, label: 'Suporte', href: '/chamados' },
        ],
    },
];

function pipelineAccent(icon: string) {
    if (icon === 'users') return Users;
    if (icon === 'shopping-bag') return ShoppingBag;
    if (icon === 'gem') return Gem;
    if (icon === 'package') return Package;
    if (icon === 'truck') return Truck;
    if (icon === 'wrench') return Wrench;
    if (icon === 'star') return Star;
    if (icon === 'heart') return Heart;
    if (icon === 'workflow') return Workflow;
    if (icon === 'headphones') return Headphones;
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

    const router = useRouter();

    // Modal "Novo kanban"
    const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);

    // Badge "Suporte" — quantos items do roadmap aguardam aprovação.
    // Atualiza a cada 60s e logo após cada visita à página de chamados.
    const [roadmapUnread, setRoadmapUnread] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch('/api/internal/roadmap/notifications/unread-count');
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setRoadmapUnread(Number(data?.data?.unread_count ?? 0));
            } catch {
                // silently fail
            }
        };
        void load();
        const handle = setInterval(load, 60_000);
        return () => { cancelled = true; clearInterval(handle); };
    }, [pathname]);

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
        <>
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
                                        className={`mx-0 flex min-h-[44px] items-center gap-[10px] px-5 py-3 text-[12px] font-medium transition-colors duration-120 lg:min-h-0 lg:h-8 lg:py-0 ${
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
                                    className={`mx-0 flex min-h-[44px] flex-col justify-center rounded-none px-5 py-2 lg:min-h-0 lg:py-2 ${
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
                                                href={`/pipeline/${pipeline.slug}?config=1`}
                                                onClick={onCloseMobile}
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[color:var(--orion-border-mid)] bg-white/5 text-[color:var(--orion-text-secondary)] transition-colors hover:border-[color:var(--orion-border-strong)] hover:text-[color:var(--orion-text)]"
                                                aria-label={`Configurar Kanban do pipeline ${pipeline.name}`}
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
                        {userRole === 'ROOT' || userRole === 'ADMIN' ? (
                            <button
                                type="button"
                                onClick={() => { setShowNewPipelineModal(true); onCloseMobile(); }}
                                className="mx-0 flex min-h-[44px] w-full items-center gap-[10px] border-l-[2px] border-transparent bg-transparent px-5 py-3 text-left text-[12px] font-medium text-[color:var(--orion-text-secondary)] transition-colors hover:bg-[color:var(--orion-hover)] hover:text-[color:var(--orion-text)] lg:min-h-0 lg:h-8 lg:py-0"
                            >
                                <PlusCircle className="h-4 w-4 shrink-0 text-[color:var(--orion-gold)]" />
                                <span>Novo kanban</span>
                            </button>
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
                                const showBadge = item.href === '/chamados' && roadmapUnread > 0;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onCloseMobile}
                                        className={`mx-0 flex min-h-[44px] items-center gap-[10px] px-5 py-3 text-[12px] font-medium transition-colors duration-120 lg:min-h-0 lg:h-8 lg:py-0 ${
                                            active
                                                ? 'border-l-[2px] border-[color:var(--orion-gold)] bg-[color:var(--orion-active)] font-semibold text-[color:var(--orion-text)]'
                                                : 'border-l-[2px] border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)] hover:bg-[color:var(--orion-hover)]'
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 shrink-0 transition-opacity duration-120 ${active ? 'text-[color:var(--orion-gold)]' : 'opacity-50 text-[color:var(--orion-text-secondary)]'}`} />
                                        <span className="flex-1">{item.label}</span>
                                        {showBadge ? (
                                            <span
                                                title={`${roadmapUnread} item(s) aguardando aprovação`}
                                                className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--orion-gold)] px-1.5 text-[10px] font-bold text-[#0A0A0C]"
                                            >
                                                {roadmapUnread > 99 ? '99+' : roadmapUnread}
                                            </span>
                                        ) : null}
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

        {showNewPipelineModal && (
            <NewPipelineModal
                onClose={() => setShowNewPipelineModal(false)}
                onCreated={(slug) => {
                    setShowNewPipelineModal(false);
                    router.push(`/pipeline/${slug}?config=1`);
                    router.refresh();
                }}
            />
        )}
        </>
    );
}

// ─── Modal "Novo kanban" ─────────────────────────────────────────────────────

function NewPipelineModal({ onClose, onCreated }: {
    onClose: () => void;
    onCreated: (slug: string) => void;
}) {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('users');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<ExtractedApiError | null>(null);

    // Mesma família de ícones (Lucide) usada no resto do sistema.
    // O backend persiste a chave (`users`, `package`, etc.) e o sidebar
    // resolve para o componente em runtime via pipelineAccent().
    const ICONS: Array<{ key: string; Icon: typeof Users; label: string }> = [
        { key: 'users', Icon: Users, label: 'Pessoas' },
        { key: 'shopping-bag', Icon: ShoppingBag, label: 'Vendas' },
        { key: 'gem', Icon: Gem, label: 'Joia' },
        { key: 'package', Icon: Package, label: 'Pedido' },
        { key: 'truck', Icon: Truck, label: 'Entrega' },
        { key: 'wrench', Icon: Wrench, label: 'Produção' },
        { key: 'headphones', Icon: Headphones, label: 'Atendimento' },
        { key: 'star', Icon: Star, label: 'Destaque' },
        { key: 'heart', Icon: Heart, label: 'Pós-venda' },
        { key: 'workflow', Icon: Workflow, label: 'Fluxo' },
    ];

    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    const submit = async () => {
        if (!name.trim() || name.trim().length < 2) {
            setError({
                message: 'O nome precisa ter ao menos 2 caracteres.',
                code: 'CLIENT_VALIDATION',
                requestId: null,
                details: [],
            });
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    icon,
                    description: description.trim() || undefined,
                }),
            });
            if (!res.ok) {
                const apiErr = await extractApiError(res);
                setError(apiErr);
                setSaving(false);
                return;
            }
            const data = await res.json().catch(() => null);
            const createdSlug = data?.slug ?? data?.data?.slug ?? slug;
            onCreated(createdSlug);
        } catch (err) {
            setError({
                message: err instanceof Error ? err.message : 'Erro ao criar pipeline.',
                code: 'NETWORK_ERROR',
                requestId: null,
                details: [],
            });
            setSaving(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
        >
            <div style={{
                background: '#141417', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '12px', width: '100%', maxWidth: '480px',
                padding: '22px 24px',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{
                            margin: 0,
                            fontFamily: "'Playfair Display', serif",
                            fontSize: '18px', fontWeight: 600, color: '#F0EDE8',
                        }}>
                            Novo kanban
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#7A7774' }}>
                            Crie um pipeline para um setor da operação (ex: Comercial, Produção, Entrega).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        style={{
                            width: '28px', height: '28px', background: 'transparent',
                            border: 'none', color: '#7A7774', cursor: 'pointer',
                            borderRadius: '5px', fontSize: '16px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                            Nome do kanban *
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Comercial, Produção, Pós-venda"
                            autoFocus
                            style={{
                                width: '100%', height: '36px', background: '#1A1A1E',
                                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                padding: '0 12px', color: '#F0EDE8', fontSize: '13px', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        {name.trim().length >= 2 && (
                            <p style={{ marginTop: '4px', fontSize: '10px', color: '#7A7774' }}>
                                URL: <code style={{ color: '#C8A97A' }}>/pipeline/{slug}</code>
                            </p>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '6px' }}>
                            Ícone
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                            {ICONS.map((opt) => {
                                const selected = icon === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setIcon(opt.key)}
                                        title={opt.label}
                                        aria-label={`Ícone ${opt.label}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            height: '40px',
                                            background: selected ? 'rgba(200,169,122,0.18)' : '#1A1A1E',
                                            border: `1px solid ${selected ? '#C8A97A' : 'rgba(255,255,255,0.10)'}`,
                                            borderRadius: '7px', cursor: 'pointer',
                                            color: selected ? '#C8A97A' : '#A8A4A0',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <opt.Icon size={16} />
                                    </button>
                                );
                            })}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#7A7774' }}>
                            {ICONS.find(o => o.key === icon)?.label ?? 'Selecione um ícone'}
                        </p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                            Descrição (opcional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Para que serve este kanban?"
                            rows={2}
                            style={{
                                width: '100%', background: '#1A1A1E',
                                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                padding: '8px 12px', color: '#F0EDE8', fontSize: '13px', outline: 'none',
                                resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {error && <ApiErrorMessage error={error} />}

                    <p style={{ margin: 0, fontSize: '10px', color: '#7A7774', fontStyle: 'italic' }}>
                        Após criar, você será levado para o novo kanban com o painel de configuração de etapas aberto.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            height: '36px', padding: '0 16px', borderRadius: '7px',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#C8C4BE', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={saving || !name.trim()}
                        style={{
                            height: '36px', padding: '0 18px', borderRadius: '7px',
                            background: '#C8A97A', border: 'none', color: '#0A0A0C',
                            fontSize: '12px', fontWeight: 700,
                            cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                            opacity: saving || !name.trim() ? 0.5 : 1,
                        }}
                    >
                        {saving ? 'Criando…' : 'Criar kanban'}
                    </button>
                </div>
            </div>
        </div>
    );
}
