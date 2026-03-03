import type { QueryResultRow } from 'pg';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import type {
    ConversationStatus,
    InboxConversationSummary,
    InboxConversationThread,
    InboxMessageView,
    MessageDirection,
    MessageStatus,
    MessageType,
    ParsedWhatsAppInboundEvent,
    UserRole,
} from '../types/entities.js';

export interface CurrentUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

export interface ListInboxConversationsParams {
    status?: ConversationStatus;
    q?: string;
    assigned_to?: string;
    page: number;
    limit: number;
}

interface ConversationSummaryRow extends QueryResultRow {
    id: string;
    whatsapp_number: string;
    status: ConversationStatus;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
    lead_id: string | null;
    lead_name: string | null;
    customer_id: string | null;
    customer_name: string | null;
    last_message_preview: string | null;
    last_message_at: Date | null;
}

interface MessageRow extends QueryResultRow {
    id: string;
    meta_message_id: string | null;
    direction: MessageDirection;
    type: MessageType;
    content: string | null;
    media_url: string | null;
    status: MessageStatus;
    is_automated: boolean;
    created_at: Date;
    sent_by_user_id: string | null;
    sent_by_user_name: string | null;
}

function mapConversation(row: ConversationSummaryRow): InboxConversationSummary {
    return {
        id: row.id,
        whatsapp_number: row.whatsapp_number,
        status: row.status,
        assigned_to: row.assigned_user_id && row.assigned_user_name
            ? {
                id: row.assigned_user_id,
                name: row.assigned_user_name,
            }
            : null,
        lead: row.lead_id
            ? {
                id: row.lead_id,
                name: row.lead_name,
            }
            : null,
        customer: row.customer_id && row.customer_name
            ? {
                id: row.customer_id,
                name: row.customer_name,
            }
            : null,
        last_message_preview: row.last_message_preview,
        last_message_at: row.last_message_at,
        unread_count: 0,
    };
}

function mapMessage(row: MessageRow): InboxMessageView {
    return {
        id: row.id,
        meta_message_id: row.meta_message_id,
        direction: row.direction,
        type: row.type,
        content: row.content,
        media_url: row.media_url,
        status: row.status,
        is_automated: row.is_automated,
        sent_by: row.sent_by_user_id && row.sent_by_user_name
            ? {
                id: row.sent_by_user_id,
                name: row.sent_by_user_name,
            }
            : null,
        created_at: row.created_at,
    };
}

function buildScopedConversationFilter(currentUser: CurrentUser, values: unknown[], alias = 'c'): string | null {
    if (currentUser.role === 'ADMIN') {
        return null;
    }

    values.push(currentUser.id);
    const assignedIndex = values.length;

    return `(${alias}.assigned_to = $${assignedIndex} OR (${alias}.status = 'AGUARDANDO_HUMANO' AND ${alias}.assigned_to IS NULL))`;
}

function assertConversationAccess(currentUser: CurrentUser, row: ConversationSummaryRow): void {
    if (currentUser.role === 'ADMIN') {
        return;
    }

    const canAccessAssigned = row.assigned_user_id === currentUser.id;
    const canAccessWaitingPool = row.status === 'AGUARDANDO_HUMANO' && !row.assigned_user_id;

    if (!canAccessAssigned && !canAccessWaitingPool) {
        throw AppError.forbidden('Acesso não autorizado para esta conversa.');
    }
}

async function getConversationRowById(conversationId: string): Promise<ConversationSummaryRow | null> {
    const result = await query<ConversationSummaryRow>(
        `SELECT
            c.id,
            c.whatsapp_number,
            c.status,
            c.last_message_at,
            assigned_user.id AS assigned_user_id,
            assigned_user.name AS assigned_user_name,
            l.id AS lead_id,
            l.name AS lead_name,
            cu.id AS customer_id,
            cu.name AS customer_name,
            last_message.content AS last_message_preview
          FROM conversations c
          LEFT JOIN users assigned_user ON assigned_user.id = c.assigned_to
          LEFT JOIN leads l ON l.id = c.lead_id
          LEFT JOIN customers cu ON cu.id = c.customer_id
          LEFT JOIN LATERAL (
            SELECT m.content
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS last_message ON TRUE
          WHERE c.id = $1
          LIMIT 1`,
        [conversationId]
    );

    return result.rows[0] ?? null;
}

async function resolveConversationLinks(inbound: ParsedWhatsAppInboundEvent): Promise<{
    leadId: string | null;
    customerId: string | null;
}> {
    const customerResult = await query<{ id: string }>(
        'SELECT id FROM customers WHERE whatsapp_number = $1 LIMIT 1',
        [inbound.whatsapp_number]
    );
    const customerId = customerResult.rows[0]?.id ?? null;

    const leadResult = await query<{ id: string }>(
        'SELECT id FROM leads WHERE whatsapp_number = $1 LIMIT 1',
        [inbound.whatsapp_number]
    );
    let leadId = leadResult.rows[0]?.id ?? null;

    if (!leadId && !customerId) {
        const createdLead = await query<{ id: string }>(
            `INSERT INTO leads (whatsapp_number, name, source, stage, last_interaction_at)
             VALUES ($1, $2, 'WHATSAPP', 'NOVO', NOW())
             RETURNING id`,
            [inbound.whatsapp_number, inbound.profile_name]
        );
        leadId = createdLead.rows[0]?.id ?? null;
    } else if (leadId) {
        await query(
            `UPDATE leads
             SET
               last_interaction_at = NOW(),
               updated_at = NOW(),
               name = COALESCE(name, $2)
             WHERE id = $1`,
            [leadId, inbound.profile_name]
        );
    }

    return {
        leadId,
        customerId,
    };
}

export async function listConversations(
    params: ListInboxConversationsParams,
    currentUser: CurrentUser
): Promise<{
    data: InboxConversationSummary[];
    meta: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}> {
    const filters: string[] = [];
    const baseValues: unknown[] = [];

    const scopedFilter = buildScopedConversationFilter(currentUser, baseValues);
    if (scopedFilter) {
        filters.push(scopedFilter);
    }

    if (params.status) {
        baseValues.push(params.status);
        filters.push(`c.status = $${baseValues.length}`);
    }

    if (params.assigned_to && currentUser.role === 'ADMIN') {
        baseValues.push(params.assigned_to);
        filters.push(`c.assigned_to = $${baseValues.length}`);
    }

    if (params.q) {
        baseValues.push(`%${params.q}%`);
        const searchIndex = baseValues.length;
        filters.push(`(
            c.whatsapp_number ILIKE $${searchIndex}
            OR COALESCE(l.name, '') ILIKE $${searchIndex}
            OR COALESCE(cu.name, '') ILIKE $${searchIndex}
        )`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM conversations c
         LEFT JOIN leads l ON l.id = c.lead_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         ${whereClause}`,
        baseValues
    );

    const values = [...baseValues];
    values.push(params.limit);
    const limitIndex = values.length;
    values.push((params.page - 1) * params.limit);
    const offsetIndex = values.length;

    const result = await query<ConversationSummaryRow>(
        `SELECT
            c.id,
            c.whatsapp_number,
            c.status,
            c.last_message_at,
            assigned_user.id AS assigned_user_id,
            assigned_user.name AS assigned_user_name,
            l.id AS lead_id,
            l.name AS lead_name,
            cu.id AS customer_id,
            cu.name AS customer_name,
            last_message.content AS last_message_preview
          FROM conversations c
          LEFT JOIN users assigned_user ON assigned_user.id = c.assigned_to
          LEFT JOIN leads l ON l.id = c.lead_id
          LEFT JOIN customers cu ON cu.id = c.customer_id
          LEFT JOIN LATERAL (
            SELECT m.content
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS last_message ON TRUE
          ${whereClause}
          ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        values
    );

    const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

    return {
        data: result.rows.map(mapConversation),
        meta: {
            total,
            page: params.page,
            limit: params.limit,
            pages: Math.max(1, Math.ceil(total / params.limit)),
        },
    };
}

export async function getConversationById(
    conversationId: string,
    currentUser: CurrentUser
): Promise<Omit<InboxConversationSummary, 'unread_count'>> {
    const row = await getConversationRowById(conversationId);

    if (!row) {
        throw AppError.notFound('Conversa não encontrada.');
    }

    assertConversationAccess(currentUser, row);

    const summary = mapConversation(row);

    return {
        id: summary.id,
        whatsapp_number: summary.whatsapp_number,
        status: summary.status,
        assigned_to: summary.assigned_to,
        lead: summary.lead,
        customer: summary.customer,
        last_message_preview: summary.last_message_preview,
        last_message_at: summary.last_message_at,
    };
}

export async function getConversationThread(
    conversationId: string,
    currentUser: CurrentUser
): Promise<InboxConversationThread> {
    const conversation = await getConversationById(conversationId, currentUser);

    const messagesResult = await query<MessageRow>(
        `SELECT
            m.id,
            m.meta_message_id,
            m.direction,
            m.type,
            m.content,
            m.media_url,
            m.status,
            m.is_automated,
            m.created_at,
            sender.id AS sent_by_user_id,
            sender.name AS sent_by_user_name
          FROM messages m
          LEFT JOIN users sender ON sender.id = m.sent_by
          WHERE m.conversation_id = $1
          ORDER BY m.created_at ASC, m.id ASC`,
        [conversationId]
    );

    return {
        conversation: {
            id: conversation.id,
            whatsapp_number: conversation.whatsapp_number,
            status: conversation.status,
            assigned_to: conversation.assigned_to,
            lead: conversation.lead,
            customer: conversation.customer,
        },
        messages: messagesResult.rows.map(mapMessage),
    };
}

export async function upsertConversationFromInbound(inbound: ParsedWhatsAppInboundEvent): Promise<{
    id: string;
}> {
    const links = await resolveConversationLinks(inbound);

    const existingConversation = await query<{ id: string }>(
        `SELECT id
         FROM conversations
         WHERE whatsapp_number = $1
           AND status <> 'ENCERRADA'
         ORDER BY
           CASE status
             WHEN 'EM_ATENDIMENTO' THEN 1
             WHEN 'AGUARDANDO_HUMANO' THEN 2
             WHEN 'BOT' THEN 3
             ELSE 4
           END,
           updated_at DESC
         LIMIT 1`,
        [inbound.whatsapp_number]
    );

    const currentConversationId = existingConversation.rows[0]?.id;

    if (currentConversationId) {
        await query(
            `UPDATE conversations
             SET
               lead_id = COALESCE($2, lead_id),
               customer_id = COALESCE($3, customer_id),
               last_message_at = NOW(),
               updated_at = NOW()
             WHERE id = $1`,
            [currentConversationId, links.leadId, links.customerId]
        );

        return { id: currentConversationId };
    }

    const createdConversation = await query<{ id: string }>(
        `INSERT INTO conversations (
            whatsapp_number,
            lead_id,
            customer_id,
            status,
            last_message_at
          ) VALUES ($1, $2, $3, 'BOT', NOW())
          RETURNING id`,
        [inbound.whatsapp_number, links.leadId, links.customerId]
    );

    const createdConversationId = createdConversation.rows[0]?.id;
    if (!createdConversationId) {
        throw AppError.serviceUnavailable('INBOX_WRITE_FAILED', 'Não foi possível criar a conversa.');
    }

    return {
        id: createdConversationId,
    };
}

export async function appendInboundMessage(input: {
    conversationId: string;
    metaMessageId: string;
    type: MessageType;
    content: string | null;
    mediaUrl: string | null;
    isAutomated?: boolean;
}): Promise<InboxMessageView | null> {
    try {
        const result = await query<MessageRow>(
            `INSERT INTO messages (
                conversation_id,
                meta_message_id,
                direction,
                type,
                content,
                media_url,
                status,
                is_automated
              ) VALUES ($1, $2, 'INBOUND', $3, $4, $5, 'READ', $6)
              RETURNING
                id,
                meta_message_id,
                direction,
                type,
                content,
                media_url,
                status,
                is_automated,
                created_at,
                NULL::uuid AS sent_by_user_id,
                NULL::text AS sent_by_user_name`,
            [
                input.conversationId,
                input.metaMessageId,
                input.type,
                input.content,
                input.mediaUrl,
                input.isAutomated ?? false,
            ]
        );

        await query(
            `UPDATE conversations
             SET last_message_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [input.conversationId]
        );

        const row = result.rows[0];
        if (!row) {
            throw AppError.serviceUnavailable('INBOX_WRITE_FAILED', 'Não foi possível salvar a mensagem recebida.');
        }

        return mapMessage(row);
    } catch (error) {
        const databaseError = error as { code?: string };

        if (databaseError.code === '23505') {
            return null;
        }

        throw error;
    }
}

export async function appendOutboundMessage(input: {
    conversationId: string;
    metaMessageId: string | null;
    type: MessageType;
    content: string;
    sentBy: string;
    sentByName: string;
    status: MessageStatus;
    isAutomated: boolean;
}): Promise<InboxMessageView> {
    const result = await query<MessageRow>(
        `INSERT INTO messages (
            conversation_id,
            meta_message_id,
            direction,
            type,
            content,
            sent_by,
            status,
            is_automated
          ) VALUES ($1, $2, 'OUTBOUND', $3, $4, $5, $6, $7)
          RETURNING
            id,
            meta_message_id,
            direction,
            type,
            content,
            media_url,
            status,
            is_automated,
            created_at,
            $5::uuid AS sent_by_user_id,
            $8::text AS sent_by_user_name`,
        [
            input.conversationId,
            input.metaMessageId,
            input.type,
            input.content,
            input.sentBy,
            input.status,
            input.isAutomated,
            input.sentByName,
        ]
    );

    await query(
        `UPDATE conversations
         SET
           status = 'EM_ATENDIMENTO',
           last_message_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [input.conversationId]
    );

    const row = result.rows[0];
    if (!row) {
        throw AppError.serviceUnavailable('INBOX_WRITE_FAILED', 'Não foi possível salvar a mensagem enviada.');
    }

    return mapMessage(row);
}

export async function assignConversationToCurrentUser(
    conversationId: string,
    currentUser: CurrentUser,
    requestedAssignedTo?: string
): Promise<Omit<InboxConversationSummary, 'unread_count'>> {
    const row = await getConversationRowById(conversationId);

    if (!row) {
        throw AppError.notFound('Conversa não encontrada.');
    }

    assertConversationAccess(currentUser, row);

    let assignedTo = currentUser.id;

    if (currentUser.role === 'ADMIN' && requestedAssignedTo && requestedAssignedTo !== currentUser.id) {
        const assigneeResult = await query<{ id: string }>(
            `SELECT id
             FROM users
             WHERE id = $1
               AND status = 'active'
               AND role = 'ATENDENTE'
             LIMIT 1`,
            [requestedAssignedTo]
        );

        if (!assigneeResult.rows[0]) {
            throw AppError.badRequest('O atendente informado não está disponível.');
        }

        assignedTo = requestedAssignedTo;
    }

    await query(
        `UPDATE conversations
         SET
           assigned_to = $2,
           status = 'EM_ATENDIMENTO',
           updated_at = NOW()
         WHERE id = $1`,
        [conversationId, assignedTo]
    );

    return getConversationById(conversationId, {
        ...currentUser,
        id: currentUser.role === 'ADMIN' ? currentUser.id : assignedTo,
    });
}

export async function closeConversation(
    conversationId: string,
    currentUser: CurrentUser
): Promise<Omit<InboxConversationSummary, 'unread_count'>> {
    const row = await getConversationRowById(conversationId);

    if (!row) {
        throw AppError.notFound('Conversa não encontrada.');
    }

    if (currentUser.role !== 'ADMIN' && row.assigned_user_id !== currentUser.id) {
        throw AppError.forbidden('Você só pode encerrar conversas atribuídas a você.');
    }

    await query(
        `UPDATE conversations
         SET
           status = 'ENCERRADA',
           updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
    );

    return getConversationById(conversationId, currentUser);
}
