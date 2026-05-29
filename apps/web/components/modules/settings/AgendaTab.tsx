'use client';

// Aba "Agenda" em Ajustes — configura o pipeline padrão dos agendamentos.
// Se não configurado, agendamentos continuam funcionando mas sem vínculo
// a pipeline. Configurar permite que cada agendamento vire/atualize um
// lead naquele pipeline automaticamente.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Check, Clock, Loader2, Save } from 'lucide-react';

interface PipelineOption {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
}

interface StageOption {
    id: string;
    name: string;
    position: number;
    color: string | null;
}

interface AgendaSettings {
    default_appointment_pipeline_id: string | null;
    default_appointment_stage_id: string | null;
    default_appointment_duration_minutes: number | null;
    pipeline_name: string | null;
    pipeline_slug: string | null;
    stage_name: string | null;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
const DEFAULT_DURATION = 60;
const MIN_DURATION = 5;
const MAX_DURATION = 480;

export function AgendaTab() {
    const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
    const [stages, setStages] = useState<StageOption[]>([]);
    const [current, setCurrent] = useState<AgendaSettings | null>(null);
    const [selectedId, setSelectedId] = useState<string>('');
    const [selectedStageId, setSelectedStageId] = useState<string>('');
    const [durationMinutes, setDurationMinutes] = useState<number>(60);
    const [durationError, setDurationError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingStages, setLoadingStages] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

    const showToast = useCallback((kind: 'success' | 'error', msg: string) => {
        setToast({ kind, msg });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [pipelinesRes, settingsRes] = await Promise.all([
                fetch('/api/internal/pipelines'),
                fetch('/api/internal/settings/agenda'),
            ]);
            if (!pipelinesRes.ok || !settingsRes.ok) {
                throw new Error('Falha ao carregar dados.');
            }
            const pipelinesData = await pipelinesRes.json();
            const settingsData = await settingsRes.json();
            const list = Array.isArray(pipelinesData?.data) ? pipelinesData.data : [];
            setPipelines(list.filter((p: PipelineOption) => p.is_active));
            setCurrent(settingsData);
            setSelectedId(settingsData?.default_appointment_pipeline_id ?? '');
            setSelectedStageId(settingsData?.default_appointment_stage_id ?? '');
            setDurationMinutes(
                Number.isFinite(settingsData?.default_appointment_duration_minutes)
                    ? Number(settingsData.default_appointment_duration_minutes)
                    : DEFAULT_DURATION
            );
            setDurationError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Carrega etapas quando muda o pipeline selecionado
    useEffect(() => {
        if (!selectedId) {
            setStages([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoadingStages(true);
            try {
                const res = await fetch(`/api/internal/pipelines/${selectedId}/stages`);
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                const list = Array.isArray(data?.data) ? data.data : [];
                setStages(list);
            } catch {
                // silent
            } finally {
                if (!cancelled) setLoadingStages(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedId]);

    // Quando muda o pipeline, limpa a stage se ela não pertencer ao novo pipeline
    useEffect(() => {
        if (!selectedStageId || stages.length === 0) return;
        if (!stages.find((s) => s.id === selectedStageId)) {
            setSelectedStageId('');
        }
    }, [stages, selectedStageId]);

    const validateDuration = (value: number): string | null => {
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            return 'Informe um número inteiro.';
        }
        if (value < MIN_DURATION) return `Mínimo ${MIN_DURATION} minutos.`;
        if (value > MAX_DURATION) return `Máximo ${MAX_DURATION} minutos (8 horas).`;
        return null;
    };

    const save = async () => {
        const dError = validateDuration(durationMinutes);
        if (dError) {
            setDurationError(dError);
            showToast('error', dError);
            return;
        }
        setDurationError(null);
        setSaving(true);
        try {
            const res = await fetch('/api/internal/settings/agenda', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    default_appointment_pipeline_id: selectedId || null,
                    default_appointment_stage_id: selectedId ? (selectedStageId || null) : null,
                    default_appointment_duration_minutes: durationMinutes,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const fieldDetails = Array.isArray(data?.details) && data.details.length
                    ? data.details.map((d: { field?: string; message?: string }) => d.message).filter(Boolean).join(' ')
                    : null;
                throw new Error(fieldDetails || data?.message || 'Falha ao salvar.');
            }
            showToast('success', selectedId
                ? `Agenda configurada para o pipeline "${pipelines.find(p => p.id === selectedId)?.name ?? '—'}"${selectedStageId ? `, etapa "${stages.find(s => s.id === selectedStageId)?.name ?? '—'}"` : ', primeira etapa'}. Duração padrão: ${durationMinutes} min.`
                : `Pipeline padrão removido. Duração padrão: ${durationMinutes} min.`);
            await load();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const pipelineChanged = selectedId !== (current?.default_appointment_pipeline_id ?? '');
    const stageChanged = (selectedStageId || '') !== (current?.default_appointment_stage_id ?? '');
    const currentDuration = current?.default_appointment_duration_minutes ?? DEFAULT_DURATION;
    const durationChanged = durationMinutes !== currentDuration;
    const hasUnsavedChange = pipelineChanged || stageChanged || durationChanged;
    const isUnconfigured = !current?.default_appointment_pipeline_id;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-[12px] text-[#7A7774]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-[12px] text-rose-400">
                {error}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F0F11] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8A97A]/15">
                    <Calendar className="h-5 w-5 text-[#C8A97A]" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#F0EDE8]">Configurações da Agenda</h3>
                    <p className="mt-0.5 text-[11px] text-[#7A7774]">
                        Defina para qual pipeline os agendamentos novos vão. Sem isso configurado, agendamentos continuam funcionando, mas não vinculam a nenhum pipeline.
                    </p>
                </div>
            </div>

            {/* Aviso quando não configurado */}
            {isUnconfigured && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                        <strong className="font-semibold">Pipeline padrão não configurado.</strong>{' '}
                        Agendamentos continuarão sendo criados, mas não geram automaticamente um card no Kanban.
                        Configure abaixo para que cada novo agendamento entre no pipeline escolhido.
                    </div>
                </div>
            )}

            {/* Form */}
            <div className="rounded-xl border border-white/10 bg-[#0F0F11] p-4">
                <label className="mb-1.5 block text-[11px] font-semibold text-[#A8A4A0]">
                    Pipeline padrão dos agendamentos
                </label>
                <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    aria-label="Pipeline padrão dos agendamentos"
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#15151A] px-3 text-[13px] text-[#F0EDE8] outline-none focus:border-[#C8A97A]/50"
                >
                    <option value="" className="bg-[#15151A]">
                        — Sem pipeline padrão —
                    </option>
                    {pipelines.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#15151A]">
                            {p.name} ({p.slug})
                        </option>
                    ))}
                </select>
                <p className="mt-2 text-[10px] text-[#7A7774]">
                    {selectedId
                        ? `Agendamentos novos vão para o pipeline "${pipelines.find((p) => p.id === selectedId)?.name ?? '—'}".`
                        : 'Agendamentos serão criados sem vínculo a pipeline. Você pode mudar a qualquer momento.'}
                </p>

                {/* Dropdown de etapa — só aparece se um pipeline foi selecionado */}
                {selectedId && (
                    <div className="mt-4">
                        <label className="mb-1.5 block text-[11px] font-semibold text-[#A8A4A0]">
                            Etapa onde o card vai cair
                        </label>
                        {loadingStages ? (
                            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#15151A] px-3 text-[12px] text-[#7A7774]">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando etapas…
                            </div>
                        ) : stages.length === 0 ? (
                            <div className="flex h-10 items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-[11px] text-rose-300">
                                Este pipeline não tem etapas cadastradas. Crie etapas no kanban antes de configurar.
                            </div>
                        ) : (
                            <>
                                <select
                                    value={selectedStageId}
                                    onChange={(e) => setSelectedStageId(e.target.value)}
                                    aria-label="Etapa padrão dos agendamentos"
                                    className="h-10 w-full rounded-lg border border-white/10 bg-[#15151A] px-3 text-[13px] text-[#F0EDE8] outline-none focus:border-[#C8A97A]/50"
                                >
                                    <option value="" className="bg-[#15151A]">
                                        — Primeira etapa do pipeline (padrão) —
                                    </option>
                                    {stages
                                        .slice()
                                        .sort((a, b) => a.position - b.position)
                                        .map((s) => (
                                            <option key={s.id} value={s.id} className="bg-[#15151A]">
                                                {s.name}
                                            </option>
                                        ))}
                                </select>
                                <p className="mt-2 text-[10px] text-[#7A7774]">
                                    {selectedStageId
                                        ? `Cards novos caem na etapa "${stages.find(s => s.id === selectedStageId)?.name ?? '—'}".`
                                        : 'Sem etapa específica escolhida — vai pra primeira etapa do pipeline (geralmente "Novo").'}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* Duração padrão do atendimento */}
                <div className="mt-5 border-t border-white/5 pt-4">
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#A8A4A0]">
                        <Clock className="h-3.5 w-3.5" /> Duração padrão do atendimento
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        {DURATION_PRESETS.map((m) => {
                            const active = durationMinutes === m;
                            return (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setDurationMinutes(m); setDurationError(null); }}
                                    className={`h-8 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
                                        active
                                            ? 'border-[#C8A97A] bg-[#C8A97A]/15 text-[#C8A97A]'
                                            : 'border-white/10 bg-[#15151A] text-[#A8A4A0] hover:border-[#C8A97A]/40 hover:text-[#F0EDE8]'
                                    }`}
                                >
                                    {m < 60 ? `${m} min` : m === 60 ? '1h' : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`}
                                </button>
                            );
                        })}
                        <div className="ml-1 flex items-center gap-1.5">
                            <input
                                type="number"
                                inputMode="numeric"
                                min={MIN_DURATION}
                                max={MAX_DURATION}
                                step={5}
                                value={durationMinutes}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setDurationMinutes(Number.isFinite(v) ? v : 0);
                                    setDurationError(validateDuration(Number.isFinite(v) ? v : 0));
                                }}
                                aria-label="Duração personalizada em minutos"
                                aria-invalid={!!durationError}
                                className={`h-8 w-20 rounded-lg border bg-[#15151A] px-2 text-[12px] text-[#F0EDE8] outline-none focus:border-[#C8A97A]/50 ${
                                    durationError ? 'border-rose-500/60' : 'border-white/10'
                                }`}
                            />
                            <span className="text-[10px] text-[#7A7774]">min</span>
                        </div>
                    </div>
                    {durationError ? (
                        <p className="mt-2 text-[10px] font-medium text-rose-400">{durationError}</p>
                    ) : (
                        <p className="mt-2 text-[10px] text-[#7A7774]">
                            Cada novo agendamento usa essa duração quando você não escolher a hora final manualmente.
                            Range válido: {MIN_DURATION}–{MAX_DURATION} minutos.
                        </p>
                    )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                    {hasUnsavedChange && (
                        <span className="text-[10px] font-semibold text-amber-300">Alterações não salvas</span>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !hasUnsavedChange}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C8A97A] px-4 text-[12px] font-bold text-[#0A0A0C] transition-opacity hover:bg-[#E8D5B0] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Estado atual */}
            {!isUnconfigured && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-400">
                    <Check className="h-4 w-4 flex-shrink-0" />
                    <span>
                        Configurado para o pipeline <strong>{current?.pipeline_name ?? '—'}</strong>
                        {current?.stage_name
                            ? <> na etapa <strong>{current.stage_name}</strong></>
                            : <>, primeira etapa (padrão)</>}
                        {' '}· duração padrão <strong>{currentDuration} min</strong>.
                    </span>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div
                    style={{
                        position: 'fixed', bottom: '24px', right: '24px',
                        background: toast.kind === 'success' ? '#0F2E1F' : '#2E0F0F',
                        border: `1px solid ${toast.kind === 'success' ? 'rgba(76,175,130,0.4)' : 'rgba(224,82,82,0.4)'}`,
                        color: toast.kind === 'success' ? '#4CAF82' : '#E05252',
                        padding: '12px 18px', borderRadius: '8px', fontSize: '12px',
                        maxWidth: '400px', zIndex: 2000, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
