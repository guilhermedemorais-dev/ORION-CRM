'use client';

// Aba "Banco de Dados" em Ajustes — só ROOT.
// Lista tabelas, permite exportar (CSV/SQL/dump completo) e apagar dados.
//
// Segurança (pós-incidente): NÃO usa mais TRUNCATE CASCADE. Apagar uma tabela
// que tem dependentes é BLOQUEADO — o usuário marca as tabelas na lista e a
// prévia mostra exatamente o que será afetado antes de confirmar. Tabelas
// críticas (users, settings, _migrations, audit_logs, refresh_tokens) são
// protegidas e não aparecem com opção de apagar.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, FileText, Trash2, RefreshCw, AlertTriangle, Database, Search, Loader2 } from 'lucide-react';

interface TableRow {
    name: string;
    schema: string;
    row_count: number;
    size_bytes: number;
    size_pretty: string;
    protected: boolean;
    label: string;
    description: string;
}

function fmtNumber(n: number): string {
    return new Intl.NumberFormat('pt-BR').format(n);
}

const API = '/api/internal/admin/database';

export function BancoDadosTab() {
    const [tables, setTables] = useState<TableRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showOnlyWithData, setShowOnlyWithData] = useState(true);
    const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

    // Modal de apagar seleção: guarda o "fecho" (tabelas marcadas + dependentes).
    const [deleteModal, setDeleteModal] = useState<{
        requested: string[];
        dependents: string[];      // dependentes que serão incluídos junto
        rows: number;              // total de registros afetados
        loadingPreview: boolean;
    } | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [confirmingAll, setConfirmingAll] = useState(false);

    const showToast = useCallback((kind: 'success' | 'error', msg: string) => {
        setToast({ kind, msg });
        setTimeout(() => setToast(null), 5000);
    }, []);

    const fetchTables = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/tables`);
            if (!res.ok) throw new Error('Falha ao carregar tabelas');
            const data = await res.json();
            setTables(Array.isArray(data?.data) ? data.data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchTables(); }, [fetchTables]);

    const byName = useMemo(() => {
        const m = new Map<string, TableRow>();
        for (const t of tables) m.set(t.name, t);
        return m;
    }, [tables]);

    const filtered = useMemo(() => {
        let list = tables;
        if (showOnlyWithData) list = list.filter((t) => t.row_count > 0);
        const q = query.trim().toLowerCase();
        if (q) {
            list = list.filter((t) =>
                t.name.toLowerCase().includes(q) ||
                t.label.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q),
            );
        }
        return list;
    }, [tables, query, showOnlyWithData]);

    const totalRows = tables.reduce((sum, t) => sum + t.row_count, 0);
    const totalSize = tables.reduce((sum, t) => sum + t.size_bytes, 0);

    // Tabelas marcáveis na lista filtrada (não protegidas e com dados).
    const selectableInView = filtered.filter((t) => !t.protected && t.row_count > 0);
    const allInViewSelected = selectableInView.length > 0 && selectableInView.every((t) => selected.has(t.name));

    const toggle = (name: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const toggleAllInView = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allInViewSelected) {
                for (const t of selectableInView) next.delete(t.name);
            } else {
                for (const t of selectableInView) next.add(t.name);
            }
            return next;
        });
    };

    const exportTable = (table: string, format: 'csv' | 'sql') => {
        window.location.href = `${API}/tables/${table}/export.${format}`;
    };

    const exportAll = () => {
        window.location.href = `${API}/export-all.sql`;
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importConfirm, setImportConfirm] = useState<{ fileName: string; text: string } | null>(null);

    // Baixa um .sql só com as tabelas marcadas.
    const exportSelected = async () => {
        try {
            const res = await fetch(`${API}/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tables: Array.from(selected) }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => null);
                throw new Error(d?.message ?? 'Falha ao exportar');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orion_export_${new Date().toISOString().slice(0, 10)}.sql`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro');
        }
    };

    // Usuário escolheu um arquivo → guarda e abre confirmação (import substitui dados).
    const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setImportConfirm({ fileName: file.name, text: '' });
    };

    const confirmImport = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file || !importConfirm || importConfirm.text !== 'IMPORTAR') {
            showToast('error', 'Digite "IMPORTAR" para confirmar.');
            return;
        }
        setBusy(true);
        try {
            const sql = await file.text();
            const res = await fetch(`${API}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: sql,
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message ?? 'Falha ao importar');
            showToast('success', 'Importação concluída — dados substituídos pelo arquivo.');
            setImportConfirm(null);
            setSelected(new Set());
            await fetchTables();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro');
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Abre o modal de apagar para um conjunto de tabelas, buscando os dependentes
    // (a prévia do que será afetado) antes de mostrar o botão de confirmar.
    const openDeleteModal = useCallback(async (requested: string[]) => {
        setConfirmText('');
        setDeleteModal({ requested, dependents: [], rows: 0, loadingPreview: true });
        try {
            const depSets = await Promise.all(
                requested.map(async (name) => {
                    const res = await fetch(`${API}/tables/${name}/dependents`);
                    if (!res.ok) return [] as string[];
                    const data = await res.json();
                    return (data?.data?.dependents ?? []) as string[];
                }),
            );
            const reqSet = new Set(requested);
            const deps = new Set<string>();
            for (const set of depSets) {
                for (const d of set) if (!reqSet.has(d)) deps.add(d);
            }
            const dependents = Array.from(deps).sort();
            const affected = new Set([...requested, ...dependents]);
            const rows = Array.from(affected).reduce((sum, n) => sum + (byName.get(n)?.row_count ?? 0), 0);
            setDeleteModal({ requested, dependents, rows, loadingPreview: false });
        } catch {
            setDeleteModal({ requested, dependents: [], rows: 0, loadingPreview: false });
        }
    }, [byName]);

    const confirmDelete = async () => {
        if (!deleteModal || confirmText !== 'APAGAR') {
            showToast('error', 'Digite "APAGAR" para confirmar.');
            return;
        }
        // Conjunto fechado = marcadas + dependentes (o backend exige isso).
        const tablesToDrop = [...deleteModal.requested, ...deleteModal.dependents];
        const protectedHit = tablesToDrop.filter((n) => byName.get(n)?.protected);
        if (protectedHit.length > 0) {
            showToast('error', `Não é possível: depende de tabela protegida (${protectedHit.join(', ')}).`);
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(`${API}/truncate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tables: tablesToDrop, confirm_text: 'APAGAR' }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message ?? 'Falha ao apagar');
            showToast('success', `${data.data.truncated.length} tabela(s) zerada(s), ${fmtNumber(data.data.total_rows_deleted)} registros apagados.`);
            setDeleteModal(null);
            setConfirmText('');
            setSelected(new Set());
            await fetchTables();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro');
        } finally {
            setBusy(false);
        }
    };

    const truncateAll = async () => {
        if (confirmText !== 'APAGAR TUDO') {
            showToast('error', 'Digite "APAGAR TUDO" exatamente para confirmar.');
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(`${API}/truncate-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm_text: 'APAGAR TUDO' }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message ?? 'Falha ao apagar tudo');
            showToast('success', `${data.data.truncated.length} tabelas zeradas, ${fmtNumber(data.data.total_rows_deleted)} registros apagados.`);
            setConfirmingAll(false);
            setConfirmText('');
            setSelected(new Set());
            await fetchTables();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header com totais */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#0F0F11', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: '16px 18px', flexWrap: 'wrap', gap: '12px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Database size={20} color="#C8A97A" />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F0EDE8' }}>
                            Banco de Dados
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7A7774' }}>
                            {tables.length} tabelas · {fmtNumber(totalRows)} registros · {formatBytes(totalSize)}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={fetchTables} title="Recarregar lista" style={btnGhost()}>
                        <RefreshCw size={12} /> Recarregar
                    </button>
                    <button type="button" onClick={exportAll} title="Exportar banco completo como SQL" style={btnGold()}>
                        <Download size={12} /> Exportar tudo (.sql)
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".sql,text/plain"
                        onChange={onPickFile}
                        style={{ display: 'none' }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Importar um arquivo .sql exportado (substitui os dados atuais)"
                        style={btnGhost()}
                    >
                        <Upload size={12} /> Importar (.sql)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setConfirmingAll(true); setConfirmText(''); }}
                        title="Apagar todos os dados operacionais (preserva tabelas críticas)"
                        style={btnDanger()}
                    >
                        <AlertTriangle size={12} /> Apagar tudo
                    </button>
                </div>
            </div>

            {/* Aviso — agora SEM cascata */}
            <div style={{
                background: 'rgba(76,175,130,0.06)', border: '1px solid rgba(76,175,130,0.22)',
                borderRadius: '10px', padding: '10px 14px',
                fontSize: '11px', color: '#79C4A0', lineHeight: 1.5,
            }}>
                🛡️ <strong>Apagar não usa mais cascata.</strong> Marque as tabelas que quer limpar — antes de confirmar,
                a prévia mostra <em>exatamente</em> quais tabelas serão afetadas (incluindo dependentes obrigatórios).
                Tabelas críticas (<code>users</code>, <code>settings</code>, <code>audit_logs</code>…) são protegidas e não podem ser apagadas.
                Exporte um backup antes de qualquer exclusão.
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7A7774' }} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar tabela..."
                        style={{
                            width: '100%', height: '34px', background: '#15151A',
                            border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                            paddingLeft: '32px', paddingRight: '12px', color: '#F0EDE8',
                            fontSize: '12px', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#C8C4BE', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showOnlyWithData} onChange={(e) => setShowOnlyWithData(e.target.checked)} style={{ accentColor: '#C8A97A' }} />
                    Apenas com dados
                </label>
                {selectableInView.length > 0 && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#C8C4BE', cursor: 'pointer' }}>
                        <input type="checkbox" checked={allInViewSelected} onChange={toggleAllInView} style={{ accentColor: '#E05252' }} />
                        Marcar todas visíveis
                    </label>
                )}
            </div>

            {/* Lista */}
            {loading ? (
                <p style={{ fontSize: '12px', color: '#7A7774' }}>Carregando...</p>
            ) : error ? (
                <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.30)', borderRadius: '10px', padding: '14px', color: '#E05252', fontSize: '12px' }}>
                    {error}
                    <button type="button" onClick={fetchTables} style={{ ...btnGhost(), marginLeft: '12px' }}>Tentar novamente</button>
                </div>
            ) : filtered.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#7A7774', textAlign: 'center', padding: '24px' }}>
                    Nenhuma tabela encontrada.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {filtered.map((table) => {
                        const isSel = selected.has(table.name);
                        const canSelect = !table.protected && table.row_count > 0;
                        return (
                            <div
                                key={table.name}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr auto auto',
                                    gap: '12px',
                                    alignItems: 'center',
                                    background: isSel ? 'rgba(224,82,82,0.06)' : '#0F0F11',
                                    border: `1px solid ${isSel ? 'rgba(224,82,82,0.30)' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: '9px',
                                    padding: '10px 14px',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSel}
                                    disabled={!canSelect}
                                    onChange={() => toggle(table.name)}
                                    title={table.protected ? 'Tabela protegida' : table.row_count === 0 ? 'Tabela vazia' : 'Marcar para apagar'}
                                    style={{ accentColor: '#E05252', cursor: canSelect ? 'pointer' : 'not-allowed', opacity: canSelect ? 1 : 0.3 }}
                                />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0EDE8' }}>
                                            {table.label}
                                        </span>
                                        {table.protected && (
                                            <span title="Protegida — não pode ser apagada" style={{
                                                fontSize: '9px', fontWeight: 700, color: '#5B9CF6',
                                                background: 'rgba(91,156,246,0.12)', padding: '1px 5px',
                                                borderRadius: '3px', letterSpacing: '0.06em',
                                            }}>
                                                PROTEGIDA
                                            </span>
                                        )}
                                        <code style={{
                                            fontSize: '10px', color: '#7A7774', fontFamily: 'monospace',
                                            background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '3px',
                                        }}>
                                            {table.name}
                                        </code>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#A8A4A0', marginTop: '4px', lineHeight: 1.4 }}>
                                        {table.description}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#7A7774', marginTop: '3px' }}>
                                        {fmtNumber(table.row_count)} registros · {table.size_pretty}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button type="button" onClick={() => exportTable(table.name, 'csv')} title="Exportar como CSV" disabled={table.row_count === 0} style={iconBtn('#5B9CF6', table.row_count === 0)}>
                                        <FileText size={12} /> CSV
                                    </button>
                                    <button type="button" onClick={() => exportTable(table.name, 'sql')} title="Exportar como INSERTs SQL" disabled={table.row_count === 0} style={iconBtn('#C8A97A', table.row_count === 0)}>
                                        <Download size={12} /> SQL
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void openDeleteModal([table.name])}
                                    title={table.protected ? 'Tabela protegida' : 'Apagar registros desta tabela'}
                                    disabled={table.protected || table.row_count === 0}
                                    style={iconBtn('#E05252', table.protected || table.row_count === 0)}
                                >
                                    <Trash2 size={12} /> Apagar
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Barra flutuante de seleção */}
            {selected.size > 0 && (
                <div style={{
                    position: 'sticky', bottom: '16px', alignSelf: 'center',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    background: '#1A1216', border: '1px solid rgba(224,82,82,0.4)',
                    borderRadius: '10px', padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 100,
                }}>
                    <span style={{ fontSize: '12px', color: '#F0EDE8', fontWeight: 600 }}>
                        {selected.size} tabela(s) marcada(s)
                    </span>
                    <button type="button" onClick={() => setSelected(new Set())} style={btnGhost()}>Limpar</button>
                    <button type="button" onClick={() => void exportSelected()} style={btnGold()}>
                        <Download size={12} /> Exportar selecionadas
                    </button>
                    <button
                        type="button"
                        onClick={() => void openDeleteModal(Array.from(selected))}
                        style={{ ...btnDanger(), background: '#E05252', color: '#fff', border: 'none' }}
                    >
                        <Trash2 size={12} /> Apagar selecionadas
                    </button>
                </div>
            )}

            {/* Modal de apagar (seleção + prévia de dependentes) */}
            {deleteModal && (
                <ModalShell onCancel={() => { if (!busy) { setDeleteModal(null); setConfirmText(''); } }} title="Apagar dados selecionados?">
                    {deleteModal.loadingPreview ? (
                        <p style={{ ...modalText, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Loader2 size={14} className="animate-spin" /> Calculando o que será afetado...
                        </p>
                    ) : (
                        <>
                            <p style={modalText}>Estas tabelas serão zeradas:</p>
                            <div style={pillWrap}>
                                {deleteModal.requested.map((n) => (
                                    <code key={n} style={pill('#E05252')}>{n} <span style={{ opacity: 0.6 }}>({fmtNumber(byName.get(n)?.row_count ?? 0)})</span></code>
                                ))}
                            </div>
                            {deleteModal.dependents.length > 0 && (
                                <>
                                    <p style={{ ...modalText, color: '#F0A040', marginTop: '10px' }}>
                                        ⚠️ Estas dependem das marcadas e <strong>serão apagadas junto</strong> (sem elas o banco ficaria inconsistente):
                                    </p>
                                    <div style={pillWrap}>
                                        {deleteModal.dependents.map((n) => (
                                            <code key={n} style={pill('#F0A040')}>{n} <span style={{ opacity: 0.6 }}>({fmtNumber(byName.get(n)?.row_count ?? 0)})</span></code>
                                        ))}
                                    </div>
                                </>
                            )}
                            <p style={{ ...modalText, marginTop: '12px' }}>
                                Total: <strong style={{ color: '#E05252' }}>{fmtNumber(deleteModal.rows)} registros</strong> em{' '}
                                <strong>{deleteModal.requested.length + deleteModal.dependents.length} tabela(s)</strong>. Não pode ser desfeito.
                            </p>
                            <p style={{ ...modalText, color: '#F0A040' }}>
                                Digite <strong style={{ fontFamily: 'monospace' }}>APAGAR</strong> para confirmar.
                            </p>
                            <ConfirmInput value={confirmText} onChange={setConfirmText} expected="APAGAR" />
                            <ModalActions
                                onCancel={() => { setDeleteModal(null); setConfirmText(''); }}
                                onConfirm={() => void confirmDelete()}
                                enabled={confirmText === 'APAGAR' && !busy}
                                busy={busy}
                                label="Apagar"
                            />
                        </>
                    )}
                </ModalShell>
            )}

            {/* Modal apagar tudo */}
            {confirmingAll && (
                <ModalShell onCancel={() => { if (!busy) { setConfirmingAll(false); setConfirmText(''); } }} title="Apagar TODOS os dados operacionais?">
                    <p style={modalText}>Vai zerar <strong style={{ color: '#E05252' }}>todas as tabelas operacionais</strong>. São preservadas:</p>
                    <ul style={{ ...modalText, margin: '8px 0 8px 18px', padding: 0 }}>
                        <li><code>users</code> — pra você não perder o acesso</li>
                        <li><code>settings</code> — config da loja</li>
                        <li><code>_migrations</code> — histórico de migrations</li>
                        <li><code>audit_logs</code> — trilha de auditoria</li>
                        <li><code>refresh_tokens</code> — sessões ativas</li>
                    </ul>
                    <p style={modalText}>Leads, clientes, pedidos, OS, mensagens, financeiro, roadmap etc. serão apagados.</p>
                    <p style={{ ...modalText, color: '#E05252', fontWeight: 700 }}>Não pode ser desfeito. Exporte um backup antes.</p>
                    <p style={{ ...modalText, color: '#F0A040' }}>Digite <strong style={{ fontFamily: 'monospace' }}>APAGAR TUDO</strong> para confirmar.</p>
                    <ConfirmInput value={confirmText} onChange={setConfirmText} expected="APAGAR TUDO" />
                    <ModalActions
                        onCancel={() => { setConfirmingAll(false); setConfirmText(''); }}
                        onConfirm={() => void truncateAll()}
                        enabled={confirmText === 'APAGAR TUDO' && !busy}
                        busy={busy}
                        label="Apagar tudo"
                    />
                </ModalShell>
            )}

            {/* Modal importar */}
            {importConfirm && (
                <ModalShell onCancel={() => { if (!busy) { setImportConfirm(null); if (fileInputRef.current) fileInputRef.current.value = ''; } }} title="Importar arquivo .sql?">
                    <p style={modalText}>
                        Arquivo: <code style={{ fontFamily: 'monospace', color: '#F0EDE8' }}>{importConfirm.fileName}</code>
                    </p>
                    <p style={{ ...modalText, color: '#E05252', fontWeight: 700 }}>
                        Isto <strong>substitui os dados atuais</strong> pelos do arquivo (limpa e recarrega). Não pode ser desfeito.
                    </p>
                    <p style={modalText}>Use um arquivo exportado por esta mesma tela. Exporte um backup antes, por segurança.</p>
                    <p style={{ ...modalText, color: '#F0A040' }}>
                        Digite <strong style={{ fontFamily: 'monospace' }}>IMPORTAR</strong> para confirmar.
                    </p>
                    <ConfirmInput value={importConfirm.text} onChange={(v) => setImportConfirm((p) => (p ? { ...p, text: v } : p))} expected="IMPORTAR" />
                    <ModalActions
                        onCancel={() => { setImportConfirm(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        onConfirm={() => void confirmImport()}
                        enabled={importConfirm.text === 'IMPORTAR' && !busy}
                        busy={busy}
                        label="Importar"
                    />
                </ModalShell>
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    background: toast.kind === 'success' ? '#0F2E1F' : '#2E0F0F',
                    border: `1px solid ${toast.kind === 'success' ? 'rgba(76,175,130,0.4)' : 'rgba(224,82,82,0.4)'}`,
                    color: toast.kind === 'success' ? '#4CAF82' : '#E05252',
                    padding: '12px 18px', borderRadius: '8px', fontSize: '12px',
                    maxWidth: '440px', zIndex: 2000, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

const modalText: React.CSSProperties = { fontSize: '12px', color: '#C8C4BE', lineHeight: 1.5, margin: '0 0 10px' };
const pillWrap: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 4px' };
function pill(color: string): React.CSSProperties {
    return {
        fontSize: '10px', fontFamily: 'monospace', color,
        background: `${color}18`, border: `1px solid ${color}44`,
        padding: '2px 7px', borderRadius: '5px',
    };
}

function ModalShell({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1500, padding: '20px', backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div style={{
                background: '#141417', border: '1px solid rgba(224,82,82,0.35)',
                borderRadius: '12px', width: '100%', maxWidth: '540px', padding: '20px 24px',
                maxHeight: '85vh', overflowY: 'auto',
            }}>
                <h2 style={{
                    margin: '0 0 14px', fontFamily: "'Playfair Display', serif",
                    fontSize: '17px', fontWeight: 600, color: '#F0EDE8',
                    display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    <AlertTriangle size={18} color="#E05252" />
                    {title}
                </h2>
                {children}
            </div>
        </div>
    );
}

function ConfirmInput({ value, onChange, expected }: { value: string; onChange: (v: string) => void; expected: string }) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Digite "${expected}"`}
            autoFocus
            style={{
                width: '100%', height: '36px', background: '#1A1A1E',
                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                padding: '0 12px', color: '#F0EDE8', fontSize: '13px',
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: '12px',
            }}
        />
    );
}

function ModalActions({ onCancel, onConfirm, enabled, busy, label }: {
    onCancel: () => void; onConfirm: () => void; enabled: boolean; busy: boolean; label: string;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onCancel} disabled={busy} style={{
                height: '34px', padding: '0 16px', borderRadius: '7px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                color: '#C8C4BE', fontSize: '12px', cursor: busy ? 'not-allowed' : 'pointer',
            }}>
                Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={!enabled} style={{
                height: '34px', padding: '0 18px', borderRadius: '7px',
                background: enabled ? '#E05252' : '#3A1A1A', border: 'none',
                color: enabled ? '#FFF' : '#7A7774', fontSize: '12px', fontWeight: 700,
                cursor: enabled ? 'pointer' : 'not-allowed',
            }}>
                {busy ? 'Apagando...' : label}
            </button>
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function btnGhost(): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        height: '32px', padding: '0 12px', borderRadius: '7px',
        background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
        color: '#C8C4BE', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
    };
}

function btnGold(): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        height: '32px', padding: '0 14px', borderRadius: '7px',
        background: '#C8A97A', border: 'none', color: '#0A0A0C',
        fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    };
}

function btnDanger(): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        height: '32px', padding: '0 14px', borderRadius: '7px',
        background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.35)',
        color: '#E05252', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    };
}

function iconBtn(color: string, disabled: boolean): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        height: '28px', padding: '0 10px', borderRadius: '6px',
        background: disabled ? '#15151A' : 'transparent',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : color}55`,
        color: disabled ? '#4A4A52' : color,
        fontSize: '10px', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
    };
}
