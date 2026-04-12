'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Bot,
    Brain,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    Globe,
    Loader2,
    Plus,
    Save,
    Shield,
    Sparkles,
    Trash2,
    Pencil,
    X,
    Check,
    Wand2,
} from 'lucide-react';
import type { AiCopilotConfig, AiSkill, AiSkillCategory, GeneratedSkill } from '@/lib/ajustes-types';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/Switch';

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro desconhecido.' })) as { message?: string };
        throw new Error(err.message ?? `Erro ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const configSchema = z.object({
    provider: z.enum(['qwen', 'openai', 'anthropic']),
    base_url: z.string().url('URL inválida.').or(z.literal('')),
    api_key: z.string().optional(),
    model: z.string().min(1, 'Modelo obrigatório.'),
    temperature: z.coerce.number().min(0).max(2),
    max_tokens: z.coerce.number().int().min(1).max(8192),
    system_prompt: z.string().max(4000).optional(),
});

const skillSchema = z.object({
    name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(100),
    description: z.string().trim().min(5, 'Mínimo 5 caracteres.').max(500),
    category: z.enum(['global', 'atendimento', 'vendas', 'meta', 'geral']),
    system_prompt: z.string().trim().min(10, 'Mínimo 10 caracteres.').max(4000),
    is_active: z.boolean(),
});

type ConfigForm = z.infer<typeof configSchema>;
type SkillForm = z.infer<typeof skillSchema>;

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<AiSkillCategory, string> = {
    global: 'Global',
    atendimento: 'Atendimento',
    vendas: 'Vendas',
    meta: 'Meta',
    geral: 'Geral',
};

const CATEGORY_COLORS: Record<AiSkillCategory, string> = {
    global: 'bg-red-100 text-red-700 border-red-200',
    atendimento: 'bg-blue-100 text-blue-700 border-blue-200',
    vendas: 'bg-green-100 text-green-700 border-green-200',
    meta: 'bg-purple-100 text-purple-700 border-purple-200',
    geral: 'bg-gray-100 text-gray-700 border-gray-200',
};

const QWEN_MODELS = ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'];

// ── Main component ────────────────────────────────────────────────────────────

export function IACopilotoTab() {
    const [config, setConfig] = useState<AiCopilotConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [skills, setSkills] = useState<AiSkill[]>([]);
    const [skillsLoading, setSkillsLoading] = useState(true);
    const [showApiKey, setShowApiKey] = useState(false);
    const [configExpanded, setConfigExpanded] = useState(false);
    const [promptExpanded, setPromptExpanded] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const [enabledToggling, setEnabledToggling] = useState(false);
    const [skillModalOpen, setSkillModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<AiSkill | null>(null);
    const [skillSaving, setSkillSaving] = useState(false);
    const [skillError, setSkillError] = useState<string | null>(null);
    const [generateModalOpen, setGenerateModalOpen] = useState(false);
    const [generateInput, setGenerateInput] = useState('');
    const [generatedPreview, setGeneratedPreview] = useState<GeneratedSkill | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // ── Load data ────────────────────────────────────────────────────────────

    const loadConfig = useCallback(async () => {
        try {
            const data = await apiFetch<AiCopilotConfig>('/api/v1/ai-copilot/config');
            setConfig(data);
            configForm.reset({
                provider: data.provider,
                base_url: data.base_url,
                api_key: '',
                model: data.model,
                temperature: data.temperature,
                max_tokens: data.max_tokens,
                system_prompt: data.system_prompt ?? '',
            });
        } catch {
            // config pode não existir ainda
        } finally {
            setConfigLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadSkills = useCallback(async () => {
        try {
            const data = await apiFetch<{ data: AiSkill[] }>('/api/v1/ai-copilot/skills');
            setSkills(data.data);
        } catch {
            // ignore
        } finally {
            setSkillsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadConfig();
        void loadSkills();
    }, [loadConfig, loadSkills]);

    // ── Config form ──────────────────────────────────────────────────────────

    const configForm = useForm<ConfigForm>({
        resolver: zodResolver(configSchema),
        defaultValues: {
            provider: 'qwen',
            base_url: 'https://dashscope-compatible-intl.aliyuncs.com/compatible-mode/v1',
            api_key: '',
            model: 'qwen-plus',
            temperature: 0.7,
            max_tokens: 1024,
            system_prompt: '',
        },
    });

    const providerValue = configForm.watch('provider');
    const temperatureValue = configForm.watch('temperature');

    async function saveConfig(data: ConfigForm) {
        setConfigSaving(true);
        setConfigError(null);
        try {
            const updated = await apiFetch<AiCopilotConfig>('/api/v1/ai-copilot/config', {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            setConfig(updated);
        } catch (err) {
            setConfigError(err instanceof Error ? err.message : 'Erro ao salvar.');
        } finally {
            setConfigSaving(false);
        }
    }

    async function toggleEnabled(enabled: boolean) {
        setEnabledToggling(true);
        try {
            const updated = await apiFetch<AiCopilotConfig>('/api/v1/ai-copilot/config', {
                method: 'PUT',
                body: JSON.stringify({ is_enabled: enabled }),
            });
            setConfig(updated);
        } catch {
            // revert on error
            setConfig((prev) => prev ? { ...prev } : prev);
        } finally {
            setEnabledToggling(false);
        }
    }

    // ── Skill form ───────────────────────────────────────────────────────────

    const skillForm = useForm<SkillForm>({
        resolver: zodResolver(skillSchema),
        defaultValues: { name: '', description: '', category: 'geral', system_prompt: '', is_active: true },
    });

    function openEditSkill(skill: AiSkill) {
        setEditingSkill(skill);
        skillForm.reset({
            name: skill.name,
            description: skill.description,
            category: skill.category,
            system_prompt: skill.system_prompt,
            is_active: skill.is_active,
        });
        setSkillError(null);
        setSkillModalOpen(true);
    }

    function openNewSkill() {
        setEditingSkill(null);
        skillForm.reset({ name: '', description: '', category: 'geral', system_prompt: '', is_active: true });
        setSkillError(null);
        setSkillModalOpen(true);
    }

    function closeSkillModal() {
        setSkillModalOpen(false);
        setEditingSkill(null);
        setSkillError(null);
        skillForm.reset();
    }

    async function saveSkill(data: SkillForm) {
        setSkillSaving(true);
        setSkillError(null);
        try {
            if (editingSkill) {
                const updated = await apiFetch<AiSkill>(`/api/v1/ai-copilot/skills/${editingSkill.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            } else {
                const created = await apiFetch<AiSkill>('/api/v1/ai-copilot/skills', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                setSkills((prev) => [...prev, created]);
            }
            closeSkillModal();
        } catch (err) {
            setSkillError(err instanceof Error ? err.message : 'Erro ao salvar skill.');
        } finally {
            setSkillSaving(false);
        }
    }

    async function toggleSkill(id: string, is_active: boolean) {
        setTogglingId(id);
        try {
            const updated = await apiFetch<AiSkill>(`/api/v1/ai-copilot/skills/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active }),
            });
            setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        } catch {
            // ignore
        } finally {
            setTogglingId(null);
        }
    }

    async function deleteSkill(id: string) {
        setDeletingId(id);
        try {
            await apiFetch<void>(`/api/v1/ai-copilot/skills/${id}`, { method: 'DELETE' });
            setSkills((prev) => prev.filter((s) => s.id !== id));
            setDeleteConfirmId(null);
        } catch {
            // ignore
        } finally {
            setDeletingId(null);
        }
    }

    // ── Generate skill ───────────────────────────────────────────────────────

    async function generateSkill() {
        setGenerating(true);
        setGenerateError(null);
        try {
            const data = await apiFetch<GeneratedSkill>('/api/v1/ai-copilot/skills/generate', {
                method: 'POST',
                body: JSON.stringify({ description: generateInput }),
            });
            setGeneratedPreview(data);
        } catch (err) {
            setGenerateError(err instanceof Error ? err.message : 'Erro ao gerar.');
        } finally {
            setGenerating(false);
        }
    }

    function saveSkillFromPreview() {
        if (!generatedPreview) return;
        skillForm.reset({
            name: generatedPreview.name,
            description: generatedPreview.description,
            category: generatedPreview.category,
            system_prompt: generatedPreview.system_prompt,
            is_active: true,
        });
        setGenerateModalOpen(false);
        setGeneratedPreview(null);
        setGenerateInput('');
        setGenerateError(null);
        setEditingSkill(null);
        setSkillError(null);
        setSkillModalOpen(true);
    }

    // ── Render ───────────────────────────────────────────────────────────────

    if (configLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-16 bg-gray-100 rounded-lg" />
                <div className="h-48 bg-gray-100 rounded-lg" />
                <div className="h-64 bg-gray-100 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header — Toggle global */}
            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#C8A97A]/10">
                        <Bot className="w-5 h-5 text-[#C8A97A]" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">Copiloto IA</p>
                        <p className="text-sm text-gray-500">
                            {config?.is_enabled ? 'Ativo — assistindo todos os usuários' : 'Desativado'}
                        </p>
                    </div>
                </div>
                <Switch
                    checked={config?.is_enabled ?? false}
                    onCheckedChange={(checked) => void toggleEnabled(checked)}
                    disabled={enabledToggling}
                />
            </div>

            {/* Seção: Modelo */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setConfigExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">Configuração do Modelo</span>
                        {config?.has_api_key && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 border border-green-200 rounded-full">
                                API Key salva
                            </span>
                        )}
                    </div>
                    {configExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </button>

                {configExpanded && (
                    <form
                        onSubmit={configForm.handleSubmit((data) => void saveConfig(data))}
                        className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4"
                    >
                        {/* Provider */}
                        <div className="grid grid-cols-3 gap-3">
                            {(['qwen', 'openai', 'anthropic'] as const).map((p) => (
                                <label
                                    key={p}
                                    className={cn(
                                        'flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors',
                                        providerValue === p
                                            ? 'border-[#C8A97A] bg-[#C8A97A]/5 text-[#C8A97A] font-medium'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    )}
                                >
                                    <input type="radio" className="hidden" value={p} {...configForm.register('provider')} />
                                    <span className="text-xs font-bold capitalize">{p}</span>
                                    {p === 'qwen' && (
                                        <span className="ml-auto text-xs text-green-600 font-semibold">Gratuito</span>
                                    )}
                                </label>
                            ))}
                        </div>

                        {/* Base URL */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Base URL</label>
                            <input
                                {...configForm.register('base_url')}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30 font-mono"
                                placeholder="https://..."
                            />
                            {configForm.formState.errors.base_url && (
                                <p className="text-xs text-red-500 mt-1">{configForm.formState.errors.base_url.message}</p>
                            )}
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                API Key
                                {config?.has_api_key && (
                                    <span className="ml-2 text-gray-400 font-normal">(atual: {config.api_key_masked})</span>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    {...configForm.register('api_key')}
                                    type={showApiKey ? 'text' : 'password'}
                                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30 font-mono"
                                    placeholder={config?.has_api_key ? 'Deixe vazio para manter a atual' : 'Cole a API Key aqui'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Model + Temperatura + MaxTokens */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
                                {providerValue === 'qwen' ? (
                                    <select
                                        {...configForm.register('model')}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30"
                                    >
                                        {QWEN_MODELS.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        {...configForm.register('model')}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30"
                                        placeholder="gpt-4o, claude-sonnet..."
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Temperatura ({temperatureValue})
                                </label>
                                <input
                                    {...configForm.register('temperature')}
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    className="w-full accent-[#C8A97A]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Max Tokens</label>
                                <input
                                    {...configForm.register('max_tokens')}
                                    type="number"
                                    min={1}
                                    max={8192}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30"
                                />
                            </div>
                        </div>

                        {/* System Prompt base */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setPromptExpanded((v) => !v)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
                            >
                                {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                System Prompt base (opcional)
                            </button>
                            {promptExpanded && (
                                <textarea
                                    {...configForm.register('system_prompt')}
                                    rows={5}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30 font-mono resize-none"
                                    placeholder="Instrução base do assistente. As skills ativas serão adicionadas automaticamente."
                                />
                            )}
                        </div>

                        {configError && <p className="text-xs text-red-500">{configError}</p>}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={configSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-[#C8A97A] text-white rounded-lg text-sm font-medium hover:bg-[#b8926a] disabled:opacity-60 transition-colors"
                            >
                                {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar configuração
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Seção: Skills */}
            <div className="bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">Skills</span>
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            {skills.filter((s) => s.is_active).length} ativas
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setGenerateModalOpen(true); setGeneratedPreview(null); setGenerateInput(''); setGenerateError(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#C8A97A] text-[#C8A97A] rounded-lg hover:bg-[#C8A97A]/5 transition-colors font-medium"
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            Gerar com IA
                        </button>
                        <button
                            type="button"
                            onClick={openNewSkill}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#C8A97A] text-white rounded-lg hover:bg-[#b8926a] transition-colors font-medium"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nova skill
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {skillsLoading && (
                        <div className="p-5 space-y-3 animate-pulse">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 bg-gray-100 rounded-lg" />
                            ))}
                        </div>
                    )}

                    {!skillsLoading && skills.length === 0 && (
                        <div className="p-8 text-center text-gray-400">
                            <Brain className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Nenhuma skill cadastrada.</p>
                        </div>
                    )}

                    {skills.map((skill) => (
                        <div key={skill.id} className="flex items-start gap-3 px-5 py-4">
                            <div className="mt-0.5">
                                {skill.is_global ? (
                                    <Shield className="w-4 h-4 text-red-500" />
                                ) : (
                                    <Globe className="w-4 h-4 text-gray-400" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900 text-sm">{skill.name}</span>
                                    <span className={cn(
                                        'px-1.5 py-0.5 text-xs border rounded-full',
                                        CATEGORY_COLORS[skill.category]
                                    )}>
                                        {CATEGORY_LABELS[skill.category]}
                                    </span>
                                    {skill.is_global && (
                                        <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-full font-semibold">
                                            Obrigatória
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{skill.description}</p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Switch
                                    checked={skill.is_active}
                                    onCheckedChange={(checked) => void toggleSkill(skill.id, checked)}
                                    disabled={skill.is_global || togglingId === skill.id}
                                />
                                <button
                                    type="button"
                                    onClick={() => openEditSkill(skill)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {!skill.is_global && (
                                    <>
                                        {deleteConfirmId === skill.id ? (
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => void deleteSkill(skill.id)}
                                                    disabled={deletingId === skill.id}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Confirmar exclusão"
                                                >
                                                    {deletingId === skill.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Check className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirmId(skill.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal: Skill Editor */}
            {skillModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">
                                {editingSkill ? 'Editar Skill' : 'Nova Skill'}
                            </h3>
                            <button type="button" onClick={closeSkillModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form
                            onSubmit={skillForm.handleSubmit((data) => void saveSkill(data))}
                            className="p-5 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                                <input
                                    {...skillForm.register('name')}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30"
                                    placeholder="Ex: Consultor de Joias"
                                />
                                {skillForm.formState.errors.name && (
                                    <p className="text-xs text-red-500 mt-1">{skillForm.formState.errors.name.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Descrição *</label>
                                <input
                                    {...skillForm.register('description')}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30"
                                    placeholder="O que essa skill faz?"
                                />
                                {skillForm.formState.errors.description && (
                                    <p className="text-xs text-red-500 mt-1">{skillForm.formState.errors.description.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                                    <select
                                        {...skillForm.register('category')}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30"
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col justify-end pb-1">
                                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            {...skillForm.register('is_active')}
                                            className="accent-[#C8A97A]"
                                        />
                                        Ativar imediatamente
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    System Prompt *
                                    <span className="ml-1 text-gray-400 font-normal">(instrução injetada na IA)</span>
                                </label>
                                <textarea
                                    {...skillForm.register('system_prompt')}
                                    rows={8}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30 font-mono resize-none"
                                    placeholder="Descreva como a IA deve se comportar com esta skill ativa..."
                                />
                                {skillForm.formState.errors.system_prompt && (
                                    <p className="text-xs text-red-500 mt-1">{skillForm.formState.errors.system_prompt.message}</p>
                                )}
                            </div>

                            {skillError && <p className="text-xs text-red-500">{skillError}</p>}

                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={closeSkillModal}
                                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={skillSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#C8A97A] text-white rounded-lg text-sm font-medium hover:bg-[#b8926a] disabled:opacity-60"
                                >
                                    {skillSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editingSkill ? 'Salvar alterações' : 'Criar skill'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Gerar com IA */}
            {generateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-[#C8A97A]" />
                                <h3 className="font-semibold text-gray-900">Gerar Skill com IA</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setGenerateModalOpen(false); setGeneratedPreview(null); setGenerateInput(''); }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {!generatedPreview ? (
                                <>
                                    <p className="text-sm text-gray-600">
                                        Descreva o que você quer que o copiloto saiba fazer. A IA vai gerar a skill automaticamente.
                                    </p>
                                    <textarea
                                        value={generateInput}
                                        onChange={(e) => setGenerateInput(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A97A]/30 resize-none"
                                        placeholder="Ex: Quero que a IA saiba explicar o processo de confecção de joias personalizadas e os prazos de cada etapa..."
                                    />
                                    {generateError && <p className="text-xs text-red-500">{generateError}</p>}
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => { setGenerateModalOpen(false); setGenerateInput(''); }}
                                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void generateSkill()}
                                            disabled={generateInput.trim().length < 10 || generating}
                                            className="flex items-center gap-2 px-4 py-2 bg-[#C8A97A] text-white rounded-lg text-sm font-medium hover:bg-[#b8926a] disabled:opacity-60"
                                        >
                                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                            Gerar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-green-700 font-medium">Skill gerada. Revise antes de salvar:</p>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">Nome: </span>
                                            <span>{generatedPreview.name}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Descrição: </span>
                                            <span className="text-gray-600">{generatedPreview.description}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Categoria: </span>
                                            <span className={cn('px-1.5 py-0.5 text-xs border rounded-full', CATEGORY_COLORS[generatedPreview.category])}>
                                                {CATEGORY_LABELS[generatedPreview.category]}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-700 mb-1">System Prompt:</p>
                                            <pre className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                                                {generatedPreview.system_prompt}
                                            </pre>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setGeneratedPreview(null)}
                                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                        >
                                            Gerar novamente
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveSkillFromPreview}
                                            className="flex items-center gap-2 px-4 py-2 bg-[#C8A97A] text-white rounded-lg text-sm font-medium hover:bg-[#b8926a]"
                                        >
                                            <Check className="w-4 h-4" />
                                            Usar esta skill
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
