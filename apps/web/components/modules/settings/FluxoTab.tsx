'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Workflow, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/system/ToastProvider';
import { useConfirm } from '@/components/system/ConfirmDialog';

type PaymentRule = 'none' | 'not_overdue' | 'requires_partial' | 'requires_paid_in_full' | 'requires_refunded';
type StageRole = 'none' | 'in_production' | 'finalized' | 'cancelled';
type ActiveModule = 'pedidos' | 'producao';

interface Pipeline {
    id: string;
    name: string;
    slug: string;
}

interface PipelineStage {
    id: string;
    name: string;
    position: number;
    color: string;
}

interface FlowRule {
    stage_id: string;
    stage_name: string;
    stage_position: number;
    stage_color: string;
    payment_rule: PaymentRule;
    stage_role: StageRole;
    notify_on_enter: boolean;
}

interface FlowListItem {
    id: string;
    name: string;
    pipeline_id: string;
    pipeline_name: string;
    pipeline_slug: string;
    active_module: ActiveModule | null;
    description: string | null;
    stage_count: number;
    rule_count: number;
    created_at: string;
    updated_at: string;
}

interface FlowDetail extends FlowListItem {
    rules: FlowRule[];
}

const PAYMENT_RULE_LABEL: Record<PaymentRule, string> = {
    none: 'Sem regra',
    not_overdue: 'Exige não estar inadimplente',
    requires_partial: 'Exige pelo menos sinal pago',
    requires_paid_in_full: 'Exige pagamento total',
    requires_refunded: 'Exige estorno feito',
};

const STAGE_ROLE_LABEL: Record<StageRole, string> = {
    none: '—',
    in_production: 'Em produção (KPI)',
    finalized: 'Finalizado (KPI)',
    cancelled: 'Cancelado (KPI)',
};

const MODULE_LABEL: Record<ActiveModule, string> = {
    pedidos: 'Módulo Pedidos',
    producao: 'Módulo Produção',
};

const cls = {
    panel: 'rounded-2xl border border-white/10 bg-[#111114] p-5',
    field: 'h-10 w-full rounded-[10px] border border-white/10 bg-[#0A0A0C] px-3 text-[13px] text-[#F0EDE8] outline-none placeholder:text-[#555] focus:border-[#C8A97A]/40',
    btnGold: 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] bg-[#C8A97A] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0C] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed',
    btnGhost: 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-white/10 bg-white/5 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C8C4BE] transition hover:border-[#C8A97A]/40 hover:text-[#C8A97A]',
    btnDanger: 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-red-500/20 bg-red-500/10 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400 transition hover:border-red-500/40',
};

// ─── Editor Modal ─────────────────────────────────────────────────────────────

function FlowEditorModal({
    pipelines,
    initial,
    onClose,
    onSaved,
}: {
    pipelines: Pipeline[];
    initial: FlowDetail | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const toast = useToast();
    const isEdit = Boolean(initial);

    const [name, setName] = useState(initial?.name ?? '');
    const [pipelineId, setPipelineId] = useState(initial?.pipeline_id ?? '');
    const [activeModule, setActiveModule] = useState<ActiveModule | ''>(initial?.active_module ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [stages, setStages] = useState<FlowRule[]>(initial?.rules ?? []);
    const [loadingStages, setLoadingStages] = useState(false);
    const [saving, setSaving] = useState(false);

    // Quando troca o pipeline (em modo create), busca etapas
    useEffect(() => {
        if (!pipelineId || isEdit) return;
        let cancelled = false;
        setLoadingStages(true);
        fetch(`/api/internal/pipelines/${pipelineId}/stages`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : Promise.reject(new Error('Falha ao carregar etapas')))
            .then((d: { data?: PipelineStage[] } | PipelineStage[]) => {
                if (cancelled) return;
                const list: PipelineStage[] = Array.isArray(d) ? d : (d.data ?? []);
                setStages(list.sort((a, b) => a.position - b.position).map(s => ({
                    stage_id: s.id,
                    stage_name: s.name,
                    stage_position: s.position,
                    stage_color: s.color,
                    payment_rule: 'none',
                    stage_role: 'none',
                    notify_on_enter: false,
                })));
            })
            .catch(() => { if (!cancelled) toast.push('error', 'Não foi possível carregar as etapas do pipeline.'); })
            .finally(() => { if (!cancelled) setLoadingStages(false); });
        return () => { cancelled = true; };
    }, [pipelineId, isEdit, toast]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose, saving]);

    const updateRule = (stageId: string, patch: Partial<FlowRule>) => {
        setStages(prev => prev.map(s => s.stage_id === stageId ? { ...s, ...patch } : s));
    };

    const handleSave = async () => {
        if (!name.trim()) { toast.push('warning', 'Dê um nome ao fluxo'); return; }
        if (!pipelineId) { toast.push('warning', 'Selecione um pipeline'); return; }
        setSaving(true);

        const payload = {
            name: name.trim(),
            pipeline_id: pipelineId,
            active_module: activeModule || null,
            description: description.trim() || undefined,
            stage_rules: stages.map(s => ({
                stage_id: s.stage_id,
                payment_rule: s.payment_rule,
                stage_role: s.stage_role,
                notify_on_enter: s.notify_on_enter,
            })),
        };

        try {
            const url = isEdit ? `/api/internal/flows/${initial!.id}` : '/api/internal/flows';
            const method = isEdit ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.push('error', d.message ?? 'Falha ao salvar fluxo');
                setSaving(false);
                return;
            }
            toast.push('success', isEdit ? 'Fluxo atualizado' : 'Fluxo criado');
            onSaved();
        } catch {
            toast.push('error', 'Falha de rede ao salvar.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#111114]">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-[#111114] border-b border-white/10 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Workflow size={18} className="text-[#C8A97A]" />
                        <h2 className="text-sm font-semibold text-[#EDE8E0]" style={{ fontFamily: 'Playfair Display, serif' }}>
                            {isEdit ? 'Editar fluxo' : 'Novo fluxo'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-[#888480] hover:text-[#EDE8E0] text-xl leading-none">×</button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Nome */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774] mb-2">Nome do fluxo</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Fluxo Pedidos PE" className={cls.field} />
                    </div>

                    {/* Pipeline base */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774] mb-2">Pipeline base</label>
                        {pipelines.length === 0 ? (
                            <div className="flex items-start gap-2 rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
                                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong>Você ainda não tem pipelines criados.</strong><br />
                                    Vá em <span className="font-mono">Pipeline &gt; Novo Kanban</span> e crie pelo menos um pipeline antes de configurar um fluxo.
                                </div>
                            </div>
                        ) : (
                            <select
                                value={pipelineId}
                                onChange={(e) => setPipelineId(e.target.value)}
                                disabled={isEdit}
                                className={cls.field}
                            >
                                <option value="">Selecione um pipeline...</option>
                                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
                        {isEdit && (
                            <p className="mt-1 text-[10px] text-[#555]">Pipeline não pode ser trocado depois que o fluxo é criado.</p>
                        )}
                    </div>

                    {/* Ativar em módulo */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774] mb-2">Ativar em módulo (opcional)</label>
                        <select value={activeModule} onChange={(e) => setActiveModule(e.target.value as ActiveModule | '')} className={cls.field}>
                            <option value="">Nenhum (rascunho)</option>
                            <option value="pedidos">Módulo Pedidos</option>
                            <option value="producao">Módulo Produção</option>
                        </select>
                        <p className="mt-1 text-[10px] text-[#555]">Apenas 1 fluxo pode estar ativo por módulo. Marcar aqui desativa o anterior.</p>
                    </div>

                    {/* Regras por etapa */}
                    {stages.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Regras por etapa</label>
                            <p className="text-[11px] text-[#7A7774]">Para cada etapa, defina regras opcionais. Vazio = sem restrição.</p>

                            <div className="space-y-2 mt-3">
                                {stages.map(stage => (
                                    <div key={stage.stage_id} className="rounded-[10px] border border-white/10 bg-[#0A0A0C] p-3">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: stage.stage_color }} />
                                            <span className="text-[12px] font-semibold text-[#EDE8E0]">{stage.stage_name}</span>
                                            <span className="text-[10px] text-[#555]">Posição {stage.stage_position}</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-wide text-[#7A7774] mb-1">Regra de pagamento</label>
                                                <select
                                                    value={stage.payment_rule}
                                                    onChange={(e) => updateRule(stage.stage_id, { payment_rule: e.target.value as PaymentRule })}
                                                    className="h-9 w-full rounded-[8px] border border-white/10 bg-[#111114] px-2 text-[12px] text-[#F0EDE8] outline-none"
                                                >
                                                    {(Object.keys(PAYMENT_RULE_LABEL) as PaymentRule[]).map(k => (
                                                        <option key={k} value={k}>{PAYMENT_RULE_LABEL[k]}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-wide text-[#7A7774] mb-1">Conta como (KPI)</label>
                                                <select
                                                    value={stage.stage_role}
                                                    onChange={(e) => updateRule(stage.stage_id, { stage_role: e.target.value as StageRole })}
                                                    className="h-9 w-full rounded-[8px] border border-white/10 bg-[#111114] px-2 text-[12px] text-[#F0EDE8] outline-none"
                                                >
                                                    {(Object.keys(STAGE_ROLE_LABEL) as StageRole[]).map(k => (
                                                        <option key={k} value={k}>{STAGE_ROLE_LABEL[k]}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <label className="flex items-center gap-2 mt-3 text-[11px] text-[#C8C4BE] cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={stage.notify_on_enter}
                                                onChange={(e) => updateRule(stage.stage_id, { notify_on_enter: e.target.checked })}
                                                style={{ accentColor: '#C8A97A' }}
                                            />
                                            Notificar cliente no WhatsApp ao entrar nesta etapa
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {loadingStages && <p className="text-[11px] text-[#7A7774]">Carregando etapas do pipeline...</p>}
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-2 bg-[#111114] border-t border-white/10 px-6 py-4">
                    <button onClick={onClose} className={cls.btnGhost} disabled={saving}>Cancelar</button>
                    <button onClick={handleSave} className={cls.btnGold} disabled={saving || !name.trim() || !pipelineId}>
                        {saving ? 'Salvando…' : 'Salvar fluxo'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main FluxoTab ────────────────────────────────────────────────────────────

export function FluxoTab() {
    const toast = useToast();
    const confirm = useConfirm();
    const [flows, setFlows] = useState<FlowListItem[]>([]);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<FlowDetail | null>(null);
    const [creating, setCreating] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [flowsRes, pipelinesRes] = await Promise.all([
                fetch('/api/internal/flows', { cache: 'no-store' }),
                fetch('/api/internal/pipelines', { cache: 'no-store' }),
            ]);
            if (flowsRes.ok) {
                const d = await flowsRes.json();
                setFlows(d.data ?? []);
            }
            if (pipelinesRes.ok) {
                const d = await pipelinesRes.json();
                const list = Array.isArray(d) ? d : (d.data ?? []);
                setPipelines(list);
            }
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    const handleEdit = async (flowId: string) => {
        try {
            const res = await fetch(`/api/internal/flows/${flowId}`, { cache: 'no-store' });
            if (!res.ok) { toast.push('error', 'Falha ao carregar fluxo'); return; }
            const detail = await res.json();
            setEditing(detail);
        } catch { toast.push('error', 'Falha de rede'); }
    };

    const handleDelete = async (flow: FlowListItem) => {
        const ok = await confirm({
            title: `Excluir fluxo "${flow.name}"?`,
            description: 'Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'destructive',
        });
        if (!ok) return;
        const res = await fetch(`/api/internal/flows/${flow.id}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            toast.push('error', d.message ?? 'Falha ao excluir');
            return;
        }
        toast.push('success', 'Fluxo excluído');
        void fetchAll();
    };

    return (
        <div className={`${cls.panel}`}>
            <div className="flex items-end justify-between mb-5">
                <div>
                    <h2 className="text-base font-semibold text-[#EDE8E0]" style={{ fontFamily: 'Playfair Display, serif' }}>Fluxos</h2>
                    <p className="mt-1 text-[11px] text-[#7A7774]">
                        Configure como cada módulo do sistema usa os pipelines: etapas, regras de pagamento e notificações automáticas.
                    </p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className={cls.btnGold}
                    disabled={pipelines.length === 0}
                    title={pipelines.length === 0 ? 'Crie um pipeline primeiro' : undefined}
                >
                    <Plus size={13} /> Novo fluxo
                </button>
            </div>

            {pipelines.length === 0 && !loading && (
                <div className="flex items-start gap-2 rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 mb-4">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <strong>Nenhum pipeline cadastrado ainda.</strong><br />
                        Crie um pipeline em <span className="font-mono">Pipeline &gt; Novo Kanban</span> antes de configurar fluxos.
                    </div>
                </div>
            )}

            {loading ? (
                <p className="text-xs text-[#7A7774]">Carregando fluxos…</p>
            ) : flows.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-white/10 px-4 py-10 text-center">
                    <Workflow size={28} className="mx-auto text-[#555] mb-2" />
                    <p className="text-xs text-[#7A7774]">Nenhum fluxo criado.</p>
                    {pipelines.length > 0 && (
                        <p className="text-[10px] text-[#555] mt-1">Clique em &quot;Novo fluxo&quot; para começar.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {flows.map(flow => (
                        <div
                            key={flow.id}
                            onClick={() => handleEdit(flow.id)}
                            className="cursor-pointer rounded-[10px] border border-white/10 bg-[#0A0A0C] p-4 transition hover:border-[#C8A97A]/30"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-semibold text-[#EDE8E0]">{flow.name}</span>
                                        {flow.active_module && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-[#C8A97A]/30 bg-[#C8A97A]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#C8A97A]">
                                                Ativo em {MODULE_LABEL[flow.active_module]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-[11px] text-[#7A7774]">
                                        Pipeline: <span className="text-[#C8C4BE]">{flow.pipeline_name}</span> · {flow.stage_count} etapa(s) · {flow.rule_count} regra(s)
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); void handleDelete(flow); }}
                                    className="text-[#7A7774] hover:text-rose-400 transition-colors"
                                    title="Excluir fluxo"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {creating && (
                <FlowEditorModal
                    pipelines={pipelines}
                    initial={null}
                    onClose={() => setCreating(false)}
                    onSaved={() => { setCreating(false); void fetchAll(); }}
                />
            )}
            {editing && (
                <FlowEditorModal
                    pipelines={pipelines}
                    initial={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); void fetchAll(); }}
                />
            )}
        </div>
    );
}
