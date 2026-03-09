import { FinanceiroClient } from '@/components/modules/finance/FinanceiroClient';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type {
    FinanceCommissionRecord,
    FinanceDashboardResponse,
    FinanceLaunchFilter,
    FinanceLaunchesResponse,
    FinancePeriod,
} from '@/lib/financeiro-types';

function getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default async function FinancialPage({
    searchParams,
}: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const session = requireSession();

    if (!['ADMIN', 'FINANCEIRO'].includes(session.user.role)) {
        return (
            <EmptyState
                title="Acesso restrito"
                description="O módulo financeiro é restrito aos perfis ADMIN e FINANCEIRO."
            />
        );
    }

    const period = (typeof searchParams?.periodo === 'string' && ['7d', 'mes', 'trimestre', 'ano'].includes(searchParams.periodo))
        ? searchParams.periodo as FinancePeriod
        : 'mes';
    const type = (typeof searchParams?.tipo === 'string' && ['todos', 'receitas', 'despesas', 'pendentes'].includes(searchParams.tipo))
        ? searchParams.tipo as FinanceLaunchFilter
        : 'todos';
    const page = typeof searchParams?.page === 'string'
        ? Math.max(1, Number.parseInt(searchParams.page, 10) || 1)
        : 1;
    const search = typeof searchParams?.search === 'string' ? searchParams.search.trim() : '';
    const error = typeof searchParams?.error === 'string' ? searchParams.error : null;

    const query = new URLSearchParams({
        periodo: period,
        tipo: type,
        page: String(page),
    });

    if (search) {
        query.set('search', search);
    }

    const [dashboard, commissions, launches] = await Promise.all([
        apiRequest<FinanceDashboardResponse>(`/financeiro/dashboard?periodo=${period}`),
        apiRequest<FinanceCommissionRecord[]>(`/financeiro/comissoes?periodo=${period}`),
        apiRequest<FinanceLaunchesResponse>(`/financeiro/lancamentos?${query.toString()}`),
    ]);

    return (
        <FinanceiroClient
            dashboard={dashboard}
            commissions={commissions}
            launches={launches}
            filters={{ period, type, search }}
            todayDate={getTodayDate()}
            error={error}
        />
    );
}
