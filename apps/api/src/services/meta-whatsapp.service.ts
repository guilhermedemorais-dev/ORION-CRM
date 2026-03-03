import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import type { MessageType, ParsedWhatsAppInboundEvent } from '../types/entities.js';

interface MetaErrorPayload {
    error?: {
        code?: number;
        message?: string;
    };
}

interface MetaSendMessageResponse {
    messages?: Array<{
        id?: string;
    }>;
}

interface MetaWebhookMessage {
    id?: string;
    from?: string;
    type?: string;
    text?: {
        body?: string;
    };
    image?: {
        caption?: string;
    };
    document?: {
        filename?: string;
        caption?: string;
    };
    audio?: Record<string, unknown>;
}

function normalizeWhatsappNumber(value: string): string {
    const digits = value.replace(/[^\d]/g, '');
    return digits ? `+${digits}` : value;
}

function mapInboundType(type: string | undefined): MessageType | null {
    switch (type) {
        case 'text':
            return 'TEXT';
        case 'image':
            return 'IMAGE';
        case 'document':
            return 'DOCUMENT';
        case 'audio':
            return 'AUDIO';
        default:
            return null;
    }
}

function getInboundContent(message: MetaWebhookMessage, type: MessageType): string | null {
    if (type === 'TEXT') {
        return message.text?.body?.trim() || null;
    }

    if (type === 'IMAGE') {
        return message.image?.caption?.trim() || '[Imagem recebida]';
    }

    if (type === 'DOCUMENT') {
        return message.document?.caption?.trim()
            || (message.document?.filename ? `[Documento: ${message.document.filename}]` : '[Documento recebido]');
    }

    if (type === 'AUDIO') {
        return '[Áudio recebido]';
    }

    return null;
}

function getMetaConfig() {
    const config = env();

    if (!config.META_API_TOKEN || !config.META_PHONE_NUMBER_ID || !config.META_WEBHOOK_VERIFY_TOKEN || !config.META_APP_SECRET) {
        throw AppError.serviceUnavailable(
            'WHATSAPP_NOT_CONFIGURED',
            'A integração com a Meta Cloud API ainda não foi configurada.'
        );
    }

    return {
        apiToken: config.META_API_TOKEN,
        phoneNumberId: config.META_PHONE_NUMBER_ID,
        webhookVerifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
        appSecret: config.META_APP_SECRET,
    };
}

function getMetaWebhookConfig() {
    const config = env();

    if (!config.META_WEBHOOK_VERIFY_TOKEN || !config.META_APP_SECRET) {
        throw AppError.serviceUnavailable(
            'WHATSAPP_WEBHOOK_NOT_CONFIGURED',
            'O webhook da Meta Cloud API ainda não foi configurado.'
        );
    }

    return {
        webhookVerifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
        appSecret: config.META_APP_SECRET,
    };
}

function getMetaSendConfig() {
    const config = env();

    if (!config.META_API_TOKEN || !config.META_PHONE_NUMBER_ID) {
        throw AppError.serviceUnavailable(
            'WHATSAPP_NOT_CONFIGURED',
            'A integração de envio com a Meta Cloud API ainda não foi configurada.'
        );
    }

    return {
        apiToken: config.META_API_TOKEN,
        phoneNumberId: config.META_PHONE_NUMBER_ID,
    };
}

export function assertMetaConfigured(): void {
    getMetaConfig();
}

export function assertMetaWebhookConfigured(): void {
    getMetaWebhookConfig();
}

export function getMetaWebhookVerifyToken(): string {
    return getMetaWebhookConfig().webhookVerifyToken;
}

export function verifyMetaSignature(rawBody: string, signature: string): boolean {
    const { appSecret } = getMetaWebhookConfig();

    if (!signature.startsWith('sha256=')) {
        return false;
    }

    const digest = signature.slice('sha256='.length);

    if (!/^[a-f0-9]{64}$/i.test(digest)) {
        return false;
    }

    const provided = Buffer.from(digest, 'hex');
    const expected = Buffer.from(
        crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex'),
        'hex'
    );

    if (provided.length === 0 || provided.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(provided, expected);
}

export function parseWebhookPayload(payload: unknown): ParsedWhatsAppInboundEvent[] {
    const source = typeof payload === 'object' && payload !== null
        ? payload as {
            entry?: Array<{
                changes?: Array<{
                    value?: {
                        contacts?: Array<{
                            profile?: {
                                name?: string;
                            };
                            wa_id?: string;
                        }>;
                        messages?: MetaWebhookMessage[];
                    };
                }>;
            }>;
        }
        : null;

    if (!source?.entry?.length) {
        return [];
    }

    const events: ParsedWhatsAppInboundEvent[] = [];

    for (const entry of source.entry) {
        for (const change of entry.changes ?? []) {
            const contacts = change.value?.contacts ?? [];
            const contactByWaId = new Map<string, string>();

            for (const contact of contacts) {
                if (contact.wa_id) {
                    contactByWaId.set(normalizeWhatsappNumber(contact.wa_id), contact.profile?.name?.trim() || '');
                }
            }

            for (const message of change.value?.messages ?? []) {
                if (!message.id || !message.from) {
                    continue;
                }

                const mappedType = mapInboundType(message.type);
                if (!mappedType) {
                    continue;
                }

                const whatsappNumber = normalizeWhatsappNumber(message.from);
                const profileName = contactByWaId.get(whatsappNumber) || null;

                events.push({
                    meta_message_id: message.id,
                    whatsapp_number: whatsappNumber,
                    profile_name: profileName,
                    type: mappedType,
                    content: getInboundContent(message, mappedType),
                    media_url: null,
                    received_at: new Date().toISOString(),
                });
            }
        }
    }

    return events;
}

export async function sendTextMessage(input: { to: string; text: string }): Promise<{ meta_message_id: string }> {
    const { apiToken, phoneNumberId } = getMetaSendConfig();

    let response: Response;

    try {
        response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
            signal: AbortSignal.timeout(10_000),
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: input.to,
                type: 'text',
                text: {
                    body: input.text,
                },
            }),
        });
    } catch {
        throw AppError.serviceUnavailable(
            'META_UNAVAILABLE',
            'A Meta Cloud API está indisponível no momento.'
        );
    }

    const payload = await response.json().catch(() => ({})) as MetaSendMessageResponse & MetaErrorPayload;

    if (!response.ok) {
        const metaErrorCode = payload.error?.code;

        if (metaErrorCode === 131047) {
            throw new AppError(422, 'META_TEMPLATE_NOT_APPROVED', 'O template da Meta ainda não foi aprovado.');
        }

        if (response.status === 401 || response.status === 403) {
            throw AppError.serviceUnavailable(
                'META_AUTH_ERROR',
                'Falha de autenticação com a Meta Cloud API.'
            );
        }

        throw AppError.serviceUnavailable(
            'META_UNAVAILABLE',
            payload.error?.message || 'A Meta Cloud API rejeitou a requisição.'
        );
    }

    const metaMessageId = payload.messages?.[0]?.id;

    if (!metaMessageId) {
        throw AppError.serviceUnavailable(
            'META_UNAVAILABLE',
            'A Meta Cloud API não retornou o identificador da mensagem.'
        );
    }

    return {
        meta_message_id: metaMessageId,
    };
}
