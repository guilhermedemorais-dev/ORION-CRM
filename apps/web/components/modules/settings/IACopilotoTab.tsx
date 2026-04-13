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
    Headphones,
    TrendingUp,
    Target,
    Zap,
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

const CATEGORY_CONFIG: Record<AiSkillCategory, { icon: typeof Headphones; bg: string; text: string; border: string; gradient: string; iconBg: string }> = {
    global: {
        icon: Shield,
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/20',
        gradient: 'from-red-500/5 to-transparent',
        iconBg: 'bg-red-500/15',
    },
    atendimento: {
        icon: Headphones,
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/20',
        gradient: 'from-blue-500/5 to-transparent',
        iconBg: 'bg-blue-500/15',
    },
    vendas: {
        icon: TrendingUp,
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        gradient: 'from-emerald-500/5 to-transparent',
        iconBg: 'bg-emerald-500/15',
    },
    meta: {
        icon: Target,
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/20',
        gradient: 'from-purple-500/5 to-transparent',
        iconBg: 'bg-purple-500/15',
    },
    geral: {
        icon: Zap,
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        gradient: 'from-amber-500/5 to-transparent',
        iconBg: 'bg-amber-500/15',
    },
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
                <div className="h-16 bg-white/[0.06] rounded-lg" />
                <div className="h-48 bg-white/[0.06] rounded-lg" />
                <div className="h-64 bg-white/[0.06] rounded-lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header — Toggle global */}
            <div className="flex items-center justify-between p-4 bg-[#131316] border border-white/6 rounded-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#BFA06A]/10">
                        <Bot className="w-5 h-5 text-[#BFA06A]" />
                    </div>
                    <div>
                        <p className="font-semibold text-[#F0EBE3]">Copiloto IA</p>
                        <p className="text-sm text-[#A09A94]">
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
            <div className="bg-[#131316] border border-white/6 rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setConfigExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-[#A09A94]" />
                        <span className="font-medium text-[#F0EBE3]">Configuração do Modelo</span>
                        {config?.has_api_key && (
                            <span className="px-2 py-0.5 text-xs bg-green-500/15 text-green-400 border border-green-500/20 rounded-full">
                                API Key salva
                            </span>
                        )}
                    </div>
                    {configExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#4a4a54]" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-[#4a4a54]" />
                    )}
                </button>

                {configExpanded && (
                    <form
                        onSubmit={configForm.handleSubmit((data) => void saveConfig(data))}
                        className="px-5 pb-5 border-t border-white/4 space-y-4 pt-4"
                    >
                        {/* Provider */}
                        <div className="grid grid-cols-3 gap-3">
                            {(['qwen', 'openai', 'anthropic'] as const).map((p) => (
                                <label
                                    key={p}
                                    className={cn(
                                        'flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors',
                                        providerValue === p
                                            ? 'border-[#BFA06A]/40 bg-[#BFA06A]/10 text-[#BFA06A] font-medium'
                                            : 'border-white/6 text-[#A09A94] hover:bg-white/[0.03]'
                                    )}
                                >
                                    <input type="radio" className="hidden" value={p} {...configForm.register('provider')} />
                                    <span className="text-xs font-bold capitalize">{p}</span>
                                    {p === 'qwen' && (
                                        <span className="ml-auto text-xs text-green-400 font-semibold">Gratuito</span>
                                    )}
                                </label>
                            ))}
                        </div>

                        {/* Base URL */}
                        <div>
                            <label className="block text-xs font-medium text-[#A09A94] mb-1">Base URL</label>
                            <input
                                {...configForm.register('base_url')}
                                className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 font-mono text-[#F0EBE3]"
                                placeholder="https://..."
                            />
                            {configForm.formState.errors.base_url && (
                                <p className="text-xs text-red-400 mt-1">{configForm.formState.errors.base_url.message}</p>
                            )}
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="block text-xs font-medium text-[#A09A94] mb-1">
                                API Key
                                {config?.has_api_key && (
                                    <span className="ml-2 text-[#4a4a54] font-normal">(atual: {config.api_key_masked})</span>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    {...configForm.register('api_key')}
                                    type={showApiKey ? 'text' : 'password'}
                                    className="w-full px-3 py-2 pr-10 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 font-mono text-[#F0EBE3]"
                                    placeholder={config?.has_api_key ? 'Deixe vazio para manter a atual' : 'Cole a API Key aqui'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a4a54] hover:text-[#A09A94]"
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Model + Temperatura + MaxTokens */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-[#A09A94] mb-1">Modelo</label>
                                {providerValue === 'qwen' ? (
                                    <select
                                        {...configForm.register('model')}
                                        className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 text-[#F0EBE3]"
                                    >
                                        {QWEN_MODELS.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        {...configForm.register('model')}
                                        className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 text-[#F0EBE3]"
                                        placeholder="gpt-4o, claude-sonnet..."
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[#A09A94] mb-1">
                                    Temperatura ({temperatureValue})
                                </label>
                                <input
                                    {...configForm.register('temperature')}
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    className="w-full accent-[#BFA06A]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[#A09A94] mb-1">Max Tokens</label>
                                <input
                                    {...configForm.register('max_tokens')}
                                    type="number"
                                    min={1}
                                    max={8192}
                                    className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 text-[#F0EBE3]"
                                />
                            </div>
                        </div>

                        {/* System Prompt base */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setPromptExpanded((v) => !v)}
                                className="flex items-center gap-1 text-xs text-[#A09A94] hover:text-[#F0EBE3] mb-2"
                            >
                                {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                System Prompt base (opcional)
                            </button>
                            {promptExpanded && (
                                <textarea
                                    {...configForm.register('system_prompt')}
                                    rows={5}
                                    className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 font-mono resize-none text-[#F0EBE3]"
                                    placeholder="Instrução base do assistente. As skills ativas serão adicionadas automaticamente."
                                />
                            )}
                        </div>

                        {configError && <p className="text-xs text-red-400">{configError}</p>}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={configSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-[#BFA06A] text-white rounded-lg text-sm font-medium hover:bg-[#D4B87E] disabled:opacity-60 transition-colors"
                            >
                                {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar configuração
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Seção: Skills */}
            <div className="bg-[#131316] border border-white/6 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#BFA06A]/10">
                            <Sparkles className="w-5 h-5 text-[#BFA06A]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#F0EBE3]">Skills</span>
                                <span className="px-2 py-0.5 text-xs bg-[#BFA06A]/15 text-[#BFA06A] border border-[#BFA06A]/20 rounded-full font-medium">
                                    {skills.filter((s) => s.is_active).length} ativas
                                </span>
                            </div>
                            <p className="text-xs text-[#A09A94] mt-0.5">Gerencie as habilidades do Copiloto IA</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setGenerateModalOpen(true); setGeneratedPreview(null); setGenerateInput(''); setGenerateError(null); }}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#BFA06A]/20 text-[#BFA06A] rounded-lg hover:bg-[#BFA06A]/10 transition-all duration-200 font-medium"
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            Gerar com IA
                        </button>
                        <button
                            type="button"
                            onClick={openNewSkill}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-[#BFA06A] text-white rounded-lg hover:bg-[#D4B87E] transition-all duration-200 font-medium shadow-lg shadow-[#BFA06A]/20"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nova skill
                        </button>
                    </div>
                </div>

                {/* Skills Grid */}
                <div className="p-4">
                    {skillsLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-28 bg-white/[0.06] rounded-xl animate-pulse" />
                            ))}
                        </div>
                    )}

                    {!skillsLoading && skills.length === 0 && (
                        <div className="py-12 text-center text-[#A09A94]">
                            <div className="p-4 rounded-full bg-white/[0.04] w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                                <Brain className="w-8 h-8 opacity-40 text-[#4a4a54]" />
                            </div>
                            <p className="text-sm font-medium">Nenhuma skill cadastrada</p>
                            <p className="text-xs text-[#4a4a54] mt-1">Crie uma skill para começar a usar o Copiloto IA</p>
                        </div>
                    )}

                    {!skillsLoading && skills.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {skills.map((skill) => {
                                const catConfig = CATEGORY_CONFIG[skill.category];
                                const CategoryIcon = catConfig.icon;

                                return (
                                    <div
                                        key={skill.id}
                                        className={cn(
                                            "group relative rounded-xl border transition-all duration-300 overflow-hidden",
                                            skill.is_active
                                                ? "border-white/8 bg-gradient-to-br from-white/[0.06] to-transparent hover:border-white/12 hover:shadow-lg hover:shadow-black/20"
                                                : "border-white/4 bg-white/[0.02] opacity-60"
                                        )}
                                    >
                                        {/* Category accent bar */}
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", catConfig.bg.replace('/10', '/30'))} />

                                        <div className="p-4 pl-5">
                                            {/* Header: Icon + Name + Badges */}
                                            <div className="flex items-start gap-3 mb-2.5">
                                                <div className={cn(
                                                    "p-2 rounded-lg shrink-0",
                                                    catConfig.iconBg
                                                )}>
                                                    <CategoryIcon className={cn("w-4 h-4", catConfig.text)} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={cn(
                                                            "font-semibold text-sm truncate",
                                                            skill.is_active ? "text-[#F0EBE3]" : "text-[#4a4a54]"
                                                        )}>
                                                            {skill.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        <span className={cn(
                                                            "px-2 py-0.5 text-xs border rounded-full font-medium",
                                                            catConfig.bg,
                                                            catConfig.text,
                                                            catConfig.border
                                                        )}>
                                                            {CATEGORY_LABELS[skill.category]}
                                                        </span>
                                                        {skill.is_global && (
                                                            <span className="px-2 py-0.5 text-xs bg-red-500/15 text-red-400 border border-red-500/20 rounded-full font-semibold flex items-center gap-1">
                                                                <Shield className="w-3 h-3" />
                                                                Obrigatória
                                                            </span>
                                                        )}
                                                        <span className={cn(
                                                            "px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1",
                                                            skill.is_active
                                                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                                                : "bg-white/[0.04] text-[#4a4a54] border border-white/[0.06]"
                                                        )}>
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                skill.is_active ? "bg-emerald-400" : "bg-[#4a4a54]"
                                                            )} />
                                                            {skill.is_active ? "Ativa" : "Inativa"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <p className={cn(
                                                "text-xs leading-relaxed line-clamp-2 mb-3",
                                                skill.is_active ? "text-[#A09A94]" : "text-[#4a4a54]"
                                            )}>
                                                {skill.description}
                                            </p>

                                            {/* Actions bar */}
                                            <div className="flex items-center justify-between pt-3 border-t border-white/4">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditSkill(skill)}
                                                        className="p-2 text-[#A09A94] hover:text-[#F0EBE3] hover:bg-white/[0.06] rounded-lg transition-all duration-200"
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
                                                                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                                        title="Confirmar exclusão"
                                                                    >
                                                                        {deletingId === skill.id
                                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            : <Check className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDeleteConfirmId(null)}
                                                                        className="p-2 text-[#A09A94] hover:bg-white/[0.06] rounded-lg transition-colors"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDeleteConfirmId(skill.id)}
                                                                    className="p-2 text-[#A09A94] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                                                                    title="Excluir"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                <Switch
                                                    checked={skill.is_active}
                                                    onCheckedChange={(checked) => void toggleSkill(skill.id, checked)}
                                                    disabled={skill.is_global || togglingId === skill.id}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Skill Editor */}
            {skillModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#131316] border border-white/6 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/4">
                            <h3 className="font-semibold text-[#F0EBE3]">
                                {editingSkill ? 'Editar Skill' : 'Nova Skill'}
                            </h3>
                            <button type="button" onClick={closeSkillModal} className="text-[#A09A94] hover:text-[#F0EBE3]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form
                            onSubmit={skillForm.handleSubmit((data) => void saveSkill(data))}
                            className="p-5 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-medium text-[#A09A94] mb-1">Nome *</label>
                                <input
                                    {...skillForm.register('name')}
                                    className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 text-[#F0EBE3]"
                                    placeholder="Ex: Consultor de Joias"
                                />
                                {skillForm.formState.errors.name && (
                                    <p className="text-xs text-red-400 mt-1">{skillForm.formState.errors.name.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[#A09A94] mb-1">Descrição *</label>
                                <input
                                    {...skillForm.register('description')}
                                    className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 text-[#F0EBE3]"
                                    placeholder="O que essa skill faz?"
                                />
                                {skillForm.formState.errors.description && (
                                    <p className="text-xs text-red-400 mt-1">{skillForm.formState.errors.description.message}</p>
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

                            {skillError && <p className="text-xs text-red-400">{skillError}</p>}

                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={closeSkillModal}
                                    className="px-4 py-2 text-sm border border-white/10 rounded-lg text-[#A09A94] hover:bg-white/[0.03]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={skillSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#BFA06A] text-white rounded-lg text-sm font-medium hover:bg-[#D4B87E] disabled:opacity-60"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#131316] border border-white/6 rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/4">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-[#BFA06A]" />
                                <h3 className="font-semibold text-[#F0EBE3]">Gerar Skill com IA</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setGenerateModalOpen(false); setGeneratedPreview(null); setGenerateInput(''); }}
                                className="text-[#A09A94] hover:text-[#F0EBE3]"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {!generatedPreview ? (
                                <>
                                    <p className="text-sm text-[#A09A94]">
                                        Descreva o que você quer que o copiloto saiba fazer. A IA vai gerar a skill automaticamente.
                                    </p>
                                    <textarea
                                        value={generateInput}
                                        onChange={(e) => setGenerateInput(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 text-sm bg-[#0F0F11] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFA06A]/30 resize-none text-[#F0EBE3]"
                                        placeholder="Ex: Quero que a IA saiba explicar o processo de confecção de joias personalizadas e os prazos de cada etapa..."
                                    />
                                    {generateError && <p className="text-xs text-red-400">{generateError}</p>}
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => { setGenerateModalOpen(false); setGenerateInput(''); }}
                                            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-[#A09A94] hover:bg-white/[0.03]"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void generateSkill()}
                                            disabled={generateInput.trim().length < 10 || generating}
                                            className="flex items-center gap-2 px-4 py-2 bg-[#BFA06A] text-white rounded-lg text-sm font-medium hover:bg-[#D4B87E] disabled:opacity-60"
                                        >
                                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                            Gerar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-green-400 font-medium">Skill gerada. Revise antes de salvar:</p>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium text-[#A09A94]">Nome: </span>
                                            <span className="text-[#F0EBE3]">{generatedPreview.name}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-[#A09A94]">Descrição: </span>
                                            <span className="text-[#A09A94]">{generatedPreview.description}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-[#A09A94]">Categoria: </span>
                                            <span className={cn(
                                                'px-1.5 py-0.5 text-xs border rounded-full',
                                                generatedPreview.category === 'global' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                                                generatedPreview.category === 'atendimento' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' :
                                                generatedPreview.category === 'vendas' ? 'bg-green-500/15 text-green-400 border-green-500/20' :
                                                generatedPreview.category === 'meta' ? 'bg-purple-500/15 text-purple-400 border-purple-500/20' :
                                                'bg-white/[0.06] text-[#A09A94] border-white/[0.10]'
                                            )}>
                                                {CATEGORY_LABELS[generatedPreview.category]}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-[#A09A94] mb-1">System Prompt:</p>
                                            <pre className="text-xs bg-[#0F0F11] border border-white/6 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto text-[#F0EBE3]">
                                                {generatedPreview.system_prompt}
                                            </pre>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setGeneratedPreview(null)}
                                            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-[#A09A94] hover:bg-white/[0.03]"
                                        >
                                            Gerar novamente
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveSkillFromPreview}
                                            className="flex items-center gap-2 px-4 py-2 bg-[#BFA06A] text-white rounded-lg text-sm font-medium hover:bg-[#D4B87E]"
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
