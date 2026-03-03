import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof AppError) {
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

    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: `Erro interno. ID: ${req.requestId}`,
        requestId: req.requestId,
    });
}
