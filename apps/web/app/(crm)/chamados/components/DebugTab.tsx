'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirm } from '@/components/system/ConfirmDialog';
import { notify } from '@/lib/toast';

interface SystemErrorRow {
    id: string;
    occurred_at: string;
    source: string;
    severity: string;
    request_id: string | null;
    user_id: string | null;
    method: string | null;
    path: string | null;
    status_code: number | null;
    message: string;
    stack: string | null;
    context: Record<string, unknown> | null;
}

const SOURCE_COLORS: Record<string, string> = {
    api: '#C8A97A',
    web: '#7AB8E0',
    worker: '#B07AC8',
};

const SEVERITY_COLORS: Record<string, string> = {
    error: '#EF4444',
    fatal: '#B91C1C',
    warn: '#F0A040',
};

const POLL_INTERVAL_MS = 3000;

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function DebugTab({ userRole }: { userRole: string }) {
    const isAdmin = userRole === 'ROOT';
    const confirm = useConfirm();
    const [rows, setRows] = useState<SystemErrorRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<string>('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);
    const pausedRef = useRef(paused);
    const filtersRef = useRef({ search, sourceFilter });

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        filtersRef.current = { search, sourceFilter };
    }, [search, sourceFilter]);

    const fetchRows = useCallback(async () => {
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (filtersRef.current.search) params.set('search', filtersRef.current.search);
            if (filtersRef.current.sourceFilter) params.set('source', filtersRef.current.sourceFilter);
            const res = await fetch(`/api/internal/system/errors?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) {
                if (res.status === 403) throw new Error('Acesso restrito a administradores.');
                throw new Error('Falha ao carregar log de erros.');
            }
            const data = await res.json();
            setRows(Array.isArray(data.data) ? data.data : []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRows();
        const id = setInterval(() => {
            if (!pausedRef.current) void fetchRows();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [fetchRows]);

    useEffect(() => {
        // Refresh imediato quando filtros mudam.
        const t = setTimeout(() => void fetchRows(), 250);
        return () => clearTimeout(t);
    }, [search, sourceFilter, fetchRows]);

    async function handleClear() {
        const ok = await confirm({
            title: 'Limpar TODOS os erros registrados?',
            description: 'Esta ação é definitiva — todos os logs de erro do sistema serão apagados.',
            confirmLabel: 'Limpar tudo',
            variant: 'destructive',
        });
        if (!ok) return;
        setClearing(true);
        try {
            const res = await fetch('/api/internal/system/errors', { method: 'DELETE' });
            if (!res.ok) throw new Error();
            setRows([]);
            notify.success('Erros limpos');
        } catch {
            notify.error('Falha ao limpar');
        } finally {
            setClearing(false);
        }
    }

    if (!isAdmin) {
        return (
            <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#C8C4BE', marginBottom: '6px' }}>Acesso restrito</div>
                <div style={{ fontSize: '12px', color: '#7A7774' }}>Apenas administradores podem ver o log de erros.</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                <input
                    type="text"
                    placeholder="Buscar mensagem ou rota…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        flex: '1 1 240px', minWidth: 0,
                        height: '36px', padding: '0 12px',
                        background: '#0F0F11', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', color: '#F0EDE8', fontSize: '12px',
                        fontFamily: "'DM Sans', sans-serif", outline: 'none',
                    }}
                />
                <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    style={{
                        height: '36px', padding: '0 10px',
                        background: '#0F0F11', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', color: '#F0EDE8', fontSize: '12px',
                        cursor: 'pointer', outline: 'none',
                    }}
                >
                    <option value="">Todas as origens</option>
                    <option value="api">API</option>
                    <option value="web">Web</option>
                    <option value="worker">Worker</option>
                </select>
                <button
                    onClick={() => setPaused(p => !p)}
                    style={{
                        height: '36px', padding: '0 14px',
                        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
                        background: paused ? 'rgba(240,160,64,0.1)' : 'transparent',
                        color: paused ? '#F0A040' : '#C8C4BE',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    {paused ? '▶ Retomar' : '⏸ Pausar'}
                </button>
                <button
                    onClick={() => void fetchRows()}
                    style={{
                        height: '36px', padding: '0 14px',
                        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent', color: '#C8C4BE',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    ↻ Atualizar
                </button>
                <button
                    onClick={handleClear}
                    disabled={clearing || rows.length === 0}
                    style={{
                        height: '36px', padding: '0 14px',
                        borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
                        background: 'transparent', color: '#EF4444',
                        fontSize: '12px', fontWeight: 600,
                        cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: rows.length === 0 ? 0.4 : 1,
                    }}
                >
                    🗑 Limpar
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '11px', color: '#7A7774' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: paused ? '#F0A040' : '#3FB87A',
                        boxShadow: paused ? 'none' : '0 0 8px rgba(63,184,122,0.7)',
                        animation: paused ? 'none' : 'pulse 1.5s infinite',
                    }} />
                    <span>{paused ? 'Pausado' : `Ao vivo (${POLL_INTERVAL_MS / 1000}s)`}</span>
                </div>
                <span>•</span>
                <span>{rows.length} erro(s) recente(s)</span>
            </div>

            {loading ? (
                <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#7A7774', fontSize: '12px' }}>
                    Carregando log…
                </div>
            ) : error ? (
                <div style={{ background: '#0F0F11', border: '1px solid rgba(239,68,68,0.30)', borderRadius: '12px', padding: '32px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#EF4444', marginBottom: '6px' }}>{error}</div>
                    <button
                        onClick={() => void fetchRows()}
                        style={{ height: '32px', padding: '0 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid rgba(200,169,122,0.5)', color: '#C8A97A', cursor: 'pointer', marginTop: '8px' }}
                    >
                        Tentar novamente
                    </button>
                </div>
            ) : rows.length === 0 ? (
                <div style={{ background: '#0F0F11', border: '1px solid rgba(63,184,122,0.20)', borderRadius: '12px', padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>✓</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#3FB87A', marginBottom: '4px' }}>Nenhum erro registrado</div>
                    <div style={{ fontSize: '12px', color: '#7A7774' }}>Sistema operando sem incidentes capturados.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rows.map(row => {
                        const expanded = expandedId === row.id;
                        const sourceColor = SOURCE_COLORS[row.source] ?? '#7A7774';
                        const sevColor = SEVERITY_COLORS[row.severity] ?? '#EF4444';
                        return (
                            <div
                                key={row.id}
                                style={{
                                    background: '#0F0F11',
                                    border: `1px solid ${expanded ? 'rgba(200,169,122,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                }}
                            >
                                <button
                                    onClick={() => setExpandedId(expanded ? null : row.id)}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        background: 'transparent', border: 'none',
                                        cursor: 'pointer', textAlign: 'left',
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        fontFamily: "'DM Sans', sans-serif",
                                    }}
                                >
                                    <div style={{ fontSize: '10px', color: '#7A7774', fontFamily: 'monospace', flexShrink: 0, width: '64px' }}>
                                        <div>{formatTime(row.occurred_at)}</div>
                                        <div style={{ opacity: 0.6 }}>{formatDate(row.occurred_at)}</div>
                                    </div>
                                    <div style={{
                                        flexShrink: 0, width: '52px',
                                        padding: '2px 6px', borderRadius: '4px',
                                        background: `${sourceColor}22`,
                                        color: sourceColor,
                                        fontSize: '10px', fontWeight: 700,
                                        textAlign: 'center', textTransform: 'uppercase',
                                    }}>
                                        {row.source}
                                    </div>
                                    {row.status_code != null && (
                                        <div style={{
                                            flexShrink: 0, padding: '2px 6px', borderRadius: '4px',
                                            background: `${sevColor}22`, color: sevColor,
                                            fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                                        }}>
                                            {row.status_code}
                                        </div>
                                    )}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: '12px', color: '#F0EDE8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row.message}
                                        </div>
                                        {(row.method || row.path) && (
                                            <div style={{ fontSize: '10px', color: '#7A7774', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {row.method ? `${row.method} ` : ''}{row.path ?? ''}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#7A7774', flexShrink: 0 }}>
                                        {expanded ? '▾' : '▸'}
                                    </div>
                                </button>
                                {expanded && (
                                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: '11px', marginTop: '12px' }}>
                                            {row.request_id && (<>
                                                <div style={{ color: '#7A7774' }}>requestId</div>
                                                <div style={{ color: '#C8C4BE', fontFamily: 'monospace', wordBreak: 'break-all' }}>{row.request_id}</div>
                                            </>)}
                                            {row.user_id && (<>
                                                <div style={{ color: '#7A7774' }}>userId</div>
                                                <div style={{ color: '#C8C4BE', fontFamily: 'monospace', wordBreak: 'break-all' }}>{row.user_id}</div>
                                            </>)}
                                            <div style={{ color: '#7A7774' }}>severity</div>
                                            <div style={{ color: sevColor, fontWeight: 600 }}>{row.severity}</div>
                                        </div>
                                        {row.stack && (
                                            <div style={{ marginTop: '12px' }}>
                                                <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stack trace</div>
                                                <pre style={{
                                                    background: '#070708', padding: '10px',
                                                    borderRadius: '6px', fontSize: '10.5px',
                                                    color: '#C8C4BE', overflow: 'auto',
                                                    maxHeight: '280px', margin: 0,
                                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                }}>{row.stack}</pre>
                                            </div>
                                        )}
                                        {row.context && Object.keys(row.context).length > 0 && (
                                            <div style={{ marginTop: '12px' }}>
                                                <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contexto</div>
                                                <pre style={{
                                                    background: '#070708', padding: '10px',
                                                    borderRadius: '6px', fontSize: '10.5px',
                                                    color: '#C8C4BE', overflow: 'auto',
                                                    maxHeight: '200px', margin: 0,
                                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                }}>{JSON.stringify(row.context, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
        </div>
    );
}
