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
    ArrowDown,
    ArrowUp,
    FileJson2,
    GitBranch,
    Hand,
    Link2,
    MousePointer2,
    PanelRightClose,
    PanelRightOpen,
    Plus,
    Rocket,
    Save,
    Settings2,
    Trash2,
    Workflow,
    Zap,
} from 'lucide-react';
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
    icon,
    variant = 'primary',
    disabled,
}: {
    children: React.ReactNode;
    icon?: React.ReactNode;
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
            ) : icon ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{icon}</span>
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
    const [stageItems, setStageItems] = useState<PipelineStageRecord[]>(stages);
    const initial = useMemo(() => flowToReact(initialFlow, stageItems), [initialFlow, stageItems]);

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

    useEffect(() => {
        setStageItems(stages);
    }, [stages]);

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
            <section className="overflow-hidden rounded-[18px] border border-white/10 bg-[#111114] shadow-[var(--orion-shadow-card)]">
                {/* Header */}
                <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#151517] px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] text-[color:var(--orion-gold)]">
                            <Workflow className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <h1 className="truncate font-editorial text-[17px] font-bold text-[color:var(--orion-text)]">
                                    {pipeline.name}
                                </h1>
                                <span className="rounded-full border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-gold)]">
                                    {pipeline.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-[color:var(--orion-text-secondary)]">
                                {pipeline.slug} · {pipeline.published_at ? 'Publicado' : 'Rascunho não publicado'} · {stageItems.length} etapas
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {activeTab === 'builder' ? (
                            <button
                                type="button"
                                onClick={() => setShowSidePanel((v) => !v)}
                                className="inline-flex h-[34px] items-center gap-2 rounded-[8px] border border-white/10 px-3 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)] lg:hidden"
                            >
                                {showSidePanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                                {showSidePanel ? 'Esconder painel' : 'Mostrar painel'}
                            </button>
                        ) : null}
                        <form
                            ref={toggleFormRef}
                            action={toggleAction}
                            onSubmit={pipeline.is_active ? handleDeactivateSubmit : undefined}
                        >
                            <input type="hidden" name="pipeline_id" value={pipeline.id} />
                            <input type="hidden" name="slug" value={pipeline.slug} />
                            <input type="hidden" name="is_active" value={pipeline.is_active ? 'false' : 'true'} />
                            <SubmitButton variant={pipeline.is_active ? 'danger' : 'ghost'} icon={<Zap className="h-3.5 w-3.5" />}>
                                {pipeline.is_active ? 'Desativar' : 'Ativar'}
                            </SubmitButton>
                        </form>
                        <form action={publishAction}>
                            <input type="hidden" name="pipeline_id" value={pipeline.id} />
                            <input type="hidden" name="slug" value={pipeline.slug} />
                            <SubmitButton variant="primary" icon={<Rocket className="h-3.5 w-3.5" />}>Publicar pipeline</SubmitButton>
                        </form>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-[#0f0f11] px-4">
                    {([
                        ['builder', 'Builder visual', <GitBranch key="builder" className="h-3.5 w-3.5" />],
                        ['config', 'Configuração', <Settings2 key="config" className="h-3.5 w-3.5" />],
                        ['json', 'JSON', <FileJson2 key="json" className="h-3.5 w-3.5" />],
                    ] as const).map(([tab, label, icon]) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`inline-flex h-11 items-center gap-2 border-b-2 px-4 text-[12px] font-semibold transition ${
                                activeTab === tab
                                    ? 'border-[color:var(--orion-gold)] text-[color:var(--orion-gold)]'
                                    : 'border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            }`}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div
                    className={`grid h-[calc(100vh-230px)] min-h-[620px] ${
                        showSidePanel && activeTab === 'builder' ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''
                    }`}
                >
                    {/* Left side */}
                    <div className="relative flex min-h-0 min-w-0 flex-col border-r border-white/10 bg-[color:var(--orion-base)]">
                        {activeTab === 'builder' ? (
                            <>
                                {/* Toolbar */}
                                <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#111114] px-4 py-2">
                                    <div className="flex gap-1.5 rounded-[10px] border border-white/10 bg-[#0b0b0d] p-1">
                                        {([
                                            ['move', 'Mover', <MousePointer2 key="move" className="h-3.5 w-3.5" />],
                                            ['connect', 'Conectar', <Link2 key="connect" className="h-3.5 w-3.5" />],
                                            ['pan', 'Pan', <Hand key="pan" className="h-3.5 w-3.5" />],
                                        ] as const).map(([m, label, icon]) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setMode(m)}
                                                className={`inline-flex h-7 items-center gap-2 rounded-[7px] px-2.5 text-[11px] font-semibold transition ${
                                                    mode === m
                                                        ? 'bg-[color:var(--orion-gold)] text-black'
                                                        : 'text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]'
                                                }`}
                                            >
                                                {icon}
                                                {label}
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
                                            stages={stageItems}
                                            initialNodes={initial.nodes}
                                            initialEdges={initial.edges}
                                            mode={mode}
                                            onFlowChange={onFlowChange}
                                            onSelectionChange={setSelectedNode}
                                            flowName={initialFlow.name}
                                            registerNodeMutators={() => undefined}
                                        />
                                    </div>

                                    <NodesPalette stages={stageItems} />
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
                            <ConfigTab pipeline={pipeline} stages={stageItems} onStagesChange={setStageItems} onToast={setToast} />
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
                    {showSidePanel && activeTab === 'builder' ? (
                        <aside className="hidden flex-col gap-4 overflow-y-auto bg-[color:var(--orion-surface)] p-5 lg:flex">
                            <SidePanel
                                pipeline={pipeline}
                                stages={stageItems}
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
        <div className="absolute left-3 top-3 z-10 max-h-[calc(100%-88px)] w-[180px] overflow-y-auto rounded-[10px] border border-white/10 bg-[color:var(--orion-surface)] p-3 shadow-[var(--orion-shadow-popover)]">
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
                    <div className="space-y-1 pr-1">
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

function ConfigTab({
    pipeline,
    stages,
    onStagesChange,
    onToast,
}: {
    pipeline: PipelineRecord;
    stages: PipelineStageRecord[];
    onStagesChange: React.Dispatch<React.SetStateAction<PipelineStageRecord[]>>;
    onToast: (toast: { kind: 'success' | 'error'; message: string } | null) => void;
}) {
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState('#C8A97A');
    const [busyStageId, setBusyStageId] = useState<string | null>(null);
    const [isCreatingStage, setIsCreatingStage] = useState(false);
    const [stagesError, setStagesError] = useState<string | null>(null);

    const normalizeStages = useCallback((items: PipelineStageRecord[]) => (
        items.map((stage, index) => ({ ...stage, position: index + 1 }))
    ), []);

    const showError = (message: string) => {
        setStagesError(message);
        onToast({ kind: 'error', message });
    };

    const handleStageDraftChange = (stageId: string, patch: Partial<PipelineStageRecord>) => {
        onStagesChange((current) => current.map((stage) => (
            stage.id === stageId ? { ...stage, ...patch } : stage
        )));
    };

    const persistStageOrder = async (nextStages: PipelineStageRecord[]) => {
        const response = await fetch(`/api/internal/pipelines/${pipeline.id}/stages/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stages: nextStages.map((stage, index) => ({ id: stage.id, position: index + 1 })),
            }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message ?? 'Não foi possível reordenar as etapas.');
        }

        const json = await response.json();
        onStagesChange(Array.isArray(json.data) ? json.data : []);
    };

    const moveStage = async (stageId: string, direction: -1 | 1) => {
        const currentIndex = stages.findIndex((stage) => stage.id === stageId);
        const targetIndex = currentIndex + direction;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= stages.length) return;

        const previousStages = stages;
        const nextStages = [...stages];
        const [moved] = nextStages.splice(currentIndex, 1);
        nextStages.splice(targetIndex, 0, moved);
        const normalized = normalizeStages(nextStages);

        setStagesError(null);
        setBusyStageId(stageId);
        onStagesChange(normalized);

        try {
            await persistStageOrder(normalized);
            onToast({ kind: 'success', message: 'Ordem das etapas atualizada.' });
        } catch (error) {
            onStagesChange(previousStages);
            showError(error instanceof Error ? error.message : 'Não foi possível reordenar as etapas.');
        } finally {
            setBusyStageId(null);
        }
    };

    const saveStage = async (stage: PipelineStageRecord) => {
        setStagesError(null);
        setBusyStageId(stage.id);

        try {
            const response = await fetch(`/api/internal/pipelines/${pipeline.id}/stages/${stage.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: stage.name,
                    color: stage.color,
                    position: stage.position,
                    is_won: stage.is_won,
                    is_lost: stage.is_lost,
                }),
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message ?? 'Não foi possível salvar a etapa.');
            }

            const updatedStage = body.data as PipelineStageRecord;
            onStagesChange((current) => current.map((item) => (
                item.id === updatedStage.id ? updatedStage : item
            )));
            onToast({ kind: 'success', message: `Etapa "${updatedStage.name}" atualizada.` });
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Não foi possível salvar a etapa.');
        } finally {
            setBusyStageId(null);
        }
    };

    const deleteStage = async (stage: PipelineStageRecord) => {
        if (stage.is_won || stage.is_lost) {
            showError('Etapas de ganho/perda não podem ser removidas.');
            return;
        }

        setStagesError(null);
        setBusyStageId(stage.id);

        try {
            const response = await fetch(`/api/internal/pipelines/${pipeline.id}/stages/${stage.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message ?? 'Não foi possível remover a etapa.');
            }

            const remainingStages = normalizeStages(stages.filter((item) => item.id !== stage.id));
            onStagesChange(remainingStages);
            if (remainingStages.length > 0) {
                await persistStageOrder(remainingStages);
            }
            onToast({ kind: 'success', message: `Etapa "${stage.name}" removida.` });
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Não foi possível remover a etapa.');
        } finally {
            setBusyStageId(null);
        }
    };

    const createStage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newStageName.trim()) {
            showError('Informe o nome da nova etapa.');
            return;
        }

        setStagesError(null);
        setIsCreatingStage(true);

        try {
            const response = await fetch(`/api/internal/pipelines/${pipeline.id}/stages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newStageName.trim(),
                    color: newStageColor,
                    position: stages.length + 1,
                }),
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message ?? 'Não foi possível criar a etapa.');
            }

            const createdStage = body.data as PipelineStageRecord;
            onStagesChange((current) => [...current, createdStage].sort((a, b) => a.position - b.position));
            setNewStageName('');
            setNewStageColor('#C8A97A');
            onToast({ kind: 'success', message: `Etapa "${createdStage.name}" criada.` });
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Não foi possível criar a etapa.');
        } finally {
            setIsCreatingStage(false);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#0f0f11]">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="space-y-3">
                    <section className="rounded-[14px] border border-white/10 bg-[#171719] p-4">
                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)]">
                            <Workflow className="h-3.5 w-3.5 text-[color:var(--orion-gold)]" />
                            Pipeline
                        </div>
                        <h2 className="mt-3 truncate text-lg font-bold text-[color:var(--orion-text)]">{pipeline.name}</h2>
                        <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-[color:var(--orion-text-secondary)]">
                            {pipeline.description ?? 'Sem descrição operacional.'}
                        </p>
                        <dl className="mt-4 divide-y divide-white/5 rounded-[10px] border border-white/10 bg-[#101012] text-xs">
                            {[
                                ['Slug', pipeline.slug],
                                ['Ícone', pipeline.icon],
                                ['Default', pipeline.is_default ? 'Sim' : 'Não'],
                                ['Etapas', String(stages.length)],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <dt className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">{label}</dt>
                                    <dd className="truncate font-semibold text-[color:var(--orion-text)]">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    <section className="rounded-[14px] border border-white/10 bg-[#171719] p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)]">
                                Ordem atual
                            </p>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-[color:var(--orion-text-secondary)]">
                                {stages.length}
                            </span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                            {stages.map((stage) => (
                                <div key={stage.id} className="flex items-center gap-2 rounded-[9px] border border-white/10 bg-[#101012] px-3 py-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[color:var(--orion-text)]">{stage.name}</span>
                                    <span className="text-[10px] text-[color:var(--orion-text-muted)]">#{stage.position}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>

                <section className="min-w-0 rounded-[14px] border border-white/10 bg-[#151517]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                        <div>
                            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)]">
                                <GitBranch className="h-3.5 w-3.5 text-[color:var(--orion-gold)]" />
                                Etapas vinculadas
                            </div>
                            <p className="mt-1 text-[12px] text-[color:var(--orion-text-secondary)]">
                                Crie, ordene e marque etapas sem sair do builder.
                            </p>
                        </div>
                    </div>

                    <form
                        className="grid gap-3 border-b border-white/10 bg-[#101012] px-4 py-3 md:grid-cols-[minmax(220px,1fr)_112px_auto] md:items-end"
                        onSubmit={createStage}
                    >
                        <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                            <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Nova etapa</span>
                            <input
                                value={newStageName}
                                onChange={(event) => setNewStageName(event.target.value)}
                                placeholder="Ex: Negociação VIP"
                                className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-3 text-sm text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                            />
                        </label>
                        <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                            <span className="mb-1.5 block uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Cor</span>
                            <input
                                type="color"
                                value={newStageColor}
                                onChange={(event) => setNewStageColor(event.target.value)}
                                className="h-10 w-full rounded-[9px] border border-white/10 bg-[#171719] px-2"
                            />
                        </label>
                        <SubmitButton variant="primary" disabled={isCreatingStage} icon={<Plus className="h-3.5 w-3.5" />}>
                            {isCreatingStage ? 'Criando...' : 'Criar etapa'}
                        </SubmitButton>
                    </form>

                    {stagesError ? (
                        <p className="mx-4 mt-3 rounded-[9px] border border-[rgba(224,82,82,0.35)] bg-[rgba(224,82,82,0.08)] px-3 py-2 text-[11px] text-[color:var(--orion-red)]">
                            {stagesError}
                        </p>
                    ) : null}

                    <div className="divide-y divide-white/5 px-4 py-2">
                        {stages.map((stage) => (
                            <div key={stage.id} className="grid gap-3 py-3 xl:grid-cols-[minmax(220px,1fr)_104px_160px_260px] xl:items-center">
                                <label className="block text-[11px] text-[color:var(--orion-text-secondary)]">
                                    <span className="sr-only">Nome</span>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-white/10 bg-[#101012] text-[11px] font-black text-[color:var(--orion-text-secondary)]">
                                            {stage.position}
                                        </span>
                                        <input
                                            value={stage.name}
                                            onChange={(event) => handleStageDraftChange(stage.id, { name: event.target.value })}
                                            className="h-10 min-w-0 flex-1 rounded-[9px] border border-white/10 bg-[#101012] px-3 text-sm font-semibold text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                                        />
                                    </div>
                                </label>

                                <label className="flex items-center gap-2 text-[11px] text-[color:var(--orion-text-secondary)]">
                                    <span className="sr-only">Cor</span>
                                    <input
                                        type="color"
                                        value={stage.color}
                                        onChange={(event) => handleStageDraftChange(stage.id, { color: event.target.value })}
                                        className="h-9 w-full rounded-[9px] border border-white/10 bg-[#101012] px-2"
                                    />
                                </label>

                                <div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--orion-text-secondary)]">
                                    <label className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-white/10 bg-[#101012] px-2.5">
                                        <input
                                            type="checkbox"
                                            checked={stage.is_won}
                                            onChange={(event) => handleStageDraftChange(stage.id, { is_won: event.target.checked, is_lost: event.target.checked ? false : stage.is_lost })}
                                            className="accent-[#C8A97A]"
                                        />
                                        Ganho
                                    </label>
                                    <label className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-white/10 bg-[#101012] px-2.5">
                                        <input
                                            type="checkbox"
                                            checked={stage.is_lost}
                                            onChange={(event) => handleStageDraftChange(stage.id, { is_lost: event.target.checked, is_won: event.target.checked ? false : stage.is_won })}
                                            className="accent-[#C8A97A]"
                                        />
                                        Perda
                                    </label>
                                </div>

                                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => moveStage(stage.id, -1)}
                                        disabled={busyStageId === stage.id || stage.position === 1}
                                        title="Subir etapa"
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/10 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveStage(stage.id, 1)}
                                        disabled={busyStageId === stage.id || stage.position === stages.length}
                                        title="Descer etapa"
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/10 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void saveStage(stage)}
                                        disabled={busyStageId === stage.id}
                                        className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[color:var(--orion-gold)] px-3 text-[12px] font-semibold text-black hover:bg-[color:var(--orion-gold-light)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Save className="h-3.5 w-3.5" />
                                        {busyStageId === stage.id ? 'Salvando' : 'Salvar'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void deleteStage(stage)}
                                        disabled={busyStageId === stage.id || stage.is_won || stage.is_lost}
                                        title={stage.is_won || stage.is_lost ? 'Etapas finais não podem ser removidas' : 'Remover etapa'}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[rgba(224,82,82,0.4)] bg-[rgba(224,82,82,0.1)] text-[color:var(--orion-red)] hover:bg-[rgba(224,82,82,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
