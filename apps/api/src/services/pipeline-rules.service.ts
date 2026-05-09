import crypto from 'node:crypto';
import type pg from 'pg';
import { AppError } from '../lib/errors.js';
import type { LeadStage } from '../types/entities.js';

export const RULE_TRIGGER_EVENTS = ['CARD_ENTERED_STAGE'] as const;
export type RuleTriggerEvent = (typeof RULE_TRIGGER_EVENTS)[number];

export const RULE_ACTION_TYPES = [
    'CREATE_LINKED_CARD',
    'MOVE_CARD_TO_PIPELINE',
    'MIRROR_CARD_TO_PIPELINE',
] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

export const RULE_LINK_STRATEGIES = [
    'KEEP_LEAD',
    'KEEP_CUSTOMER',
    'KEEP_ORDER',
    'KEEP_ALL',
    'TECHNICAL_LINK',
] as const;
export type RuleLinkStrategy = (typeof RULE_LINK_STRATEGIES)[number];

export interface RuleTargetInput {
    sourcePipelineId: string;
    sourceStageId: string;
    targetPipelineId: string;
    targetStageId: string;
}

/**
 * Validates that source and target tuples (pipeline+stage) are not identical.
 * Same pipeline is allowed (e.g. fast-forward inside same board) as long as
 * the stage differs.
 */
export function assertDistinctSourceTarget(input: RuleTargetInput): void {
    if (
        input.sourcePipelineId === input.targetPipelineId &&
        input.sourceStageId === input.targetStageId
    ) {
        throw AppError.badRequest('A regra não pode ter origem e destino idênticos.');
    }
}

/**
 * Idempotency key for one execution of (rule, lead, occurrence).
 * occurrenceToken is provided by the caller (e.g. timeline event id or
 * stage-change audit id) so re-processing the same event is a no-op.
 */
export function buildIdempotencyKey(params: {
    ruleId: string;
    leadId: string;
    occurrenceToken: string;
}): string {
    const raw = `${params.ruleId}:${params.leadId}:${params.occurrenceToken}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64);
}

export function buildRuleExecutionIdempotencyKey(params: {
    ruleId: string;
    leadId: string;
    triggerEvent: RuleTriggerEvent;
    sourceStageId: string;
    occurrenceToken?: string | null;
}): string {
    return buildIdempotencyKey({
        ruleId: params.ruleId,
        leadId: params.leadId,
        occurrenceToken: params.occurrenceToken ?? `${params.triggerEvent}:${params.sourceStageId}`,
    });
}

export function mapPipelineStageToLegacyLeadStage(
    stage: { name: string; is_won: boolean; is_lost: boolean },
    current: LeadStage
): LeadStage {
    if (stage.is_won) return 'CONVERTIDO';
    if (stage.is_lost) return 'PERDIDO';

    const normalized = stage.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, '_')
        .trim();

    if (normalized === 'NOVO') return 'NOVO';
    if (normalized === 'QUALIFICADO') return 'QUALIFICADO';
    if (normalized === 'PROPOSTA_ENVIADA') return 'PROPOSTA_ENVIADA';
    if (normalized === 'NEGOCIACAO') return 'NEGOCIACAO';

    return current;
}

export interface RuleCreateInput {
    name: string;
    description?: string | null;
    sourcePipelineId: string;
    sourceStageId: string;
    triggerEvent: RuleTriggerEvent;
    actionType: RuleActionType;
    targetPipelineId: string;
    targetStageId: string;
    linkStrategy?: RuleLinkStrategy;
    isActive?: boolean;
}

export interface RuleNormalized extends Required<Omit<RuleCreateInput, 'description'>> {
    description: string | null;
}

export function normalizeRuleCreateInput(input: RuleCreateInput): RuleNormalized {
    if (!RULE_TRIGGER_EVENTS.includes(input.triggerEvent)) {
        throw AppError.badRequest('Evento de trigger inválido.');
    }
    if (!RULE_ACTION_TYPES.includes(input.actionType)) {
        throw AppError.badRequest('Ação inválida para a regra.');
    }
    const linkStrategy = input.linkStrategy ?? 'KEEP_LEAD';
    if (!RULE_LINK_STRATEGIES.includes(linkStrategy)) {
        throw AppError.badRequest('Estratégia de vínculo inválida.');
    }

    assertDistinctSourceTarget({
        sourcePipelineId: input.sourcePipelineId,
        sourceStageId: input.sourceStageId,
        targetPipelineId: input.targetPipelineId,
        targetStageId: input.targetStageId,
    });

    const trimmedName = input.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
        throw AppError.badRequest('Nome da regra deve ter entre 2 e 120 caracteres.');
    }

    return {
        name: trimmedName,
        description: input.description?.trim() ? input.description.trim() : null,
        sourcePipelineId: input.sourcePipelineId,
        sourceStageId: input.sourceStageId,
        triggerEvent: input.triggerEvent,
        actionType: input.actionType,
        targetPipelineId: input.targetPipelineId,
        targetStageId: input.targetStageId,
        linkStrategy,
        isActive: input.isActive ?? true,
    };
}

interface OrganizationRow extends pg.QueryResultRow {
    id: string;
}

export async function getBuilderOrganizationId(client?: Pick<pg.PoolClient, 'query'>): Promise<string> {
    const result = client
        ? await client.query<OrganizationRow>('SELECT id FROM settings LIMIT 1')
        : await (await import('../db/pool.js')).query<OrganizationRow>('SELECT id FROM settings LIMIT 1');
    const organizationId = result.rows[0]?.id;
    if (!organizationId) {
        throw AppError.serviceUnavailable('ORGANIZATION_NOT_READY', 'Organização técnica ainda não foi inicializada.');
    }
    return organizationId;
}

export interface SimulateRuleExecutionInput {
    rule: RuleNormalized;
    leadSnapshot: {
        id: string;
        name: string | null;
        pipelineId: string;
        stageId: string | null;
    };
}

export interface SimulateRuleExecutionResult {
    willExecute: boolean;
    reason?: string;
    plannedAction?: {
        actionType: RuleActionType;
        targetPipelineId: string;
        targetStageId: string;
        linkStrategy: RuleLinkStrategy;
    };
}

/**
 * Pure dry-run: returns what would happen if `lead` entered `rule.sourceStageId`.
 * No DB writes. Frontend uses this for the preview/test endpoint.
 */
export function simulateRuleExecution(
    input: SimulateRuleExecutionInput
): SimulateRuleExecutionResult {
    const { rule, leadSnapshot } = input;

    if (!rule.isActive) {
        return { willExecute: false, reason: 'Regra inativa.' };
    }

    if (leadSnapshot.pipelineId !== rule.sourcePipelineId) {
        return {
            willExecute: false,
            reason: 'Lead pertence a um pipeline diferente da regra.',
        };
    }

    if (leadSnapshot.stageId !== rule.sourceStageId) {
        return {
            willExecute: false,
            reason: 'Lead não está na etapa de origem da regra.',
        };
    }

    return {
        willExecute: true,
        plannedAction: {
            actionType: rule.actionType,
            targetPipelineId: rule.targetPipelineId,
            targetStageId: rule.targetStageId,
            linkStrategy: rule.linkStrategy,
        },
    };
}

interface RuleExecutionRow extends pg.QueryResultRow {
    id: string;
}

interface AutomationRuleRow extends pg.QueryResultRow {
    id: string;
    organization_id: string;
    source_pipeline_id: string;
    source_stage_id: string;
    trigger_event: RuleTriggerEvent;
    action_type: RuleActionType;
    target_pipeline_id: string;
    target_stage_id: string;
    link_strategy: RuleLinkStrategy;
}

interface LeadExecutionRow extends pg.QueryResultRow {
    id: string;
    stage: LeadStage;
    pipeline_id: string;
    stage_id: string | null;
    converted_customer_id: string | null;
}

interface TargetStageRow extends pg.QueryResultRow {
    id: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
}

interface OrderRow extends pg.QueryResultRow {
    id: string;
}

export interface ExecutePipelineRulesForStageEntryParams {
    leadId: string;
    sourcePipelineId: string;
    sourceStageId: string;
    occurrenceToken?: string | null;
    userId?: string | null;
}

async function findLatestOrderIdForCustomer(
    client: pg.PoolClient,
    customerId: string | null
): Promise<string | null> {
    if (!customerId) return null;

    const result = await client.query<OrderRow>(
        `SELECT id
         FROM orders
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [customerId]
    );

    return result.rows[0]?.id ?? null;
}

async function insertPendingExecution(params: {
    client: pg.PoolClient;
    rule: AutomationRuleRow;
    lead: LeadExecutionRow;
    idempotencyKey: string;
    userId: string | null;
}): Promise<string | null> {
    const result = await params.client.query<RuleExecutionRow>(
        `INSERT INTO pipeline_rule_executions
            (organization_id, rule_id, trigger_event, action_type, source_pipeline_id,
             source_stage_id, target_pipeline_id, target_stage_id, source_lead_id,
             idempotency_key, status, created_by, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [
            params.rule.organization_id,
            params.rule.id,
            params.rule.trigger_event,
            params.rule.action_type,
            params.rule.source_pipeline_id,
            params.rule.source_stage_id,
            params.rule.target_pipeline_id,
            params.rule.target_stage_id,
            params.lead.id,
            params.idempotencyKey,
            params.userId,
            JSON.stringify({ link_strategy: params.rule.link_strategy }),
        ]
    );

    return result.rows[0]?.id ?? null;
}

async function markExecutionFinished(params: {
    client: pg.PoolClient;
    executionId: string;
    status: 'success' | 'failed' | 'skipped';
    targetLeadId?: string | null;
    errorMessage?: string | null;
    payload?: Record<string, unknown>;
}): Promise<void> {
    await params.client.query(
        `UPDATE pipeline_rule_executions
         SET status = $1,
             target_lead_id = $2,
             error_message = $3,
             payload = COALESCE(payload, '{}'::jsonb) || $4::jsonb,
             finished_at = NOW()
         WHERE id = $5`,
        [
            params.status,
            params.targetLeadId ?? null,
            params.errorMessage ?? null,
            JSON.stringify(params.payload ?? {}),
            params.executionId,
        ]
    );
}

async function executeRule(rule: AutomationRuleRow, params: ExecutePipelineRulesForStageEntryParams): Promise<void> {
    const { transaction } = await import('../db/pool.js');
    const idempotencyKey = buildRuleExecutionIdempotencyKey({
        ruleId: rule.id,
        leadId: params.leadId,
        triggerEvent: rule.trigger_event,
        sourceStageId: params.sourceStageId,
        occurrenceToken: params.occurrenceToken,
    });

    await transaction(async (client) => {
        const leadResult = await client.query<LeadExecutionRow>(
            `SELECT id, stage, pipeline_id, stage_id, converted_customer_id
             FROM leads
             WHERE id = $1
             LIMIT 1`,
            [params.leadId]
        );
        const lead = leadResult.rows[0];
        if (!lead) return;

        const executionId = await insertPendingExecution({
            client,
            rule,
            lead,
            idempotencyKey,
            userId: params.userId ?? null,
        });
        if (!executionId) return;

        try {
            const orderId = await findLatestOrderIdForCustomer(client, lead.converted_customer_id);

            if (rule.action_type === 'MOVE_CARD_TO_PIPELINE') {
                const targetStageResult = await client.query<TargetStageRow>(
                    `SELECT id, name, is_won, is_lost
                     FROM pipeline_stages
                     WHERE id = $1 AND pipeline_id = $2
                     LIMIT 1`,
                    [rule.target_stage_id, rule.target_pipeline_id]
                );
                const targetStage = targetStageResult.rows[0];
                if (!targetStage) {
                    await markExecutionFinished({
                        client,
                        executionId,
                        status: 'failed',
                        errorMessage: 'Stage destino não encontrada.',
                    });
                    return;
                }

                const nextLegacyStage = mapPipelineStageToLegacyLeadStage(targetStage, lead.stage);
                await client.query(
                    `UPDATE leads
                     SET pipeline_id = $1,
                         stage_id = $2,
                         stage = $3,
                         updated_at = NOW()
                     WHERE id = $4`,
                    [rule.target_pipeline_id, rule.target_stage_id, nextLegacyStage, lead.id]
                );

                await markExecutionFinished({
                    client,
                    executionId,
                    status: 'success',
                    targetLeadId: lead.id,
                    payload: { moved: true, order_id: orderId },
                });
                return;
            }

            await client.query(
                `INSERT INTO pipeline_card_links
                    (organization_id, rule_id, source_lead_id, target_lead_id, customer_id,
                     order_id, source_pipeline_id, source_stage_id, target_pipeline_id,
                     target_stage_id, link_strategy, created_by)
                 VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 ON CONFLICT (rule_id, source_lead_id, target_pipeline_id, target_stage_id)
                 DO NOTHING`,
                [
                    rule.organization_id,
                    rule.id,
                    lead.id,
                    lead.converted_customer_id,
                    orderId,
                    rule.source_pipeline_id,
                    rule.source_stage_id,
                    rule.target_pipeline_id,
                    rule.target_stage_id,
                    rule.link_strategy,
                    params.userId ?? null,
                ]
            );

            await markExecutionFinished({
                client,
                executionId,
                status: 'success',
                targetLeadId: lead.id,
                payload: { linked: true, order_id: orderId },
            });
        } catch (error) {
            await markExecutionFinished({
                client,
                executionId,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Falha desconhecida ao executar regra.',
            });
        }
    });
}

export async function executePipelineRulesForStageEntry(
    params: ExecutePipelineRulesForStageEntryParams
): Promise<void> {
    const { query } = await import('../db/pool.js');
    const organizationId = await getBuilderOrganizationId();
    const rules = await query<AutomationRuleRow>(
        `SELECT id, organization_id, source_pipeline_id, source_stage_id, trigger_event,
                action_type, target_pipeline_id, target_stage_id, link_strategy
         FROM pipeline_automation_rules
         WHERE organization_id = $1
           AND source_pipeline_id = $2
           AND source_stage_id = $3
           AND trigger_event = 'CARD_ENTERED_STAGE'
           AND is_active = true
         ORDER BY created_at ASC`,
        [organizationId, params.sourcePipelineId, params.sourceStageId]
    );

    for (const rule of rules.rows) {
        try {
            await executeRule(rule, params);
        } catch (error) {
            const { logger } = await import('../lib/logger.js');
            logger.error({ err: error, ruleId: rule.id, leadId: params.leadId }, 'Failed to execute pipeline automation rule');
        }
    }
}
