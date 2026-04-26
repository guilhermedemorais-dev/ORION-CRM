'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------- Types ----------

interface TicketRecord {
    id: string;
    user_id: string;
    user_name: string;
    title: string;
    description: string;
    type: 'BUG' | 'SUGGESTION' | 'OTHER';
    status: 'OPEN' | 'EVALUATING' | 'RESOLVED' | 'REJECTED';
    attachments: string[];
    created_at: string;
    updated_at: string;
}

interface TimelineEntry {
    version: string;
    date: string;
    title: string;
    items: string[];
}

interface PendingSection {
    section: string;
    items: string[];
}

type TabKey = 'incidents' | 'timeline' | 'updates';

// ---------- New Ticket Modal (preserved from original) ----------

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('BUG');
    const [files, setFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('description', description.trim());
            formData.append('type', type);

            files.forEach((file) => {
                formData.append('attachments', file);
            });

            const res = await fetch('/api/internal/tickets', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Erro ao criar chamado');
            onCreated();
            onClose();
        } catch {
            alert('Erro ao criar chamado.');
        } finally {
            setSaving(false);
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ width: '100%', maxWidth: '540px', background: '#141417', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 700, color: '#F0EDE8' }}>Novo Chamado</div>
                    <button onClick={onClose} aria-label="Fechar" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', color: '#7A7774', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#E8E4DE', display: 'block', marginBottom: '6px' }}>Tipo de Relato</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                style={{ width: '100%', height: '35px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', padding: '0 11px', fontSize: '12px', color: '#F0EDE8', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                            >
                                <option value="BUG">Problema / Erro (Bug)</option>
                                <option value="SUGGESTION">Sugestão de Melhoria</option>
                                <option value="OTHER">Outro</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#E8E4DE', display: 'block', marginBottom: '6px' }}>Título</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Resumo do problema ou sugestão"
                                required
                                style={{ width: '100%', height: '35px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', padding: '0 11px', fontSize: '12px', color: '#F0EDE8', boxSizing: 'border-box', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#E8E4DE', display: 'block', marginBottom: '6px' }}>Descrição Detalhada</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explique com o máximo de detalhes possível..."
                                required
                                rows={4}
                                style={{ width: '100%', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', padding: '11px', fontSize: '12px', color: '#F0EDE8', boxSizing: 'border-box', outline: 'none', fontFamily: "'DM Sans', sans-serif", resize: 'none' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#E8E4DE', display: 'block', marginBottom: '6px' }}>Anexos (Opcional - Prints, Fotos ou Vídeos curtos)</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                multiple
                                accept="image/*,video/mp4"
                                style={{ fontSize: '12px', color: '#C8C4BE', cursor: 'pointer' }}
                            />
                            {files.length > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '11px', color: '#7A7774' }}>
                                    {files.map(f => f.name).join(', ')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button type="button" onClick={onClose} style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: '#C8C4BE', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancelar</button>
                        <button type="submit" disabled={saving} style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#C8A97A', border: 'none', color: '#000', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.6 : 1 }}>
                            {saving ? 'Enviando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------- Helpers ----------

function formatBrDate(iso: string): string {
    try {
        const [y, m, d] = iso.split('-').map(Number);
        if (!y || !m || !d) return iso;
        const dt = new Date(y, m - 1, d);
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(dt);
    } catch {
        return iso;
    }
}

const TYPE_LABELS: Record<string, string> = {
    BUG: 'Problema',
    SUGGESTION: 'Sugestão',
    OTHER: 'Outro',
};

const STATUS_LABELS: Record<string, string> = {
    OPEN: 'Aberto',
    EVALUATING: 'Avaliando',
    RESOLVED: 'Resolvido',
    REJECTED: 'Recusado',
};

const STATUS_COLORS: Record<string, string> = {
    OPEN: '#5B9CF6',
    EVALUATING: '#A78BFA',
    RESOLVED: '#3FB87A',
    REJECTED: '#EF4444',
};

// ---------- Incidents Tab ----------

function IncidentsTab({ userRole }: { userRole: string }) {
    const [tickets, setTickets] = useState<TicketRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const isAdmin = ['ROOT', 'ADMIN'].includes(userRole);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/tickets');
            if (!res.ok) throw new Error('Erro ao carregar chamados');
            const data = await res.json();
            setTickets(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar chamados');
            setTickets([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    async function handleStatusChange(id: string, newStatus: string) {
        setUpdatingId(id);
        try {
            const res = await fetch(`/api/internal/tickets/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                fetchTickets();
            }
        } finally {
            setUpdatingId(null);
        }
    }

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#7A7774' }}>
                    Registre incidentes, envie prints de erros ou sugira melhorias para o sistema.
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="tck-btn"
                    style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#C8A97A', border: 'none', color: '#000', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '6px', transition: 'background .15s' }}
                >
                    + Novo Relato
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', height: '120px', position: 'relative', overflow: 'hidden' }}>
                            <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)' }} />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div style={{ background: '#0F0F11', border: '1px solid rgba(239,68,68,0.30)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444', marginBottom: '6px' }}>Não foi possível carregar os chamados</div>
                    <div style={{ fontSize: '12px', color: '#7A7774', marginBottom: '16px' }}>{error}</div>
                    <button
                        onClick={fetchTickets}
                        style={{ height: '32px', padding: '0 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid rgba(200,169,122,0.5)', color: '#C8A97A', cursor: 'pointer' }}
                    >
                        Tentar novamente
                    </button>
                </div>
            ) : tickets.length === 0 ? (
                <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>💬</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#C8C4BE', marginBottom: '4px' }}>Nenhum relato encontrado</div>
                    <div style={{ fontSize: '12px', color: '#7A7774' }}>Tudo funcionando perfeitamente por aqui.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tickets.map(ticket => (
                        <div key={ticket.id} style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '16px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                                    <div style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#E8E4DE', flexShrink: 0 }}>
                                        {TYPE_LABELS[ticket.type]}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#F0EDE8', marginBottom: '4px' }}>{ticket.title}</div>
                                        <div style={{ fontSize: '11px', color: '#7A7774' }}>
                                            Enviado por <span style={{ color: '#C8C4BE' }}>{ticket.user_name}</span> em {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ticket.created_at))}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                    {isAdmin ? (
                                        <select
                                            className="status-select"
                                            value={ticket.status}
                                            onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                                            disabled={updatingId === ticket.id}
                                        >
                                            <option value="OPEN">Aberto</option>
                                            <option value="EVALUATING">Avaliando</option>
                                            <option value="RESOLVED">Resolvido</option>
                                            <option value="REJECTED">Recusado</option>
                                        </select>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: STATUS_COLORS[ticket.status] }} />
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE' }}>{STATUS_LABELS[ticket.status]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#C8C4BE', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {ticket.description}
                            </div>

                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#7A7774', marginBottom: '8px' }}>Anexos:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                        {ticket.attachments.map((url, i) => {
                                            const isVideo = url.toLowerCase().endsWith('.mp4');
                                            return (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '120px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#1A1A1E' }}>
                                                    {isVideo ? (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎥</div>
                                                    ) : (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={url} alt="Anexo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    )}
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <NewTicketModal
                    onClose={() => setShowModal(false)}
                    onCreated={fetchTickets}
                />
            )}
        </>
    );
}

// ---------- Activity Graph ----------

interface ActivityDay { date: string; count: number; }
interface ActivityStats { totalCommits: number; activeDays: number; startDate: string; }

function cellColor(count: number): string {
    if (count === 0) return '#1A1A1E';
    if (count <= 3) return 'rgba(200,169,122,0.25)';
    if (count <= 8) return 'rgba(200,169,122,0.50)';
    if (count <= 15) return 'rgba(200,169,122,0.75)';
    return '#C8A97A';
}

function ActivityGraph() {
    const [days, setDays] = useState<ActivityDay[]>([]);
    const [stats, setStats] = useState<ActivityStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/internal/system/activity')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => { setDays(d.days ?? []); setStats(d.stats ?? null); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', height: '110px', position: 'relative', overflow: 'hidden', marginBottom: '24px' }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
            </div>
        );
    }

    if (days.length === 0) return null;

    // Build a map date→count
    const countMap: Record<string, number> = {};
    days.forEach(d => { countMap[d.date] = d.count; });

    // Always show last 26 weeks (6 months) so the grid looks substantial
    const today = new Date();
    const endSun = new Date(today);
    endSun.setDate(today.getDate() + (6 - ((today.getDay() + 6) % 7)));

    const startMon = new Date(endSun);
    startMon.setDate(endSun.getDate() - 52 * 7 + 1);

    // Build weeks array: each week = array of 7 dates (Mon-Sun)
    const weeks: Date[][] = [];
    const cur = new Date(startMon);
    while (cur <= endSun) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(week);
    }

    const CELL = 11; // cell size px
    const GAP = 2;
    const LABEL_W = 26;
    const LABEL_H = 16;
    const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    // Month labels: find first week of each month
    const monthLabels: { label: string; col: number }[] = [];
    const seenMonths = new Set<string>();
    weeks.forEach((week, wi) => {
        const firstDay = week[0]!;
        const key = `${firstDay.getFullYear()}-${firstDay.getMonth()}`;
        if (!seenMonths.has(key)) {
            seenMonths.add(key);
            const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(firstDay);
            monthLabels.push({ label: monthName.replace('.', ''), col: wi });
        }
    });

    const svgW = LABEL_W + weeks.length * (CELL + GAP);
    const svgH = LABEL_H + 7 * (CELL + GAP);

    function isoDate(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatTooltip(d: Date, count: number): string {
        const label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d);
        return count > 0 ? `${label} — ${count} commit${count > 1 ? 's' : ''}` : `${label} — sem commits`;
    }

    return (
        <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 700, color: '#F0EDE8' }}>Atividade de Desenvolvimento</div>
                {stats && (
                    <div style={{ fontSize: '11px', color: '#7A7774' }}>
                        {stats.totalCommits} commits · {stats.activeDays} dias ativos · desde {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(stats.startDate + 'T00:00:00'))}
                    </div>
                )}
            </div>

            <div style={{ overflowX: 'auto' }}>
                <svg width={svgW} height={svgH} style={{ display: 'block' }}>
                    {/* Month labels */}
                    {monthLabels.map(({ label, col }) => (
                        <text key={label} x={LABEL_W + col * (CELL + GAP)} y={10} fontSize={9} fill="#7A7774" fontFamily="DM Sans, sans-serif">
                            {label}
                        </text>
                    ))}
                    {/* Day labels */}
                    {dayLabels.map((lbl, row) => lbl ? (
                        <text key={row} x={0} y={LABEL_H + row * (CELL + GAP) + CELL - 2} fontSize={8} fill="#5A5754" fontFamily="DM Sans, sans-serif">
                            {lbl}
                        </text>
                    ) : null)}
                    {/* Cells */}
                    {weeks.map((week, wi) =>
                        week.map((date, di) => {
                            const iso = isoDate(date);
                            const count = countMap[iso] ?? 0;
                            const isFuture = date > today;
                            return (
                                <rect
                                    key={iso}
                                    x={LABEL_W + wi * (CELL + GAP)}
                                    y={LABEL_H + di * (CELL + GAP)}
                                    width={CELL}
                                    height={CELL}
                                    rx={2}
                                    fill={isFuture ? 'transparent' : cellColor(count)}
                                    stroke={isFuture ? 'rgba(255,255,255,0.04)' : 'none'}
                                >
                                    <title>{formatTooltip(date, count)}</title>
                                </rect>
                            );
                        })
                    )}
                </svg>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: '#5A5754' }}>Menos</span>
                {[0, 0.25, 0.5, 0.75, 1].map((op, i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '2px', background: op === 0 ? '#1A1A1E' : `rgba(200,169,122,${op})` }} />
                ))}
                <span style={{ fontSize: '10px', color: '#5A5754' }}>Mais</span>
            </div>
        </div>
    );
}

// ---------- Timeline Tab ----------

function TimelineTab() {
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTimeline = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/system/timeline');
            if (!res.ok) throw new Error('Erro ao carregar a linha do tempo');
            const data = await res.json();
            setEntries(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro');
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTimeline();
    }, [fetchTimeline]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px', height: '180px', position: 'relative', overflow: 'hidden' }}>
                        <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ background: '#0F0F11', border: '1px solid rgba(239,68,68,0.30)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444', marginBottom: '6px' }}>Não foi possível carregar a linha do tempo</div>
                <div style={{ fontSize: '12px', color: '#7A7774', marginBottom: '16px' }}>{error}</div>
                <button
                    onClick={fetchTimeline}
                    style={{ height: '32px', padding: '0 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid rgba(200,169,122,0.5)', color: '#C8A97A', cursor: 'pointer' }}
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📜</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#C8C4BE', marginBottom: '4px' }}>Sem registros ainda</div>
                <div style={{ fontSize: '12px', color: '#7A7774' }}>O histórico do sistema aparecerá aqui.</div>
            </div>
        );
    }

    return (
        <>
        <ActivityGraph />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '1px', background: 'linear-gradient(to bottom, rgba(200,169,122,0.4), rgba(200,169,122,0.05))', pointerEvents: 'none' }} />

            {entries.map((entry, idx) => (
                <div key={`${entry.version}-${idx}`} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                    <div style={{ width: '24px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '24px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#C8A97A', boxShadow: '0 0 0 4px rgba(200,169,122,0.15), 0 0 12px rgba(200,169,122,0.4)', position: 'relative', zIndex: 1 }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, background: '#0F0F11', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <div style={{
                                padding: '4px 10px',
                                borderRadius: '999px',
                                background: 'linear-gradient(135deg, rgba(200,169,122,0.18), rgba(200,169,122,0.06))',
                                border: '1px solid rgba(200,169,122,0.35)',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                color: '#C8A97A',
                                fontFamily: "'DM Sans', sans-serif",
                            }}>
                                {entry.version}
                            </div>
                            <div style={{ fontSize: '11px', color: '#7A7774', fontWeight: 500 }}>
                                {formatBrDate(entry.date)}
                            </div>
                        </div>

                        {entry.title && (
                            <div style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: '18px',
                                fontWeight: 700,
                                color: '#F0EDE8',
                                marginBottom: '14px',
                                lineHeight: 1.3,
                            }}>
                                {entry.title}
                            </div>
                        )}

                        {entry.items.length > 0 && (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {entry.items.map((item, i) => (
                                    <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: '#C8C4BE', lineHeight: 1.55 }}>
                                        <span style={{ color: '#C8A97A', flexShrink: 0, marginTop: '2px', fontSize: '10px' }}>◆</span>
                                        <span style={{ minWidth: 0 }}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ))}
        </div>
        </>
    );
}

// ---------- Updates Tab ----------

function UpdatesTab() {
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [pending, setPending] = useState<PendingSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());

    function toggleExpand(key: string) {
        setExpandedReleases(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    const fetchUpdates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/system/timeline?pending=true');
            if (!res.ok) throw new Error('Erro ao carregar atualizações');
            const data = await res.json();
            if (Array.isArray(data)) {
                setEntries(data);
                setPending([]);
            } else {
                setEntries(Array.isArray(data?.timeline) ? data.timeline : []);
                setPending(Array.isArray(data?.pending) ? data.pending : []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro');
            setEntries([]);
            setPending([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUpdates();
    }, [fetchUpdates]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {[0, 1].map(i => (
                    <div key={i} style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px', height: '160px', position: 'relative', overflow: 'hidden' }}>
                        <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ background: '#0F0F11', border: '1px solid rgba(239,68,68,0.30)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444', marginBottom: '6px' }}>Não foi possível carregar as atualizações</div>
                <div style={{ fontSize: '12px', color: '#7A7774', marginBottom: '16px' }}>{error}</div>
                <button
                    onClick={fetchUpdates}
                    style={{ height: '32px', padding: '0 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid rgba(200,169,122,0.5)', color: '#C8A97A', cursor: 'pointer' }}
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    const recent = entries.slice(0, 3);
    const totalPending = pending.reduce((acc, sec) => acc + sec.items.length, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3FB87A', boxShadow: '0 0 8px rgba(63,184,122,0.6)' }} />
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700, color: '#F0EDE8' }}>Entregue recentemente</div>
                    <div style={{ fontSize: '11px', color: '#7A7774', marginLeft: '4px' }}>últimos {recent.length} releases</div>
                </div>

                {recent.length === 0 ? (
                    <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '32px', textAlign: 'center', fontSize: '12px', color: '#7A7774' }}>
                        Sem releases registrados ainda.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {recent.map((entry, idx) => (
                            <div key={`${entry.version}-${idx}`} style={{ background: '#0F0F11', border: '1px solid rgba(63,184,122,0.18)', borderRadius: '12px', padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    <div style={{
                                        padding: '3px 9px',
                                        borderRadius: '999px',
                                        background: 'rgba(63,184,122,0.12)',
                                        border: '1px solid rgba(63,184,122,0.4)',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        letterSpacing: '0.04em',
                                        color: '#3FB87A',
                                    }}>
                                        {entry.version}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#7A7774' }}>{formatBrDate(entry.date)}</div>
                                </div>
                                {entry.title && (
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#F0EDE8', marginBottom: '8px' }}>
                                        {entry.title}
                                    </div>
                                )}
                                {entry.items.length > 0 && (() => {
                                    const key = `${entry.version}-${idx}`;
                                    const expanded = expandedReleases.has(key);
                                    const visible = expanded ? entry.items : entry.items.slice(0, 5);
                                    const hidden = entry.items.length - 5;
                                    return (
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {visible.map((item, i) => (
                                                <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#C8C4BE', lineHeight: 1.55 }}>
                                                    <span style={{ color: '#3FB87A', flexShrink: 0, marginTop: '4px', fontSize: '8px' }}>●</span>
                                                    <span style={{ minWidth: 0 }}>{item}</span>
                                                </li>
                                            ))}
                                            {hidden > 0 && (
                                                <li>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpand(key)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#C8A97A', paddingLeft: '16px', fontStyle: 'italic', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                                                    >
                                                        {expanded ? '− mostrar menos' : `+ ${hidden} item(ns)`}
                                                    </button>
                                                </li>
                                            )}
                                        </ul>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C8A97A', boxShadow: '0 0 8px rgba(200,169,122,0.6)' }} />
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700, color: '#F0EDE8' }}>Em desenvolvimento</div>
                    {totalPending > 0 && (
                        <div style={{ fontSize: '11px', color: '#7A7774', marginLeft: '4px' }}>{totalPending} item(ns)</div>
                    )}
                </div>

                {totalPending === 0 ? (
                    <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '32px', textAlign: 'center', fontSize: '12px', color: '#7A7774' }}>
                        Nenhuma pendência registrada no momento.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pending.map((sec, idx) => (
                            <div key={idx} style={{ background: '#0F0F11', border: '1px solid rgba(200,169,122,0.18)', borderRadius: '12px', padding: '18px 20px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#C8A97A', marginBottom: '10px', letterSpacing: '0.02em' }}>
                                    {sec.section}
                                </div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {sec.items.map((item, i) => (
                                        <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#C8C4BE', lineHeight: 1.55 }}>
                                            <span style={{ color: '#C8A97A', flexShrink: 0, marginTop: '3px', fontSize: '10px' }}>○</span>
                                            <span style={{ minWidth: 0 }}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

// ---------- Main Client ----------

export default function ChamadosClient({ userRole }: { userRole: string }) {
    const [activeTab, setActiveTab] = useState<TabKey>('incidents');

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'incidents', label: 'Incidentes' },
        { key: 'timeline', label: 'Linha do Tempo' },
        { key: 'updates', label: 'Atualizações' },
    ];

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
                .tck-row:hover { background: #141417 !important; }
                .tck-btn:hover { background: #E8D5B0 !important; }
                .status-select { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #F0EDE8; border-radius: 4px; padding: 2px 6px; font-size: 11px; outline: none; cursor: pointer; }
                .status-select option { background: #141417; }
                .skeleton-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent); background-size: 200% 100%; animation: shimmer 1.5s infinite linear; }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                .chamados-tab { position: relative; height: 38px; padding: 0 18px; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 600; color: #7A7774; background: transparent; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: color .15s; }
                .chamados-tab:hover { color: #C8C4BE; }
                .chamados-tab.active { color: #F0EDE8; }
                .chamados-tab.active::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; background: #C8A97A; border-radius: 1px; }
            `}</style>

            <div style={{ minHeight: '100vh', background: '#070708', color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", padding: '28px 32px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, color: '#F0EDE8', marginBottom: '4px' }}>Suporte & Acompanhamento</div>
                    <div style={{ fontSize: '12px', color: '#7A7774' }}>Reporte incidentes, acompanhe o histórico de evolução do sistema e veja o que está em desenvolvimento.</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`chamados-tab${activeTab === tab.key ? ' active' : ''}`}
                            type="button"
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'incidents' && <IncidentsTab userRole={userRole} />}
                {activeTab === 'timeline' && <TimelineTab />}
                {activeTab === 'updates' && <UpdatesTab />}
            </div>
        </>
    );
}
