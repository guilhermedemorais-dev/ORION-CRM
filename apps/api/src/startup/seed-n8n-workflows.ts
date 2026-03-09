import { logger } from '../lib/logger.js';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { N8nService, type N8nWorkflow } from '../services/n8n.service.js';
import { SYSTEM_WORKFLOWS } from './system-workflows.js';

function normalizeTagNames(tags: N8nWorkflow['tags']): string[] {
    if (!tags) return [];
    return tags
        .map((tag) => typeof tag === 'string' ? tag : tag.name)
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase());
}

function isSystemWorkflow(workflow: N8nWorkflow): boolean {
    const tags = normalizeTagNames(workflow.tags);
    return tags.includes('sistema') || tags.includes('orion-system');
}

async function pickAdminUserId(): Promise<string | null> {
    const result = await query<{ id: string }>(
        `SELECT id
         FROM users
         WHERE role = 'ADMIN'
           AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`
    );

    return result.rows[0]?.id ?? null;
}

async function upsertSystemFlowRecord(workflow: N8nWorkflow, adminUserId: string | null): Promise<void> {
    if (!workflow.id || !adminUserId) return;

    await query(
        `INSERT INTO automation_flows (
            name,
            status,
            n8n_workflow_id,
            flow_definition,
            trigger_type,
            last_deployed_at,
            created_by
         ) VALUES (
            $1, $2::flow_status, $3, $4::jsonb, 'webhook', NOW(), $5
         )
         ON CONFLICT (n8n_workflow_id)
         DO UPDATE SET
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            flow_definition = EXCLUDED.flow_definition,
            updated_at = NOW(),
            last_deployed_at = NOW()`,
        [
            workflow.name,
            workflow.active ? 'active' : 'inactive',
            workflow.id,
            JSON.stringify(workflow),
            adminUserId,
        ]
    );
}

export async function seedN8nSystemWorkflows(): Promise<void> {
    try {
        const n8n = new N8nService();
        const existing = await n8n.listWorkflows();
        const byName = new Map(existing.map((workflow) => [workflow.name, workflow]));
        const adminUserId = await pickAdminUserId();

        for (const systemWorkflow of SYSTEM_WORKFLOWS) {
            const current = byName.get(systemWorkflow.name);

            if (current) {
                if (!isSystemWorkflow(current)) {
                    const mergedTags = Array.from(new Set([
                        ...normalizeTagNames(current.tags),
                        'sistema',
                        'orion-system',
                    ]));

                    const updated = await n8n.updateWorkflow(String(current.id), {
                        ...current,
                        tags: mergedTags.map((name) => ({ name })),
                    });
                    await upsertSystemFlowRecord(updated, adminUserId);
                    logger.info({ workflow: updated.name }, 'n8n system workflow tag synced');
                } else {
                    await upsertSystemFlowRecord(current, adminUserId);
                }
                continue;
            }

            const created = await n8n.createWorkflow(systemWorkflow);
            await upsertSystemFlowRecord(created, adminUserId);
            logger.info({ workflow: created.name }, 'n8n system workflow seeded');
        }
    } catch (error) {
        if (error instanceof AppError && error.code === 'N8N_NOT_CONFIGURED') {
            logger.warn('n8n seed skipped: N8N_API_KEY/N8N_URL ausentes.');
            return;
        }

        logger.warn({ error }, 'n8n seed failed; API will continue without seed.');
    }
}
