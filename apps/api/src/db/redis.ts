import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
    if (!redis) {
        redis = new Redis(env().REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 200, 5000);
                return delay;
            },
            lazyConnect: false,
        });

        redis.on('error', (err) => {
            logger.error({ err }, 'Redis connection error');
        });

        redis.on('connect', () => {
            logger.info('Redis connected');
        });
    }
    return redis;
}

export async function checkRedis(): Promise<boolean> {
    try {
        const pong = await getRedis().ping();
        return pong === 'PONG';
    } catch {
        return false;
    }
}

export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}
