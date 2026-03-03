import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function rateLimit(options: {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
    name?: string;
}) {
    const storeName = options.name || 'default';
    if (!stores.has(storeName)) {
        stores.set(storeName, new Map());
    }
    const store = stores.get(storeName)!;

    // Cleanup old entries periodically
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (entry.resetAt < now) {
                store.delete(key);
            }
        }
    }, options.windowMs);

    return (req: Request, _res: Response, next: NextFunction): void => {
        const key = options.keyGenerator
            ? options.keyGenerator(req)
            : req.ip || req.socket.remoteAddress || 'unknown';

        const now = Date.now();
        const entry = store.get(key);

        if (!entry || entry.resetAt < now) {
            store.set(key, { count: 1, resetAt: now + options.windowMs });
            next();
            return;
        }

        entry.count++;

        if (entry.count > options.max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            next(AppError.rateLimited(retryAfter));
            return;
        }

        next();
    };
}
