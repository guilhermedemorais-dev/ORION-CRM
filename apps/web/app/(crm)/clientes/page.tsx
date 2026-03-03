import Link from 'next/link';
import { createCustomerAction } from '@/app/(crm)/clientes/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ApiListResponse, CustomerRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatCurrencyFromCents, formatDate, formatPhone } from '@/lib/utils';

export default async function CustomersPage({
    searchParams,
}: {
    searchParams?: {
        q?: string;
        error?: string;
    };
}) {
    const query = new URLSearchParams();
    if (searchParams?.q) {
        query.set('q', searchParams.q);
    }
    query.set('limit', '100');

    const response = await apiRequest<ApiListResponse<CustomerRecord>>(`/customers?${query.toString()}`);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Clientes"
                description="Base de relacionamento consolidada, com busca rápida e acesso ao perfil completo."
                actions={
                    <form method="get" className="flex gap-3">
                        <Input className="w-60" name="q" placeholder="Buscar clientes" defaultValue={searchParams?.q ?? ''} />
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

            <Card title="Novo Cliente" description="Cadastro manual para atendimento presencial ou base importada.">
                <form action={createCustomerAction} className="grid gap-3 md:grid-cols-4">
                    <Input name="name" placeholder="Nome completo" required />
                    <Input name="whatsapp_number" placeholder="+5511999999999" required />
                    <Input name="email" placeholder="email@cliente.com" />
                    <Button className="justify-center" type="submit">
                        Criar cliente
                    </Button>
                </form>
            </Card>

            {response.data.length === 0 ? (
                <EmptyState
                    title="Nenhum cliente encontrado"
                    description="Crie um cliente manualmente ou converta um lead para começar a preencher a base."
                />
            ) : (
                <Card title="Lista de Clientes" description="Lifetime Value formatado em reais e acesso ao perfil detalhado.">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-canvas-border text-xs uppercase tracking-[0.18em] text-gray-500">
                                    <th className="px-2 py-3">Cliente</th>
                                    <th className="px-2 py-3">WhatsApp</th>
                                    <th className="px-2 py-3">Responsável</th>
                                    <th className="px-2 py-3">Lifetime Value</th>
                                    <th className="px-2 py-3">Atualizado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {response.data.map((customer) => (
                                    <tr key={customer.id} className="border-b border-canvas-border/70 last:border-0">
                                        <td className="px-2 py-4">
                                            <Link href={`/clientes/${customer.id}`} className="font-medium text-gray-900 hover:text-brand-gold-dark">
                                                {customer.name}
                                            </Link>
                                            <p className="mt-1 text-xs text-gray-500">{customer.email ?? 'Sem email cadastrado'}</p>
                                        </td>
                                        <td className="px-2 py-4 text-gray-700">{formatPhone(customer.whatsapp_number)}</td>
                                        <td className="px-2 py-4 text-gray-700">{customer.assigned_to?.name ?? 'Sem responsável'}</td>
                                        <td className="px-2 py-4 font-medium text-gray-900">
                                            {formatCurrencyFromCents(customer.lifetime_value_cents)}
                                        </td>
                                        <td className="px-2 py-4 text-gray-500">{formatDate(customer.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
