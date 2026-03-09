import { AppError } from '../lib/errors.js';

export interface PipelineFlowNode {
    id: string;
    type?: string;
    position?: [number, number];
}

export interface PipelineFlowShape {
    nodes: PipelineFlowNode[];
    connections?: Record<string, unknown>;
}

export function normalizePipelineSlug(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100);
}

export function assertPublishablePipelineFlow(flow: unknown): PipelineFlowShape {
    if (!flow || typeof flow !== 'object') {
        throw AppError.badRequest('Flow inválido para publicação.');
    }

    const maybeFlow = flow as Partial<PipelineFlowShape>;
    const nodes = Array.isArray(maybeFlow.nodes) ? maybeFlow.nodes : [];

    if (nodes.length === 0) {
        throw AppError.badRequest('O pipeline precisa ter ao menos um nó antes da publicação.');
    }

    for (const node of nodes) {
        if (!node || typeof node.id !== 'string' || node.id.trim().length === 0) {
            throw AppError.badRequest('Todo nó do flow precisa ter um id válido.');
        }
    }

    return {
        nodes,
        connections: maybeFlow.connections && typeof maybeFlow.connections === 'object'
            ? maybeFlow.connections
            : {},
    };
}

export function isPipelineVisibleForRole(isActive: boolean, role: string): boolean {
    if (role === 'ADMIN') {
        return true;
    }

    return isActive;
}
