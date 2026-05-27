import type { PoolClient } from 'pg';
import { query } from '../db/pool.js';

export type OrderPaymentStatus = 'nao_pago' | 'parcial' | 'pago' | 'estornado' | 'isento';

/**
 * Calcula o status de pagamento agregado de um pedido a partir das linhas em `payments`.
 *
 *  - isento     → final_amount_cents = 0
 *  - estornado  → total estornado ≥ valor do pedido
 *  - pago       → total approved ≥ valor do pedido
 *  - parcial    → algum approved > 0 mas insuficiente
 *  - nao_pago   → sem approved
 */
export async function computeOrderPaymentStatus(
    orderId: string,
    client?: PoolClient
): Promise<OrderPaymentStatus> {
    const sql = `SELECT
            o.final_amount_cents,
            COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'APPROVED'), 0)::int AS paid_total,
            COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'REFUNDED'), 0)::int AS refunded_total
         FROM orders o
         LEFT JOIN payments p ON p.order_id = o.id
         WHERE o.id = $1
         GROUP BY o.id, o.final_amount_cents`;
    type Row = { final_amount_cents: number; paid_total: number; refunded_total: number };
    const result = client
        ? await client.query<Row>(sql, [orderId])
        : await query<Row>(sql, [orderId]);

    const row = result.rows[0];
    if (!row) return 'nao_pago';

    if (row.final_amount_cents === 0) return 'isento';
    if (row.refunded_total >= row.final_amount_cents) return 'estornado';
    if (row.paid_total >= row.final_amount_cents) return 'pago';
    if (row.paid_total > 0) return 'parcial';
    return 'nao_pago';
}

/**
 * Recalcula e persiste o payment_status do pedido. Use sempre que payments
 * for criado/atualizado/estornado.
 */
export async function syncOrderPaymentStatus(
    orderId: string,
    client?: PoolClient
): Promise<OrderPaymentStatus> {
    const status = await computeOrderPaymentStatus(orderId, client);
    const sql = `UPDATE orders SET payment_status = $2::order_payment_status, updated_at = NOW() WHERE id = $1`;
    if (client) {
        await client.query(sql, [orderId, status]);
    } else {
        await query(sql, [orderId, status]);
    }
    return status;
}
