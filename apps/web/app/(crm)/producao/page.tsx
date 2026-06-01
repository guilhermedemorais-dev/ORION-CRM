import ProducaoClient from '@/components/modules/producao/ProducaoClient';
import type { ApiListResponse, ProductionOrderRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface UserListItem { id: string; name: string }

const MANAGE_ROLES = new Set(['ROOT', 'ADMIN']);

export default async function ProductionPage() {
    const session = getSession();
    const role = session?.user.role ?? '';
    const canManage = MANAGE_ROLES.has(role);

    const productionResponse = await apiRequest<ApiListResponse<ProductionOrderRecord>>(
        '/production-orders?limit=100'
    ).catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 100, pages: 1 } }));

    // Lista de ourives (usuários de Produção) para o seletor de responsável — só p/ gestores.
    const ourives = canManage
        ? await apiRequest<ApiListResponse<UserListItem>>('/users?role=PRODUCAO')
            .then((r) => r.data.map((u) => ({ id: u.id, name: u.name })))
            .catch(() => [])
        : [];

    return (
        <ProducaoClient
            initialOrders={productionResponse.data}
            ourives={ourives}
            canManage={canManage}
        />
    );
}
