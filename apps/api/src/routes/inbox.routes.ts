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
    buildIdentificationMessage,
    closeConversation,
    createQuickReply,
    deleteQuickReply,
    getConversationById,
    getConversationNote,
    getQuickReplyById,
    getConversationThread,
    handoffConversation,
    listChannelIntegrations,
    listConversations,
    listQuickReplies,
    markConversationRead,
    saveConversationNote,
    updateChannelIntegration,
    updateQuickReply,
    type CurrentUser,
} from '../services/inbox.service.js';
import { subscribeInboxEvents } from '../services/inbox-events.service.js';
import { sendTextMessage } from '../services/meta-whatsapp.service.js';

const router = Router();

const listConversationsSchema = z.object({
    status: z.enum(['BOT', 'AGUARDANDO_HUMANO', 'EM_ATENDIMENTO', 'ENCERRADA']).optional(),
    channel: z.enum(['whatsapp', 'instagram', 'telegram', 'tiktok', 'messenger']).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    assigned_to: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const conversationParamsSchema = z.object({
    id: z.string().uuid(),
});

const sendMessageSchema = z.object({
    text: z.string().trim().min(1).max(4096).optional(),
    kind: z.enum(['TEXT', 'IDENTIFICATION']).default('TEXT'),
    quick_reply_id: z.string().uuid().optional(),
});

const assignConversationSchema = z.object({
    assigned_to: z.string().uuid().optional(),
});

const quickReplyListSchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
});

const quickReplyPayloadSchema = z.object({
    title: z.string().trim().min(2).max(100),
    body: z.string().trim().min(1).max(2000),
    category: z.string().trim().min(2).max(50).optional(),
});

const quickReplyParamsSchema = z.object({
    id: z.string().uuid(),
});

const channelParamsSchema = z.object({
    channel: z.enum(['whatsapp', 'instagram', 'telegram', 'tiktok', 'messenger']),
});

const channelPayloadSchema = z.object({
    is_active: z.boolean(),
    webhook_url: z.string().trim().url().optional().or(z.literal('')),
});

const saveNoteSchema = z.object({
    note: z.string().max(4000),
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

async function resolveOutboundText(
    currentUser: CurrentUser,
    body: z.infer<typeof sendMessageSchema>
): Promise<{
    text: string;
    kind: 'TEXT' | 'IDENTIFICATION';
    quickReplyId: string | null;
}> {
    if (body.kind === 'IDENTIFICATION') {
        return {
            text: await buildIdentificationMessage(currentUser),
            kind: 'IDENTIFICATION',
            quickReplyId: null,
        };
    }

    const providedText = body.text?.trim();

    if (body.quick_reply_id) {
        const quickReply = await getQuickReplyById(body.quick_reply_id);
        if (!quickReply) {
            throw AppError.notFound('Mensagem pronta não encontrada.');
        }

        return {
            text: providedText && providedText.length > 0 ? providedText : quickReply.body,
            kind: 'TEXT',
            quickReplyId: quickReply.id,
        };
    }

    if (!providedText) {
        throw AppError.badRequest('Verifique os dados da mensagem.');
    }

    return {
        text: providedText,
        kind: 'TEXT',
        quickReplyId: null,
    };
}

router.get(
    '/stream',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response): Promise<void> => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        res.write(`event: ready\n`);
        res.write(`data: ${JSON.stringify({ ok: true, at: new Date().toISOString() })}\n\n`);

        const heartbeat = setInterval(() => {
            res.write(`: ping ${Date.now()}\n\n`);
        }, 15000);

        const unsubscribe = subscribeInboxEvents((event) => {
            res.write(`event: ${event.type}\n`);
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        });

        req.on('close', () => {
            clearInterval(heartbeat);
            unsubscribe();
            res.end();
        });
    }
);

router.get(
    '/channels',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const integrations = await listChannelIntegrations();
            res.json({
                data: integrations,
                meta: {
                    total: integrations.length,
                    page: 1,
                    limit: integrations.length,
                    pages: 1,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/channels/:channel',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = channelParamsSchema.safeParse(req.params);
            const body = channelPayloadSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest('Integração de canal inválida.'));
                return;
            }

            const updated = await updateChannelIntegration({
                channel: params.data.channel,
                isActive: body.data.is_active,
                webhookUrl: body.data.webhook_url || null,
            });

            await createAuditLog({
                userId: getCurrentUser(req).id,
                action: 'UPDATE_CHANNEL_INTEGRATION',
                entityType: 'channel_integrations',
                entityId: updated.id,
                oldValue: null,
                newValue: {
                    channel: updated.channel,
                    is_active: updated.is_active,
                    webhook_url: updated.webhook_url,
                },
                req,
            });

            res.json({
                integration: updated,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/quick-replies',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = quickReplyListSchema.safeParse(req.query);
            if (!parsed.success) {
                next(AppError.badRequest('Filtros inválidos para mensagens prontas.'));
                return;
            }

            const quickReplies = await listQuickReplies(parsed.data.q);
            res.json({
                data: quickReplies,
                meta: {
                    total: quickReplies.length,
                    page: 1,
                    limit: quickReplies.length,
                    pages: 1,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/quick-replies',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = quickReplyPayloadSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Payload inválido para mensagem pronta.'));
                return;
            }

            const quickReply = await createQuickReply({
                ...parsed.data,
                createdBy: getCurrentUser(req).id,
            });

            await createAuditLog({
                userId: getCurrentUser(req).id,
                action: 'CREATE_QUICK_REPLY',
                entityType: 'quick_replies',
                entityId: quickReply.id,
                oldValue: null,
                newValue: {
                    title: quickReply.title,
                    category: quickReply.category,
                },
                req,
            });

            res.status(201).json({
                quick_reply: quickReply,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.put(
    '/quick-replies/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = quickReplyParamsSchema.safeParse(req.params);
            const body = quickReplyPayloadSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest('Payload inválido para atualizar mensagem pronta.'));
                return;
            }

            const quickReply = await updateQuickReply({
                id: params.data.id,
                ...body.data,
            });

            await createAuditLog({
                userId: getCurrentUser(req).id,
                action: 'UPDATE_QUICK_REPLY',
                entityType: 'quick_replies',
                entityId: quickReply.id,
                oldValue: null,
                newValue: {
                    title: quickReply.title,
                    category: quickReply.category,
                },
                req,
            });

            res.json({
                quick_reply: quickReply,
            });
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/quick-replies/:id',
    authenticate,
    requireRole(['ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = quickReplyParamsSchema.safeParse(req.params);
            if (!params.success) {
                next(AppError.badRequest('Mensagem pronta inválida.'));
                return;
            }

            await deleteQuickReply(params.data.id);

            await createAuditLog({
                userId: getCurrentUser(req).id,
                action: 'DELETE_QUICK_REPLY',
                entityType: 'quick_replies',
                entityId: params.data.id,
                oldValue: null,
                newValue: null,
                req,
            });

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

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

            if (conversation.channel !== 'whatsapp') {
                next(AppError.serviceUnavailable(
                    'CHANNEL_SEND_NOT_READY',
                    `Envio operacional para ${conversation.channel} ainda não foi habilitado.`
                ));
                return;
            }

            await assignForReplyIfNeeded(req, params.data.id, conversation);
            const outboundPayload = await resolveOutboundText(currentUser, body.data);

            let outbound: { meta_message_id: string };

            try {
                outbound = await sendTextMessage({
                    to: conversation.whatsapp_number,
                    text: outboundPayload.text,
                });
            } catch (error) {
                await appendOutboundMessage({
                    conversationId: params.data.id,
                    metaMessageId: null,
                    type: 'TEXT',
                    content: outboundPayload.text,
                    sentBy: currentUser.id,
                    sentByName: currentUser.name,
                    status: 'FAILED',
                    isAutomated: false,
                    isQuickReply: Boolean(outboundPayload.quickReplyId),
                });
                throw error;
            }

            const message = await appendOutboundMessage({
                conversationId: params.data.id,
                metaMessageId: outbound.meta_message_id,
                type: 'TEXT',
                content: outboundPayload.text,
                sentBy: currentUser.id,
                sentByName: currentUser.name,
                status: 'SENT',
                isAutomated: false,
                isQuickReply: Boolean(outboundPayload.quickReplyId),
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
                    type: outboundPayload.kind,
                    quick_reply_id: outboundPayload.quickReplyId,
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

router.post(
    '/conversations/:id/resolve',
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
                action: 'RESOLVE_CONVERSATION',
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

router.get(
    '/conversations/:id/note',
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
            const payload = await getConversationNote(params.data.id, currentUser);
            res.json(payload);
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/conversations/:id/note',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const params = conversationParamsSchema.safeParse(req.params);
            const body = saveNoteSchema.safeParse(req.body);

            if (!params.success || !body.success) {
                next(AppError.badRequest('Dados inválidos para salvar nota.'));
                return;
            }

            const currentUser = getCurrentUser(req);
            await saveConversationNote(params.data.id, body.data.note, currentUser);

            await createAuditLog({
                userId: currentUser.id,
                action: 'UPDATE_CONVERSATION_NOTE',
                entityType: 'conversations',
                entityId: params.data.id,
                oldValue: null,
                newValue: { has_note: body.data.note.trim().length > 0 },
                req,
            });

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/conversations/:id/read',
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
            await markConversationRead(params.data.id, currentUser);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

export default router;
