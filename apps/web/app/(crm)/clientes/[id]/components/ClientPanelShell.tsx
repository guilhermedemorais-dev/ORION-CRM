'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface Props {
  customerId: string;
  initialCustomer: CustomerFull;
}

export default function ClientPanelShell({ customerId, initialCustomer }: Props) {
  const [customer, setCustomer] = useState<CustomerFull>(initialCustomer);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('ficha');
  const [showOSModal, setShowOSModal] = useState(false);
  const [canCreateDelivery, setCanCreateDelivery] = useState(false);
  const [chatSession, setChatSession] = useState<{ conversationId: string; channel: string } | null>(null);

  // Check if any OS is concluded or attendance block is at ENTREGA stage
  useEffect(() => {
    async function checkDeliveryEligibility() {
      try {
        const [osRes, blocksRes] = await Promise.all([
          fetch(`/api/internal/customers/${customerId}/service-orders`),
          fetch(`/api/internal/customers/${customerId}/attendance-blocks`),
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
    fetch(`/api/internal/customers/${customerId}/stats`)
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
            {activeTab === 'ficha' && (
              <ClientFichaTab
                customer={customer}
                customerId={customerId}
                onUpdate={handleCustomerUpdate}
              />
            )}
            {activeTab === 'agenda' && (
              <div className="max-w-4xl mx-auto py-2">
                <LeadAppointmentsTab leadId={lead?.id ?? null} customerId={customerId} />
              </div>
            )}
            {activeTab === 'atendimento' && (
              <ClientAtendimentoTab
                customerId={customerId}
                onOSCreated={handleOSCreated}
              />
            )}
            {activeTab === 'proposta' && (
              <ClientPropostaTab customerId={customerId} />
            )}
            {activeTab === 'pedidos' && (
              <ClientPedidosTab customerId={customerId} />
            )}
            {activeTab === 'os' && (
              <ClientOSTab
                customerId={customerId}
                initialShowModal={showOSModal}
                onModalClose={() => setShowOSModal(false)}
              />
            )}
            {activeTab === 'entrega' && (
              <ClientEntregaTab
                customerId={customerId}
                customer={customer}
                canCreateDelivery={canCreateDelivery}
              />
            )}
            {activeTab === 'historico' && (
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
