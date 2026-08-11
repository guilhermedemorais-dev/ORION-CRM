import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';

// Integração real da TASK-054 — config por etapa em flow_stage_rules:
//   stock_action + min_role_to_move persistem via POST/PATCH/GET de flows;
//   configurar fluxo exige pipeline.configure (ADMIN/GERENTE; ROOT bypassa);
//   endpoints mortos de pipeline_stage_settings foram removidos.
// Requer:
//   TEST_API_URL          (ex: http://localhost)
//   TEST_JWT_SECRET       (mesmo JWT_SECRET do container api)
//   TEST_DATABASE_URL     (URL do postgres da stack)
const API_URL = process.env['TEST_API_URL'];
const JWT_SECRET = process.env['TEST_JWT_SECRET'];
const DB_URL = process.env['TEST_DATABASE_URL'];

const skip = !API_URL || !JWT_SECRET || !DB_URL
    ? 'TEST_API_URL, TEST_JWT_SECRET e TEST_DATABASE_URL são obrigatórios.'
    : null;

interface StageRulePayload {
    stage_id: string;
    payment_rule?: string;
    stage_role?: string;
    notify_on_enter?: boolean;
    stock_action?: string;
    min_role_to_move?: string | null;
}

interface FlowRuleResponse {
    stage_id: string;
    payment_rule: string;
    stage_role: string;
    notify_on_enter: boolean;
    stock_action: string;
    min_role_to_move: string | null;
}

function mintJwt(id: string, role: string, name: string): string {
    return jwt.sign({ id, email: `${name}@qa.local`, role, name }, JWT_SECRET!, { expiresIn: '15m' });
}

async function call(method: string, path: string, token: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json: json as Record<string, unknown> };
}

function ruleFor(json: Record<string, unknown>, stageId: string): FlowRuleResponse {
    const rules = json['rules'] as FlowRuleResponse[] | undefined;
    const rule = rules?.find(r => r.stage_id === stageId);
    assert.ok(rule, `regra da etapa ${stageId} deve vir no detalhe do fluxo`);
    return rule;
}

test('TASK-054: stock_action/min_role_to_move na config de fluxo + RBAC', { skip: skip ?? false }, async () => {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();

    const adminId = crypto.randomUUID();
    const atendenteId = crypto.randomUUID();
    const pipelineId = crypto.randomUUID();
    const stageCaixaId = crypto.randomUUID();
    const stageProducaoId = crypto.randomUUID();
    const suffix = pipelineId.slice(0, 8);
    let flowId: string | null = null;

    try {
        await client.query(
            `INSERT INTO users (id, name, email, password_hash, role, status, custom_permissions)
             VALUES
               ($1, 'T054 ADMIN', $3, 'x', 'ADMIN', 'active', '{}'::jsonb),
               ($2, 'T054 ATENDENTE', $4, 'x', 'ATENDENTE', 'active', '{}'::jsonb)`,
            [adminId, atendenteId, `t054-admin-${adminId}@qa.local`, `t054-atendente-${atendenteId}@qa.local`]
        );
        await client.query(
            `INSERT INTO pipelines (id, name, slug, created_by) VALUES ($1, $2, $3, $4)`,
            [pipelineId, `T054 Pipeline ${suffix}`, `t054-pipeline-${suffix}`, adminId]
        );
        await client.query(
            `INSERT INTO pipeline_stages (id, pipeline_id, name, position)
             VALUES ($1, $3, 'T054 Caixa', 1), ($2, $3, 'T054 Producao', 2)`,
            [stageCaixaId, stageProducaoId, pipelineId]
        );

        const tokenAdmin = mintJwt(adminId, 'ADMIN', 't054-admin');
        const tokenAtendente = mintJwt(atendenteId, 'ATENDENTE', 't054-atendente');

        const baseRules: StageRulePayload[] = [
            {
                stage_id: stageCaixaId,
                payment_rule: 'requires_partial',
                stage_role: 'none',
                notify_on_enter: true,
                stock_action: 'reservar',
                min_role_to_move: 'GERENTE',
            },
            { stage_id: stageProducaoId },
        ];

        // ── RBAC negativo: ATENDENTE não configura fluxo ──────────────────────
        const forbidden = await call('POST', '/api/v1/flows', tokenAtendente, {
            name: `T054 negado ${suffix}`,
            pipeline_id: pipelineId,
            stage_rules: baseRules,
        });
        assert.equal(forbidden.status, 403, 'ATENDENTE sem pipeline.configure deve receber 403 no POST');

        // ── Validação: min_role_to_move fora do enum UserRole ────────────────
        const badRole = await call('POST', '/api/v1/flows', tokenAdmin, {
            name: `T054 papel invalido ${suffix}`,
            pipeline_id: pipelineId,
            stage_rules: [{ stage_id: stageCaixaId, min_role_to_move: 'CHEFAO' }],
        });
        assert.equal(badRole.status, 400, 'min_role_to_move fora do enum UserRole deve ser rejeitado');

        // ── Validação: stock_action fora do enum ─────────────────────────────
        const badAction = await call('POST', '/api/v1/flows', tokenAdmin, {
            name: `T054 acao invalida ${suffix}`,
            pipeline_id: pipelineId,
            stage_rules: [{ stage_id: stageCaixaId, stock_action: 'sumir_com_o_ouro' }],
        });
        assert.equal(badAction.status, 400, 'stock_action fora do enum deve ser rejeitado');

        // ── POST: cria fluxo com os campos novos ─────────────────────────────
        const created = await call('POST', '/api/v1/flows', tokenAdmin, {
            name: `T054 fluxo ${suffix}`,
            pipeline_id: pipelineId,
            stage_rules: baseRules,
        });
        assert.equal(created.status, 201, 'ADMIN deve criar o fluxo');
        flowId = created.json['id'] as string;

        const caixaCriada = ruleFor(created.json, stageCaixaId);
        assert.equal(caixaCriada.stock_action, 'reservar');
        assert.equal(caixaCriada.min_role_to_move, 'GERENTE');
        // Não-regressão: os campos antigos continuam persistindo.
        assert.equal(caixaCriada.payment_rule, 'requires_partial');
        assert.equal(caixaCriada.notify_on_enter, true);

        // Etapa sem nenhuma config não vira linha em flow_stage_rules, mas volta
        // com os defaults no detalhe do fluxo.
        const producaoCriada = ruleFor(created.json, stageProducaoId);
        assert.equal(producaoCriada.stock_action, 'none');
        assert.equal(producaoCriada.min_role_to_move, null);
        const { rows: persistidas } = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM flow_stage_rules WHERE flow_id = $1`,
            [flowId]
        );
        assert.equal(persistidas[0]?.count, '1', 'regra totalmente vazia não deve ser persistida');

        // ── GET: detalhe devolve os campos novos ─────────────────────────────
        const fetched = await call('GET', `/api/v1/flows/${flowId}`, tokenAdmin);
        assert.equal(fetched.status, 200);
        assert.equal(ruleFor(fetched.json, stageCaixaId).stock_action, 'reservar');
        assert.equal(ruleFor(fetched.json, stageCaixaId).min_role_to_move, 'GERENTE');

        // ── PATCH: atualiza os campos novos ──────────────────────────────────
        const patched = await call('PATCH', `/api/v1/flows/${flowId}`, tokenAdmin, {
            stage_rules: [
                { stage_id: stageCaixaId, payment_rule: 'requires_paid_in_full', stock_action: 'baixar_peca', min_role_to_move: 'ADMIN' },
                { stage_id: stageProducaoId, stock_action: 'baixar_insumo' },
            ],
        });
        assert.equal(patched.status, 200, 'ADMIN deve atualizar o fluxo');
        const caixaPatch = ruleFor(patched.json, stageCaixaId);
        assert.equal(caixaPatch.stock_action, 'baixar_peca');
        assert.equal(caixaPatch.min_role_to_move, 'ADMIN');
        assert.equal(caixaPatch.payment_rule, 'requires_paid_in_full');
        // Regra só com stock_action (sem pagamento/papel) precisa persistir.
        assert.equal(ruleFor(patched.json, stageProducaoId).stock_action, 'baixar_insumo');

        // ── RBAC negativo no PATCH ───────────────────────────────────────────
        const patchForbidden = await call('PATCH', `/api/v1/flows/${flowId}`, tokenAtendente, { name: 'hack' });
        assert.equal(patchForbidden.status, 403, 'ATENDENTE não pode editar fluxo');

        // ── Endpoints mortos de pipeline_stage_settings foram removidos ──────
        const deadGet = await call('GET', `/api/v1/pipelines/${pipelineId}/stages/${stageCaixaId}/defaults`, tokenAdmin);
        assert.equal(deadGet.status, 404, 'GET /stages/:stageId/defaults deve ter sido removido');
        const deadPatch = await call('PATCH', `/api/v1/pipelines/${pipelineId}/stages/${stageCaixaId}/defaults`, tokenAdmin, { max_cards: 5 });
        assert.equal(deadPatch.status, 404, 'PATCH /stages/:stageId/defaults deve ter sido removido');

    } finally {
        if (flowId) await client.query('DELETE FROM flows WHERE id = $1', [flowId]).catch(() => {});
        await client.query('DELETE FROM flows WHERE pipeline_id = $1', [pipelineId]).catch(() => {});
        await client.query('DELETE FROM pipeline_stages WHERE pipeline_id = $1', [pipelineId]).catch(() => {});
        await client.query('DELETE FROM pipelines WHERE id = $1', [pipelineId]).catch(() => {});
        await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[adminId, atendenteId]]).catch(() => {});
        await client.end();
    }
});
