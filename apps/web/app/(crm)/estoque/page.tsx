import EstoqueClient from '@/components/modules/estoque/EstoqueClient';
import type { ApiListResponse } from '@/lib/api';
import { apiRequest } from '@/lib/api';

interface ProductRecord {
  id: string; code: string; name: string;
  category: string | null; collection: string | null; description: string | null;
  price_cents: number; cost_price_cents: number;
  stock_quantity: number; minimum_stock: number;
  metal: string | null; weight_grams: number | null;
  location: string | null; size_info: string | null; stones: string | null;
  photo_url: string | null; is_active: boolean; pdv_enabled: boolean;
  requires_production: boolean; is_low_stock: boolean;
  created_at: string; updated_at: string;
}

interface StatsRecord {
  active: number; critical: number; out_of_stock: number; total_cost_cents: number;
}

export default async function EstoquePage() {
  const [listResponse, stats] = await Promise.all([
    apiRequest<ApiListResponse<ProductRecord>>('/products?limit=20&sort=updated_at&dir=desc').catch(() => ({
      data: [], meta: { total: 0, page: 1, limit: 20, pages: 1 },
    })),
    apiRequest<StatsRecord>('/products/stats').catch(() => ({
      active: 0, critical: 0, out_of_stock: 0, total_cost_cents: 0,
    })),
  ]);

  return (
    <EstoqueClient
      initialProducts={listResponse.data}
      initialMeta={listResponse.meta}
      initialStats={stats}
    />
  );
}
