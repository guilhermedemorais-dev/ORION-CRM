'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AttendanceBlock } from '../types';
import AttendanceBlockCard from '../attendance/AttendanceBlock';
import AttendancePopup from '../attendance/AttendancePopup';

interface Props {
  customerId: string;
  onOSCreated?: () => void;
}

function Skeleton() {
  return (
    <div
      style={{
        background: '#202026',
        borderRadius: '10px',
        height: '120px',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

export default function ClientAtendimentoTab({ customerId, onOSCreated }: Props) {
  const [blocks, setBlocks] = useState<AttendanceBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AttendanceBlock | null>(null);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/customers/${customerId}/blocks?pipeline_status=ATENDIMENTO,PROPOSTA`);
      if (!res.ok) throw new Error('Erro ao carregar atendimentos');
      const data = await res.json();
      setBlocks(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      setError('Erro ao carregar atendimentos.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  function handleEdit(block: AttendanceBlock) {
    setEditingBlock(block);
    setShowPopup(true);
  }

  function handleNewBlock() {
    setEditingBlock(null);
    setShowPopup(true);
  }

  function handlePopupClose() {
    setShowPopup(false);
    setEditingBlock(null);
  }

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '16px',
              color: '#F0EDE8',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Atendimentos
          </h2>
          {!loading && (
            <p style={{ fontSize: '12px', color: '#7A7774', margin: '2px 0 0' }}>
              {blocks.length} registro{blocks.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={handleNewBlock}
          style={{
            height: '32px',
            padding: '0 14px',
            background: 'rgba(200,169,122,0.12)',
            border: '1px solid rgba(200,169,122,0.25)',
            borderRadius: '7px',
            color: '#C8A97A',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          + Ordem de Serviço
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          style={{
            background: 'rgba(224,82,82,0.10)',
            border: '1px solid rgba(224,82,82,0.25)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
          <button
            onClick={fetchBlocks}
            style={{
              height: '30px',
              padding: '0 14px',
              background: 'transparent',
              border: '1px solid rgba(224,82,82,0.25)',
              borderRadius: '6px',
              color: '#E05252',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && blocks.length === 0 && (
        <div
          style={{
            border: '2px dashed rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
          <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            Nenhum atendimento registrado
          </p>
          <p style={{ color: '#7A7774', fontSize: '12px', marginBottom: '16px' }}>
            Crie o primeiro bloco de atendimento para este cliente.
          </p>
          <button
            onClick={handleNewBlock}
            style={{
              height: '32px',
              padding: '0 16px',
              background: 'rgba(200,169,122,0.12)',
              border: '1px solid rgba(200,169,122,0.25)',
              borderRadius: '7px',
              color: '#C8A97A',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Ordem de Serviço
          </button>
        </div>
      )}

      {/* Blocks list */}
      {!loading && !error && blocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {blocks.map((block) => (
            <AttendanceBlockCard
              key={block.id}
              block={block}
              onEdit={handleEdit}
            />
          ))}
          {/* Dashed new block button */}
          <button
            onClick={handleNewBlock}
            style={{
              width: '100%',
              padding: '16px',
              background: 'transparent',
              border: '2px dashed rgba(255,255,255,0.08)',
              borderRadius: '10px',
              color: '#7A7774',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            + Ordem de Serviço de Atendimento
          </button>
        </div>
      )}

      {showPopup && (
        <AttendancePopup
          customerId={customerId}
          block={editingBlock}
          onClose={handlePopupClose}
          onSaved={fetchBlocks}
          onOSCreated={onOSCreated}
        />
      )}
    </>
  );
}
