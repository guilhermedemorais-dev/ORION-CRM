import { query } from '../db/pool.js';
import type { OrderPaymentStatus } from './payment-status.service.js';

export type FlowPaymentRule =
    | 'none'
    | 'not_overdue'
    | 'requires_partial'
    | 'requires_paid_in_full'
    | 'requires_refunded';

export type FlowStageRole = 'none' | 'in_production' | 'finalized' | 'cancelled';

export interface FlowRuleViolation {
    code: string;
    message: string;
    technical: string;
}

export interface FlowRuleCheckInput {
    orderId: string;
    targetStageId: string;
}

export interface FlowRuleCheckResult {
    ok: boolean;
    violations: FlowRuleViolation[];
}

const PAYMENT_LABEL: Record<OrderPaymentStatus, string> = {
    nao_pago: 'Não pago',
    parcial: 'Sinal pago / parcial',
    pago: 'Pago integralmente',
    estornado: 'Estornado',
    isento: 'Isento',
};

function evaluatePaymentRule(
    rule: FlowPaymentRule,
    status: OrderPaymentStatus
): FlowRuleViolation | null {
    if (rule === 'none') return null;
    if (rule === 'not_overdue') {
        if (status === 'estornado') {
            return {
                code: 'PAYMENT_OVERDUE',
                message: 'Este pedido está estornado e não pode entrar nesta etapa.',
                technical: `payment_rule=not_overdue; current_status=${status}`,
            };
        }
        return null;
    }
    if (rule === 'requires_partial') {
        if (status === 'parcial' || status === 'pago' || status === 'isento') return null;
        return {
            code: 'PAYMENT_INSUFFICIENT',
            message: `Esta etapa exige pelo menos sinal pago. Status atual: ${PAYMENT_LABEL[status]}.`,
            technical: `payment_rule=requires_partial; current_status=${status}`,
        };
    }
    if (rule === 'requires_paid_in_full') {
        if (status === 'pago' || status === 'isento') return null;
        return {
            code: 'PAYMENT_NOT_FULL',
            message: `Esta etapa exige pagamento total. Status atual: ${PAYMENT_LABEL[status]}.`,
            technical: `payment_rule=requires_paid_in_full; current_status=${status}`,
        };
    }
    if (rule === 'requires_refunded') {
        if (status === 'estornado') return null;
        return {
            code: 'PAYMENT_NOT_REFUNDED',
            message: `Esta etapa exige estorno feito. Status atual: ${PAYMENT_LABEL[status]}.`,
            technical: `payment_rule=requires_refunded; current_status=${status}`,
        };
    }
    return null;
}

interface OrderForCheckRow {
    id: string;
    payment_status: OrderPaymentStatus;
    flow_id: string | null;
}

interface RuleRow {
    payment_rule: FlowPaymentRule;
    stage_role: FlowStageRole;
}

interface StageRow {
    pipeline_id: string;
    name: string;
}

/**
 * Verifica se a movimentação do pedido pra targetStageId é permitida segundo
 * as regras do fluxo associado.
 *
 *  - Se o pedido não tem flow_id (legado), nada é bloqueado.
 *  - Se a etapa destino não pertence ao pipeline do fluxo, retorna violation.
 *  - Se não há rule cadastrada pra essa etapa, nada é bloqueado.
 */
export async function checkFlowRules(input: FlowRuleCheckInput): Promise<FlowRuleCheckResult> {
    const { orderId, targetStageId } = input;

    const orderRes = await query<OrderForCheckRow>(
        `SELECT id, payment_status, flow_id FROM orders WHERE id = $1 LIMIT 1`,
        [orderId]
    );
    const order = orderRes.rows[0];
    if (!order) {
        return { ok: false, violations: [{ code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado.', technical: `order_id=${orderId}` }] };
    }

    // Pedido sem fluxo associado: legado, não aplica regras.
    if (!order.flow_id) {
        return { ok: true, violations: [] };
    }

    // Garante que a etapa destino pertence ao pipeline do fluxo.
    const flowRes = await query<{ pipeline_id: string }>(
        `SELECT pipeline_id FROM flows WHERE id = $1 LIMIT 1`,
        [order.flow_id]
    );
    const flow = flowRes.rows[0];
    if (!flow) {
        return { ok: false, violations: [{ code: 'FLOW_NOT_FOUND', message: 'Fluxo associado ao pedido não encontrado.', technical: `flow_id=${order.flow_id}` }] };
    }

    const stageRes = await query<StageRow>(
        `SELECT pipeline_id, name FROM pipeline_stages WHERE id = $1 LIMIT 1`,
        [targetStageId]
    );
    const stage = stageRes.rows[0];
    if (!stage) {
        return { ok: false, violations: [{ code: 'STAGE_NOT_FOUND', message: 'A etapa destino não existe.', technical: `stage_id=${targetStageId}` }] };
    }
    if (stage.pipeline_id !== flow.pipeline_id) {
        return {
            ok: false,
            violations: [{
                code: 'STAGE_OUTSIDE_FLOW',
                message: 'A etapa destino não pertence ao pipeline configurado neste fluxo.',
                technical: `stage_pipeline=${stage.pipeline_id}; flow_pipeline=${flow.pipeline_id}`,
            }],
        };
    }

    // Busca regra cadastrada pra (flow, stage).
    const ruleRes = await query<RuleRow>(
        `SELECT payment_rule, stage_role
         FROM flow_stage_rules
         WHERE flow_id = $1 AND stage_id = $2
         LIMIT 1`,
        [order.flow_id, targetStageId]
    );
    const rule = ruleRes.rows[0];
    if (!rule) {
        return { ok: true, violations: [] };
    }

    const violations: FlowRuleViolation[] = [];

    const paymentViolation = evaluatePaymentRule(rule.payment_rule, order.payment_status);
    if (paymentViolation) violations.push(paymentViolation);

    return { ok: violations.length === 0, violations };
}
