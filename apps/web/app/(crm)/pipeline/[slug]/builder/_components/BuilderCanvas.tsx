'use client';

import {
    DragEvent as ReactDragEvent,
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    addEdge,
    Background,
    BackgroundVariant,
    Connection,
    Controls,
    Edge,
    Handle,
    MiniMap,
    Node,
    NodeProps,
    OnConnect,
    OnEdgesChange,
    OnNodesChange,
    Position,
    ReactFlow,
    ReactFlowProvider,
    applyEdgeChanges,
    applyNodeChanges,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFormStatus } from 'react-dom';
import type { PipelineRecord, PipelineStageRecord } from '@/lib/api';

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

export type BuilderNodeKind = 'trigger' | 'stage' | 'action' | 'condition';

interface BuilderNodeData extends Record<string, unknown> {
    kind: BuilderNodeKind;
    label: string;
    description?: string;
    stageId?: string;
    stageColor?: string;
}

type BuilderRFNode = Node<BuilderNodeData>;
type BuilderRFEdge = Edge;

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

interface BuilderCanvasProps {
    pipeline: PipelineRecord;
    stages: PipelineStageRecord[];
    initialFlow: FlowJsonShape;
    saveFlowAction: (formData: FormData) => Promise<void>;
    publishAction: (formData: FormData) => Promise<void>;
    toggleAction: (formData: FormData) => Promise<void>;
    initialToast?: { kind: 'success' | 'error'; message: string } | null;
}

// ────────────────────────────────────────────────────────────────────────────────
// Node visuals
// ────────────────────────────────────────────────────────────────────────────────

const KIND_META: Record<BuilderNodeKind, { label: string; color: string }> = {
    trigger: { label: 'TRIGGER', color: '#4caf82' },
    stage: { label: 'STAGE', color: '#bfa06a' },
    action: { label: 'ACTION', color: '#4a9eff' },
    condition: { label: 'CONDITION', color: '#f0a040' },
};

// Map legacy types from the existing default flow ("entry"/"qualify"/"close") so
// pipelines persisted before this refactor still render in the new canvas.
const LEGACY_TYPE_TO_KIND: Record<string, BuilderNodeKind> = {
    entry: 'trigger',
    trigger: 'trigger',
    qualify: 'stage',
    stage: 'stage',
    close: 'action',
    action: 'action',
    condition: 'condition',
};

function legacyKindFor(rawType: string): BuilderNodeKind {
    return LEGACY_TYPE_TO_KIND[rawType] ?? 'stage';
}

function CustomBuilderNode({ data, selected }: NodeProps<BuilderRFNode>) {
    const kind = data.kind;
    const meta = KIND_META[kind];
    const accent = data.stageColor ?? meta.color;

    return (
        <div
            className={`orion-builder-node group relative min-w-[180px] rounded-[10px] border bg-[color:var(--orion-elevated)] px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition ${
                selected ? 'border-[color:var(--orion-gold)]' : 'border-white/10 hover:border-[color:var(--orion-gold)]/60'
            }`}
            style={{ borderLeft: `3px solid ${accent}` }}
        >
            <Handle type="target" position={Position.Left} className="!bg-[color:var(--orion-gold)]" />
            <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
                {meta.label}
            </p>
            <p className="mt-1 text-[12px] font-bold text-[color:var(--orion-text)]">{data.label}</p>
            {data.description ? (
                <p className="mt-0.5 text-[10px] text-[color:var(--orion-text-secondary)]">{data.description}</p>
            ) : null}
            <Handle type="source" position={Position.Right} className="!bg-[color:var(--orion-gold)]" />
        </div>
    );
}

const NODE_TYPES = { builder: CustomBuilderNode } as const;

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function flowToReact(flow: FlowJsonShape, stages: PipelineStageRecord[]): {
    nodes: BuilderRFNode[];
    edges: BuilderRFEdge[];
} {
    const stagesById = new Map(stages.map((s) => [s.id, s] as const));
    const nodes: BuilderRFNode[] = flow.nodes.map((n) => {
        const kind = legacyKindFor(n.type);
        const stage = n.stageId ? stagesById.get(n.stageId) : undefined;
        const fallbackLabel = n.label ?? (stage ? stage.name : KIND_META[kind].label.toLowerCase());
        return {
            id: n.id,
            type: 'builder',
            position: { x: n.position[0], y: n.position[1] },
            data: {
                kind,
                label: fallbackLabel || n.id,
                description: stage ? `Etapa: ${stage.name}` : 'Etapa do fluxo',
                stageId: stage?.id,
                stageColor: stage?.color,
            },
        };
    });

    const edges: BuilderRFEdge[] = [];
    for (const [sourceId, targets] of Object.entries(flow.connections ?? {})) {
        for (const t of targets) {
            edges.push({
                id: `${sourceId}->${t.to}`,
                source: sourceId,
                target: t.to,
                animated: false,
            });
        }
    }
    return { nodes, edges };
}

function reactToFlow(
    name: string,
    rfNodes: BuilderRFNode[],
    rfEdges: BuilderRFEdge[],
): FlowJsonShape {
    const nodes: FlowJsonNode[] = rfNodes.map((n) => ({
        id: n.id,
        type: n.data.kind,
        position: [Math.round(n.position.x), Math.round(n.position.y)],
        label: n.data.label,
        stageId: n.data.stageId,
    }));
    const connections: Record<string, Array<{ to: string }>> = {};
    for (const e of rfEdges) {
        if (!connections[e.source]) connections[e.source] = [];
        connections[e.source].push({ to: e.target });
    }
    return { name, nodes, connections };
}

function newNodeId(kind: BuilderNodeKind, existing: BuilderRFNode[]): string {
    let i = 1;
    while (existing.some((n) => n.id === `${kind}-${i}`)) i += 1;
    return `${kind}-${i}`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────────

function SubmitButton({
    children,
    variant = 'primary',
    disabled,
}: {
    children: React.ReactNode;
    variant?: 'primary' | 'ghost' | 'danger';
    disabled?: boolean;
}) {
    const { pending } = useFormStatus();
    const base =
        'inline-flex h-[34px] items-center gap-2 rounded-[7px] px-4 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
    const variants = {
        primary: 'bg-[color:var(--orion-gold)] text-black hover:bg-[color:var(--orion-gold-light)]',
        ghost:
            'border border-white/10 text-[color:var(--orion-text)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)]',
        danger:
            'border border-[rgba(224,82,82,0.4)] bg-[rgba(224,82,82,0.1)] text-[color:var(--orion-red)] hover:bg-[rgba(224,82,82,0.2)]',
    } as const;
    return (
        <button type="submit" disabled={pending || disabled} className={`${base} ${variants[variant]}`}>
            {pending ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {children}
        </button>
    );
}

function ConfirmDeactivateModal({
    open,
    pipelineName,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    pipelineName: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] p-6 shadow-[var(--orion-shadow-dialog)]">
                <h2 className="font-editorial text-lg font-bold text-[color:var(--orion-text)]">
                    Desativar pipeline {pipelineName}?
                </h2>
                <p className="mt-2 text-sm text-[color:var(--orion-text-secondary)]">
                    Todos os leads em andamento serão pausados. Você pode reativar depois.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex h-9 items-center rounded-[7px] border border-white/10 px-4 text-[12px] font-semibold text-[color:var(--orion-text)] hover:border-[color:var(--orion-gold)]"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="inline-flex h-9 items-center rounded-[7px] border border-[rgba(224,82,82,0.5)] bg-[rgba(224,82,82,0.18)] px-4 text-[12px] font-bold text-[color:var(--orion-red)] hover:bg-[rgba(224,82,82,0.3)]"
                    >
                        Desativar
                    </button>
                </div>
            </div>
        </div>
    );
}

function Toast({ toast, onDismiss }: { toast: { kind: 'success' | 'error'; message: string } | null; onDismiss: () => void }) {
    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(onDismiss, 4000);
        return () => clearTimeout(id);
    }, [toast, onDismiss]);
    if (!toast) return null;
    const styles =
        toast.kind === 'success'
            ? 'border-[rgba(76,175,130,0.4)] bg-[rgba(76,175,130,0.12)] text-[color:var(--orion-green)]'
            : 'border-[rgba(224,82,82,0.4)] bg-[rgba(224,82,82,0.12)] text-[color:var(--orion-red)]';
    return (
        <div className={`fixed right-6 top-6 z-50 rounded-[10px] border px-4 py-3 text-sm font-semibold shadow-[var(--orion-shadow-popover)] ${styles}`}>
            {toast.message}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Inner canvas (consumes useReactFlow which requires the provider)
// ────────────────────────────────────────────────────────────────────────────────

interface InnerCanvasProps {
    stages: PipelineStageRecord[];
    initialNodes: BuilderRFNode[];
    initialEdges: BuilderRFEdge[];
    mode: 'move' | 'connect' | 'pan';
    onFlowChange: (flow: FlowJsonShape) => void;
    onSelectionChange: (node: BuilderRFNode | null) => void;
    flowName: string;
    registerNodeMutators: (mutators: {
        updateNodeLabel: (id: string, label: string) => void;
        deleteNode: (id: string) => void;
    }) => void;
}

function InnerCanvas({
    stages,
    initialNodes,
    initialEdges,
    mode,
    onFlowChange,
    onSelectionChange,
    flowName,
}: InnerCanvasProps) {
    const [nodes, setNodes] = useState<BuilderRFNode[]>(initialNodes);
    const [edges, setEdges] = useState<BuilderRFEdge[]>(initialEdges);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const { screenToFlowPosition } = useReactFlow();

    // Bubble flow up
    useEffect(() => {
        onFlowChange(reactToFlow(flowName, nodes, edges));
    }, [nodes, edges, flowName, onFlowChange]);

    const onNodesChange: OnNodesChange<BuilderRFNode> = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange: OnEdgesChange<BuilderRFEdge> = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );
    const onConnect: OnConnect = useCallback(
        (connection: Connection) =>
            setEdges((eds) => addEdge({ ...connection, id: `${connection.source}->${connection.target}` }, eds)),
        [],
    );

    const onDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const raw = event.dataTransfer.getData('application/orion-node');
            if (!raw) return;
            const payload = JSON.parse(raw) as { kind: BuilderNodeKind; stageId?: string };
            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const stage = payload.stageId ? stages.find((s) => s.id === payload.stageId) : undefined;
            const kind = payload.kind;
            const id = newNodeId(kind, nodes);
            const newNode: BuilderRFNode = {
                id,
                type: 'builder',
                position,
                data: {
                    kind,
                    label: stage ? stage.name : KIND_META[kind].label.toLowerCase(),
                    description: stage ? `Etapa: ${stage.name}` : 'Novo passo',
                    stageId: stage?.id,
                    stageColor: stage?.color,
                },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [nodes, screenToFlowPosition, stages],
    );

    const onSelChange = useCallback(
        ({ nodes: selected }: { nodes: BuilderRFNode[]; edges: BuilderRFEdge[] }) => {
            onSelectionChange(selected[0] ?? null);
        },
        [onSelectionChange],
    );

    const isPan = mode === 'pan';
    const isConnect = mode === 'connect';
    const cursorClass = isPan ? 'cursor-grab' : isConnect ? 'cursor-crosshair' : '';

    return (
        <div ref={wrapperRef} className={`orion-builder-canvas h-full w-full ${cursorClass}`} onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onSelectionChange={onSelChange}
                nodeTypes={NODE_TYPES}
                nodesDraggable={mode === 'move'}
                nodesConnectable={mode === 'connect'}
                elementsSelectable
                panOnDrag={mode === 'pan'}
                selectionOnDrag={mode === 'move'}
                fitView
                proOptions={{ hideAttribution: false }}
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.06)" />
                <Controls className="!bottom-4 !left-4" position="bottom-left" />
                <MiniMap
                    className="!bottom-4 !right-4 !bg-[color:var(--orion-surface)]"
                    nodeColor={(n) => {
                        const data = (n.data as BuilderNodeData) ?? { kind: 'stage' };
                        return data.stageColor ?? KIND_META[data.kind ?? 'stage'].color;
                    }}
                    maskColor="rgba(0,0,0,0.6)"
                    pannable
                    zoomable
                />
            </ReactFlow>

            {nodes.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-sm font-semibold text-[color:var(--orion-text-secondary)]">
                        Arraste um Trigger do painel para iniciar
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--orion-text-muted)]">
                        Você pode encadear Stages, Actions e Conditions à direita.
                    </p>
                </div>
            ) : null}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Outer (provider, header, tabs, side panels)
// ────────────────────────────────────────────────────────────────────────────────

export function BuilderCanvas({
    pipeline,
    stages,
    initialFlow,
    saveFlowAction,
    publishAction,
    toggleAction,
    initialToast,
}: BuilderCanvasProps) {
    const initial = useMemo(() => flowToReact(initialFlow, stages), [initialFlow, stages]);

    const [activeTab, setActiveTab] = useState<'builder' | 'config' | 'json'>('builder');
    const [mode, setMode] = useState<'move' | 'connect' | 'pan'>('move');
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showSidePanel, setShowSidePanel] = useState(true);
    const [selectedNode, setSelectedNode] = useState<BuilderRFNode | null>(null);
    const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(initialToast ?? null);
    const [currentFlow, setCurrentFlow] = useState<FlowJsonShape>(initialFlow);
    const [jsonDraft, setJsonDraft] = useState<string>(JSON.stringify(initialFlow, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);

    const toggleFormRef = useRef<HTMLFormElement | null>(null);

    const onFlowChange = useCallback((flow: FlowJsonShape) => {
        setCurrentFlow(flow);
        setJsonDraft(JSON.stringify(flow, null, 2));
    }, []);

    const onJsonDraftChange = (value: string) => {
        setJsonDraft(value);
        try {
            JSON.parse(value);
            setJsonError(null);
        } catch (e) {
            setJsonError(e instanceof Error ? e.message : 'JSON inválido');
        }
    };

    const handleDeactivateSubmit = (event: FormEvent<HTMLFormElement>) => {
        if (!pipeline.is_active) return; // activating doesn't need confirmation
        event.preventDefault();
        setShowDeactivateModal(true);
    };

    const confirmDeactivate = () => {
        setShowDeactivateModal(false);
        toggleFormRef.current?.requestSubmit();
    };

    return (
        <ReactFlowProvider>
            <Toast toast={toast} onDismiss={() => setToast(null)} />
            <ConfirmDeactivateModal
                open={showDeactivateModal}
                pipelineName={pipeline.name}
                onCancel={() => setShowDeactivateModal(false)}
                onConfirm={confirmDeactivate}
            />

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] shadow-[var(--orion-shadow-card)]">
                {/* Header */}
                <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🔀</span>
                        <h1 className="font-editorial text-[17px] font-bold text-[color:var(--orion-text)]">
                            {pipeline.name}
                        </h1>
                        <span className="rounded-full border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--orion-gold)]">
                            {pipeline.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-[color:var(--orion-text-secondary)]">
                            {pipeline.published_at ? 'Publicado' : 'Não publicado'}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowSidePanel((v) => !v)}
                            className="inline-flex h-[34px] items-center rounded-[7px] border border-white/10 px-3 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)] lg:hidden"
                        >
                            {showSidePanel ? 'Esconder painel' : 'Mostrar painel'}
                        </button>
                        <form
                            ref={toggleFormRef}
                            action={toggleAction}
                            onSubmit={pipeline.is_active ? handleDeactivateSubmit : undefined}
                        >
                            <input type="hidden" name="pipeline_id" value={pipeline.id} />
                            <input type="hidden" name="slug" value={pipeline.slug} />
                            <input type="hidden" name="is_active" value={pipeline.is_active ? 'false' : 'true'} />
                            <SubmitButton variant={pipeline.is_active ? 'danger' : 'ghost'}>
                                {pipeline.is_active ? 'Desativar' : 'Ativar'}
                            </SubmitButton>
                        </form>
                        <form action={publishAction}>
                            <input type="hidden" name="pipeline_id" value={pipeline.id} />
                            <input type="hidden" name="slug" value={pipeline.slug} />
                            <SubmitButton variant="primary">Publicar pipeline</SubmitButton>
                        </form>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-[color:var(--orion-base)] px-6">
                    {([
                        ['builder', 'Builder visual'],
                        ['config', 'Configuração'],
                        ['json', 'JSON'],
                    ] as const).map(([tab, label]) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-[13px] font-medium transition ${
                                activeTab === tab
                                    ? 'border-b-2 border-[color:var(--orion-gold)] text-[color:var(--orion-gold)]'
                                    : 'border-b-2 border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div
                    className={`grid h-[calc(100vh-260px)] min-h-[560px] ${
                        showSidePanel ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''
                    }`}
                >
                    {/* Left side */}
                    <div className="relative flex min-h-0 min-w-0 flex-col border-r border-white/10 bg-[color:var(--orion-base)]">
                        {activeTab === 'builder' ? (
                            <>
                                {/* Toolbar */}
                                <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
                                    <div className="flex gap-2">
                                        {(['move', 'connect', 'pan'] as const).map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setMode(m)}
                                                className={`inline-flex h-8 items-center rounded-[7px] border px-3 text-[11px] font-semibold transition ${
                                                    mode === m
                                                        ? 'border-[color:var(--orion-gold)] bg-[color:var(--orion-gold)] text-black'
                                                        : 'border-white/10 bg-[color:var(--orion-elevated)] text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                                                }`}
                                            >
                                                {m === 'move' ? 'Mover' : m === 'connect' ? 'Conectar' : 'Pan'}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">
                                        {currentFlow.nodes.length} nodes · {Object.values(currentFlow.connections).flat().length} conexões
                                    </span>
                                </div>

                                {/* Canvas + NODES sidebar */}
                                <div className="relative flex flex-1 min-h-0">
                                    <div className="relative flex-1 min-w-0">
                                        <InnerCanvas
                                            stages={stages}
                                            initialNodes={initial.nodes}
                                            initialEdges={initial.edges}
                                            mode={mode}
                                            onFlowChange={onFlowChange}
                                            onSelectionChange={setSelectedNode}
                                            flowName={initialFlow.name}
                                            registerNodeMutators={() => undefined}
                                        />
                                    </div>

                                    <NodesPalette stages={stages} />
                                </div>

                                {/* Save */}
                                <form
                                    action={saveFlowAction}
                                    className="flex items-center justify-between gap-3 border-t border-white/10 bg-[color:var(--orion-surface)] px-4 py-3"
                                >
                                    <input type="hidden" name="pipeline_id" value={pipeline.id} />
                                    <input type="hidden" name="slug" value={pipeline.slug} />
                                    <input type="hidden" name="flow_json" value={JSON.stringify(currentFlow)} />
                                    <p className="text-[11px] text-[color:var(--orion-text-secondary)]">
                                        Alterações são salvas ao clicar em &quot;Salvar estrutura&quot;.
                                    </p>
                                    <SubmitButton variant="primary">Salvar estrutura</SubmitButton>
                                </form>
                            </>
                        ) : null}

                        {activeTab === 'config' ? (
                            <ConfigTab pipeline={pipeline} stages={stages} />
                        ) : null}

                        {activeTab === 'json' ? (
                            <form
                                action={saveFlowAction}
                                className="flex h-full flex-col gap-3 p-4"
                                onSubmit={(e) => {
                                    if (jsonError) {
                                        e.preventDefault();
                                        setToast({ kind: 'error', message: 'JSON inválido — corrija antes de salvar.' });
                                    }
                                }}
                            >
                                <input type="hidden" name="pipeline_id" value={pipeline.id} />
                                <input type="hidden" name="slug" value={pipeline.slug} />
                                <textarea
                                    name="flow_json"
                                    value={jsonDraft}
                                    onChange={(e) => onJsonDraftChange(e.target.value)}
                                    className="min-h-0 flex-1 rounded-[10px] border border-white/10 bg-[color:var(--orion-base)] px-3 py-3 font-mono text-[12px] text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <p
                                        className={`text-[11px] ${
                                            jsonError ? 'text-[color:var(--orion-red)]' : 'text-[color:var(--orion-text-secondary)]'
                                        }`}
                                    >
                                        {jsonError ?? 'Edite o JSON canônico do flow.'}
                                    </p>
                                    <SubmitButton variant="primary" disabled={Boolean(jsonError)}>
                                        Salvar JSON
                                    </SubmitButton>
                                </div>
                            </form>
                        ) : null}
                    </div>

                    {/* Side panel */}
                    {showSidePanel ? (
                        <aside className="hidden flex-col gap-4 overflow-y-auto bg-[color:var(--orion-surface)] p-5 lg:flex">
                            <SidePanel
                                pipeline={pipeline}
                                stages={stages}
                                selectedNode={selectedNode}
                                flowNodeCount={currentFlow.nodes.length}
                            />
                        </aside>
                    ) : null}
                </div>
            </section>
        </ReactFlowProvider>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper components
// ────────────────────────────────────────────────────────────────────────────────

function NodesPalette({ stages }: { stages: PipelineStageRecord[] }) {
    const onDragStart = (event: ReactDragEvent<HTMLDivElement>, payload: { kind: BuilderNodeKind; stageId?: string }) => {
        event.dataTransfer.setData('application/orion-node', JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="absolute right-3 top-3 z-10 w-[180px] rounded-[10px] border border-white/10 bg-[color:var(--orion-surface)] p-3 shadow-[var(--orion-shadow-popover)]">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-secondary)]">
                Nodes
            </p>
            <div className="space-y-1">
                {(Object.keys(KIND_META) as BuilderNodeKind[]).map((kind) => {
                    const meta = KIND_META[kind];
                    return (
                        <div
                            key={kind}
                            draggable
                            onDragStart={(e) => onDragStart(e, { kind })}
                            className="flex cursor-grab items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-[11px] font-semibold text-[color:var(--orion-text)] hover:border-white/10 hover:bg-[color:var(--orion-elevated)] active:cursor-grabbing"
                        >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                            {meta.label.charAt(0) + meta.label.slice(1).toLowerCase()}
                        </div>
                    );
                })}
            </div>

            {stages.length > 0 ? (
                <>
                    <p className="mb-2 mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-secondary)]">
                        Stages reais
                    </p>
                    <div className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
                        {stages.map((stage) => (
                            <div
                                key={stage.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, { kind: 'stage', stageId: stage.id })}
                                className="flex cursor-grab items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-[10px] font-medium text-[color:var(--orion-text)] hover:border-white/10 hover:bg-[color:var(--orion-elevated)] active:cursor-grabbing"
                                title={`Arraste para criar um node vinculado a ${stage.name}`}
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                <span className="truncate">{stage.name}</span>
                            </div>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function SidePanel({
    pipeline,
    stages,
    selectedNode,
    flowNodeCount,
}: {
    pipeline: PipelineRecord;
    stages: PipelineStageRecord[];
    selectedNode: BuilderRFNode | null;
    flowNodeCount: number;
}) {
    return (
        <>
            {selectedNode ? (
                <div className="rounded-[14px] border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-elevated)] p-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-gold)]">
                        Node selecionado
                    </p>
                    <p className="mt-2 text-sm font-bold text-[color:var(--orion-text)]">{selectedNode.data.label}</p>
                    <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">
                        Tipo: {selectedNode.data.kind}
                    </p>
                    {selectedNode.data.stageId ? (
                        <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">
                            Vinculado à stage: {selectedNode.data.label}
                        </p>
                    ) : null}
                    <p className="mt-3 text-[10px] text-[color:var(--orion-text-muted)]">
                        Pressione Backspace ou Delete (com modo Mover ativo) para remover o node.
                    </p>
                </div>
            ) : null}

            <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-elevated)] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-secondary)]">
                    Publicação
                </p>
                <div className="mt-2 space-y-1 text-sm text-[color:var(--orion-text-secondary)]">
                    <p>Status: {pipeline.is_active ? 'Ativo' : 'Inativo'}</p>
                    <p>Publicado: {pipeline.published_at ? 'Sim' : 'Não'}</p>
                    <p>Slug: {pipeline.slug}</p>
                    <p>Flow: {flowNodeCount} nodes</p>
                </div>
            </div>

            <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-elevated)] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-secondary)]">
                    Etapas
                </p>
                <div className="mt-2 space-y-2">
                    {stages.map((stage) => (
                        <div
                            key={stage.id}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[color:var(--orion-base)] px-3 py-2 text-sm text-[color:var(--orion-text)]"
                        >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

function ConfigTab({ pipeline, stages }: { pipeline: PipelineRecord; stages: PipelineStageRecord[] }) {
    return (
        <div className="space-y-4 p-6">
            <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-elevated)] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-secondary)]">
                    Pipeline
                </p>
                <h2 className="mt-2 text-lg font-bold text-[color:var(--orion-text)]">{pipeline.name}</h2>
                <p className="text-sm text-[color:var(--orion-text-secondary)]">{pipeline.description ?? 'Sem descrição'}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-[color:var(--orion-text-secondary)]">
                    <div>
                        <dt className="uppercase tracking-[0.1em] text-[color:var(--orion-text-muted)]">Slug</dt>
                        <dd className="mt-0.5 text-[color:var(--orion-text)]">{pipeline.slug}</dd>
                    </div>
                    <div>
                        <dt className="uppercase tracking-[0.1em] text-[color:var(--orion-text-muted)]">Ícone</dt>
                        <dd className="mt-0.5 text-[color:var(--orion-text)]">{pipeline.icon}</dd>
                    </div>
                    <div>
                        <dt className="uppercase tracking-[0.1em] text-[color:var(--orion-text-muted)]">Default</dt>
                        <dd className="mt-0.5 text-[color:var(--orion-text)]">{pipeline.is_default ? 'Sim' : 'Não'}</dd>
                    </div>
                    <div>
                        <dt className="uppercase tracking-[0.1em] text-[color:var(--orion-text-muted)]">Etapas</dt>
                        <dd className="mt-0.5 text-[color:var(--orion-text)]">{stages.length}</dd>
                    </div>
                </dl>
            </div>

            <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-elevated)] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-secondary)]">
                    Etapas vinculadas
                </p>
                <div className="mt-3 space-y-2">
                    {stages.map((stage) => (
                        <div
                            key={stage.id}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-[color:var(--orion-base)] px-3 py-2 text-sm text-[color:var(--orion-text)]"
                        >
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                <span>{stage.name}</span>
                            </div>
                            <span className="text-xs text-[color:var(--orion-text-muted)]">
                                pos {stage.position}
                                {stage.is_won ? ' · won' : ''}
                                {stage.is_lost ? ' · lost' : ''}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-[11px] text-[color:var(--orion-text-muted)]">
                    Para reordenar etapas use o módulo de Pipelines · Etapas (em outra tela).
                </p>
            </div>
        </div>
    );
}
