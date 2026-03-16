'use client';

// Matriz de permissões (espelho do backend — apps/api/src/middleware/permissions.ts)
const PERMISSIONS: Record<string, string[]> = {
    'client.view':              ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'client.edit':              ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'client.delete':            ['MESTRE', 'ADMIN'],
    'attendance.view':          ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'attendance.create':        ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'attendance.edit':          ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'attendance.delete':        ['MESTRE', 'ADMIN'],
    'ai_render.create':         ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'ai_render.approve':        ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'proposal.view':            ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'proposal.create':          ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'order.view':               ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO', 'DESIGNER_3D'],
    'order.create':             ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'order.edit':               ['MESTRE', 'ADMIN'],
    'so.view':                  ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO', 'DESIGNER_3D'],
    'so.create':                ['MESTRE', 'ADMIN', 'ATENDENTE'],
    'so.edit_step':             ['MESTRE', 'ADMIN', 'PRODUCAO', 'DESIGNER_3D'],
    'so.upload_3d':             ['MESTRE', 'ADMIN', 'DESIGNER_3D'],
    'so.delete':                ['MESTRE', 'ADMIN'],
    'delivery.view':            ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO', 'DESIGNER_3D'],
    'delivery.update_status':   ['MESTRE', 'ADMIN', 'ATENDENTE', 'PRODUCAO'],
    'nfe.emit':                 ['MESTRE', 'ADMIN'],
    'financial.view':           ['MESTRE', 'ADMIN'],
    'settings.view':            ['MESTRE'],
    'pipeline.configure':       ['MESTRE'],
    'users.manage':             ['MESTRE', 'ADMIN'],
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
