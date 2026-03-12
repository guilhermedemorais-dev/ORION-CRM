'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Paperclip, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { createFinancialLaunchAction } from '@/app/(crm)/financeiro/actions';
import type {
    FinanceCommissionRecord,
    FinanceDashboardResponse,
    FinanceLaunchFilter,
    FinanceLaunchesResponse,
    FinanceLaunchRecord,
    FinancePeriod,
} from '@/lib/financeiro-types';
import { cn, formatCurrencyFromCents } from '@/lib/utils';

const PERIOD_OPTIONS: Array<{ value: FinancePeriod; label: string }> = [
    { value: '7d', label: '7d' },
    { value: 'mes', label: 'Mar' },
    { value: 'trimestre', label: 'Trim' },
    { value: 'ano', label: 'Ano' },
];

const TYPE_OPTIONS: Array<{ value: FinanceLaunchFilter; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'receitas', label: 'Receitas' },
    { value: 'despesas', label: 'Despesas' },
    { value: 'pendentes', label: 'Pendentes' },
];

const CATEGORY_OPTIONS = [
    'VENDA_BALCAO',
    'PEDIDO',
    'MATERIAIS',
    'ALUGUEL_INFRA',
    'MARKETING',
    'OUTROS',
] as const;

const PIE_COLORS = ['#C8A97A', '#3B82F6', '#F59E0B', '#10B981', '#FB7185'];

function formatShortDate(value: string | undefined): string {
    if (!value) {
        return 'Sem data';
    }

    const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function formatCompactDate(value: string | undefined): string {
    if (!value) {
        return '--';
    }

    const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatDelta(delta: number): string {
    const sign = delta > 0 ? '▲' : '▼';
    return `${sign} ${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior`;
}

function formatCategory(value: string): string {
    return value
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function getLaunchBadge(record: FinanceLaunchRecord) {
    if (record.status === 'pendente') {
        return {
            label: 'Pendente',
            className: 'bg-[#FEF3C7] text-[#92400E]',
        };
    }

    if (record.type === 'ENTRADA') {
        return {
            label: 'Receita',
            className: 'bg-[#D1FAE5] text-[#065F46]',
        };
    }

    return {
        label: 'Despesa',
        className: 'bg-[#FEE2E2] text-[#991B1B]',
    };
}

function LightCard({
    title,
    description,
    className,
    children,
}: {
    title: string;
    description?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn('rounded-[14px] border border-[#E8E5E0] bg-white p-5', className)}>
            <div className="mb-4">
                <h2 className="font-serif text-[1rem] font-semibold text-[#111827]">{title}</h2>
                {description ? <p className="mt-1 text-[12px] text-[#6B7280]">{description}</p> : null}
            </div>
            {children}
        </section>
    );
}

function KpiCard({
    label,
    accentClassName,
    valueClassName,
    value,
    delta,
    helper,
}: {
    label: string;
    accentClassName: string;
    valueClassName: string;
    value: string;
    delta: string;
    helper: string;
}) {
    return (
        <div className="overflow-hidden rounded-[14px] border border-[#E8E5E0] bg-white">
            <div className={cn('h-[3px] w-full', accentClassName)} />
            <div className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{label}</div>
                <div className={cn('mt-3 font-serif text-[28px] font-semibold', valueClassName)}>{value}</div>
                <div className="mt-2 text-[12px] font-medium text-[#111827]">{delta}</div>
                <div className="mt-1 text-[11px] text-[#6B7280]">{helper}</div>
            </div>
        </div>
    );
}

function DialogContainer({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-[440px] rounded-[18px] bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="font-serif text-[18px] font-semibold text-[#111827]">{title}</h2>
                    <button type="button" onClick={onClose} className="text-sm font-medium text-[#6B7280]">
                        Fechar
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function FinanceiroClient({
    dashboard,
    commissions,
    launches,
    filters,
    todayDate,
    error,
}: {
    dashboard: FinanceDashboardResponse;
    commissions: FinanceCommissionRecord[];
    launches: FinanceLaunchesResponse;
    filters: {
        period: FinancePeriod;
        type: FinanceLaunchFilter;
        search: string;
    };
    todayDate: string;
    error?: string | null;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [hasMounted, setHasMounted] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search);
    const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        setSearchValue(filters.search);
    }, [filters.search]);

    useEffect(() => {
        const normalizedSearch = searchValue.trim();
        if (normalizedSearch === filters.search) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const params = new URLSearchParams();
            params.set('periodo', filters.period);
            params.set('tipo', filters.type);
            if (normalizedSearch) {
                params.set('search', normalizedSearch);
            }

            startTransition(() => {
                router.replace(`/financeiro?${params.toString()}`, { scroll: false });
            });
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [filters.period, filters.search, filters.type, router, searchValue, startTransition]);

    function navigateWith(nextFilters: Partial<{ period: FinancePeriod; type: FinanceLaunchFilter; search: string; page: number }>) {
        const params = new URLSearchParams();
        const period = nextFilters.period ?? filters.period;
        const type = nextFilters.type ?? filters.type;
        const search = nextFilters.search ?? filters.search;
        const page = nextFilters.page ?? launches.meta.page;

        params.set('periodo', period);
        params.set('tipo', type);

        if (search.trim()) {
            params.set('search', search.trim());
        }

        if (page > 1) {
            params.set('page', String(page));
        }

        startTransition(() => {
            router.replace(`/financeiro?${params.toString()}`, { scroll: false });
        });
    }

    const maxCommissionValue = commissions[0]?.comissao_cents ?? 0;
    const pieData = useMemo(() => dashboard.grafico_pizza.slice(0, 4), [dashboard.grafico_pizza]);

    if (!hasMounted) {
        return (
            <div className="overflow-hidden rounded-[24px] border border-[#E8E5E0] bg-[#F8F7F5] shadow-[0_18px_60px_rgba(0,0,0,0.14)]">
                <div className="h-14 border-b border-[#E8E5E0] bg-white" />
                <div className="space-y-6 p-7">
                    <div className="grid gap-4 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={`finance-kpi-${index}`} className="h-[150px] rounded-[14px] border border-[#E8E5E0] bg-white" />
                        ))}
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="h-[320px] rounded-[14px] border border-[#E8E5E0] bg-white" />
                        <div className="h-[320px] rounded-[14px] border border-[#E8E5E0] bg-white" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[24px] border border-[#E8E5E0] bg-[#F8F7F5] text-[#111827] shadow-[0_18px_60px_rgba(0,0,0,0.14)]">
            <div className="flex flex-col gap-4 border-b border-[#E8E5E0] bg-white px-7 py-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-[20px]">💰</span>
                        <h1 className="font-serif text-[20px] font-bold text-[#111827]">Financeiro</h1>
                    </div>

                    <div className="inline-flex overflow-hidden rounded-[10px] border border-[#E8E5E0]">
                        {PERIOD_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                disabled={isPending}
                                onClick={() => navigateWith({ period: option.value, page: 1 })}
                                className={cn(
                                    'h-9 px-4 text-[12px] font-medium transition',
                                    filters.period === option.value
                                        ? 'bg-[#C8A97A] font-bold text-black'
                                        : 'bg-white text-[#6B7280] hover:bg-[#F4EFE6]'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsLaunchModalOpen(true)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-[#C8A97A] px-4 text-[13px] font-bold text-black transition hover:bg-[#D7BC93]"
                >
                    <Plus className="h-4 w-4" />
                    Novo Lançamento
                </button>
            </div>

            <div className="space-y-6 p-7">
                {error ? (
                    <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
                        {error}
                    </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-4">
                    <KpiCard
                        label="Receitas"
                        accentClassName="bg-[#10B981]"
                        valueClassName="text-[#10B981]"
                        value={formatCurrencyFromCents(dashboard.receitas.total_cents)}
                        delta={formatDelta(dashboard.receitas.delta_percent)}
                        helper={`${dashboard.receitas.count ?? 0} lançamentos`}
                    />
                    <KpiCard
                        label="Despesas"
                        accentClassName="bg-[#EF4444]"
                        valueClassName="text-[#EF4444]"
                        value={formatCurrencyFromCents(dashboard.despesas.total_cents)}
                        delta={formatDelta(dashboard.despesas.delta_percent)}
                        helper={`${dashboard.despesas.count ?? 0} lançamentos`}
                    />
                    <KpiCard
                        label="Saldo do Mês"
                        accentClassName="bg-[#C8A97A]"
                        valueClassName="text-[#A8895A]"
                        value={formatCurrencyFromCents(dashboard.saldo.total_cents)}
                        delta={formatDelta(dashboard.saldo.delta_percent)}
                        helper={`Ticket médio ${formatCurrencyFromCents(dashboard.saldo.ticket_medio_cents ?? 0)}`}
                    />
                    <KpiCard
                        label="Comissões a Pagar"
                        accentClassName="bg-[#3B82F6]"
                        valueClassName="text-[#3B82F6]"
                        value={formatCurrencyFromCents(dashboard.comissoes.total_cents)}
                        delta={`${dashboard.comissoes.attendants ?? 0} atendentes`}
                        helper={`Vencimento ${formatShortDate(dashboard.comissoes.due_date)}`}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <LightCard
                        title="Receitas vs Despesas"
                        description="Comparativo diário do período selecionado."
                    >
                        {dashboard.grafico_barras.length === 0 ? (
                            <div className="rounded-[12px] border border-dashed border-[#E8E5E0] bg-[#F8F7F5] px-4 py-10 text-center text-sm text-[#6B7280]">
                                Sem movimentação financeira confirmada no período.
                            </div>
                        ) : (
                            <div className="h-[210px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.grafico_barras} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                                        <CartesianGrid stroke="#EEE7DD" vertical={false} />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            tickFormatter={(value) => formatCurrencyFromCents(Number(value)).replace(',00', '')}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '10px', borderColor: '#E8E5E0' }}
                                            formatter={(value, name) => [
                                                formatCurrencyFromCents(Number(value ?? 0)),
                                                name === 'receitas_cents' ? 'Receitas' : 'Despesas',
                                            ]}
                                        />
                                        <Bar dataKey="receitas_cents" fill="#10B981" radius={[5, 5, 0, 0]} />
                                        <Bar dataKey="despesas_cents" fill="#FCA5A5" radius={[5, 5, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="mt-3 flex items-center gap-4 text-[12px] text-[#6B7280]">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                                Receitas
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#FCA5A5]" />
                                Despesas
                            </div>
                        </div>
                    </LightCard>

                    <LightCard
                        title="Despesas por Categoria"
                        description="Distribuição das saídas confirmadas."
                    >
                        {pieData.length === 0 ? (
                            <div className="rounded-[12px] border border-dashed border-[#E8E5E0] bg-[#F8F7F5] px-4 py-10 text-center text-sm text-[#6B7280]">
                                Sem despesas confirmadas no período atual.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                dataKey="valor_cents"
                                                nameKey="categoria"
                                                innerRadius={44}
                                                outerRadius={62}
                                                paddingAngle={2}
                                            >
                                                {pieData.map((item, index) => (
                                                    <Cell key={item.categoria} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '10px', borderColor: '#E8E5E0' }}
                                                formatter={(value) => formatCurrencyFromCents(Number(value ?? 0))}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-3">
                                    {pieData.map((item, index) => (
                                        <div key={item.categoria}>
                                            <div className="flex items-center justify-between gap-3 text-[12px]">
                                                <div className="flex items-center gap-2 text-[#6B7280]">
                                                    <span
                                                        className="h-2 w-2 rounded-full"
                                                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                                    />
                                                    {item.categoria}
                                                </div>
                                                <span className="font-bold text-[#111827]">
                                                    {item.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                                </span>
                                            </div>
                                            <div className="mt-1 h-1 rounded-full bg-[#EEE7DD]">
                                                <div
                                                    className="h-1 rounded-full"
                                                    style={{
                                                        width: `${Math.max(item.percentual, 10)}%`,
                                                        backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </LightCard>
                </div>

                <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                    <LightCard
                        title="Comissões"
                        description="Ranking por venda reconhecida no período."
                    >
                        <div className="space-y-3">
                            {commissions.length === 0 ? (
                                <div className="rounded-[12px] border border-dashed border-[#E8E5E0] bg-[#F8F7F5] px-4 py-10 text-center text-sm text-[#6B7280]">
                                    Nenhuma comissão apurada no período selecionado.
                                </div>
                            ) : (
                                commissions.map((record) => {
                                    const progress = maxCommissionValue > 0
                                        ? Math.max(12, Math.round((record.comissao_cents / maxCommissionValue) * 100))
                                        : 0;

                                    return (
                                        <div key={record.user_id} className="flex items-center gap-3 rounded-[10px] border border-[#E8E5E0] bg-[#F8F7F5] px-3 py-3">
                                            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#E8D5B0] text-[13px] font-bold text-[#A8895A]">
                                                {getInitials(record.nome)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[13px] font-semibold text-[#111827]">{record.nome}</div>
                                                <div className="text-[11px] text-[#6B7280]">
                                                    {record.vendas} vendas • {formatCurrencyFromCents(record.total_vendido_cents)}
                                                </div>
                                            </div>
                                            <div className="w-20">
                                                <div className="h-[5px] rounded-full bg-[#E8E5E0]">
                                                    <div className="h-[5px] rounded-full bg-[#3B82F6]" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-serif text-[15px] font-semibold text-[#3B82F6]">
                                                    {formatCurrencyFromCents(record.comissao_cents)}
                                                </div>
                                                <div className="text-[11px] text-[#6B7280]">{record.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </LightCard>

                    <LightCard
                        title="Lançamentos"
                        description="Busca, filtro e paginação operacional."
                    >
                        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                {TYPE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => navigateWith({ type: option.value, page: 1 })}
                                        className={cn(
                                            'rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                                            filters.type === option.value
                                                ? 'border-[#C8A97A] bg-[#C8A97A] text-black'
                                                : 'border-[#E8E5E0] bg-white text-[#6B7280] hover:bg-[#F4EFE6]'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <label className="flex h-[34px] w-full items-center gap-2 rounded-[10px] border border-[#E8E5E0] bg-white px-3 xl:max-w-[220px]">
                                <Search className="h-4 w-4 text-[#6B7280]" />
                                <input
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    placeholder="Buscar lançamento..."
                                    className="w-full border-0 bg-transparent p-0 text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
                                />
                            </label>
                        </div>

                        {launches.data.length === 0 ? (
                            <div className="rounded-[12px] border border-dashed border-[#E8E5E0] bg-[#F8F7F5] px-4 py-10 text-center text-sm text-[#6B7280]">
                                Nenhum lançamento encontrado com os filtros atuais.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-[#E8E5E0] text-left text-[11px] uppercase tracking-[0.05em] text-[#6B7280]">
                                            <th className="px-3 pb-3 font-semibold">Descrição</th>
                                            <th className="px-3 pb-3 font-semibold">Categoria</th>
                                            <th className="px-3 pb-3 font-semibold">Data</th>
                                            <th className="px-3 pb-3 font-semibold">Tipo</th>
                                            <th className="px-3 pb-3 font-semibold">Valor</th>
                                            <th className="px-3 pb-3 font-semibold">Comprovante</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {launches.data.map((record) => {
                                            const badge = getLaunchBadge(record);

                                            return (
                                                <tr key={record.id} className="border-b border-[#E8E5E0] last:border-b-0 hover:bg-[#FBFAF8]">
                                                    <td className="px-3 py-3">
                                                        <div className="min-w-[220px]">
                                                            <div className="font-semibold text-[#111827]">{record.description}</div>
                                                            <div className="mt-0.5 text-[11px] text-[#6B7280]">
                                                                {record.responsible?.name ?? 'Sistema'}
                                                                {record.reference.order_number ? ` • ${record.reference.order_number}` : ''}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-[13px] text-[#6B7280]">{formatCategory(record.category)}</td>
                                                    <td className="px-3 py-3 text-[13px] text-[#6B7280]">{formatCompactDate(record.competence_date)}</td>
                                                    <td className="px-3 py-3">
                                                        <span className={cn('inline-flex rounded-full px-2 py-1 text-[11px] font-semibold', badge.className)}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-3 py-3 font-serif text-[15px] font-semibold',
                                                            record.status === 'pendente'
                                                                ? 'text-[#F59E0B]'
                                                                : record.type === 'ENTRADA'
                                                                    ? 'text-[#10B981]'
                                                                    : 'text-[#EF4444]'
                                                        )}
                                                    >
                                                        {record.type === 'ENTRADA' && record.status !== 'pendente' ? '+ ' : record.type === 'SAIDA' ? '− ' : ''}
                                                        {formatCurrencyFromCents(record.amount_cents)}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {record.receipt_url ? (
                                                            <a
                                                                href={record.receipt_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#A8895A] hover:text-[#C8A97A]"
                                                            >
                                                                <Paperclip className="h-3.5 w-3.5" />
                                                                Ver
                                                            </a>
                                                        ) : (
                                                            <span className="text-[12px] text-[#9CA3AF]">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="text-[12px] text-[#6B7280]">
                                Mostrando {launches.data.length} de {launches.meta.total} lançamentos
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={launches.meta.page <= 1 || isPending}
                                    onClick={() => navigateWith({ page: launches.meta.page - 1 })}
                                    className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#E8E5E0] bg-white text-[#111827] disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="rounded-[8px] bg-[#C8A97A] px-3 py-1 text-[12px] font-bold text-black">
                                    {launches.meta.page}
                                </span>
                                <button
                                    type="button"
                                    disabled={launches.meta.page >= launches.meta.pages || isPending}
                                    onClick={() => navigateWith({ page: launches.meta.page + 1 })}
                                    className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#E8E5E0] bg-white text-[#111827] disabled:opacity-40"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </LightCard>
                </div>
            </div>

            {isLaunchModalOpen ? (
                <DialogContainer title="Novo Lançamento" onClose={() => setIsLaunchModalOpen(false)}>
                    <form action={createFinancialLaunchAction} encType="multipart/form-data" className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2">
                                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">Tipo</span>
                                <select
                                    name="tipo"
                                    defaultValue="despesa"
                                    className="h-10 rounded-[10px] border border-[#E8E5E0] px-3 text-[13px] text-[#111827] outline-none"
                                >
                                    <option value="receita">Receita</option>
                                    <option value="despesa">Despesa</option>
                                </select>
                            </label>
                            <label className="grid gap-2">
                                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">Data</span>
                                <input
                                    name="data"
                                    type="date"
                                    defaultValue={todayDate}
                                    required
                                    className="h-10 rounded-[10px] border border-[#E8E5E0] px-3 text-[13px] text-[#111827] outline-none"
                                />
                            </label>
                        </div>

                        <label className="grid gap-2">
                            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">Descrição</span>
                            <input
                                name="descricao"
                                placeholder="Ex: Venda de aliança, aluguel, campanha..."
                                required
                                className="h-10 rounded-[10px] border border-[#E8E5E0] px-3 text-[13px] text-[#111827] outline-none"
                            />
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2">
                                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">Valor (R$)</span>
                                <input
                                    name="valor"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    required
                                    className="h-10 rounded-[10px] border border-[#E8E5E0] px-3 text-[13px] text-[#111827] outline-none"
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">Categoria</span>
                                <select
                                    name="categoria"
                                    defaultValue="OUTROS"
                                    className="h-10 rounded-[10px] border border-[#E8E5E0] px-3 text-[13px] text-[#111827] outline-none"
                                >
                                    {CATEGORY_OPTIONS.map((category) => (
                                        <option key={category} value={category}>
                                            {formatCategory(category)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="grid gap-2">
                            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">Comprovante</span>
                            <input
                                name="comprovante"
                                type="file"
                                accept="image/png,image/jpeg,application/pdf"
                                className="rounded-[10px] border border-[#E8E5E0] px-3 py-2 text-[13px] text-[#111827] outline-none file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#F3EFE8] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#6B7280]"
                            />
                            <span className="text-[11px] text-[#6B7280]">Opcional. Aceita PNG, JPG ou PDF com até 5MB.</span>
                        </label>

                        <div className="mt-2 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsLaunchModalOpen(false)}
                                className="flex-1 rounded-[10px] border border-[#E8E5E0] py-2.5 text-[13px] font-semibold text-[#111827]"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 rounded-[10px] bg-[#C8A97A] py-2.5 text-[13px] font-bold text-black"
                            >
                                Salvar lançamento
                            </button>
                        </div>
                    </form>
                </DialogContainer>
            ) : null}
        </div>
    );
}
