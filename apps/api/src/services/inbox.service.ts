import type { QueryResultRow } from 'pg';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { publishInboxEvent } from './inbox-events.service.js';
import type {
    ConversationStatus,
    InboxChannel,
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
    channel?: InboxChannel;
    q?: string;
    assigned_to?: string;
    page: number;
    limit: number;
}

interface ConversationSummaryRow extends QueryResultRow {
    id: string;
    channel: InboxChannel;
    external_id: string;
    whatsapp_number: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_handle: string | null;
    status: ConversationStatus;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
    assigned_at: Date | null;
    lead_id: string | null;
    lead_name: string | null;
    customer_id: string | null;
    customer_name: string | null;
    pipeline_id: string | null;
    pipeline_name: string | null;
    pipeline_slug: string | null;
    stage_id: string | null;
    stage_name: string | null;
    stage_color: string | null;
    last_message_preview: string | null;
    last_message_at: Date | null;
    unread_count: number;
}

interface MessageRow extends QueryResultRow {
    id: string;
    meta_message_id: string | null;
    external_id: string | null;
    direction: MessageDirection;
    type: MessageType;
    content: string | null;
    media_url: string | null;
    media_mime: string | null;
    media_size: number | null;
    status: MessageStatus;
    is_automated: boolean;
    is_quick_reply: boolean;
    created_at: Date;
    sent_by_user_id: string | null;
    sent_by_user_name: string | null;
}

interface QuickReplyRow extends QueryResultRow {
    id: string;
    title: string;
    body: string;
    category: string | null;
    created_at: Date;
    updated_at: Date;
}

interface ChannelIntegrationRow extends QueryResultRow {
    id: string;
    channel: InboxChannel;
    is_active: boolean;
    webhook_url: string | null;
    created_at: Date;
    updated_at: Date;
}

function mapConversation(row: ConversationSummaryRow): InboxConversationSummary {
    return {
        id: row.id,
        channel: row.channel,
        external_id: row.external_id,
        whatsapp_number: row.whatsapp_number,
        contact_name: row.contact_name,
        contact_phone: row.contact_phone,
        contact_handle: row.contact_handle,
        status: row.status,
        assigned_to: row.assigned_user_id && row.assigned_user_name
            ? {
                id: row.assigned_user_id,
                name: row.assigned_user_name,
            }
            : null,
        assigned_at: row.assigned_at,
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
        pipeline: row.pipeline_id && row.pipeline_name && row.pipeline_slug
            ? {
                id: row.pipeline_id,
                slug: row.pipeline_slug,
                name: row.pipeline_name,
            }
            : null,
        stage: row.stage_id && row.stage_name && row.stage_color
            ? {
                id: row.stage_id,
                name: row.stage_name,
                color: row.stage_color,
            }
            : null,
        last_message_preview: row.last_message_preview,
        last_message_at: row.last_message_at,
        unread_count: row.unread_count,
    };
}

function mapMessage(row: MessageRow): InboxMessageView {
    return {
        id: row.id,
        meta_message_id: row.meta_message_id,
        external_id: row.external_id,
        direction: row.direction,
        type: row.type,
        content: row.content,
        media_url: row.media_url,
        media_mime: row.media_mime,
        media_size: row.media_size,
        status: row.status,
        is_automated: row.is_automated,
        is_quick_reply: row.is_quick_reply,
        sent_by: row.sent_by_user_id && row.sent_by_user_name
            ? {
                id: row.sent_by_user_id,
                name: row.sent_by_user_name,
            }
            : null,
        created_at: row.created_at,
    };
}

async function resolveDefaultLeadContext(): Promise<{
    pipelineId: string;
    stageId: string | null;
}> {
    const pipelineResult = await query<{ id: string }>(
        `SELECT id
         FROM pipelines
         WHERE slug = 'leads'
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1`
    );

    const pipelineId = pipelineResult.rows[0]?.id;
    if (!pipelineId) {
        throw AppError.serviceUnavailable('PIPELINE_DEFAULT_MISSING', 'Pipeline padrão de leads não encontrado.');
    }

    const stageResult = await query<{ id: string }>(
        `SELECT id
         FROM pipeline_stages
         WHERE pipeline_id = $1
         ORDER BY position ASC
         LIMIT 1`,
        [pipelineId]
    );

    return {
        pipelineId,
        stageId: stageResult.rows[0]?.id ?? null,
    };
}

export async function getQuickReplyById(id: string): Promise<QuickReplyRow | null> {
    const result = await query<QuickReplyRow>(
        `SELECT id, title, body, category, created_at, updated_at
         FROM quick_replies
         WHERE id = $1
         LIMIT 1`,
        [id]
    );

    return result.rows[0] ?? null;
}

export async function buildIdentificationMessage(currentUser: CurrentUser): Promise<string> {
    const settingsResult = await query<{ company_name: string }>(
        'SELECT company_name FROM settings LIMIT 1'
    );

    const companyName = settingsResult.rows[0]?.company_name?.trim() || 'ORION';
    const roleLabel = currentUser.role === 'ROOT' || currentUser.role === 'ADMIN' ? 'gestor' : 'atendente';

    return `Olá! Sou ${currentUser.name}, ${roleLabel} da ${companyName}. Vou seguir com o seu atendimento por aqui.`;
}

function isInboxSuperUser(currentUser: CurrentUser): boolean {
    return currentUser.role === 'ROOT' || currentUser.role === 'ADMIN';
}

function buildScopedConversationFilter(currentUser: CurrentUser, values: unknown[], alias = 'c'): string | null {
    if (isInboxSuperUser(currentUser)) {
        return null;
    }

    values.push(currentUser.id);
    const assignedIndex = values.length;

    return `(${alias}.assigned_to = $${assignedIndex} OR (${alias}.status = 'AGUARDANDO_HUMANO' AND ${alias}.assigned_to IS NULL))`;
}

function assertConversationAccess(currentUser: CurrentUser, row: ConversationSummaryRow): void {
    if (isInboxSuperUser(currentUser)) {
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
            c.channel,
            c.external_id,
            c.whatsapp_number,
            c.contact_name,
            c.contact_phone,
            c.contact_handle,
            c.status,
            c.last_message_at,
            c.unread_count,
            assigned_user.id AS assigned_user_id,
            assigned_user.name AS assigned_user_name,
            c.assigned_at,
            l.id AS lead_id,
            l.name AS lead_name,
            cu.id AS customer_id,
            cu.name AS customer_name,
            p.id AS pipeline_id,
            p.name AS pipeline_name,
            p.slug AS pipeline_slug,
            ps.id AS stage_id,
            ps.name AS stage_name,
            ps.color AS stage_color,
            last_message.content AS last_message_preview
          FROM conversations c
          LEFT JOIN users assigned_user ON assigned_user.id = c.assigned_to
          LEFT JOIN leads l ON l.id = c.lead_id
          LEFT JOIN customers cu ON cu.id = c.customer_id
          LEFT JOIN pipelines p ON p.id = c.pipeline_id
          LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
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
    const contactPhone = inbound.contact_phone ?? inbound.whatsapp_number;
    const customerResult = await query<{ id: string }>(
        'SELECT id FROM customers WHERE whatsapp_number = $1 LIMIT 1',
        [contactPhone]
    );
    const customerId = customerResult.rows[0]?.id ?? null;

    const leadResult = await query<{ id: string }>(
        'SELECT id FROM leads WHERE whatsapp_number = $1 LIMIT 1',
        [contactPhone]
    );
    let leadId = leadResult.rows[0]?.id ?? null;

    if (!leadId && !customerId) {
        const defaultLeadContext = await resolveDefaultLeadContext();
        const createdLead = await query<{ id: string }>(
            `INSERT INTO leads (
                whatsapp_number,
                name,
                source,
                stage,
                pipeline_id,
                stage_id,
                last_interaction_at
             )
             VALUES ($1, $2, 'WHATSAPP', 'NOVO', $3, $4, NOW())
             RETURNING id`,
            [contactPhone, inbound.profile_name, defaultLeadContext.pipelineId, defaultLeadContext.stageId]
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

    if (params.assigned_to && isInboxSuperUser(currentUser)) {
        baseValues.push(params.assigned_to);
        filters.push(`c.assigned_to = $${baseValues.length}`);
    }

    if (params.channel) {
        baseValues.push(params.channel);
        filters.push(`c.channel = $${baseValues.length}::inbox_channel`);
    }

    if (params.q) {
        baseValues.push(`%${params.q}%`);
        const searchIndex = baseValues.length;
        filters.push(`(
            c.whatsapp_number ILIKE $${searchIndex}
            OR COALESCE(c.contact_name, '') ILIKE $${searchIndex}
            OR COALESCE(c.contact_handle, '') ILIKE $${searchIndex}
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
            c.channel,
            c.external_id,
            c.whatsapp_number,
            c.contact_name,
            c.contact_phone,
            c.contact_handle,
            c.status,
            c.last_message_at,
            c.unread_count,
            assigned_user.id AS assigned_user_id,
            assigned_user.name AS assigned_user_name,
            c.assigned_at,
            l.id AS lead_id,
            l.name AS lead_name,
            cu.id AS customer_id,
            cu.name AS customer_name,
            p.id AS pipeline_id,
            p.name AS pipeline_name,
            p.slug AS pipeline_slug,
            ps.id AS stage_id,
            ps.name AS stage_name,
            ps.color AS stage_color,
            last_message.content AS last_message_preview
          FROM conversations c
          LEFT JOIN users assigned_user ON assigned_user.id = c.assigned_to
          LEFT JOIN leads l ON l.id = c.lead_id
          LEFT JOIN customers cu ON cu.id = c.customer_id
          LEFT JOIN pipelines p ON p.id = c.pipeline_id
          LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
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
        channel: summary.channel,
        external_id: summary.external_id,
        whatsapp_number: summary.whatsapp_number,
        contact_name: summary.contact_name,
        contact_phone: summary.contact_phone,
        contact_handle: summary.contact_handle,
        status: summary.status,
        assigned_to: summary.assigned_to,
        assigned_at: summary.assigned_at,
        lead: summary.lead,
        customer: summary.customer,
        pipeline: summary.pipeline,
        stage: summary.stage,
        last_message_preview: summary.last_message_preview,
        last_message_at: summary.last_message_at,
    };
}

export async function getConversationThread(
    conversationId: string,
    currentUser: CurrentUser
): Promise<InboxConversationThread> {
    const conversation = await getConversationById(conversationId, currentUser);

    await query(
        `UPDATE conversations
         SET unread_count = 0
         WHERE id = $1`,
        [conversationId]
    );

    const messagesResult = await query<MessageRow>(
        `SELECT
            m.id,
            m.meta_message_id,
            m.external_id,
            m.direction,
            m.type,
            m.content,
            m.media_url,
            m.media_mime,
            m.media_size,
            m.status,
            m.is_automated,
            m.is_quick_reply,
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
            channel: conversation.channel,
            external_id: conversation.external_id,
            whatsapp_number: conversation.whatsapp_number,
            contact_name: conversation.contact_name,
            contact_phone: conversation.contact_phone,
            contact_handle: conversation.contact_handle,
            status: conversation.status,
            assigned_to: conversation.assigned_to,
            assigned_at: conversation.assigned_at,
            lead: conversation.lead,
            customer: conversation.customer,
            pipeline: conversation.pipeline,
            stage: conversation.stage,
        },
        messages: messagesResult.rows.map(mapMessage),
    };
}

export async function upsertConversationFromInbound(inbound: ParsedWhatsAppInboundEvent): Promise<{
    id: string;
}> {
    const links = await resolveConversationLinks(inbound);
    let linkedLead: { pipeline_id: string; stage_id: string | null } | null = null;
    if (links.leadId) {
        const leadContext = await query<{ pipeline_id: string; stage_id: string | null }>(
            `SELECT pipeline_id, stage_id
             FROM leads
             WHERE id = $1
             LIMIT 1`,
            [links.leadId]
        );
        linkedLead = leadContext.rows[0] ?? null;
    }
    const contactPhone = inbound.contact_phone ?? inbound.whatsapp_number;

    const existingConversation = await query<{ id: string }>(
        `SELECT id
         FROM conversations
         WHERE channel = $1::inbox_channel
           AND (
             external_id = $2
             OR ($1 = 'whatsapp' AND whatsapp_number = $3)
           )
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
        [inbound.channel, inbound.external_conversation_id, contactPhone]
    );

    const currentConversationId = existingConversation.rows[0]?.id;

    if (currentConversationId) {
        await query(
            `UPDATE conversations
             SET
               contact_name = COALESCE($2, contact_name),
               contact_phone = COALESCE($3, contact_phone),
               contact_handle = COALESCE($4, contact_handle),
               lead_id = COALESCE($5, lead_id),
               customer_id = COALESCE($6, customer_id),
               pipeline_id = COALESCE($7, pipeline_id),
               stage_id = COALESCE($8, stage_id),
               last_message_at = NOW(),
               updated_at = NOW()
             WHERE id = $1`,
            [
                currentConversationId,
                inbound.profile_name,
                contactPhone,
                inbound.contact_handle,
                links.leadId,
                links.customerId,
                linkedLead?.pipeline_id ?? null,
                linkedLead?.stage_id ?? null,
            ]
        );

        publishInboxEvent({
            type: 'conversation.updated',
            conversationId: currentConversationId,
            source: 'inbound',
        });

        return { id: currentConversationId };
    }

    const createdConversation = await query<{ id: string }>(
        `INSERT INTO conversations (
            channel,
            external_id,
            whatsapp_number,
            contact_name,
            contact_phone,
            contact_handle,
            lead_id,
            customer_id,
            pipeline_id,
            stage_id,
            status,
            last_message_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'BOT', NOW())
          RETURNING id`,
        [
            inbound.channel,
            inbound.external_conversation_id,
            contactPhone,
            inbound.profile_name,
            contactPhone,
            inbound.contact_handle,
            links.leadId,
            links.customerId,
            linkedLead?.pipeline_id ?? null,
            linkedLead?.stage_id ?? null,
        ]
    );

    const createdConversationId = createdConversation.rows[0]?.id;
    if (!createdConversationId) {
        throw AppError.serviceUnavailable('INBOX_WRITE_FAILED', 'Não foi possível criar a conversa.');
    }

    publishInboxEvent({
        type: 'conversation.created',
        conversationId: createdConversationId,
        source: 'inbound',
    });

    return {
        id: createdConversationId,
    };
}

export async function appendInboundMessage(input: {
    conversationId: string;
    metaMessageId: string;
    externalId?: string | null;
    type: MessageType;
    content: string | null;
    mediaUrl: string | null;
    mediaMime?: string | null;
    mediaSize?: number | null;
    isAutomated?: boolean;
}): Promise<InboxMessageView | null> {
    try {
        // INSERT idempotente: ignora duplicata de meta_message_id sem erro
        const result = await query<MessageRow>(
            `INSERT INTO messages (
                conversation_id,
                meta_message_id,
                external_id,
                direction,
                type,
                content,
                media_url,
                media_mime,
                media_size,
                status,
                is_automated,
                is_quick_reply
              ) VALUES ($1, $2, $3, 'INBOUND', $4, $5, $6, $7, $8, 'READ', $9, false)
              ON CONFLICT (meta_message_id) DO NOTHING
              RETURNING
                id,
                meta_message_id,
                external_id,
                direction,
                type,
                content,
                media_url,
                media_mime,
                media_size,
                status,
                is_automated,
                is_quick_reply,
                created_at,
                NULL::uuid AS sent_by_user_id,
                NULL::text AS sent_by_user_name`,
            [
                input.conversationId,
                input.metaMessageId,
                input.externalId ?? input.metaMessageId,
                input.type,
                input.content,
                input.mediaUrl,
                input.mediaMime ?? null,
                input.mediaSize ?? null,
                input.isAutomated ?? false,
            ]
        );

        // Se não inseriu (duplicata), sai antes de incrementar unread
        if (result.rowCount === 0) {
            return null;
        }

        // Incrementa unread APENAS se realmente inseriu mensagem nova
        await query(
            `UPDATE conversations
             SET
               last_message_at = NOW(),
               unread_count = unread_count + 1,
               updated_at = NOW()
             WHERE id = $1`,
            [input.conversationId]
        );

        publishInboxEvent({
            type: 'message.created',
            conversationId: input.conversationId,
            source: 'inbound',
        });

        const row = result.rows[0];
        if (!row) {
            throw AppError.serviceUnavailable('INBOX_WRITE_FAILED', 'Não foi possível salvar a mensagem recebida.');
        }

        return mapMessage(row);
    } catch (error) {
        // Erro diferente de duplicata - propagate
        throw error;
    }
}

export async function appendOutboundMessage(input: {
    conversationId: string;
    metaMessageId: string | null;
    externalId?: string | null;
    type: MessageType;
    content: string;
    sentBy: string;
    sentByName: string;
    status: MessageStatus;
    isAutomated: boolean;
    isQuickReply?: boolean;
}): Promise<InboxMessageView> {
    const result = await query<MessageRow>(
        `INSERT INTO messages (
            conversation_id,
            meta_message_id,
            external_id,
            direction,
            type,
            content,
            sent_by,
            status,
            is_automated,
            is_quick_reply
          ) VALUES ($1, $2, $3, 'OUTBOUND', $4, $5, $6, $7, $8, $9)
          RETURNING
            id,
            meta_message_id,
            external_id,
            direction,
            type,
            content,
            media_url,
            media_mime,
            media_size,
            status,
            is_automated,
            is_quick_reply,
            created_at,
            $6::uuid AS sent_by_user_id,
            $10::text AS sent_by_user_name`,
        [
            input.conversationId,
            input.metaMessageId,
            input.externalId ?? input.metaMessageId,
            input.type,
            input.content,
            input.sentBy,
            input.status,
            input.isAutomated,
            input.isQuickReply ?? false,
            input.sentByName,
        ]
    );

    await query(
        `UPDATE conversations
         SET
           status = 'EM_ATENDIMENTO',
           unread_count = 0,
           last_message_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [input.conversationId]
    );

    publishInboxEvent({
        type: 'message.created',
        conversationId: input.conversationId,
        source: input.isAutomated ? 'system' : 'outbound',
    });

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

    if (isInboxSuperUser(currentUser) && requestedAssignedTo && requestedAssignedTo !== currentUser.id) {
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
           assigned_at = NOW(),
           status = 'EM_ATENDIMENTO',
           updated_at = NOW()
         WHERE id = $1`,
        [conversationId, assignedTo]
    );

    publishInboxEvent({
        type: 'conversation.updated',
        conversationId,
        source: 'system',
    });

    return getConversationById(conversationId, {
        ...currentUser,
        id: isInboxSuperUser(currentUser) ? currentUser.id : assignedTo,
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

    if (!isInboxSuperUser(currentUser) && row.assigned_user_id !== currentUser.id) {
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

    publishInboxEvent({
        type: 'conversation.updated',
        conversationId,
        source: 'system',
    });

    return getConversationById(conversationId, currentUser);
}

export async function handoffConversation(
    conversationId: string,
    currentUser: CurrentUser
): Promise<Omit<InboxConversationSummary, 'unread_count'>> {
    const row = await getConversationRowById(conversationId);

    if (!row) {
        throw AppError.notFound('Conversa não encontrada.');
    }

    if (!isInboxSuperUser(currentUser) && row.assigned_user_id !== currentUser.id) {
        throw AppError.forbidden('Você só pode devolver para a fila conversas atribuídas a você.');
    }

    await query(
        `UPDATE conversations
         SET
           status = 'AGUARDANDO_HUMANO',
           assigned_to = NULL,
           assigned_at = NULL,
           updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
    );

    publishInboxEvent({
        type: 'conversation.updated',
        conversationId,
        source: 'system',
    });

    return getConversationById(conversationId, currentUser);
}

export async function listQuickReplies(search?: string): Promise<Array<{
    id: string;
    title: string;
    body: string;
    category: string | null;
    created_at: Date;
    updated_at: Date;
}>> {
    const values: unknown[] = [];
    let whereClause = '';

    if (search?.trim()) {
        values.push(`%${search.trim()}%`);
        whereClause = `WHERE (
            title ILIKE $1
            OR body ILIKE $1
            OR COALESCE(category, '') ILIKE $1
        )`;
    }

    const result = await query<QuickReplyRow>(
        `SELECT id, title, body, category, created_at, updated_at
         FROM quick_replies
         ${whereClause}
         ORDER BY category NULLS LAST, title ASC`,
        values
    );

    return result.rows;
}

export async function createQuickReply(input: {
    title: string;
    body: string;
    category?: string | null;
    createdBy: string;
}): Promise<QuickReplyRow> {
    const result = await query<QuickReplyRow>(
        `INSERT INTO quick_replies (title, body, category, created_by)
         VALUES ($1, $2, NULLIF($3, ''), $4)
         RETURNING id, title, body, category, created_at, updated_at`,
        [input.title, input.body, input.category ?? null, input.createdBy]
    );

    const row = result.rows[0];
    if (!row) {
        throw AppError.serviceUnavailable('INBOX_QUICK_REPLY_WRITE_FAILED', 'Não foi possível criar a mensagem pronta.');
    }

    return row;
}

export async function updateQuickReply(input: {
    id: string;
    title: string;
    body: string;
    category?: string | null;
}): Promise<QuickReplyRow> {
    const result = await query<QuickReplyRow>(
        `UPDATE quick_replies
         SET
           title = $2,
           body = $3,
           category = NULLIF($4, ''),
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, body, category, created_at, updated_at`,
        [input.id, input.title, input.body, input.category ?? null]
    );

    const row = result.rows[0];
    if (!row) {
        throw AppError.notFound('Mensagem pronta não encontrada.');
    }

    return row;
}

export async function deleteQuickReply(id: string): Promise<void> {
    const result = await query<{ id: string }>(
        `DELETE FROM quick_replies
         WHERE id = $1
         RETURNING id`,
        [id]
    );

    if (!result.rows[0]) {
        throw AppError.notFound('Mensagem pronta não encontrada.');
    }
}

export async function listChannelIntegrations(): Promise<Array<{
    id: string;
    channel: InboxChannel;
    is_active: boolean;
    webhook_url: string | null;
    created_at: Date;
    updated_at: Date;
}>> {
    const result = await query<ChannelIntegrationRow>(
        `SELECT id, channel, is_active, webhook_url, created_at, updated_at
         FROM channel_integrations
         ORDER BY
           CASE channel
             WHEN 'whatsapp' THEN 1
             WHEN 'instagram' THEN 2
             WHEN 'telegram' THEN 3
             WHEN 'tiktok' THEN 4
             ELSE 5
           END`
    );

    return result.rows;
}

export async function updateChannelIntegration(input: {
    channel: InboxChannel;
    isActive: boolean;
    webhookUrl?: string | null;
}): Promise<ChannelIntegrationRow> {
    const result = await query<ChannelIntegrationRow>(
        `UPDATE channel_integrations
         SET
           is_active = $2,
           webhook_url = COALESCE($3, webhook_url),
           updated_at = NOW()
         WHERE channel = $1::inbox_channel
         RETURNING id, channel, is_active, webhook_url, created_at, updated_at`,
        [input.channel, input.isActive, input.webhookUrl ?? null]
    );

    const row = result.rows[0];
    if (!row) {
        throw AppError.notFound('Integração de canal não encontrada.');
    }

    return row;
}

export async function saveConversationNote(
    conversationId: string,
    note: string,
    currentUser: CurrentUser
): Promise<void> {
    const result = await query(
        `UPDATE conversations
         SET internal_note = $2, updated_at = NOW()
         WHERE id = $1
           AND (
             $3 = 'ADMIN'
             OR assigned_to = $4
           )`,
        [conversationId, note.trim(), currentUser.role, currentUser.id]
    );

    if (result.rowCount === 0) {
        throw AppError.notFound('Conversa não encontrada ou sem permissão para editar nota.');
    }
}

export async function markConversationRead(
    conversationId: string,
    currentUser: CurrentUser
): Promise<void> {
    await query(
        `UPDATE conversations
         SET unread_count  = 0,
             last_read_at  = NOW(),
             last_read_by  = $2,
             updated_at    = NOW()
         WHERE id = $1`,
        [conversationId, currentUser.id]
    );
}

export async function getConversationNote(
    conversationId: string,
    currentUser: CurrentUser
): Promise<{ internal_note: string | null }> {
    const result = await query<{ internal_note: string | null }>(
        `SELECT internal_note
         FROM conversations
         WHERE id = $1
           AND (
             $2 = 'ADMIN'
             OR assigned_to = $3
             OR status = 'AGUARDANDO_HUMANO'
           )`,
        [conversationId, currentUser.role, currentUser.id]
    );

    const row = result.rows[0];
    if (!row) {
        throw AppError.notFound('Conversa não encontrada.');
    }

    return { internal_note: row.internal_note };
}
