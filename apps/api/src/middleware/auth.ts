import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

interface JwtPayload {
    id: string;
    email: string;
    role: UserRole;
    name: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next(AppError.unauthorized());
        return;
    }

    const token = authHeader.substring(7);

    try {
        const payload = jwt.verify(token, env().JWT_SECRET) as JwtPayload;

        req.user = {
            id: payload.id,
            email: payload.email,
            role: payload.role,
            name: payload.name,
        };

        next();
    } catch {
        next(AppError.unauthorized());
    }
}
