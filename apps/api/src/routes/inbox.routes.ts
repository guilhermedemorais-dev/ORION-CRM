import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import {
    appendOutboundMessage,
    assignConversationToCurrentUser,
    closeConversation,
    getConversationById,
    getConversationThread,
    handoffConversation,
    listConversations,
    type CurrentUser,
} from '../services/inbox.service.js';
import { sendTextMessage } from '../services/meta-whatsapp.service.js';

const router = Router();

const listConversationsSchema = z.object({
    status: z.enum(['BOT', 'AGUARDANDO_HUMANO', 'EM_ATENDIMENTO', 'ENCERRADA']).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    assigned_to: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const conversationParamsSchema = z.object({
    id: z.string().uuid(),
});

const sendMessageSchema = z.object({
    text: z.string().trim().min(1).max(4096),
});

const assignConversationSchema = z.object({
    assigned_to: z.string().uuid().optional(),
});

function getCurrentUser(req: Request): CurrentUser {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    return req.user;
}

function canSendMessageAsAttendant(
    currentUser: CurrentUser,
    conversation: Awaited<ReturnType<typeof getConversationById>>
): boolean {
    if (currentUser.role === 'ADMIN') {
        return true;
    }

    if (conversation.assigned_to?.id === currentUser.id) {
        return true;
    }

    return conversation.status === 'AGUARDANDO_HUMANO' && !conversation.assigned_to;
}

async function assignForReplyIfNeeded(
    req: Request,
    conversationId: string,
    conversation: Awaited<ReturnType<typeof getConversationById>>
): Promise<void> {
    const currentUser = getCurrentUser(req);

    if (currentUser.role === 'ADMIN') {
        return;
    }

    if (conversation.assigned_to?.id === currentUser.id) {
        return;
    }

    if (conversation.status === 'AGUARDANDO_HUMANO' && !conversation.assigned_to) {
        await assignConversationToCurrentUser(conversationId, currentUser);

        await createAuditLog({
            userId: currentUser.id,
            action: 'ASSIGN_CONVERSATION',
            entityType: 'conversations',
            entityId: conversationId,
            oldValue: {
                status: conversation.status,
                assigned_to: null,
            },
            newValue: {
                status: 'EM_ATENDIMENTO',
                assigned_to: currentUser.id,
            },
            req,
        });
    }
}

router.get(
    '/conversations',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 120, name: 'inbox-list' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = listConversationsSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest(
                    'Parâmetros inválidos.',
                    parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
                ));
                return;
            }

            const payload = await listConversations(parsed.data, getCurrentUser(req));
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/conversations/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = conversationParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                next(AppError.badRequest('Conversa inválida.'));
                return;
            }

            const payload = await getConversationThread(parsed.data.id, getCurrentUser(req));
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/conversations/:id/messages',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    rateLimit({ windowMs: 60 * 1000, max: 60, name: 'inbox-send' }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = conversationParamsSchema.safeParse(req.params);
            const body = sendMessageSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest(
                    'Verifique os dados da mensagem.',
                    [
                        ...(params.success ? [] : params.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))),
                        ...(body.success ? [] : body.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))),
                    ]
                ));
                return;
            }

            const currentUser = getCurrentUser(req);
            const conversation = await getConversationById(params.data.id, currentUser);

            if (!canSendMessageAsAttendant(currentUser, conversation)) {
                next(AppError.forbidden('Você não pode responder esta conversa no estado atual.'));
                return;
            }

            await assignForReplyIfNeeded(req, params.data.id, conversation);

            let outbound: { meta_message_id: string };

            try {
                outbound = await sendTextMessage({
                    to: conversation.whatsapp_number,
                    text: body.data.text,
                });
            } catch (error) {
                await appendOutboundMessage({
                    conversationId: params.data.id,
                    metaMessageId: null,
                    type: 'TEXT',
                    content: body.data.text,
                    sentBy: currentUser.id,
                    sentByName: currentUser.name,
                    status: 'FAILED',
                    isAutomated: false,
                });
                throw error;
            }

            const message = await appendOutboundMessage({
                conversationId: params.data.id,
                metaMessageId: outbound.meta_message_id,
                type: 'TEXT',
                content: body.data.text,
                sentBy: currentUser.id,
                sentByName: currentUser.name,
                status: 'SENT',
                isAutomated: false,
            });

            await createAuditLog({
                userId: currentUser.id,
                action: 'SEND_MESSAGE',
                entityType: 'messages',
                entityId: message.id,
                oldValue: null,
                newValue: {
                    conversation_id: params.data.id,
                    direction: 'OUTBOUND',
                    status: message.status,
                    type: 'TEXT',
                },
                req,
            });

            res.status(200).json({
                message: {
                    id: message.id,
                    meta_message_id: message.meta_message_id,
                    status: message.status,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/conversations/:id/assign',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = conversationParamsSchema.safeParse(req.params);
            const body = assignConversationSchema.safeParse(req.body ?? {});

            if (!params.success || !body.success) {
                next(AppError.badRequest('Não foi possível assumir esta conversa.'));
                return;
            }

            const currentUser = getCurrentUser(req);
            const before = await getConversationById(params.data.id, currentUser);
            const updated = await assignConversationToCurrentUser(
                params.data.id,
                currentUser,
                body.data.assigned_to
            );

            await createAuditLog({
                userId: currentUser.id,
                action: 'ASSIGN_CONVERSATION',
                entityType: 'conversations',
                entityId: params.data.id,
                oldValue: {
                    status: before.status,
                    assigned_to: before.assigned_to?.id ?? null,
                },
                newValue: {
                    status: updated.status,
                    assigned_to: updated.assigned_to?.id ?? null,
                },
                req,
            });

            res.json({
                conversation: updated,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/conversations/:id/handoff',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = conversationParamsSchema.safeParse(req.params);

            if (!params.success) {
                next(AppError.badRequest('Conversa inválida.'));
                return;
            }

            const currentUser = getCurrentUser(req);
            const before = await getConversationById(params.data.id, currentUser);
            const updated = await handoffConversation(params.data.id, currentUser);

            await createAuditLog({
                userId: currentUser.id,
                action: 'HANDOFF_CONVERSATION',
                entityType: 'conversations',
                entityId: params.data.id,
                oldValue: {
                    status: before.status,
                    assigned_to: before.assigned_to?.id ?? null,
                },
                newValue: {
                    status: updated.status,
                    assigned_to: updated.assigned_to?.id ?? null,
                },
                req,
            });

            res.json({
                conversation: updated,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/conversations/:id/close',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = conversationParamsSchema.safeParse(req.params);

            if (!params.success) {
                next(AppError.badRequest('Conversa inválida.'));
                return;
            }

            const currentUser = getCurrentUser(req);
            const before = await getConversationById(params.data.id, currentUser);
            const updated = await closeConversation(params.data.id, currentUser);

            await createAuditLog({
                userId: currentUser.id,
                action: 'CLOSE_CONVERSATION',
                entityType: 'conversations',
                entityId: params.data.id,
                oldValue: {
                    status: before.status,
                },
                newValue: {
                    status: updated.status,
                },
                req,
            });

            res.json({
                conversation: updated,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
