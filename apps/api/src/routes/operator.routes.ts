import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { rateLimit } from '../middleware/rateLimit.js';
import type { OperatorAction, WebhookResult } from '../types/entities.js';

const router = Router();

const operatorActionSchema = z.enum(['provision', 'suspend', 'reactivate', 'update_plan', 'decommission']);
const planSchema = z.enum(['starter', 'professional', 'enterprise']);

const provisionPayloadSchema = z.object({
    admin: z.object({
        name: z.string().min(2).max(255),
        email: z.string().email().max(255),
        temp_password: z.string().min(8).max(100),
    }),
    branding: z.object({
        company_name: z.string().min(2).max(255),
        primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#C8A97A'),
    }),
    plan: planSchema.default('starter'),
});

const webhookSchema = z.object({
    action: operatorActionSchema,
    idempotency_key: z.string().uuid(),
    payload: z.record(z.unknown()).optional(),
});

const legacyProvisionSchema = z.object({
    action: z.literal('provision'),
    idempotency_key: z.string().uuid(),
    admin: provisionPayloadSchema.shape.admin,
    branding: provisionPayloadSchema.shape.branding,
    plan: planSchema.default('starter'),
});

interface NormalizedWebhookBody {
    action: OperatorAction;
    idempotency_key: string;
    payload?: Record<string, unknown>;
}

function verifyHmac(payload: string, signature: string, secret: string): boolean {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    const providedBuffer = Buffer.from(signature.trim());
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function normalizeWebhookBody(body: unknown): NormalizedWebhookBody {
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) {
        throw AppError.badRequest('Invalid webhook payload.');
    }

    const data = parsed.data;

    if (data.action === 'provision') {
        if (data.payload) {
            const provisionPayload = provisionPayloadSchema.safeParse(data.payload);
            if (!provisionPayload.success) {
                throw AppError.badRequest('Invalid provision payload.');
            }

            return {
                action: data.action,
                idempotency_key: data.idempotency_key,
                payload: provisionPayload.data,
            };
        }

        const legacyPayload = legacyProvisionSchema.safeParse(body);
        if (!legacyPayload.success) {
            throw AppError.badRequest('Invalid provision payload.');
        }

        return {
            action: 'provision',
            idempotency_key: legacyPayload.data.idempotency_key,
            payload: {
                admin: legacyPayload.data.admin,
                branding: legacyPayload.data.branding,
                plan: legacyPayload.data.plan,
            },
        };
    }

    if (data.action === 'update_plan') {
        const updatePlanPayload = z.object({ plan: planSchema }).safeParse(data.payload ?? {});
        if (!updatePlanPayload.success) {
            throw AppError.badRequest('Invalid plan.');
        }

        return {
            action: data.action,
            idempotency_key: data.idempotency_key,
            payload: updatePlanPayload.data,
        };
    }

    return data;
}

router.post(
    '/webhook',
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'operator-webhook' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const signatureHeader = req.headers['x-operator-signature'];
            const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

            if (!signature) {
                next(AppError.unauthorized('Missing operator signature.'));
                return;
            }

            const rawBody = req.rawBody ?? '';
            const isValid = rawBody.length > 0 && verifyHmac(rawBody, signature, env().OPERATOR_WEBHOOK_SECRET);

            if (!isValid) {
                logger.warn({ requestId: req.requestId }, 'Invalid operator webhook signature');
                next(AppError.unauthorized('Invalid signature.'));
                return;
            }

            const normalizedBody = normalizeWebhookBody(req.body);
            const { action, idempotency_key } = normalizedBody;

            const existing = await query(
                'SELECT id FROM operator_webhook_log WHERE idempotency_key = $1',
                [idempotency_key]
            );
            if (existing.rows[0]) {
                res.json({ result: 'already_done' });
                return;
            }

            const payloadToLog = normalizedBody as unknown as Record<string, unknown>;

            try {
                switch (action) {
                    case 'provision':
                        await handleProvision(normalizedBody);
                        break;
                    case 'suspend':
                        await handleSuspend();
                        break;
                    case 'reactivate':
                        await handleReactivate();
                        break;
                    case 'update_plan':
                        await handleUpdatePlan(normalizedBody);
                        break;
                    case 'decommission':
                        await handleDecommission();
                        break;
                }

                await logWebhook(action, idempotency_key, payloadToLog, 'success', null);
                res.json({ result: 'success' });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                await logWebhook(action, idempotency_key, payloadToLog, 'error', errorMessage);
                next(err instanceof Error ? err : new Error('Unknown operator webhook error'));
            }
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/health',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${env().OPERATOR_WEBHOOK_SECRET}`) {
                next(AppError.unauthorized());
                return;
            }

            const { checkDatabase } = await import('../db/pool.js');
            const { checkRedis } = await import('../db/redis.js');

            const [dbOk, redisOk] = await Promise.all([checkDatabase(), checkRedis()]);

            const settingsResult = await query<{ status: string; company_name: string; plan: string }>(
                'SELECT status, company_name, plan FROM settings LIMIT 1'
            );
            const settings = settingsResult.rows[0];

            res.json({
                status: settings?.status || 'unknown',
                company_name: settings?.company_name || 'Not provisioned',
                plan: settings?.plan || 'unknown',
                db: dbOk ? 'ok' : 'error',
                redis: redisOk ? 'ok' : 'error',
                version: '1.1.0',
                uptime_seconds: Math.floor(process.uptime()),
            });
        } catch (err) {
            next(err);
        }
    }
);

async function handleProvision(body: NormalizedWebhookBody): Promise<void> {
    const parsed = provisionPayloadSchema.safeParse(body.payload ?? {});
    if (!parsed.success) {
        throw AppError.badRequest('Invalid provision payload.');
    }

    const { admin, branding, plan } = parsed.data;

    await transaction(async (client) => {
        const settingsResult = await client.query<{ status: string }>(
            'SELECT status FROM settings LIMIT 1'
        );
        const settings = settingsResult.rows[0];

        if (settings?.status === 'decommissioned') {
            throw new AppError(410, 'DECOMMISSIONED', 'Instância encerrada.');
        }

        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [admin.email.toLowerCase()]
        );
        if (existingUser.rows[0]) {
            throw AppError.conflict('ALREADY_PROVISIONED', 'Instância já provisionada.');
        }

        const passwordHash = await bcrypt.hash(admin.temp_password, 12);
        await client.query(
            `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, 'ADMIN', 'active')`,
            [admin.name, admin.email.toLowerCase(), passwordHash]
        );

        await client.query(
            `UPDATE settings SET
         company_name = $1,
         primary_color = $2,
         plan = $3,
         status = 'active',
         provisioned_at = NOW(),
         updated_at = NOW()`,
            [branding.company_name, branding.primary_color, plan]
        );
    });

    logger.info({ email: '[REDACTED]' }, 'Instance provisioned');
}

async function handleSuspend(): Promise<void> {
    await assertInstanceMutable();
    await query(
        `UPDATE settings SET status = 'suspended', suspended_at = NOW(), updated_at = NOW()`
    );
    logger.info('Instance suspended');
}

async function handleReactivate(): Promise<void> {
    await assertInstanceMutable();
    await query(
        `UPDATE settings SET status = 'active', suspended_at = NULL, updated_at = NOW()`
    );
    logger.info('Instance reactivated');
}

async function handleUpdatePlan(body: NormalizedWebhookBody): Promise<void> {
    await assertInstanceMutable();

    const payload = z.object({ plan: planSchema }).safeParse(body.payload ?? {});
    if (!payload.success) {
        throw AppError.badRequest('Invalid plan.');
    }

    await query(
        'UPDATE settings SET plan = $1, updated_at = NOW()',
        [payload.data.plan]
    );
    logger.info({ plan: payload.data.plan }, 'Plan updated');
}

async function handleDecommission(): Promise<void> {
    await query(
        `UPDATE settings SET status = 'decommissioned', updated_at = NOW()`
    );
    logger.info('Instance decommissioned');
}

async function assertInstanceMutable(): Promise<void> {
    const settingsResult = await query<{ status: string }>('SELECT status FROM settings LIMIT 1');
    const settings = settingsResult.rows[0];

    if (settings?.status === 'decommissioned') {
        throw new AppError(410, 'DECOMMISSIONED', 'Instância encerrada.');
    }
}

async function logWebhook(
    action: OperatorAction,
    idempotencyKey: string,
    payload: Record<string, unknown>,
    result: WebhookResult,
    errorMessage: string | null
): Promise<void> {
    const safePayload = { ...payload };

    const nestedPayload = safePayload['payload'];
    if (nestedPayload && typeof nestedPayload === 'object') {
        const payloadRecord = nestedPayload as Record<string, unknown>;
        if (payloadRecord['admin'] && typeof payloadRecord['admin'] === 'object') {
            payloadRecord['admin'] = {
                ...(payloadRecord['admin'] as Record<string, unknown>),
                temp_password: '[REDACTED]',
            };
        }
        safePayload['payload'] = payloadRecord;
    }

    if (safePayload['admin'] && typeof safePayload['admin'] === 'object') {
        safePayload['admin'] = {
            ...(safePayload['admin'] as Record<string, unknown>),
            temp_password: '[REDACTED]',
        };
    }

    await query(
        `INSERT INTO operator_webhook_log (action, idempotency_key, payload, result, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
        [action, idempotencyKey, JSON.stringify(safePayload), result, errorMessage]
    );
}

export default router;
