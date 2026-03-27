import { Card } from '@/components/ui/Card';
import type { DashboardPayload } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { CustomDashboardView } from './components/CustomDashboardView';

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
            <div className="p-6 space-y-6">
                <Card title="Painel indisponível" description="Não foi possível carregar os indicadores do dashboard agora.">
                    <p className="text-sm text-gray-500">
                        O restante do CRM segue operacional. Tente novamente em instantes.
                    </p>
                </Card>
            </div>
        );
    }

    return <CustomDashboardView data={dashboard} />;
}
