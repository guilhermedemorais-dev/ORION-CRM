import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

// ─── Matriz de permissões ─────────────────────────────────────────────────────
const PERMISSIONS: Record<string, UserRole[]> = {
    // Painel do Cliente
    'client.view':              ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'client.edit':              ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'client.delete':            ['MESTRE', 'ADMIN'],

    // Atendimento
    'attendance.view':          ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'attendance.create':        ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'attendance.edit':          ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'attendance.delete':        ['MESTRE', 'ADMIN'],

    // IA 3D
    'ai_render.create':         ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'ai_render.approve':        ['MESTRE', 'ADMIN', 'ATENDENTE'],

    // Proposta
    'proposal.view':            ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'proposal.create':          ['MESTRE', 'ADMIN', 'ATENDENTE'],

    // Pedidos
    'order.view':               ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO', 'DESIGNER_3D'],
    'order.create':             ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'order.edit':               ['MESTRE', 'ADMIN'],

    // OS
    'so.view':                  ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO', 'DESIGNER_3D'],
    'so.create':                ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'so.edit_step':             ['MESTRE', 'ADMIN', 'PRODUCAO', 'DESIGNER_3D'],
    'so.upload_3d':             ['MESTRE', 'ADMIN', 'DESIGNER_3D'],
    'so.delete':                ['MESTRE', 'ADMIN'],

    // Entrega
    'delivery.view':            ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO', 'DESIGNER_3D'],
    'delivery.update_status':   ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],

    // Financeiro / NF-e
    'nfe.emit':                 ['MESTRE', 'ADMIN'],
    'financial.view':           ['MESTRE', 'ADMIN'],

    // Admin-only
    'settings.view':            ['MESTRE'],
    'pipeline.configure':       ['MESTRE'],
    'users.manage':             ['MESTRE', 'ADMIN'],
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
