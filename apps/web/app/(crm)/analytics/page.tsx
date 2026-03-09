import { AnalyticsClient } from '@/components/modules/analytics/AnalyticsClient';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { AnalyticsPeriod, AnalyticsSalesResponse, AnalyticsTab } from '@/lib/analytics-types';

const PERIOD_VALUES: AnalyticsPeriod[] = ['7d', '30d', '90d', '12m', 'custom'];
const TAB_VALUES: AnalyticsTab[] = ['sales', 'leads', 'production', 'store', 'agents'];

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const session = requireSession();

    if (session.user.role !== 'ADMIN') {
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

    const sales = await apiRequest<AnalyticsSalesResponse>(`/analytics/sales?${query.toString()}`);

    return (
        <AnalyticsClient
            sales={sales}
            filters={{ period, from, to }}
            initialTab={tab}
            hasExplicitFilters={hasExplicitFilters}
        />
    );
}
