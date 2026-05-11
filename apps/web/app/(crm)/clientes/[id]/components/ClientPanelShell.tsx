'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CustomerFull, CustomerStats, PipelineStage, LeadRecord } from './types';
import ClientTopbar from './ClientTopbar';
import ClientStagebar from './ClientStagebar';
import ClientLeftSidebar from './ClientLeftSidebar';
import ClientRightSidebar from './ClientRightSidebar';
import ClientTabs, { type TabKey } from './ClientTabs';
import ClientFichaTab from './tabs/ClientFichaTab';
import ClientAtendimentoTab from './tabs/ClientAtendimentoTab';
import ClientPropostaTab from './tabs/ClientPropostaTab';
import ClientPedidosTab from './tabs/ClientPedidosTab';
import ClientOSTab from './tabs/ClientOSTab';
import ClientEntregaTab from './tabs/ClientEntregaTab';
import ClientHistoricoTab from './tabs/ClientHistoricoTab';
import { QuickChatPanel } from './QuickChatPanel';
import { LeadAppointmentsTab } from '@/app/(crm)/agenda/components/LeadAppointmentsTab';
import { usePermissions } from '@/hooks/usePermissions';

interface Props {
  customerId: string;
  initialCustomer: CustomerFull;
  entityType?: 'customer' | 'lead';
  userRole: string;
  customPermissions?: Record<string, boolean>;
}

// Mapeia cada aba para a chave de permissão correspondente.
const TAB_PERMISSION: Record<TabKey, string> = {
  agenda: 'ficha.agenda.view',
  ficha: 'ficha.dados.view',
  atendimento: 'ficha.atendimento.view',
  proposta: 'ficha.proposta.view',
  pedidos: 'ficha.pedidos.view',
  os: 'ficha.os.view',
  entrega: 'ficha.entrega.view',
  caixa: 'ficha.caixa.view',
  historico: 'ficha.historico.view',
};

const DEFAULT_TAB_ORDER: TabKey[] = [
  'agenda', 'ficha', 'atendimento', 'proposta', 'pedidos', 'os', 'entrega', 'caixa', 'historico',
];

export default function ClientPanelShell({
  customerId,
  initialCustomer,
  entityType = 'customer',
  userRole,
  customPermissions,
}: Props) {
  const { can } = usePermissions(userRole, customPermissions);

  const visibleTabs = useMemo<TabKey[]>(
    () => DEFAULT_TAB_ORDER.filter((tab) => can(TAB_PERMISSION[tab])),
    [can],
  );
  const [customer, setCustomer] = useState<CustomerFull>(initialCustomer);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() => visibleTabs.includes('ficha') ? 'ficha' : (visibleTabs[0] ?? 'ficha'));

  // Se a aba ativa deixa de estar visível (perms mudaram), cai pra primeira disponível.
  useEffect(() => {
    if (!visibleTabs.includes(activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0]!);
    }
  }, [visibleTabs, activeTab]);
  const [showOSModal, setShowOSModal] = useState(false);
  const [canCreateDelivery, setCanCreateDelivery] = useState(false);
  const [chatSession, setChatSession] = useState<{ conversationId: string; channel: string } | null>(null);

  // Check if any OS is concluded or attendance block is at ENTREGA stage
  useEffect(() => {
    async function checkDeliveryEligibility() {
      try {
        const [osRes, blocksRes] = await Promise.all([
          fetch(`/api/v1/customers/${customerId}/service-orders`),
          fetch(`/api/v1/customers/${customerId}/attendance-blocks`),
        ]);
        const osData = osRes.ok ? await osRes.json() : { data: [] };
        const blocksData = blocksRes.ok ? await blocksRes.json() : { data: [] };

        const osList: Array<{ status: string }> = Array.isArray(osData) ? osData : (osData.data ?? []);
        const blocks: Array<{ pipeline_status: string }> = Array.isArray(blocksData) ? blocksData : (blocksData.data ?? []);

        const hasConcludedOS = osList.some((o) => o.status === 'CONCLUIDA' || o.status === 'concluida');
        const hasEntregaBlock = blocks.some((b) => b.pipeline_status === 'ENTREGA');

        setCanCreateDelivery(hasConcludedOS || hasEntregaBlock);
      } catch {
        // silently fail — button stays disabled
      }
    }
    checkDeliveryEligibility();
  }, [customerId]);

  // Fetch stats
  useEffect(() => {
    fetch(`/api/v1/customers/${customerId}/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, [customerId]);

  // Fetch lead for this customer (to get pipeline stage info)
  useEffect(() => {
    if (!customer.whatsapp_number) return;

    async function findLead() {
      try {
        // Search leads by whatsapp number
        const res = await fetch(`/api/internal/leads?q=${encodeURIComponent(customer.whatsapp_number)}&limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        const leads: LeadRecord[] = Array.isArray(data) ? data : (data.data ?? []);

        // Find the lead that was converted to this customer
        const matchedLead = leads.find(
          (l) => l.converted_customer_id === customerId || l.whatsapp_number === customer.whatsapp_number
        );

        if (matchedLead) {
          setLead(matchedLead);
          setCurrentStageId(matchedLead.stage_id ?? null);

          // Fetch stages for this pipeline
          if (matchedLead.pipeline_id) {
            const stagesRes = await fetch(`/api/internal/pipelines/${matchedLead.pipeline_id}/stages`);
            if (stagesRes.ok) {
              const stagesData = await stagesRes.json();
              setStages(Array.isArray(stagesData) ? stagesData : (stagesData.data ?? []));
            }
          }
        }
      } catch {
        // silently fail — stagebar is optional
      }
    }

    findLead();
  }, [customerId, customer.whatsapp_number]);

  function handleStageChange(stageId: string) {
    setCurrentStageId(stageId);
  }

  function handleCustomerUpdate(updated: Partial<CustomerFull>) {
    setCustomer((prev) => ({ ...prev, ...updated }));
  }

  function handleOSCreated() {
    setActiveTab('os');
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#070708',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* TopBar */}
      <ClientTopbar
        customer={customer}
        leadId={lead?.id ?? null}
        onWon={() => setCustomer((prev) => ({ ...prev, is_converted: true }))}
        onLost={() => setLead(null)}
      />

      {/* StageBar */}
      {stages.length > 0 && (
        <ClientStagebar
          stages={stages}
          currentStageId={currentStageId}
          leadId={lead?.id ?? null}
          onStageChange={handleStageChange}
        />
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left Sidebar */}
        <ClientLeftSidebar customer={customer} stats={stats} />

        {/* Center */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <ClientTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            visibleTabs={visibleTabs}
          />

          {/* Tab body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '18px 20px',
              background: '#0F0F11',
            }}
          >
            {activeTab === 'ficha' && can('ficha.dados.view') && (
              <ClientFichaTab
                customer={customer}
                customerId={customerId}
                entityType={entityType}
                onUpdate={handleCustomerUpdate}
              />
            )}
            {activeTab === 'agenda' && can('ficha.agenda.view') && (
              <div className="max-w-4xl mx-auto py-2">
                <LeadAppointmentsTab leadId={lead?.id ?? null} customerId={customerId} />
              </div>
            )}
            {activeTab === 'atendimento' && can('ficha.atendimento.view') && (
              <ClientAtendimentoTab
                customerId={customerId}
                onOSCreated={handleOSCreated}
              />
            )}
            {activeTab === 'proposta' && can('ficha.proposta.view') && (
              <ClientPropostaTab customerId={customerId} />
            )}
            {activeTab === 'pedidos' && can('ficha.pedidos.view') && (
              <ClientPedidosTab customerId={customerId} />
            )}
            {activeTab === 'os' && can('ficha.os.view') && (
              <ClientOSTab
                customerId={customerId}
                initialShowModal={showOSModal}
                onModalClose={() => setShowOSModal(false)}
              />
            )}
            {activeTab === 'entrega' && can('ficha.entrega.view') && (
              <ClientEntregaTab
                customerId={customerId}
                customer={customer}
                canCreateDelivery={canCreateDelivery}
              />
            )}
            {activeTab === 'caixa' && can('ficha.caixa.view') && (
              <div className="max-w-4xl mx-auto py-8 text-center">
                <div className="rounded-2xl border border-white/10 bg-[#141417] p-10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-gold)]">Caixa</p>
                  <h3 className="mt-2 text-xl font-semibold text-[color:var(--orion-text)]">
                    Caixa embutido na ficha
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[color:var(--orion-text-secondary)]">
                    Em breve: mesmo motor do PDV (carrinho, formas de pagamento, troco, Mercado Pago) acessível diretamente daqui — para fechar a venda sem sair da ficha do cliente.
                  </p>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">
                    Disponível na Fase 4 do roadmap
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'historico' && can('ficha.historico.view') && (
              <ClientHistoricoTab customerId={customerId} />
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <ClientRightSidebar
          customer={customer}
          stats={stats}
          onNewOS={() => {
            setActiveTab('os');
            setShowOSModal(true);
          }}
          onNewBlock={() => {
            setActiveTab('atendimento');
          }}
          onOpenChat={(conversationId, channel) => setChatSession({ conversationId, channel })}
        />
      </div>

      {/* Quick Chat Panel */}
      {chatSession && (
        <QuickChatPanel
          customer={customer}
          conversationId={chatSession.conversationId}
          channel={chatSession.channel}
          onClose={() => setChatSession(null)}
        />
      )}
    </div>
  );
}
