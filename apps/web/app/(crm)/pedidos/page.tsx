import { OrdersFlashToast } from '@/app/(crm)/pedidos/OrdersFlashToast';
import PedidosClient from '@/components/modules/pedidos/PedidosClient';
import type { ApiListResponse, CustomerRecord, OrderRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface OrderStatsResponse {
    active: number;
    awaiting_payment: number;
    in_production: number;
    paused: number;
    open_value_cents: number;
}

const COMMERCIAL_ROLES = new Set(['ROOT', 'ADMIN', 'ATENDENTE']);

export default async function OrdersPage({
    searchParams,
}: {
    searchParams?: {
        notice?: string;
        noticeType?: 'success' | 'error';
    };
}) {
    const session = getSession();
    const canCommercial = COMMERCIAL_ROLES.has(session?.user.role ?? '');

    const [ordersResponse, statsResponse, customersResponse] = await Promise.all([
        apiRequest<ApiListResponse<OrderRecord>>('/orders?limit=100').catch(() => ({
            data: [],
            meta: { total: 0, page: 1, limit: 100, pages: 1 },
        })),
        apiRequest<OrderStatsResponse>('/orders/stats').catch(() => ({
            active: 0,
            awaiting_payment: 0,
            in_production: 0,
            paused: 0,
            open_value_cents: 0,
        })),
        apiRequest<ApiListResponse<CustomerRecord>>('/customers?limit=200').catch(() => ({
            data: [],
            meta: { total: 0, page: 1, limit: 200, pages: 1 },
        })),
    ]);

    return (
        <>
            <OrdersFlashToast initialMessage={searchParams?.notice} initialType={searchParams?.noticeType} />
            <PedidosClient
                initialOrders={ordersResponse.data}
                initialStats={statsResponse}
                initialCustomers={customersResponse.data}
                canCommercial={canCommercial}
            />
        </>
    );
}
