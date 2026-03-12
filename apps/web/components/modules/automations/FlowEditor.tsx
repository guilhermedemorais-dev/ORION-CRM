'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    addEdge,
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MiniMap,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
    type Connection,
    type Edge,
    type Node,
    type NodeProps,
    type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronDown, ChevronRight, Play, Save, Settings, Trash2, X, Zap } from 'lucide-react';
import type { AutomationCatalogGroup, AutomationCatalogItem, AutomationFlowDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Node type mapping ──────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
    triggers: '#C8A97A',
    actions: '#60a5fa',
    control: '#a78bfa',
};

const GROUP_BG: Record<string, string> = {
    triggers: 'rgba(200,169,122,0.12)',
    actions: 'rgba(96,165,250,0.12)',
    control: 'rgba(167,139,250,0.12)',
};

// ─── Custom Node Component ──────────────────────────────────────────────────

interface OrionNodeData extends Record<string, unknown> {
    label: string;
    group: 'triggers' | 'actions' | 'control';
    n8n_type: string;
    description: string;
    parameters: Record<string, string>;
}

function OrionNode({ data, selected }: NodeProps) {
    const d = data as OrionNodeData;
    const color = GROUP_COLORS[d.group] ?? '#C8A97A';
    const bg = GROUP_BG[d.group] ?? 'rgba(200,169,122,0.12)';

    return (
        <div
            className={cn(
                'min-w-[180px] rounded-xl border px-4 py-3 transition-shadow',
                selected ? 'shadow-[0_0_0_2px_#C8A97A]' : 'shadow-card'
            )}
            style={{
                background: '#16161A',
                borderColor: selected ? color : 'rgba(255,255,255,0.1)',
            }}
        >
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: color, border: 'none', width: 10, height: 10 }}
            />

            <div
                className="mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ background: bg, color }}
            >
                {d.group === 'triggers' ? <Zap className="h-2.5 w-2.5" /> : null}
                {d.group === 'actions' ? <Play className="h-2.5 w-2.5" /> : null}
                {d.group === 'control' ? <Settings className="h-2.5 w-2.5" /> : null}
                {d.group}
            </div>

            <div className="text-[13px] font-semibold text-white/90">{d.label}</div>

            {d.description ? (
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/40">{d.description}</p>
            ) : null}

            <Handle
                type="source"
                position={Position.Right}
                style={{ background: color, border: 'none', width: 10, height: 10 }}
            />
        </div>
    );
}

const NODE_TYPES = { orionNode: OrionNode };

// ─── n8n <→ React Flow converters ──────────────────────────────────────────

function n8nNodesToFlow(
    n8nNodes: Array<Record<string, unknown>>,
    catalog: AutomationCatalogGroup[]
): Node<OrionNodeData>[] {
    const allItems = catalog.flatMap((g) => g.items);

    return n8nNodes.map((n, index) => {
        const pos = (n.position as { x: number; y: number } | undefined) ?? { x: index * 220, y: 100 };
        const n8nType = String(n.type ?? '');
        const catalogItem = allItems.find((item) => item.n8n_type === n8nType);

        return {
            id: String(n.id ?? `node-${index}`),
            type: 'orionNode',
            position: { x: pos.x, y: pos.y },
            data: {
                label: String(n.name ?? catalogItem?.label ?? n8nType),
                group: (catalogItem?.group ?? 'actions') as OrionNodeData['group'],
                n8n_type: n8nType,
                description: String(catalogItem?.description ?? ''),
                parameters: (n.parameters as Record<string, string>) ?? {},
            },
        };
    });
}

function n8nConnectionsToEdges(connections: Record<string, unknown>): Edge[] {
    const edges: Edge[] = [];

    for (const [sourceNodeName, outputGroups] of Object.entries(connections)) {
        const groups = outputGroups as Record<string, Array<Array<{ node: string; type: string; index: number }>>>;

        for (const [, outputArr] of Object.entries(groups)) {
            outputArr.forEach((targets, outputIndex) => {
                targets.forEach((target, targetIndex) => {
                    edges.push({
                        id: `${sourceNodeName}-${outputIndex}-${target.node}-${targetIndex}`,
                        source: sourceNodeName,
                        target: target.node,
                        style: { stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 },
                        animated: false,
                    });
                });
            });
        }
    }

    return edges;
}

function flowToN8nNodes(nodes: Node<OrionNodeData>[]): Array<Record<string, unknown>> {
    return nodes.map((node, index) => ({
        id: node.id,
        name: node.data.label,
        type: node.data.n8n_type,
        position: node.position,
        parameters: node.data.parameters ?? {},
        typeVersion: 1,
        webhookId: undefined,
        disabled: false,
        notesInFlow: false,
        notes: '',
        retryOnFail: false,
        maxTries: 3,
        waitBetweenTries: 1000,
        alwaysOutputData: false,
        executeOnce: false,
        continueOnFail: false,
        pairedItem: { item: index },
        credentials: {},
    }));
}

function flowToN8nConnections(edges: Edge[]): Record<string, unknown> {
    const connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }> = {};

    for (const edge of edges) {
        if (!connections[edge.source]) {
            connections[edge.source] = { main: [[]] };
        }
        const main = connections[edge.source]!.main;
        if (!main[0]) {
            main[0] = [];
        }
        main[0].push({ node: edge.target, type: 'main', index: 0 });
    }

    return connections;
}

// ─── Node Config Panel ──────────────────────────────────────────────────────

function NodeConfigPanel({
    node,
    onClose,
    onChange,
    onDelete,
}: {
    node: Node<OrionNodeData>;
    onClose: () => void;
    onChange: (id: string, patch: Partial<OrionNodeData>) => void;
    onDelete: (id: string) => void;
}) {
    const d = node.data;
    const color = GROUP_COLORS[d.group] ?? '#C8A97A';

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
                        {d.group} · {d.n8n_type}
                    </div>
                    <div className="text-[14px] font-semibold text-white">{d.label}</div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-white/40 transition hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                        Nome do nó
                    </label>
                    <input
                        type="text"
                        value={d.label}
                        onChange={(e) => onChange(node.id, { label: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white outline-none transition focus:border-[#C8A97A]/40"
                    />
                </div>

                {d.parameters && Object.keys(d.parameters).length > 0 ? (
                    <div className="space-y-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                            Parâmetros
                        </div>
                        {Object.entries(d.parameters).map(([key, val]) => (
                            <div key={key}>
                                <label className="mb-1 block text-[11px] text-white/60">{key}</label>
                                <input
                                    type="text"
                                    value={String(val ?? '')}
                                    onChange={(e) => onChange(node.id, {
                                        parameters: { ...d.parameters, [key]: e.target.value },
                                    })}
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#C8A97A]/40"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[12px] text-white/30">Nenhum parâmetro configurável neste nó.</p>
                )}
            </div>

            <div className="border-t border-white/5 p-4">
                <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 py-2 text-[12px] font-semibold text-rose-300 transition hover:bg-rose-500/20"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover nó
                </button>
            </div>
        </div>
    );
}

// ─── Catalog Sidebar ────────────────────────────────────────────────────────

function CatalogSidebar({ catalog, onDrop }: { catalog: AutomationCatalogGroup[]; onDrop: (item: AutomationCatalogItem) => void }) {
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['triggers', 'actions']));

    const toggleGroup = (key: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-white/5 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">Catálogo de nós</p>
                <p className="mt-0.5 text-[11px] text-white/30">Clique para adicionar ao canvas</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {catalog.map((group) => {
                    const color = GROUP_COLORS[group.key] ?? '#C8A97A';
                    const isOpen = openGroups.has(group.key);

                    return (
                        <div key={group.key}>
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.key)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
                            >
                                {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
                                )}
                                <span className="text-[11px] font-semibold" style={{ color }}>{group.label}</span>
                            </button>

                            {isOpen && (
                                <div className="ml-2 space-y-0.5">
                                    {group.items.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => onDrop(item)}
                                            className="flex w-full flex-col rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-left transition hover:border-white/10 hover:bg-white/10"
                                        >
                                            <span className="text-[12px] font-medium text-white/80">{item.label}</span>
                                            <span className="text-[10px] leading-4 text-white/40 line-clamp-1">{item.description}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Inner Editor (needs ReactFlowProvider context) ─────────────────────────

function FlowEditorInner({
    flow,
    catalog,
    onSave,
    isSaving,
}: {
    flow: AutomationFlowDetail | null;
    catalog: AutomationCatalogGroup[];
    onSave: (nodes: Array<Record<string, unknown>>, connections: Record<string, unknown>) => void;
    isSaving: boolean;
}) {
    const { screenToFlowPosition } = useReactFlow();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

    const initialNodes = useMemo(
        () => (flow ? n8nNodesToFlow(flow.nodes, catalog) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [flow?.id]
    );
    const initialEdges = useMemo(
        () => (flow ? n8nConnectionsToEdges(flow.connections) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [flow?.id]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState<Node<OrionNodeData>>(initialNodes as Node<OrionNodeData>[]);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node<OrionNodeData> | null>(null);

    // Reset when flow changes
    useEffect(() => {
        setNodes(initialNodes as Node<OrionNodeData>[]);
        setEdges(initialEdges);
        setSelectedNode(null);
    }, [flow?.id, initialNodes, initialEdges, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) =>
            setEdges((eds) =>
                addEdge({ ...params, style: { stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 } }, eds)
            ),
        [setEdges]
    );

    const onNodeClick = useCallback((_: unknown, node: Node) => {
        setSelectedNode(node as Node<OrionNodeData>);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const handleAddNode = useCallback((item: AutomationCatalogItem) => {
        const center = rfInstance
            ? rfInstance.screenToFlowPosition({
                x: (reactFlowWrapper.current?.clientWidth ?? 600) / 2,
                y: (reactFlowWrapper.current?.clientHeight ?? 400) / 2,
            })
            : { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };

        const newNode: Node<OrionNodeData> = {
            id: `${item.key}-${Date.now()}`,
            type: 'orionNode',
            position: center,
            data: {
                label: item.label,
                group: item.group,
                n8n_type: item.n8n_type,
                description: item.description,
                parameters: {},
            },
        };

        setNodes((nds) => [...nds, newNode]);
    }, [rfInstance, setNodes]);

    const handleNodeChange = useCallback((id: string, patch: Partial<OrionNodeData>) => {
        setNodes((nds) =>
            nds.map((n) =>
                n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
            )
        );
        setSelectedNode((prev) =>
            prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev
        );
    }, [setNodes]);

    const handleNodeDelete = useCallback((id: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const handleSave = useCallback(() => {
        const n8nNodes = flowToN8nNodes(nodes);
        const n8nConnections = flowToN8nConnections(edges);
        onSave(n8nNodes, n8nConnections);
    }, [nodes, edges, onSave]);

    return (
        <div className="flex h-[680px] overflow-hidden rounded-[16px] border border-white/5 bg-[#0C0C0E]">
            {/* Catalog sidebar */}
            <div className="w-[200px] shrink-0 border-r border-white/5 bg-[#0F0F12]">
                <CatalogSidebar catalog={catalog} onDrop={handleAddNode} />
            </div>

            {/* Canvas */}
            <div className="relative flex flex-1 flex-col" ref={reactFlowWrapper}>
                <div className="flex items-center justify-between border-b border-white/5 bg-[#0F0F12] px-4 py-2.5">
                    <div>
                        <span className="text-[11px] font-semibold text-white/60">{flow?.name ?? 'Nenhum flow selecionado'}</span>
                        {flow ? (
                            <span className="ml-2 text-[10px] text-white/30">{nodes.length} nó(s) · {edges.length} conexão(ões)</span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !flow}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#C8A97A] px-4 py-1.5 text-[12px] font-bold text-black transition hover:bg-[#d4b98a] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Save className="h-3.5 w-3.5" />
                        {isSaving ? 'Salvando…' : 'Salvar flow'}
                    </button>
                </div>

                {!flow ? (
                    <div className="flex flex-1 items-center justify-center text-[13px] text-white/20">
                        Selecione um flow na tabela para editar no canvas
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange as Parameters<typeof ReactFlow>[0]['onNodesChange']}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onInit={setRfInstance}
                        nodeTypes={NODE_TYPES}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        deleteKeyCode="Delete"
                        style={{ background: '#0C0C0E' }}
                    >
                        <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.05)" gap={20} />
                        <Controls
                            style={{
                                background: '#16161A',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8,
                            }}
                        />
                        <MiniMap
                            style={{
                                background: '#0F0F12',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8,
                            }}
                            nodeColor={() => '#C8A97A'}
                        />
                    </ReactFlow>
                )}
            </div>

            {/* Node config panel */}
            {selectedNode ? (
                <div className="w-[240px] shrink-0 border-l border-white/5 bg-[#0F0F12]">
                    <NodeConfigPanel
                        node={selectedNode}
                        onClose={() => setSelectedNode(null)}
                        onChange={handleNodeChange}
                        onDelete={handleNodeDelete}
                    />
                </div>
            ) : null}
        </div>
    );
}

// ─── Public component ────────────────────────────────────────────────────────

export function FlowEditor({
    flow,
    catalog,
    onSave,
    isSaving = false,
}: {
    flow: AutomationFlowDetail | null;
    catalog: AutomationCatalogGroup[];
    onSave: (nodes: Array<Record<string, unknown>>, connections: Record<string, unknown>) => void;
    isSaving?: boolean;
}) {
    return (
        <ReactFlowProvider>
            <FlowEditorInner flow={flow} catalog={catalog} onSave={onSave} isSaving={isSaving} />
        </ReactFlowProvider>
    );
}
