import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import type { DashboardPayload } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatCurrencyFromCents, formatDate } from '@/lib/utils';

const KPI_LABELS: Record<string, string> = {
    leads_today: 'Leads hoje',
    open_orders: 'Pedidos em aberto',
    overdue_production: 'Produção atrasada',
    month_revenue_cents: 'Faturamento do mês',
    stock_alerts: 'Alertas de estoque',
    my_leads: 'Meus leads',
    my_orders: 'Meus pedidos',
    waiting_inbox: 'Inbox pendente',
    estimated_commission_cents: 'Comissão estimada',
    assigned_orders: 'Ordens atribuídas',
    overdue_orders: 'Ordens atrasadas',
    open_queue: 'Fila aberta',
    steps_completed_today: 'Etapas hoje',
    month_in_cents: 'Entradas do mês',
    month_out_cents: 'Saídas do mês',
    balance_cents: 'Saldo do mês',
    pending_payments: 'Pagamentos pendentes',
};

const KPI_HELPERS: Record<string, string> = {
    leads_today: 'Captação do dia atual',
    open_orders: 'Pedidos ainda não finalizados',
    overdue_production: 'Ordens com prazo vencido',
    month_revenue_cents: 'Entradas financeiras do mês',
    stock_alerts: 'Produtos no mínimo ou abaixo',
    my_leads: 'Leads sob responsabilidade do usuário',
    my_orders: 'Pedidos no escopo comercial do usuário',
    waiting_inbox: 'Conversas aguardando ação humana',
    estimated_commission_cents: 'Comissão prevista do mês',
    assigned_orders: 'Ordens da bancada do usuário',
    overdue_orders: 'Ordens em atraso no próprio escopo',
    open_queue: 'Fila livre para assumir',
    steps_completed_today: 'Etapas concluídas hoje',
    month_in_cents: 'Recebimentos acumulados no mês',
    month_out_cents: 'Despesas acumuladas no mês',
    balance_cents: 'Saldo líquido do mês',
    pending_payments: 'Cobranças ainda em aberto',
};

function formatKpiValue(key: string, value: number): string {
    if (key.endsWith('_cents')) {
        return formatCurrencyFromCents(value);
    }

    return String(value);
}

function roleTitle(role: DashboardPayload['role']): string {
    if (role === 'ADMIN') return 'Visão executiva da operação';
    if (role === 'ATENDENTE') return 'Visão comercial e de atendimento';
    if (role === 'PRODUCAO') return 'Visão da produção e da fila';
    return 'Visão financeira do mês';
}

export default async function DashboardPage() {
    let dashboard: DashboardPayload | null = null;

    try {
        dashboard = await apiRequest<DashboardPayload>('/dashboard');
    } catch {
        dashboard = null;
    }

    if (!dashboard) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Dashboard"
                    description="Resumo operacional por perfil."
                />
                <Card title="Painel indisponível" description="Não foi possível carregar os indicadores do dashboard agora.">
                    <p className="text-sm text-gray-500">
                        O restante do CRM segue operacional. Tente novamente em instantes.
                    </p>
                </Card>
            </div>
        );
    }

    const kpiEntries = Object.entries(dashboard.kpis);
    const alertEntries = Object.entries(dashboard.alerts).filter(([, value]) => value > 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Dashboard"
                description={roleTitle(dashboard.role)}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {kpiEntries.map(([key, value]) => (
                    <KpiCard
                        key={key}
                        label={KPI_LABELS[key] ?? key}
                        value={formatKpiValue(key, value)}
                        helper={KPI_HELPERS[key]}
                    />
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card title="Atividade recente" description="Últimos eventos consolidados para acompanhamento operacional.">
                    {dashboard.activity.length === 0 ? (
                        <p className="text-sm text-gray-500">Sem eventos recentes neste escopo.</p>
                    ) : (
                        <div className="space-y-3">
                            {dashboard.activity.map((entry, index) => (
                                <article key={`${entry.kind}-${entry.label}-${index}`} className="rounded-lg border border-canvas-border bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                                            {entry.kind}
                                        </span>
                                        <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-gray-900">{entry.label}</p>
                                </article>
                            ))}
                        </div>
                    )}
                </Card>

                <Card title="Alertas" description="Itens que pedem ação mais rápida neste momento.">
                    {alertEntries.length === 0 ? (
                        <p className="text-sm text-gray-500">Sem alertas ativos no escopo atual.</p>
                    ) : (
                        <div className="space-y-3">
                            {alertEntries.map(([key, value]) => (
                                <div key={key} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
                                        {KPI_LABELS[key] ?? key}
                                    </p>
                                    <p className="mt-2 text-2xl font-semibold text-amber-900">{value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
