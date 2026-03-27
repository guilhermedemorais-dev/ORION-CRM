import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

// ─── Matriz de permissões ─────────────────────────────────────────────────────
const PERMISSIONS: Record<string, UserRole[]> = {
    // Painel do Cliente
    'client.view':              ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'client.edit':              ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'client.delete':            ['GERENTE', 'ADMIN'],

    // Atendimento
    'attendance.view':          ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'attendance.create':        ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'attendance.edit':          ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'attendance.delete':        ['GERENTE', 'ADMIN'],

    // IA 3D
    'ai_render.create':         ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'ai_render.approve':        ['GERENTE', 'ADMIN', 'ATENDENTE'],

    // Proposta
    'proposal.view':            ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'proposal.create':          ['GERENTE', 'ADMIN', 'ATENDENTE'],

    // Pedidos
    'order.view':               ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'order.create':             ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'order.edit':               ['GERENTE', 'ADMIN'],

    // OS
    'so.view':                  ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'so.create':                ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'so.edit_step':             ['GERENTE', 'ADMIN', 'PRODUCAO'],
    'so.upload_3d':             ['GERENTE', 'ADMIN', 'PRODUCAO'],
    'so.delete':                ['GERENTE', 'ADMIN'],

    // Entrega
    'delivery.view':            ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'delivery.update_status':   ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],

    // Financeiro / NF-e
    'nfe.emit':                 ['GERENTE', 'ADMIN'],
    'financial.view':           ['GERENTE', 'ADMIN', 'FINANCEIRO'],

    // Admin-only
    'settings.view':            ['GERENTE', 'ADMIN'],
    'pipeline.configure':       ['GERENTE', 'ADMIN'],
    'users.manage':             ['GERENTE', 'ADMIN'],
};

// ─── Lógica com override personalizado ───────────────────────────────────────
export function userCan(user: { role: UserRole; custom_permissions?: Record<string, boolean> }, permission: string): boolean {
    if (user.custom_permissions?.[permission] !== undefined) {
        return user.custom_permissions[permission];
    }
    return PERMISSIONS[permission]?.includes(user.role) ?? false;
}

// ─── Middleware backend ───────────────────────────────────────────────────────
export function requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(AppError.unauthorized());
            return;
        }

        const userWithPerms = req.user as { role: UserRole; custom_permissions?: Record<string, boolean> };
        if (!userCan(userWithPerms, permission)) {
            next(AppError.forbidden(`Permissão insuficiente: ${permission}`));
            return;
        }

        next();
    };
}
