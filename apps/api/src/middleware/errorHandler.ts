import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { captureSystemError } from '../services/systemErrors.service.js';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof AppError) {
        if (err.code === 'RATE_LIMITED' && typeof err.retryAfterSeconds === 'number') {
            res.setHeader('Retry-After', String(err.retryAfterSeconds));
        }
        if (err.statusCode >= 500) {
            void captureSystemError({
                source: 'api',
                severity: 'error',
                requestId: req.requestId,
                userId: req.user?.id ?? null,
                method: req.method,
                path: req.path,
                statusCode: err.statusCode,
                message: err.message,
                stack: err.stack ?? null,
                context: { code: err.code, details: err.details },
            });
        }
        res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
            requestId: req.requestId,
            details: err.details.length > 0 ? err.details : undefined,
        });
        return;
    }

    // Unexpected error — never expose internals
    logger.error(
        {
            err,
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            userId: req.user?.id,
        },
        'Unhandled error'
    );

    void captureSystemError({
        source: 'api',
        severity: 'error',
        requestId: req.requestId,
        userId: req.user?.id ?? null,
        method: req.method,
        path: req.path,
        statusCode: 500,
        message: err.message || 'Unhandled error',
        stack: err.stack ?? null,
        context: { name: err.name },
    });

    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: `Erro interno. ID: ${req.requestId}`,
        requestId: req.requestId,
    });
}
