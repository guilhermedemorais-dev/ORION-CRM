import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../db/redis.js';
import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import type { Settings } from '../types/entities.js';

const CACHE_KEY = 'settings:instance';
const CACHE_TTL_SECONDS = 300; // 5 minutes

// Routes exempt from instance status check
const EXEMPT_PATHS = [
    '/api/v1/operator/webhook',
    '/api/v1/operator/health',
    '/health',
];

export async function instanceStatusMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    // Skip check for exempt routes
    if (EXEMPT_PATHS.some(path => req.path.startsWith(path))) {
        next();
        return;
    }

    try {
        const settings = await getCachedSettings();

        if (!settings) {
            res.status(503).json({
                error: 'SETTINGS_UNAVAILABLE',
                message: 'Configuração da instância indisponível.',
                requestId: req.requestId,
            });
            return;
        }

        if (settings.status === 'suspended') {
            res.status(403).json({
                error: 'INSTANCE_SUSPENDED',
                message: 'Assinatura suspensa. Entre em contato com o suporte.',
                requestId: req.requestId,
            });
            return;
        }

        if (settings.status === 'decommissioned') {
            res.status(403).json({
                error: 'INSTANCE_DECOMMISSIONED',
                message: 'Instância encerrada.',
                requestId: req.requestId,
            });
            return;
        }

        next();
    } catch (err) {
        logger.error({ err, requestId: req.requestId }, 'Failed to check instance status');
        res.status(503).json({
            error: 'SETTINGS_UNAVAILABLE',
            message: 'Não foi possível validar o estado da instância.',
            requestId: req.requestId,
        });
    }
}

async function getCachedSettings(): Promise<Settings | null> {
    const redis = getRedis();

    try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
            return JSON.parse(cached) as Settings;
        }
    } catch {
        // Redis unavailable — fall through to DB
    }

    const result = await query<Settings>('SELECT * FROM settings LIMIT 1');
    const settings = result.rows[0] ?? null;

    if (settings) {
        try {
            await redis.set(CACHE_KEY, JSON.stringify(settings), 'EX', CACHE_TTL_SECONDS);
        } catch {
            // Log but don't fail
        }
    }

    return settings;
}

export async function invalidateSettingsCache(): Promise<void> {
    try {
        await getRedis().del(CACHE_KEY);
    } catch {
        logger.warn('Failed to invalidate settings cache');
    }
}
