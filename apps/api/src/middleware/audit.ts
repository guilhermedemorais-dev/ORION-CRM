import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import type { Request } from 'express';

interface AuditLogParams {
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    req: Request;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
    try {
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                params.userId,
                params.action,
                params.entityType,
                params.entityId,
                params.oldValue ? JSON.stringify(params.oldValue) : null,
                params.newValue ? JSON.stringify(params.newValue) : null,
                params.req.ip || params.req.socket.remoteAddress || null,
                params.req.headers['user-agent'] || null,
                params.req.requestId,
            ]
        );
    } catch (err) {
        // PRD: "Falha ao gravar audit log: a operação principal NÃO é revertida,
        // mas a falha é logada em nível CRITICAL"
        logger.fatal(
            { err, action: params.action, entityType: params.entityType, requestId: params.req.requestId },
            'CRITICAL: Failed to write audit log'
        );
    }
}
