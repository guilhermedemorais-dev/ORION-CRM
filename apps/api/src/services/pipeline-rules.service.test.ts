import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';
import {
    assertDistinctSourceTarget,
    buildIdempotencyKey,
    buildRuleExecutionIdempotencyKey,
    mapPipelineStageToLegacyLeadStage,
    normalizeRuleCreateInput,
    simulateRuleExecution,
    type RuleNormalized,
} from './pipeline-rules.service.js';

const PIPE_A = '11111111-1111-1111-1111-111111111111';
const PIPE_B = '22222222-2222-2222-2222-222222222222';
const STAGE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STAGE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LEAD = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const RULE = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function baseRule(overrides: Partial<RuleNormalized> = {}): RuleNormalized {
    return {
        name: 'Convertido → Produção',
        description: null,
        sourcePipelineId: PIPE_A,
        sourceStageId: STAGE_A,
        triggerEvent: 'CARD_ENTERED_STAGE',
        actionType: 'CREATE_LINKED_CARD',
        targetPipelineId: PIPE_B,
        targetStageId: STAGE_B,
        linkStrategy: 'KEEP_LEAD',
        isActive: true,
        ...overrides,
    };
}

test('assertDistinctSourceTarget: identical tuples are rejected', () => {
    assert.throws(
        () =>
            assertDistinctSourceTarget({
                sourcePipelineId: PIPE_A,
                sourceStageId: STAGE_A,
                targetPipelineId: PIPE_A,
                targetStageId: STAGE_A,
            }),
        (error: unknown) =>
            error instanceof AppError && error.message.includes('origem e destino idênticos')
    );
});

test('assertDistinctSourceTarget: different stage in same pipeline is allowed', () => {
    assert.doesNotThrow(() =>
        assertDistinctSourceTarget({
            sourcePipelineId: PIPE_A,
            sourceStageId: STAGE_A,
            targetPipelineId: PIPE_A,
            targetStageId: STAGE_B,
        })
    );
});

test('buildIdempotencyKey: deterministic and 64-char hex', () => {
    const k1 = buildIdempotencyKey({ ruleId: RULE, leadId: LEAD, occurrenceToken: 't1' });
    const k2 = buildIdempotencyKey({ ruleId: RULE, leadId: LEAD, occurrenceToken: 't1' });
    const k3 = buildIdempotencyKey({ ruleId: RULE, leadId: LEAD, occurrenceToken: 't2' });
    assert.equal(k1, k2);
    assert.notEqual(k1, k3);
    assert.match(k1, /^[a-f0-9]{64}$/);
});

test('buildRuleExecutionIdempotencyKey: uses occurrence token to allow future same-stage executions', () => {
    const firstMovement = buildRuleExecutionIdempotencyKey({
        ruleId: RULE,
        leadId: LEAD,
        triggerEvent: 'CARD_ENTERED_STAGE',
        sourceStageId: STAGE_A,
        occurrenceToken: 'timeline-1',
    });
    const secondMovement = buildRuleExecutionIdempotencyKey({
        ruleId: RULE,
        leadId: LEAD,
        triggerEvent: 'CARD_ENTERED_STAGE',
        sourceStageId: STAGE_A,
        occurrenceToken: 'timeline-2',
    });

    assert.notEqual(firstMovement, secondMovement);
});

test('mapPipelineStageToLegacyLeadStage: maps final flags and canonical names', () => {
    assert.equal(mapPipelineStageToLegacyLeadStage({ name: 'Convertido', is_won: true, is_lost: false }, 'NOVO'), 'CONVERTIDO');
    assert.equal(mapPipelineStageToLegacyLeadStage({ name: 'Perdido', is_won: false, is_lost: true }, 'NOVO'), 'PERDIDO');
    assert.equal(mapPipelineStageToLegacyLeadStage({ name: 'Proposta Enviada', is_won: false, is_lost: false }, 'NOVO'), 'PROPOSTA_ENVIADA');
    assert.equal(mapPipelineStageToLegacyLeadStage({ name: 'Produção Interna', is_won: false, is_lost: false }, 'NEGOCIACAO'), 'NEGOCIACAO');
});

test('normalizeRuleCreateInput: rejects invalid trigger', () => {
    assert.throws(
        () =>
            normalizeRuleCreateInput({
                name: 'x',
                sourcePipelineId: PIPE_A,
                sourceStageId: STAGE_A,
                // @ts-expect-error invalid by design
                triggerEvent: 'NOT_A_TRIGGER',
                actionType: 'CREATE_LINKED_CARD',
                targetPipelineId: PIPE_B,
                targetStageId: STAGE_B,
            }),
        (error: unknown) => error instanceof AppError
    );
});

test('normalizeRuleCreateInput: rejects too-short name', () => {
    assert.throws(
        () =>
            normalizeRuleCreateInput({
                name: 'a',
                sourcePipelineId: PIPE_A,
                sourceStageId: STAGE_A,
                triggerEvent: 'CARD_ENTERED_STAGE',
                actionType: 'CREATE_LINKED_CARD',
                targetPipelineId: PIPE_B,
                targetStageId: STAGE_B,
            }),
        (error: unknown) => error instanceof AppError && error.message.includes('2 e 120')
    );
});

test('normalizeRuleCreateInput: applies defaults (KEEP_LEAD, isActive=true) and trims', () => {
    const out = normalizeRuleCreateInput({
        name: '  Espelhar para Produção  ',
        description: '  ',
        sourcePipelineId: PIPE_A,
        sourceStageId: STAGE_A,
        triggerEvent: 'CARD_ENTERED_STAGE',
        actionType: 'MIRROR_CARD_TO_PIPELINE',
        targetPipelineId: PIPE_B,
        targetStageId: STAGE_B,
    });
    assert.equal(out.name, 'Espelhar para Produção');
    assert.equal(out.description, null);
    assert.equal(out.linkStrategy, 'KEEP_LEAD');
    assert.equal(out.isActive, true);
});

test('simulateRuleExecution: inactive rule short-circuits', () => {
    const rule = baseRule({ isActive: false });
    const result = simulateRuleExecution({
        rule,
        leadSnapshot: { id: LEAD, name: null, pipelineId: PIPE_A, stageId: STAGE_A },
    });
    assert.equal(result.willExecute, false);
    assert.match(result.reason ?? '', /inativa/);
});

test('simulateRuleExecution: lead in different pipeline is skipped', () => {
    const rule = baseRule();
    const result = simulateRuleExecution({
        rule,
        leadSnapshot: { id: LEAD, name: null, pipelineId: PIPE_B, stageId: STAGE_A },
    });
    assert.equal(result.willExecute, false);
});

test('simulateRuleExecution: lead in different stage is skipped', () => {
    const rule = baseRule();
    const result = simulateRuleExecution({
        rule,
        leadSnapshot: { id: LEAD, name: null, pipelineId: PIPE_A, stageId: STAGE_B },
    });
    assert.equal(result.willExecute, false);
});

test('simulateRuleExecution: returns planned action when match', () => {
    const rule = baseRule();
    const result = simulateRuleExecution({
        rule,
        leadSnapshot: { id: LEAD, name: 'Cliente X', pipelineId: PIPE_A, stageId: STAGE_A },
    });
    assert.equal(result.willExecute, true);
    assert.deepEqual(result.plannedAction, {
        actionType: 'CREATE_LINKED_CARD',
        targetPipelineId: PIPE_B,
        targetStageId: STAGE_B,
        linkStrategy: 'KEEP_LEAD',
    });
});
