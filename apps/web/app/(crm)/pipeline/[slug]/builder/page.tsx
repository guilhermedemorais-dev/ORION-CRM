import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import type { PipelineRecord, PipelineStageRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import {
    createPipelineAction,
    publishPipelineAction,
    savePipelineFlowAction,
    togglePipelineStatusAction,
} from '@/app/(crm)/pipeline/actions';

function defaultFlow(name: string) {
    return {
        name,
        nodes: [
            { id: 'entry', type: 'entry', position: [80, 80] },
            { id: 'qualify', type: 'qualify', position: [320, 80] },
            { id: 'close', type: 'close', position: [560, 80] },
        ],
        connections: {
            entry: [{ to: 'qualify' }],
            qualify: [{ to: 'close' }],
        },
    };
}

function parseNodes(flow: Record<string, unknown>): Array<{ id: string; type: string; position: [number, number] }> {
    const rawNodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    return rawNodes
        .map((node) => {
            if (!node || typeof node !== 'object') return null;
            const item = node as Record<string, unknown>;
            const position = Array.isArray(item.position) && item.position.length === 2
                ? [Number(item.position[0] ?? 0), Number(item.position[1] ?? 0)] as [number, number]
                : [0, 0] as [number, number];

            return {
                id: typeof item.id === 'string' ? item.id : 'node',
                type: typeof item.type === 'string' ? item.type : 'node',
                position,
            };
        })
        .filter((node): node is { id: string; type: string; position: [number, number] } => Boolean(node));
}

function nodeAccent(type: string) {
    switch (type) {
        case 'entry':
            return {
                border: '#10B981',
                label: 'TRIGGER',
            };
        case 'qualify':
            return {
                border: '#C8A97A',
                label: 'STAGE',
            };
        case 'close':
            return {
                border: '#3B82F6',
                label: 'ACTION',
            };
        default:
            return {
                border: '#8B5CF6',
                label: 'SKILL',
            };
    }
}

export default async function PipelineBuilderPage({
    params,
    searchParams,
}: {
    params: { slug: string };
    searchParams?: { error?: string; saved?: string; published?: string };
}) {
    const session = requireSession();

    if (session.user.role !== 'ADMIN') {
        redirect(`/pipeline/${params.slug}`);
    }

    if (params.slug === 'novo') {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Novo pipeline"
                    description="Crie um pipeline canônico antes de abrir o builder operacional."
                />

                {searchParams?.error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {searchParams.error}
                    </div>
                ) : null}

                <Card title="Criar pipeline" description="O slug é opcional. Se omitido, será gerado a partir do nome.">
                    <form action={createPipelineAction} className="grid gap-3">
                        <Input name="name" placeholder="Nome do pipeline" required />
                        <Input name="slug" placeholder="Slug opcional" />
                        <Input name="icon" placeholder="Icone lógico (ex.: users, shopping-bag, gem)" />
                        <textarea
                            name="description"
                            placeholder="Descrição operacional"
                            className="min-h-[120px] rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3 py-2 text-sm text-[color:var(--orion-text)] outline-none"
                        />
                        <Button type="submit" className="justify-center">
                            Criar e abrir builder
                        </Button>
                    </form>
                </Card>
            </div>
        );
    }

    const pipeline = await apiRequest<PipelineRecord>(`/pipelines/slug/${params.slug}`);
    const stagesResponse = await apiRequest<{ data: PipelineStageRecord[] }>(`/pipelines/${pipeline.id}/stages`);
    const flowJson = Object.keys(pipeline.flow_json ?? {}).length > 0
        ? pipeline.flow_json
        : defaultFlow(pipeline.name);
    const nodes = parseNodes(flowJson);

    return (
        <div className="space-y-4">
            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}
            {searchParams?.saved ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Flow salvo com sucesso.
                </div>
            ) : null}
            {searchParams?.published ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Pipeline publicado.
                </div>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-[#E8E5E0] bg-white shadow-card">
                <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-b border-[#E8E5E0] px-6 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🔀</span>
                        <h1 className="font-editorial text-[17px] font-bold text-[#111827]">{pipeline.name}</h1>
                        <span className="rounded-full bg-[rgba(200,169,122,0.12)] px-3 py-1 text-[11px] font-semibold text-[#A8895A]">
                            Builder visual
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <form action={togglePipelineStatusAction}>
                            <input type="hidden" name="pipeline_id" value={pipeline.id} />
                            <input type="hidden" name="slug" value={pipeline.slug} />
                            <input type="hidden" name="is_active" value={pipeline.is_active ? 'false' : 'true'} />
                            <button
                                type="submit"
                                className="inline-flex h-[34px] items-center rounded-[7px] border border-[#E8E5E0] px-4 text-[12px] font-semibold text-[#111827] transition hover:border-[#C8A97A] hover:text-[#A8895A]"
                            >
                                {pipeline.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                        </form>
                        <form action={publishPipelineAction}>
                            <input type="hidden" name="pipeline_id" value={pipeline.id} />
                            <input type="hidden" name="slug" value={pipeline.slug} />
                            <button
                                type="submit"
                                className="inline-flex h-[34px] items-center rounded-[7px] bg-[#C8A97A] px-4 text-[12px] font-bold text-black transition hover:bg-[#E8D5B0]"
                            >
                                Publicar pipeline
                            </button>
                        </form>
                    </div>
                </div>

                <div className="flex border-b border-[#E8E5E0] bg-white px-6">
                    <button className="border-b-2 border-[#C8A97A] px-4 py-3 text-[13px] font-bold text-[#A8895A]">Builder visual</button>
                    <button className="px-4 py-3 text-[13px] font-medium text-[#6B7280]">Configuração</button>
                    <button className="px-4 py-3 text-[13px] font-medium text-[#6B7280]">JSON</button>
                </div>

                <div className="grid min-h-[720px] xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="relative overflow-hidden border-r border-[#E8E5E0] bg-[#FAFAF9]" style={{ backgroundImage: 'radial-gradient(circle, #E8E5E0 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                        <div className="absolute left-4 top-4 z-10 flex gap-2">
                            {['Mover', 'Conectar', 'Pan'].map((label, index) => (
                                <button
                                    key={label}
                                    type="button"
                                    className={index === 0
                                        ? 'inline-flex h-8 items-center rounded-[7px] border border-[#C8A97A] bg-[#C8A97A] px-3 text-[11px] font-semibold text-black'
                                        : 'inline-flex h-8 items-center rounded-[7px] border border-[#E8E5E0] bg-white px-3 text-[11px] font-semibold text-[#111827]'}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="absolute bottom-4 left-4 z-10 flex gap-1">
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E8E5E0] bg-white text-sm text-[#6B7280]">−</button>
                            <div className="flex h-7 items-center rounded-md border border-[#E8E5E0] bg-white px-2 text-[11px] text-[#6B7280]">100%</div>
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E8E5E0] bg-white text-sm text-[#6B7280]">+</button>
                        </div>

                        <div className="absolute right-4 top-4 z-10 w-[148px] rounded-[10px] border border-[#E8E5E0] bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">Nodes</p>
                            {[
                                ['Trigger', '#10B981'],
                                ['Stage', '#C8A97A'],
                                ['Action', '#3B82F6'],
                                ['Condition', '#F59E0B'],
                            ].map(([label, color]) => (
                                <div key={label} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold text-[#111827]">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="relative h-full min-h-[720px] w-full overflow-auto p-16">
                            <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
                                {nodes.slice(0, -1).map((node, index) => {
                                    const nextNode = nodes[index + 1];
                                    if (!nextNode) return null;
                                    return (
                                        <path
                                            key={`${node.id}-${nextNode.id}`}
                                            d={`M ${node.position[0] + 160} ${node.position[1] + 44} C ${node.position[0] + 220} ${node.position[1] + 44}, ${nextNode.position[0] - 60} ${nextNode.position[1] + 44}, ${nextNode.position[0]} ${nextNode.position[1] + 44}`}
                                            fill="none"
                                            stroke="#D6D3D1"
                                            strokeWidth="3"
                                        />
                                    );
                                })}
                            </svg>

                            {nodes.map((node) => {
                                const accent = nodeAccent(node.type);
                                return (
                                    <div
                                        key={node.id}
                                        className="absolute min-w-[170px] rounded-[10px] border-[1.5px] border-[#E8E5E0] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition hover:border-[#C8A97A] hover:shadow-[0_4px_16px_rgba(200,169,122,0.15)]"
                                        style={{
                                            left: `${node.position[0]}px`,
                                            top: `${node.position[1]}px`,
                                            borderLeftWidth: '3px',
                                            borderLeftColor: accent.border,
                                        }}
                                    >
                                        <p className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: accent.border }}>
                                            {accent.label}
                                        </p>
                                        <p className="mt-1 text-[12px] font-bold text-[#111827]">{node.id}</p>
                                        <p className="mt-0.5 text-[10px] text-[#6B7280]">Etapa visual do fluxo</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="space-y-5 bg-white p-5">
                        <Card title="Publicação" description="Estado atual do pipeline e ações de ativação.">
                            <div className="space-y-3 text-sm text-[#6B7280]">
                                <div className="rounded-[10px] border border-[#E8E5E0] bg-[#F8F7F5] px-4 py-3">
                                    <p>Status: {pipeline.is_active ? 'Ativo' : 'Inativo'}</p>
                                    <p className="mt-1">Publicado: {pipeline.published_at ? 'Sim' : 'Não'}</p>
                                    <p className="mt-1">Etapas: {stagesResponse.data.length}</p>
                                </div>
                                <div className="rounded-[10px] border border-[#E8E5E0] bg-[#F8F7F5] px-4 py-3">
                                    <p>Slug: {pipeline.slug}</p>
                                    <p className="mt-1">Flow: {nodes.length} nodes</p>
                                </div>
                            </div>
                        </Card>

                        <Card title="Etapas" description="Etapas vinculadas ao pipeline atual.">
                            <div className="space-y-2">
                                {stagesResponse.data.map((stage) => (
                                    <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-[#E8E5E0] bg-[#F8F7F5] px-3 py-2 text-sm text-[#111827]">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                        {stage.name}
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card title="Flow JSON" description="Persistência canônica do builder até o canvas mais rico.">
                            <form action={savePipelineFlowAction} className="space-y-3">
                                <input type="hidden" name="pipeline_id" value={pipeline.id} />
                                <input type="hidden" name="slug" value={pipeline.slug} />
                                <textarea
                                    name="flow_json"
                                    defaultValue={JSON.stringify(flowJson, null, 2)}
                                    className="min-h-[260px] w-full rounded-md border border-[#E8E5E0] bg-[#F8F7F5] px-3 py-3 font-mono text-[11px] text-[#111827] outline-none"
                                />
                                <button
                                    type="submit"
                                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#C8A97A] text-sm font-bold text-black transition hover:bg-[#E8D5B0]"
                                >
                                    Salvar estrutura
                                </button>
                            </form>
                        </Card>
                    </aside>
                </div>
            </section>
        </div>
    );
}
