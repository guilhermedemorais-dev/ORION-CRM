import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
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

const exportTicketsSchema = z.object({
    mode: z.enum(['all', 'selected']),
    ticketIds: z.array(z.string().uuid()).max(200).optional(),
    type: z.enum(['BUG', 'SUGGESTION', 'OTHER']).optional(),
}).superRefine((value, ctx) => {
    if (value.mode === 'selected' && (!value.ticketIds || value.ticketIds.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ticketIds'],
            message: 'Selecione ao menos um incidente para exportar.',
        });
    }
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

interface TicketExportRow extends SystemTicket {
    user_name: string;
    user_email: string | null;
}

interface ZipEntry {
    name: string;
    data: Buffer;
}

interface ExportAttachment {
    originalPath: string;
    zipPath: string | null;
    missingReason?: string;
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
    let c = index;
    for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return c >>> 0;
});

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { time: number; date: number } {
    const year = Math.max(1980, date.getFullYear());
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

function createZip(entries: ZipEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    const stamp = dosDateTime();

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const data = entry.data;
        const checksum = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(stamp.time, 10);
        local.writeUInt16LE(stamp.date, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);

        localParts.push(local, name, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(stamp.time, 12);
        central.writeUInt16LE(stamp.date, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);

        offset += local.length + name.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function normalizeAttachments(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function sanitizeFileName(value: string): string {
    return value.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'arquivo';
}

function toLocalUploadPath(publicPath: string): string | null {
    if (!publicPath.startsWith('/uploads/')) {
        return null;
    }
    const uploadRoot = path.resolve(env().UPLOAD_PATH);
    const relativePath = publicPath.replace(/^\/uploads\//, '');
    const resolved = path.resolve(uploadRoot, relativePath);
    if (resolved !== uploadRoot && !resolved.startsWith(`${uploadRoot}${path.sep}`)) {
        return null;
    }
    return resolved;
}

function formatDate(value: Date | string): string {
    return new Date(value).toISOString();
}

function buildMarkdown(tickets: TicketExportRow[], attachmentsByTicket: Map<string, ExportAttachment[]>): string {
    const lines: string[] = [
        '# Incidentes exportados do Suporte',
        '',
        `Exportado em: ${new Date().toISOString()}`,
        `Total de incidentes: ${tickets.length}`,
        '',
    ];

    for (const ticket of tickets) {
        const attachments = attachmentsByTicket.get(ticket.id) ?? [];
        lines.push(
            `## ${ticket.title}`,
            '',
            `- ID: ${ticket.id}`,
            `- Tipo: ${ticket.type}`,
            `- Status: ${ticket.status}`,
            `- Usuario: ${ticket.user_name}${ticket.user_email ? ` <${ticket.user_email}>` : ''}`,
            `- Criado em: ${formatDate(ticket.created_at)}`,
            `- Atualizado em: ${formatDate(ticket.updated_at)}`,
            '',
            '### Descricao',
            '',
            ticket.description,
            '',
            '### Anexos',
            '',
        );

        if (attachments.length === 0) {
            lines.push('- Nenhum anexo registrado.', '');
        } else {
            for (const attachment of attachments) {
                if (attachment.zipPath) {
                    lines.push(`- [${attachment.originalPath}](${attachment.zipPath})`);
                } else {
                    lines.push(`- ${attachment.originalPath} (NAO EXPORTADO: ${attachment.missingReason ?? 'arquivo indisponivel'})`);
                }
            }
            lines.push('');
        }
    }

    return `${lines.join('\n')}\n`;
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

// POST /api/v1/tickets/export - Export incidents with Markdown and attachments (ROOT/ADMIN only)
router.post(
    '/export',
    authenticate,
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = exportTicketsSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parametros de exportacao invalidos.',
                    parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                ));
                return;
            }

            const { mode, ticketIds, type } = parsed.data;
            let result;
            if (mode === 'all') {
                result = type
                    ? await query<TicketExportRow>(
                        `SELECT t.*, u.name AS user_name, u.email AS user_email
                         FROM system_tickets t
                         JOIN users u ON t.user_id = u.id
                         WHERE t.type = $1
                         ORDER BY t.created_at DESC`,
                        [type]
                    )
                    : await query<TicketExportRow>(
                        `SELECT t.*, u.name AS user_name, u.email AS user_email
                         FROM system_tickets t
                         JOIN users u ON t.user_id = u.id
                         ORDER BY t.created_at DESC`
                    );
            } else {
                result = type
                    ? await query<TicketExportRow>(
                        `SELECT t.*, u.name AS user_name, u.email AS user_email
                         FROM system_tickets t
                         JOIN users u ON t.user_id = u.id
                         WHERE t.id = ANY($1::uuid[]) AND t.type = $2
                         ORDER BY t.created_at DESC`,
                        [ticketIds, type]
                    )
                    : await query<TicketExportRow>(
                        `SELECT t.*, u.name AS user_name, u.email AS user_email
                         FROM system_tickets t
                         JOIN users u ON t.user_id = u.id
                         WHERE t.id = ANY($1::uuid[])
                         ORDER BY t.created_at DESC`,
                        [ticketIds]
                    );
            }

            if (result.rows.length === 0) {
                next(AppError.notFound('Nenhum incidente encontrado para exportacao.'));
                return;
            }

            const zipEntries: ZipEntry[] = [];
            const attachmentsByTicket = new Map<string, ExportAttachment[]>();

            for (const ticket of result.rows) {
                const ticketAttachments: ExportAttachment[] = [];
                const attachments = normalizeAttachments(ticket.attachments);

                for (let index = 0; index < attachments.length; index += 1) {
                    const publicPath = attachments[index]!;
                    const localPath = toLocalUploadPath(publicPath);
                    if (!localPath) {
                        ticketAttachments.push({
                            originalPath: publicPath,
                            zipPath: null,
                            missingReason: 'caminho fora de uploads',
                        });
                        continue;
                    }

                    try {
                        const data = await readFile(localPath);
                        const originalName = sanitizeFileName(path.basename(localPath));
                        const zipPath = `attachments/${ticket.id}-${index + 1}-${originalName}`;
                        zipEntries.push({ name: zipPath, data });
                        ticketAttachments.push({ originalPath: publicPath, zipPath });
                    } catch {
                        ticketAttachments.push({
                            originalPath: publicPath,
                            zipPath: null,
                            missingReason: 'arquivo nao encontrado',
                        });
                    }
                }

                attachmentsByTicket.set(ticket.id, ticketAttachments);
            }

            const markdown = buildMarkdown(result.rows, attachmentsByTicket);
            zipEntries.unshift({ name: 'incidents.md', data: Buffer.from(markdown, 'utf8') });

            await createAuditLog({
                userId: req.user!.id,
                action: 'EXPORT_TICKETS',
                entityType: 'system_tickets',
                entityId: null,
                oldValue: null,
                newValue: {
                    mode,
                    type: type ?? null,
                    ticket_count: result.rows.length,
                    ticket_ids: result.rows.map(ticket => ticket.id),
                },
                req,
            });

            const zip = createZip(zipEntries);
            const stamp = new Date().toISOString().slice(0, 10);
            const prefix = type === 'BUG' ? 'orion-bugs' : 'orion-incidentes';
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${stamp}.zip"`);
            res.send(zip);
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
