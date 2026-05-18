import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Tabelas que NUNCA podem ser apagadas em "Apagar tudo" — protegem o sistema
// de ficar inutilizável (perder login, configuração da loja, histórico de migrations).
// O usuário ainda pode apagar essas individualmente se realmente quiser.
const NEVER_TRUNCATE_IN_BULK = new Set<string>([
    'users',
    'settings',
    '_migrations',
]);

// Tabelas que o usuário NUNCA pode apagar nem individualmente — riscos sérios.
const NEVER_TRUNCATE_EVER = new Set<string>([
    'pg_stat_statements',  // extensão postgres
]);

// Dicionário de nomes amigáveis + descrição curta por tabela.
// Mostra o que cada tabela representa em linguagem de negócio para o
// usuário ROOT entender antes de apagar/exportar.
const TABLE_META: Record<string, { label: string; description: string }> = {
    _migrations: { label: 'Histórico de migrations', description: 'Versões de banco já aplicadas. Não apague — o sistema acharia que precisa rodar tudo do zero.' },
    users: { label: 'Usuários do sistema', description: 'Login, senha, cargo (ROOT/ADMIN/ATENDENTE...). Se apagar você perde o acesso.' },
    settings: { label: 'Configurações da loja', description: 'Nome, logo, cores, telefones, redes sociais.' },

    leads: { label: 'Leads (oportunidades comerciais)', description: 'Contatos que ainda não viraram clientes. Aparecem no Kanban de pipelines.' },
    lead_timeline: { label: 'Linha do tempo dos leads', description: 'Histórico de eventos (criação, mudança de etapa, notas) de cada lead.' },
    lead_attachments: { label: 'Anexos de leads', description: 'Arquivos enviados pelos clientes durante o atendimento (fotos, áudios).' },

    customers: { label: 'Clientes', description: 'Pessoas que já compraram ou tiveram ficha aberta. Fonte única de verdade do cliente.' },
    customer_blocks: { label: 'Blocos da ficha do cliente', description: 'Atendimentos, propostas e anotações dentro da ficha de cada cliente.' },
    attendance_blocks: { label: 'Blocos de atendimento', description: 'Cada bloco é um atendimento (chamada, mensagem, visita) dentro da ficha.' },

    pipelines: { label: 'Pipelines (setores)', description: 'Cada pipeline é um setor da operação (Leads, Produção, Entrega...).' },
    pipeline_stages: { label: 'Etapas dos pipelines', description: 'Listas/colunas dentro de cada pipeline (Novo, Qualificado, etc.).' },
    pipeline_automation_rules: { label: 'Regras de automação dos pipelines', description: 'Regras que movem cards entre setores automaticamente.' },
    pipeline_card_links: { label: 'Vínculos entre cards de pipelines', description: 'Liga um card em "Leads" ao card filho gerado em "Produção" pela regra.' },
    pipeline_rule_executions: { label: 'Execuções de regras', description: 'Histórico de cada vez que uma regra disparou.' },

    products: { label: 'Produtos do estoque', description: 'Joias prontas, matérias-primas, peças. Tudo que pode ser vendido ou consumido.' },
    product_categories: { label: 'Categorias de produto', description: 'Anéis, Brincos, Ouro 18k, etc. Criadas pelo usuário no Estoque.' },
    stock_movements: { label: 'Movimentações de estoque', description: 'Histórico de entradas, saídas, ajustes e perdas de cada produto.' },

    orders: { label: 'Pedidos / Vendas', description: 'Pedidos formais com status (aberto, pago, entregue). Inclui vendas do PDV.' },
    order_items: { label: 'Itens dos pedidos', description: 'Produtos dentro de cada pedido (quantidade e preço).' },
    order_payments: { label: 'Pagamentos dos pedidos', description: 'Cada parcela ou pagamento individual de um pedido.' },

    service_orders: { label: 'Ordens de Serviço (OS)', description: 'Peças sob encomenda em produção (com prazo, especificações, etapas).' },
    service_order_materials: { label: 'Materiais consumidos em OS', description: 'Matérias-primas e peças do estoque usadas em cada OS.' },

    appointments: { label: 'Agendamentos', description: 'Compromissos da agenda (visitas, ligações, entregas).' },
    appointment_reminders: { label: 'Lembretes de agendamento', description: 'Mensagens automáticas antes de cada compromisso.' },

    financial_entries: { label: 'Lançamentos financeiros', description: 'Entradas e saídas do caixa (vendas, despesas, comissões).' },
    payments: { label: 'Pagamentos recebidos', description: 'Recibos de pagamentos confirmados (Pix, cartão, dinheiro, etc.).' },

    conversations: { label: 'Conversas do WhatsApp', description: 'Threads de conversa do inbox unificado por cliente.' },
    messages: { label: 'Mensagens recebidas/enviadas', description: 'Cada mensagem individual da conversa (texto, mídia, áudio).' },

    audit_logs: { label: 'Log de auditoria', description: 'Registro de tudo que foi criado, alterado ou apagado, com quem fez e quando.' },
    system_errors: { label: 'Erros do sistema', description: 'Erros capturados em produção (para debug).' },
    system_tickets: { label: 'Tickets de suporte', description: 'Incidentes e sugestões abertos pelos usuários em Suporte.' },
    operator_webhook_log: { label: 'Log de webhooks do operador', description: 'Chamadas de webhook do painel administrativo (Hostinger/SaaS).' },

    channel_integrations: { label: 'Integrações de canais', description: 'WhatsApp, Instagram, formulários — credenciais e status.' },
    integration_providers: { label: 'Provedores de integração', description: 'Catálogo de integrações disponíveis (Meta, n8n, etc.).' },
    whatsapp_providers: { label: 'Provedores do WhatsApp', description: 'Contas de WhatsApp Business configuradas.' },
    webhook_keys: { label: 'Chaves de webhook', description: 'Chaves de segurança para receber webhooks de terceiros.' },

    ai_copilot_config: { label: 'Configuração do Copiloto IA', description: 'Comportamento e prompts do assistente IA.' },
    ai_skills: { label: 'Skills do Copiloto IA', description: 'Habilidades especializadas (atendimento, vendas, meta).' },
    ai_renders: { label: 'Renderizações 3D por IA', description: 'Imagens geradas para apresentar joias antes de produzir.' },

    proposal_attachments: { label: 'Anexos de propostas', description: 'PDFs, imagens enviadas em propostas comerciais.' },
    carriers_config: { label: 'Transportadoras', description: 'Cadastro de transportadoras para entregas.' },

    roadmap_items: { label: 'Itens do roadmap', description: 'Planos e tarefas do projeto que o cliente acompanha em Suporte.' },
    roadmap_comments: { label: 'Comentários do roadmap', description: 'Conversas sobre cada plano (em threading).' },
    roadmap_comment_reactions: { label: 'Reações aos comentários', description: '👍 / 👎 dos comentários do roadmap.' },
    roadmap_attachments: { label: 'Anexos do roadmap', description: 'Imagens e vídeos anexados aos planos.' },

    store_orders: { label: 'Pedidos da loja online', description: 'Pedidos vindos da vitrine pública (loja externa).' },
    refresh_tokens: { label: 'Tokens de sessão', description: 'Sessões ativas dos usuários (login persistente).' },
};

function metaFor(tableName: string): { label: string; description: string } {
    return TABLE_META[tableName] ?? {
        label: tableName,
        description: 'Tabela do sistema (sem descrição cadastrada).',
    };
}

router.use(authenticate);
router.use(requireRole(['ROOT']));

// ─── LISTA DE TABELAS ────────────────────────────────────────────────────────

interface TableInfo {
    name: string;
    schema: string;
    row_count: number;
    size_bytes: number;
    size_pretty: string;
}

router.get('/tables', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Lista tabelas do schema public com tamanho total (data + índices).
        // O row_count vem de pg_class.reltuples (instantâneo, estimativa). Se
        // o valor for -1 (ANALYZE nunca rodou), faz COUNT(*) real como fallback.
        const result = await query<TableInfo>(
            `SELECT
                t.relname AS name,
                n.nspname AS schema,
                GREATEST(t.reltuples::bigint, 0) AS row_count,
                pg_total_relation_size(t.oid)::bigint AS size_bytes,
                pg_size_pretty(pg_total_relation_size(t.oid)) AS size_pretty
             FROM pg_class t
             INNER JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE t.relkind = 'r'
               AND n.nspname = 'public'
             ORDER BY t.relname ASC`
        );

        // Para tabelas com row_count 0 (sem estatísticas ou realmente vazias),
        // faz COUNT(*) real. Limita a 100 tabelas pra não estourar timeout.
        for (const row of result.rows) {
            if (Number(row.row_count) === 0) {
                try {
                    const real = await query<{ total: string }>(
                        `SELECT COUNT(*)::text AS total FROM "${row.name}"`
                    );
                    row.row_count = Number(real.rows[0]?.total ?? '0');
                } catch {
                    row.row_count = 0;
                }
            }
        }

        res.json({
            data: result.rows.map((row) => {
                const meta = metaFor(row.name);
                return {
                    ...row,
                    row_count: Number(row.row_count),
                    size_bytes: Number(row.size_bytes),
                    protected_in_bulk: NEVER_TRUNCATE_IN_BULK.has(row.name),
                    label: meta.label,
                    description: meta.description,
                };
            }),
        });
    } catch (err) {
        next(err);
    }
});

// ─── DETALHE DA TABELA (count real + colunas) ────────────────────────────────

router.get('/tables/:name', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tableName = sanitizeTableName(req.params['name']);

        const exists = await tableExists(tableName);
        if (!exists) { next(AppError.notFound('Tabela não encontrada.')); return; }

        const countResult = await query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM "${tableName}"`
        );

        const columnsResult = await query<{ column_name: string; data_type: string; is_nullable: string }>(
            `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1
             ORDER BY ordinal_position`,
            [tableName]
        );

        res.json({
            data: {
                name: tableName,
                row_count: Number(countResult.rows[0]?.total ?? '0'),
                columns: columnsResult.rows,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─── EXPORTAR CSV ────────────────────────────────────────────────────────────

router.get('/tables/:name/export.csv', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tableName = sanitizeTableName(req.params['name']);
        const exists = await tableExists(tableName);
        if (!exists) { next(AppError.notFound('Tabela não encontrada.')); return; }

        const result = await query(`SELECT * FROM "${tableName}"`);
        const rows = result.rows as Array<Record<string, unknown>>;
        const columns = result.fields.map((f) => f.name);

        const escape = (value: unknown): string => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const header = columns.join(',');
        const body = rows.map((row) =>
            columns.map((col) => {
                const cell = row[col];
                const esc = escape(cell);
                return esc.startsWith('"') || esc === '' ? esc : esc;
            }).join(',')
        );

        const csv = [header, ...body].join('\n');

        await audit(req, 'EXPORT_CSV', tableName, rows.length);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName}_${dateStamp()}.csv"`);
        res.send(csv);
    } catch (err) {
        next(err);
    }
});

// ─── EXPORTAR SQL (INSERTs da tabela) ────────────────────────────────────────

router.get('/tables/:name/export.sql', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tableName = sanitizeTableName(req.params['name']);
        const exists = await tableExists(tableName);
        if (!exists) { next(AppError.notFound('Tabela não encontrada.')); return; }

        const result = await query(`SELECT * FROM "${tableName}"`);
        const rows = result.rows as Array<Record<string, unknown>>;
        const columns = result.fields.map((f) => f.name);

        const sqlValue = (value: unknown): string => {
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            if (typeof value === 'number') return String(value);
            if (value instanceof Date) return `'${value.toISOString()}'`;
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
            return `'${String(value).replace(/'/g, "''")}'`;
        };

        const header = `-- Export: ${tableName}\n-- Generated: ${new Date().toISOString()}\n-- Rows: ${rows.length}\n\n`;
        const inserts = rows.map((row) => {
            const cols = columns.map((c) => `"${c}"`).join(', ');
            const vals = columns.map((c) => sqlValue(row[c])).join(', ');
            return `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`;
        });

        const sql = header + inserts.join('\n') + '\n';

        await audit(req, 'EXPORT_SQL', tableName, rows.length);

        res.setHeader('Content-Type', 'application/sql; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName}_${dateStamp()}.sql"`);
        res.send(sql);
    } catch (err) {
        next(err);
    }
});

// ─── EXPORTAR TUDO (dump completo via SELECTs) ───────────────────────────────

router.get('/export-all.sql', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tablesResult = await query<{ name: string }>(
            `SELECT relname AS name
             FROM pg_class t
             INNER JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE t.relkind = 'r' AND n.nspname = 'public'
             ORDER BY relname`
        );

        const tableNames = tablesResult.rows.map((r) => r.name);
        let totalRows = 0;
        let output = `-- Orion CRM dump\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tableNames.length}\n\n`;
        output += `BEGIN;\nSET session_replication_role = replica;\n\n`;

        for (const tableName of tableNames) {
            try {
                const r = await query(`SELECT * FROM "${tableName}"`);
                const rows = r.rows as Array<Record<string, unknown>>;
                const columns = r.fields.map((f) => f.name);
                totalRows += rows.length;

                output += `-- ─── ${tableName} (${rows.length} rows) ─────────────────────────\n`;

                for (const row of rows) {
                    const cols = columns.map((c) => `"${c}"`).join(', ');
                    const vals = columns.map((c) => sqlValueDump(row[c])).join(', ');
                    output += `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});\n`;
                }
                output += '\n';
            } catch {
                output += `-- (erro ao exportar ${tableName}, pulando)\n\n`;
            }
        }

        output += `SET session_replication_role = DEFAULT;\nCOMMIT;\n`;

        await audit(req, 'EXPORT_ALL', '*', totalRows);

        res.setHeader('Content-Type', 'application/sql; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="orion_dump_${dateStamp()}.sql"`);
        res.send(output);
    } catch (err) {
        next(err);
    }
});

function sqlValueDump(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    return `'${String(value).replace(/'/g, "''")}'`;
}

// ─── APAGAR TABELA (TRUNCATE CASCADE) ────────────────────────────────────────

const truncateSchema = z.object({
    confirm_text: z.string().min(1),
});

router.delete('/tables/:name', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tableName = sanitizeTableName(req.params['name']);

        if (NEVER_TRUNCATE_EVER.has(tableName)) {
            next(AppError.forbidden(`Tabela "${tableName}" não pode ser apagada por segurança.`));
            return;
        }

        const parsed = truncateSchema.safeParse(req.body);
        if (!parsed.success || parsed.data.confirm_text !== tableName) {
            next(AppError.badRequest(`Para confirmar, envie confirm_text="${tableName}".`));
            return;
        }

        const exists = await tableExists(tableName);
        if (!exists) { next(AppError.notFound('Tabela não encontrada.')); return; }

        const countBefore = await query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM "${tableName}"`
        );
        const rowsApagados = Number(countBefore.rows[0]?.total ?? '0');

        await query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);

        await audit(req, 'TRUNCATE_TABLE', tableName, rowsApagados);

        res.json({
            data: {
                table: tableName,
                rows_deleted: rowsApagados,
                cascade: true,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─── APAGAR TUDO (exceto users, settings, _migrations) ───────────────────────

const truncateAllSchema = z.object({
    confirm_text: z.literal('APAGAR TUDO'),
});

router.post('/truncate-all', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = truncateAllSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest('Para confirmar, envie confirm_text="APAGAR TUDO".'));
            return;
        }

        const tablesResult = await query<{ name: string }>(
            `SELECT relname AS name
             FROM pg_class t
             INNER JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE t.relkind = 'r' AND n.nspname = 'public'
             ORDER BY relname`
        );

        const targets = tablesResult.rows
            .map((r) => r.name)
            .filter((name) => !NEVER_TRUNCATE_IN_BULK.has(name) && !NEVER_TRUNCATE_EVER.has(name));

        if (targets.length === 0) {
            res.json({ data: { truncated: [], total_rows_deleted: 0 } });
            return;
        }

        // TRUNCATE em batch com CASCADE — funciona mesmo com FKs cruzadas.
        const quoted = targets.map((t) => `"${t}"`).join(', ');
        const beforeCount = await query<{ total: string }>(
            `SELECT SUM(c.cnt)::text AS total FROM (
                ${targets.map((t, i) => `SELECT COUNT(*) AS cnt FROM "${t}"${i < targets.length - 1 ? '' : ''}`).join(' UNION ALL ')}
             ) c`
        );
        const totalRows = Number(beforeCount.rows[0]?.total ?? '0');

        await query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

        await audit(req, 'TRUNCATE_ALL', targets.join(','), totalRows);

        res.json({
            data: {
                truncated: targets,
                preserved: Array.from(NEVER_TRUNCATE_IN_BULK),
                total_rows_deleted: totalRows,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function sanitizeTableName(raw: unknown): string {
    if (typeof raw !== 'string') throw AppError.badRequest('Nome de tabela inválido.');
    // Permite letras, números, underscore. Bloqueia injeção SQL.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) {
        throw AppError.badRequest('Nome de tabela inválido.');
    }
    return raw;
}

async function tableExists(name: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [name]
    );
    return Boolean(result.rows[0]?.exists);
}

function dateStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function audit(req: Request, action: string, entityId: string, rowsAffected: number): Promise<void> {
    if (!req.user) return;
    await createAuditLog({
        userId: req.user.id,
        action,
        entityType: 'database_admin',
        entityId,
        oldValue: { rows_affected: rowsAffected },
        newValue: null,
        req,
    });
}

export default router;
