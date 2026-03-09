import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

type WhatsAppConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';

interface EvolutionStatusPayload {
    status: WhatsAppConnectionStatus;
    connected_number: string | null;
    connected_at: string | null;
}

interface EvolutionQrPayload {
    qr_code_base64: string;
}

function getEvolutionConfig() {
    const config = env();

    if (!config.EVOLUTION_URL || !config.EVOLUTION_API_KEY || !config.EVOLUTION_INSTANCE) {
        throw AppError.serviceUnavailable(
            'EVOLUTION_NOT_CONFIGURED',
            'Evolution API não configurada para esta instância.'
        );
    }

    return {
        baseUrl: config.EVOLUTION_URL.replace(/\/+$/, ''),
        apiKey: config.EVOLUTION_API_KEY,
        instance: config.EVOLUTION_INSTANCE,
    };
}

async function evolutionRequest(path: string, init?: RequestInit): Promise<Response> {
    const { baseUrl, apiKey } = getEvolutionConfig();

    try {
        return await fetch(`${baseUrl}${path}`, {
            ...init,
            headers: {
                apikey: apiKey,
                'Content-Type': 'application/json',
                ...(init?.headers || {}),
            },
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        throw AppError.serviceUnavailable(
            'EVOLUTION_UNAVAILABLE',
            'Evolution API indisponível no momento.'
        );
    }
}

function normalizeConnectionStatus(rawStatus: string | null | undefined): WhatsAppConnectionStatus {
    const normalized = (rawStatus || '').toLowerCase();

    if (['open', 'connected', 'online'].includes(normalized)) {
        return 'CONNECTED';
    }

    if (['connecting', 'qrcode', 'qr', 'pairing'].includes(normalized)) {
        return 'CONNECTING';
    }

    return 'DISCONNECTED';
}

function extractStatusFromFetchInstances(payload: unknown, instanceName: string): EvolutionStatusPayload {
    const fallback: EvolutionStatusPayload = {
        status: 'DISCONNECTED',
        connected_number: null,
        connected_at: null,
    };

    const rawArray = Array.isArray(payload)
        ? payload
        : (
            typeof payload === 'object'
            && payload !== null
            && Array.isArray((payload as { instance?: unknown[] }).instance)
        )
            ? (payload as { instance: unknown[] }).instance
            : [];

    const instance = rawArray.find((item) => {
        if (!item || typeof item !== 'object') {
            return false;
        }

        const record = item as Record<string, unknown>;
        const name =
            typeof record['name'] === 'string'
                ? record['name']
                : typeof record['instanceName'] === 'string'
                    ? record['instanceName']
                    : typeof record['instance'] === 'string'
                        ? record['instance']
                        : null;

        return name === instanceName;
    }) as Record<string, unknown> | undefined;

    if (!instance) {
        return fallback;
    }

    const status =
        normalizeConnectionStatus(
            typeof instance['connectionStatus'] === 'string'
                ? instance['connectionStatus'] as string
                : typeof instance['status'] === 'string'
                    ? instance['status'] as string
                    : null
        );

    const connectedNumber =
        typeof instance['ownerJid'] === 'string'
            ? (instance['ownerJid'] as string).replace('@s.whatsapp.net', '')
            : typeof instance['number'] === 'string'
                ? instance['number'] as string
                : null;

    const connectedAt =
        typeof instance['updatedAt'] === 'string'
            ? instance['updatedAt'] as string
            : typeof instance['createdAt'] === 'string'
                ? instance['createdAt'] as string
                : null;

    return {
        status,
        connected_number: connectedNumber,
        connected_at: connectedAt,
    };
}

function extractQrCode(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const record = payload as Record<string, unknown>;
    const directCandidates = ['base64', 'qrcode', 'qrCode', 'code'];

    for (const candidate of directCandidates) {
        const value = record[candidate];
        if (typeof value === 'string' && value.length > 20) {
            return value;
        }
    }

    const nestedCandidates = ['qrcode', 'qrCode', 'qr', 'data'];
    for (const candidate of nestedCandidates) {
        const nested = record[candidate];
        if (nested && typeof nested === 'object') {
            const nestedRecord = nested as Record<string, unknown>;
            for (const key of directCandidates) {
                const value = nestedRecord[key];
                if (typeof value === 'string' && value.length > 20) {
                    return value;
                }
            }
        }
    }

    return null;
}

export async function fetchEvolutionStatus(): Promise<EvolutionStatusPayload> {
    const { instance } = getEvolutionConfig();
    const response = await evolutionRequest('/instance/fetchInstances', { method: 'GET' });

    if (!response.ok) {
        throw AppError.serviceUnavailable(
            'EVOLUTION_UNAVAILABLE',
            'Não foi possível consultar o status do WhatsApp.'
        );
    }

    const payload = await response.json().catch(() => ({}));
    return extractStatusFromFetchInstances(payload, instance);
}

export async function fetchEvolutionQrCode(): Promise<EvolutionQrPayload> {
    const { instance } = getEvolutionConfig();
    const response = await evolutionRequest(`/instance/connect/${instance}`, { method: 'GET' });

    if (!response.ok) {
        throw AppError.serviceUnavailable(
            'EVOLUTION_UNAVAILABLE',
            'Não foi possível gerar o QR Code agora.'
        );
    }

    const payload = await response.json().catch(() => ({}));
    const qrCode = extractQrCode(payload);

    if (!qrCode) {
        throw AppError.serviceUnavailable(
            'EVOLUTION_QR_UNAVAILABLE',
            'QR Code indisponível para a instância no momento.'
        );
    }

    return { qr_code_base64: qrCode };
}

export async function disconnectEvolutionInstance(): Promise<void> {
    const { instance } = getEvolutionConfig();
    const attempts: Array<{ path: string; method: 'POST' | 'DELETE' }> = [
        { path: `/instance/logout/${instance}`, method: 'POST' },
        { path: `/instance/logout/${instance}`, method: 'DELETE' },
        { path: `/instance/connectionState/${instance}`, method: 'DELETE' },
    ];

    let lastStatus = 0;

    for (const attempt of attempts) {
        const response = await evolutionRequest(attempt.path, { method: attempt.method });
        lastStatus = response.status;
        if (response.ok) {
            return;
        }
    }

    throw AppError.serviceUnavailable(
        'EVOLUTION_DISCONNECT_FAILED',
        `Não foi possível desconectar a instância do WhatsApp (status: ${lastStatus || 'n/a'}).`
    );
}
