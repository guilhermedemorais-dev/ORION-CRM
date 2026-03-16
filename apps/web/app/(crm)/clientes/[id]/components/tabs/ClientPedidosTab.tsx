'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OrderRecord } from '../types';

interface Props {
  customerId: string;
}

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

const PERSONALIZADO_STEPS = ['Sinal', 'Design', '3D', 'Produção', 'Acabamento', 'Entrega'];
const PRONTA_ENTREGA_STEPS = ['Pedido', 'Pagamento', 'Separação', 'Entregue'];

const STATUS_ACTIVE: Record<string, string[]> = {
  RASCUNHO: ['Sinal'],
  AGUARDANDO_PAGAMENTO: ['Sinal', 'Design'],
  AGUARDANDO_APROVACAO_DESIGN: ['Sinal', 'Design', '3D'],
  APROVADO: ['Sinal', 'Design', '3D'],
  EM_PRODUCAO: ['Sinal', 'Design', '3D', 'Produção'],
  PRODUCAO: ['Sinal', 'Design', '3D', 'Produção'],
  CONTROLE_QUALIDADE: ['Sinal', 'Design', '3D', 'Produção', 'Acabamento'],
  CONCLUIDO: ['Sinal', 'Design', '3D', 'Produção', 'Acabamento', 'Entrega'],
  ENVIADO: ['Pedido', 'Pagamento', 'Separação'],
  RETIRADO: ['Pedido', 'Pagamento', 'Separação', 'Entregue'],
  AGUARDANDO_RETIRADA: ['Pedido', 'Pagamento', 'Separação'],
  PAGO: ['Pedido', 'Pagamento'],
  SEPARANDO: ['Pedido', 'Pagamento', 'Separação'],
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RASCUNHO: { label: 'Rascunho', color: '#7A7774', bg: 'rgba(122,119,116,0.10)', border: 'rgba(122,119,116,0.20)' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguard. Pag.', color: '#F0A040', bg: 'rgba(240,160,64,0.10)', border: 'rgba(240,160,64,0.25)' },
  PAGO: { label: 'Pago', color: '#3FB87A', bg: 'rgba(63,184,122,0.10)', border: 'rgba(63,184,122,0.25)' },
  EM_PRODUCAO: { label: 'Em Produção', color: '#5B9CF6', bg: 'rgba(91,156,246,0.10)', border: 'rgba(91,156,246,0.25)' },
  CONCLUIDO: { label: 'Concluído', color: '#3FB87A', bg: 'rgba(63,184,122,0.10)', border: 'rgba(63,184,122,0.25)' },
  CANCELADO: { label: 'Cancelado', color: '#E05252', bg: 'rgba(224,82,82,0.10)', border: 'rgba(224,82,82,0.25)' },
};

function StepDots({ steps, doneSteps }: { steps: string[]; doneSteps: string[] }) {
  const activeIdx = doneSteps.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
      {steps.map((step, idx) => {
        const isDone = idx < activeIdx;
        const isActive = idx === activeIdx;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: isDone ? '#3FB87A' : isActive ? '#C8A97A' : '#202026',
                border: `2px solid ${isDone ? '#3FB87A' : isActive ? '#C8A97A' : 'rgba(255,255,255,0.12)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: isDone ? '#070708' : isActive ? '#070708' : '#7A7774',
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: isActive ? '0 0 8px rgba(200,169,122,0.5)' : 'none',
                transition: 'all 0.2s',
              }}
              title={step}
            >
              {isDone ? '✓' : idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  width: '20px',
                  height: '2px',
                  background: isDone ? '#3FB87A' : 'rgba(255,255,255,0.08)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order }: { order: OrderRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isPersonalizado = order.type === 'PERSONALIZADO';
  const steps = isPersonalizado ? PERSONALIZADO_STEPS : PRONTA_ENTREGA_STEPS;
  const doneSteps = STATUS_ACTIVE[order.status] ?? [];
  const statusStyle = STATUS_LABELS[order.status] ?? STATUS_LABELS['RASCUNHO'];
  const num = order.order_number?.replace(/[^0-9]/g, '') ?? '0000';

  return (
    <div
      style={{
        background: '#141417',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Main row */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '12px',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '17px',
              fontWeight: 700,
              color: '#C8A97A',
              flexShrink: 0,
            }}
          >
            #{num}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: statusStyle.bg,
                  border: `1px solid ${statusStyle.border}`,
                  borderRadius: '20px',
                  padding: '1px 7px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: statusStyle.color,
                }}
              >
                {statusStyle.label}
              </span>
              <span
                style={{
                  background: '#1A1A1E',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  padding: '1px 7px',
                  fontSize: '10px',
                  color: '#7A7774',
                }}
              >
                {order.type === 'PERSONALIZADO' ? 'Personalizado' : order.type === 'PRONTA_ENTREGA' ? 'Pronta Entrega' : order.type}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '3px' }}>{fmtDate(order.created_at)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <StepDots steps={steps} doneSteps={doneSteps} />
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '14px',
              fontWeight: 700,
              color: '#F0EDE8',
            }}
          >
            {fmt(order.final_amount_cents)}
          </span>
          <span style={{ color: '#7A7774', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: '#0F0F11',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Número', value: order.order_number },
              { label: 'Tipo', value: order.type },
              { label: 'Status', value: statusStyle.label },
              { label: 'Valor', value: fmt(order.final_amount_cents) },
              { label: 'Pagamento', value: order.payment_method ?? '—' },
              { label: 'Data', value: fmtDate(order.created_at) },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '2px', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#C8C4BE' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {order.nfe_status && (
            <div style={{ marginTop: '10px' }}>
              <span
                style={{
                  background: order.nfe_status === 'EMITIDA' ? 'rgba(63,184,122,0.10)' : 'rgba(167,139,250,0.10)',
                  border: `1px solid ${order.nfe_status === 'EMITIDA' ? 'rgba(63,184,122,0.25)' : 'rgba(167,139,250,0.25)'}`,
                  borderRadius: '20px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  color: order.nfe_status === 'EMITIDA' ? '#3FB87A' : '#A78BFA',
                  fontWeight: 600,
                }}
              >
                🧾 NF-e: {order.nfe_status}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ background: '#202026', borderRadius: '10px', height: '72px', animation: 'pulse 1.4s ease-in-out infinite' }} />
  );
}

export default function ClientPedidosTab({ customerId }: Props) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/customers/${customerId}/orders`);
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      setError('Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#F0EDE8', fontWeight: 600, margin: 0 }}>
          Pedidos
        </h2>
        {!loading && (
          <span style={{ fontSize: '12px', color: '#7A7774' }}>
            {orders.length} pedido{orders.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><Skeleton /><Skeleton /><Skeleton /></div>}

      {!loading && error && (
        <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
          <button onClick={fetchOrders} style={{ height: '30px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '12px', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div style={{ border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
          <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nenhum pedido registrado</p>
          <p style={{ color: '#7A7774', fontSize: '12px' }}>Os pedidos deste cliente aparecerão aqui.</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </>
  );
}
