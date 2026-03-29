import { AnalyticsClient } from '@/components/modules/analytics/AnalyticsClient';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type {
    AnalyticsAgentsResponse,
    AnalyticsLeadsResponse,
    AnalyticsPeriod,
    AnalyticsProductionResponse,
    AnalyticsSalesResponse,
    AnalyticsStoreResponse,
    AnalyticsTab,
} from '@/lib/analytics-types';

const PERIOD_VALUES: AnalyticsPeriod[] = ['7d', '30d', '90d', '12m', 'custom'];
const TAB_VALUES: AnalyticsTab[] = ['sales', 'leads', 'production', 'store', 'agents'];

const EMPTY_LEADS: AnalyticsLeadsResponse = {
    period: { from: '', to: '' },
    funnel: [],
    lost_leads: [],
    new_leads_count: 0,
    converted_count: 0,
    lost_count: 0,
    conversion_rate_percent: 0,
};

const EMPTY_PRODUCTION: AnalyticsProductionResponse = {
    period: { from: '', to: '' },
    status_distribution: [],
    late_orders: [],
    total_orders: 0,
    completed_count: 0,
    in_progress_count: 0,
    late_count: 0,
};

const EMPTY_STORE: AnalyticsStoreResponse = {
    period: { from: '', to: '' },
    store_active: false,
    revenue_cents: 0,
    orders_count: 0,
    average_ticket_cents: 0,
    top_products: [],
    status_breakdown: [],
};

const EMPTY_AGENTS: AnalyticsAgentsResponse = {
    period: { from: '', to: '' },
    agents: [],
};

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const session = requireSession();

    if (!['ROOT', 'ADMIN'].includes(session.user.role)) {
        return (
            <EmptyState
                title="Acesso restrito"
                description="O módulo de analytics é restrito ao perfil ADMIN."
            />
        );
    }

    const requestedPeriod = typeof searchParams?.periodo === 'string' ? searchParams.periodo : undefined;
    const period = PERIOD_VALUES.includes((requestedPeriod ?? '30d') as AnalyticsPeriod)
        ? (requestedPeriod ?? '30d') as AnalyticsPeriod
        : '30d';
    const from = typeof searchParams?.from === 'string' ? searchParams.from : undefined;
    const to = typeof searchParams?.to === 'string' ? searchParams.to : undefined;
    const tab = typeof searchParams?.tab === 'string' && TAB_VALUES.includes(searchParams.tab as AnalyticsTab)
        ? searchParams.tab as AnalyticsTab
        : 'sales';
    const hasExplicitFilters = Boolean(requestedPeriod || from || to);

    const query = new URLSearchParams();
    query.set('periodo', period);
    if (period === 'custom' && from && to) {
        query.set('from', from);
        query.set('to', to);
    }
    const qs = query.toString();

    const [sales, leads, production, store, agents] = await Promise.allSettled([
        apiRequest<AnalyticsSalesResponse>(`/analytics/sales?${qs}`),
        apiRequest<AnalyticsLeadsResponse>(`/analytics/leads?${qs}`),
        apiRequest<AnalyticsProductionResponse>(`/analytics/production?${qs}`),
        apiRequest<AnalyticsStoreResponse>(`/analytics/store?${qs}`),
        apiRequest<AnalyticsAgentsResponse>(`/analytics/agents?${qs}`),
    ]);

    return (
        <AnalyticsClient
            sales={sales.status === 'fulfilled' ? sales.value : null}
            leads={leads.status === 'fulfilled' ? leads.value : EMPTY_LEADS}
            production={production.status === 'fulfilled' ? production.value : EMPTY_PRODUCTION}
            store={store.status === 'fulfilled' ? store.value : EMPTY_STORE}
            agents={agents.status === 'fulfilled' ? agents.value : EMPTY_AGENTS}
            filters={{ period, from, to }}
            initialTab={tab}
            hasExplicitFilters={hasExplicitFilters}
            error={sales.status === 'rejected' ? String(sales.reason) : null}
        />
    );
}
