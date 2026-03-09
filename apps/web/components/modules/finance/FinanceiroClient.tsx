'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Paperclip, Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
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
    { value: 'mes', label: 'Mês' },
    { value: 'trimestre', label: 'Trimestre' },
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

function formatDelta(delta: number): string {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs período anterior`;
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
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
    }

    if (record.type === 'ENTRADA') {
        return {
            label: 'Receita',
            className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
    }

    return {
        label: 'Despesa',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
}

function DialogContainer({
    title,
    description,
    onClose,
    children,
}: {
    title: string;
    description?: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-xl border border-canvas-border bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">
                        Fechar
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function FinanceKpiCard({
    label,
    accentClassName,
    value,
    delta,
    helper,
}: {
    label: string;
    accentClassName: string;
    value: string;
    delta: string;
    helper: string;
}) {
    return (
        <Card className="overflow-hidden p-0">
            <div className={cn('h-1 w-full', accentClassName)} />
            <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">{label}</p>
                <p className="mt-3 font-serif text-3xl font-semibold text-gray-900">{value}</p>
                <p className="mt-2 text-sm font-medium text-gray-700">{delta}</p>
                <p className="mt-2 text-sm text-gray-500">{helper}</p>
            </div>
        </Card>
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
    const [searchValue, setSearchValue] = useState(filters.search);
    const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
    const maxCommissionValue = commissions[0]?.comissao_cents ?? 0;

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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Financeiro"
                description="KPIs do caixa, leitura operacional de lançamentos e ranking de comissões em um único painel."
                actions={(
                    <>
                        <div className="inline-flex rounded-lg border border-canvas-border bg-white p-1">
                            {PERIOD_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => navigateWith({ period: option.value, page: 1 })}
                                    className={cn(
                                        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        filters.period === option.value
                                            ? 'bg-brand-gold text-surface-sidebar'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setIsLaunchModalOpen(true)}>
                            Novo Lançamento
                        </Button>
                    </>
                )}
            />

            {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-4">
                <FinanceKpiCard
                    label="Receitas"
                    accentClassName="bg-emerald-500"
                    value={formatCurrencyFromCents(dashboard.receitas.total_cents)}
                    delta={formatDelta(dashboard.receitas.delta_percent)}
                    helper={`${dashboard.receitas.count ?? 0} lançamentos confirmados no período`}
                />
                <FinanceKpiCard
                    label="Despesas"
                    accentClassName="bg-rose-400"
                    value={formatCurrencyFromCents(dashboard.despesas.total_cents)}
                    delta={formatDelta(dashboard.despesas.delta_percent)}
                    helper={`${dashboard.despesas.count ?? 0} saídas registradas no período`}
                />
                <FinanceKpiCard
                    label="Saldo do Período"
                    accentClassName="bg-amber-400"
                    value={formatCurrencyFromCents(dashboard.saldo.total_cents)}
                    delta={formatDelta(dashboard.saldo.delta_percent)}
                    helper={`Ticket médio ${formatCurrencyFromCents(dashboard.saldo.ticket_medio_cents ?? 0)}`}
                />
                <FinanceKpiCard
                    label="Comissões a Pagar"
                    accentClassName="bg-blue-500"
                    value={formatCurrencyFromCents(dashboard.comissoes.total_cents)}
                    delta={formatDelta(dashboard.comissoes.delta_percent)}
                    helper={`${dashboard.comissoes.attendants ?? 0} atendentes • venc. ${formatShortDate(dashboard.comissoes.due_date)}`}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <Card title="Receitas vs Despesas" description="Leitura comparativa do período selecionado.">
                    {dashboard.grafico_barras.length === 0 ? (
                        <EmptyState
                            title="Sem dados no período"
                            description="Os gráficos aparecem assim que houver movimentação financeira confirmada."
                        />
                    ) : (
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dashboard.grafico_barras} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#6B7280', fontSize: 12 }}
                                        tickFormatter={(value) => formatCurrencyFromCents(Number(value)).replace(',00', '')}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => [
                                            formatCurrencyFromCents(Number(value ?? 0)),
                                            name === 'receitas_cents' ? 'Receitas' : 'Despesas',
                                        ]}
                                        labelFormatter={(label) => `Período: ${label}`}
                                    />
                                    <Bar dataKey="receitas_cents" name="Receitas" fill="#10B981" radius={[8, 8, 0, 0]} />
                                    <Bar dataKey="despesas_cents" name="Despesas" fill="#FCA5A5" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>

                <Card title="Despesas por Categoria" description="Distribuição das saídas confirmadas no período.">
                    {dashboard.grafico_pizza.length === 0 ? (
                        <p className="text-sm text-gray-500">Sem despesas confirmadas no período atual.</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dashboard.grafico_pizza}
                                            dataKey="valor_cents"
                                            nameKey="categoria"
                                            innerRadius={55}
                                            outerRadius={82}
                                            paddingAngle={2}
                                        >
                                            {dashboard.grafico_pizza.map((item, index) => (
                                                <Cell key={item.categoria} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrencyFromCents(Number(value ?? 0))} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3">
                                {dashboard.grafico_pizza.map((item, index) => (
                                    <div key={item.categoria} className="space-y-2">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                                />
                                                {item.categoria}
                                            </div>
                                            <span className="font-medium text-gray-900">
                                                {item.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-100">
                                            <div
                                                className="h-2 rounded-full"
                                                style={{
                                                    width: `${Math.max(item.percentual, 6)}%`,
                                                    backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card title="Ranking de Comissões" description="Atendentes com vendas reconhecidas no período.">
                    {commissions.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhuma comissão apurada no período selecionado.</p>
                    ) : (
                        <div className="space-y-4">
                            {commissions.map((record) => {
                                const progress = maxCommissionValue > 0
                                    ? Math.max(10, Math.round((record.comissao_cents / maxCommissionValue) * 100))
                                    : 0;

                                return (
                                    <div key={record.user_id} className="rounded-xl border border-canvas-border bg-white/70 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/15 text-sm font-semibold text-brand-gold-dark">
                                                {getInitials(record.nome)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{record.nome}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {record.vendas} vendas • {record.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {formatCurrencyFromCents(record.comissao_cents)}
                                                    </p>
                                                </div>
                                                <div className="mt-3 h-2 rounded-full bg-gray-100">
                                                    <div className="h-2 rounded-full bg-brand-gold" style={{ width: `${progress}%` }} />
                                                </div>
                                                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                                    <span>Total vendido</span>
                                                    <span>{formatCurrencyFromCents(record.total_vendido_cents)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                <Card
                    title="Lançamentos"
                    description="Filtros rápidos, busca por descrição e visão operacional com comprovantes."
                >
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {TYPE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => navigateWith({ type: option.value, page: 1 })}
                                    className={cn(
                                        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                                        filters.type === option.value
                                            ? 'border-brand-gold bg-brand-gold/10 text-brand-gold-dark'
                                            : 'border-canvas-border bg-white text-gray-600 hover:border-brand-gold-light hover:text-gray-900'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="w-full lg:max-w-xs">
                            <Input
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Buscar por descrição, categoria ou pedido"
                            />
                        </div>
                    </div>

                    {launches.data.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum lançamento encontrado com os filtros atuais.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                    <tr>
                                        <th className="pb-3 pr-4 font-medium">Descrição</th>
                                        <th className="pb-3 pr-4 font-medium">Categoria</th>
                                        <th className="pb-3 pr-4 font-medium">Data</th>
                                        <th className="pb-3 pr-4 font-medium">Tipo</th>
                                        <th className="pb-3 pr-4 font-medium">Valor</th>
                                        <th className="pb-3 font-medium">Comprovante</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-canvas-border">
                                    {launches.data.map((record) => {
                                        const badge = getLaunchBadge(record);

                                        return (
                                            <tr key={record.id}>
                                                <td className="py-3 pr-4">
                                                    <div className="min-w-[240px]">
                                                        <p className="font-medium text-gray-900">{record.description}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {record.responsible?.name ?? 'Sistema'}
                                                            {record.reference.order_number ? ` • ${record.reference.order_number}` : ''}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">{formatCategory(record.category)}</td>
                                                <td className="py-3 pr-4 text-gray-700">{formatShortDate(record.competence_date)}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', badge.className)}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td
                                                    className={cn(
                                                        'py-3 pr-4 font-medium',
                                                        record.status === 'pendente'
                                                            ? 'text-amber-700'
                                                            : record.type === 'ENTRADA'
                                                                ? 'text-emerald-700'
                                                                : 'text-rose-700'
                                                    )}
                                                >
                                                    {formatCurrencyFromCents(record.amount_cents)}
                                                </td>
                                                <td className="py-3">
                                                    {record.receipt_url ? (
                                                        <a
                                                            href={record.receipt_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 text-sm font-medium text-brand-gold-dark hover:text-brand-gold"
                                                        >
                                                            <Paperclip className="h-4 w-4" />
                                                            Abrir
                                                        </a>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 flex flex-col gap-3 border-t border-canvas-border pt-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            Mostrando {launches.data.length} de {launches.meta.total} lançamentos
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={launches.meta.page <= 1 || isPending}
                                icon={<ChevronLeft className="h-4 w-4" />}
                                onClick={() => navigateWith({ page: launches.meta.page - 1 })}
                            >
                                Anterior
                            </Button>
                            <span className="px-2 text-sm text-gray-600">
                                Página {launches.meta.page} de {launches.meta.pages}
                            </span>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={launches.meta.page >= launches.meta.pages || isPending}
                                icon={<ChevronRight className="h-4 w-4" />}
                                onClick={() => navigateWith({ page: launches.meta.page + 1 })}
                            >
                                Próxima
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {isLaunchModalOpen ? (
                <DialogContainer
                    title="Novo Lançamento"
                    description="Registro manual rápido para receita ou despesa. O upload físico do comprovante entra no próximo passo."
                    onClose={() => setIsLaunchModalOpen(false)}
                >
                    <form action={createFinancialLaunchAction} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm text-gray-600">
                                Tipo
                                <select
                                    name="tipo"
                                    defaultValue="despesa"
                                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                >
                                    <option value="receita">Receita</option>
                                    <option value="despesa">Despesa</option>
                                </select>
                            </label>
                            <label className="grid gap-2 text-sm text-gray-600">
                                Data
                                <Input name="data" type="date" defaultValue={todayDate} required />
                            </label>
                        </div>

                        <label className="grid gap-2 text-sm text-gray-600">
                            Descrição
                            <Input name="descricao" placeholder="Ex.: Campanha Meta Ads março" required />
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm text-gray-600">
                                Valor em R$
                                <Input name="valor" inputMode="decimal" placeholder="0,00" required />
                            </label>
                            <label className="grid gap-2 text-sm text-gray-600">
                                Categoria
                                <select
                                    name="categoria"
                                    defaultValue="OUTROS"
                                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                >
                                    {CATEGORY_OPTIONS.map((category) => (
                                        <option key={category} value={category}>
                                            {formatCategory(category)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="grid gap-2 text-sm text-gray-600">
                            URL do comprovante
                            <Input
                                name="comprovante"
                                type="url"
                                placeholder="https://..."
                            />
                        </label>

                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="secondary" onClick={() => setIsLaunchModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                Salvar lançamento
                            </Button>
                        </div>
                    </form>
                </DialogContainer>
            ) : null}
        </div>
    );
}
