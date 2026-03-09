import { redirect } from 'next/navigation';
import { StoreSettingsClient } from '@/components/modules/store/StoreSettingsClient';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type {
    StoreAdminCategory,
    StoreAdminConfig,
    StoreAdminOrder,
    StoreAdminProduct,
} from '@/lib/store-types';
import type { ApiListResponse, ProductRecord } from '@/lib/api';

export default async function StoreSettingsPage() {
    const session = requireSession();

    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    const [config, categories, products, orders, stockProducts] = await Promise.all([
        apiRequest<StoreAdminConfig>('/settings/store'),
        apiRequest<{ data: StoreAdminCategory[] }>('/settings/store/categories'),
        apiRequest<{ data: StoreAdminProduct[] }>('/settings/store/products'),
        apiRequest<{ data: StoreAdminOrder[] }>('/settings/store/orders'),
        apiRequest<ApiListResponse<ProductRecord>>('/products?limit=100'),
    ]);

    return (
        <StoreSettingsClient
            initialConfig={config}
            initialCategories={categories.data}
            initialProducts={products.data}
            initialOrders={orders.data}
            stockProducts={stockProducts.data}
            simulationEnabled={process.env.NODE_ENV !== 'production'}
        />
    );
}
