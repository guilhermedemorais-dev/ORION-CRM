'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useTransition } from 'react';
import {
    Ban,
    CircleDollarSign,
    Download,
    Gift,
    LineChart as LineChartIcon,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import type {
    AnalyticsAgentsResponse,
    AnalyticsLeadsResponse,
    AnalyticsPeriod,
    AnalyticsProductionResponse,
    AnalyticsSalesResponse,
    AnalyticsStoreResponse,
    AnalyticsTab,
} from '@/lib/analytics-types';
import { cn, formatCurrencyFromCents } from '@/lib/utils';

const TAB_OPTIONS: Array<{ value: AnalyticsTab; label: string; available: boolean }> = [
    { value: 'sales', label: 'Vendas', available: true },
    { value: 'leads', label: 'Leads', available: true },
    { value: 'production', label: 'Produção', available: true },
    { value: 'store', label: 'Loja', available: true },
    { value: 'agents', label: 'Atendentes', available: true },
];

const PERIOD_OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' },
    { value: '12m', label: '12m' },
];

function formatPercent(value: number): string {
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: value % 1 === 0 ? 0 : 1 })}%`;
}

function formatTrend(delta: number): string {
    if (delta === 0) {
        return 'Sem variação';
    }

    const prefix = delta > 0 ? '+' : '';
    return `${prefix}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs período anterior`;
}

function formatTooltipCurrency(value: number | string | ReadonlyArray<number | string> | undefined): string {
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    return formatCurrencyFromCents(Number(normalizedValue ?? 0));
}

function buildCsv(rows: AnalyticsSalesResponse['tables']['top_products']): string {
    const header = ['Produto', 'Categoria', 'Qtd Vendida', 'Receita', '% do total'];
    const body = rows.map((row) => [
        row.product,
        row.category,
        String(row.quantity),
        formatCurrencyFromCents(row.revenue_cents),
        formatPercent(row.share_percent),
    ]);

    return [header, ...body]
        .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

function downloadCsv(filename: string, rows: AnalyticsSalesResponse['tables']['top_products']) {
    const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function getTrendClassName(delta: number, inverted = false): string {
    if (delta === 0) {
        return 'text-[color:var(--orion-text-secondary)]';
    }

    const isPositive = inverted ? delta < 0 : delta > 0;
    return isPositive ? 'text-emerald-200' : 'text-rose-200';
}

function RevenueTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ value?: number; name?: string; color?: string }>;
    label?: string;
}) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-[#C8A97A] bg-[#1A1A1E] px-4 py-3 text-sm text-[#F0EBE3] shadow-lg">
            <p className="text-xs uppercase tracking-[0.18em] text-[#C8A97A]">{label}</p>
            <div className="mt-2 space-y-1">
                {payload.map((entry) => (
                    <div key={`${entry.name}-${entry.color}`} className="flex items-center justify-between gap-4">
                        <span style={{ color: entry.color }}>{entry.name}</span>
                        <span>{formatCurrencyFromCents(Number(entry.value ?? 0))}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AnalyticsKpiCard({
    label,
    icon,
    value,
    trend,
    helper,
    inverted,
}: {
    label: string;
    icon: ReactNode;
    value: string;
    trend: number;
    helper: string;
    inverted?: boolean;
}) {
    return (
        <Card className="border-white/5 bg-[#131316]">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text-secondary)]">{label}</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-gold/10 text-brand-gold">
                    {icon}
                </span>
            </div>
            <div>
                <p className="font-serif text-[28px] font-semibold leading-none text-[color:var(--orion-text)]">{value}</p>
                <p className={cn('mt-2 text-sm font-medium', getTrendClassName(trend, inverted))}>{formatTrend(trend)}</p>
                <p className="mt-2 text-[11px] text-[color:var(--orion-text-secondary)]">{helper}</p>
            </div>
        </Card>
    );
}

function LeadsTab({ data }: { data: AnalyticsLeadsResponse }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Novos leads', value: String(data.new_leads_count) },
                    { label: 'Convertidos', value: String(data.converted_count) },
                    { label: 'Perdidos', value: String(data.lost_count) },
                    { label: 'Taxa de conversão', value: `${data.conversion_rate_percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border-white/5 bg-[#131316]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text-secondary)]">{kpi.label}</p>
                        <p className="mt-3 font-serif text-[28px] font-semibold leading-none text-[color:var(--orion-text)]">{kpi.value}</p>
                    </Card>
                ))}
            </div>

            <Card title="Funil de leads por etapa" className="border-white/5 bg-[#131316]">
                {data.funnel.length === 0 ? (
                    <EmptyState title="Sem dados de funil" description="Crie leads no período selecionado para ver o funil." />
                ) : (
                    <div className="space-y-3">
                        {data.funnel.map((row) => (
                            <div key={row.stage}>
                                <div className="mb-1 flex justify-between text-[12px]">
                                    <span className="text-[color:var(--orion-text)]">{row.stage}</span>
                                    <span className="text-[color:var(--orion-text-secondary)]">{row.count} · {row.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-2 rounded-full bg-brand-gold"
                                        style={{ width: `${row.percent}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card title="Leads perdidos" description="Últimos 20 leads marcados como perdidos no período." className="border-white/5 bg-[#131316]">
                {data.lost_leads.length === 0 ? (
                    <EmptyState title="Nenhum lead perdido" description="Ótimo sinal para o período selecionado." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/5 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                    <th className="px-3 py-3 font-medium">Nome</th>
                                    <th className="px-3 py-3 font-medium">Telefone</th>
                                    <th className="px-3 py-3 font-medium">Data</th>
                                    <th className="px-3 py-3 font-medium">Motivo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.lost_leads.map((row, i) => (
                                    <tr key={`lost-${i}`}>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text)]">{row.name ?? '—'}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{row.phone ?? '—'}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{new Date(row.lost_at).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{row.reason ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

function ProductionTab({ data }: { data: AnalyticsProductionResponse }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Total de pedidos', value: String(data.total_orders) },
                    { label: 'Concluídos', value: String(data.completed_count) },
                    { label: 'Em andamento', value: String(data.in_progress_count) },
                    { label: 'Em atraso', value: String(data.late_count), danger: data.late_count > 0 },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border-white/5 bg-[#131316]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text-secondary)]">{kpi.label}</p>
                        <p className={cn('mt-3 font-serif text-[28px] font-semibold leading-none', kpi.danger ? 'text-rose-300' : 'text-[color:var(--orion-text)]')}>{kpi.value}</p>
                    </Card>
                ))}
            </div>

            <Card title="Distribuição por status" className="border-white/5 bg-[#131316]">
                {data.status_distribution.length === 0 ? (
                    <EmptyState title="Sem pedidos no período" description="Nenhum pedido encontrado para o período selecionado." />
                ) : (
                    <div className="space-y-3">
                        {data.status_distribution.map((row) => (
                            <div key={row.status}>
                                <div className="mb-1 flex justify-between text-[12px]">
                                    <span className="text-[color:var(--orion-text)]">{row.status}</span>
                                    <span className="text-[color:var(--orion-text-secondary)]">{row.count} · {row.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-2 rounded-full bg-brand-gold" style={{ width: `${row.percent}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card title="Pedidos em atraso" description="Pedidos com prazo vencido ainda em produção." className="border-white/5 bg-[#131316]">
                {data.late_orders.length === 0 ? (
                    <EmptyState title="Nenhum pedido em atraso" description="Todos os pedidos estão dentro do prazo." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/5 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                    <th className="px-3 py-3 font-medium">Cliente</th>
                                    <th className="px-3 py-3 font-medium">Prazo</th>
                                    <th className="px-3 py-3 font-medium">Dias em atraso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.late_orders.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text)]">{row.client ?? '—'}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{row.deadline ? new Date(row.deadline).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-3 py-2.5 font-semibold text-rose-300">{row.days_late}d</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

function StoreTab({ data }: { data: AnalyticsStoreResponse }) {
    return (
        <div className="space-y-6">
            {!data.store_active && (
                <div className="rounded-md border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    A loja pública está desativada. Ative em Ajustes → Loja para começar a receber pedidos.
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                {[
                    { label: 'Receita', value: formatCurrencyFromCents(data.revenue_cents) },
                    { label: 'Pedidos aprovados', value: String(data.orders_count) },
                    { label: 'Ticket médio', value: formatCurrencyFromCents(data.average_ticket_cents) },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border-white/5 bg-[#131316]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text-secondary)]">{kpi.label}</p>
                        <p className="mt-3 font-serif text-[28px] font-semibold leading-none text-[color:var(--orion-text)]">{kpi.value}</p>
                    </Card>
                ))}
            </div>

            <Card title="Top produtos da loja" className="border-white/5 bg-[#131316]">
                {data.top_products.length === 0 ? (
                    <EmptyState title="Sem vendas na loja" description="Nenhum pedido aprovado no período selecionado." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/5 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                    <th className="px-3 py-3 font-medium">Produto</th>
                                    <th className="px-3 py-3 font-medium">Qtd</th>
                                    <th className="px-3 py-3 font-medium">Receita</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.top_products.map((row, i) => (
                                    <tr key={`store-prod-${i}`}>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text)]">{row.product}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{row.quantity}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text)]">{formatCurrencyFromCents(row.revenue_cents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card title="Status dos pedidos da loja" className="border-white/5 bg-[#131316]">
                {data.status_breakdown.length === 0 ? (
                    <EmptyState title="Sem pedidos" description="Sem pedidos na loja para o período." />
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {data.status_breakdown.map((row) => (
                            <div key={row.status} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[color:var(--orion-elevated)] px-3 py-2">
                                <span className="h-2 w-2 rounded-full bg-brand-gold" />
                                <span className="text-[12px] font-semibold text-[color:var(--orion-text)]">{row.count}</span>
                                <span className="text-[11px] text-[color:var(--orion-text-secondary)]">{row.status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

function AgentsTab({ data }: { data: AnalyticsAgentsResponse }) {
    return (
        <div className="space-y-6">
            {data.agents.length === 0 ? (
                <EmptyState title="Sem dados de atendimento" description="Nenhum atendente com conversas no período selecionado." />
            ) : (
                <Card title="Ranking de atendentes" description="Atendentes com conversas assumidas no período." className="border-white/5 bg-[#131316]">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/5 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                    <th className="px-3 py-3 font-medium">#</th>
                                    <th className="px-3 py-3 font-medium">Atendente</th>
                                    <th className="px-3 py-3 font-medium">Conversas</th>
                                    <th className="px-3 py-3 font-medium">Mensagens</th>
                                    <th className="px-3 py-3 font-medium">Leads convertidos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.agents.map((agent, i) => (
                                    <tr key={agent.id}>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-muted)]">#{i + 1}</td>
                                        <td className="px-3 py-2.5 font-semibold text-[color:var(--orion-text)]">{agent.name}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{agent.conversations_handled}</td>
                                        <td className="px-3 py-2.5 text-[color:var(--orion-text-secondary)]">{agent.messages_sent}</td>
                                        <td className="px-3 py-2.5 text-emerald-300">{agent.leads_converted}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

export function AnalyticsClient({
    sales,
    leads,
    production,
    store,
    agents,
    filters,
    initialTab,
    hasExplicitFilters,
    error,
}: {
    sales: AnalyticsSalesResponse | null;
    leads: AnalyticsLeadsResponse;
    production: AnalyticsProductionResponse;
    store: AnalyticsStoreResponse;
    agents: AnalyticsAgentsResponse;
    filters: {
        period: AnalyticsPeriod;
        from?: string;
        to?: string;
    };
    initialTab: AnalyticsTab;
    hasExplicitFilters: boolean;
    error?: string | null;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [hasMounted, setHasMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);
    const [customFrom, setCustomFrom] = useState(filters.from ?? sales?.period.from ?? '');
    const [customTo, setCustomTo] = useState(filters.to ?? sales?.period.to ?? '');
    const [hasRestoredSavedFilters, setHasRestoredSavedFilters] = useState(hasExplicitFilters);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        const savedTab = window.localStorage.getItem('analytics.activeTab');
        if (!savedTab) {
            return;
        }

        if (TAB_OPTIONS.some((tab) => tab.value === savedTab)) {
            setActiveTab(savedTab as AnalyticsTab);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem('analytics.activeTab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        window.localStorage.setItem('analytics.sales.filters', JSON.stringify({
            period: filters.period,
            from: filters.from ?? '',
            to: filters.to ?? '',
        }));
    }, [filters.from, filters.period, filters.to]);

    useEffect(() => {
        if (hasRestoredSavedFilters) {
            return;
        }

        const rawValue = window.localStorage.getItem('analytics.sales.filters');
        if (!rawValue) {
            setHasRestoredSavedFilters(true);
            return;
        }

        try {
            const saved = JSON.parse(rawValue) as { period?: AnalyticsPeriod; from?: string; to?: string };
            const nextParams = new URLSearchParams();
            const period = saved.period ?? '30d';
            nextParams.set('tab', 'sales');
            nextParams.set('periodo', period);

            if (period === 'custom' && saved.from && saved.to) {
                nextParams.set('from', saved.from);
                nextParams.set('to', saved.to);
            }

            const currentParams = new URLSearchParams();
            currentParams.set('tab', initialTab);
            currentParams.set('periodo', filters.period);
            if (filters.period === 'custom' && filters.from && filters.to) {
                currentParams.set('from', filters.from);
                currentParams.set('to', filters.to);
            }

            setHasRestoredSavedFilters(true);
            if (nextParams.toString() !== currentParams.toString()) {
                startTransition(() => {
                    router.replace(`/analytics?${nextParams.toString()}`, { scroll: false });
                });
            }
        } catch {
            setHasRestoredSavedFilters(true);
        }
    }, [filters.from, filters.period, filters.to, hasRestoredSavedFilters, initialTab, router, startTransition]);

    function navigateToSales(next: { period: AnalyticsPeriod; from?: string; to?: string }) {
        const params = new URLSearchParams();
        params.set('tab', 'sales');
        params.set('periodo', next.period);

        if (next.period === 'custom' && next.from && next.to) {
            params.set('from', next.from);
            params.set('to', next.to);
        }

        setActiveTab('sales');
        startTransition(() => {
            router.replace(`/analytics?${params.toString()}`, { scroll: false });
        });
    }

    function applyCustomRange() {
        if (!customFrom || !customTo) {
            return;
        }

        navigateToSales({
            period: 'custom',
            from: customFrom,
            to: customTo,
        });
    }

    if (!hasMounted) {
        return (
            <div className="overflow-hidden rounded-[24px] border border-white/5 bg-[#0F0F11] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                <div className="border-b border-white/5 bg-[#0A0A0C] px-6 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-2">
                            <div className="h-3 w-20 rounded-full bg-white/10" />
                            <div className="h-8 w-40 rounded-full bg-white/10" />
                            <div className="h-4 w-64 rounded-full bg-white/5" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <div className="h-11 w-64 rounded-[10px] bg-white/5" />
                            <div className="h-11 w-80 rounded-[10px] bg-white/5" />
                            <div className="h-11 w-28 rounded-[10px] bg-white/5" />
                        </div>
                    </div>
                </div>

                <div className="border-b border-white/5 px-6 pt-4">
                    <div className="flex gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={`analytics-tab-skeleton-${index}`} className="h-10 w-24 rounded-t-[10px] bg-white/5" />
                        ))}
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={`analytics-kpi-skeleton-${index}`}
                                className="h-[154px] rounded-2xl border border-white/10 bg-[#131316]"
                            />
                        ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
                        <div className="h-[420px] rounded-2xl border border-white/10 bg-[#131316]" />
                        <div className="h-[420px] rounded-2xl border border-white/10 bg-[#131316]" />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <div className="h-[380px] rounded-2xl border border-white/10 bg-[#131316]" />
                        <div className="h-[380px] rounded-2xl border border-white/10 bg-[#131316]" />
                    </div>

                    <div className="h-[360px] rounded-2xl border border-white/10 bg-[#131316]" />
                </div>
            </div>
        );
    }

    const revenueFilename = sales ? `analytics-vendas-${sales.period.from}-${sales.period.to}.csv` : 'analytics-vendas.csv';
    const activeTabLabel = TAB_OPTIONS.find((tab) => tab.value === activeTab)?.label ?? 'Analytics';
    const periodLabel = sales
        ? `${sales.period.from} até ${sales.period.to}`
        : `${filters.period}`;

    return (
        <div className="overflow-hidden rounded-[24px] border border-white/5 bg-[#0F0F11] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/5 bg-[#0A0A0C] px-6 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-muted)]">ORION CRM</p>
                        <h1 className="mt-1 font-serif text-[22px] font-semibold text-[color:var(--orion-text)]">
                            Analytics
                        </h1>
                        <p className="mt-1 text-sm text-[color:var(--orion-text-secondary)]">
                            {activeTabLabel} · {periodLabel}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex flex-wrap rounded-[10px] border border-white/10 bg-[#131316] p-1">
                            {PERIOD_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => navigateToSales({ period: option.value })}
                                    className={cn(
                                        'rounded-[8px] px-3 py-2 text-[12px] font-medium transition',
                                        filters.period === option.value
                                            ? 'bg-brand-gold text-black'
                                            : 'text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-white/10 bg-[#131316] px-3 py-2">
                            <Input
                                type="date"
                                value={customFrom}
                                onChange={(event) => setCustomFrom(event.target.value)}
                                className="h-9 min-w-[145px] border-white/10 bg-[#0F0F11]"
                            />
                            <Input
                                type="date"
                                value={customTo}
                                onChange={(event) => setCustomTo(event.target.value)}
                                className="h-9 min-w-[145px] border-white/10 bg-[#0F0F11]"
                            />
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={applyCustomRange}
                                className="rounded-[8px] border border-white/10 px-3 py-2 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] transition hover:border-brand-gold/30 hover:text-brand-gold disabled:opacity-40"
                            >
                                Aplicar
                            </button>
                        </div>

                        <button
                            type="button"
                            disabled={!sales}
                            onClick={() => sales && downloadCsv(revenueFilename, sales.tables.top_products)}
                            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 px-4 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] transition hover:border-brand-gold/30 hover:text-brand-gold"
                        >
                            <Download className="h-4 w-4" />
                            Exportar
                        </button>
                    </div>
                </div>
            </div>

            <div className="border-b border-white/5 px-6 pt-4">
                <div className="flex flex-wrap gap-1">
                    {TAB_OPTIONS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={cn(
                                'inline-flex h-10 items-center gap-2 border-b-2 px-4 text-[12px] font-medium transition',
                                activeTab === tab.value
                                    ? 'border-brand-gold text-[color:var(--orion-text)]'
                                    : 'border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            )}
                        >
                            {activeTab === tab.value ? <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" /> : null}
                            {tab.label}
                            {!tab.available ? <span className="text-[10px] text-[color:var(--orion-text-muted)]">em breve</span> : null}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-6 p-6">
                {error ? (
                    <div className="rounded-md border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                        {error}
                    </div>
                ) : null}

                {activeTab === 'leads' && <LeadsTab data={leads} />}
                {activeTab === 'production' && <ProductionTab data={production} />}
                {activeTab === 'store' && <StoreTab data={store} />}
                {activeTab === 'agents' && <AgentsTab data={agents} />}

                {activeTab === 'sales' && !sales ? (
                    <EmptyState title="Erro ao carregar dados de vendas" description="Tente recarregar a página." />
                ) : null}

                {activeTab === 'sales' && sales !== null ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <AnalyticsKpiCard
                            label="Faturamento"
                            icon={<CircleDollarSign className="h-4 w-4" />}
                            value={formatCurrencyFromCents(sales.kpis.revenue.value_cents)}
                            trend={sales.kpis.revenue.delta_percent}
                            helper={`Comparativo ${sales.period.comparison_from} → ${sales.period.comparison_to}`}
                        />
                        <AnalyticsKpiCard
                            label="Pedidos"
                            icon={<ShoppingCart className="h-4 w-4" />}
                            value={String(sales.kpis.orders.value)}
                            trend={sales.kpis.orders.delta_percent}
                            helper="Pedidos operacionais e da loja no período"
                        />
                        <AnalyticsKpiCard
                            label="Ticket Médio"
                            icon={<Gift className="h-4 w-4" />}
                            value={formatCurrencyFromCents(sales.kpis.average_ticket.value_cents)}
                            trend={sales.kpis.average_ticket.delta_percent}
                            helper="Receita / pedidos pagos ou aprovados"
                        />
                        <AnalyticsKpiCard
                            label="Taxa de Cancelamento"
                            icon={<Ban className="h-4 w-4" />}
                            value={formatPercent(sales.kpis.cancellation_rate.value_percent)}
                            trend={sales.kpis.cancellation_rate.delta_percent}
                            helper="Queda na taxa é leitura positiva"
                            inverted
                        />
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
                        <Card
                            title="Faturamento por período"
                            description={`Atual ${sales.period.from} → ${sales.period.to} contra a janela anterior.`}
                            className="min-w-0 border-white/5 bg-[#131316]"
                        >
                            <div className="h-[340px] min-h-[340px] w-full min-w-0">
                                {!hasMounted ? (
                                    <div className="h-full rounded-2xl border border-white/10 bg-[color:var(--orion-base)]" />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={200}>
                                    <LineChart data={sales.charts.revenue_timeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="label" stroke="#A09A94" />
                                        <YAxis
                                            stroke="#A09A94"
                                            tickFormatter={(value) => `R$ ${(Number(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`}
                                        />
                                        <Tooltip content={<RevenueTooltip />} />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="current_cents"
                                            name="Período atual"
                                            stroke="#C8A97A"
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="previous_cents"
                                            name="Período anterior"
                                            stroke="#9CA3AF"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </Card>

                        <Card
                            title="Leitura executiva"
                            description="Resumo do que mudou quando comparado com a janela imediatamente anterior."
                            className="border-white/5 bg-[#131316]"
                        >
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-[color:var(--orion-elevated)] p-4">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
                                            <LineChartIcon className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-[color:var(--orion-text)]">Período ativo</p>
                                            <p className="text-sm text-[color:var(--orion-text-secondary)]">{sales.period.from} até {sales.period.to}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
                                    <div className="flex items-center gap-3">
                                        <TrendingUp className="h-5 w-5 text-emerald-200" />
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-100">Receita</p>
                                            <p className="text-sm text-emerald-200">{formatTrend(sales.kpis.revenue.delta_percent)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4">
                                    <div className="flex items-center gap-3">
                                        <TrendingDown className="h-5 w-5 text-rose-200" />
                                        <div>
                                            <p className="text-sm font-semibold text-rose-100">Cancelamentos</p>
                                            <p className="text-sm text-rose-200">{formatTrend(sales.kpis.cancellation_rate.delta_percent)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        </div>

                        <div className="grid gap-6 xl:grid-cols-2">
                        <Card title="Faturamento por canal" description="Loja online separada da operação manual." className="min-w-0">
                            <div className="h-[320px] min-h-[320px] w-full min-w-0">
                                {!hasMounted ? (
                                    <div className="h-full rounded-2xl border border-white/10 bg-[color:var(--orion-base)]" />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={200}>
                                    <BarChart data={sales.charts.revenue_by_channel}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="channel" stroke="#A09A94" />
                                        <YAxis
                                            stroke="#A09A94"
                                            tickFormatter={(value) => `R$ ${(Number(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`}
                                        />
                                        <Tooltip
                                            formatter={(value) => formatTooltipCurrency(value)}
                                            cursor={{ fill: 'rgba(191,160,106,0.08)' }}
                                        />
                                        <Bar dataKey="revenue_cents" name="Receita" fill="#C8A97A" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </Card>

                        <Card title="Top categorias por receita" description="Categorias que mais puxaram faturamento neste recorte." className="min-w-0 border-white/5 bg-[#131316]">
                            <div className="h-[320px] min-h-[320px] w-full min-w-0">
                                {!hasMounted ? (
                                    <div className="h-full rounded-2xl border border-white/10 bg-[color:var(--orion-base)]" />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={200}>
                                    <BarChart data={sales.charts.top_categories} layout="vertical" margin={{ left: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis
                                            type="number"
                                            stroke="#A09A94"
                                            tickFormatter={(value) => `R$ ${(Number(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`}
                                        />
                                        <YAxis type="category" dataKey="category" stroke="#A09A94" width={110} />
                                        <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                                        <Bar dataKey="revenue_cents" name="Receita" fill="#8B6B3F" radius={[0, 8, 8, 0]} />
                                    </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </Card>
                        </div>

                        <Card title="Top produtos mais vendidos" description="Tabela exportável da tab de vendas." className="border-white/5 bg-[#131316]">
                        {sales.tables.top_products.length === 0 ? (
                            <EmptyState
                                title="Sem vendas no período"
                                description="Assim que pedidos pagos ou aprovados entrarem na janela escolhida, o ranking aparece aqui."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-canvas-border text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                            <th className="px-3 py-3 font-medium">Produto</th>
                                            <th className="px-3 py-3 font-medium">Categoria</th>
                                            <th className="px-3 py-3 font-medium">Qtd Vendida</th>
                                            <th className="px-3 py-3 font-medium">Receita</th>
                                            <th className="px-3 py-3 font-medium">% do total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-canvas-border">
                                        {sales.tables.top_products.map((row) => (
                                            <tr key={`${row.product}-${row.category}`} className="bg-white/70">
                                                <td className="px-3 py-3 font-medium text-[color:var(--orion-text)]">{row.product}</td>
                                                <td className="px-3 py-3 text-[color:var(--orion-text-secondary)]">{row.category}</td>
                                                <td className="px-3 py-3 text-[color:var(--orion-text-secondary)]">{row.quantity}</td>
                                                <td className="px-3 py-3 text-[color:var(--orion-text)]">{formatCurrencyFromCents(row.revenue_cents)}</td>
                                                <td className="px-3 py-3 text-[color:var(--orion-text-secondary)]">{formatPercent(row.share_percent)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        </Card>
                    </>
                ) : null}
            </div>
        </div>
    );
}
