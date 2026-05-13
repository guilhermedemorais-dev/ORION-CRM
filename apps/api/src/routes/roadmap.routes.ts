import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import multer from 'multer';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

const ALLOWED_MIME = new Set([
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf',
]);

const STATUS_VALUES = [
    'PLANEJADO',
    'AGUARDANDO_APROVACAO',
    'APROVADO',
    'EM_ANDAMENTO',
    'PARADO',
    'CONCLUIDO',
    'REPROVADO',
] as const;

const createItemSchema = z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(10000),
    technical_details: z.string().trim().max(50000).optional().nullable(),
    status: z.enum(STATUS_VALUES).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    created_by_ai: z.coerce.boolean().optional(),
});

const updateItemSchema = createItemSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'Informe ao menos um campo para atualizar.'
);

const createCommentSchema = z.object({
    body: z.string().trim().min(1).max(5000),
    parent_comment_id: z.string().uuid().optional().nullable(),
});

const reactionSchema = z.object({
    agree: z.boolean(),
});

router.use(authenticate);

// ─── ITEMS ───────────────────────────────────────────────────────────────────

// GET /api/v1/roadmap/items — lista todos os items
router.get('/items', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query(
            `SELECT r.id, r.title, r.description, r.technical_details, r.status,
                    r.due_date, r.approval_state, r.approval_at, r.approval_by,
                    r.created_by, r.created_by_ai, r.created_at, r.updated_at,
                    creator.name AS created_by_name,
                    approver.name AS approval_by_name,
                    (SELECT COUNT(*)::int FROM roadmap_comments WHERE item_id = r.id) AS comments_count,
                    (SELECT COUNT(*)::int FROM roadmap_attachments WHERE item_id = r.id) AS attachments_count
             FROM roadmap_items r
             LEFT JOIN users creator ON creator.id = r.created_by
             LEFT JOIN users approver ON approver.id = r.approval_by
             ORDER BY r.created_at DESC`
        );
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

// GET /api/v1/roadmap/items/:id — detalhe + comentários + anexos
router.get('/items/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params as { id: string };
        const itemResult = await query(
            `SELECT r.id, r.title, r.description, r.technical_details, r.status,
                    r.due_date, r.approval_state, r.approval_at, r.approval_by,
                    r.created_by, r.created_by_ai, r.created_at, r.updated_at,
                    creator.name AS created_by_name,
                    approver.name AS approval_by_name
             FROM roadmap_items r
             LEFT JOIN users creator ON creator.id = r.created_by
             LEFT JOIN users approver ON approver.id = r.approval_by
             WHERE r.id = $1
             LIMIT 1`,
            [id]
        );
        const item = itemResult.rows[0];
        if (!item) { next(AppError.notFound('Item de roadmap não encontrado.')); return; }

        const commentsResult = await query(
            `SELECT c.id, c.item_id, c.parent_comment_id, c.body, c.author_id,
                    c.created_at,
                    u.name AS author_name, u.role AS author_role
             FROM roadmap_comments c
             INNER JOIN users u ON u.id = c.author_id
             WHERE c.item_id = $1
             ORDER BY c.created_at ASC`,
            [id]
        );

        const reactionsResult = await query(
            `SELECT cr.comment_id, cr.user_id, cr.agree, u.name AS user_name
             FROM roadmap_comment_reactions cr
             INNER JOIN users u ON u.id = cr.user_id
             WHERE cr.comment_id IN (
                SELECT id FROM roadmap_comments WHERE item_id = $1
             )`,
            [id]
        );

        const attachmentsResult = await query(
            `SELECT a.id, a.item_id, a.comment_id, a.file_url, a.file_name,
                    a.file_type, a.file_size, a.uploaded_by, a.created_at,
                    u.name AS uploaded_by_name
             FROM roadmap_attachments a
             INNER JOIN users u ON u.id = a.uploaded_by
             WHERE a.item_id = $1
                OR a.comment_id IN (SELECT id FROM roadmap_comments WHERE item_id = $1)`,
            [id]
        );

        res.json({
            data: {
                ...item,
                comments: commentsResult.rows,
                reactions: reactionsResult.rows,
                attachments: attachmentsResult.rows,
            },
        });
    } catch (err) { next(err); }
});

// POST /api/v1/roadmap/items — só ROOT cria
router.post(
    '/items',
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createItemSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os dados do item.',
                    parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            const result = await query<{ id: string }>(
                `INSERT INTO roadmap_items
                    (title, description, technical_details, status, due_date,
                     created_by, created_by_ai)
                 VALUES ($1, $2, $3, COALESCE($4, 'PLANEJADO'), $5, $6, COALESCE($7, false))
                 RETURNING id`,
                [
                    parsed.data.title.trim(),
                    parsed.data.description.trim(),
                    parsed.data.technical_details ?? null,
                    parsed.data.status,
                    parsed.data.due_date ?? null,
                    req.user?.id ?? null,
                    parsed.data.created_by_ai ?? false,
                ]
            );

            const id = result.rows[0]!.id;

            await createAuditLog({
                userId: req.user!.id,
                action: 'CREATE',
                entityType: 'roadmap_items',
                entityId: id,
                oldValue: null,
                newValue: { title: parsed.data.title },
                req,
            });

            res.status(201).json({ data: { id } });
        } catch (err) { next(err); }
    }
);

// PATCH /api/v1/roadmap/items/:id — só ROOT edita
router.patch(
    '/items/:id',
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = updateItemSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Verifique os campos.',
                    parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            const updates: string[] = [];
            const values: unknown[] = [id];
            const addField = (key: string, value: unknown) => {
                values.push(value);
                updates.push(`${key} = $${values.length}`);
            };

            if (parsed.data.title !== undefined) addField('title', parsed.data.title.trim());
            if (parsed.data.description !== undefined) addField('description', parsed.data.description.trim());
            if (parsed.data.technical_details !== undefined) addField('technical_details', parsed.data.technical_details);
            if (parsed.data.status !== undefined) addField('status', parsed.data.status);
            if (parsed.data.due_date !== undefined) addField('due_date', parsed.data.due_date);
            if (parsed.data.created_by_ai !== undefined) addField('created_by_ai', parsed.data.created_by_ai);
            updates.push('updated_at = NOW()');

            const result = await query<{ id: string }>(
                `UPDATE roadmap_items SET ${updates.join(', ')} WHERE id = $1 RETURNING id`,
                values
            );
            if (!result.rows[0]) { next(AppError.notFound('Item não encontrado.')); return; }

            await createAuditLog({
                userId: req.user!.id,
                action: 'UPDATE',
                entityType: 'roadmap_items',
                entityId: id,
                oldValue: null,
                newValue: { ...parsed.data },
                req,
            });

            res.json({ data: { id } });
        } catch (err) { next(err); }
    }
);

// DELETE /api/v1/roadmap/items/:id — só ROOT remove
router.delete(
    '/items/:id',
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{ id: string }>(
                `DELETE FROM roadmap_items WHERE id = $1 RETURNING id`,
                [id]
            );
            if (!result.rows[0]) { next(AppError.notFound('Item não encontrado.')); return; }
            await createAuditLog({
                userId: req.user!.id,
                action: 'DELETE',
                entityType: 'roadmap_items',
                entityId: id,
                oldValue: { id },
                newValue: null,
                req,
            });
            res.status(204).send();
        } catch (err) { next(err); }
    }
);

// POST /api/v1/roadmap/items/:id/approve — ADMIN ou ROOT aprova/reprova
const approveSchema = z.object({
    approve: z.boolean(),
});

router.post(
    '/items/:id/approve',
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = approveSchema.safeParse(req.body);
            if (!parsed.success) { next(AppError.badRequest('Informe approve: true|false.')); return; }

            const newState = parsed.data.approve ? 'APPROVED' : 'REPROVED';
            const newStatus = parsed.data.approve ? 'APROVADO' : 'REPROVADO';

            const result = await query<{ id: string }>(
                `UPDATE roadmap_items
                 SET approval_state = $2,
                     approval_at = NOW(),
                     approval_by = $3,
                     status = $4,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING id`,
                [id, newState, req.user!.id, newStatus]
            );
            if (!result.rows[0]) { next(AppError.notFound('Item não encontrado.')); return; }

            await createAuditLog({
                userId: req.user!.id,
                action: 'UPDATE',
                entityType: 'roadmap_items',
                entityId: id,
                oldValue: null,
                newValue: { approval_state: newState, status: newStatus },
                req,
            });

            res.json({ data: { id, approval_state: newState, status: newStatus } });
        } catch (err) { next(err); }
    }
);

// ─── COMMENTS ────────────────────────────────────────────────────────────────

// POST /api/v1/roadmap/items/:id/comments — qualquer autenticado pode comentar
router.post(
    '/items/:id/comments',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const parsed = createCommentSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Comentário inválido.', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const itemExists = await query<{ id: string }>(
                `SELECT id FROM roadmap_items WHERE id = $1 LIMIT 1`,
                [id]
            );
            if (!itemExists.rows[0]) { next(AppError.notFound('Item não encontrado.')); return; }

            if (parsed.data.parent_comment_id) {
                const parent = await query<{ id: string }>(
                    `SELECT id FROM roadmap_comments WHERE id = $1 AND item_id = $2 LIMIT 1`,
                    [parsed.data.parent_comment_id, id]
                );
                if (!parent.rows[0]) { next(AppError.badRequest('Comentário pai inválido.')); return; }
            }

            const result = await query<{ id: string }>(
                `INSERT INTO roadmap_comments (item_id, parent_comment_id, body, author_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [id, parsed.data.parent_comment_id ?? null, parsed.data.body.trim(), req.user!.id]
            );

            res.status(201).json({ data: { id: result.rows[0]!.id } });
        } catch (err) { next(err); }
    }
);

// DELETE /api/v1/roadmap/items/:id/comments/:commentId — autor OU ROOT
router.delete(
    '/items/:id/comments/:commentId',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, commentId } = req.params as { id: string; commentId: string };

            const commentResult = await query<{ author_id: string }>(
                `SELECT author_id FROM roadmap_comments WHERE id = $1 AND item_id = $2 LIMIT 1`,
                [commentId, id]
            );
            const comment = commentResult.rows[0];
            if (!comment) { next(AppError.notFound('Comentário não encontrado.')); return; }

            const isAuthor = comment.author_id === req.user?.id;
            const isRoot = req.user?.role === 'ROOT';
            if (!isAuthor && !isRoot) { next(AppError.forbidden('Apenas o autor ou ROOT pode remover este comentário.')); return; }

            await query(`DELETE FROM roadmap_comments WHERE id = $1`, [commentId]);

            await createAuditLog({
                userId: req.user!.id,
                action: 'DELETE',
                entityType: 'roadmap_comments',
                entityId: commentId,
                oldValue: { id: commentId },
                newValue: null,
                req,
            });

            res.status(204).send();
        } catch (err) { next(err); }
    }
);

// POST /api/v1/roadmap/comments/:commentId/reaction — só ROOT reage (acatar/não)
router.post(
    '/comments/:commentId/reaction',
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { commentId } = req.params as { commentId: string };
            const parsed = reactionSchema.safeParse(req.body);
            if (!parsed.success) { next(AppError.badRequest('Informe agree: true|false.')); return; }

            await query(
                `INSERT INTO roadmap_comment_reactions (comment_id, user_id, agree)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (comment_id, user_id) DO UPDATE
                    SET agree = EXCLUDED.agree,
                        created_at = NOW()`,
                [commentId, req.user!.id, parsed.data.agree]
            );

            res.status(200).json({ data: { agree: parsed.data.agree } });
        } catch (err) { next(err); }
    }
);

// DELETE /api/v1/roadmap/comments/:commentId/reaction — remove reação
router.delete(
    '/comments/:commentId/reaction',
    requireRole(['ROOT']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { commentId } = req.params as { commentId: string };
            await query(
                `DELETE FROM roadmap_comment_reactions WHERE comment_id = $1 AND user_id = $2`,
                [commentId, req.user!.id]
            );
            res.status(204).send();
        } catch (err) { next(err); }
    }
);

// ─── ATTACHMENTS ─────────────────────────────────────────────────────────────

// POST /api/v1/roadmap/items/:id/attachments — anexa arquivo ao item
router.post(
    '/items/:id/attachments',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const file = req.file;
            if (!file) { next(AppError.badRequest('Arquivo obrigatório.')); return; }
            if (!ALLOWED_MIME.has(file.mimetype)) { next(AppError.badRequest('Tipo de arquivo não suportado.')); return; }

            const itemExists = await query<{ id: string }>(
                `SELECT id FROM roadmap_items WHERE id = $1 LIMIT 1`,
                [id]
            );
            if (!itemExists.rows[0]) { next(AppError.notFound('Item não encontrado.')); return; }

            const ext = file.originalname.split('.').pop() ?? 'bin';
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const uploadDir = join(process.cwd(), 'uploads', 'roadmap');
            mkdirSync(uploadDir, { recursive: true });
            writeFileSync(join(uploadDir, safeName), file.buffer);
            const fileUrl = `/uploads/roadmap/${safeName}`;

            const result = await query<{ id: string }>(
                `INSERT INTO roadmap_attachments
                    (item_id, comment_id, file_url, file_name, file_type, file_size, uploaded_by)
                 VALUES ($1, NULL, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [id, fileUrl, file.originalname, file.mimetype, file.size, req.user!.id]
            );

            res.status(201).json({
                data: { id: result.rows[0]!.id, file_url: fileUrl, file_name: file.originalname },
            });
        } catch (err) { next(err); }
    }
);

// POST /api/v1/roadmap/comments/:commentId/attachments — anexa ao comentário
router.post(
    '/comments/:commentId/attachments',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { commentId } = req.params as { commentId: string };
            const file = req.file;
            if (!file) { next(AppError.badRequest('Arquivo obrigatório.')); return; }
            if (!ALLOWED_MIME.has(file.mimetype)) { next(AppError.badRequest('Tipo de arquivo não suportado.')); return; }

            const commentExists = await query<{ id: string }>(
                `SELECT id FROM roadmap_comments WHERE id = $1 LIMIT 1`,
                [commentId]
            );
            if (!commentExists.rows[0]) { next(AppError.notFound('Comentário não encontrado.')); return; }

            const ext = file.originalname.split('.').pop() ?? 'bin';
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const uploadDir = join(process.cwd(), 'uploads', 'roadmap');
            mkdirSync(uploadDir, { recursive: true });
            writeFileSync(join(uploadDir, safeName), file.buffer);
            const fileUrl = `/uploads/roadmap/${safeName}`;

            const result = await query<{ id: string }>(
                `INSERT INTO roadmap_attachments
                    (item_id, comment_id, file_url, file_name, file_type, file_size, uploaded_by)
                 VALUES (NULL, $1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [commentId, fileUrl, file.originalname, file.mimetype, file.size, req.user!.id]
            );

            res.status(201).json({
                data: { id: result.rows[0]!.id, file_url: fileUrl, file_name: file.originalname },
            });
        } catch (err) { next(err); }
    }
);

// GET /api/v1/roadmap/notifications/unread-count — badge no menu
router.get('/notifications/unread-count', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Conta itens "AGUARDANDO_APROVACAO" + comentários não lidos da última semana.
        // Simplificação inicial: só conta items aguardando aprovação. Notificações
        // por comentário serão sub-feature.
        const result = await query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM roadmap_items
             WHERE status = 'AGUARDANDO_APROVACAO'`
        );
        res.json({ data: { unread_count: Number(result.rows[0]?.count ?? '0') } });
    } catch (err) { next(err); }
});

export default router;
