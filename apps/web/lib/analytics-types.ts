export type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m' | 'custom';
export type AnalyticsTab = 'sales' | 'leads' | 'production' | 'store' | 'agents';

export interface AnalyticsSalesResponse {
    period: {
        periodo: AnalyticsPeriod;
        from: string;
        to: string;
        comparison_from: string;
        comparison_to: string;
        bucket: 'day' | 'month';
    };
    kpis: {
        revenue: {
            value_cents: number;
            delta_percent: number;
        };
        orders: {
            value: number;
            delta_percent: number;
        };
        average_ticket: {
            value_cents: number;
            delta_percent: number;
        };
        cancellation_rate: {
            value_percent: number;
            delta_percent: number;
        };
    };
    charts: {
        revenue_timeline: Array<{
            label: string;
            current_cents: number;
            previous_cents: number;
            current_orders: number;
            previous_orders: number;
        }>;
        revenue_by_channel: Array<{
            channel: string;
            revenue_cents: number;
            orders: number;
        }>;
        top_categories: Array<{
            category: string;
            revenue_cents: number;
        }>;
    };
    tables: {
        top_products: Array<{
            product: string;
            category: string;
            quantity: number;
            revenue_cents: number;
            share_percent: number;
        }>;
    };
}
