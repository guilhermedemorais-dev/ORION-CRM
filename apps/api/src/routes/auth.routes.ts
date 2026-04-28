import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createAuditLog } from '../middleware/audit.js';
import type { User } from '../types/entities.js';

const router = Router();

// ---- Schemas ----

const loginSchema = z.object({
    email: z.string().email().max(255).transform(v => v.toLowerCase().trim()),
    password: z.string().min(8).max(100),
});

// ---- Rate Limit: Login ----

const loginRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20,
    name: 'auth-login',
});

function isLocalLoginRequest(req: Request): boolean {
    const host = String(req.hostname || '').toLowerCase();
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').toLowerCase();
    return ['127.0.0.1', 'localhost', '::1'].includes(host)
        || ['127.0.0.1', 'localhost', '::1'].includes(forwardedHost);
}

interface FailedLoginEntry {
    failCount: number;
    windowResetAt: number;
    blockedUntil: number | null;
}

const failedLoginStore = new Map<string, FailedLoginEntry>();
const FAILED_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const FAILED_LOGIN_MAX_ATTEMPTS = 5;
const FAILED_LOGIN_BLOCK_MS = 15 * 60 * 1000;

const failedLoginCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of failedLoginStore) {
        const blockExpired = !entry.blockedUntil || entry.blockedUntil <= now;
        if (entry.windowResetAt <= now && blockExpired) {
            failedLoginStore.delete(key);
        }
    }
}, 60 * 1000);
failedLoginCleanup.unref?.();

function getFailedLoginKey(email: string, req: Request): string {
    return `${email}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

function getActiveFailedLoginEntry(key: string): FailedLoginEntry | null {
    const now = Date.now();
    const entry = failedLoginStore.get(key);

    if (!entry) {
        return null;
    }

    if (entry.blockedUntil && entry.blockedUntil > now) {
        return entry;
    }

    if (entry.windowResetAt <= now || (entry.blockedUntil && entry.blockedUntil <= now)) {
        failedLoginStore.delete(key);
        return null;
    }

    return entry;
}

function getFailedLoginRetryAfterSeconds(key: string): number | null {
    const entry = getActiveFailedLoginEntry(key);

    if (!entry?.blockedUntil) {
        return null;
    }

    return Math.max(1, Math.ceil((entry.blockedUntil - Date.now()) / 1000));
}

function registerFailedLogin(key: string): number | null {
    const now = Date.now();
    const current = getActiveFailedLoginEntry(key);

    const entry: FailedLoginEntry = current ?? {
        failCount: 0,
        windowResetAt: now + FAILED_LOGIN_WINDOW_MS,
        blockedUntil: null,
    };

    entry.failCount += 1;

    if (entry.failCount >= FAILED_LOGIN_MAX_ATTEMPTS) {
        entry.blockedUntil = now + FAILED_LOGIN_BLOCK_MS;
    }

    failedLoginStore.set(key, entry);

    if (!entry.blockedUntil) {
        return null;
    }

    return Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
}

function clearFailedLogin(key: string): void {
    failedLoginStore.delete(key);
}

// ---- POST /auth/login ----

router.post(
    '/login',
    (req: Request, res: Response, next: NextFunction) => {
        if (isLocalLoginRequest(req)) {
            next();
            return;
        }
        loginRateLimit(req, res, next);
    },
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = loginSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            const { email, password } = parsed.data;
            const failedLoginKey = getFailedLoginKey(email, req);
            const retryAfter = isLocalLoginRequest(req) ? null : getFailedLoginRetryAfterSeconds(failedLoginKey);

            if (retryAfter) {
                next(AppError.rateLimited(retryAfter));
                return;
            }

            // Find user
            const result = await query<User>(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            const user = result.rows[0];

            if (!user) {
                const blockedFor = isLocalLoginRequest(req) ? null : registerFailedLogin(failedLoginKey);
                next(blockedFor ? AppError.rateLimited(blockedFor) : AppError.unauthorized('Credenciais inválidas.'));
                return;
            }

            // Check if inactive
            if (user.status === 'inactive') {
                next(new AppError(403, 'FORBIDDEN', 'Conta desativada. Entre em contato com o administrador.'));
                return;
            }

            if (user.role !== 'ADMIN') {
                const settingsResult = await query<{ security_login_protection: boolean }>(
                    'SELECT security_login_protection FROM settings LIMIT 1'
                );
                const protectionEnabled = settingsResult.rows[0]?.security_login_protection;

                if (protectionEnabled) {
                    const now = new Date();
                    // Assuming local time for the business (timezone should be configured correctly on the server)
                    const hour = now.getHours();
                    
                    if (hour < 8 || hour >= 18) {
                        next(new AppError(403, 'FORBIDDEN', 'Acesso restrito: O sistema só pode ser acessado em horário comercial (08:00 às 18:00).'));
                        return;
                    }
                }
            }

            // Verify password
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                const blockedFor = isLocalLoginRequest(req) ? null : registerFailedLogin(failedLoginKey);
                next(blockedFor ? AppError.rateLimited(blockedFor) : AppError.unauthorized('Credenciais inválidas.'));
                return;
            }

            if (!isLocalLoginRequest(req)) {
                clearFailedLogin(failedLoginKey);
            }

            // Read session timeout from settings
            const timeoutResult = await query<{ security_session_timeout_minutes: number }>(
                'SELECT security_session_timeout_minutes FROM settings LIMIT 1'
            );
            const sessionTimeoutMinutes = timeoutResult.rows[0]?.security_session_timeout_minutes ?? 480;
            const jwtExpiresInSec = sessionTimeoutMinutes > 0 ? sessionTimeoutMinutes * 60 : 365 * 24 * 60 * 60;
            const cookieMaxAgeMs = sessionTimeoutMinutes > 0
                ? sessionTimeoutMinutes * 60 * 1000
                : 365 * 24 * 60 * 60 * 1000;

            // Generate tokens
            const accessToken = jwt.sign(
                { id: user.id, email: user.email, role: user.role, name: user.name },
                env().JWT_SECRET,
                { expiresIn: jwtExpiresInSec }
            );

            const refreshToken = crypto.randomBytes(64).toString('hex');
            const refreshTokenHash = crypto
                .createHash('sha256')
                .update(refreshToken)
                .digest('hex');

            const expiresAt = new Date(Date.now() + cookieMaxAgeMs);

            // Store refresh token
            await query(
                `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address)
         VALUES ($1, $2, $3, $4)`,
                [user.id, refreshTokenHash, expiresAt, req.ip || null]
            );

            // Update last_login_at
            await query(
                'UPDATE users SET last_login_at = NOW() WHERE id = $1',
                [user.id]
            );

            // Audit log
            await createAuditLog({
                userId: user.id,
                action: 'LOGIN',
                entityType: 'users',
                entityId: user.id,
                oldValue: null,
                newValue: null,
                req,
            });

            // Set refresh token as httpOnly cookie
            res.cookie('refresh_token', refreshToken, {
                httpOnly: true,
                secure: env().NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: cookieMaxAgeMs,
                path: '/api/v1/auth/refresh',
            });

            res.json({
                accessToken,
                session_timeout_minutes: sessionTimeoutMinutes,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// ---- POST /auth/refresh ----

router.post(
    '/refresh',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

            if (!refreshToken) {
                next(AppError.unauthorized());
                return;
            }

            const tokenHash = crypto
                .createHash('sha256')
                .update(refreshToken)
                .digest('hex');

            // Use transaction for token rotation
            const result = await transaction(async (client) => {
                // Find token
                const tokenResult = await client.query<{
                    id: string;
                    user_id: string;
                    expires_at: Date;
                    used_at: Date | null;
                    revoked: boolean;
                }>(
                    'SELECT * FROM refresh_tokens WHERE token_hash = $1',
                    [tokenHash]
                );
                const storedToken = tokenResult.rows[0];

                if (!storedToken) {
                    throw AppError.unauthorized();
                }

                // Detect reuse (stolen token)
                if (storedToken.used_at || storedToken.revoked) {
                    // Revoke ALL tokens for this user (security measure)
                    await client.query(
                        'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
                        [storedToken.user_id]
                    );
                    logger.warn(
                        { userId: storedToken.user_id },
                        'Refresh token reuse detected — all sessions revoked'
                    );
                    throw AppError.unauthorized();
                }

                // Check expiry
                if (new Date() > storedToken.expires_at) {
                    throw AppError.unauthorized();
                }

                // Mark current token as used BEFORE creating new one
                await client.query(
                    'UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1',
                    [storedToken.id]
                );

                // Get user
                const userResult = await client.query<User>(
                    'SELECT * FROM users WHERE id = $1',
                    [storedToken.user_id]
                );
                const user = userResult.rows[0];

                if (!user || user.status === 'inactive') {
                    throw AppError.unauthorized();
                }

                // Read session timeout from settings
                const timeoutResult = await client.query<{ security_session_timeout_minutes: number }>(
                    'SELECT security_session_timeout_minutes FROM settings LIMIT 1'
                );
                const sessionTimeoutMinutes = timeoutResult.rows[0]?.security_session_timeout_minutes ?? 480;
                const jwtExpiresInSec = sessionTimeoutMinutes > 0 ? sessionTimeoutMinutes * 60 : 365 * 24 * 60 * 60;
                const cookieMaxAgeMs = sessionTimeoutMinutes > 0
                    ? sessionTimeoutMinutes * 60 * 1000
                    : 365 * 24 * 60 * 60 * 1000;

                // Generate new token pair
                const newAccessToken = jwt.sign(
                    { id: user.id, email: user.email, role: user.role, name: user.name },
                    env().JWT_SECRET,
                    { expiresIn: jwtExpiresInSec }
                );

                const newRefreshToken = crypto.randomBytes(64).toString('hex');
                const newRefreshTokenHash = crypto
                    .createHash('sha256')
                    .update(newRefreshToken)
                    .digest('hex');

                const expiresAt = new Date(Date.now() + cookieMaxAgeMs);

                await client.query(
                    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address)
           VALUES ($1, $2, $3, $4)`,
                    [user.id, newRefreshTokenHash, expiresAt, req.ip || null]
                );

                return { user, accessToken: newAccessToken, refreshToken: newRefreshToken, sessionTimeoutMinutes, cookieMaxAgeMs };
            });

            // Set new refresh token cookie
            res.cookie('refresh_token', result.refreshToken, {
                httpOnly: true,
                secure: env().NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: result.cookieMaxAgeMs,
                path: '/api/v1/auth/refresh',
            });

            res.json({
                accessToken: result.accessToken,
                session_timeout_minutes: result.sessionTimeoutMinutes,
                user: {
                    id: result.user.id,
                    name: result.user.name,
                    email: result.user.email,
                    role: result.user.role,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
