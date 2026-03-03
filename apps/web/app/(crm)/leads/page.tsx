import { createLeadAction, convertLeadAction, updateLeadStageAction } from '@/app/(crm)/leads/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ApiListResponse, LeadRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/utils';

const stages: Array<LeadRecord['stage']> = [
    'NOVO',
    'QUALIFICADO',
    'PROPOSTA_ENVIADA',
    'NEGOCIACAO',
    'CONVERTIDO',
    'PERDIDO',
];

export default async function LeadsPage({
    searchParams,
}: {
    searchParams?: {
        q?: string;
        selected?: string;
        error?: string;
    };
}) {
    const query = new URLSearchParams();
    if (searchParams?.q) {
        query.set('q', searchParams.q);
    }
    query.set('limit', '100');

    const leadResponse = await apiRequest<ApiListResponse<LeadRecord>>(`/leads?${query.toString()}`);
    const selectedLead = searchParams?.selected
        ? await apiRequest<LeadRecord>(`/leads/${searchParams.selected}`).catch(() => null)
        : null;

    const grouped = stages.map((stage) => ({
        stage,
        leads: leadResponse.data.filter((lead) => lead.stage === stage),
    }));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Leads"
                description="Pipeline visual de qualificação e conversão do time comercial."
                actions={
                    <form method="get" className="flex flex-wrap gap-3">
                        <Input className="w-60" name="q" placeholder="Buscar por nome, WhatsApp ou email" defaultValue={searchParams?.q ?? ''} />
                        <Button type="submit" variant="secondary">
                            Buscar
                        </Button>
                    </form>
                }
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                    <Card title="Novo Lead" description="Cadastro rápido para o time alimentar o pipeline sem sair da página.">
                        <form action={createLeadAction} className="grid gap-3 md:grid-cols-4">
                            <Input name="name" placeholder="Nome do lead" required />
                            <Input name="whatsapp_number" placeholder="+5511999999999" required />
                            <select
                                name="source"
                                defaultValue="WHATSAPP"
                                className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="BALCAO">Balcão</option>
                                <option value="INDICACAO">Indicação</option>
                                <option value="OUTRO">Outro</option>
                            </select>
                            <Button className="justify-center" type="submit">
                                Criar lead
                            </Button>
                        </form>
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {grouped.map((column) => (
                            <Card key={column.stage} title={`${column.stage.replaceAll('_', ' ')} (${column.leads.length})`}>
                                <div className="space-y-3">
                                    {column.leads.length === 0 ? (
                                        <p className="text-sm text-gray-500">Sem leads nesta etapa.</p>
                                    ) : (
                                        column.leads.map((lead) => (
                                            <article
                                                key={lead.id}
                                                className="rounded-lg border border-canvas-border bg-white p-4 transition hover:shadow-card-hover"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <a href={`/leads?selected=${lead.id}`} className="text-sm font-semibold text-gray-900">
                                                            {lead.name ?? 'Lead sem nome'}
                                                        </a>
                                                        <p className="mt-1 text-xs text-gray-500">{formatPhone(lead.whatsapp_number)}</p>
                                                    </div>
                                                    <StatusBadge status={lead.stage} />
                                                </div>

                                                <p className="mt-3 text-xs text-gray-500">
                                                    Última interação: {formatDate(lead.last_interaction_at)}
                                                </p>

                                                <form action={updateLeadStageAction} className="mt-4 flex gap-2">
                                                    <input type="hidden" name="lead_id" value={lead.id} />
                                                    <select
                                                        name="stage"
                                                        defaultValue={lead.stage}
                                                        className="flex-1 rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                                    >
                                                        {stages.map((stage) => (
                                                            <option key={stage} value={stage}>
                                                                {stage.replaceAll('_', ' ')}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Button type="submit" variant="secondary">
                                                        Mover
                                                    </Button>
                                                </form>
                                            </article>
                                        ))
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="xl:sticky xl:top-20 xl:self-start">
                    {selectedLead ? (
                        <Card title={selectedLead.name ?? 'Lead sem nome'} description={formatPhone(selectedLead.whatsapp_number)}>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <StatusBadge status={selectedLead.stage} />
                                    <span className="text-xs uppercase tracking-[0.18em] text-gray-500">{selectedLead.source}</span>
                                </div>

                                <div className="grid gap-3">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Email</p>
                                        <p className="mt-1 text-sm text-gray-900">{selectedLead.email ?? 'Não informado'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Responsável</p>
                                        <p className="mt-1 text-sm text-gray-900">{selectedLead.assigned_to?.name ?? 'Fila geral'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Última interação</p>
                                        <p className="mt-1 text-sm text-gray-900">{formatDate(selectedLead.last_interaction_at)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Observações</p>
                                        <p className="mt-1 text-sm text-gray-900">{selectedLead.notes ?? 'Sem observações registradas.'}</p>
                                    </div>
                                </div>

                                {selectedLead.stage !== 'CONVERTIDO' ? (
                                    <form action={convertLeadAction}>
                                        <input type="hidden" name="lead_id" value={selectedLead.id} />
                                        <Button className="w-full justify-center" type="submit">
                                            Converter em cliente
                                        </Button>
                                    </form>
                                ) : null}
                            </div>
                        </Card>
                    ) : (
                        <EmptyState
                            title="Nenhum lead selecionado"
                            description="Clique em qualquer card do Kanban para abrir o painel lateral com detalhes e ações."
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
