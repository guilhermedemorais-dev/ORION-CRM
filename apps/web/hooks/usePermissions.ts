'use client';

// Matriz de permissões (espelho do backend — apps/api/src/middleware/permissions.ts)
const PERMISSIONS: Record<string, string[]> = {
    'client.view':              ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'client.edit':              ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'client.delete':            ['GERENTE', 'ADMIN'],
    'attendance.view':          ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'attendance.create':        ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'attendance.edit':          ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'attendance.delete':        ['GERENTE', 'ADMIN'],
    'ai_render.create':         ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'ai_render.approve':        ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'proposal.view':            ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'proposal.create':          ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'order.view':               ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'order.create':             ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'order.edit':               ['GERENTE', 'ADMIN'],
    'so.view':                  ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'so.create':                ['GERENTE', 'ADMIN', 'ATENDENTE'],
    'so.edit_step':             ['GERENTE', 'ADMIN', 'PRODUCAO'],
    'so.upload_3d':             ['GERENTE', 'ADMIN', 'PRODUCAO'],
    'so.delete':                ['GERENTE', 'ADMIN'],
    'delivery.view':            ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'delivery.update_status':   ['GERENTE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'nfe.emit':                 ['GERENTE', 'ADMIN'],
    'financial.view':           ['GERENTE', 'ADMIN', 'FINANCEIRO'],
    'settings.view':            ['GERENTE', 'ADMIN'],
    'pipeline.configure':       ['GERENTE', 'ADMIN'],
    'users.manage':             ['GERENTE', 'ADMIN'],
};

export function usePermissions(role: string, customPermissions?: Record<string, boolean>) {
    const can = (permission: string): boolean => {
        if (customPermissions?.[permission] !== undefined) {
            return customPermissions[permission];
        }
        return PERMISSIONS[permission]?.includes(role) ?? false;
    };

    return { can, role };
}
