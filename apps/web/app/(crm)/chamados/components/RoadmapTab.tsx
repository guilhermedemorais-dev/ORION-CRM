'use client';

// Linha do Tempo (Roadmap) — painel de gestão do projeto.
// Cliente (ADMIN) acompanha o que está sendo construído, aprova/reprova,
// comenta e anexa arquivos. ROOT cria/edita os items.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, MessageSquare, Plus, Trash2, ThumbsUp, ThumbsDown, X, Check, Edit2, Send, ChevronDown, ChevronRight, Reply } from 'lucide-react';

type StatusKey =
    | 'PLANEJADO'
    | 'AGUARDANDO_APROVACAO'
    | 'APROVADO'
    | 'EM_ANDAMENTO'
    | 'PARADO'
    | 'CONCLUIDO'
    | 'REPROVADO';

interface RoadmapItem {
    id: string;
    title: string;
    description: string;
    technical_details: string | null;
    status: StatusKey;
    due_date: string | null;
    approval_state: 'PENDING' | 'APPROVED' | 'REPROVED';
    approval_at: string | null;
    approval_by: string | null;
    approval_by_name: string | null;
    created_by: string | null;
    created_by_name: string | null;
    created_by_ai: boolean;
    created_at: string;
    updated_at: string;
    comments_count: number;
    attachments_count: number;
}

interface RoadmapComment {
    id: string;
    item_id: string;
    parent_comment_id: string | null;
    body: string;
    author_id: string;
    author_name: string;
    author_role: string;
    created_at: string;
}

interface RoadmapReaction {
    comment_id: string;
    user_id: string;
    agree: boolean;
    user_name: string;
}

interface RoadmapAttachment {
    id: string;
    item_id: string | null;
    comment_id: string | null;
    file_url: string;
    file_name: string;
    file_type: string;
    file_size: number;
    uploaded_by: string;
    uploaded_by_name: string;
    created_at: string;
}

interface RoadmapItemDetail extends RoadmapItem {
    comments: RoadmapComment[];
    reactions: RoadmapReaction[];
    attachments: RoadmapAttachment[];
}

const STATUS_META: Record<StatusKey, { label: string; emoji: string; color: string; bg: string }> = {
    PLANEJADO:            { label: 'Planejado',                   emoji: '📋', color: '#A8A4A0', bg: 'rgba(168,164,160,0.10)' },
    AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação',        emoji: '⏳', color: '#F0A040', bg: 'rgba(240,160,64,0.10)' },
    APROVADO:             { label: 'Aprovado',                    emoji: '✅', color: '#4CAF82', bg: 'rgba(76,175,130,0.10)' },
    EM_ANDAMENTO:         { label: 'Em andamento',                emoji: '🔨', color: '#5B9CF6', bg: 'rgba(91,156,246,0.10)' },
    PARADO:               { label: 'Parado',                      emoji: '⏸️', color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)' },
    CONCLUIDO:            { label: 'Concluído',                   emoji: '🎉', color: '#C8A97A', bg: 'rgba(200,169,122,0.10)' },
    REPROVADO:            { label: 'Reprovado',                   emoji: '❌', color: '#E05252', bg: 'rgba(224,82,82,0.10)' },
};

const STATUS_ORDER: StatusKey[] = [
    'PLANEJADO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'EM_ANDAMENTO', 'PARADO', 'CONCLUIDO', 'REPROVADO',
];

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('pt-BR');
    } catch { return iso; }
}

function fmtRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const min = Math.floor(diffMs / 60000);
        if (min < 1) return 'agora';
        if (min < 60) return `${min}min atrás`;
        const h = Math.floor(min / 60);
        if (h < 24) return `${h}h atrás`;
        const days = Math.floor(h / 24);
        if (days < 7) return `${days}d atrás`;
        return d.toLocaleDateString('pt-BR');
    } catch { return iso; }
}

// ── Renderer de markdown muito simples (parágrafos + ## + listas + **bold**) ─
function renderMarkdown(source: string | null | undefined): React.ReactNode {
    if (!source) return null;
    const lines = source.split('\n');
    const blocks: React.ReactNode[] = [];
    let para: string[] = [];
    let list: string[] = [];

    const flushPara = (key: string) => {
        if (para.length === 0) return;
        blocks.push(
            <p key={key} style={{ margin: '0 0 8px', color: '#C8C4BE', fontSize: '12px', lineHeight: 1.6 }}>
                {renderInline(para.join(' '))}
            </p>,
        );
        para = [];
    };
    const flushList = (key: string) => {
        if (list.length === 0) return;
        blocks.push(
            <ul key={key} style={{ margin: '0 0 8px 18px', padding: 0, color: '#C8C4BE', fontSize: '12px', lineHeight: 1.6 }}>
                {list.map((l, i) => <li key={i}>{renderInline(l)}</li>)}
            </ul>,
        );
        list = [];
    };

    lines.forEach((rawLine, idx) => {
        const line = rawLine.trimEnd();
        if (line.startsWith('## ')) {
            flushPara(`p-${idx}`); flushList(`l-${idx}`);
            blocks.push(
                <h3 key={`h-${idx}`} style={{ margin: '12px 0 6px', fontSize: '13px', fontWeight: 700, color: '#F0EDE8' }}>
                    {renderInline(line.slice(3))}
                </h3>,
            );
        } else if (line.startsWith('# ')) {
            flushPara(`p-${idx}`); flushList(`l-${idx}`);
            blocks.push(
                <h2 key={`h2-${idx}`} style={{ margin: '12px 0 6px', fontSize: '14px', fontWeight: 700, color: '#F0EDE8' }}>
                    {renderInline(line.slice(2))}
                </h2>,
            );
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            flushPara(`p-${idx}`);
            list.push(line.slice(2));
        } else if (line.trim() === '') {
            flushPara(`p-${idx}`); flushList(`l-${idx}`);
        } else {
            para.push(line);
        }
    });
    flushPara('p-end'); flushList('l-end');
    return <>{blocks}</>;
}

function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        parts.push(<strong key={key++} style={{ color: '#F0EDE8', fontWeight: 700 }}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}

// ─── Card de item ────────────────────────────────────────────────────────────

function RoadmapItemCard({
    item, userId, userRole, onChanged,
}: {
    item: RoadmapItem;
    userId: string;
    userRole: string;
    onChanged: () => void;
}) {
    const meta = STATUS_META[item.status];
    const [expanded, setExpanded] = useState(false);
    const [techExpanded, setTechExpanded] = useState(false);
    const [detail, setDetail] = useState<RoadmapItemDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isRoot = userRole === 'ROOT';
    const isAdmin = userRole === 'ADMIN' || userRole === 'ROOT';

    const loadDetail = useCallback(async () => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/internal/roadmap/items/${item.id}`);
            if (res.ok) {
                const data = await res.json();
                setDetail(data.data ?? null);
            }
        } finally {
            setLoadingDetail(false);
        }
    }, [item.id]);

    useEffect(() => {
        if (expanded && !detail && !loadingDetail) {
            void loadDetail();
        }
    }, [expanded, detail, loadingDetail, loadDetail]);

    const changeStatus = async (newStatus: StatusKey) => {
        await fetch(`/api/internal/roadmap/items/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        onChanged();
    };

    const approve = async (approve: boolean) => {
        await fetch(`/api/internal/roadmap/items/${item.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approve }),
        });
        onChanged();
        await loadDetail();
    };

    const deleteItem = async () => {
        if (!window.confirm(`Excluir item "${item.title}"? Esta ação não pode ser desfeita.`)) return;
        await fetch(`/api/internal/roadmap/items/${item.id}`, { method: 'DELETE' });
        onChanged();
    };

    const submitComment = async (parentId: string | null) => {
        if (!newComment.trim()) return;
        await fetch(`/api/internal/roadmap/items/${item.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: newComment.trim(), parent_comment_id: parentId }),
        });
        setNewComment('');
        setReplyingTo(null);
        await loadDetail();
        onChanged();
    };

    const deleteComment = async (commentId: string) => {
        if (!window.confirm('Excluir este comentário?')) return;
        await fetch(`/api/internal/roadmap/items/${item.id}/comments/${commentId}`, { method: 'DELETE' });
        await loadDetail();
        onChanged();
    };

    const react = async (commentId: string, agree: boolean) => {
        const myReaction = detail?.reactions.find((r) => r.comment_id === commentId && r.user_id === userId);
        if (myReaction?.agree === agree) {
            // Já reagi assim — remove
            await fetch(`/api/internal/roadmap/comments/${commentId}/reaction`, { method: 'DELETE' });
        } else {
            await fetch(`/api/internal/roadmap/comments/${commentId}/reaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agree }),
            });
        }
        await loadDetail();
    };

    const uploadFile = async (file: File, targetCommentId: string | null) => {
        const fd = new FormData();
        fd.append('file', file);
        const url = targetCommentId
            ? `/api/internal/roadmap/comments/${targetCommentId}/attachments`
            : `/api/internal/roadmap/items/${item.id}/attachments`;
        const res = await fetch(url, { method: 'POST', body: fd });
        if (!res.ok) {
            alert('Falha ao anexar arquivo. Verifique tamanho (max 10MB) e tipo (PNG, JPG, MP4, PDF).');
            return;
        }
        await loadDetail();
        onChanged();
    };

    const dueAlert = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'CONCLUIDO' && item.status !== 'REPROVADO';

    return (
        <div style={{
            background: '#0F0F11',
            border: `1px solid ${expanded ? 'rgba(200,169,122,0.30)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '12px',
            padding: '16px 18px',
            transition: 'border-color 0.15s',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {item.created_by_ai && (
                            <span title="Criado por IA (Claude)" style={{
                                fontSize: '9px', fontWeight: 700, color: '#A78BFA', background: 'rgba(167,139,250,0.12)',
                                padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>IA</span>
                        )}
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '10px', fontWeight: 700, color: meta.color, background: meta.bg,
                            padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                            <span>{meta.emoji}</span>{meta.label}
                        </span>
                        {item.due_date && (
                            <span style={{ fontSize: '11px', color: dueAlert ? '#E05252' : '#7A7774', fontWeight: dueAlert ? 700 : 500 }}>
                                📅 {fmtDate(item.due_date)}
                            </span>
                        )}
                        <span style={{ fontSize: '10px', color: '#7A7774' }}>
                            criado {fmtRelative(item.created_at)}{item.created_by_name ? ` por ${item.created_by_name}` : ''}
                        </span>
                    </div>

                    <h3 style={{
                        margin: 0, fontFamily: "'Playfair Display', serif",
                        fontSize: '16px', fontWeight: 700, color: '#F0EDE8', lineHeight: 1.3,
                    }}>
                        {item.title}
                    </h3>
                </div>

                {/* Status dropdown — só ROOT vê */}
                {isRoot && (
                    <select
                        value={item.status}
                        onChange={(e) => void changeStatus(e.target.value as StatusKey)}
                        aria-label={`Mudar status de ${item.title}`}
                        style={{
                            background: '#141417', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#F0EDE8', borderRadius: '6px', padding: '4px 8px', fontSize: '11px',
                            outline: 'none', cursor: 'pointer', flexShrink: 0,
                        }}
                    >
                        {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Descrição (sempre visível) */}
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#C8C4BE', lineHeight: 1.6 }}>
                {item.description}
            </p>

            {/* Toggle expandir */}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'transparent', border: 'none', color: '#C8A97A',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: expanded ? '12px' : 0,
                }}
            >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {expanded ? 'Recolher' : 'Ver detalhes, comentários e anexos'}
                {(item.comments_count > 0 || item.attachments_count > 0) && (
                    <span style={{ color: '#7A7774', fontWeight: 500 }}>
                        ({item.comments_count} 💬 · {item.attachments_count} 📎)
                    </span>
                )}
            </button>

            {expanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    {/* Detalhes técnicos colapsável */}
                    {item.technical_details && (
                        <div style={{ marginBottom: '14px' }}>
                            <button
                                type="button"
                                onClick={() => setTechExpanded((v) => !v)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    background: 'transparent', border: 'none', color: '#A78BFA',
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0,
                                }}
                            >
                                {techExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                Detalhes técnicos
                            </button>
                            {techExpanded && (
                                <div style={{
                                    marginTop: '8px', padding: '10px 12px',
                                    background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.20)',
                                    borderRadius: '7px',
                                }}>
                                    {renderMarkdown(item.technical_details)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botões de aprovação — só ADMIN/ROOT */}
                    {isAdmin && item.approval_state === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                            <button
                                type="button"
                                onClick={() => void approve(true)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    height: '32px', padding: '0 14px', borderRadius: '7px',
                                    background: 'rgba(76,175,130,0.12)', border: '1px solid rgba(76,175,130,0.35)',
                                    color: '#4CAF82', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                <Check size={14} /> Aprovar
                            </button>
                            <button
                                type="button"
                                onClick={() => void approve(false)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    height: '32px', padding: '0 14px', borderRadius: '7px',
                                    background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.30)',
                                    color: '#E05252', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                <X size={14} /> Reprovar
                            </button>
                        </div>
                    )}

                    {item.approval_state !== 'PENDING' && (
                        <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#7A7774' }}>
                            {item.approval_state === 'APPROVED' ? '✅ Aprovado' : '❌ Reprovado'}
                            {item.approval_by_name ? ` por ${item.approval_by_name}` : ''}
                            {item.approval_at ? ` em ${fmtDate(item.approval_at)}` : ''}
                        </p>
                    )}

                    {/* Anexos do item */}
                    {detail?.attachments.filter((a) => a.item_id).length ? (
                        <div style={{ marginBottom: '14px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#7A7774', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                                Anexos
                            </p>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {detail.attachments.filter((a) => a.item_id).map((a) => (
                                    <a
                                        key={a.id}
                                        href={a.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 10px', borderRadius: '6px',
                                            background: '#141417', border: '1px solid rgba(255,255,255,0.10)',
                                            color: '#C8C4BE', fontSize: '11px', textDecoration: 'none',
                                        }}
                                    >
                                        <Paperclip size={12} /> {a.file_name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Comentários */}
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#7A7774', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                                <MessageSquare size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                                Comentários ({detail?.comments.length ?? 0})
                            </p>
                            {isRoot && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                                        color: '#C8C4BE', fontSize: '11px', borderRadius: '6px',
                                        padding: '4px 10px', cursor: 'pointer',
                                    }}
                                >
                                    <Paperclip size={11} /> Anexar ao item
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void uploadFile(f, null);
                                    e.target.value = '';
                                }}
                            />
                        </div>

                        {loadingDetail && <p style={{ fontSize: '11px', color: '#7A7774' }}>Carregando...</p>}

                        {detail && detail.comments.length === 0 && (
                            <p style={{ fontSize: '11px', color: '#7A7774', fontStyle: 'italic' }}>Sem comentários ainda.</p>
                        )}

                        {detail && (
                            <CommentThread
                                comments={detail.comments}
                                reactions={detail.reactions}
                                attachments={detail.attachments}
                                userId={userId}
                                userRole={userRole}
                                onReply={(commentId) => setReplyingTo(commentId)}
                                onDelete={(commentId) => void deleteComment(commentId)}
                                onReact={(commentId, agree) => void react(commentId, agree)}
                                onUploadToComment={(commentId, file) => void uploadFile(file, commentId)}
                            />
                        )}
                    </div>

                    {/* Form novo comentário */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={replyingTo ? 'Respondendo... escreva sua resposta' : 'Adicionar comentário...'}
                            rows={2}
                            style={{
                                flex: 1, background: '#141417', border: '1px solid rgba(255,255,255,0.10)',
                                color: '#F0EDE8', borderRadius: '7px', padding: '8px 10px',
                                fontSize: '12px', fontFamily: 'inherit', resize: 'vertical',
                                outline: 'none', minHeight: '60px',
                            }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {replyingTo && (
                                <button
                                    type="button"
                                    onClick={() => { setReplyingTo(null); setNewComment(''); }}
                                    aria-label="Cancelar resposta"
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '6px',
                                        background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                                        color: '#7A7774', fontSize: '12px', cursor: 'pointer',
                                    }}
                                >
                                    <X size={14} style={{ verticalAlign: 'middle' }} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => void submitComment(replyingTo)}
                                disabled={!newComment.trim()}
                                aria-label="Enviar comentário"
                                style={{
                                    width: '32px', height: '32px', borderRadius: '6px',
                                    background: newComment.trim() ? '#C8A97A' : '#202024',
                                    border: 'none', color: newComment.trim() ? '#0A0A0C' : '#4A4A52',
                                    cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                                }}
                            >
                                <Send size={14} style={{ verticalAlign: 'middle' }} />
                            </button>
                        </div>
                    </div>

                    {/* Ações ROOT (editar/excluir) */}
                    {isRoot && (
                        <div style={{ marginTop: '12px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                                    color: '#C8C4BE', fontSize: '11px', borderRadius: '6px',
                                    padding: '4px 10px', cursor: 'pointer',
                                }}
                            >
                                <Edit2 size={11} /> Editar
                            </button>
                            <button
                                type="button"
                                onClick={() => void deleteItem()}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    background: 'transparent', border: '1px solid rgba(224,82,82,0.30)',
                                    color: '#E05252', fontSize: '11px', borderRadius: '6px',
                                    padding: '4px 10px', cursor: 'pointer',
                                }}
                            >
                                <Trash2 size={11} /> Excluir
                            </button>
                        </div>
                    )}
                </div>
            )}

            {editing && (
                <ItemEditor
                    item={item}
                    onClose={() => setEditing(false)}
                    onSaved={() => { setEditing(false); onChanged(); }}
                />
            )}
        </div>
    );
}

// ─── Thread de comentários ───────────────────────────────────────────────────

function CommentThread({
    comments, reactions, attachments, userId, userRole,
    onReply, onDelete, onReact, onUploadToComment,
}: {
    comments: RoadmapComment[];
    reactions: RoadmapReaction[];
    attachments: RoadmapAttachment[];
    userId: string;
    userRole: string;
    onReply: (commentId: string) => void;
    onDelete: (commentId: string) => void;
    onReact: (commentId: string, agree: boolean) => void;
    onUploadToComment: (commentId: string, file: File) => void;
}) {
    const tree = useMemo(() => {
        const byParent = new Map<string | null, RoadmapComment[]>();
        for (const c of comments) {
            const key = c.parent_comment_id;
            if (!byParent.has(key)) byParent.set(key, []);
            byParent.get(key)!.push(c);
        }
        return byParent;
    }, [comments]);

    const reactionsByComment = useMemo(() => {
        const map = new Map<string, { agree: number; disagree: number; mine: boolean | null }>();
        for (const r of reactions) {
            const cur = map.get(r.comment_id) ?? { agree: 0, disagree: 0, mine: null };
            if (r.agree) cur.agree += 1; else cur.disagree += 1;
            if (r.user_id === userId) cur.mine = r.agree;
            map.set(r.comment_id, cur);
        }
        return map;
    }, [reactions, userId]);

    const renderNode = (comment: RoadmapComment, depth: number): React.ReactNode => {
        const replies = tree.get(comment.id) ?? [];
        const rx = reactionsByComment.get(comment.id);
        const isRoot = userRole === 'ROOT';
        const canDelete = comment.author_id === userId || isRoot;
        const myAttachments = attachments.filter((a) => a.comment_id === comment.id);

        return (
            <div key={comment.id} style={{
                marginLeft: depth > 0 ? '24px' : 0,
                marginTop: '8px',
                borderLeft: depth > 0 ? '2px solid rgba(255,255,255,0.06)' : 'none',
                paddingLeft: depth > 0 ? '10px' : 0,
            }}>
                <div style={{
                    background: '#141417', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '7px', padding: '8px 10px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#F0EDE8' }}>
                            {comment.author_name}
                        </span>
                        <span style={{
                            fontSize: '9px', fontWeight: 700,
                            color: comment.author_role === 'ROOT' ? '#C8A97A' : comment.author_role === 'ADMIN' ? '#5B9CF6' : '#7A7774',
                            background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px',
                            letterSpacing: '0.06em',
                        }}>
                            {comment.author_role}
                        </span>
                        <span style={{ fontSize: '10px', color: '#7A7774' }}>· {fmtRelative(comment.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#E8E4DE', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {comment.body}
                    </p>

                    {myAttachments.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {myAttachments.map((a) => (
                                <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 7px', borderRadius: '5px',
                                        background: 'rgba(200,169,122,0.08)', border: '1px solid rgba(200,169,122,0.20)',
                                        color: '#C8A97A', fontSize: '10px', textDecoration: 'none',
                                    }}>
                                    <Paperclip size={10} /> {a.file_name}
                                </a>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => onReply(comment.id)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                background: 'transparent', border: 'none', color: '#7A7774',
                                fontSize: '10px', cursor: 'pointer', padding: 0,
                            }}
                        >
                            <Reply size={10} /> Responder
                        </button>

                        {/* Reações — só ROOT pode reagir */}
                        {isRoot && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onReact(comment.id, true)}
                                    title="Concordo com a sugestão"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        background: rx?.mine === true ? 'rgba(76,175,130,0.18)' : 'transparent',
                                        border: '1px solid rgba(76,175,130,0.30)',
                                        color: '#4CAF82', fontSize: '10px', borderRadius: '4px',
                                        padding: '2px 6px', cursor: 'pointer',
                                    }}
                                >
                                    <ThumbsUp size={10} /> {rx?.agree ?? 0}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onReact(comment.id, false)}
                                    title="Não vou seguir essa sugestão"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        background: rx?.mine === false ? 'rgba(224,82,82,0.16)' : 'transparent',
                                        border: '1px solid rgba(224,82,82,0.30)',
                                        color: '#E05252', fontSize: '10px', borderRadius: '4px',
                                        padding: '2px 6px', cursor: 'pointer',
                                    }}
                                >
                                    <ThumbsDown size={10} /> {rx?.disagree ?? 0}
                                </button>
                            </>
                        )}

                        <UploadCommentButton onUpload={(f) => onUploadToComment(comment.id, f)} />

                        {canDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(comment.id)}
                                title="Excluir comentário"
                                style={{
                                    background: 'transparent', border: 'none', color: '#7A7774',
                                    fontSize: '10px', cursor: 'pointer', padding: 0,
                                    marginLeft: 'auto',
                                }}
                            >
                                <Trash2 size={10} />
                            </button>
                        )}
                    </div>
                </div>

                {replies.map((r) => renderNode(r, depth + 1))}
            </div>
        );
    };

    const roots = tree.get(null) ?? [];
    if (roots.length === 0) return null;
    return <div>{roots.map((c) => renderNode(c, 0))}</div>;
}

function UploadCommentButton({ onUpload }: { onUpload: (file: File) => void }) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <>
            <button
                type="button"
                onClick={() => ref.current?.click()}
                title="Anexar arquivo"
                style={{
                    background: 'transparent', border: 'none', color: '#7A7774',
                    fontSize: '10px', cursor: 'pointer', padding: 0,
                }}
            >
                <Paperclip size={10} />
            </button>
            <input
                ref={ref}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = '';
                }}
            />
        </>
    );
}

// ─── Editor (criar/editar) ───────────────────────────────────────────────────

function ItemEditor({
    item, onClose, onSaved,
}: {
    item: RoadmapItem | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [title, setTitle] = useState(item?.title ?? '');
    const [description, setDescription] = useState(item?.description ?? '');
    const [technicalDetails, setTechnicalDetails] = useState(item?.technical_details ?? '');
    const [status, setStatus] = useState<StatusKey>(item?.status ?? 'PLANEJADO');
    const [dueDate, setDueDate] = useState(item?.due_date ? item.due_date.slice(0, 10) : '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!title.trim() || !description.trim()) {
            alert('Título e descrição são obrigatórios.');
            return;
        }
        setSaving(true);
        try {
            const url = item ? `/api/internal/roadmap/items/${item.id}` : '/api/internal/roadmap/items';
            const method = item ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    technical_details: technicalDetails.trim() || null,
                    status,
                    due_date: dueDate || null,
                }),
            });
            if (!res.ok) {
                alert('Erro ao salvar.');
                return;
            }
            onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: '#141417', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '12px', width: '100%', maxWidth: '640px',
                maxHeight: '90vh', overflowY: 'auto', padding: '24px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 600, color: '#F0EDE8' }}>
                        {item ? 'Editar item' : 'Novo item do roadmap'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        style={{
                            width: '28px', height: '28px', background: 'transparent',
                            border: 'none', color: '#7A7774', cursor: 'pointer', borderRadius: '5px',
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'grid', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                            Título *
                        </label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Sistema de matérias-primas na OS"
                            style={{
                                width: '100%', height: '36px', background: '#1A1A1E',
                                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                padding: '0 12px', color: '#F0EDE8', fontSize: '13px', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                            Descrição (linguagem leiga) *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explique pro cliente em linguagem simples o que vai ser feito."
                            rows={4}
                            style={{
                                width: '100%', background: '#1A1A1E',
                                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                padding: '10px 12px', color: '#F0EDE8', fontSize: '13px', outline: 'none',
                                resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                            Detalhes técnicos (markdown, opcional)
                        </label>
                        <textarea
                            value={technicalDetails}
                            onChange={(e) => setTechnicalDetails(e.target.value)}
                            placeholder="## Backend&#10;- migração X&#10;- endpoint Y&#10;&#10;## Frontend..."
                            rows={6}
                            style={{
                                width: '100%', background: '#1A1A1E',
                                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                padding: '10px 12px', color: '#F0EDE8', fontSize: '12px', outline: 'none',
                                resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                                Status
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as StatusKey)}
                                aria-label="Status"
                                style={{
                                    width: '100%', height: '36px', background: '#1A1A1E',
                                    border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                    padding: '0 10px', color: '#F0EDE8', fontSize: '13px', outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {STATUS_ORDER.map((s) => (
                                    <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#E8E4DE', marginBottom: '4px' }}>
                                Prazo previsto
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                aria-label="Prazo previsto"
                                style={{
                                    width: '100%', height: '36px', background: '#1A1A1E',
                                    border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px',
                                    padding: '0 12px', color: '#F0EDE8', fontSize: '13px', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '22px' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            height: '34px', padding: '0 16px', borderRadius: '7px',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#C8C4BE', fontSize: '12px', cursor: 'pointer',
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || !title.trim() || !description.trim()}
                        style={{
                            height: '34px', padding: '0 18px', borderRadius: '7px',
                            background: '#C8A97A', border: 'none', color: '#0A0A0C',
                            fontSize: '12px', fontWeight: 700,
                            cursor: saving || !title.trim() || !description.trim() ? 'not-allowed' : 'pointer',
                            opacity: saving || !title.trim() || !description.trim() ? 0.5 : 1,
                        }}
                    >
                        {saving ? 'Salvando...' : (item ? 'Salvar' : 'Criar item')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RoadmapTab({ userId, userRole }: { userId: string; userRole: string }) {
    const [items, setItems] = useState<RoadmapItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const isRoot = userRole === 'ROOT';

    const fetchItems = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/roadmap/items');
            if (!res.ok) throw new Error('Erro ao carregar roadmap');
            const data = await res.json();
            setItems(Array.isArray(data?.data) ? data.data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchItems(); }, [fetchItems]);

    // Agrupa por status na ordem definida (mais novo no topo dentro de cada grupo).
    // Como já vem ordenado por created_at DESC do backend, basta agrupar.
    const grouped = useMemo(() => {
        const map = new Map<StatusKey, RoadmapItem[]>();
        for (const status of STATUS_ORDER) map.set(status, []);
        for (const item of items) {
            map.get(item.status)?.push(item);
        }
        return map;
    }, [items]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                        background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px', height: '120px', position: 'relative', overflow: 'hidden',
                    }}>
                        <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                background: '#0F0F11', border: '1px solid rgba(239,68,68,0.30)',
                borderRadius: '12px', padding: '30px', textAlign: 'center',
            }}>
                <p style={{ color: '#EF4444', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>
                <button
                    type="button"
                    onClick={() => void fetchItems()}
                    style={{
                        height: '32px', padding: '0 14px', borderRadius: '7px',
                        background: 'transparent', border: '1px solid rgba(200,169,122,0.50)',
                        color: '#C8A97A', fontSize: '12px', cursor: 'pointer',
                    }}
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 600, color: '#F0EDE8' }}>
                        Roadmap do Projeto
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#7A7774' }}>
                        Acompanhe o que está sendo construído. Aprove planos, comente e veja o que já foi entregue.
                    </p>
                </div>
                {isRoot && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            height: '36px', padding: '0 14px', borderRadius: '7px',
                            background: '#C8A97A', border: 'none', color: '#0A0A0C',
                            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        <Plus size={14} /> Novo item
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <div style={{
                    background: '#0F0F11', border: '1px dashed rgba(255,255,255,0.10)',
                    borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', marginBottom: '10px' }}>📋</div>
                    <p style={{ fontSize: '13px', color: '#C8C4BE', margin: '0 0 4px', fontWeight: 600 }}>
                        Nenhum item no roadmap ainda
                    </p>
                    <p style={{ fontSize: '11px', color: '#7A7774', margin: 0 }}>
                        {isRoot ? 'Clique em "Novo item" para registrar o primeiro plano.' : 'Aguarde — em breve aparecerão aqui os planos do projeto.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {STATUS_ORDER.map((status) => {
                        const list = grouped.get(status) ?? [];
                        if (list.length === 0) return null;
                        const meta = STATUS_META[status];
                        return (
                            <section key={status}>
                                <h3 style={{
                                    margin: '0 0 8px', fontSize: '10px', fontWeight: 700,
                                    color: meta.color, textTransform: 'uppercase', letterSpacing: '0.10em',
                                }}>
                                    {meta.emoji} {meta.label} ({list.length})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {list.map((item) => (
                                        <RoadmapItemCard
                                            key={item.id}
                                            item={item}
                                            userId={userId}
                                            userRole={userRole}
                                            onChanged={fetchItems}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {creating && (
                <ItemEditor
                    item={null}
                    onClose={() => setCreating(false)}
                    onSaved={() => { setCreating(false); void fetchItems(); }}
                />
            )}
        </>
    );
}
