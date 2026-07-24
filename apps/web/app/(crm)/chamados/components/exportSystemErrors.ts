export type SystemErrorExportMode = 'all' | 'selected';

interface DownloadSystemErrorsInput {
    mode: SystemErrorExportMode;
    errorIds?: string[];
    source?: string;
    search?: string;
}

function filenameFromDisposition(disposition: string | null): string {
    const fallback = 'orion-debug-errors.md';
    if (!disposition) return fallback;
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    return match?.[1] || fallback;
}

export async function downloadSystemErrorsExport(input: DownloadSystemErrorsInput): Promise<void> {
    const payload = input.mode === 'all'
        ? {
            mode: 'all',
            ...(input.source ? { source: input.source } : {}),
            ...(input.search ? { search: input.search } : {}),
        }
        : {
            mode: 'selected',
            errorIds: input.errorIds ?? [],
        };

    const res = await fetch('/api/internal/system/errors/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        let msg = `[HTTP_${res.status}] Falha ao exportar erros.`;
        try {
            const body = await res.json();
            msg = `[${body?.error || `HTTP_${res.status}`}] ${body?.message || 'Falha ao exportar erros.'}`;
        } catch {
            // Mantem fallback quando o backend retorna resposta nao JSON.
        }
        throw new Error(msg);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFromDisposition(res.headers.get('content-disposition'));
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
