import { createExpenseAction } from '@/app/(crm)/financeiro/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import type { FinancialEntriesResponse } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { formatCurrencyFromCents, formatDate } from '@/lib/utils';

export default async function FinancialPage({
    searchParams,
}: {
    searchParams?: {
        type?: 'ENTRADA' | 'SAIDA';
        category?: string;
        date_from?: string;
        date_to?: string;
        error?: string;
    };
}) {
    const session = requireSession();

    if (!['ADMIN', 'FINANCEIRO'].includes(session.user.role)) {
        return (
            <EmptyState
                title="Acesso restrito"
                description="O módulo financeiro é restrito aos perfis ADMIN e FINANCEIRO."
            />
        );
    }

    const query = new URLSearchParams({ limit: '100' });

    if (searchParams?.type) {
        query.set('type', searchParams.type);
    }

    if (searchParams?.category) {
        query.set('category', searchParams.category);
    }

    if (searchParams?.date_from) {
        query.set('date_from', searchParams.date_from);
    }

    if (searchParams?.date_to) {
        query.set('date_to', searchParams.date_to);
    }

    const financialResponse = await apiRequest<FinancialEntriesResponse>(`/financial-entries?${query.toString()}`);
    const categories = Array.from(new Set(financialResponse.data.map((entry) => entry.category))).sort((left, right) => left.localeCompare(right));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Financeiro"
                description="Entradas automáticas, saídas controladas e leitura operacional do caixa."
                actions={
                    <form method="get" className="flex flex-wrap gap-3">
                        <select
                            name="type"
                            defaultValue={searchParams?.type ?? ''}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                        >
                            <option value="">Todos os tipos</option>
                            <option value="ENTRADA">Entrada</option>
                            <option value="SAIDA">Saída</option>
                        </select>
                        <select
                            name="category"
                            defaultValue={searchParams?.category ?? ''}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                        >
                            <option value="">Todas as categorias</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                        <Input name="date_from" type="date" defaultValue={searchParams?.date_from ?? ''} />
                        <Input name="date_to" type="date" defaultValue={searchParams?.date_to ?? ''} />
                        <Button type="submit" variant="secondary">
                            Filtrar
                        </Button>
                    </form>
                }
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
                <KpiCard
                    label="Entradas"
                    value={formatCurrencyFromCents(financialResponse.summary.total_in_cents)}
                    helper="Recebimentos reconhecidos pelo sistema"
                />
                <KpiCard
                    label="Saídas"
                    value={formatCurrencyFromCents(financialResponse.summary.total_out_cents)}
                    helper="Despesas lançadas e vinculadas ao período"
                />
                <KpiCard
                    label="Saldo"
                    value={formatCurrencyFromCents(financialResponse.summary.balance_cents)}
                    helper="Diferença entre entradas e saídas da consulta"
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card title="Lançamentos" description="Histórico consolidado para auditoria e operação diária.">
                    {financialResponse.data.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum lançamento encontrado com os filtros atuais.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                    <tr>
                                        <th className="pb-3 pr-4 font-medium">Tipo</th>
                                        <th className="pb-3 pr-4 font-medium">Categoria</th>
                                        <th className="pb-3 pr-4 font-medium">Descrição</th>
                                        <th className="pb-3 pr-4 font-medium">Competência</th>
                                        <th className="pb-3 pr-4 font-medium">Criado por</th>
                                        <th className="pb-3 font-medium">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-canvas-border">
                                    {financialResponse.data.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="py-3 pr-4">
                                                <span
                                                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${
                                                        entry.type === 'ENTRADA'
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : 'border-rose-200 bg-rose-50 text-rose-700'
                                                    }`}
                                                >
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-gray-700">{entry.category}</td>
                                            <td className="py-3 pr-4 text-gray-700">{entry.description}</td>
                                            <td className="py-3 pr-4 text-gray-700">{formatDate(entry.competence_date)}</td>
                                            <td className="py-3 pr-4 text-gray-700">{entry.created_by.name}</td>
                                            <td className="py-3 font-medium text-gray-900">
                                                {formatCurrencyFromCents(entry.amount_cents)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                <Card title="Nova despesa" description="Registro manual de saída financeira com trilha de auditoria.">
                    <form action={createExpenseAction} className="grid gap-3">
                        <Input name="amount_cents" type="number" min="1" step="1" placeholder="Valor em centavos" required />
                        <Input name="category" placeholder="Categoria (ex.: INSUMOS)" required />
                        <Input name="competence_date" type="date" required />
                        <textarea
                            name="description"
                            placeholder="Descrição da despesa"
                            className="min-h-[120px] rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            required
                        />
                        <Button className="justify-center" type="submit">
                            Registrar despesa
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
