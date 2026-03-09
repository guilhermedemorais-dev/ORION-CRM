'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const createSchema = z.object({
    name: z.string().trim().min(3).max(255),
    definition_json: z.string().trim().optional(),
});

const updateSchema = createSchema.extend({
    workflow_id: z.string().trim().min(1),
});

const toggleSchema = z.object({
    workflow_id: z.string().trim().min(1),
    active: z.preprocess((value) => value === 'true' || value === true, z.boolean()),
});

const deleteSchema = z.object({
    workflow_id: z.string().trim().min(1),
});

function toAutomationError(message: string, selected?: string): string {
    const params = new URLSearchParams({ error: message });
    if (selected) params.set('selected', selected);
    return `/automacoes?${params.toString()}`;
}

function defaultFlowDefinition(name: string): Record<string, unknown> {
    const triggerName = 'Trigger';
    const actionName = 'Log';

    return {
        name,
        nodes: [
            {
                id: 'Trigger-1',
                name: triggerName,
                type: 'n8n-nodes-base.webhook',
                typeVersion: 2,
                position: [240, 280],
                parameters: {
                    httpMethod: 'POST',
                    path: `orion-${Date.now()}`,
                    responseMode: 'onReceived',
                },
            },
            {
                id: 'Code-1',
                name: actionName,
                type: 'n8n-nodes-base.code',
                typeVersion: 2,
                position: [520, 280],
                parameters: {
                    jsCode: "return [{ json: { ok: true, received_at: new Date().toISOString() } }];",
                },
            },
        ],
        connections: {
            [triggerName]: {
                main: [[{ node: actionName, type: 'main', index: 0 }]],
            },
        },
        settings: {
            executionOrder: 'v1',
            saveManualExecutions: true,
        },
    };
}

function parseDefinition(definitionJson: string | undefined, name: string): Record<string, unknown> {
    if (!definitionJson || definitionJson.trim().length === 0) {
        return defaultFlowDefinition(name);
    }

    try {
        const parsed = JSON.parse(definitionJson) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') {
            return defaultFlowDefinition(name);
        }
        return parsed;
    } catch {
        throw new Error('JSON de definição inválido.');
    }
}

function toFlowPayload(name: string, definition: Record<string, unknown>) {
    const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    const connections = definition.connections && typeof definition.connections === 'object'
        ? definition.connections as Record<string, unknown>
        : {};
    const settings = definition.settings && typeof definition.settings === 'object'
        ? definition.settings as Record<string, unknown>
        : undefined;
    const tags = Array.isArray(definition.tags)
        ? definition.tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined;
    const active = typeof definition.active === 'boolean' ? definition.active : undefined;

    return {
        name,
        nodes,
        connections,
        settings,
        tags,
        active,
    };
}

export async function createAutomationAction(formData: FormData) {
    const parsed = createSchema.safeParse({
        name: formData.get('name'),
        definition_json: formData.get('definition_json'),
    });

    if (!parsed.success) {
        redirect(toAutomationError('Preencha o nome e a definição da automação.'));
    }

    try {
        const definition = parseDefinition(parsed.data.definition_json, parsed.data.name);
        const payload = toFlowPayload(parsed.data.name, definition);
        const created = await apiRequest<{ id: string }>('/automations', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        revalidatePath('/automacoes');
        redirect(`/automacoes?selected=${created.id}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar automação.';
        redirect(toAutomationError(message));
    }
}

export async function updateAutomationAction(formData: FormData) {
    const parsed = updateSchema.safeParse({
        workflow_id: formData.get('workflow_id'),
        name: formData.get('name'),
        definition_json: formData.get('definition_json'),
    });

    if (!parsed.success) {
        redirect(toAutomationError('Dados inválidos para atualização.', String(formData.get('workflow_id') ?? '')));
    }

    try {
        const definition = parseDefinition(parsed.data.definition_json, parsed.data.name);
        const payload = toFlowPayload(parsed.data.name, definition);

        await apiRequest(`/automations/${parsed.data.workflow_id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });

        revalidatePath('/automacoes');
        redirect(`/automacoes?selected=${parsed.data.workflow_id}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao atualizar automação.';
        redirect(toAutomationError(message, parsed.data.workflow_id));
    }
}

export async function toggleAutomationAction(formData: FormData) {
    const parsed = toggleSchema.safeParse({
        workflow_id: formData.get('workflow_id'),
        active: formData.get('active'),
    });

    if (!parsed.success) {
        redirect(toAutomationError('Não foi possível alterar o status da automação.'));
    }

    try {
        await apiRequest(`/automations/${parsed.data.workflow_id}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ active: parsed.data.active }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao alterar status.';
        redirect(toAutomationError(message, parsed.data.workflow_id));
    }

    revalidatePath('/automacoes');
    redirect(`/automacoes?selected=${parsed.data.workflow_id}`);
}

export async function deleteAutomationAction(formData: FormData) {
    const parsed = deleteSchema.safeParse({
        workflow_id: formData.get('workflow_id'),
    });

    if (!parsed.success) {
        redirect(toAutomationError('Automação inválida para exclusão.'));
    }

    try {
        await apiRequest(`/automations/${parsed.data.workflow_id}`, {
            method: 'DELETE',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao excluir automação.';
        redirect(toAutomationError(message, parsed.data.workflow_id));
    }

    revalidatePath('/automacoes');
    redirect('/automacoes');
}

