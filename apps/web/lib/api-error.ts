// Helper compartilhado para extrair erros da API de forma consistente.
//
// Backend retorna sempre:
//   { error: 'CODE', message: 'mensagem', requestId: 'uuid', details?: [...] }
//
// O frontend deve mostrar: a mensagem (clara, pro usuário) + o código + o requestId
// (suporte/dev pode investigar o log com esse ID).

export interface ApiErrorBody {
    error?: string;
    message?: string;
    requestId?: string;
    details?: Array<{ field: string; message: string }>;
}

export interface ExtractedApiError {
    /** Mensagem amigável pra mostrar ao usuário. */
    message: string;
    /** Código de erro estável (ex: VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR). */
    code: string;
    /** ID da requisição — útil pro suporte localizar no log. */
    requestId: string | null;
    /** Detalhes de validação (campo + mensagem). */
    details: Array<{ field: string; message: string }>;
}

const FALLBACK: ExtractedApiError = {
    message: 'Erro inesperado. Tente novamente em alguns instantes.',
    code: 'UNKNOWN',
    requestId: null,
    details: [],
};

/**
 * Extrai um erro estruturado de uma resposta `fetch` que não foi 2xx.
 * Funciona com qualquer endpoint do CRM.
 *
 * Uso:
 *   const res = await fetch(...);
 *   if (!res.ok) {
 *     const err = await extractApiError(res);
 *     showToast(formatApiError(err));
 *     return;
 *   }
 */
export async function extractApiError(res: Response): Promise<ExtractedApiError> {
    let body: ApiErrorBody | null = null;
    try {
        body = (await res.json()) as ApiErrorBody;
    } catch {
        body = null;
    }
    return {
        message: body?.message?.trim() || FALLBACK.message,
        code: body?.error?.trim() || `HTTP_${res.status}`,
        requestId: body?.requestId ?? null,
        details: Array.isArray(body?.details) ? body!.details! : [],
    };
}

/**
 * Variante a partir de um `Error` lançado (try/catch).
 * Se for um erro com body anexado (raro), tenta extrair; senão usa a mensagem.
 */
export function extractApiErrorFromError(err: unknown): ExtractedApiError {
    if (err instanceof Error) {
        return {
            message: err.message || FALLBACK.message,
            code: 'UNKNOWN',
            requestId: null,
            details: [],
        };
    }
    return FALLBACK;
}

/**
 * Formata para exibição em toast/banner curto:
 *   "Já existe um kanban com este nome. (VALIDATION_ERROR)"
 *
 * O requestId fica em segunda linha, opcional.
 */
export function formatApiError(err: ExtractedApiError, opts?: { showCode?: boolean; showRequestId?: boolean }): string {
    const showCode = opts?.showCode ?? true;
    const showRequestId = opts?.showRequestId ?? false;
    let out = err.message;
    if (showCode && err.code) {
        out += ` (${err.code})`;
    }
    if (showRequestId && err.requestId) {
        out += ` · ID ${err.requestId.slice(0, 8)}`;
    }
    return out;
}
