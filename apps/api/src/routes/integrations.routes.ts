import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
    buildIntegrationsSnapshot,
    getOrgId,
    integrationStatus,
    loadIntegration,
    saveIntegration,
} from '../services/integrations.service.js';

const router = Router();

const metaIntegrationSchema = z.object({
    access_token: z.string().min(10).optional(),
    phone_number_id: z.string().min(1).optional(),
    waba_id: z.string().optional().nullable(),
    verify_token: z.string().min(6).optional(),
});

const n8nIntegrationSchema = z.object({
    base_url: z.string().url().optional(),
    api_key: z.string().min(8).optional(),
    webhook_url: z.string().url().optional().nullable(),
});

const mercadopagoIntegrationSchema = z.object({
    access_token: z.string().min(10).optional(),
    public_key: z.string().min(8).optional().nullable(),
    sandbox_access_token: z.string().min(10).optional().nullable(),
    sandbox_mode: z.boolean().optional(),
});

router.get(
    '/',
    authenticate,
    requireRole(['ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orgId = await getOrgId();
            const snapshot = await buildIntegrationsSnapshot(orgId);
            res.json(snapshot);
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/meta',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = metaIntegrationSchema.parse(req.body);
            const orgId = await getOrgId();
            const current = await loadIntegration(orgId, 'meta');
            const merged = { ...current.credentials, ...parsed };
            const ready = Boolean(merged.access_token && merged.phone_number_id && merged.verify_token);
            await saveIntegration(orgId, 'meta', merged, integrationStatus(ready), null);
            res.json(await buildIntegrationsSnapshot(orgId));
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/n8n',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = n8nIntegrationSchema.parse(req.body);
            const orgId = await getOrgId();
            const current = await loadIntegration(orgId, 'n8n');
            const merged = { ...current.credentials, ...parsed };
            const ready = Boolean(merged.base_url && merged.api_key);
            await saveIntegration(orgId, 'n8n', merged, integrationStatus(ready), null);
            res.json(await buildIntegrationsSnapshot(orgId));
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/mercadopago',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = mercadopagoIntegrationSchema.parse(req.body);
            const orgId = await getOrgId();
            const current = await loadIntegration(orgId, 'mercadopago');
            const merged = { ...current.credentials, ...parsed };
            const ready = Boolean(merged.access_token);
            await saveIntegration(orgId, 'mercadopago', merged, integrationStatus(ready), null);
            res.json(await buildIntegrationsSnapshot(orgId));
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/n8n/test',
    authenticate,
    requireRole(['ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orgId = await getOrgId();
            const integration = await loadIntegration(orgId, 'n8n');
            const creds = integration.credentials as { base_url?: string; api_key?: string };

            if (!creds.base_url || !creds.api_key) {
                throw AppError.badRequest('Credenciais do n8n não configuradas.');
            }

            const baseUrl = creds.base_url.replace(/\/+$/, '');
            let status: 'connected' | 'error' = 'error';

            try {
                const response = await fetch(`${baseUrl}/healthz`, {
                    headers: {
                        'X-N8N-API-KEY': creds.api_key,
                    },
                });
                if (response.ok) {
                    status = 'connected';
                }
            } catch {
                status = 'error';
            }

            await saveIntegration(orgId, 'n8n', creds, status, new Date());
            res.json({ status });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/mp/test',
    authenticate,
    requireRole(['ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orgId = await getOrgId();
            const integration = await loadIntegration(orgId, 'mercadopago');
            const creds = integration.credentials as {
                access_token?: string;
                sandbox_access_token?: string;
                sandbox_mode?: boolean;
            };

            const token = creds.sandbox_mode && creds.sandbox_access_token
                ? creds.sandbox_access_token
                : creds.access_token;

            if (!token) {
                throw AppError.badRequest('Credenciais do Mercado Pago não configuradas.');
            }

            let status: 'connected' | 'error' = 'error';

            try {
                const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (response.ok) {
                    status = 'connected';
                }
            } catch {
                status = 'error';
            }

            await saveIntegration(orgId, 'mercadopago', creds, status, new Date());
            res.json({ status });
        } catch (err) {
            next(err);
        }
    }
);

export default router;

