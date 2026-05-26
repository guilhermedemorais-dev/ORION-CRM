import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { sendTextMessage as sendViaMetaEnv } from './meta-whatsapp.service.js';

type ProviderType =
    | 'evolution'
    | 'uazapi'
    | 'meta'
    | 'baileys'
    | 'zapi'
    | 'twilio'
    | 'generic_rest';

interface ProviderRow {
    id: string;
    name: string;
    provider_type: ProviderType;
    credentials: Record<string, string>;
    base_url: string | null;
    instance_name: string | null;
}

export interface WhatsAppSendResult {
    provider_message_id: string;
    provider_type: ProviderType | 'meta_env';
    provider_id: string | null;
}

export interface WhatsAppSendInput {
    to: string;
    text: string;
}

const FETCH_TIMEOUT_MS = 12_000;

function normalizePhone(raw: string): string {
    return raw.replace(/\D/g, '');
}

async function fetchPrimaryProvider(): Promise<ProviderRow | null> {
    const result = await query<ProviderRow>(
        `SELECT id, name, provider_type, credentials, base_url, instance_name
         FROM whatsapp_providers
         WHERE is_primary = true AND active = true
         LIMIT 1`
    );
    return result.rows[0] ?? null;
}

async function postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown
): Promise<{ status: number; payload: unknown }> {
    let response: Response;
    try {
        response = await fetch(url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body),
        });
    } catch {
        throw AppError.serviceUnavailable(
            'WHATSAPP_PROVIDER_UNAVAILABLE',
            'O provedor WhatsApp está indisponível no momento.'
        );
    }
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
}

function pickId(payload: unknown, candidates: string[]): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;
    for (const key of candidates) {
        const value = obj[key];
        if (typeof value === 'string' && value.length > 0) return value;
    }
    return null;
}

function deepPickId(payload: unknown, candidates: string[]): string | null {
    const direct = pickId(payload, candidates);
    if (direct) return direct;
    if (payload && typeof payload === 'object') {
        for (const value of Object.values(payload as Record<string, unknown>)) {
            if (value && typeof value === 'object') {
                const nested = deepPickId(value, candidates);
                if (nested) return nested;
            }
        }
    }
    return null;
}

async function sendViaUazapi(
    provider: ProviderRow,
    input: WhatsAppSendInput
): Promise<string> {
    const baseUrl = (provider.base_url ?? '').replace(/\/+$/, '');
    const apiKey = provider.credentials['api_key'];
    if (!baseUrl || !apiKey) {
        throw new AppError(422, 'WHATSAPP_PROVIDER_MISCONFIGURED', 'UazAPI sem URL base ou API Key configurados.');
    }

    const { status, payload } = await postJson(
        `${baseUrl}/send/text`,
        { token: apiKey },
        { number: normalizePhone(input.to), text: input.text }
    );

    if (status < 200 || status >= 300) {
        throw new AppError(
            502,
            'WHATSAPP_PROVIDER_REJECTED',
            (payload as { message?: string })?.message ?? `UazAPI retornou status ${status}.`
        );
    }

    return deepPickId(payload, ['id', 'messageId', 'message_id', 'wamid', 'key_id']) ?? `uazapi-${Date.now()}`;
}

async function sendViaEvolution(
    provider: ProviderRow,
    input: WhatsAppSendInput
): Promise<string> {
    const baseUrl = (provider.base_url ?? '').replace(/\/+$/, '');
    const apiKey = provider.credentials['api_key'];
    const instance = provider.instance_name ?? '';
    if (!baseUrl || !apiKey || !instance) {
        throw new AppError(422, 'WHATSAPP_PROVIDER_MISCONFIGURED', 'Evolution API sem URL, API Key ou instância.');
    }

    const { status, payload } = await postJson(
        `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
        { apikey: apiKey },
        { number: normalizePhone(input.to), text: input.text }
    );

    if (status < 200 || status >= 300) {
        throw new AppError(
            502,
            'WHATSAPP_PROVIDER_REJECTED',
            (payload as { message?: string })?.message ?? `Evolution API retornou status ${status}.`
        );
    }

    return deepPickId(payload, ['id', 'messageId', 'message_id', 'wamid']) ?? `evolution-${Date.now()}`;
}

async function sendViaMetaProvider(
    provider: ProviderRow,
    input: WhatsAppSendInput
): Promise<string> {
    const accessToken = provider.credentials['access_token'];
    const phoneNumberId = provider.credentials['phone_number_id'];
    if (!accessToken || !phoneNumberId) {
        throw new AppError(422, 'WHATSAPP_PROVIDER_MISCONFIGURED', 'Meta Cloud sem Access Token ou Phone Number ID.');
    }

    const { status, payload } = await postJson(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        { Authorization: `Bearer ${accessToken}` },
        {
            messaging_product: 'whatsapp',
            to: normalizePhone(input.to),
            type: 'text',
            text: { body: input.text },
        }
    );

    if (status < 200 || status >= 300) {
        const errMsg = (payload as { error?: { message?: string } })?.error?.message;
        throw new AppError(502, 'WHATSAPP_PROVIDER_REJECTED', errMsg ?? `Meta Cloud retornou status ${status}.`);
    }

    return (payload as { messages?: Array<{ id: string }> })?.messages?.[0]?.id
        ?? deepPickId(payload, ['id', 'wamid'])
        ?? `meta-${Date.now()}`;
}

async function sendViaZapi(
    provider: ProviderRow,
    input: WhatsAppSendInput
): Promise<string> {
    const instanceId = provider.credentials['instance_id'];
    const clientToken = provider.credentials['client_token'];
    const securityToken = provider.credentials['security_token'];
    if (!instanceId || !clientToken || !securityToken) {
        throw new AppError(422, 'WHATSAPP_PROVIDER_MISCONFIGURED', 'Z-API sem credenciais completas.');
    }

    const { status, payload } = await postJson(
        `https://api.z-api.io/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(clientToken)}/send-text`,
        { 'Client-Token': securityToken },
        { phone: normalizePhone(input.to), message: input.text }
    );

    if (status < 200 || status >= 300) {
        throw new AppError(
            502,
            'WHATSAPP_PROVIDER_REJECTED',
            (payload as { message?: string })?.message ?? `Z-API retornou status ${status}.`
        );
    }

    return deepPickId(payload, ['messageId', 'id', 'message_id']) ?? `zapi-${Date.now()}`;
}

async function sendViaGenericRest(
    provider: ProviderRow,
    input: WhatsAppSendInput
): Promise<string> {
    const apiKey = provider.credentials['api_key'];
    const authHeader = provider.credentials['auth_header'] || 'Authorization';
    const sendUrl = provider.credentials['send_url'];
    if (!apiKey || !sendUrl) {
        throw new AppError(422, 'WHATSAPP_PROVIDER_MISCONFIGURED', 'REST genérico sem URL ou API Key.');
    }

    const headerValue = authHeader.toLowerCase() === 'authorization' ? `Bearer ${apiKey}` : apiKey;
    const { status, payload } = await postJson(
        sendUrl,
        { [authHeader]: headerValue },
        { number: normalizePhone(input.to), text: input.text }
    );

    if (status < 200 || status >= 300) {
        throw new AppError(
            502,
            'WHATSAPP_PROVIDER_REJECTED',
            (payload as { message?: string })?.message ?? `Provedor REST retornou status ${status}.`
        );
    }

    return deepPickId(payload, ['id', 'messageId', 'message_id']) ?? `rest-${Date.now()}`;
}

export async function sendWhatsAppMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const provider = await fetchPrimaryProvider();

    if (!provider) {
        // Fallback: usa Meta Cloud configurada via .env (compatibilidade com setup antigo).
        const result = await sendViaMetaEnv(input);
        return {
            provider_message_id: result.meta_message_id,
            provider_type: 'meta_env',
            provider_id: null,
        };
    }

    let providerMessageId: string;
    switch (provider.provider_type) {
        case 'uazapi':
            providerMessageId = await sendViaUazapi(provider, input);
            break;
        case 'evolution':
            providerMessageId = await sendViaEvolution(provider, input);
            break;
        case 'meta':
            providerMessageId = await sendViaMetaProvider(provider, input);
            break;
        case 'zapi':
            providerMessageId = await sendViaZapi(provider, input);
            break;
        case 'generic_rest':
            providerMessageId = await sendViaGenericRest(provider, input);
            break;
        case 'baileys':
        case 'twilio':
            throw new AppError(
                501,
                'WHATSAPP_PROVIDER_NOT_IMPLEMENTED',
                `Envio via ${provider.provider_type} ainda não está implementado.`
            );
        default: {
            const exhaustive: never = provider.provider_type;
            throw new AppError(500, 'WHATSAPP_PROVIDER_UNKNOWN', `Tipo de provedor desconhecido: ${String(exhaustive)}.`);
        }
    }

    return {
        provider_message_id: providerMessageId,
        provider_type: provider.provider_type,
        provider_id: provider.id,
    };
}
