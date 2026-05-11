import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import ClientPanelShell from './components/ClientPanelShell';
import type { CustomerFull } from './components/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CurrentUserInfo {
  custom_permissions?: Record<string, boolean> | null;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = requireSession();

  let customer: CustomerFull;

  try {
    customer = await apiRequest<CustomerFull>(`/customers/${id}/full`);
  } catch {
    try {
      customer = await apiRequest<CustomerFull>(`/customers/${id}`);
    } catch {
      redirect('/clientes');
    }
  }

  // Busca custom_permissions do usuário atual para refinar visibilidade da ficha.
  // Falha silenciosa: se não vier, cai no default por role.
  let customPermissions: Record<string, boolean> = {};
  try {
    const me = await apiRequest<CurrentUserInfo>('/users/me');
    if (me?.custom_permissions) customPermissions = me.custom_permissions;
  } catch {
    customPermissions = {};
  }

  return (
    <ClientPanelShell
      customerId={id}
      initialCustomer={customer}
      entityType="customer"
      userRole={session.user.role}
      customPermissions={customPermissions}
    />
  );
}
