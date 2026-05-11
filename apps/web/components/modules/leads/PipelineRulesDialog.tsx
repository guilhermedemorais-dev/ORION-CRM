'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlaskConical,
    HelpCircle,
    Pencil,
    Plus,
    Power,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';
import type { ApiListResponse, PipelineRecord, PipelineStageRecord } from '@/lib/api';

type RuleTriggerEvent = 'CARD_ENTERED_STAGE';
type RuleActionType = 'CREATE_LINKED_CARD' | 'MOVE_CARD_TO_PIPELINE' | 'MIRROR_CARD_TO_PIPELINE';
type RuleLinkStrategy = 'KEEP_LEAD' | 'KEEP_CUSTOMER' | 'KEEP_ORDER' | 'KEEP_ALL' | 'TECHNICAL_LINK';

interface PipelineAutomationRule {
    id: string;
    name: string;
    description: string | null;
    source_pipeline_id: string;
    source_stage_id: string;
    trigger_event: RuleTriggerEvent;
    action_type: RuleActionType;
    target_pipeline_id: string;
    target_stage_id: string;
    link_strategy: RuleLinkStrategy;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface RuleDraft {
    name: string;
    description: string;
    source_stage_id: string;
    action_type: RuleActionType;
    target_pipeline_id: string;
    target_stage_id: string;
    link_strategy: RuleLinkStrategy;
    is_active: boolean;
}

interface ApiData<T> {
    data: T;
}

interface PipelineRulesDialogProps {
    open: boolean;
    pipeline: PipelineRecord;
    sourceStages: PipelineStageRecord[];
    onClose: () => void;
    onToast: (toast: { kind: 'success' | 'error'; message: string } | null) => void;
    embedded?: boolean;
}

const ACTION_OPTIONS: Array<{ value: RuleActionType; label: string; description: string }> = [
    {
        value: 'CREATE_LINKED_CARD',
        label: 'Gerar card no setor destino (recomendado)',
        description: 'Mantém o card aqui como histórico e cria um novo card vinculado no pipeline destino.',
    },
    {
        value: 'MOVE_CARD_TO_PIPELINE',
        label: 'Mover card (sai daqui)',
        description: 'O card é transferido para o destino e some deste pipeline.',
    },
    {
        value: 'MIRROR_CARD_TO_PIPELINE',
        label: 'Espelhar card (sincronizado)',
        description: 'Cria uma cópia sincronizada no destino. Alterações refletem nos dois.',
    },
];

const LINK_STRATEGY_OPTIONS: Array<{ value: RuleLinkStrategy; label: string }> = [
    { value: 'KEEP_LEAD', label: 'Manter lead' },
    { value: 'KEEP_CUSTOMER', label: 'Manter cliente' },
    { value: 'KEEP_ORDER', label: 'Manter pedido' },
    { value: 'KEEP_ALL', label: 'Manter tudo' },
    { value: 'TECHNICAL_LINK', label: 'Vínculo técnico' },
];

function defaultDraft(pipelineId: string, sourceStages: PipelineStageRecord[], targetStages: PipelineStageRecord[]): RuleDraft {
    return {
        name: '',
        description: '',
        source_stage_id: sourceStages[0]?.id ?? '',
        action_type: 'CREATE_LINKED_CARD',
        target_pipeline_id: pipelineId,
        target_stage_id: targetStages[0]?.id ?? sourceStages[0]?.id ?? '',
        link_strategy: 'KEEP_LEAD',
        is_active: true,
    };
}

function optionLabel<T extends string>(options: Array<{ value: T; label: string }>, value: T): string {
    return options.find((option) => option.value === value)?.label ?? value;
}

function stageLabel(stagesByPipeline: Record<string, PipelineStageRecord[]>, pipelineId: string, stageId: string): string {
    return stagesByPipeline[pipelineId]?.find((stage) => stage.id === stageId)?.name ?? 'Etapa não carregada';
}

function pipelineLabel(pipelines: PipelineRecord[], pipelineId: string): string {
    return pipelines.find((item) => item.id === pipelineId)?.name ?? 'Pipeline não carregado';
}

function readApiMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    return typeof record.message === 'string' ? record.message : null;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/internal${path}`, {
        ...init,
        headers: {
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...init?.headers,
        },
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
        throw new Error(readApiMessage(payload) ?? 'Falha ao comunicar com a API.');
    }

    return payload as T;
}

async function apiData<T>(path: string, init?: RequestInit): Promise<T> {
    const envelope = await apiJson<ApiData<T>>(path, init);
    return envelope.data;
}

function buildRulePayload(draft: RuleDraft) {
    return {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        source_stage_id: draft.source_stage_id,
        trigger_event: 'CARD_ENTERED_STAGE' satisfies RuleTriggerEvent,
        action_type: draft.action_type,
        target_pipeline_id: draft.target_pipeline_id,
        target_stage_id: draft.target_stage_id,
        link_strategy: draft.link_strategy,
        is_active: draft.is_active,
    };
}

export function PipelineRulesDialog({
    open,
    pipeline,
    sourceStages,
    onClose,
    onToast,
    embedded = false,
}: PipelineRulesDialogProps) {
    const [rules, setRules] = useState<PipelineAutomationRule[]>([]);
    const [pipelines, setPipelines] = useState<PipelineRecord[]>([pipeline]);
    const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStageRecord[]>>({
        [pipeline.id]: sourceStages,
    });
    const [draft, setDraft] = useState<RuleDraft>(() => defaultDraft(pipeline.id, sourceStages, sourceStages));
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [testLeadIds, setTestLeadIds] = useState<Record<string, string>>({});
    const [testResults, setTestResults] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const targetStages = stagesByPipeline[draft.target_pipeline_id] ?? [];

    const resetDraft = useCallback((): void => {
        const currentTargetStages = stagesByPipeline[pipeline.id] ?? sourceStages;
        setEditingRuleId(null);
        setDraft(defaultDraft(pipeline.id, sourceStages, currentTargetStages));
    }, [pipeline.id, sourceStages, stagesByPipeline]);

    const fetchStages = useCallback(async (pipelineId: string): Promise<PipelineStageRecord[]> => {
        const cached = stagesByPipeline[pipelineId];
        if (cached) return cached;

        const data = await apiData<PipelineStageRecord[]>(`/pipelines/${pipelineId}/stages`);
        setStagesByPipeline((current) => ({ ...current, [pipelineId]: data }));
        return data;
    }, [stagesByPipeline]);

    const loadRules = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const pipelinesResponse = await apiJson<ApiListResponse<PipelineRecord>>('/pipelines');
            let rulesData: PipelineAutomationRule[] = [];

            try {
                rulesData = await apiData<PipelineAutomationRule[]>(`/pipelines/${pipeline.id}/rules`);
            } catch (rulesError) {
                const message = rulesError instanceof Error ? rulesError.message : 'Não foi possível carregar as regras.';
                setError(message);
            }

            setRules(rulesData);
            setPipelines(pipelinesResponse.data);

            const referencedPipelineIds = Array.from(new Set([
                pipeline.id,
                ...rulesData.map((rule) => rule.target_pipeline_id),
            ]));

            const stagesEntries = await Promise.all(referencedPipelineIds.map(async (pipelineId) => {
                if (pipelineId === pipeline.id) return [pipelineId, sourceStages] as const;
                return [pipelineId, await apiData<PipelineStageRecord[]>(`/pipelines/${pipelineId}/stages`)] as const;
            }));

            setStagesByPipeline((current) => ({
                ...current,
                ...Object.fromEntries(stagesEntries),
                [pipeline.id]: sourceStages,
            }));
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : 'Não foi possível carregar as regras.';
            setError(message);
            onToast({ kind: 'error', message });
        } finally {
            setIsLoading(false);
        }
    }, [onToast, pipeline.id, sourceStages]);

    useEffect(() => {
        if (!open) return;
        void loadRules();
    }, [loadRules, open]);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, open]);

    useEffect(() => {
        if (!open) return;
        setStagesByPipeline((current) => ({ ...current, [pipeline.id]: sourceStages }));
        setDraft((current) => ({
            ...current,
            source_stage_id: current.source_stage_id || sourceStages[0]?.id || '',
            target_stage_id: current.target_stage_id || sourceStages[0]?.id || '',
        }));
    }, [open, pipeline.id, sourceStages]);

    const sortedSourceStages = useMemo(
        () => [...sourceStages].sort((a, b) => a.position - b.position),
        [sourceStages],
    );

    const sortedTargetStages = useMemo(
        () => [...targetStages].sort((a, b) => a.position - b.position),
        [targetStages],
    );

    const updateDraft = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]): void => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const changeTargetPipeline = async (targetPipelineId: string): Promise<void> => {
        updateDraft('target_pipeline_id', targetPipelineId);
        try {
            const stages = await fetchStages(targetPipelineId);
            updateDraft('target_stage_id', stages[0]?.id ?? '');
        } catch (stageError) {
            const message = stageError instanceof Error ? stageError.message : 'Não foi possível carregar etapas do destino.';
            onToast({ kind: 'error', message });
        }
    };

    const saveRule = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!draft.name.trim() || !draft.source_stage_id || !draft.target_pipeline_id || !draft.target_stage_id) {
            onToast({ kind: 'error', message: 'Preencha origem, ação e destino da regra.' });
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const path = editingRuleId
                ? `/pipelines/${pipeline.id}/rules/${editingRuleId}`
                : `/pipelines/${pipeline.id}/rules`;
            const method = editingRuleId ? 'PATCH' : 'POST';

            await apiData<PipelineAutomationRule>(path, {
                method,
                body: JSON.stringify(buildRulePayload(draft)),
            });

            onToast({ kind: 'success', message: editingRuleId ? 'Regra atualizada.' : 'Regra criada.' });
            resetDraft();
            await loadRules();
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar a regra.';
            setError(message);
            onToast({ kind: 'error', message });
        } finally {
            setIsSaving(false);
        }
    };

    const editRule = async (rule: PipelineAutomationRule): Promise<void> => {
        await fetchStages(rule.target_pipeline_id);
        setEditingRuleId(rule.id);
        setDraft({
            name: rule.name,
            description: rule.description ?? '',
            source_stage_id: rule.source_stage_id,
            action_type: rule.action_type,
            target_pipeline_id: rule.target_pipeline_id,
            target_stage_id: rule.target_stage_id,
            link_strategy: rule.link_strategy,
            is_active: rule.is_active,
        });
    };

    const toggleRule = async (rule: PipelineAutomationRule): Promise<void> => {
        setBusyRuleId(rule.id);
        try {
            await apiData<PipelineAutomationRule>(`/pipelines/${pipeline.id}/rules/${rule.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !rule.is_active }),
            });
            onToast({ kind: 'success', message: rule.is_active ? 'Regra desativada.' : 'Regra ativada.' });
            await loadRules();
        } catch (toggleError) {
            onToast({
                kind: 'error',
                message: toggleError instanceof Error ? toggleError.message : 'Não foi possível alterar a regra.',
            });
        } finally {
            setBusyRuleId(null);
        }
    };

    const deleteRule = async (rule: PipelineAutomationRule): Promise<void> => {
        if (!window.confirm(`Remover a regra "${rule.name}"?`)) return;

        setBusyRuleId(rule.id);
        try {
            await apiJson<void>(`/pipelines/${pipeline.id}/rules/${rule.id}`, { method: 'DELETE' });
            onToast({ kind: 'success', message: 'Regra removida.' });
            if (editingRuleId === rule.id) resetDraft();
            await loadRules();
        } catch (deleteError) {
            onToast({
                kind: 'error',
                message: deleteError instanceof Error ? deleteError.message : 'Não foi possível remover a regra.',
            });
        } finally {
            setBusyRuleId(null);
        }
    };

    const testRule = async (rule: PipelineAutomationRule): Promise<void> => {
        const leadId = testLeadIds[rule.id]?.trim();
        if (!leadId) {
            onToast({ kind: 'error', message: 'Informe o ID do lead para testar.' });
            return;
        }

        setBusyRuleId(rule.id);
        try {
            const result = await apiData<{ willExecute: boolean; reason?: string }>(`/pipelines/${pipeline.id}/rules/${rule.id}/test`, {
                method: 'POST',
                body: JSON.stringify({ lead_id: leadId }),
            });
            const message = result.willExecute ? 'Teste OK: a regra executaria.' : `Teste não executaria: ${result.reason ?? 'sem motivo informado.'}`;
            setTestResults((current) => ({ ...current, [rule.id]: message }));
            onToast({ kind: result.willExecute ? 'success' : 'error', message });
        } catch (testError) {
            const message = testError instanceof Error ? testError.message : 'Endpoint de teste indisponível.';
            setTestResults((current) => ({ ...current, [rule.id]: message }));
            onToast({ kind: 'error', message });
        } finally {
            setBusyRuleId(null);
        }
    };

    if (!open && !embedded) return null;

    return (
        <div
            className={embedded ? 'contents' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm'}
            role={embedded ? undefined : 'dialog'}
            aria-modal={embedded ? undefined : true}
            aria-labelledby="pipeline-rules-title"
        >
            <div className={embedded ? 'flex w-full flex-col overflow-hidden rounded-[12px] border border-white/10 bg-[#111114]' : 'flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#111114] shadow-[var(--orion-shadow-dialog)]'}>
                <header className={embedded ? 'hidden' : 'flex items-center justify-between gap-3 border-b border-white/10 bg-[#151517] px-5 py-4'}>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-gold)]">Kanban</p>
                        <h2 id="pipeline-rules-title" className="truncate text-lg font-bold text-[color:var(--orion-text)]">
                            Regras de pipeline
                        </h2>
                        <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">
                            Quando {pipeline.name} entrar em uma etapa, execute uma ação em outro pipeline.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/10 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)]"
                        aria-label="Fechar regras de pipeline"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_390px]">
                    <section className="min-w-0 border-r border-white/10 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text-muted)]">Regras existentes</p>
                                <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">{rules.length} regra(s) configurada(s)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowHelp((current) => !current)}
                                    aria-expanded={showHelp}
                                    title="Como funcionam as regras"
                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] border text-[color:var(--orion-text)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)] ${
                                        showHelp
                                            ? 'border-[color:var(--orion-gold)] text-[color:var(--orion-gold)]'
                                            : 'border-white/10 text-[color:var(--orion-text-secondary)]'
                                    }`}
                                >
                                    <HelpCircle className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void loadRules()}
                                    disabled={isLoading}
                                    className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-white/10 px-3 text-[12px] font-semibold text-[color:var(--orion-text)] hover:border-[color:var(--orion-gold)] disabled:opacity-60"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </button>
                            </div>
                        </div>

                        {showHelp ? (
                            <div className="mb-3 rounded-[12px] border border-[color:var(--orion-gold)]/30 bg-[rgba(200,169,122,0.05)] p-4 text-xs leading-relaxed text-[color:var(--orion-text-secondary)]">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-gold)]">
                                    Como funcionam as regras
                                </p>
                                <p className="mb-2">
                                    Cada pipeline é um <strong className="text-[color:var(--orion-text)]">setor</strong> da sua operação (Comercial, Produção, Entrega). Regras automatizam o
                                    {' '}<strong className="text-[color:var(--orion-text)]">handoff</strong> entre setores.
                                </p>
                                <p className="mb-2">
                                    <strong className="text-[color:var(--orion-text)]">Exemplo prático:</strong> quando um lead em <em>Comercial</em> entrar na etapa <em>Convertido</em>,
                                    crie automaticamente um card vinculado em <em>Produção / Backlog</em>. O card original
                                    fica como histórico do atendimento e o setor de Produção recebe a tarefa.
                                </p>
                                <ul className="mt-3 space-y-1.5">
                                    <li>
                                        <strong className="text-[color:var(--orion-text)]">Gerar card no setor destino:</strong> mantém o card aqui e cria um novo no destino.
                                        Indicado para handoff entre setores.
                                    </li>
                                    <li>
                                        <strong className="text-[color:var(--orion-text)]">Mover card:</strong> o card sai daqui e vai para o destino. Use quando o card só faz
                                        sentido em um lugar de cada vez.
                                    </li>
                                    <li>
                                        <strong className="text-[color:var(--orion-text)]">Espelhar card:</strong> cópia sincronizada. Alterações refletem nos dois cards.
                                    </li>
                                </ul>
                                <p className="mt-3 text-[10px] text-[color:var(--orion-text-muted)]">
                                    A regra dispara quando um card <strong>entra</strong> na etapa de origem. Mover um card já existente para a etapa também dispara.
                                </p>
                            </div>
                        ) : null}

                        {error ? (
                            <p className="mb-3 rounded-[9px] border border-[rgba(224,82,82,0.35)] bg-[rgba(224,82,82,0.08)] px-3 py-2 text-xs text-[color:var(--orion-red)]">
                                {error}
                            </p>
                        ) : null}

                        <div className="space-y-3">
                            {isLoading ? (
                                <div className="rounded-[12px] border border-white/10 bg-[#151517] px-4 py-5 text-sm text-[color:var(--orion-text-secondary)]">
                                    Carregando regras...
                                </div>
                            ) : null}

                            {!isLoading && rules.length === 0 ? (
                                <div className="rounded-[12px] border border-dashed border-white/15 bg-[#151517] px-4 py-8 text-center">
                                    <p className="text-sm font-semibold text-[color:var(--orion-text)]">Nenhuma regra criada</p>
                                    <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">Use o formulário ao lado para configurar a primeira automação.</p>
                                </div>
                            ) : null}

                            {rules.map((rule) => (
                                <article key={rule.id} className="rounded-[12px] border border-white/10 bg-[#151517] p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-sm font-bold text-[color:var(--orion-text)]">{rule.name}</h3>
                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                                                    rule.is_active
                                                        ? 'border-[rgba(76,175,130,0.35)] bg-[rgba(76,175,130,0.12)] text-[color:var(--orion-green)]'
                                                        : 'border-white/10 bg-white/5 text-[color:var(--orion-text-muted)]'
                                                }`}>
                                                    {rule.is_active ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </div>
                                            {rule.description ? (
                                                <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">{rule.description}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void editRule(rule)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/10 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)]"
                                                title="Editar regra"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void toggleRule(rule)}
                                                disabled={busyRuleId === rule.id}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/10 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)] disabled:opacity-60"
                                                title={rule.is_active ? 'Desativar regra' : 'Ativar regra'}
                                            >
                                                <Power className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void deleteRule(rule)}
                                                disabled={busyRuleId === rule.id}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(224,82,82,0.4)] bg-[rgba(224,82,82,0.1)] text-[color:var(--orion-red)] hover:bg-[rgba(224,82,82,0.2)] disabled:opacity-60"
                                                title="Remover regra"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 rounded-[10px] border border-white/10 bg-[#101012] px-3 py-2 text-xs leading-6 text-[color:var(--orion-text-secondary)]">
                                        Quando <strong className="text-[color:var(--orion-text)]">{pipeline.name}</strong> &gt;{' '}
                                        <strong className="text-[color:var(--orion-text)]">{stageLabel(stagesByPipeline, rule.source_pipeline_id, rule.source_stage_id)}</strong>{' '}
                                        então <strong className="text-[color:var(--orion-text)]">{optionLabel(ACTION_OPTIONS, rule.action_type)}</strong> em{' '}
                                        <strong className="text-[color:var(--orion-text)]">{pipelineLabel(pipelines, rule.target_pipeline_id)}</strong> &gt;{' '}
                                        <strong className="text-[color:var(--orion-text)]">{stageLabel(stagesByPipeline, rule.target_pipeline_id, rule.target_stage_id)}</strong>.
                                    </div>

                                    <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                        <label className="block">
                                            <span className="sr-only">Lead ID para testar</span>
                                            <input
                                                value={testLeadIds[rule.id] ?? ''}
                                                onChange={(event) => setTestLeadIds((current) => ({ ...current, [rule.id]: event.target.value }))}
                                                placeholder="Lead ID para teste"
                                                className="h-9 w-full rounded-[8px] border border-white/10 bg-[#101012] px-3 text-xs text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => void testRule(rule)}
                                            disabled={busyRuleId === rule.id}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-white/10 px-3 text-[12px] font-semibold text-[color:var(--orion-text)] hover:border-[color:var(--orion-gold)] disabled:opacity-60"
                                        >
                                            <FlaskConical className="h-3.5 w-3.5" />
                                            Testar
                                        </button>
                                    </div>
                                    {testResults[rule.id] ? (
                                        <p className="mt-2 rounded-[8px] border border-white/10 bg-[#101012] px-3 py-2 text-xs text-[color:var(--orion-text-secondary)]">
                                            {testResults[rule.id]}
                                        </p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    </section>

                    <aside className="bg-[#0f0f11] p-4">
                        <form onSubmit={saveRule} className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text-muted)]">
                                        {editingRuleId ? 'Editar regra' : 'Nova regra'}
                                    </p>
                                    <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">Modelo: quando origem, então ação no destino.</p>
                                </div>
                                {editingRuleId ? (
                                    <button
                                        type="button"
                                        onClick={resetDraft}
                                        className="text-xs font-semibold text-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold-light)]"
                                    >
                                        Nova
                                    </button>
                                ) : null}
                            </div>

                            <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">
                                    Nome <span className="text-[color:var(--orion-red)]">*</span>
                                </span>
                                <input
                                    value={draft.name}
                                    onChange={(event) => updateDraft('name', event.target.value)}
                                    placeholder="Ex: Enviar proposta para produção"
                                    required
                                    aria-required="true"
                                    aria-invalid={draft.name.trim().length === 0}
                                    className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)] aria-[invalid=true]:border-[color:var(--orion-red)]/60"
                                />
                                {draft.name.trim().length === 0 ? (
                                    <span className="mt-1 block text-[10px] font-semibold text-[color:var(--orion-red)]">
                                        Informe um nome para a regra.
                                    </span>
                                ) : null}
                            </label>

                            <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Descrição</span>
                                <textarea
                                    value={draft.description}
                                    onChange={(event) => updateDraft('description', event.target.value)}
                                    placeholder="Opcional"
                                    className="min-h-[78px] w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 py-2 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                />
                            </label>

                            <div className="rounded-[12px] border border-white/10 bg-[#151517] p-3">
                                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-gold)]">Quando</p>
                                <div className="grid gap-3">
                                    <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                        <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Pipeline atual</span>
                                        <input
                                            value={pipeline.name}
                                            readOnly
                                            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#101012] px-3 text-sm font-semibold text-[color:var(--orion-text-secondary)]"
                                        />
                                    </label>
                                    <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                        <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Stage origem</span>
                                        <select
                                            value={draft.source_stage_id}
                                            onChange={(event) => updateDraft('source_stage_id', event.target.value)}
                                            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                        >
                                            {sortedSourceStages.map((stage) => (
                                                <option key={stage.id} value={stage.id}>{stage.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-[12px] border border-white/10 bg-[#151517] p-3">
                                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-gold)]">Então</p>
                                <div className="grid gap-3">
                                    <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                        <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Ação</span>
                                        <select
                                            value={draft.action_type}
                                            onChange={(event) => updateDraft('action_type', event.target.value as RuleActionType)}
                                            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                        >
                                            {ACTION_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <span className="mt-1.5 block text-[10px] leading-snug text-[color:var(--orion-text-muted)]">
                                            {ACTION_OPTIONS.find((option) => option.value === draft.action_type)?.description}
                                        </span>
                                    </label>
                                    <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                        <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Pipeline destino</span>
                                        <select
                                            value={draft.target_pipeline_id}
                                            onChange={(event) => void changeTargetPipeline(event.target.value)}
                                            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                        >
                                            {pipelines.map((item) => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                        <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Stage destino</span>
                                        <select
                                            value={draft.target_stage_id}
                                            onChange={(event) => updateDraft('target_stage_id', event.target.value)}
                                            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                        >
                                            {sortedTargetStages.map((stage) => (
                                                <option key={stage.id} value={stage.id}>{stage.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                        <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Vínculo</span>
                                        <select
                                            value={draft.link_strategy}
                                            onChange={(event) => updateDraft('link_strategy', event.target.value as RuleLinkStrategy)}
                                            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                        >
                                            {LINK_STRATEGY_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <label className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-white/10 bg-[#151517] px-3 text-[12px] font-semibold text-[color:var(--orion-text-secondary)]">
                                <input
                                    type="checkbox"
                                    checked={draft.is_active}
                                    onChange={(event) => updateDraft('is_active', event.target.checked)}
                                    className="accent-[#C8A97A]"
                                />
                                Regra ativa
                            </label>

                            {(() => {
                                const missing: string[] = [];
                                if (!draft.name.trim()) missing.push('nome');
                                if (!draft.source_stage_id) missing.push('stage origem');
                                if (!draft.target_pipeline_id) missing.push('pipeline destino');
                                if (!draft.target_stage_id) missing.push('stage destino');
                                const isFormInvalid = missing.length > 0;
                                return (
                                    <>
                                        <button
                                            type="submit"
                                            disabled={isSaving || isFormInvalid}
                                            title={isFormInvalid ? `Preencha: ${missing.join(', ')}` : undefined}
                                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-[color:var(--orion-gold)] px-4 text-[12px] font-bold text-black hover:bg-[color:var(--orion-gold-light)] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {isSaving ? 'Salvando...' : editingRuleId ? 'Salvar alterações' : 'Criar regra'}
                                        </button>
                                        {isFormInvalid ? (
                                            <p className="mt-2 text-center text-[10px] text-[color:var(--orion-text-muted)]">
                                                Para habilitar o botão, preencha: <strong className="text-[color:var(--orion-text-secondary)]">{missing.join(', ')}</strong>.
                                            </p>
                                        ) : null}
                                    </>
                                );
                            })()}
                        </form>
                    </aside>
                </div>
            </div>
        </div>
    );
}
