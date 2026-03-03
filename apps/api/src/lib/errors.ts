export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details: Array<{ field: string; message: string }>;

    constructor(
        statusCode: number,
        code: string,
        message: string,
        details: Array<{ field: string; message: string }> = []
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message: string, details: Array<{ field: string; message: string }> = []) {
        return new AppError(400, 'VALIDATION_ERROR', message, details);
    }

    static unauthorized(message = 'Sessão expirada. Faça login novamente.') {
        return new AppError(401, 'UNAUTHORIZED', message);
    }

    static forbidden(message = 'Você não tem permissão para esta ação.') {
        return new AppError(403, 'FORBIDDEN', message);
    }

    static notFound(message = 'Recurso não encontrado.') {
        return new AppError(404, 'NOT_FOUND', message);
    }

    static conflict(code: string, message: string) {
        return new AppError(409, code, message);
    }

    static rateLimited(retryAfterSeconds: number) {
        return new AppError(429, 'RATE_LIMITED', `Muitas requisições. Tente em ${retryAfterSeconds} segundos.`);
    }

    static serviceUnavailable(code: string, message: string) {
        return new AppError(503, code, message);
    }

    static internal(requestId: string) {
        return new AppError(500, 'INTERNAL_ERROR', `Erro interno. ID: ${requestId}`);
    }
}
