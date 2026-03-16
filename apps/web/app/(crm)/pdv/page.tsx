import type { ApiListResponse, ProductRecord, PublicSettings } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';
import { PdvClient } from '@/components/modules/pdv/PdvClient';

export default async function PdvPage() {
    const session = requireSession();

    if (!['ADMIN', 'ATENDENTE'].includes(session.user.role)) {
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

    return (
        <PdvClient
            userName={session.user.name}
            userRole={session.user.role}
            initialProducts={productResponse.data}
            initialSettings={settingsResponse}
        />
    );
}
