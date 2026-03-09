export type StoreTheme = 'dark' | 'light';
export type StoreBadge = 'novo' | 'sale' | 'hot';
export type StoreOrderStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';

export function normalizeStoreSlug(input: string): string {
    return input
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

export function resolveStorePriceCents(
    value: { price_cents?: number | null; price_from_cents?: number | null }
): number | null {
    if (typeof value.price_cents === 'number' && value.price_cents > 0) {
        return value.price_cents;
    }

    if (typeof value.price_from_cents === 'number' && value.price_from_cents > 0) {
        return value.price_from_cents;
    }

    return null;
}

export function isStoreProductAvailable(input: { is_custom: boolean; stock_quantity: number | null }): boolean {
    if (input.is_custom) {
        return true;
    }

    return (input.stock_quantity ?? 0) > 0;
}

export function buildStoreWhatsAppMessage(
    template: string | null | undefined,
    values: {
        product_name: string;
        product_url: string;
    }
): string {
    const baseTemplate = template && template.trim()
        ? template
        : 'Olá! Tenho interesse em uma peça personalizada.\nProduto base: {{product_name}}\nLink: {{product_url}}';

    return baseTemplate
        .replaceAll('{{product_name}}', values.product_name)
        .replaceAll('{{product_url}}', values.product_url);
}

export function normalizeStoreCustomerPhone(phone: string | null | undefined, fallbackSeed: string): string {
    const digits = (phone ?? '').replace(/\D/g, '');

    if (digits.length >= 12 && digits.startsWith('55')) {
        return `+${digits}`;
    }

    if (digits.length >= 8) {
        return `+55${digits}`;
    }

    const fallbackDigits = fallbackSeed.replace(/\D/g, '').padEnd(11, '0').slice(0, 11);
    return `+55${fallbackDigits}`;
}

export function buildStoreCrmOrderNotes(input: {
    storeOrderId: string;
    paymentId: string | null;
    existingNotes?: string | null;
}): string {
    const lines = [
        input.existingNotes?.trim(),
        'Origem: Loja ORION',
        `Store order: ${input.storeOrderId}`,
        input.paymentId ? `Pagamento MP: ${input.paymentId}` : null,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));

    if (input.existingNotes?.trim()) {
        const [first, ...rest] = lines;
        return [first, rest.join('\n')].filter(Boolean).join('\n\n');
    }

    return lines.join('\n');
}
