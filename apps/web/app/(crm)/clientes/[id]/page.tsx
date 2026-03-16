import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import ClientPanelShell from './components/ClientPanelShell';
import type { CustomerFull } from './components/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  let customer: CustomerFull;

  try {
    customer = await apiRequest<CustomerFull>(`/customers/${id}/full`);
  } catch {
    // Fallback: try basic customer endpoint
    try {
      customer = await apiRequest<CustomerFull>(`/customers/${id}`);
    } catch {
      redirect('/clientes');
    }
  }

  return <ClientPanelShell customerId={id} initialCustomer={customer} />;
}
