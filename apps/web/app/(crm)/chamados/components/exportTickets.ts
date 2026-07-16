export type TicketExportMode = 'all' | 'selected';
export type TicketExportType = 'BUG' | 'SUGGESTION' | 'OTHER';

interface DownloadTicketsExportInput {
    mode: TicketExportMode;
    ticketIds?: string[];
    type?: TicketExportType;
}

function filenameFromDisposition(disposition: string | null): string {
    const fallback = 'orion-incidentes.zip';
    if (!disposition) return fallback;
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    return match?.[1] || fallback;
}

export async function downloadTicketsExport(input: DownloadTicketsExportInput): Promise<void> {
    const payload = input.mode === 'all'
        ? { mode: 'all', ...(input.type ? { type: input.type } : {}) }
        : { mode: 'selected', ticketIds: input.ticketIds ?? [], ...(input.type ? { type: input.type } : {}) };

    const res = await fetch('/api/internal/tickets/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        let msg = `[HTTP_${res.status}] Falha ao exportar incidentes.`;
        try {
            const body = await res.json();
            msg = `[${body?.error || `HTTP_${res.status}`}] ${body?.message || 'Falha ao exportar incidentes.'}`;
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
