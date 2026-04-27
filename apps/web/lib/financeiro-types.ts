export type FinancePeriod = '7d' | 'mes' | 'trimestre' | 'ano';
export type FinanceLaunchFilter = 'todos' | 'receitas' | 'despesas' | 'pendentes';
export type FinanceLaunchStatus = 'confirmado' | 'pendente';

export interface FinanceDashboardMetric {
    total_cents: number;
    delta_percent: number;
    count?: number;
    ticket_medio_cents?: number;
    attendants?: number;
    due_date?: string;
}

export interface FinanceBarPoint {
    label: string;
    receitas_cents: number;
    despesas_cents: number;
}

export interface FinancePiePoint {
    categoria: string;
    valor_cents: number;
    percentual: number;
}

export interface FinanceDashboardResponse {
    periodo: FinancePeriod;
    receitas: FinanceDashboardMetric;
    despesas: FinanceDashboardMetric;
    saldo: FinanceDashboardMetric;
    comissoes: FinanceDashboardMetric;
    grafico_barras: FinanceBarPoint[];
    grafico_pizza: FinancePiePoint[];
}

export interface FinanceCommissionRecord {
    user_id: string;
    nome: string;
    vendas: number;
    total_vendido_cents: number;
    comissao_cents: number;
    percentual: number;
}

export interface FinanceLaunchRecord {
    id: string;
    source_id: string;
    status: FinanceLaunchStatus;
    type: 'ENTRADA' | 'SAIDA';
    description: string;
    category: string;
    payment_method: string | null;
    amount_cents: number;
    competence_date: string;
    created_at: string;
    receipt_url: string | null;
    responsible: {
        id: string;
        name: string;
    } | null;
    reference: {
        order_id: string | null;
        order_number: string | null;
        payment_id: string | null;
    };
}

export interface FinanceLaunchesResponse {
    data: FinanceLaunchRecord[];
    meta: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}
