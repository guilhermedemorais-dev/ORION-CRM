import { Router } from 'express';
import type { Request, Response } from 'express';
import { checkDatabase } from '../db/pool.js';
import { checkRedis } from '../db/redis.js';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
    const [dbOk, redisOk] = await Promise.all([
        checkDatabase(),
        checkRedis(),
    ]);

    const status = dbOk && redisOk ? 'ok' : 'degraded';
    const statusCode = status === 'ok' ? 200 : 503;

    res.status(statusCode).json({
        status,
        db: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
    });
});

export default router;
