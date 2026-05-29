import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';

// Integração real do P0.3 — RBAC do módulo de clientes:
//   Leitura: aberta para qualquer usuário autenticado.
//   Escrita: apenas ROOT/ADMIN, dono da carteira ou usuário com toggle
//            users.custom_permissions.clientes_outros = true.
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

function mintJwt(id: string, role: string, name: string): string {
    return jwt.sign({ id, email: `${name}@qa.local`, role, name }, JWT_SECRET!, { expiresIn: '15m' });
}

async function expectStatus(method: string, path: string, token: string, body: unknown, expected: number): Promise<void> {
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    assert.equal(res.status, expected, `${method} ${path} esperado ${expected}, recebeu ${res.status}`);
}

test('P0.3: matriz de RBAC de customers (leitura aberta, escrita escopada com toggle)', { skip: skip ?? false }, async () => {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();

    // IDs de teste isolados (ramdomizados pra rodar em paralelo sem colidir)
    const dono = crypto.randomUUID();
    const outro = crypto.randomUUID();
    const adminUserId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const phone = `+5511${String(Math.floor(900000000 + Math.random() * 99999999)).slice(0, 9)}`;

    try {
        // Seed: 3 usuários (DONO atendente, OUTRO atendente, ADMIN) + 1 cliente atribuído ao DONO.
        await client.query(
            `INSERT INTO users (id, name, email, password_hash, role, status, custom_permissions)
             VALUES
               ($1, 'P03 DONO', $4, 'x', 'ATENDENTE', 'active', '{}'::jsonb),
               ($2, 'P03 OUTRO', $5, 'x', 'ATENDENTE', 'active', '{}'::jsonb),
               ($3, 'P03 ADMIN', $6, 'x', 'ADMIN', 'active', '{}'::jsonb)`,
            [dono, outro, adminUserId, `p03-dono-${dono}@qa.local`, `p03-outro-${outro}@qa.local`, `p03-admin-${adminUserId}@qa.local`]
        );
        await client.query(
            `INSERT INTO customers (id, name, whatsapp_number, assigned_to)
             VALUES ($1, 'P03 Cliente', $2, $3)`,
            [customerId, phone, dono]
        );

        const tokenDono = mintJwt(dono, 'ATENDENTE', 'p03-dono');
        const tokenOutro = mintJwt(outro, 'ATENDENTE', 'p03-outro');
        const tokenAdmin = mintJwt(adminUserId, 'ADMIN', 'p03-admin');

        // ── LEITURA aberta para qualquer perfil ──────────────────────────────
        await expectStatus('GET', `/api/v1/customers/${customerId}`, tokenOutro, undefined, 200);
        await expectStatus('GET', `/api/v1/customers/${customerId}/full`, tokenOutro, undefined, 200);
        await expectStatus('GET', `/api/v1/customers/${customerId}/orders`, tokenOutro, undefined, 200);
        await expectStatus('GET', `/api/v1/customers/${customerId}/stats`, tokenOutro, undefined, 200);
        await expectStatus('GET', `/api/v1/customers/${customerId}/history?type=all`, tokenOutro, undefined, 200);

        // ── ESCRITA bloqueada para atendente fora da carteira (toggle OFF) ────
        await expectStatus('PATCH', `/api/v1/customers/${customerId}`, tokenOutro, { social_name: 'hack' }, 403);
        await expectStatus('POST', `/api/v1/customers/${customerId}/feedback`, tokenOutro, {}, 403);

        // ── ESCRITA permitida ao DONO ─────────────────────────────────────────
        await expectStatus('PATCH', `/api/v1/customers/${customerId}`, tokenDono, { social_name: 'pelo dono' }, 200);

        // ── ESCRITA permitida ao ADMIN ────────────────────────────────────────
        await expectStatus('PATCH', `/api/v1/customers/${customerId}`, tokenAdmin, { social_name: 'pelo admin' }, 200);

        // ── Liga toggle clientes_outros no OUTRO via PATCH /users/:id ─────────
        await expectStatus(
            'PATCH',
            `/api/v1/users/${outro}`,
            tokenAdmin,
            { custom_permissions: { clientes: true, clientes_outros: true } },
            200
        );

        // Confirma persistência via DB direto
        const { rows } = await client.query<{ custom_permissions: Record<string, boolean> }>(
            'SELECT custom_permissions FROM users WHERE id = $1',
            [outro]
        );
        assert.equal(rows[0]?.custom_permissions?.['clientes_outros'], true, 'toggle deve estar persistido no DB');

        // ── Agora OUTRO consegue editar cliente alheio ───────────────────────
        await expectStatus('PATCH', `/api/v1/customers/${customerId}`, tokenOutro, { social_name: 'com toggle' }, 200);

        // ── Desliga toggle e confirma 403 de novo ────────────────────────────
        await expectStatus(
            'PATCH',
            `/api/v1/users/${outro}`,
            tokenAdmin,
            { custom_permissions: { clientes: true, clientes_outros: false } },
            200
        );
        await expectStatus('PATCH', `/api/v1/customers/${customerId}`, tokenOutro, { social_name: 'sem toggle' }, 403);

    } finally {
        // Cleanup
        await client.query('DELETE FROM customers WHERE id = $1', [customerId]).catch(() => {});
        await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[dono, outro, adminUserId]]).catch(() => {});
        await client.end();
    }
});
