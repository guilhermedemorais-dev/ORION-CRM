import crypto from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import type { UserRole } from '../types/entities.js';

const router = Router();

const listUsersSchema = z.object({
    q: z.string().trim().min(1).max(120).optional(),
});

const inviteUserSchema = z.object({
    name: z.string().trim().min(2).max(255),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    role: z.enum(['ADMIN', 'ATENDENTE']),
    personal_whatsapp: z.string().trim().min(8).max(25).nullable().optional(),
    commission_rate: z.coerce.number().min(0).max(100).default(0),
});

const updateUserSchema = z.object({
    name: z.string().trim().min(2).max(255).optional(),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()).optional(),
    role: z.enum(['ADMIN', 'ATENDENTE']).optional(),
    personal_whatsapp: z.string().trim().min(8).max(25).nullable().optional(),
    commission_rate: z.coerce.number().min(0).max(100).optional(),
});

const toggleStatusSchema = z.object({
    active: z.boolean().optional(),
});

interface UserListRow {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: 'active' | 'inactive';
    commission_rate: number;
    personal_whatsapp: string | null;
    created_at: Date;
    updated_at: Date;
    last_login_at: Date | null;
}

function mapUser(row: UserListRow) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        commission_rate: Number(row.commission_rate),
        personal_whatsapp: row.personal_whatsapp,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_login_at: row.last_login_at,
    };
}

function generateTemporaryPassword(): string {
    return crypto.randomBytes(9).toString('base64url');
}

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listUsersSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const values: unknown[] = [];
            let whereClause = '';

            if (parsed.data.q) {
                values.push(`%${parsed.data.q}%`);
                const index = values.length;
                whereClause = `WHERE (u.name ILIKE $${index} OR u.email ILIKE $${index})`;
            }

            const result = await query<UserListRow>(
                `SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role,
                    u.status,
                    u.commission_rate,
                    u.personal_whatsapp,
                    u.created_at,
                    u.updated_at,
                    u.last_login_at
                 FROM users u
                 ${whereClause}
                 ORDER BY u.created_at DESC`,
                values
            );

            res.json({
                data: result.rows.map(mapUser),
                meta: {
                    total: result.rowCount ?? 0,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/invite',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'users-invite' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = inviteUserSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const existing = await query<{ id: string }>(
                'SELECT id FROM users WHERE email = $1 LIMIT 1',
                [parsed.data.email]
            );

            if (existing.rows[0]) {
                next(AppError.conflict('USER_EMAIL_EXISTS', 'Já existe um usuário com este e-mail.'));
                return;
            }

            const temporaryPassword = generateTemporaryPassword();
            const passwordHash = await bcrypt.hash(temporaryPassword, 10);

            const insertResult = await query<UserListRow>(
                `INSERT INTO users (name, email, password_hash, role, status, commission_rate, personal_whatsapp)
                 VALUES ($1, $2, $3, $4, 'active', $5, $6)
                 RETURNING
                    id,
                    name,
                    email,
                    role,
                    status,
                    commission_rate,
                    personal_whatsapp,
                    created_at,
                    updated_at,
                    last_login_at`,
                [
                    parsed.data.name,
                    parsed.data.email,
                    passwordHash,
                    parsed.data.role,
                    parsed.data.commission_rate,
                    parsed.data.personal_whatsapp ?? null,
                ]
            );

            const createdUser = insertResult.rows[0];
            if (!createdUser) {
                throw new Error('Failed to create user.');
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    entityType: 'users',
                    entityId: createdUser.id,
                    oldValue: null,
                    newValue: mapUser(createdUser),
                    req,
                });
            }

            res.status(201).json({
                user: mapUser(createdUser),
                temporary_password: temporaryPassword,
            });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 40, name: 'users-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.params['id'];
            if (!userId) {
                next(AppError.badRequest('ID do usuário é obrigatório.'));
                return;
            }

            const parsed = updateUserSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const payload = parsed.data;
            const fields = Object.entries(payload).filter(([, value]) => value !== undefined);
            if (fields.length === 0) {
                next(AppError.badRequest('Nenhum campo para atualizar.'));
                return;
            }

            const beforeResult = await query<UserListRow>(
                `SELECT
                    id,
                    name,
                    email,
                    role,
                    status,
                    commission_rate,
                    personal_whatsapp,
                    created_at,
                    updated_at,
                    last_login_at
                 FROM users
                 WHERE id = $1
                 LIMIT 1`,
                [userId]
            );

            const currentUser = beforeResult.rows[0];
            if (!currentUser) {
                next(AppError.notFound('Usuário não encontrado.'));
                return;
            }

            if (payload.email && payload.email !== currentUser.email) {
                const existing = await query<{ id: string }>(
                    'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
                    [payload.email, userId]
                );

                if (existing.rows[0]) {
                    next(AppError.conflict('USER_EMAIL_EXISTS', 'Já existe um usuário com este e-mail.'));
                    return;
                }
            }

            const values: unknown[] = [];
            const setClauses = fields.map(([key, value], index) => {
                values.push(value === undefined ? null : value);
                return `${key} = $${index + 1}`;
            });
            setClauses.push('updated_at = NOW()');
            values.push(userId);

            const updateResult = await query<UserListRow>(
                `UPDATE users
                 SET ${setClauses.join(', ')}
                 WHERE id = $${values.length}
                 RETURNING
                    id,
                    name,
                    email,
                    role,
                    status,
                    commission_rate,
                    personal_whatsapp,
                    created_at,
                    updated_at,
                    last_login_at`,
                values
            );

            const updatedUser = updateResult.rows[0];
            if (!updatedUser) {
                throw new Error('Failed to update user.');
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    entityType: 'users',
                    entityId: updatedUser.id,
                    oldValue: mapUser(currentUser),
                    newValue: mapUser(updatedUser),
                    req,
                });
            }

            res.json(mapUser(updatedUser));
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/:id/toggle-status',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 40, name: 'users-toggle-status' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.params['id'];
            if (!userId) {
                next(AppError.badRequest('ID do usuário é obrigatório.'));
                return;
            }

            const parsed = toggleStatusSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const userResult = await query<UserListRow>(
                `SELECT
                    id,
                    name,
                    email,
                    role,
                    status,
                    commission_rate,
                    personal_whatsapp,
                    created_at,
                    updated_at,
                    last_login_at
                 FROM users
                 WHERE id = $1
                 LIMIT 1`,
                [userId]
            );

            const targetUser = userResult.rows[0];
            if (!targetUser) {
                next(AppError.notFound('Usuário não encontrado.'));
                return;
            }

            const nextStatus = parsed.data.active === undefined
                ? (targetUser.status === 'active' ? 'inactive' : 'active')
                : (parsed.data.active ? 'active' : 'inactive');

            if (req.user?.id === targetUser.id && nextStatus === 'inactive') {
                next(AppError.forbidden('Você não pode desativar o próprio usuário.'));
                return;
            }

            const updateResult = await query<UserListRow>(
                `UPDATE users
                 SET status = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING
                    id,
                    name,
                    email,
                    role,
                    status,
                    commission_rate,
                    personal_whatsapp,
                    created_at,
                    updated_at,
                    last_login_at`,
                [nextStatus, targetUser.id]
            );

            const updatedUser = updateResult.rows[0];
            if (!updatedUser) {
                throw new Error('Failed to update user status.');
            }

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_STATUS',
                    entityType: 'users',
                    entityId: updatedUser.id,
                    oldValue: { status: targetUser.status },
                    newValue: { status: updatedUser.status },
                    req,
                });
            }

            res.json(mapUser(updatedUser));
        } catch (err) {
            next(err);
        }
    }
);

export default router;
