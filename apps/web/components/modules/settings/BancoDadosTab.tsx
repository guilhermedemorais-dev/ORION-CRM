'use client';

// Aba "Banco de Dados" em Ajustes — só ROOT.
// Lista tabelas, permite exportar (CSV/SQL/dump completo) e apagar
// (TRUNCATE CASCADE com confirmação).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Trash2, RefreshCw, AlertTriangle, Database, Search } from 'lucide-react';

interface TableRow {
    name: string;
    schema: string;
    row_count: number;
    size_bytes: number;
    size_pretty: string;
    protected_in_bulk: boolean;
    label: string;
    description: string;
}

function fmtNumber(n: number): string {
    return new Intl.NumberFormat('pt-BR').format(n);
}

export function BancoDadosTab() {
    const [tables, setTables] = useState<TableRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmingTable, setConfirmingTable] = useState<TableRow | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [confirmingAll, setConfirmingAll] = useState(false);
    const [showOnlyWithData, setShowOnlyWithData] = useState(true);
    const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

    const showToast = useCallback((kind: 'success' | 'error', msg: string) => {
        setToast({ kind, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchTables = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/admin/database/tables');
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

    const exportTable = (table: string, format: 'csv' | 'sql') => {
        window.location.href = `/api/internal/admin/database/tables/${table}/export.${format}`;
    };

    const exportAll = () => {
        window.location.href = `/api/internal/admin/database/export-all.sql`;
    };

    const truncateTable = async (table: TableRow) => {
        if (confirmText !== table.name) {
            showToast('error', `Digite o nome da tabela "${table.name}" para confirmar.`);
            return;
        }
        setBusy(table.name);
        try {
            const res = await fetch(`/api/internal/admin/database/tables/${table.name}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm_text: table.name }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message ?? 'Falha ao apagar tabela');
            }
            showToast('success', `Tabela "${table.name}" zerada: ${data.data.rows_deleted} registros apagados.`);
            setConfirmingTable(null);
            setConfirmText('');
            await fetchTables();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro');
        } finally {
            setBusy(null);
        }
    };

    const truncateAll = async () => {
        if (confirmText !== 'APAGAR TUDO') {
            showToast('error', 'Digite "APAGAR TUDO" exatamente para confirmar.');
            return;
        }
        setBusy('__ALL__');
        try {
            const res = await fetch('/api/internal/admin/database/truncate-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm_text: 'APAGAR TUDO' }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message ?? 'Falha ao apagar tudo');
            showToast('success', `${data.data.truncated.length} tabelas zeradas, ${fmtNumber(data.data.total_rows_deleted)} registros apagados.`);
            setConfirmingAll(false);
            setConfirmText('');
            await fetchTables();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro');
        } finally {
            setBusy(null);
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
                    <button
                        type="button"
                        onClick={fetchTables}
                        title="Recarregar lista"
                        style={btnGhost()}
                    >
                        <RefreshCw size={12} /> Recarregar
                    </button>
                    <button
                        type="button"
                        onClick={exportAll}
                        title="Exportar banco completo como SQL"
                        style={btnGold()}
                    >
                        <Download size={12} /> Exportar tudo (.sql)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setConfirmingAll(true); setConfirmText(''); }}
                        title="Apagar todos os dados (preserva users, settings, _migrations)"
                        style={btnDanger()}
                    >
                        <AlertTriangle size={12} /> Apagar tudo
                    </button>
                </div>
            </div>

            {/* Aviso */}
            <div style={{
                background: 'rgba(240,160,64,0.06)', border: '1px solid rgba(240,160,64,0.25)',
                borderRadius: '10px', padding: '10px 14px',
                fontSize: '11px', color: '#F0A040', lineHeight: 1.5,
            }}>
                ⚠️ <strong>Operações destrutivas.</strong> "Apagar" usa TRUNCATE CASCADE — apaga a tabela e todas as tabelas que dependem dela.
                "Apagar tudo" preserva 3 tabelas críticas (users, settings, _migrations) para o sistema continuar funcionando.
                Sempre exporte um backup antes.
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
                    <input
                        type="checkbox"
                        checked={showOnlyWithData}
                        onChange={(e) => setShowOnlyWithData(e.target.checked)}
                        style={{ accentColor: '#C8A97A' }}
                    />
                    Apenas com dados
                </label>
            </div>

            {/* Lista */}
            {loading ? (
                <p style={{ fontSize: '12px', color: '#7A7774' }}>Carregando...</p>
            ) : error ? (
                <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.30)', borderRadius: '10px', padding: '14px', color: '#E05252', fontSize: '12px' }}>
                    {error}
                </div>
            ) : filtered.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#7A7774', textAlign: 'center', padding: '24px' }}>
                    Nenhuma tabela encontrada.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {filtered.map((table) => (
                        <div
                            key={table.name}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto auto',
                                gap: '12px',
                                alignItems: 'center',
                                background: '#0F0F11',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '9px',
                                padding: '10px 14px',
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{
                                        fontSize: '13px', fontWeight: 600, color: '#F0EDE8',
                                    }}>
                                        {table.label}
                                    </span>
                                    {table.protected_in_bulk && (
                                        <span title="Preservada em 'Apagar tudo'" style={{
                                            fontSize: '9px', fontWeight: 700, color: '#5B9CF6',
                                            background: 'rgba(91,156,246,0.12)',
                                            padding: '1px 5px', borderRadius: '3px',
                                            letterSpacing: '0.06em',
                                        }}>
                                            PROTEGIDA
                                        </span>
                                    )}
                                    <code style={{
                                        fontSize: '10px', color: '#7A7774',
                                        fontFamily: 'monospace',
                                        background: 'rgba(255,255,255,0.04)',
                                        padding: '1px 6px', borderRadius: '3px',
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
                                <button
                                    type="button"
                                    onClick={() => exportTable(table.name, 'csv')}
                                    title="Exportar como CSV"
                                    disabled={table.row_count === 0}
                                    style={iconBtn('#5B9CF6', table.row_count === 0)}
                                >
                                    <FileText size={12} /> CSV
                                </button>
                                <button
                                    type="button"
                                    onClick={() => exportTable(table.name, 'sql')}
                                    title="Exportar como INSERTs SQL"
                                    disabled={table.row_count === 0}
                                    style={iconBtn('#C8A97A', table.row_count === 0)}
                                >
                                    <Download size={12} /> SQL
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setConfirmingTable(table); setConfirmText(''); }}
                                title="Apagar todos os registros desta tabela (TRUNCATE CASCADE)"
                                disabled={busy === table.name || table.row_count === 0}
                                style={iconBtn('#E05252', busy === table.name || table.row_count === 0)}
                            >
                                <Trash2 size={12} /> Apagar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de confirmação tabela única */}
            {confirmingTable && (
                <ConfirmModal
                    title={`Apagar "${confirmingTable.label}"?`}
                    message={
                        <>
                            <p style={modalText}>
                                {confirmingTable.description}
                            </p>
                            <p style={modalText}>
                                Esta ação vai apagar <strong style={{ color: '#E05252' }}>{fmtNumber(confirmingTable.row_count)} registros</strong> da tabela <code style={{ fontFamily: 'monospace', color: '#F0EDE8' }}>{confirmingTable.name}</code>.
                            </p>
                            <p style={modalText}>
                                O comando usa <strong>TRUNCATE CASCADE</strong>, então tabelas que dependem desta também podem ser zeradas.
                            </p>
                            <p style={{ ...modalText, color: '#F0A040' }}>
                                Digite <strong style={{ fontFamily: 'monospace' }}>{confirmingTable.name}</strong> abaixo para confirmar.
                            </p>
                        </>
                    }
                    confirmText={confirmText}
                    setConfirmText={setConfirmText}
                    expectedText={confirmingTable.name}
                    onCancel={() => { setConfirmingTable(null); setConfirmText(''); }}
                    onConfirm={() => void truncateTable(confirmingTable)}
                    busy={busy === confirmingTable.name}
                    confirmLabel="Apagar tabela"
                />
            )}

            {/* Modal de confirmação apagar tudo */}
            {confirmingAll && (
                <ConfirmModal
                    title="Apagar TODOS os dados operacionais?"
                    message={
                        <>
                            <p style={modalText}>
                                Esta ação vai zerar <strong style={{ color: '#E05252' }}>todas as tabelas</strong> do banco, exceto:
                            </p>
                            <ul style={{ ...modalText, margin: '8px 0 8px 18px', padding: 0 }}>
                                <li><code>users</code> — pra você não perder o acesso</li>
                                <li><code>settings</code> — pra preservar a config da loja</li>
                                <li><code>_migrations</code> — pra preservar o histórico de migrations</li>
                            </ul>
                            <p style={modalText}>
                                Todos os leads, clientes, pedidos, OS, mensagens, financeiro, audit log, roadmap etc. serão apagados.
                            </p>
                            <p style={{ ...modalText, color: '#E05252', fontWeight: 700 }}>
                                Esta operação NÃO pode ser desfeita. Faça backup antes.
                            </p>
                            <p style={{ ...modalText, color: '#F0A040' }}>
                                Digite <strong style={{ fontFamily: 'monospace' }}>APAGAR TUDO</strong> abaixo para confirmar.
                            </p>
                        </>
                    }
                    confirmText={confirmText}
                    setConfirmText={setConfirmText}
                    expectedText="APAGAR TUDO"
                    onCancel={() => { setConfirmingAll(false); setConfirmText(''); }}
                    onConfirm={() => void truncateAll()}
                    busy={busy === '__ALL__'}
                    confirmLabel="Apagar tudo"
                />
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    background: toast.kind === 'success' ? '#0F2E1F' : '#2E0F0F',
                    border: `1px solid ${toast.kind === 'success' ? 'rgba(76,175,130,0.4)' : 'rgba(224,82,82,0.4)'}`,
                    color: toast.kind === 'success' ? '#4CAF82' : '#E05252',
                    padding: '12px 18px', borderRadius: '8px', fontSize: '12px',
                    maxWidth: '400px', zIndex: 2000, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

const modalText: React.CSSProperties = {
    fontSize: '12px', color: '#C8C4BE', lineHeight: 1.5, margin: '0 0 10px',
};

function ConfirmModal({ title, message, confirmText, setConfirmText, expectedText, onCancel, onConfirm, busy, confirmLabel }: {
    title: string;
    message: React.ReactNode;
    confirmText: string;
    setConfirmText: (v: string) => void;
    expectedText: string;
    onCancel: () => void;
    onConfirm: () => void;
    busy: boolean;
    confirmLabel: string;
}) {
    const enabled = confirmText === expectedText && !busy;
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1500, padding: '20px', backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
        >
            <div style={{
                background: '#141417', border: '1px solid rgba(224,82,82,0.35)',
                borderRadius: '12px', width: '100%', maxWidth: '520px',
                padding: '20px 24px',
            }}>
                <h2 style={{
                    margin: '0 0 14px', fontFamily: "'Playfair Display', serif",
                    fontSize: '17px', fontWeight: 600, color: '#F0EDE8',
                    display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    <AlertTriangle size={18} color="#E05252" />
                    {title}
                </h2>
                <div>{message}</div>
                <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={`Digite "${expectedText}"`}
                    autoFocus
                    style={{
                        width: '100%', height: '36px', background: '#1A1A1E',
                        border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                        padding: '0 12px', color: '#F0EDE8', fontSize: '13px',
                        fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                        marginBottom: '12px',
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        style={{
                            height: '34px', padding: '0 16px', borderRadius: '7px',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#C8C4BE', fontSize: '12px', cursor: busy ? 'not-allowed' : 'pointer',
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!enabled}
                        style={{
                            height: '34px', padding: '0 18px', borderRadius: '7px',
                            background: enabled ? '#E05252' : '#3A1A1A',
                            border: 'none', color: enabled ? '#FFF' : '#7A7774',
                            fontSize: '12px', fontWeight: 700,
                            cursor: enabled ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {busy ? 'Apagando...' : confirmLabel}
                    </button>
                </div>
            </div>
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
