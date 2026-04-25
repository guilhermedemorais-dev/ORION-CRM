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
import type { SystemTicket } from '../types/entities.js';

const router = Router();

// ---- Schemas ----

const createTicketSchema = z.object({
    title: z.string().min(3).max(255),
    description: z.string().min(10),
    type: z.enum(['BUG', 'SUGGESTION', 'OTHER']),
});

const updateStatusSchema = z.object({
    status: z.enum(['OPEN', 'EVALUATING', 'RESOLVED', 'REJECTED']),
});

// ---- Upload Configuration ----

const ticketUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 5, // up to 5 attachments
    },
}).array('attachments', 5);

function runTicketUpload(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
        ticketUpload(req, res, (err) => {
            if (!err) {
                resolve();
                return;
            }
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Arquivo excede o limite de 10MB.'));
                    return;
                }
                reject(AppError.badRequest(`Upload inválido: ${err.message}`));
                return;
            }
            reject(err);
        });
    });
}

function getExtension(mimeType: string, originalName: string): string {
    if (mimeType.startsWith('image/jpeg')) return 'jpg';
    if (mimeType.startsWith('image/png')) return 'png';
    if (mimeType.startsWith('video/mp4')) return 'mp4';
    const ext = originalName.split('.').pop()?.toLowerCase();
    return ext || 'bin';
}

// ---- Routes ----

// GET /api/v1/tickets - List tickets
router.get(
    '/',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const role = req.user?.role;
            const userId = req.user?.id;

            let result;
            if (role === 'ROOT' || role === 'ADMIN') {
                // Admins see all tickets, ordered by newest
                result = await query<SystemTicket & { user_name: string }>(
                    `SELECT t.*, u.name as user_name 
                     FROM system_tickets t
                     JOIN users u ON t.user_id = u.id
                     ORDER BY t.created_at DESC`
                );
            } else {
                // Normal users see only their own
                result = await query<SystemTicket & { user_name: string }>(
                    `SELECT t.*, u.name as user_name 
                     FROM system_tickets t
                     JOIN users u ON t.user_id = u.id
                     WHERE t.user_id = $1
                     ORDER BY t.created_at DESC`,
                    [userId]
                );
            }

            res.json(result.rows);
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/v1/tickets - Create a new ticket
router.post(
    '/',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await runTicketUpload(req, res);

            const parsed = createTicketSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos informados.',
                    parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            const attachments: string[] = [];
            const files = req.files as Express.Multer.File[] | undefined;

            if (files && files.length > 0) {
                const ticketsDir = path.join(env().UPLOAD_PATH, 'tickets');
                await mkdir(ticketsDir, { recursive: true });

                for (const file of files) {
                    const ext = getExtension(file.mimetype, file.originalname);
                    // generate random filename
                    const randomName = Math.random().toString(36).substring(2, 15);
                    const filename = `ticket_${Date.now()}_${randomName}.${ext}`;
                    const filePath = path.join(ticketsDir, filename);
                    const publicPath = `/uploads/tickets/${filename}`;

                    await writeFile(filePath, file.buffer);
                    attachments.push(publicPath);
                }
            }

            const { title, description, type } = parsed.data;

            const result = await query<SystemTicket>(
                `INSERT INTO system_tickets (user_id, title, description, type, attachments)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [req.user!.id, title, description, type, JSON.stringify(attachments)]
            );

            res.status(201).json(result.rows[0]);
        } catch (err) {
            next(err);
        }
    }
);

// PUT /api/v1/tickets/:id/status - Update ticket status (ROOT/ADMIN only)
router.put(
    '/:id/status',
    authenticate,
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ticketId = req.params['id'];
            if (!ticketId) {
                next(AppError.badRequest('ID do chamado é obrigatório.'));
                return;
            }

            const parsed = updateStatusSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Status inválido.'));
                return;
            }

            const result = await query<SystemTicket>(
                `UPDATE system_tickets
                 SET status = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [parsed.data.status, ticketId]
            );

            if (result.rows.length === 0) {
                next(AppError.notFound('Chamado não encontrado.'));
                return;
            }

            res.json(result.rows[0]);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
