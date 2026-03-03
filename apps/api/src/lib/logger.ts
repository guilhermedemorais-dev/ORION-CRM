import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
    level: env().NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env().NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'password',
            'password_hash',
            'token',
            'accessToken',
            'refreshToken',
            'cpf',
            'META_API_TOKEN',
            'JWT_SECRET',
            'OPERATOR_WEBHOOK_SECRET',
        ],
        censor: '[REDACTED]',
    },
    serializers: {
        err: pino.stdSerializers.err,
    },
});

export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}
