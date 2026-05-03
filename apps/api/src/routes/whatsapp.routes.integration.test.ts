import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Integração real do canal canônico Meta Cloud API:
// POST /api/v1/webhooks/whatsapp/ → BullMQ → worker → upsertConversationFromInbound + appendInboundMessage.
// Requer stack rodando (docker compose up -d) e:
//   - TEST_API_URL              (ex: http://localhost)
//   - TEST_META_APP_SECRET      (mesmo valor do META_APP_SECRET no container api)
//   - TEST_META_VERIFY_TOKEN    (mesmo valor do META_WEBHOOK_VERIFY_TOKEN no container api)
//   - TEST_ADMIN_JWT            (JWT ADMIN/ROOT válido para listar inbox)
const API_URL = process.env['TEST_API_URL'];
const APP_SECRET = process.env['TEST_META_APP_SECRET'];
const VERIFY_TOKEN = process.env['TEST_META_VERIFY_TOKEN'];
const ADMIN_JWT = process.env['TEST_ADMIN_JWT'];

const skip = !API_URL || !APP_SECRET || !VERIFY_TOKEN || !ADMIN_JWT
    ? 'TEST_API_URL, TEST_META_APP_SECRET, TEST_META_VERIFY_TOKEN e TEST_ADMIN_JWT são obrigatórios.'
    : null;

function signMeta(rawBody: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs = 8000, stepMs = 250): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const v = await fn();
        if (v !== null && v !== undefined) return v;
        await new Promise(r => setTimeout(r, stepMs));
    }
    throw new Error('Timeout esperando worker BullMQ persistir a mensagem.');
}

test('P0.1: GET verify challenge responde com hub.challenge', { skip: skip ?? false }, async () => {
    const url = `${API_URL}/api/v1/webhooks/whatsapp/?hub.verify_token=${encodeURIComponent(VERIFY_TOKEN!)}&hub.challenge=ping_${Date.now()}&hub.mode=subscribe`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /^ping_\d+$/);
});

test('P0.1: POST sem assinatura válida é rejeitado com 401', { skip: skip ?? false }, async () => {
    const res = await fetch(`${API_URL}/api/v1/webhooks/whatsapp/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64),
        },
        body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] }),
    });
    assert.equal(res.status, 401);
});

test('P0.1: POST Meta inbound persiste conversa+mensagem, é idempotente, aparece no inbox', { skip: skip ?? false }, async () => {
    const baseUrl = API_URL!.replace(/\/$/, '');
    const waId = `5511${String(Math.floor(900000000 + Math.random() * 99999999)).slice(0, 9)}`;
    const phoneE164 = `+${waId}`;
    const metaId = `wamid.QA_INT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const body = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
            id: 'biz-1',
            changes: [{
                field: 'messages',
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '5511999999999', phone_number_id: 'PN1' },
                    contacts: [{ profile: { name: 'QA Meta Integration' }, wa_id: waId }],
                    messages: [{
                        from: waId,
                        id: metaId,
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        text: { body: `[meta-int] ${metaId}` },
                        type: 'text',
                    }],
                },
            }],
        }],
    });
    const sig = signMeta(body, APP_SECRET!);

    const post = async () => fetch(`${baseUrl}/api/v1/webhooks/whatsapp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig },
        body,
    });

    const first = await post();
    assert.equal(first.status, 200, '1ª chamada deve retornar 200');
    assert.deepEqual(await first.json(), { status: 'received' });

    // Worker é assíncrono (BullMQ). Espera a mensagem aparecer no inbox.
    type ConvSummary = {
        id: string;
        whatsapp_number: string;
        unread_count: number;
        last_message_preview: string | null;
    };
    const conv = await waitFor<ConvSummary>(async () => {
        const r = await fetch(`${baseUrl}/api/v1/inbox/conversations?q=${encodeURIComponent(waId)}&limit=10`, {
            headers: { 'Authorization': `Bearer ${ADMIN_JWT}` },
        });
        if (r.status !== 200) return null;
        const j = await r.json() as { data: ConvSummary[] };
        const found = j.data.find(c => c.whatsapp_number === phoneE164);
        return found && found.unread_count >= 1 ? found : null;
    });

    assert.equal(conv.unread_count, 1, 'unread_count deve ser 1 após 1ª inbound');
    assert.equal(conv.last_message_preview, `[meta-int] ${metaId}`);

    // 2ª chamada — mesmo wamid: idempotente
    const second = await post();
    assert.equal(second.status, 200);

    // Aguarda processamento e re-checa (não deve subir unread, não deve duplicar)
    await new Promise(r => setTimeout(r, 1500));
    const listAfter = await fetch(`${baseUrl}/api/v1/inbox/conversations?q=${encodeURIComponent(waId)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${ADMIN_JWT}` },
    });
    const listJson = await listAfter.json() as { data: ConvSummary[] };
    const convAfter = listJson.data.find(c => c.id === conv.id);
    assert.ok(convAfter, 'conversa segue listada');
    assert.equal(convAfter!.unread_count, 1, 'unread_count não pode subir em retry idempotente');

    // Thread mostra exatamente 1 mensagem com aquele wamid
    const thread = await fetch(`${baseUrl}/api/v1/inbox/conversations/${conv.id}`, {
        headers: { 'Authorization': `Bearer ${ADMIN_JWT}` },
    });
    assert.equal(thread.status, 200);
    const threadBody = await thread.json() as {
        conversation: { id: string };
        messages: Array<{ meta_message_id: string | null; direction: string; content: string | null }>;
    };
    const matches = threadBody.messages.filter(m => m.meta_message_id === metaId);
    assert.equal(matches.length, 1, 'thread deve conter exatamente 1 mensagem com o wamid usado');
    assert.equal(matches[0]!.direction, 'INBOUND');
    assert.equal(matches[0]!.content, `[meta-int] ${metaId}`);
});
