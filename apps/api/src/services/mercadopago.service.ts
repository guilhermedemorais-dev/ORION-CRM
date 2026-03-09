import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const MP_BASE_URL = 'https://api.mercadopago.com';

interface CreatePreferenceInput {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    payerEmail?: string | null;
    itemTitle?: string;
    externalReference?: string;
}

interface MercadoPagoPreferenceResponse {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
}

interface MercadoPagoPaymentResponse {
    id: number;
    status: string;
    transaction_amount: number;
    payment_method_id: string | null;
    external_reference?: string | null;
}

function assertMercadoPagoConfigured(): { accessToken: string; webhookSecret: string } {
    const config = env();

    if (!config.MP_ACCESS_TOKEN) {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Mercado Pago temporariamente indisponível. Configure MP_ACCESS_TOKEN.'
        );
    }

    if (!config.MP_WEBHOOK_SECRET) {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Mercado Pago temporariamente indisponível. Configure MP_WEBHOOK_SECRET.'
        );
    }

    return {
        accessToken: config.MP_ACCESS_TOKEN,
        webhookSecret: config.MP_WEBHOOK_SECRET,
    };
}

function normalizeSignatureHeader(signatureHeader: string): string | null {
    const raw = signatureHeader.trim();

    if (!raw) {
        return null;
    }

    if (raw.startsWith('sha256=')) {
        return raw.slice('sha256='.length);
    }

    const parts = raw.split(',');
    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key?.trim() === 'v1' && value) {
            return value.trim();
        }
    }

    return raw;
}

export function verifyMercadoPagoSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) {
        return false;
    }

    const { webhookSecret } = assertMercadoPagoConfigured();
    const normalized = normalizeSignatureHeader(signatureHeader);

    if (!normalized) {
        return false;
    }

    const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(normalized, 'hex');

    if (expectedBuffer.length === 0 || receivedBuffer.length === 0) {
        return false;
    }

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function createPaymentPreference(
    input: CreatePreferenceInput
): Promise<{ preferenceId: string; checkoutUrl: string }> {
    const { accessToken } = assertMercadoPagoConfigured();

    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            items: [
                {
                    id: input.orderId,
                    title: input.itemTitle ?? `Pedido ${input.orderNumber}`,
                    quantity: 1,
                    unit_price: Number((input.amountCents / 100).toFixed(2)),
                    currency_id: 'BRL',
                },
            ],
            payer: input.payerEmail ? { email: input.payerEmail } : undefined,
            external_reference: input.externalReference ?? input.orderId,
        }),
    }).catch(() => {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Pagamento temporariamente indisponível. Tente em instantes.'
        );
    });

    if (!response.ok) {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Pagamento temporariamente indisponível. Tente em instantes.'
        );
    }

    const data = await response.json() as MercadoPagoPreferenceResponse;
    const checkoutUrl = data.init_point ?? data.sandbox_init_point;

    if (!data.id || !checkoutUrl) {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Mercado Pago não retornou um checkout válido.'
        );
    }

    return {
        preferenceId: data.id,
        checkoutUrl,
    };
}

export async function fetchMercadoPagoPayment(paymentId: string): Promise<{
    paymentId: string;
    status: string;
    amountCents: number;
    paymentMethod: string | null;
    orderId: string | null;
}> {
    const { accessToken } = assertMercadoPagoConfigured();

    const response = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    }).catch(() => {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Pagamento temporariamente indisponível. Tente em instantes.'
        );
    });

    if (!response.ok) {
        throw AppError.serviceUnavailable(
            'MP_UNAVAILABLE',
            'Pagamento temporariamente indisponível. Tente em instantes.'
        );
    }

    const data = await response.json() as MercadoPagoPaymentResponse;

    return {
        paymentId: String(data.id),
        status: data.status,
        amountCents: Math.round(data.transaction_amount * 100),
        paymentMethod: data.payment_method_id,
        orderId: data.external_reference ?? null,
    };
}
