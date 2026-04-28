import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';

export interface CaptureErrorInput {
    source: 'api' | 'worker' | 'web';
    severity?: 'error' | 'fatal' | 'warn';
    requestId?: string | null;
    userId?: string | null;
    method?: string | null;
    path?: string | null;
    statusCode?: number | null;
    message: string;
    stack?: string | null;
    context?: Record<string, unknown> | null;
}

export interface SystemErrorRow {
    id: string;
    occurred_at: string;
    source: string;
    severity: string;
    request_id: string | null;
    user_id: string | null;
    method: string | null;
    path: string | null;
    status_code: number | null;
    message: string;
    stack: string | null;
    context: Record<string, unknown> | null;
}

const MAX_MSG = 4000;
const MAX_STACK = 16000;

function clip(value: string | null | undefined, max: number): string | null {
    if (!value) return null;
    return value.length > max ? value.slice(0, max) + '…[truncated]' : value;
}

export async function captureSystemError(input: CaptureErrorInput): Promise<void> {
    try {
        await query(
            `INSERT INTO system_errors
                (source, severity, request_id, user_id, method, path, status_code, message, stack, context)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                input.source,
                input.severity ?? 'error',
                input.requestId ?? null,
                input.userId ?? null,
                input.method ?? null,
                input.path ?? null,
                input.statusCode ?? null,
                clip(input.message, MAX_MSG) ?? 'unknown error',
                clip(input.stack, MAX_STACK),
                input.context ?? null,
            ]
        );
    } catch (err) {
        // Never let the error capture itself crash the process.
        logger.warn({ err }, 'Failed to persist system error');
    }
}

export interface ListErrorsParams {
    limit?: number;
    sinceId?: string | null;
    source?: string | null;
    search?: string | null;
}

export async function listSystemErrors(params: ListErrorsParams): Promise<SystemErrorRow[]> {
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.sinceId) {
        values.push(params.sinceId);
        conditions.push(`occurred_at > (SELECT occurred_at FROM system_errors WHERE id = $${values.length})`);
    }
    if (params.source) {
        values.push(params.source);
        conditions.push(`source = $${values.length}`);
    }
    if (params.search) {
        values.push(`%${params.search}%`);
        conditions.push(`(message ILIKE $${values.length} OR path ILIKE $${values.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const result = await query<SystemErrorRow>(
        `SELECT id, occurred_at, source, severity, request_id, user_id, method, path,
                status_code, message, stack, context
           FROM system_errors
           ${where}
           ORDER BY occurred_at DESC
           LIMIT $${values.length}`,
        values
    );
    return result.rows;
}

export async function clearSystemErrors(): Promise<number> {
    const result = await query<{ id: string }>('DELETE FROM system_errors RETURNING id');
    return result.rowCount ?? 0;
}
