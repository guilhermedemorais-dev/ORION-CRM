import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ApiListResponse, CustomerRecord, LeadRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';

export default async function DashboardPage() {
    let leads: LeadRecord[] = [];
    let customers: CustomerRecord[] = [];

    try {
        const [leadResponse, customerResponse] = await Promise.all([
            apiRequest<ApiListResponse<LeadRecord>>('/leads?limit=100'),
            apiRequest<ApiListResponse<CustomerRecord>>('/customers?limit=100'),
        ]);

        leads = leadResponse.data;
        customers = customerResponse.data;
    } catch {
        leads = [];
        customers = [];
    }

    const openLeads = leads.filter((lead) => !['CONVERTIDO', 'PERDIDO'].includes(lead.stage)).length;
    const newLeads = leads.filter((lead) => lead.stage === 'NOVO').length;
    const qualifiedLeads = leads.filter((lead) => lead.stage === 'QUALIFICADO').length;
    const customerValue = customers.reduce((total, customer) => total + customer.lifetime_value_cents, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Dashboard"
                description="Resumo operacional rápido para o time comercial e de atendimento."
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Leads em aberto" value={String(openLeads)} helper="Pipeline ativo em acompanhamento" />
                <KpiCard label="Leads novos" value={String(newLeads)} helper="Entradas que ainda pedem triagem" />
                <KpiCard label="Qualificados" value={String(qualifiedLeads)} helper="Prontos para proposta ou follow-up" />
                <KpiCard
                    label="Lifetime value"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(customerValue / 100)}
                    helper="Total acumulado dos clientes na base"
                />
            </div>
        </div>
    );
}
