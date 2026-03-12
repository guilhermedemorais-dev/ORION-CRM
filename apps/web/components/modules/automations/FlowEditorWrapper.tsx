'use client';

import { useTransition } from 'react';
import type { AutomationCatalogGroup, AutomationFlowDetail } from '@/lib/api';
import { FlowEditor } from './FlowEditor';

interface FlowEditorWrapperProps {
    flow: AutomationFlowDetail | null;
    catalog: AutomationCatalogGroup[];
    workflowId: string | null;
    onSaveAction: (workflowId: string, nodes: Array<Record<string, unknown>>, connections: Record<string, unknown>) => Promise<void>;
}

export function FlowEditorWrapper({ flow, catalog, workflowId, onSaveAction }: FlowEditorWrapperProps) {
    const [isPending, startTransition] = useTransition();

    function handleSave(nodes: Array<Record<string, unknown>>, connections: Record<string, unknown>) {
        if (!workflowId) return;
        startTransition(async () => {
            await onSaveAction(workflowId, nodes, connections);
        });
    }

    return (
        <FlowEditor
            flow={flow}
            catalog={catalog}
            onSave={handleSave}
            isSaving={isPending}
        />
    );
}
