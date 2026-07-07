'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';

// TASK-002: modal de OS tecnica multi-pecas (projeto -> pecas -> proposta).
// Contrato: docs/specs/production/os-multi-piece-proposal/{page-spec,validation-rules,api}.md
// Regras-chave: preco por peca somente leitura (RN-08); custo/margem nunca aparecem (RN-06);
// material obrigatorio para peca entrar na proposta (RN-04); custodia do cliente separada
// do estoque proprio (RN-07). Persistencia real depende do backend da TASK-005.

interface ProductOption {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  is_raw_material: boolean;
  category: string | null;
}

interface TeamUser {
  id: string;
  name: string;
  status?: string;
}

type MaterialOrigin = 'own_stock' | 'customer_custody';

interface DraftMaterial {
  tempId: string;
  origin: MaterialOrigin;
  productId?: string;
  productCode?: string;
  label: string;
  quantity: string;
  unit: string;
  unitPriceCents: number; // preco unitario (leitura). Custo NAO trafega aqui.
}

interface DraftPiece {
  tempId: string;
  category: string; // unico dropdown tecnico da peca (RN-02)
  title: string;
  tech: {
    metal: string;
    acabamento: string;
    corBanho: string;
    cravacao: string;
    gravacao: string;
  };
  materials: DraftMaterial[];
  collapsed: boolean;
}

interface Props {
  customerId: string;
  attendanceBlockId?: string;
  embedded?: boolean;
  submitBlocked?: boolean;
  onBeforeCreate?: () => Promise<string>;
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

const CATEGORY_OPTIONS = ['Anel', 'Aliança', 'Colar', 'Pingente', 'Brinco', 'Pulseira', 'Outro'];

function brl(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function centsFromInput(str: string): number {
  const onlyNums = str.replace(/\D/g, '');
  return onlyNums ? Number(onlyNums) : 0;
}

function qtyOf(str: string): number {
  return parseFloat(str.replace(',', '.')) || 0;
}

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

function newPiece(): DraftPiece {
  return {
    tempId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: '',
    title: '',
    tech: { metal: '', acabamento: '', corBanho: '', cravacao: '', gravacao: '' },
    materials: [],
    collapsed: false,
  };
}

export default function ServiceOrderModal({
  customerId,
  attendanceBlockId,
  embedded = false,
  submitBlocked = false,
  onBeforeCreate,
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'notes' | 'cotacao'>('cotacao');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cabecalho do projeto
  const [project, setProject] = useState({ title: '', dueDate: '', responsibleId: '' });
  const [notes, setNotes] = useState('');
  const [customerCreditStr, setCustomerCreditStr] = useState('');

  const [pieces, setPieces] = useState<DraftPiece[]>([newPiece()]);
  const [responsibles, setResponsibles] = useState<TeamUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  // Busca de material do estoque, direcionada a uma peca especifica.
  const [materialTarget, setMaterialTarget] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState<'all' | 'raw' | 'finished'>('raw');
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (embedded) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [embedded, onClose, saving]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/internal/users?role=PRODUCAO');
        if (!res.ok) throw new Error('team');
        const data = await res.json();
        const users: TeamUser[] = Array.isArray(data) ? data : (data.data ?? []);
        if (active) setResponsibles(users.filter((u) => u.status !== 'inactive'));
      } catch {
        /* equipe opcional; ignora falha silenciosa de carga */
      } finally {
        if (active) setTeamLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Busca de produtos (estoque proprio) com debounce.
  useEffect(() => {
    if (!materialTarget || !materialSearch.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: materialSearch.trim(), limit: '12', active_only: 'true' });
        if (materialFilter === 'raw') params.set('is_raw_material', 'true');
        if (materialFilter === 'finished') params.set('is_raw_material', 'false');
        const res = await fetch(`/api/internal/products?${params.toString()}`);
        if (!res.ok) throw new Error('search');
        const data = await res.json();
        setSearchResults(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setSearchResults([]);
        setSearchError('Não foi possível buscar materiais. Tente novamente.');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [materialTarget, materialSearch, materialFilter]);

  // ---- Mutacoes de peca ----
  const addPiece = useCallback(() => setPieces((prev) => [...prev, newPiece()]), []);
  const removePiece = useCallback((id: string) => {
    setPieces((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.tempId !== id)));
  }, []);
  const duplicatePiece = useCallback((id: string) => {
    setPieces((prev) => {
      const src = prev.find((p) => p.tempId === id);
      if (!src) return prev;
      const copy: DraftPiece = {
        ...src,
        tempId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: src.title ? `${src.title} (cópia)` : '',
        materials: src.materials.map((m) => ({ ...m, tempId: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })),
        collapsed: false,
      };
      return [...prev, copy];
    });
  }, []);
  const patchPiece = useCallback((id: string, patch: Partial<DraftPiece>) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, ...patch } : p)));
  }, []);
  const patchPieceTech = useCallback((id: string, key: keyof DraftPiece['tech'], value: string) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, tech: { ...p.tech, [key]: value } } : p)));
  }, []);

  // ---- Mutacoes de material ----
  const addOwnStockMaterial = useCallback((pieceId: string, product: ProductOption) => {
    setPieces((prev) => prev.map((p) => {
      if (p.tempId !== pieceId) return p;
      if (p.materials.some((m) => m.origin === 'own_stock' && m.productId === product.id)) return p;
      return {
        ...p,
        materials: [...p.materials, {
          tempId: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          origin: 'own_stock',
          productId: product.id,
          productCode: product.code,
          label: product.name,
          quantity: '1',
          unit: product.is_raw_material ? 'g' : 'un',
          unitPriceCents: product.price_cents,
        }],
      };
    }));
    setMaterialTarget(null);
    setMaterialSearch('');
    setSearchResults([]);
  }, []);

  const addCustodyMaterial = useCallback((pieceId: string) => {
    // Custodia do cliente: subsistema (customer_material_custody) ainda nao existe (ver database.md).
    // Nesta fase entra como material rotulado (sem vinculo forte) e sem preco (credito depende do backend).
    setPieces((prev) => prev.map((p) => {
      if (p.tempId !== pieceId) return p;
      return {
        ...p,
        materials: [...p.materials, {
          tempId: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          origin: 'customer_custody',
          label: '',
          quantity: '1',
          unit: 'g',
          unitPriceCents: 0,
        }],
      };
    }));
  }, []);

  const patchMaterial = useCallback((pieceId: string, matId: string, patch: Partial<DraftMaterial>) => {
    setPieces((prev) => prev.map((p) => (p.tempId !== pieceId ? p : {
      ...p,
      materials: p.materials.map((m) => (m.tempId === matId ? { ...m, ...patch } : m)),
    })));
  }, []);

  const removeMaterial = useCallback((pieceId: string, matId: string) => {
    setPieces((prev) => prev.map((p) => (p.tempId !== pieceId ? p : {
      ...p,
      materials: p.materials.filter((m) => m.tempId !== matId),
    })));
  }, []);

  // ---- Calculos (preco leitura; sem custo) ----
  const pieceHasMaterial = (p: DraftPiece) =>
    p.materials.some((m) => qtyOf(m.quantity) > 0 && (m.origin === 'own_stock' ? !!m.productId : m.label.trim().length > 0));

  const piecePriceCents = (p: DraftPiece) =>
    p.materials.reduce((sum, m) => sum + Math.round(qtyOf(m.quantity) * m.unitPriceCents), 0);

  const subtotalCents = useMemo(() => pieces.reduce((sum, p) => sum + piecePriceCents(p), 0), [pieces]);
  const customerCreditCents = centsFromInput(customerCreditStr);
  const totalCents = Math.max(0, subtotalCents - customerCreditCents);

  const validPieces = pieces.filter(pieceHasMaterial);
  const piecesMissingMaterial = pieces.filter((p) => !pieceHasMaterial(p));
  const canGenerate = validPieces.length > 0 && piecesMissingMaterial.length === 0 && !submitBlocked;

  async function handleGenerateProposal() {
    if (!canGenerate) {
      setError('Cada peça precisa de ao menos um material antes de gerar a proposta.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resolvedAttendanceBlockId = onBeforeCreate ? await onBeforeCreate() : attendanceBlockId;

      // Contrato api.md: cria proposta (draft) -> pecas -> materiais -> register.
      const res = await fetch('/api/internal/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          attendance_block_id: resolvedAttendanceBlockId,
          title: project.title || undefined,
          due_date: project.dueDate || undefined,
          responsible_user_id: project.responsibleId || undefined,
          customer_credit_cents: customerCreditCents,
          pieces: pieces.map((p) => ({
            category: p.category || undefined,
            title: p.title || undefined,
            tech_specs: p.tech,
            materials: p.materials
              .filter((m) => qtyOf(m.quantity) > 0)
              .map((m) => ({
                origin: m.origin,
                product_id: m.origin === 'own_stock' ? m.productId : undefined,
                material_label: m.origin === 'customer_custody' ? m.label : undefined,
                quantity: qtyOf(m.quantity),
                unit: m.unit,
              })),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Backend da proposta indisponível (HTTP ${res.status}). Persistência depende da TASK-005.`);
      }
      notify.success('Proposta registrada', project.title || 'Projeto multi-peças');
      onSaved();
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar proposta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: embedded ? 'static' : 'fixed',
        inset: embedded ? undefined : 0,
        background: embedded ? 'transparent' : 'rgba(0,0,0,0.75)',
        display: embedded ? 'block' : 'flex',
        alignItems: embedded ? undefined : 'center',
        justifyContent: embedded ? undefined : 'center',
        zIndex: embedded ? undefined : 1000,
        padding: embedded ? 0 : '20px',
      }}
      onClick={(e) => { if (!embedded && e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        style={{
          background: embedded ? 'rgba(45,212,191,0.025)' : '#141417',
          border: embedded ? '1px solid rgba(45,212,191,0.18)' : '1px solid rgba(255,255,255,0.10)',
          borderTop: embedded ? 'none' : undefined,
          borderRadius: embedded ? '0 0 8px 8px' : '12px',
          width: '100%',
          maxWidth: embedded ? 'none' : '720px',
          maxHeight: embedded ? 'none' : '90vh',
          overflowY: embedded ? 'visible' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#F0EDE8', fontWeight: 600, margin: 0 }}>
              OS técnica · Projeto multi-peças
            </h2>
            <button onClick={onClose} aria-label="Fechar" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: '#7A7774', fontSize: '16px', cursor: 'pointer', borderRadius: '5px' }}>✕</button>
          </div>
        )}

        {/* Abas */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {([{ key: 'notes', label: 'Anotações e fotos' }, { key: 'cotacao', label: 'Cotação' }] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                height: '32px', padding: '0 14px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${tab === t.key ? '#C8A97A' : 'transparent'}`,
                color: tab === t.key ? '#F0EDE8' : '#7A7774', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: embedded ? '16px' : '20px 24px', flex: 1 }}>
          {/* Cabecalho do projeto */}
          <div style={{ marginBottom: '22px' }}>
            <SectionTitle>Projeto</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <FieldGroup label="Nome do projeto">
                <input style={inputStyle} value={project.title} onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Par de alianças + anel" />
              </FieldGroup>
              <FieldGroup label="Prazo">
                <input style={inputStyle} type="date" value={project.dueDate} onChange={(e) => setProject((p) => ({ ...p, dueDate: e.target.value }))} />
              </FieldGroup>
              <FieldGroup label="Responsável">
                <select aria-label="Responsável" style={{ ...inputStyle, cursor: 'pointer' }} value={project.responsibleId} onChange={(e) => setProject((p) => ({ ...p, responsibleId: e.target.value }))} disabled={teamLoading}>
                  <option value="">{teamLoading ? 'Carregando...' : 'Não atribuído'}</option>
                  {responsibles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </FieldGroup>
            </div>
          </div>

          {tab === 'notes' ? (
            <div style={{ marginBottom: '12px' }}>
              <SectionTitle>Anotações do atendimento</SectionTitle>
              <p style={{ fontSize: '11px', color: '#7A7774', marginTop: '-4px', marginBottom: '10px' }}>
                Anotações e fotos pertencem ao atendimento, não à proposta. Salvar aqui não gera proposta.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preferências do cliente, referências, observações do atendimento..."
                style={{ minHeight: '120px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', padding: '8px 11px', fontSize: '12px', color: '#F0EDE8', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => notify.success('Anotações salvas', 'Rascunho do atendimento')} style={{ height: '32px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}>Salvar anotações</button>
                <button type="button" onClick={() => setTab('cotacao')} style={{ height: '32px', padding: '0 14px', background: 'rgba(200,169,122,0.14)', border: '1px solid rgba(200,169,122,0.30)', borderRadius: '7px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Ir para cotação →</button>
              </div>
            </div>
          ) : (
            <>
              {/* Lista de pecas */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <SectionTitle>Peças do projeto ({pieces.length})</SectionTitle>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pieces.map((p, idx) => {
                    const ready = pieceHasMaterial(p);
                    return (
                      <div key={p.tempId} style={{ border: `1px solid ${ready ? 'rgba(45,212,191,0.22)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '9px', background: '#17171B', overflow: 'hidden' }}>
                        {/* Cabecalho do card */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)' }}>
                          <button type="button" onClick={() => patchPiece(p.tempId, { collapsed: !p.collapsed })} aria-label="Recolher peça" style={{ background: 'transparent', border: 'none', color: '#7A7774', cursor: 'pointer', fontSize: '12px' }}>{p.collapsed ? '▸' : '▾'}</button>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#F0EDE8' }}>
                            Peça {idx + 1}{p.title ? ` · ${p.title}` : ''}
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', color: ready ? '#2DD4BF' : '#E0A052', background: ready ? 'rgba(45,212,191,0.12)' : 'rgba(224,160,82,0.12)' }}>
                            {ready ? 'Pronta para proposta' : 'Falta material'}
                          </span>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#C8A97A' }}>{brl(piecePriceCents(p))}</span>
                            <button type="button" onClick={() => duplicatePiece(p.tempId)} aria-label="Duplicar peça" style={{ background: 'transparent', border: 'none', color: '#7A7774', cursor: 'pointer', fontSize: '12px' }}>⧉</button>
                            <button type="button" onClick={() => removePiece(p.tempId)} disabled={pieces.length <= 1} aria-label="Remover peça" style={{ background: 'transparent', border: 'none', color: pieces.length <= 1 ? '#3A3A3E' : '#E05252', cursor: pieces.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>×</button>
                          </div>
                        </div>

                        {!p.collapsed && (
                          <div style={{ padding: '12px' }}>
                            {/* Ficha tecnica */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                              <FieldGroup label="Categoria">
                                <select aria-label={`Categoria da peça ${idx + 1}`} style={{ ...inputStyle, cursor: 'pointer' }} value={p.category} onChange={(e) => patchPiece(p.tempId, { category: e.target.value })}>
                                  <option value="">Selecionar...</option>
                                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </FieldGroup>
                              <div style={{ gridColumn: '2 / -1' }}>
                                <FieldGroup label="Título da peça">
                                  <input style={inputStyle} value={p.title} onChange={(e) => patchPiece(p.tempId, { title: e.target.value })} placeholder="Ex: Aliança dele" />
                                </FieldGroup>
                              </div>
                              <FieldGroup label="Metal"><input style={inputStyle} value={p.tech.metal} onChange={(e) => patchPieceTech(p.tempId, 'metal', e.target.value)} placeholder="Ouro 18k…" /></FieldGroup>
                              <FieldGroup label="Acabamento"><input style={inputStyle} value={p.tech.acabamento} onChange={(e) => patchPieceTech(p.tempId, 'acabamento', e.target.value)} placeholder="Polido…" /></FieldGroup>
                              <FieldGroup label="Cor / banho"><input style={inputStyle} value={p.tech.corBanho} onChange={(e) => patchPieceTech(p.tempId, 'corBanho', e.target.value)} placeholder="Ródio…" /></FieldGroup>
                              <FieldGroup label="Cravação"><input style={inputStyle} value={p.tech.cravacao} onChange={(e) => patchPieceTech(p.tempId, 'cravacao', e.target.value)} placeholder="Pavê…" /></FieldGroup>
                              <FieldGroup label="Gravação"><input style={inputStyle} value={p.tech.gravacao} onChange={(e) => patchPieceTech(p.tempId, 'gravacao', e.target.value)} placeholder="Data / nome…" /></FieldGroup>
                            </div>

                            {/* Bloco de materiais */}
                            <div style={{ marginBottom: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7774' }}>Materiais da peça</div>
                            {p.materials.length === 0 && (
                              <div style={{ border: '1px dashed rgba(224,160,82,0.30)', borderRadius: '7px', padding: '10px', textAlign: 'center', color: '#E0A052', fontSize: '11px', marginBottom: '8px' }}>
                                Peça sem material — obrigatório para entrar na proposta.
                              </div>
                            )}
                            {p.materials.map((m) => {
                              const lineCents = Math.round(qtyOf(m.quantity) * m.unitPriceCents);
                              const custody = m.origin === 'customer_custody';
                              return (
                                <div key={m.tempId} style={{ display: 'grid', gridTemplateColumns: '1fr 78px 60px 84px 26px', gap: '6px', alignItems: 'center', padding: '6px 8px', marginBottom: '6px', background: '#1A1A1E', border: `1px solid ${custody ? 'rgba(91,156,246,0.22)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '7px' }}>
                                  <div style={{ minWidth: 0 }}>
                                    <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.05em', padding: '1px 5px', borderRadius: '4px', color: custody ? '#5B9CF6' : '#C8A97A', background: custody ? 'rgba(91,156,246,0.12)' : 'rgba(200,169,122,0.12)' }}>
                                      {custody ? 'CUSTÓDIA · CLIENTE' : 'ESTOQUE · LOJA'}
                                    </span>
                                    {custody ? (
                                      <input style={{ ...inputStyle, height: '26px', fontSize: '11px', marginTop: '3px' }} value={m.label} onChange={(e) => patchMaterial(p.tempId, m.tempId, { label: e.target.value })} placeholder="Descrição do material do cliente" />
                                    ) : (
                                      <div style={{ fontSize: '11px', color: '#E8E4DE', fontWeight: 600, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</div>
                                    )}
                                  </div>
                                  <input style={{ ...inputStyle, height: '28px', fontSize: '11px', textAlign: 'right' }} value={m.quantity} onChange={(e) => patchMaterial(p.tempId, m.tempId, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} aria-label="Quantidade" />
                                  <div style={{ fontSize: '10px', color: '#7A7774', textAlign: 'center' }}>{m.unit}</div>
                                  <div style={{ fontSize: '11px', color: custody ? '#7A7774' : '#C8A97A', fontWeight: 600, textAlign: 'right' }}>{custody ? '—' : brl(lineCents)}</div>
                                  <button type="button" onClick={() => removeMaterial(p.tempId, m.tempId)} aria-label="Remover material" style={{ width: '24px', height: '24px', background: 'transparent', border: '1px solid rgba(224,82,82,0.22)', borderRadius: '5px', color: '#E05252', cursor: 'pointer', fontSize: '12px' }}>×</button>
                                </div>
                              );
                            })}

                            {/* Busca de material do estoque, para esta peca */}
                            {materialTarget === p.tempId && (
                              <div style={{ position: 'relative', marginBottom: '6px' }}>
                                <input autoFocus style={{ ...inputStyle, height: '30px' }} value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="Buscar no estoque por nome ou código..." />
                                {searchError && <div style={{ marginTop: '4px', color: '#E05252', fontSize: '10px' }}>{searchError}</div>}
                                {materialSearch.trim() && (
                                  <div style={{ position: 'absolute', top: '34px', left: 0, right: 0, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.45)' }}>
                                    {searching && <div style={{ padding: '8px 12px', fontSize: '11px', color: '#7A7774' }}>Buscando...</div>}
                                    {!searching && searchResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: '11px', color: '#7A7774' }}>Nenhum produto encontrado.</div>}
                                    {!searching && searchResults.map((product) => (
                                      <button key={product.id} type="button" onClick={() => addOwnStockMaterial(p.tempId, product)} style={{ width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#E8E4DE', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</span>
                                        <span style={{ color: '#C8A97A', flexShrink: 0 }}>{brl(product.price_cents)}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                              <button type="button" onClick={() => { setMaterialTarget(p.tempId); setMaterialSearch(''); setMaterialFilter('raw'); }} style={{ height: '28px', padding: '0 10px', background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.28)', borderRadius: '6px', color: '#C8A97A', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>+ Material do estoque</button>
                              <button type="button" onClick={() => addCustodyMaterial(p.tempId)} style={{ height: '28px', padding: '0 10px', background: 'rgba(91,156,246,0.10)', border: '1px solid rgba(91,156,246,0.28)', borderRadius: '6px', color: '#5B9CF6', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>+ Material em custódia</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button type="button" onClick={addPiece} style={{ marginTop: '10px', width: '100%', height: '34px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.14)', borderRadius: '8px', color: '#C8C4BE', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Adicionar peça</button>
              </div>

              {/* Resumo fixo (pecas + comercial) */}
              <div style={{ position: 'sticky', bottom: 0, background: 'rgba(200,169,122,0.05)', border: '1px solid rgba(200,169,122,0.18)', borderRadius: '9px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#A8A4A0', marginBottom: '4px' }}>
                  <span>Peças anexadas</span><span>{validPieces.length} de {pieces.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#E8E4DE', marginBottom: '4px' }}>
                  <span>Subtotal das peças</span><span>{brl(subtotalCents)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#E8E4DE', marginBottom: '6px' }}>
                  <span>Crédito material do cliente</span>
                  <input style={{ ...inputStyle, height: '28px', width: '110px', textAlign: 'right' }} inputMode="numeric" value={customerCreditStr} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setCustomerCreditStr(n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''); }} placeholder="0,00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#C8A97A', borderTop: '1px solid rgba(200,169,122,0.18)', paddingTop: '6px' }}>
                  <span>Total da proposta</span><span>{brl(totalCents)}</span>
                </div>
                {piecesMissingMaterial.length > 0 && (
                  <p style={{ fontSize: '10px', color: '#E0A052', marginTop: '6px', marginBottom: 0 }}>
                    {piecesMissingMaterial.length} peça(s) sem material — resolva antes de gerar a proposta.
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', padding: '10px 12px', color: '#E05252', fontSize: '12px', marginTop: '12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
          <button
            onClick={handleGenerateProposal}
            disabled={saving || !canGenerate}
            style={{
              height: '34px', padding: '0 20px',
              background: canGenerate ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${canGenerate ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: '7px', color: canGenerate ? '#2DD4BF' : '#7A7774',
              fontSize: '12px', fontWeight: 600,
              cursor: saving || !canGenerate ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Gerando...' : 'Gerar Proposta'}
          </button>
        </div>
      </div>
    </div>
  );
}
