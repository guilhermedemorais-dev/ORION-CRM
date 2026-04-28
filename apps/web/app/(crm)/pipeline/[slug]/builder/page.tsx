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
import { BuilderCanvas } from './_components/BuilderCanvas';

interface FlowJsonNode {
    id: string;
    type: string;
    position: [number, number];
    label?: string;
    stageId?: string;
}

interface FlowJsonShape {
    name: string;
    nodes: FlowJsonNode[];
    connections: Record<string, Array<{ to: string }>>;
}

function defaultFlow(name: string, stages: PipelineStageRecord[]): FlowJsonShape {
    if (stages.length > 0) {
        const sorted = [...stages].sort((a, b) => a.position - b.position);
        const nodes: FlowJsonNode[] = [
            { id: 'trigger-1', type: 'trigger', position: [80, 80], label: 'Lead criado' },
            ...sorted.map((stage, idx) => ({
                id: `stage-${idx + 1}`,
                type: 'stage' as const,
                position: [280 + idx * 220, 80] as [number, number],
                label: stage.name,
                stageId: stage.id,
            })),
        ];
        const connections: Record<string, Array<{ to: string }>> = {};
        for (let i = 0; i < nodes.length - 1; i += 1) {
            connections[nodes[i].id] = [{ to: nodes[i + 1].id }];
        }
        return { name, nodes, connections };
    }

    return {
        name,
        nodes: [
            { id: 'trigger-1', type: 'trigger', position: [80, 80], label: 'Início' },
            { id: 'stage-1', type: 'stage', position: [320, 80], label: 'Qualificação' },
            { id: 'action-1', type: 'action', position: [560, 80], label: 'Encerrar' },
        ],
        connections: {
            'trigger-1': [{ to: 'stage-1' }],
            'stage-1': [{ to: 'action-1' }],
        },
    };
}

function normalizeFlow(input: unknown, fallbackName: string, stages: PipelineStageRecord[]): FlowJsonShape {
    if (!input || typeof input !== 'object') return defaultFlow(fallbackName, stages);
    const obj = input as Record<string, unknown>;
    const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
    if (rawNodes.length === 0) return defaultFlow(fallbackName, stages);

    const nodes: FlowJsonNode[] = rawNodes
        .map((node): FlowJsonNode | null => {
            if (!node || typeof node !== 'object') return null;
            const item = node as Record<string, unknown>;
            const positionRaw: [number, number] = Array.isArray(item.position) && item.position.length === 2
                ? [Number(item.position[0] ?? 0), Number(item.position[1] ?? 0)]
                : [0, 0];
            const id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : null;
            if (!id) return null;
            const result: FlowJsonNode = {
                id,
                type: typeof item.type === 'string' ? item.type : 'stage',
                position: positionRaw,
            };
            if (typeof item.label === 'string') result.label = item.label;
            if (typeof item.stageId === 'string') result.stageId = item.stageId;
            return result;
        })
        .filter((n): n is FlowJsonNode => n !== null);

    const connectionsRaw = obj.connections && typeof obj.connections === 'object'
        ? (obj.connections as Record<string, unknown>)
        : {};
    const connections: Record<string, Array<{ to: string }>> = {};
    for (const [src, value] of Object.entries(connectionsRaw)) {
        if (!Array.isArray(value)) continue;
        const targets: Array<{ to: string }> = [];
        for (const entry of value) {
            if (entry && typeof entry === 'object' && typeof (entry as { to?: unknown }).to === 'string') {
                targets.push({ to: (entry as { to: string }).to });
            }
        }
        if (targets.length > 0) connections[src] = targets;
    }

    return {
        name: typeof obj.name === 'string' ? obj.name : fallbackName,
        nodes,
        connections,
    };
}

export default async function PipelineBuilderPage({
    params,
    searchParams,
}: {
    params: { slug: string };
    searchParams?: { error?: string; saved?: string; published?: string };
}) {
    const session = requireSession();

    if (session.user.role !== 'ROOT') {
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
    const flow = normalizeFlow(pipeline.flow_json, pipeline.name, stagesResponse.data);

    const initialToast = searchParams?.error
        ? { kind: 'error' as const, message: decodeURIComponent(searchParams.error) }
        : searchParams?.saved
            ? { kind: 'success' as const, message: 'Flow salvo com sucesso.' }
            : searchParams?.published
                ? { kind: 'success' as const, message: 'Pipeline publicado.' }
                : null;

    return (
        <div className="space-y-4">
            <BuilderCanvas
                pipeline={pipeline}
                stages={stagesResponse.data}
                initialFlow={flow}
                saveFlowAction={savePipelineFlowAction}
                publishAction={publishPipelineAction}
                toggleAction={togglePipelineStatusAction}
                initialToast={initialToast}
            />
        </div>
    );
}
