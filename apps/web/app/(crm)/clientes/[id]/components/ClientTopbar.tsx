'use client';

import { useState } from 'react';
import type { CustomerFull } from './types';

interface Props {
  customer: CustomerFull;
  leadId: string | null;
  onWon: () => void;
  onLost: () => void;
}

export default function ClientTopbar({ customer, leadId, onWon, onLost }: Props) {
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleWon() {
    if (!leadId) return;
    setLoading(true);
    try {
      await fetch(`/api/internal/leads/${leadId}/won`, { method: 'POST' });
      onWon();
    } finally {
      setLoading(false);
    }
  }

  async function handleLostSubmit() {
    if (!leadId) return;
    setLoading(true);
    try {
      await fetch(`/api/internal/leads/${leadId}/lost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: lostReason || undefined }),
      });
      setShowLostModal(false);
      onLost();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        style={{
          height: '48px',
          background: '#0F0F11',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <a
            href="/leads"
            style={{ fontSize: '11px', color: '#7A7774', textDecoration: 'none' }}
          >
            ← Pipeline Leads
          </a>
          <span style={{ fontSize: '11px', color: '#7A7774' }}>/</span>
          <a
            href="/clientes"
            style={{ fontSize: '11px', color: '#7A7774', textDecoration: 'none' }}
          >
            Clientes
          </a>
          <span style={{ fontSize: '11px', color: '#7A7774' }}>/</span>
          <span style={{ fontSize: '11px', color: '#C8C4BE' }}>{customer.name}</span>
        </nav>

        {/* Actions */}
        {leadId && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleWon}
              disabled={loading}
              style={{
                height: '30px',
                padding: '0 12px',
                background: 'rgba(63,184,122,0.10)',
                border: '1px solid rgba(63,184,122,0.25)',
                borderRadius: '6px',
                color: '#3FB87A',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              ✓ Ganhou
            </button>
            <button
              onClick={() => setShowLostModal(true)}
              disabled={loading}
              style={{
                height: '30px',
                padding: '0 12px',
                background: 'rgba(224,82,82,0.10)',
                border: '1px solid rgba(224,82,82,0.25)',
                borderRadius: '6px',
                color: '#E05252',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              ✕ Perdeu
            </button>
          </div>
        )}
      </div>

      {/* Lost Reason Modal */}
      {showLostModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowLostModal(false)}
        >
          <div
            style={{
              background: '#141417',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
            }}
          >
            <h3
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '18px',
                color: '#F0EDE8',
                marginBottom: '8px',
              }}
            >
              Marcar como Perdido
            </h3>
            <p style={{ fontSize: '13px', color: '#7A7774', marginBottom: '16px' }}>
              Opcional: informe o motivo da perda.
            </p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Ex: Cliente optou por outro fornecedor..."
              style={{
                width: '100%',
                minHeight: '80px',
                background: '#1A1A1E',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '7px',
                padding: '8px 11px',
                color: '#F0EDE8',
                fontSize: '12px',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowLostModal(false)}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '7px',
                  color: '#C8C4BE',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLostSubmit}
                disabled={loading}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  background: 'rgba(224,82,82,0.15)',
                  border: '1px solid rgba(224,82,82,0.30)',
                  borderRadius: '7px',
                  color: '#E05252',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
