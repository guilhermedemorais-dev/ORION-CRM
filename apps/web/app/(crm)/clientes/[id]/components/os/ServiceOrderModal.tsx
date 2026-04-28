'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseCurrencyToCents } from '@/lib/financeiro';
import { notify } from '@/lib/toast';

function formatCentsBRInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  customerId: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputStyle: React.CSSProperties = {
  height: '35px',
  background: '#1A1A1E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '7px',
  padding: '0 11px',
  fontSize: '12px',
  color: '#F0EDE8',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#E8E4DE',
  display: 'block',
  marginBottom: '4px',
};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      color: '#7A7774',
      marginBottom: '10px',
      paddingBottom: '6px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {children}
    </div>
  );
}

export default function ServiceOrderModal({ customerId, onClose, onSaved }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_name: '',
    priority: 'normal',
    designer_id: '',
    jeweler_id: '',
    due_date: '',
    deposit_cents_str: '',
    total_cents_str: '',
    metal: '',
    stone: '',
    ring_size: '',
    weight: '',
    notes: '',
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function handleCurrencyChange(field: 'deposit_cents_str' | 'total_cents_str') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const onlyNums = e.target.value.replace(/\D/g, '');
      const next = onlyNums ? formatCentsBRInput(Number(onlyNums)) : '';
      setForm((prev) => ({ ...prev, [field]: next }));
    };
  }

  function parseCents(str: string): number {
    return parseCurrencyToCents(str) ?? 0;
  }

  async function handleSave() {
    if (!form.product_name.trim()) {
      setError('Informe o nome do produto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/internal/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          product_name: form.product_name,
          priority: form.priority,
          designer_id: form.designer_id || undefined,
          jeweler_id: form.jeweler_id || undefined,
          due_date: form.due_date || undefined,
          deposit_cents: parseCents(form.deposit_cents_str),
          total_cents: parseCents(form.total_cents_str),
          specs: {
            metal: form.metal || undefined,
            stone: form.stone || undefined,
            ring_size: form.ring_size || undefined,
            weight: form.weight || undefined,
          },
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar OS');
      notify.success('Ordem de serviço criada', form.product_name);
      onSaved();
      router.refresh();
      onClose();
    } catch {
      setError('Erro ao criar OS. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        style={{
          background: '#141417',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '18px',
                color: '#F0EDE8',
                fontWeight: 600,
                margin: 0,
              }}
            >
              Nova Ordem de Serviço
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              background: 'transparent',
              border: 'none',
              color: '#7A7774',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '5px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {/* Produto */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Produto</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldGroup label="Nome do produto / peça *">
                  <input style={inputStyle} value={form.product_name} onChange={handleChange('product_name')} placeholder="Ex: Anel solitário ouro 18k" />
                </FieldGroup>
              </div>
              <FieldGroup label="Prioridade">
                <select aria-label="Prioridade" style={{ ...inputStyle, cursor: 'pointer' }} value={form.priority} onChange={handleChange('priority')}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Prazo">
                <input style={inputStyle} type="date" value={form.due_date} onChange={handleChange('due_date')} />
              </FieldGroup>
            </div>
          </div>

          {/* Specs */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Especificações</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FieldGroup label="Metal">
                <select aria-label="Metal" style={{ ...inputStyle, cursor: 'pointer' }} value={form.metal} onChange={handleChange('metal')}>
                  <option value="">Selecionar...</option>
                  <option value="Ouro 18k amarelo">Ouro 18k amarelo</option>
                  <option value="Ouro 18k branco">Ouro 18k branco</option>
                  <option value="Ouro 18k rosé">Ouro 18k rosé</option>
                  <option value="Prata 950">Prata 950</option>
                  <option value="Platina">Platina</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Pedra principal">
                <input style={inputStyle} value={form.stone} onChange={handleChange('stone')} placeholder="Ex: Diamante 0.30ct H/SI1" />
              </FieldGroup>
              <FieldGroup label="Tamanho do aro">
                <input style={inputStyle} value={form.ring_size} onChange={handleChange('ring_size')} placeholder="Ex: 16" />
              </FieldGroup>
              <FieldGroup label="Peso estimado (g)">
                <input style={inputStyle} value={form.weight} onChange={handleChange('weight')} placeholder="Ex: 4.5" />
              </FieldGroup>
            </div>
          </div>

          {/* Equipe */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Equipe</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FieldGroup label="Designer (ID)">
                <input style={inputStyle} value={form.designer_id} onChange={handleChange('designer_id')} placeholder="ID do designer" />
              </FieldGroup>
              <FieldGroup label="Ourives (ID)">
                <input style={inputStyle} value={form.jeweler_id} onChange={handleChange('jeweler_id')} placeholder="ID do ourives" />
              </FieldGroup>
            </div>
          </div>

          {/* Valores */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Valores</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FieldGroup label="Sinal / Entrada (R$)">
                <input style={inputStyle} inputMode="numeric" value={form.deposit_cents_str} onChange={handleCurrencyChange('deposit_cents_str')} placeholder="0,00" />
              </FieldGroup>
              <FieldGroup label="Total (R$)">
                <input style={inputStyle} inputMode="numeric" value={form.total_cents_str} onChange={handleCurrencyChange('total_cents_str')} placeholder="0,00" />
              </FieldGroup>
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: '12px' }}>
            <SectionTitle>Observações</SectionTitle>
            <textarea
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Observações para produção, preferências do cliente..."
              style={{
                minHeight: '68px',
                background: '#1A1A1E',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '7px',
                padding: '8px 11px',
                fontSize: '12px',
                color: '#F0EDE8',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: "'DM Sans', sans-serif",
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', padding: '10px 12px', color: '#E05252', fontSize: '12px', marginBottom: '12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '14px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
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
            onClick={handleSave}
            disabled={saving || !form.product_name.trim()}
            style={{
              height: '34px',
              padding: '0 20px',
              background: 'rgba(91,156,246,0.15)',
              border: '1px solid rgba(91,156,246,0.30)',
              borderRadius: '7px',
              color: '#5B9CF6',
              fontSize: '12px',
              fontWeight: 600,
              cursor: saving || !form.product_name.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !form.product_name.trim() ? 0.7 : 1,
            }}
          >
            {saving ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </div>
    </div>
  );
}
