import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '../types/entities.js';

// ─── Matriz de permissões ─────────────────────────────────────────────────────
// ADMIN tem acesso total — listado explicitamente para fins de auditoria.
// ROOT bypassa esta matriz (ver userCan abaixo).
const PERMISSIONS: Record<string, UserRole[]> = {
    // Painel do Cliente
    'client.view':              ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'client.edit':              ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'client.delete':            ['ADMIN', 'GERENTE'],

    // Atendimento
    'attendance.view':          ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'attendance.create':        ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'attendance.edit':          ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'attendance.delete':        ['ADMIN', 'GERENTE'],

    // IA 3D
    'ai_render.create':         ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'ai_render.approve':        ['ADMIN', 'GERENTE', 'ATENDENTE'],

    // Proposta
    'proposal.view':            ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'proposal.create':          ['ADMIN', 'GERENTE', 'ATENDENTE'],

    // Pedidos
    'order.view':               ['ADMIN', 'GERENTE', 'ATENDENTE', 'PRODUCAO'],
    'order.create':             ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'order.edit':               ['ADMIN', 'GERENTE'],
    'order.delete':             ['ADMIN'],

    // OS
    'so.view':                  ['ADMIN', 'GERENTE', 'ATENDENTE', 'PRODUCAO'],
    'so.create':                ['ADMIN', 'GERENTE', 'ATENDENTE'],
    'so.edit_step':             ['ADMIN', 'GERENTE', 'PRODUCAO'],
    'so.upload_3d':             ['ADMIN', 'GERENTE', 'PRODUCAO'],
    'so.delete':                ['ADMIN', 'GERENTE'],

    // Entrega
    'delivery.view':            ['ADMIN', 'GERENTE', 'ATENDENTE', 'PRODUCAO'],
    'delivery.update_status':   ['ADMIN', 'GERENTE', 'ATENDENTE', 'PRODUCAO'],

    // Financeiro / NF-e
    'nfe.emit':                 ['ADMIN', 'GERENTE'],
    'financial.view':           ['ADMIN', 'GERENTE', 'FINANCEIRO'],
    'financial.manage':         ['ADMIN'],

    // Configurações e gestão
    'settings.view':            ['ADMIN', 'GERENTE'],
    'settings.manage':          ['ADMIN'],
    'pipeline.configure':       ['ADMIN', 'GERENTE'],
    'users.manage':             ['ADMIN'],
    'integrations.manage':      ['ADMIN'],
    'webhooks.manage':          ['ADMIN'],
};

// ─── Lógica com override personalizado ───────────────────────────────────────
export function userCan(user: { role: UserRole; custom_permissions?: Record<string, boolean> }, permission: string): boolean {
    if (user.role === 'ROOT') return true;
    if (user.custom_permissions?.[permission] !== undefined) {
        return user.custom_permissions[permission];
    }
    return PERMISSIONS[permission]?.includes(user.role) ?? false;
}

// ─── Middleware backend ───────────────────────────────────────────────────────
export function requirePermission(permission: string) {
    return (req: Request, _res: Response, next: NextFunction): void => {
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
