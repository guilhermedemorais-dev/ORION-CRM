import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createAuditLog } from '../middleware/audit.js';
import { invalidateSettingsCache } from '../middleware/instanceStatus.js';
import {
    disconnectEvolutionInstance,
    fetchEvolutionQrCode,
    fetchEvolutionStatus,
} from '../services/evolution.service.js';
import integrationsRoutes from './integrations.routes.js';
import type { Settings } from '../types/entities.js';

const router = Router();

// ---- Schemas ----

const updateSettingsSchema = z.object({
    company_name: z.string().min(2).max(255).optional(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hex inválida').optional(),
    secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hex inválida').nullable().optional(),
    cnpj: z.string().max(18).nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
    address: z.record(z.string()).nullable().optional(),
    instagram: z.string().max(100).nullable().optional(),
    whatsapp_greeting: z.string().nullable().optional(),
    email_from_name: z.string().max(255).nullable().optional(),
});

const uploadBrandingSchema = z.object({
    type: z.enum(['logo', 'favicon']),
});

const updateNotificationsSchema = z.object({
    notify_new_lead_whatsapp: z.boolean().optional(),
    notify_order_paid: z.boolean().optional(),
    notify_production_delayed: z.boolean().optional(),
    notify_low_stock: z.boolean().optional(),
});

const brandingUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1,
    },
}).single('file');

function runBrandingUpload(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
        brandingUpload(req, res, (err) => {
            if (!err) {
                resolve();
                return;
            }

            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Arquivo excede o limite de 2MB.'));
                    return;
                }

                reject(AppError.badRequest('Upload inválido.'));
                return;
            }

            reject(err);
        });
    });
}

function detectBrandingFile(buffer: Buffer): { ext: 'png' | 'jpg' | 'svg'; mimeType: string } | null {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpgSignature = Buffer.from([0xff, 0xd8, 0xff]);

    if (buffer.length >= pngSignature.length && buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
        return { ext: 'png', mimeType: 'image/png' };
    }

    if (buffer.length >= jpgSignature.length && buffer.subarray(0, jpgSignature.length).equals(jpgSignature)) {
        return { ext: 'jpg', mimeType: 'image/jpeg' };
    }

    const asText = buffer.toString('utf8').trim();
    const isSvg = (asText.startsWith('<svg') || asText.startsWith('<?xml')) && asText.includes('<svg');

    if (isSvg) {
        return { ext: 'svg', mimeType: 'image/svg+xml' };
    }

    return null;
}

async function handleGetSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await query<Settings>(
            `SELECT company_name, logo_url, favicon_url, primary_color, secondary_color,
            cnpj, phone, address, instagram, whatsapp_greeting, email_from_name,
            notify_new_lead_whatsapp, notify_order_paid, notify_production_delayed, notify_low_stock,
            plan
     FROM settings LIMIT 1`
        );
        const settings = result.rows[0];

        if (!settings) {
            next(AppError.notFound());
            return;
        }

        res.json(settings);
    } catch (err) {
        next(err);
    }
}

async function handleUpdateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = updateSettingsSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest(
                'Verifique os campos informados.',
                parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
            ));
            return;
        }

        const data = parsed.data;
        const fields = Object.entries(data).filter(([, v]) => v !== undefined);

        if (fields.length === 0) {
            next(AppError.badRequest('Nenhum campo para atualizar.'));
            return;
        }

        const oldResult = await query<Settings>('SELECT * FROM settings LIMIT 1');
        const oldSettings = oldResult.rows[0];

        const setClauses = fields.map(([key], i) => `${key} = $${i + 1}`);
        setClauses.push(`updated_at = NOW()`);
        const values = fields.map(([, v]) => v === null ? null : typeof v === 'object' ? JSON.stringify(v) : v);

        await query(
            `UPDATE settings SET ${setClauses.join(', ')}`,
            values
        );

        await invalidateSettingsCache();

        if (req.user) {
            await createAuditLog({
                userId: req.user.id,
                action: 'UPDATE',
                entityType: 'settings',
                entityId: oldSettings?.id || null,
                oldValue: oldSettings ? (oldSettings as unknown as Record<string, unknown>) : null,
                newValue: data as Record<string, unknown>,
                req,
            });
        }

        const result = await query<Settings>(
            `SELECT company_name, logo_url, favicon_url, primary_color, secondary_color,
            cnpj, phone, address, instagram, whatsapp_greeting, email_from_name,
            notify_new_lead_whatsapp, notify_order_paid, notify_production_delayed, notify_low_stock,
            plan
     FROM settings LIMIT 1`
        );

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
}


// ---- GET /settings/public (PUBLIC — no auth) ----

router.get(
    '/public',
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await query<Settings>(
                `SELECT company_name, logo_url, primary_color, favicon_url,
                        pix_key, cnpj, phone, address,
                        receipt_thanks_message, receipt_exchange_policy, receipt_warranty
                 FROM settings LIMIT 1`
            );
            const settings = result.rows[0];

            if (!settings) {
                res.json({
                    company_name: 'Minha Joalheria',
                    logo_url: null,
                    primary_color: '#C8A97A',
                    favicon_url: null,
                    pix_key: null,
                    cnpj: null,
                    phone: null,
                    address: null,
                    receipt_thanks_message: 'Obrigado pela preferência ✦',
                    receipt_exchange_policy: 'Troca em até 30 dias com este recibo.',
                    receipt_warranty: 'Garantia de 1 ano contra defeito de fabricação.',
                });
                return;
            }

            res.json({
                company_name: settings.company_name,
                logo_url: settings.logo_url,
                primary_color: settings.primary_color,
                favicon_url: settings.favicon_url,
                pix_key: settings.pix_key,
                cnpj: settings.cnpj,
                phone: settings.phone,
                address: settings.address,
                receipt_thanks_message: settings.receipt_thanks_message,
                receipt_exchange_policy: settings.receipt_exchange_policy,
                receipt_warranty: settings.receipt_warranty,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ---- GET /settings (ADMIN only) ----

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    handleGetSettings
);

router.get(
    '/settings',
    authenticate,
    requireRole(['ADMIN']),
    handleGetSettings
);

router.use('/integrations', integrationsRoutes);

// ---- PUT /settings (ADMIN only) ----

router.put(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 10, name: 'settings-update' }),
    handleUpdateSettings
);

router.put(
    '/settings',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 10, name: 'settings-update' }),
    handleUpdateSettings
);

// ---- POST /settings/logo (ADMIN only) ----

router.post(
    '/logo',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 10, name: 'settings-upload' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await runBrandingUpload(req, res);

            const parsed = uploadBrandingSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            if (!req.file?.buffer) {
                next(AppError.badRequest('Arquivo obrigatório.'));
                return;
            }

            const fileInfo = detectBrandingFile(req.file.buffer);
            if (!fileInfo) {
                next(AppError.badRequest('Formato inválido. Envie PNG, JPG ou SVG válido.'));
                return;
            }

            const settingsResult = await query<Settings>('SELECT * FROM settings LIMIT 1');
            const settings = settingsResult.rows[0];

            if (!settings) {
                next(AppError.notFound('Configuração da instância não encontrada.'));
                return;
            }

            const brandingDir = path.join(env().UPLOAD_PATH, 'branding');
            const filename = `${parsed.data.type}.${fileInfo.ext}`;
            const filePath = path.join(brandingDir, filename);
            const publicPath = `/uploads/branding/${filename}`;
            const column = parsed.data.type === 'logo' ? 'logo_url' : 'favicon_url';

            await mkdir(brandingDir, { recursive: true });
            await writeFile(filePath, req.file.buffer);

            await query(
                `UPDATE settings SET ${column} = $1, updated_at = NOW()`,
                [publicPath]
            );

            await invalidateSettingsCache();

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPLOAD',
                    entityType: 'settings',
                    entityId: settings.id,
                    oldValue: {
                        [column]: parsed.data.type === 'logo' ? settings.logo_url : settings.favicon_url,
                    },
                    newValue: {
                        [column]: publicPath,
                        mime_type: fileInfo.mimeType,
                    },
                    req,
                });
            }

            res.json({
                type: parsed.data.type,
                url: publicPath,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ---- PATCH /settings/notifications (ADMIN only) ----

router.patch(
    '/notifications',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 20, name: 'settings-notifications-update' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = updateNotificationsSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
            if (fields.length === 0) {
                next(AppError.badRequest('Nenhum campo de notificação para atualizar.'));
                return;
            }

            const oldResult = await query<Settings>('SELECT * FROM settings LIMIT 1');
            const oldSettings = oldResult.rows[0];

            const values = fields.map(([, value]) => value);
            const setClauses = fields.map(([key], index) => `${key} = $${index + 1}`);
            setClauses.push('updated_at = NOW()');

            const updatedResult = await query<Settings>(
                `UPDATE settings
                 SET ${setClauses.join(', ')}
                 RETURNING
                    notify_new_lead_whatsapp,
                    notify_order_paid,
                    notify_production_delayed,
                    notify_low_stock`,
                values
            );

            await invalidateSettingsCache();

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE_NOTIFICATIONS',
                    entityType: 'settings',
                    entityId: oldSettings?.id || null,
                    oldValue: oldSettings
                        ? {
                            notify_new_lead_whatsapp: oldSettings.notify_new_lead_whatsapp,
                            notify_order_paid: oldSettings.notify_order_paid,
                            notify_production_delayed: oldSettings.notify_production_delayed,
                            notify_low_stock: oldSettings.notify_low_stock,
                        }
                        : null,
                    newValue: updatedResult.rows[0] as unknown as Record<string, unknown>,
                    req,
                });
            }

            res.json(updatedResult.rows[0]);
        } catch (err) {
            next(err);
        }
    }
);

// ---- WhatsApp / Evolution status (ADMIN only) ----

router.get(
    '/whatsapp/status',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'settings-whatsapp-status' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const payload = await fetchEvolutionStatus();
            res.json(payload);
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/whatsapp/qrcode',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 30, name: 'settings-whatsapp-qrcode' }),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const payload = await fetchEvolutionQrCode();
            res.json(payload);
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/whatsapp/disconnect',
    authenticate,
    requireRole(['ADMIN']),
    rateLimit({ windowMs: 60 * 1000, max: 15, name: 'settings-whatsapp-disconnect' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await disconnectEvolutionInstance();

            if (req.user) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DISCONNECT_WHATSAPP',
                    entityType: 'settings',
                    entityId: null,
                    oldValue: null,
                    newValue: { provider: 'evolution' },
                    req,
                });
            }

            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
