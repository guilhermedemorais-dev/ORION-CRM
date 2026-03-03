import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import type { CustomerRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatCurrencyFromCents, formatDate, formatPhone } from '@/lib/utils';

interface CustomerDetail extends CustomerRecord {
    cpf?: string | null;
    notes?: string | null;
    total_orders?: number;
}

export default async function CustomerDetailPage({
    params,
}: {
    params: {
        id: string;
    };
}) {
    const customer = await apiRequest<CustomerDetail>(`/customers/${params.id}`);

    return (
        <div className="space-y-6">
            <PageHeader
                title={customer.name}
                description={`Perfil completo do cliente e contexto para o atendimento.`}
                actions={
                    <Link href="/clientes">
                        <Button variant="secondary">Voltar para clientes</Button>
                    </Link>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card title="Ficha rápida">
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">WhatsApp</p>
                            <p className="mt-1 text-sm text-gray-900">{formatPhone(customer.whatsapp_number)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Email</p>
                            <p className="mt-1 text-sm text-gray-900">{customer.email ?? 'Não informado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">CPF</p>
                            <p className="mt-1 text-sm text-gray-900">{customer.cpf ?? 'Não informado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Responsável</p>
                            <p className="mt-1 text-sm text-gray-900">{customer.assigned_to?.name ?? 'Sem responsável'}</p>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-6">
                    <Card title="Relacionamento">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Lifetime Value</p>
                                <p className="mt-2 font-serif text-2xl font-semibold text-gray-900">
                                    {formatCurrencyFromCents(customer.lifetime_value_cents)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Pedidos</p>
                                <p className="mt-2 font-serif text-2xl font-semibold text-gray-900">{customer.total_orders ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Atualizado</p>
                                <p className="mt-2 text-sm text-gray-900">{formatDate(customer.updated_at)}</p>
                            </div>
                        </div>
                    </Card>

                    <Card title="Notas">
                        <p className="text-sm text-gray-700">{customer.notes ?? 'Nenhuma nota registrada ainda.'}</p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
