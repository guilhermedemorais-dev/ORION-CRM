export function parseCurrencyToCents(value: string): number | null {
    const cleanedValue = value.replace(/[R$\s]/g, '');
    if (!cleanedValue) {
        return null;
    }

    let normalizedValue = cleanedValue;

    if (normalizedValue.includes(',') && normalizedValue.includes('.')) {
        normalizedValue = normalizedValue.replace(/\./g, '').replace(',', '.');
    } else if (normalizedValue.includes(',')) {
        normalizedValue = normalizedValue.replace(',', '.');
    } else {
        const parts = normalizedValue.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1] && parts[1].length > 2)) {
            normalizedValue = parts.join('');
        }
    }

    const amount = Number(normalizedValue);

    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    return Math.round(amount * 100);
}
