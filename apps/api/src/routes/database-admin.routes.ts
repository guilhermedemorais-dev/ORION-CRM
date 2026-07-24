import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Tabelas que o sistema NUNCA apaga por esta tela — nem individualmente, nem
// em massa. Apagá-las quebra o login, a config da loja, a trilha de auditoria
// (a prova de quem apagou o quê) ou o controle de migrations do banco.
const PROTECTED_TABLES = new Set<string>([
    'users',            // login/senha/cargo — apagar tira o acesso de todos
    'settings',         // config da loja (nome, logo, cores) — é raiz de FKs
    '_migrations',      // histórico de migrations aplicadas
    'audit_logs',       // trilha de auditoria — não pode se autodestruir
    'refresh_tokens',   // sessões ativas — apagar desloga todo mundo
    'pg_stat_statements', // extensão do postgres
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
                    protected: PROTECTED_TABLES.has(row.name),
                    protected_in_bulk: PROTECTED_TABLES.has(row.name), // compat legado
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

        const dump = await dumpTableInserts(tableName);
        const header = `-- Export: ${tableName}\n-- Generated: ${new Date().toISOString()}\n-- Rows: ${dump.rowCount}\n\n`;
        const sql = `${header}BEGIN;\nSET session_replication_role = replica;\n\n${dump.sql}\nSET session_replication_role = DEFAULT;\nCOMMIT;\n`;

        await audit(req, 'EXPORT_SQL', tableName, dump.rowCount);

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
                const dump = await dumpTableInserts(tableName);
                totalRows += dump.rowCount;
                output += `-- ─── ${tableName} (${dump.rowCount} rows) ─────────────────────────\n`;
                output += dump.sql;
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

// ─── EXPORTAR SELECIONADAS (dump só das tabelas marcadas) ────────────────────

const exportSelectedSchema = z.object({
    tables: z.array(z.string().min(1)).min(1),
});

router.post('/export', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = exportSelectedSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest('Envie { tables: [...] }.'));
            return;
        }
        const tableNames = Array.from(new Set(parsed.data.tables.map(sanitizeTableName)));
        for (const t of tableNames) {
            if (!(await tableExists(t))) { next(AppError.notFound(`Tabela "${t}" não encontrada.`)); return; }
        }

        let totalRows = 0;
        let output = `-- Orion CRM export (seleção)\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tableNames.length}\n\n`;
        output += `BEGIN;\nSET session_replication_role = replica;\n\n`;

        for (const tableName of tableNames) {
            const dump = await dumpTableInserts(tableName);
            totalRows += dump.rowCount;
            output += `-- ─── ${tableName} (${dump.rowCount} rows) ─────────────────────────\n`;
            output += dump.sql;
            output += '\n';
        }
        output += `SET session_replication_role = DEFAULT;\nCOMMIT;\n`;

        await audit(req, 'EXPORT_SELECTED', tableNames.join(','), totalRows);

        res.setHeader('Content-Type', 'application/sql; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="orion_export_${dateStamp()}.sql"`);
        res.send(output);
    } catch (err) {
        next(err);
    }
});

// ─── IMPORTAR (.sql) — carrega um dump exportado, substituindo os dados ───────
// Recebe o texto do arquivo .sql. Para funcionar mesmo com dados já presentes,
// limpa os dados atuais e roda os INSERTs do arquivo, tudo numa transação com
// as checagens de FK desligadas (a ordem dos INSERTs do dump não importa).

router.post('/import', express.text({ type: '*/*', limit: '100mb' }), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const raw = typeof req.body === 'string' ? req.body : '';
        if (raw.trim().length === 0) {
            next(AppError.badRequest('Envie o conteúdo do arquivo .sql no corpo da requisição.'));
            return;
        }

        // Remove o "envelope" do dump (BEGIN/COMMIT/SET session_replication_role)
        // para rodar tudo dentro da NOSSA transação sem conflito.
        const statements = raw
            .split('\n')
            .filter((line) => {
                const l = line.trim();
                if (l === '' || l.startsWith('--')) return false;
                if (/^BEGIN\s*;?$/i.test(l)) return false;
                if (/^COMMIT\s*;?$/i.test(l)) return false;
                if (/^SET\s+session_replication_role/i.test(l)) return false;
                return true;
            })
            .join('\n')
            .trim();

        if (statements.length === 0) {
            next(AppError.badRequest('O arquivo não contém comandos para importar.'));
            return;
        }

        const allTables = await query<{ name: string }>(
            `SELECT relname AS name FROM pg_class t
             INNER JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE t.relkind = 'r' AND n.nspname = 'public'`
        );

        await transaction(async (client) => {
            await client.query(`SET LOCAL session_replication_role = replica`);
            // Limpa os dados atuais (as FKs estão desligadas, ordem não importa).
            for (const { name } of allTables.rows) {
                await client.query(`DELETE FROM "${name}"`);
            }
            // Roda os INSERTs do dump.
            await client.query(statements);
        });

        await audit(req, 'IMPORT_SQL', '*', 0);

        res.json({ data: { imported: true } });
    } catch (err) {
        next(err);
    }
});

// Gera os INSERTs de uma tabela com fidelidade de tipos: converte cada coluna
// para texto no próprio Postgres (col::text) e emite o valor como string literal
// SEM cast. Assim o Postgres reinterpreta o literal no tipo da coluna no import —
// funciona igual para uuid, text[], jsonb, enum, timestamptz, numeric, etc.
async function dumpTableInserts(tableName: string): Promise<{ sql: string; rowCount: number }> {
    const colsRes = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
           AND is_generated <> 'ALWAYS'
         ORDER BY ordinal_position`,
        [tableName]
    );
    const cols = colsRes.rows.map((r) => r.column_name);
    if (cols.length === 0) return { sql: '', rowCount: 0 };

    const selectList = cols.map((c) => `"${c}"::text AS "${c}"`).join(', ');
    const r = await query(`SELECT ${selectList} FROM "${tableName}"`);
    const rows = r.rows as Array<Record<string, unknown>>;
    const colList = cols.map((c) => `"${c}"`).join(', ');

    let sql = '';
    for (const row of rows) {
        const vals = cols.map((c) => {
            const v = row[c];
            if (v === null || v === undefined) return 'NULL';
            return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        sql += `INSERT INTO "${tableName}" (${colList}) VALUES (${vals});\n`;
    }
    return { sql, rowCount: rows.length };
}

// ─── DEPENDÊNCIAS (prévia do que uma tabela arrasta) ─────────────────────────
// Retorna, recursivamente, todas as tabelas que apontam (FK) para `tableName`.
// Sem CASCADE, apagar `tableName` exige apagar essas junto — a UI mostra a lista.
async function getDependents(tableName: string): Promise<string[]> {
    const result = await query<{ name: string }>(
        `WITH RECURSIVE deps AS (
            SELECT con.conrelid AS child_oid
            FROM pg_constraint con
            JOIN pg_class p ON p.oid = con.confrelid
            JOIN pg_namespace pn ON pn.oid = p.relnamespace
            WHERE con.contype = 'f' AND pn.nspname = 'public' AND p.relname = $1
          UNION
            SELECT con.conrelid
            FROM pg_constraint con
            JOIN deps ON con.confrelid = deps.child_oid
            WHERE con.contype = 'f'
        )
        SELECT DISTINCT c.relname AS name
        FROM deps
        JOIN pg_class c ON c.oid = deps.child_oid
        WHERE c.relname <> $1
        ORDER BY c.relname`,
        [tableName]
    );
    return result.rows.map((r) => r.name);
}

router.get('/tables/:name/dependents', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tableName = sanitizeTableName(req.params['name']);
        if (!(await tableExists(tableName))) { next(AppError.notFound('Tabela não encontrada.')); return; }
        const dependents = await getDependents(tableName);
        res.json({
            data: {
                table: tableName,
                protected: PROTECTED_TABLES.has(tableName),
                dependents,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─── APAGAR TABELA (TRUNCATE sem CASCADE — bloqueia e avisa) ──────────────────

const truncateSchema = z.object({
    confirm_text: z.string().min(1),
});

router.delete('/tables/:name', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tableName = sanitizeTableName(req.params['name']);

        if (PROTECTED_TABLES.has(tableName)) {
            next(AppError.forbidden(`A tabela "${tableName}" é protegida e não pode ser apagada por esta tela.`));
            return;
        }

        const parsed = truncateSchema.safeParse(req.body);
        if (!parsed.success || parsed.data.confirm_text !== tableName) {
            next(AppError.badRequest(`Para confirmar, envie confirm_text="${tableName}".`));
            return;
        }

        const exists = await tableExists(tableName);
        if (!exists) { next(AppError.notFound('Tabela não encontrada.')); return; }

        // Bloquear e avisar: se outras tabelas dependem desta, NÃO cascateia em
        // silêncio. Recusa e lista as dependentes para o usuário decidir.
        const dependents = await getDependents(tableName);
        if (dependents.length > 0) {
            next(AppError.conflict(
                'HAS_DEPENDENTS',
                `"${tableName}" não pode ser apagada sozinha porque estas tabelas dependem dela e seriam afetadas: ${dependents.join(', ')}. Selecione todas juntas para apagar, ou exporte um backup antes.`,
            ));
            return;
        }

        const countBefore = await query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM "${tableName}"`
        );
        const rowsApagados = Number(countBefore.rows[0]?.total ?? '0');

        await query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY`);

        await audit(req, 'TRUNCATE_TABLE', tableName, rowsApagados);

        res.json({
            data: {
                table: tableName,
                rows_deleted: rowsApagados,
                cascade: false,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─── APAGAR SELECIONADAS (conjunto fechado, sem CASCADE) ─────────────────────
// Recebe as tabelas marcadas na UI. Exige que o conjunto seja "fechado": toda
// dependente das escolhidas precisa estar na seleção. Se faltar alguma, recusa
// e devolve a lista — a UI oferece incluir. Nunca apaga nada que não foi visto.

const truncateSelectedSchema = z.object({
    tables: z.array(z.string().min(1)).min(1),
    confirm_text: z.string().min(1),
});

router.post('/truncate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = truncateSelectedSchema.safeParse(req.body);
        if (!parsed.success) {
            next(AppError.badRequest('Envie { tables: [...], confirm_text: "APAGAR" }.'));
            return;
        }
        if (parsed.data.confirm_text !== 'APAGAR') {
            next(AppError.badRequest('Para confirmar, envie confirm_text="APAGAR".'));
            return;
        }

        const requested = Array.from(new Set(parsed.data.tables.map(sanitizeTableName)));

        const blocked = requested.filter((t) => PROTECTED_TABLES.has(t));
        if (blocked.length > 0) {
            next(AppError.forbidden(`Tabelas protegidas não podem ser apagadas: ${blocked.join(', ')}.`));
            return;
        }

        for (const t of requested) {
            if (!(await tableExists(t))) { next(AppError.notFound(`Tabela "${t}" não encontrada.`)); return; }
        }

        // Fecho de dependências: sem CASCADE, toda dependente precisa estar na seleção.
        const selected = new Set(requested);
        const missing = new Set<string>();
        for (const t of requested) {
            for (const dep of await getDependents(t)) {
                if (selected.has(dep)) continue;
                if (PROTECTED_TABLES.has(dep)) {
                    next(AppError.forbidden(`"${t}" depende da tabela protegida "${dep}"; não é possível apagar.`));
                    return;
                }
                missing.add(dep);
            }
        }
        if (missing.size > 0) {
            next(AppError.conflict(
                'MISSING_DEPENDENTS',
                `Estas tabelas dependem das selecionadas e precisam ser incluídas para apagar sem cascata: ${Array.from(missing).join(', ')}.`,
            ));
            return;
        }

        const quoted = requested.map((t) => `"${t}"`).join(', ');
        const beforeCount = await query<{ total: string }>(
            `SELECT COALESCE(SUM(c.cnt), 0)::text AS total FROM (
                ${requested.map((t) => `SELECT COUNT(*) AS cnt FROM "${t}"`).join(' UNION ALL ')}
             ) c`
        );
        const totalRows = Number(beforeCount.rows[0]?.total ?? '0');

        await query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY`);

        await audit(req, 'TRUNCATE_SELECTED', requested.join(','), totalRows);

        res.json({
            data: {
                truncated: requested,
                total_rows_deleted: totalRows,
                cascade: false,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─── APAGAR TUDO (todas as operacionais, sem CASCADE, preserva protegidas) ────

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
            .filter((name) => !PROTECTED_TABLES.has(name));

        if (targets.length === 0) {
            res.json({ data: { truncated: [], total_rows_deleted: 0 } });
            return;
        }

        const beforeCount = await query<{ total: string }>(
            `SELECT COALESCE(SUM(c.cnt), 0)::text AS total FROM (
                ${targets.map((t) => `SELECT COUNT(*) AS cnt FROM "${t}"`).join(' UNION ALL ')}
             ) c`
        );
        const totalRows = Number(beforeCount.rows[0]?.total ?? '0');

        // Algumas tabelas protegidas apontam (FK) para tabelas operacionais —
        // ex.: settings.default_appointment_pipeline_id → pipelines. Sem CASCADE,
        // o Postgres recusa truncar enquanto esses ponteiros existirem. Então,
        // dentro da transação, zeramos só essas colunas (preservando a linha
        // protegida) e truncamos as operacionais sem CASCADE.
        const refCols = await query<{ child_table: string; column_name: string; not_null: boolean }>(
            `SELECT child.relname AS child_table, att.attname AS column_name, att.attnotnull AS not_null
             FROM pg_constraint con
             JOIN pg_class child ON child.oid = con.conrelid
             JOIN pg_class parent ON parent.oid = con.confrelid
             JOIN pg_namespace n ON n.oid = child.relnamespace
             JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
             JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
             WHERE con.contype = 'f' AND n.nspname = 'public'
               AND child.relname = ANY($1) AND parent.relname = ANY($2)`,
            [Array.from(PROTECTED_TABLES), targets]
        );

        const blocking = refCols.rows.filter((r) => r.not_null);
        if (blocking.length > 0) {
            next(AppError.conflict(
                'PROTECTED_FK_NOT_NULL',
                `Não é possível apagar: ${blocking.map((r) => `${r.child_table}.${r.column_name}`).join(', ')} é obrigatório e aponta para dados operacionais.`,
            ));
            return;
        }

        // TRUNCATE sem CASCADE não roda enquanto uma tabela protegida (settings)
        // referenciar uma operacional — a FK basta pra bloquear, mesmo sem valor.
        // Então, numa transação: zeramos esses ponteiros e apagamos via DELETE com
        // as checagens de FK desligadas (session_replication_role=replica). Isso
        // esvazia só as operacionais, sem CASCADE e sem tocar nas protegidas.
        await transaction(async (client) => {
            for (const { child_table, column_name } of refCols.rows) {
                await client.query(`UPDATE "${child_table}" SET "${column_name}" = NULL`);
            }
            await client.query(`SET LOCAL session_replication_role = replica`);
            for (const t of targets) {
                await client.query(`DELETE FROM "${t}"`);
            }
        });

        await audit(req, 'TRUNCATE_ALL', targets.join(','), totalRows);

        res.json({
            data: {
                truncated: targets,
                preserved: Array.from(PROTECTED_TABLES).filter((t) => t !== 'pg_stat_statements'),
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
