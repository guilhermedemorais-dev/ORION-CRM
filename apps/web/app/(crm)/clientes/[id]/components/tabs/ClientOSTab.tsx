'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AttendanceBlock } from '../types';

interface Props {
  customerId: string;
  initialShowModal?: boolean;
  onModalClose?: () => void;
}

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
}

const PIPELINE_STATUS_LABEL: Record<string, string> = {
  OS:      'Em fabricação',
  ENTREGA: 'Aguardando entrega',
};

const PIPELINE_STATUS_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  OS:      { bg: 'rgba(45,212,191,0.10)',  border: 'rgba(45,212,191,0.30)',  text: '#2DD4BF' },
  ENTREGA: { bg: 'rgba(63,184,122,0.10)',  border: 'rgba(63,184,122,0.30)',  text: '#3FB87A' },
};

function OSBlockCard({ block }: { block: AttendanceBlock }) {
  const statusKey = (block.pipeline_status ?? 'OS').toUpperCase();
  const badge = PIPELINE_STATUS_COLOR[statusKey] ?? PIPELINE_STATUS_COLOR['OS'];
  const statusLabel = PIPELINE_STATUS_LABEL[statusKey] ?? 'Em fabricação';

  const specItems: { label: string; value: string }[] = [];
  if (block.metal)         specItems.push({ label: 'Metal',    value: block.metal });
  if (block.stone)         specItems.push({ label: 'Pedra',    value: block.stone });
  if (block.ring_size)     specItems.push({ label: 'Aro',      value: block.ring_size });
  if (block.band_thickness) specItems.push({ label: 'Espessura', value: `${block.band_thickness}mm` });
  if (block.prong_count)   specItems.push({ label: 'Garras',   value: String(block.prong_count) });
  if (block.finish)        specItems.push({ label: 'Acabamento', value: block.finish });
  if (block.engraving)     specItems.push({ label: 'Gravação', value: block.engraving });

  return (
    <div
      style={{
        background: '#141417',
        border: '1px solid rgba(45,212,191,0.15)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'rgba(45,212,191,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          {block.so_number && (
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 700, color: '#2DD4BF', flexShrink: 0 }}>
              {block.so_number}
            </span>
          )}
          <span style={{ fontSize: '13px', color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {block.product_name ?? block.title}
          </span>
        </div>
        <span
          style={{
            background: badge.bg, border: `1px solid ${badge.border}`,
            borderRadius: '20px', padding: '2px 8px',
            fontSize: '10px', fontWeight: 700, color: badge.text, flexShrink: 0,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Specs grid */}
      {specItems.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {specItems.map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '1px', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#C8C4BE' }}>{item.value}</div>
            </div>
          ))}
          {block.designer_name && (
            <div>
              <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '1px', fontWeight: 600 }}>Designer</div>
              <div style={{ fontSize: '11px', color: '#C8C4BE' }}>{block.designer_name}</div>
            </div>
          )}
          {block.jeweler_name && (
            <div>
              <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '1px', fontWeight: 600 }}>Ourives</div>
              <div style={{ fontSize: '11px', color: '#C8C4BE' }}>{block.jeweler_name}</div>
            </div>
          )}
          {block.due_date && (
            <div>
              <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '1px', fontWeight: 600 }}>Prazo</div>
              <div style={{ fontSize: '11px', color: '#C8C4BE' }}>{fmtDate(block.due_date)}</div>
            </div>
          )}
          {block.total_cents > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '1px', fontWeight: 600 }}>Total</div>
              <div style={{ fontSize: '11px', color: '#3FB87A', fontWeight: 600 }}>{fmt(block.total_cents)}</div>
            </div>
          )}
          {block.deposit_cents > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '1px', fontWeight: 600 }}>Sinal</div>
              <div style={{ fontSize: '11px', color: '#C8C4BE' }}>{fmt(block.deposit_cents)}</div>
            </div>
          )}
        </div>
      )}

      {/* Tech notes */}
      {block.tech_notes && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '3px', fontWeight: 600 }}>Observações técnicas</div>
          <div style={{ fontSize: '12px', color: '#C8C4BE', lineHeight: 1.5 }}>{block.tech_notes}</div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px' }}>
        <button
          style={{ height: '28px', padding: '0 12px', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.20)', borderRadius: '5px', color: '#2DD4BF', fontSize: '11px', cursor: 'pointer' }}
        >
          Atualizar etapa
        </button>
        <button
          style={{ height: '28px', padding: '0 12px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '5px', color: '#C8C4BE', fontSize: '11px', cursor: 'pointer' }}
        >
          Foto progresso
        </button>
        <button
          style={{ height: '28px', padding: '0 12px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '5px', color: '#C8C4BE', fontSize: '11px', cursor: 'pointer' }}
        >
          Avisar cliente
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div style={{ background: '#202026', borderRadius: '10px', height: '160px', animation: 'pulse 1.4s ease-in-out infinite' }} />;
}

export default function ClientOSTab({ customerId, initialShowModal: _initialShowModal, onModalClose: _onModalClose }: Props) {
  const [blocks, setBlocks] = useState<AttendanceBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/customers/${customerId}/blocks?pipeline_status=OS,ENTREGA`);
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setBlocks(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      setError('Erro ao carregar ordens de serviço.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#F0EDE8', fontWeight: 600, margin: 0 }}>
            Ordens de Serviço
          </h2>
          {!loading && (
            <p style={{ fontSize: '12px', color: '#7A7774', margin: '2px 0 0' }}>
              {blocks.length} OS{blocks.length !== 1 ? '' : ''}
            </p>
          )}
        </div>
        {/* Sem botão "+ Nova OS" — OS são criadas pelo fluxo de Atendimento */}
      </div>

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}><Skeleton /><Skeleton /></div>}

      {!loading && error && (
        <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
          <button onClick={fetchBlocks} style={{ height: '30px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '12px', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && blocks.length === 0 && (
        <div style={{ border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚙️</div>
          <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nenhuma OS aprovada</p>
          <p style={{ color: '#7A7774', fontSize: '12px' }}>
            Para criar uma OS, avance um atendimento para o status <strong style={{ color: '#2DD4BF' }}>OS</strong> na aba Atendimento.
          </p>
        </div>
      )}

      {!loading && !error && blocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {blocks.map((b) => <OSBlockCard key={b.id} block={b} />)}
        </div>
      )}
    </>
  );
}
