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
