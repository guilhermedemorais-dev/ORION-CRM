'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseCurrencyToCents } from '@/lib/financeiro';
import { notify } from '@/lib/toast';

interface ProductOption {
    id: string;
    code: string;
    name: string;
    price_cents: number;
    cost_price_cents: number;
    stock_quantity: number;
    is_raw_material: boolean;
    metal: string | null;
    category: string | null;
}

interface DraftMaterial {
    tempId: string;
    productId: string;
    productCode: string;
    productName: string;
    isRawMaterial: boolean;
    quantity: string;
    unitPriceCents: number;
    unitCostCents: number;
    stockAtAdd: number;
}

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

  // Materiais a serem adicionados na OS após criação
  const [materials, setMaterials] = useState<DraftMaterial[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState<'all' | 'raw' | 'finished'>('all');
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [laborCentsStr, setLaborCentsStr] = useState('');

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);

  // Busca produtos com debounce para autocomplete de materiais
  useEffect(() => {
    if (!materialSearch.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: materialSearch.trim(), limit: '12', active_only: 'true' });
        if (materialFilter === 'raw') params.set('is_raw_material', 'true');
        if (materialFilter === 'finished') params.set('is_raw_material', 'false');
        const res = await fetch(`/api/internal/products?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data?.data) ? data.data : []);
          setShowSearchResults(true);
        }
      } catch {
        // silently fail
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [materialSearch, materialFilter]);

  const addMaterial = useCallback((product: ProductOption) => {
    setMaterials((prev) => {
      if (prev.some((m) => m.productId === product.id)) {
        return prev;
      }
      return [
        ...prev,
        {
          tempId: `${product.id}-${Date.now()}`,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          isRawMaterial: product.is_raw_material,
          quantity: '1',
          unitPriceCents: product.price_cents,
          unitCostCents: product.cost_price_cents ?? 0,
          stockAtAdd: product.stock_quantity,
        },
      ];
    });
    setMaterialSearch('');
    setSearchResults([]);
    setShowSearchResults(false);
  }, []);

  const removeMaterial = useCallback((tempId: string) => {
    setMaterials((prev) => prev.filter((m) => m.tempId !== tempId));
  }, []);

  const updateMaterialQuantity = useCallback((tempId: string, value: string) => {
    setMaterials((prev) => prev.map((m) => m.tempId === tempId ? { ...m, quantity: value } : m));
  }, []);

  // Cálculo: subtotal materiais + mão de obra = total preview
  const materialsSubtotalCents = materials.reduce((sum, m) => {
    const qty = parseFloat(m.quantity.replace(',', '.')) || 0;
    return sum + Math.round(qty * m.unitPriceCents);
  }, 0);
  const laborCents = parseCents(laborCentsStr);
  const previewTotalCents = materialsSubtotalCents + laborCents;

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
      // 1) Cria a OS primeiro (sem materiais ainda).
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
      const created = await res.json().catch(() => null);
      const osId = created?.id ?? created?.data?.id ?? null;

      // 2) Se temos OS criada e materiais selecionados, anexa cada um.
      // Falhas individuais não derrubam a OS toda — usuário pode reanexar depois.
      if (osId && materials.length > 0) {
        for (const m of materials) {
          const qty = parseFloat(m.quantity.replace(',', '.'));
          if (!qty || qty <= 0) continue;
          try {
            await fetch(`/api/internal/service-orders/${osId}/materials`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_id: m.productId, quantity: qty }),
            });
          } catch {
            // continua tentando os outros
          }
        }
      }

      // 3) Se mão de obra foi informada, registra agora (recálculo total).
      if (osId && laborCents > 0) {
        try {
          await fetch(`/api/internal/service-orders/${osId}/labor`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labor_cents: laborCents }),
          });
        } catch {
          // ignora — pode editar depois
        }
      }

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

          {/* Materiais consumidos */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Materiais</SectionTitle>
            <p style={{ fontSize: '11px', color: '#7A7774', marginTop: '-4px', marginBottom: '10px' }}>
              Adicione matérias-primas ou peças prontas do estoque que serão consumidas na produção.
              O subtotal soma o preço de venda de cada item.
            </p>

            {/* Filtros + busca */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {([
                { key: 'all', label: 'Tudo' },
                { key: 'raw', label: 'Matéria-prima' },
                { key: 'finished', label: 'Peças prontas' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMaterialFilter(opt.key)}
                  style={{
                    height: '26px',
                    padding: '0 10px',
                    background: materialFilter === opt.key ? 'rgba(200,169,122,0.15)' : 'transparent',
                    border: `1px solid ${materialFilter === opt.key ? 'rgba(200,169,122,0.35)' : 'rgba(255,255,255,0.10)'}`,
                    borderRadius: '6px',
                    color: materialFilter === opt.key ? '#C8A97A' : '#A8A4A0',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                style={inputStyle}
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="Buscar produto por nome ou código..."
                onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
              />
              {showSearchResults && (
                <div
                  style={{
                    position: 'absolute',
                    top: '38px',
                    left: 0,
                    right: 0,
                    background: '#1A1A1E',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '7px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 10,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
                  }}
                >
                  {searching && (
                    <div style={{ padding: '10px 12px', fontSize: '11px', color: '#7A7774' }}>Buscando...</div>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: '11px', color: '#7A7774' }}>Nenhum produto encontrado.</div>
                  )}
                  {!searching && searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addMaterial(product)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: '#E8E4DE',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{product.name}</span>
                          {product.is_raw_material && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#C8A97A', background: 'rgba(200,169,122,0.14)', padding: '1px 5px', borderRadius: '4px' }}>MP</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#7A7774' }}>
                          {product.code} · Estoque: {product.stock_quantity} · R$ {(product.price_cents / 100).toFixed(2)}
                        </div>
                      </div>
                      <span style={{ color: '#C8A97A', fontSize: '14px' }}>+</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de materiais adicionados */}
            {materials.length === 0 ? (
              <div style={{ border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '7px', padding: '14px', textAlign: 'center', color: '#7A7774', fontSize: '11px' }}>
                Nenhum material adicionado ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {materials.map((m) => {
                  const qty = parseFloat(m.quantity.replace(',', '.')) || 0;
                  const lineCents = Math.round(qty * m.unitPriceCents);
                  const insufficient = qty > m.stockAtAdd;
                  return (
                    <div
                      key={m.tempId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 90px 28px',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: '#1A1A1E',
                        border: `1px solid ${insufficient ? 'rgba(224,82,82,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '7px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#E8E4DE', fontWeight: 600 }}>{m.productName}</span>
                          {m.isRawMaterial && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#C8A97A', background: 'rgba(200,169,122,0.14)', padding: '1px 5px', borderRadius: '4px' }}>MP</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: insufficient ? '#E05252' : '#7A7774' }}>
                          {m.productCode} · Estoque: {m.stockAtAdd}{insufficient ? ` (insuficiente para ${qty})` : ''}
                        </div>
                      </div>
                      <input
                        style={{ ...inputStyle, height: '30px', fontSize: '11px', textAlign: 'right' }}
                        value={m.quantity}
                        onChange={(e) => updateMaterialQuantity(m.tempId, e.target.value)}
                        placeholder="Qtd"
                        aria-label={`Quantidade de ${m.productName}`}
                      />
                      <div style={{ fontSize: '11px', color: '#C8A97A', fontWeight: 600, textAlign: 'right' }}>
                        R$ {(lineCents / 100).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMaterial(m.tempId)}
                        aria-label={`Remover ${m.productName}`}
                        style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '5px', color: '#E05252', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Resumo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', marginTop: '4px', background: 'rgba(200,169,122,0.06)', border: '1px solid rgba(200,169,122,0.15)', borderRadius: '7px' }}>
                  <span style={{ fontSize: '11px', color: '#A8A4A0', fontWeight: 600 }}>Subtotal materiais</span>
                  <span style={{ fontSize: '12px', color: '#C8A97A', fontWeight: 700 }}>R$ {(materialsSubtotalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Valores */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Valores</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FieldGroup label="Sinal / Entrada (R$)">
                <input style={inputStyle} inputMode="numeric" value={form.deposit_cents_str} onChange={handleCurrencyChange('deposit_cents_str')} placeholder="0,00" />
              </FieldGroup>
              <FieldGroup label="Mão de obra (R$)">
                <input
                  style={inputStyle}
                  inputMode="numeric"
                  value={laborCentsStr}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setLaborCentsStr(onlyNums ? formatCentsBRInput(Number(onlyNums)) : '');
                  }}
                  placeholder="0,00"
                />
              </FieldGroup>
              <FieldGroup label="Total da OS (R$)">
                <input style={inputStyle} inputMode="numeric" value={form.total_cents_str} onChange={handleCurrencyChange('total_cents_str')} placeholder="0,00" />
              </FieldGroup>
              <div>
                <label style={labelStyle}>Total calculado (preview)</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#C8A97A', fontWeight: 700, background: 'rgba(200,169,122,0.06)' }}>
                  R$ {(previewTotalCents / 100).toFixed(2)}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '10px', color: '#7A7774', marginTop: '6px' }}>
              O preview mostra subtotal de materiais + mão de obra. O campo "Total" é o valor cobrado do cliente (pode incluir markup adicional).
            </p>
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
