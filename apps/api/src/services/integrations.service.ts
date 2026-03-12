import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';

export type IntegrationProvider = 'meta' | 'n8n' | 'mercadopago';
export type IntegrationStatus = 'connected' | 'pending' | 'error';

const workflowSnapshot = [
    {
        id: 'wf_aurora_sdr_001',
        label: 'AURORA SDR — Atendimento WA',
        status: 'active' as const,
    },
    {
        id: 'wf_checkout_mp_001',
        label: 'Checkout Webhook — Mercado Pago',
        status: 'active' as const,
    },
    {
        id: 'wf_notify_agents_001',
        label: 'Notificações WA — Atendentes',
        status: 'active' as const,
    },
    {
        id: 'wf_lead_qualify_001',
        label: 'Lead Qualificado → CRM',
        status: 'paused' as const,
    },
];

function stripTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function maskSecret(
    value: string | undefined,
    options: {
        head?: number;
        tail?: number;
    } = {}
): string | null {
    if (!value) return null;

    const head = options.head ?? 8;
    const tail = options.tail ?? 4;

    if (value.length <= head + tail) {
        return `${value.slice(0, Math.max(0, value.length - 2))}••`;
    }

    return `${value.slice(0, head)}••••••••••••${value.slice(-tail)}`;
}

function integrationSecret(): string {
    return env().JWT_SECRET;
}

function safeJsonParse(payload: string | null): Record<string, unknown> {
    if (!payload) return {};
    try {
        return JSON.parse(payload) as Record<string, unknown>;
    } catch {
        return {};
    }
}

export function integrationStatus(isConfigured: boolean): IntegrationStatus {
    return isConfigured ? 'connected' : 'pending';
}

export async function getOrgId(): Promise<string> {
    const result = await query<{ id: string }>('SELECT id FROM settings LIMIT 1');
    const settings = result.rows[0];
    if (!settings) {
        throw AppError.notFound();
    }
    return settings.id;
}

export async function loadIntegration(orgId: string, provider: IntegrationProvider): Promise<{
    status: IntegrationStatus;
    last_check: string | null;
    credentials: Record<string, unknown>;
}> {
    const secret = integrationSecret();
    const result = await query<{
        status: IntegrationStatus;
        last_check: string | null;
        credentials: string | null;
    }>(
        `SELECT status, last_check, pgp_sym_decrypt(credentials, $2)::text AS credentials
         FROM org_integrations
         WHERE org_id = $1 AND provider = $3`,
        [orgId, secret, provider]
    );

    const row = result.rows[0];
    if (!row) {
        await query(
            `INSERT INTO org_integrations (org_id, provider, credentials, status)
             VALUES ($1, $2, pgp_sym_encrypt($3::text, $4), 'pending')`,
            [orgId, provider, JSON.stringify({}), secret]
        );
        return { status: 'pending', last_check: null, credentials: {} };
    }

    return {
        status: row.status,
        last_check: row.last_check,
        credentials: safeJsonParse(row.credentials),
    };
}

export async function saveIntegration(
    orgId: string,
    provider: IntegrationProvider,
    credentials: Record<string, unknown>,
    status: IntegrationStatus,
    lastCheck: Date | null
): Promise<void> {
    const secret = integrationSecret();
    await query(
        `INSERT INTO org_integrations (org_id, provider, credentials, status, last_check, updated_at)
         VALUES ($1, $2, pgp_sym_encrypt($3::text, $4), $5, $6, NOW())
         ON CONFLICT (org_id, provider)
         DO UPDATE SET credentials = EXCLUDED.credentials, status = EXCLUDED.status, last_check = EXCLUDED.last_check, updated_at = NOW()`,
        [orgId, provider, JSON.stringify(credentials), secret, status, lastCheck]
    );
}

export async function buildIntegrationsSnapshot(orgId: string) {
    const config = env();
    const apiBaseUrl = `${stripTrailingSlash(config.APP_URL)}/api/v1`;
    const meta = await loadIntegration(orgId, 'meta');
    const n8n = await loadIntegration(orgId, 'n8n');
    const mp = await loadIntegration(orgId, 'mercadopago');

    const metaCreds = meta.credentials as {
        access_token?: string;
        phone_number_id?: string;
        waba_id?: string;
        verify_token?: string;
    };

    const n8nCreds = n8n.credentials as {
        base_url?: string;
        api_key?: string;
        webhook_url?: string;
    };

    const mpCreds = mp.credentials as {
        access_token?: string;
        public_key?: string;
        sandbox_access_token?: string;
        sandbox_mode?: boolean;
    };

    return {
        meta: {
            status: meta.status,
            access_token_masked: maskSecret(metaCreds.access_token, { head: 6, tail: 4 }),
            phone_number_id: metaCreds.phone_number_id ?? null,
            waba_id: metaCreds.waba_id ?? null,
            verify_token: metaCreds.verify_token ?? null,
            webhook_url: `${apiBaseUrl}/webhooks/whatsapp`,
            docs_url: 'https://docs.orion.io',
        },
        n8n: {
            status: n8n.status,
            base_url: n8nCreds.base_url ?? null,
            api_key_masked: maskSecret(n8nCreds.api_key, { head: 8, tail: 0 }),
            webhook_url: n8nCreds.webhook_url ?? null,
            workflows: workflowSnapshot.map((workflow) => ({
                ...workflow,
                status: n8n.status === 'connected' ? workflow.status : 'paused',
            })),
        },
        mercadopago: {
            status: mp.status,
            access_token_masked: maskSecret(mpCreds.access_token, { head: 7, tail: 4 }),
            public_key_masked: maskSecret(mpCreds.public_key, { head: 7, tail: 4 }),
            sandbox_access_token_masked: maskSecret(mpCreds.sandbox_access_token, { head: 7, tail: 4 }),
            sandbox_mode: Boolean(mpCreds.sandbox_mode),
            webhook_url: `${apiBaseUrl}/webhooks/mercadopago`,
        },
    };
}

