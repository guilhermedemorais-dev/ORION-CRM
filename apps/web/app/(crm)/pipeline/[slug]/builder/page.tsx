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
                            className="min-h-[120px] rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
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
        <div className="space-y-6">
            <PageHeader
                title={`Builder · ${pipeline.name}`}
                description="Builder inicial do pipeline com persistência de flow_json, visualização de nós e publicação."
            />

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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Card title="Canvas inicial" description="Preview posicional dos nós persistidos no flow_json.">
                    <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-canvas-border bg-[radial-gradient(circle_at_top,#faf7ef,transparent_55%),linear-gradient(180deg,#ffffff,#f7f7fb)]">
                        {nodes.map((node) => (
                            <div
                                key={node.id}
                                className="absolute min-w-[140px] rounded-2xl border border-canvas-border bg-white px-4 py-3 shadow-card"
                                style={{ left: `${node.position[0]}px`, top: `${node.position[1]}px` }}
                            >
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{node.type}</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{node.id}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card title="Publicação" description="Controle de status e publicação do pipeline.">
                        <div className="space-y-3">
                            <div className="rounded-xl border border-canvas-border bg-[#FBFBFD] px-4 py-3 text-sm text-gray-700">
                                <p>Status: {pipeline.is_active ? 'Ativo' : 'Inativo'}</p>
                                <p className="mt-1">Publicado: {pipeline.published_at ? 'Sim' : 'Não'}</p>
                                <p className="mt-1">Etapas: {stagesResponse.data.length}</p>
                            </div>

                            <form action={togglePipelineStatusAction}>
                                <input type="hidden" name="pipeline_id" value={pipeline.id} />
                                <input type="hidden" name="slug" value={pipeline.slug} />
                                <input type="hidden" name="is_active" value={pipeline.is_active ? 'false' : 'true'} />
                                <Button type="submit" variant="secondary" className="w-full justify-center">
                                    {pipeline.is_active ? 'Desativar pipeline' : 'Ativar pipeline'}
                                </Button>
                            </form>

                            <form action={publishPipelineAction}>
                                <input type="hidden" name="pipeline_id" value={pipeline.id} />
                                <input type="hidden" name="slug" value={pipeline.slug} />
                                <Button type="submit" className="w-full justify-center">
                                    Publicar pipeline
                                </Button>
                            </form>
                        </div>
                    </Card>

                    <Card title="Etapas vinculadas" description="Etapas atuais desse pipeline.">
                        <div className="space-y-2">
                            {stagesResponse.data.map((stage) => (
                                <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-canvas-border bg-[#FBFBFD] px-3 py-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                    <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <Card title="Flow JSON" description="Persistência canônica do builder até a entrada do canvas mais rico.">
                <form action={savePipelineFlowAction} className="space-y-3">
                    <input type="hidden" name="pipeline_id" value={pipeline.id} />
                    <input type="hidden" name="slug" value={pipeline.slug} />
                    <textarea
                        name="flow_json"
                        defaultValue={JSON.stringify(flowJson, null, 2)}
                        className="min-h-[320px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none"
                    />
                    <Button type="submit" className="justify-center">
                        Salvar estrutura
                    </Button>
                </form>
            </Card>
        </div>
    );
}
