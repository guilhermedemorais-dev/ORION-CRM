import { redirect } from 'next/navigation';
import {
    createAutomationAction,
    deleteAutomationAction,
    saveCanvasFlowAction,
    toggleAutomationAction,
    updateAutomationAction,
} from '@/app/(crm)/automacoes/actions';
import { AutomationCatalogPanel } from '@/components/modules/automations/AutomationCatalogPanel';
import { FlowEditorWrapper } from '@/components/modules/automations/FlowEditorWrapper';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import type {
    ApiListResponse,
    AutomationCatalogGroup,
    AutomationExecution,
    AutomationFlowDetail,
    AutomationFlowListItem,
} from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

function statusClassName(active: boolean): string {
    return active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-100 text-gray-700';
}

function prettyFlowDefinition(flow: AutomationFlowDetail | null): string {
    if (!flow) {
        return JSON.stringify(
            {
                nodes: [],
                connections: {},
                settings: {
                    executionOrder: 'v1',
                },
            },
            null,
            2
        );
    }

    return JSON.stringify(
        {
            nodes: flow.nodes,
            connections: flow.connections,
            settings: flow.settings ?? {},
            tags: flow.tags,
            active: flow.active,
        },
        null,
        2
    );
}

export default async function AutomationsPage({
    searchParams,
}: {
    searchParams?: {
        selected?: string;
        error?: string;
    };
}) {
    const session = requireSession();

    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    let flows: AutomationFlowListItem[] = [];
    let fetchError: string | null = null;
    let catalog: AutomationCatalogGroup[] = [];

    try {
        const [flowResponse, catalogResponse] = await Promise.all([
            apiRequest<ApiListResponse<AutomationFlowListItem> & { meta: { total: number } }>('/automations'),
            apiRequest<ApiListResponse<AutomationCatalogGroup>>('/automations/catalog'),
        ]);
        flows = flowResponse.data;
        catalog = catalogResponse.data;
    } catch (error) {
        fetchError = error instanceof Error ? error.message : 'Falha ao carregar automações.';
    }

    const selectedId = searchParams?.selected ?? flows[0]?.id ?? null;
    const selectedFlowItem = selectedId ? flows.find((flow) => flow.id === selectedId) ?? null : null;

    let selectedFlow: AutomationFlowDetail | null = null;
    let executions: AutomationExecution[] = [];
    let selectedError: string | null = null;

    if (selectedId) {
        try {
            selectedFlow = await apiRequest<AutomationFlowDetail>(`/automations/${selectedId}`);
            const executionResponse = await apiRequest<ApiListResponse<AutomationExecution>>(
                `/automations/${selectedId}/executions?limit=10`
            );
            executions = executionResponse.data;
        } catch (error) {
            selectedError = error instanceof Error ? error.message : 'Falha ao carregar detalhes da automação.';
        }
    }

    const activeCount = flows.filter((flow) => flow.active).length;
    const systemCount = flows.filter((flow) => flow.is_system).length;
    const customCount = Math.max(flows.length - systemCount, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Automações"
                description="Builder operacional do n8n com catálogo curado de nós, CRUD administrativo e leitura visual do workflow selecionado."
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            {fetchError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {fetchError}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Flows totais" description="Workflows visíveis para administração no n8n.">
                    <p className="font-serif text-3xl font-semibold text-gray-900">{flows.length}</p>
                </Card>
                <Card title="Ativos" description="Automações com execução habilitada.">
                    <p className="font-serif text-3xl font-semibold text-emerald-700">{activeCount}</p>
                </Card>
                <Card title="Customizados" description="Flows criados pelo time ORION (não-sistema).">
                    <p className="font-serif text-3xl font-semibold text-gray-900">{customCount}</p>
                </Card>
            </div>

            <Card
                title="Catálogo curado do builder"
                description="Subset de nós expostos no ORION para o builder visual da fase 2, já alinhado com o PRD do n8n."
            >
                {catalog.length === 0 ? (
                    <p className="text-sm text-gray-500">Catálogo indisponível neste ambiente.</p>
                ) : (
                    <AutomationCatalogPanel groups={catalog} />
                )}
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_470px]">
                <div className="space-y-6">
                    <Card title="Nova automação" description="Crie um flow customizado. Se não enviar JSON, um template inicial será gerado.">
                        <form action={createAutomationAction} className="space-y-3">
                            <Input name="name" required placeholder="Ex.: Follow-up Lead sem resposta" />
                            <textarea
                                name="definition_json"
                                placeholder='JSON opcional com "nodes" e "connections"'
                                className="min-h-[180px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                            />
                            <Button type="submit" className="justify-center">
                                Criar automação
                            </Button>
                        </form>
                    </Card>

                    <Card title="Flows disponíveis" description="Sistema e customizados no mesmo painel, com status e última execução local.">
                        {flows.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhum workflow encontrado no n8n.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                        <tr>
                                            <th className="pb-3 pr-4 font-medium">Flow</th>
                                            <th className="pb-3 pr-4 font-medium">Tipo</th>
                                            <th className="pb-3 pr-4 font-medium">Status</th>
                                            <th className="pb-3 pr-4 font-medium">Execuções</th>
                                            <th className="pb-3 font-medium">Atualizado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-canvas-border">
                                        {flows.map((flow) => (
                                            <tr key={flow.id}>
                                                <td className="py-3 pr-4">
                                                    <a href={`/automacoes?selected=${flow.id}`} className="font-medium text-gray-900 hover:text-brand-gold-dark">
                                                        {flow.name}
                                                    </a>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    {flow.is_system ? (
                                                        <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                            Sistema
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                            Custom
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusClassName(flow.active)}`}>
                                                        {flow.active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">{flow.execution_count}</td>
                                                <td className="py-3 text-gray-700">
                                                    {formatDate(flow.updated_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    <div>
                        <div className="mb-3">
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text)]">Editor visual</h2>
                            <p className="mt-1 text-sm text-[color:var(--orion-text-secondary)]">Drag-and-drop de nós do catálogo, conexões e configuração inline. Salva direto no n8n.</p>
                        </div>
                        <FlowEditorWrapper
                            flow={selectedFlow}
                            catalog={catalog}
                            workflowId={selectedId}
                            onSaveAction={saveCanvasFlowAction}
                        />
                    </div>
                </div>

                <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
                    <Card
                        title={selectedFlow?.name ?? selectedFlowItem?.name ?? 'Detalhes da automação'}
                        description={selectedFlowItem
                            ? `${selectedFlowItem.is_system ? 'Flow de sistema' : 'Flow customizado'} · ${selectedFlowItem.nodes_count} nó(s)`
                            : 'Selecione uma automação para editar e acompanhar execuções.'}
                    >
                        {!selectedId ? (
                            <p className="text-sm text-gray-500">Selecione um flow na tabela para editar.</p>
                        ) : selectedError ? (
                            <p className="text-sm text-red-600">{selectedError}</p>
                        ) : (
                            <div className="space-y-4">
                                <form action={updateAutomationAction} className="space-y-3">
                                    <input type="hidden" name="workflow_id" value={selectedId} />
                                    <Input name="name" required defaultValue={selectedFlow?.name ?? selectedFlowItem?.name ?? ''} />
                                    <textarea
                                        name="definition_json"
                                        defaultValue={prettyFlowDefinition(selectedFlow)}
                                        className="min-h-[260px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                    />
                                    <Button type="submit" className="w-full justify-center">
                                        Salvar estrutura
                                    </Button>
                                </form>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <form action={toggleAutomationAction}>
                                        <input type="hidden" name="workflow_id" value={selectedId} />
                                        <input type="hidden" name="active" value={selectedFlowItem?.active ? 'false' : 'true'} />
                                        <Button type="submit" variant="secondary" className="w-full justify-center">
                                            {selectedFlowItem?.active ? 'Desativar' : 'Ativar'}
                                        </Button>
                                    </form>
                                    <form action={deleteAutomationAction}>
                                        <input type="hidden" name="workflow_id" value={selectedId} />
                                        <Button
                                            type="submit"
                                            variant="secondary"
                                            className="w-full justify-center border-red-200 text-red-700 hover:border-red-300 hover:text-red-800"
                                            disabled={Boolean(selectedFlowItem?.is_system)}
                                        >
                                            {selectedFlowItem?.is_system ? 'Flow protegido' : 'Excluir'}
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card title="Execuções recentes" description="Últimas 10 execuções reportadas pelo n8n para o flow selecionado.">
                        {!selectedId ? (
                            <p className="text-sm text-gray-500">Selecione um flow para ver execuções.</p>
                        ) : executions.length === 0 ? (
                            <p className="text-sm text-gray-500">Sem execuções recentes.</p>
                        ) : (
                            <ul className="space-y-2">
                                {executions.map((execution) => (
                                    <li key={execution.id} className="rounded-md border border-canvas-border bg-white px-3 py-2 text-xs text-gray-700">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-semibold text-gray-900">#{execution.id}</span>
                                            <span className="uppercase tracking-[0.14em] text-gray-500">
                                                {execution.status ?? (execution.finished ? 'finished' : 'running')}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-gray-500">
                                            Início: {formatDate(execution.startedAt ?? null)}
                                        </p>
                                        <p className="text-gray-500">
                                            Fim: {formatDate(execution.stoppedAt ?? null)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
