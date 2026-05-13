import type { ApiListResponse, ProductRecord, PublicSettings } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';
import { PdvClient } from '@/components/modules/pdv/PdvClient';

interface CustomerLite {
    id: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
    cpf: string | null;
}

interface PageProps {
    searchParams?: { customer_id?: string };
}

export default async function PdvPage({ searchParams }: PageProps) {
    const session = requireSession();

    if (!['ROOT', 'ADMIN', 'ATENDENTE'].includes(session.user.role)) {
        return (
            <EmptyState
                title="Acesso restrito"
                description="O PDV é restrito aos perfis ADMIN e ATENDENTE."
            />
        );
    }

    const [productResponse, settingsResponse] = await Promise.all([
        apiRequest<ApiListResponse<ProductRecord>>('/products?limit=100'),
        apiRequest<PublicSettings>('/settings/public').catch(() => null),
    ]);

    // Cliente pré-selecionado via ?customer_id= (vem do botão "Faturar no PDV"
    // da ficha do cliente). Falha silenciosa: se não encontrar, abre PDV sem cliente.
    let preselectedCustomer: CustomerLite | null = null;
    if (searchParams?.customer_id) {
        try {
            preselectedCustomer = await apiRequest<CustomerLite>(`/customers/${searchParams.customer_id}`);
        } catch {
            preselectedCustomer = null;
        }
    }

    return (
        <PdvClient
            userName={session.user.name}
            userRole={session.user.role}
            initialProducts={productResponse.data}
            initialSettings={settingsResponse}
            initialCustomer={preselectedCustomer}
        />
    );
}
