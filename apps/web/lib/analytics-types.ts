export type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m' | 'custom';
export type AnalyticsTab = 'sales' | 'leads' | 'production' | 'store' | 'agents';

export interface AnalyticsLeadsResponse {
    period: { from: string; to: string };
    funnel: Array<{ stage: string; count: number; percent: number }>;
    lost_leads: Array<{ name: string | null; phone: string | null; lost_at: string; reason: string | null }>;
    new_leads_count: number;
    converted_count: number;
    lost_count: number;
    conversion_rate_percent: number;
}

export interface AnalyticsProductionResponse {
    period: { from: string; to: string };
    status_distribution: Array<{ status: string; count: number; percent: number }>;
    late_orders: Array<{ id: string; client: string | null; deadline: string | null; days_late: number }>;
    total_orders: number;
    completed_count: number;
    in_progress_count: number;
    late_count: number;
}

export interface AnalyticsStoreResponse {
    period: { from: string; to: string };
    store_active: boolean;
    revenue_cents: number;
    orders_count: number;
    average_ticket_cents: number;
    top_products: Array<{ product: string; quantity: number; revenue_cents: number }>;
    status_breakdown: Array<{ status: string; count: number }>;
}

export interface AnalyticsAgentsResponse {
    period: { from: string; to: string };
    agents: Array<{
        id: string;
        name: string;
        conversations_handled: number;
        messages_sent: number;
        avg_response_time_min: number | null;
        leads_converted: number;
    }>;
}

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
