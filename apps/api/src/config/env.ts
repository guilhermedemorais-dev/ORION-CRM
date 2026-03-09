import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),

    // Database
    DATABASE_URL: z.string().min(1),

    // Redis
    REDIS_URL: z.string().min(1),

    // JWT
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),

    // Operator
    OPERATOR_WEBHOOK_SECRET: z.string().min(32),
    OPERATOR_INSTANCE_ID: z.string().optional(),

    // Meta Cloud API (WhatsApp)
    META_API_TOKEN: z.string().min(1).optional(),
    META_PHONE_NUMBER_ID: z.string().optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    META_APP_SECRET: z.string().min(1).optional(),

    // Evolution API (WhatsApp instance management)
    EVOLUTION_URL: z.string().url().optional(),
    EVOLUTION_API_KEY: z.string().optional(),
    EVOLUTION_INSTANCE: z.string().optional(),

    // OpenAI
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),

    // Mercado Pago
    MP_ACCESS_TOKEN: z.string().optional(),
    MP_WEBHOOK_SECRET: z.string().optional(),

    // n8n
    N8N_URL: z.string().url().optional(),
    N8N_API_KEY: z.string().optional(),
    N8N_WEBHOOK_URL: z.string().url().optional(),

    // SMTP
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    // URLs
    APP_URL: z.string().url(),
    FRONTEND_URL: z.string().url(),

    // Uploads
    MAX_FILE_SIZE_MB: z.coerce.number().default(5),
    UPLOAD_PATH: z.string().default('/app/uploads'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
    if (_env) return _env;

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.format();
        const missing = Object.entries(formatted)
            .filter(([key, val]) => key !== '_errors' && val && typeof val === 'object' && '_errors' in val)
            .map(([key, val]) => {
                const errors = (val as { _errors: string[] })._errors;
                return `  ${key}: ${errors.join(', ')}`;
            })
            .join('\n');

        console.error(`\n❌ Environment validation failed:\n${missing}\n`);
        process.exit(1);
    }

    _env = result.data;
    return _env;
}

export function env(): Env {
    if (!_env) {
        return loadEnv();
    }
    return _env;
}
