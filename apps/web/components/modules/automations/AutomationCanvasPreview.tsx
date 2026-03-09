import { cn } from '@/lib/utils';

interface NormalizedNode {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
}

function normalizeNodes(nodes: Array<Record<string, unknown>>): NormalizedNode[] {
    const extracted = nodes.map((node, index) => {
        const position = Array.isArray(node.position) ? node.position : [index * 220, 120];
        const x = typeof position[0] === 'number' ? position[0] : index * 220;
        const y = typeof position[1] === 'number' ? position[1] : 120;

        return {
            id: String(node.id ?? `node-${index + 1}`),
            name: String(node.name ?? `Nó ${index + 1}`),
            type: String(node.type ?? 'custom'),
            x,
            y,
        };
    });

    if (extracted.length === 0) {
        return [];
    }

    const minX = Math.min(...extracted.map((node) => node.x));
    const minY = Math.min(...extracted.map((node) => node.y));
    const maxX = Math.max(...extracted.map((node) => node.x));
    const maxY = Math.max(...extracted.map((node) => node.y));
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);

    return extracted.map((node) => ({
        ...node,
        x: ((node.x - minX) / width) * 82 + 8,
        y: ((node.y - minY) / height) * 68 + 12,
    }));
}

function readConnections(connections: Record<string, unknown>): Array<{ from: string; to: string }> {
    const edges: Array<{ from: string; to: string }> = [];

    for (const [source, rawConfig] of Object.entries(connections)) {
        if (!rawConfig || typeof rawConfig !== 'object') {
            continue;
        }

        const main = (rawConfig as { main?: unknown }).main;
        if (!Array.isArray(main)) {
            continue;
        }

        for (const branch of main) {
            if (!Array.isArray(branch)) {
                continue;
            }

            for (const edge of branch) {
                if (!edge || typeof edge !== 'object') {
                    continue;
                }

                const target = (edge as { node?: unknown }).node;
                if (typeof target === 'string') {
                    edges.push({ from: source, to: target });
                }
            }
        }
    }

    return edges;
}

export function AutomationCanvasPreview({
    nodes,
    connections,
}: {
    nodes: Array<Record<string, unknown>>;
    connections: Record<string, unknown>;
}) {
    const normalizedNodes = normalizeNodes(nodes);
    const edges = readConnections(connections);

    return (
        <div className="rounded-xl border border-canvas-border bg-[radial-gradient(circle_at_top,_rgba(191,160,106,0.08),_transparent_48%),linear-gradient(180deg,_#fff,_#faf7f2)] p-4">
            {normalizedNodes.length === 0 ? (
                <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-canvas-border text-sm text-gray-500">
                    Sem nós para visualizar neste workflow.
                </div>
            ) : (
                <div className="relative h-[360px] overflow-hidden rounded-lg border border-canvas-border bg-white">
                    <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                        {edges.map((edge, index) => {
                            const fromNode = normalizedNodes.find((node) => node.name === edge.from);
                            const toNode = normalizedNodes.find((node) => node.name === edge.to);

                            if (!fromNode || !toNode) {
                                return null;
                            }

                            const x1 = `${fromNode.x + 8}%`;
                            const y1 = `${fromNode.y + 6}%`;
                            const x2 = `${toNode.x + 8}%`;
                            const y2 = `${toNode.y + 6}%`;

                            return (
                                <line
                                    key={`${edge.from}-${edge.to}-${index}`}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="rgba(191,160,106,0.75)"
                                    strokeWidth="2"
                                    strokeDasharray="6 4"
                                />
                            );
                        })}
                    </svg>

                    {normalizedNodes.map((node, index) => (
                        <article
                            key={node.id}
                            className={cn(
                                'absolute min-w-[140px] max-w-[180px] rounded-xl border px-3 py-3 shadow-card',
                                index === 0
                                    ? 'border-brand-gold/40 bg-brand-gold/10'
                                    : 'border-canvas-border bg-white'
                            )}
                            style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
                        >
                            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-500">
                                {index === 0 ? 'Trigger' : 'Node'}
                            </div>
                            <h4 className="mt-1 text-sm font-semibold text-gray-900">{node.name}</h4>
                            <p className="mt-1 font-mono text-[11px] text-gray-500">{node.type}</p>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
