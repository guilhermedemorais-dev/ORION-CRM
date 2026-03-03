import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: env().DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            logger.error({ err }, 'Unexpected database pool error');
        });
    }
    return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const result = await getPool().query<T>(text, params);
    const duration = Date.now() - start;

    if (duration > 200) {
        logger.warn({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Slow query detected');
    }

    return result;
}

export async function getClient(): Promise<pg.PoolClient> {
    return getPool().connect();
}

export async function transaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function checkDatabase(): Promise<boolean> {
    try {
        await getPool().query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
