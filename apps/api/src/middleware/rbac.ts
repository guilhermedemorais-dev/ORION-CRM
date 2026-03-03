import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

export function requireRole(allowedRoles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(AppError.unauthorized());
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            next(AppError.forbidden('Acesso não autorizado para o seu perfil.'));
            return;
        }

        next();
    };
}
