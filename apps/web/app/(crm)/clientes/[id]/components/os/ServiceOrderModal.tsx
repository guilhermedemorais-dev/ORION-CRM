'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';

// TASK-002 (#9): modal de OS tecnica multi-pecas (projeto -> pecas -> proposta).
// Contrato visual: docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html
// Specs: docs/specs/production/os-multi-piece-proposal/{page-spec,validation-rules,api}.md
// Decisoes (2026-07-10): fidelidade total ao mockup; backend e a verdade do preco
// (RN-08 preco so-leitura, RN-06 custo/margem nunca aparecem -> removidos mao de obra,
// perda, preco-manual e card comercial de custo do mockup); material obrigatorio por
// peca (RN-04); custodia do cliente separada do estoque (RN-07). Persistencia real
// depende do backend da TASK-005 (POST /api/internal/proposals).

interface ProductOption {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  is_raw_material: boolean;
  category: string | null;
  stock_quantity?: number | null;
}

interface TeamUser {
  id: string;
  name: string;
  status?: string;
}

type MaterialOrigin = 'own_stock' | 'customer_custody';
type MaterialTab = 'store' | 'custody';
type CustodySubTab = 'existing' | 'new';
type StockFilter = 'all' | 'metais' | 'pedras' | 'insumos' | 'prontas';

interface DraftMaterial {
  tempId: string;
  origin: MaterialOrigin;
  productId?: string;
  productCode?: string;
  label: string;
  detail: string;
  quantity: string;
  unit: string;
  unitPriceCents: number; // preco unitario (leitura). Custo NAO trafega aqui.
  creditCents: number; // so custodia: credito negociado (informativo; soma no credito da proposta)
}

interface PieceTech {
  quantidade: string;
  metal: string;
  pedra: string;
  aroMedida: string;
  peso: string;
  largura: string;
  espessura: string;
  acabamento: string;
  corBanho: string;
  cravacao: string;
  gravacao: string;
  referencia: string;
  especificacoes: string;
}

interface DraftPiece {
  tempId: string;
  category: string; // unico dropdown tecnico da peca (RN-02)
  title: string;
  tech: PieceTech;
  materials: DraftMaterial[];
  collapsed: boolean;
}

interface NotePhoto {
  id: string;
  name: string;
  url: string;
}

interface Props {
  customerId: string;
  attendanceBlockId?: string;
  embedded?: boolean;
  submitBlocked?: boolean;
  locked?: boolean; // reservado: reabrir proposta ja registrada (fluxo de edicao = Fase 2)
  onBeforeCreate?: () => Promise<string>;
  onClose: () => void;
  onSaved: () => void;
}

// ---- Paleta da ficha do cliente (nao copiar tokens do modulo Estoque) ----
const GOLD = '#C8A97A';
const TEAL = '#2DD4BF';
const AMBER = '#E0A052';
const RED = '#E05252';
const BLUE = '#5B9CF6';
const TEXT = '#F0EDE8';
const TEXT_DIM = '#E8E4DE';
const MUTED = '#7A7774';

const inputStyle: React.CSSProperties = {
  height: '35px',
  background: '#1A1A1E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '7px',
  padding: '0 11px',
  fontSize: '12px',
  color: TEXT,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: TEXT_DIM,
  display: 'block',
  marginBottom: '4px',
};

const CATEGORY_OPTIONS = ['Anel', 'Aliança', 'Colar', 'Pingente', 'Brinco', 'Pulseira', 'Outro'];
const STOCK_FILTERS: { key: StockFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'metais', label: 'Metais' },
  { key: 'pedras', label: 'Pedras' },
  { key: 'insumos', label: 'Insumos' },
  { key: 'prontas', label: 'Peças prontas' },
];

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

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyTech(): PieceTech {
  return {
    quantidade: '1', metal: '', pedra: '', aroMedida: '', peso: '', largura: '',
    espessura: '', acabamento: '', corBanho: '', cravacao: '', gravacao: '',
    referencia: '', especificacoes: '',
  };
}

function newPiece(): DraftPiece {
  return {
    tempId: uid('p'),
    category: '',
    title: '',
    tech: emptyTech(),
    materials: [],
    collapsed: false,
  };
}

// Classifica um produto de estoque nas chips do mockup (heuristica client-side:
// o backend nao tem taxonomia metal/pedra/insumo, so is_raw_material + category/metal).
function matchesStockFilter(p: ProductOption, filter: StockFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'prontas') return !p.is_raw_material;
  if (!p.is_raw_material) return false;
  const hay = `${p.name} ${p.category ?? ''}`.toLowerCase();
  if (filter === 'metais') return /(ouro|prata|platina|metal|au\b|ag\b|paladio|bronze)/.test(hay);
  if (filter === 'pedras') return /(pedra|diamante|safira|rubi|esmeralda|zirc|cristal|brilhante|topazio|ametista)/.test(hay);
  // insumos: matéria-prima que não é metal nem pedra
  return !/(ouro|prata|platina|metal|diamante|safira|rubi|esmeralda|pedra|zirc|cristal)/.test(hay);
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.10em',
      textTransform: 'uppercase' as const, color: MUTED, marginBottom: '10px',
      paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {children}
    </div>
  );
}

function StatePanel({ icon, title, description, action }: {
  icon: string; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '9px', padding: '32px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", color: TEXT, margin: '0 0 5px', fontSize: '15px' }}>{title}</h3>
      <p style={{ color: MUTED, fontSize: '12px', margin: '0 0 12px' }}>{description}</p>
      {action}
    </div>
  );
}

export default function ServiceOrderModal({
  customerId,
  attendanceBlockId,
  embedded = false,
  submitBlocked = false,
  locked = false,
  onBeforeCreate,
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'notes' | 'cotacao'>('notes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Cabecalho do projeto
  const [project, setProject] = useState({ title: '', dueDate: '', responsibleId: '' });
  const [customerCreditStr, setCustomerCreditStr] = useState('');

  // Anotacoes e fotos (contexto do atendimento; nao gera proposta)
  const notesRef = useRef<HTMLDivElement>(null);
  const [noteChannel, setNoteChannel] = useState('WhatsApp');
  const [notePriority, setNotePriority] = useState('Normal');
  const [photos, setPhotos] = useState<NotePhoto[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [pieces, setPieces] = useState<DraftPiece[]>([newPiece()]);
  const [responsibles, setResponsibles] = useState<TeamUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  // Aba de material por peca (qual seletor aparece) + busca de estoque direcionada.
  const [matTab, setMatTab] = useState<Record<string, MaterialTab>>({});
  const [materialTarget, setMaterialTarget] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Custodia por peca (subsistema de lotes ainda inexistente -> registro manual local).
  const [custodyTarget, setCustodyTarget] = useState<string | null>(null);
  const [custodySubTab, setCustodySubTab] = useState<CustodySubTab>('new');
  const [custodyForm, setCustodyForm] = useState({
    tipo: 'Metal / matéria-prima', material: '', pesoBruto: '', pesoLiquido: '',
    descricao: '', valorRef: '', creditoStr: '',
  });

  const setPieceMatTab = useCallback((pieceId: string, value: MaterialTab) => {
    setMatTab((prev) => ({ ...prev, [pieceId]: value }));
    if (value === 'store') { setCustodyTarget(null); }
    else { setMaterialTarget(null); }
  }, []);

  useEffect(() => {
    if (embedded) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        if (showPreview) setShowPreview(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [embedded, onClose, saving, showPreview]);

  // Revoga URLs de objeto das fotos ao desmontar.
  useEffect(() => () => { photos.forEach((p) => URL.revokeObjectURL(p.url)); }, [photos]);

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
        const params = new URLSearchParams({ q: materialSearch.trim(), limit: '18', active_only: 'true' });
        // Chips 'prontas' buscam peca pronta; demais chips buscam materia-prima.
        if (stockFilter === 'prontas') params.set('is_raw_material', 'false');
        else if (stockFilter !== 'all') params.set('is_raw_material', 'true');
        const res = await fetch(`/api/internal/products?${params.toString()}`);
        if (!res.ok) throw new Error('search');
        const data = await res.json();
        const rows: ProductOption[] = Array.isArray(data?.data) ? data.data : [];
        setSearchResults(rows.filter((p) => matchesStockFilter(p, stockFilter)));
      } catch {
        setSearchResults([]);
        setSearchError('Não foi possível buscar materiais. Tente novamente.');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [materialTarget, materialSearch, stockFilter]);

  // ---- Mutacoes de peca ----
  const addPiece = useCallback(() => {
    const piece = newPiece();
    setPieces((prev) => [...prev, piece]);
    setPieceMatTab(piece.tempId, 'store');
  }, [setPieceMatTab]);

  const removePiece = useCallback((id: string) => {
    setPieces((prev) => prev.filter((p) => p.tempId !== id));
  }, []);

  const duplicatePiece = useCallback((id: string) => {
    setPieces((prev) => {
      const src = prev.find((p) => p.tempId === id);
      if (!src) return prev;
      const copy: DraftPiece = {
        ...src,
        tempId: uid('p'),
        title: src.title ? `${src.title} (cópia)` : '',
        tech: { ...src.tech },
        materials: src.materials.map((m) => ({ ...m, tempId: uid('m') })),
        collapsed: false,
      };
      return [...prev, copy];
    });
  }, []);

  const patchPiece = useCallback((id: string, patch: Partial<DraftPiece>) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, ...patch } : p)));
  }, []);

  const patchPieceTech = useCallback((id: string, key: keyof PieceTech, value: string) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, tech: { ...p.tech, [key]: value } } : p)));
  }, []);

  const collapsePiece = useCallback((id: string) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, collapsed: true } : p)));
  }, []);

  // ---- Mutacoes de material ----
  const addOwnStockMaterial = useCallback((pieceId: string, product: ProductOption) => {
    setPieces((prev) => prev.map((p) => {
      if (p.tempId !== pieceId) return p;
      if (p.materials.some((m) => m.origin === 'own_stock' && m.productId === product.id)) return p;
      const unit = product.is_raw_material ? 'g' : 'un';
      const stock = typeof product.stock_quantity === 'number' ? `${product.stock_quantity} ${unit} em estoque` : 'Estoque próprio · loja';
      return {
        ...p,
        materials: [...p.materials, {
          tempId: uid('m'), origin: 'own_stock',
          productId: product.id, productCode: product.code,
          label: product.name, detail: `${product.code} · ${stock}`,
          quantity: '1', unit, unitPriceCents: product.price_cents, creditCents: 0,
        }],
      };
    }));
    setMaterialTarget(null);
    setMaterialSearch('');
    setSearchResults([]);
  }, []);

  const registerCustodyMaterial = useCallback((pieceId: string) => {
    const label = custodyForm.material.trim() || custodyForm.descricao.trim();
    if (!label) { setError('Descreva o material/joia do cliente antes de vincular.'); return; }
    const credit = centsFromInput(custodyForm.creditoStr);
    setPieces((prev) => prev.map((p) => {
      if (p.tempId !== pieceId) return p;
      return {
        ...p,
        materials: [...p.materials, {
          tempId: uid('m'), origin: 'customer_custody',
          label, detail: custodyForm.descricao.trim() || 'Patrimônio do cliente · custódia separada do estoque',
          quantity: custodyForm.pesoLiquido || '1',
          unit: custodyForm.tipo.startsWith('Pedra') ? 'un' : 'g',
          unitPriceCents: 0, creditCents: credit,
        }],
      };
    }));
    if (credit > 0) {
      // Credito negociado da custodia soma no credito da proposta (customer_credit_cents).
      setCustomerCreditStr((prevStr) => {
        const total = centsFromInput(prevStr) + credit;
        return (total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    }
    setCustodyForm({ tipo: 'Metal / matéria-prima', material: '', pesoBruto: '', pesoLiquido: '', descricao: '', valorRef: '', creditoStr: '' });
    setCustodyTarget(null);
    setError(null);
  }, [custodyForm]);

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

  // ---- Fotos do atendimento (local; persistencia = fora do escopo desta fase) ----
  const handleAddPhotos = useCallback((files: FileList | null) => {
    if (!files) return;
    setPhotos((prev) => {
      const room = Math.max(0, 8 - prev.length);
      const next = Array.from(files).slice(0, room).map((f) => ({ id: uid('ph'), name: f.name, url: URL.createObjectURL(f) }));
      return [...prev, ...next];
    });
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // ---- Calculos (preco leitura; sem custo) ----
  const pieceHasMaterial = (p: DraftPiece) =>
    p.materials.some((m) => qtyOf(m.quantity) > 0 && (m.origin === 'own_stock' ? !!m.productId : m.label.trim().length > 0));

  const piecePriceCents = (p: DraftPiece) =>
    p.materials.reduce((sum, m) => sum + Math.round(qtyOf(m.quantity) * m.unitPriceCents), 0);

  const subtotalCents = useMemo(() => pieces.reduce((sum, p) => sum + piecePriceCents(p), 0), [pieces]);
  const customerCreditCents = centsFromInput(customerCreditStr);
  const totalCents = Math.max(0, subtotalCents - customerCreditCents);
  const sinalCents = Math.round(totalCents * 0.5); // RN-10: sinal minimo inicial 50%

  const validPieces = pieces.filter(pieceHasMaterial);
  const piecesMissingMaterial = pieces.filter((p) => !pieceHasMaterial(p));
  const canGenerate = pieces.length > 0 && validPieces.length > 0 && piecesMissingMaterial.length === 0 && !submitBlocked && !locked;

  async function handleConfirmProposal() {
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
      setShowPreview(false);
      onSaved();
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar proposta.');
      setShowPreview(false);
    } finally {
      setSaving(false);
    }
  }

  function handleGenerateClick() {
    if (!canGenerate) {
      setError('Cada peça precisa de ao menos um material antes de gerar a proposta.');
      setTab('cotacao');
      return;
    }
    setError(null);
    setShowPreview(true);
  }

  const toolBtn: React.CSSProperties = {
    minWidth: '28px', height: '28px', border: '1px solid rgba(255,255,255,0.08)',
    background: '#1A1A1E', color: MUTED, borderRadius: '5px', fontSize: '12px', cursor: 'pointer',
  };
  const exec = (cmd: string, value?: string) => {
    notesRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

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
          maxWidth: embedded ? 'none' : '760px',
          maxHeight: embedded ? 'none' : '90vh',
          overflowY: embedded ? 'visible' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: TEXT, fontWeight: 600, margin: 0 }}>
              OS técnica · Projeto multi-peças
            </h2>
            <button onClick={onClose} aria-label="Fechar" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: MUTED, fontSize: '16px', cursor: 'pointer', borderRadius: '5px' }}>✕</button>
          </div>
        )}

        {/* Abas de fluxo */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {([{ key: 'notes', label: '1. Anotações e fotos' }, { key: 'cotacao', label: '2. Cotação' }] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                height: '34px', padding: '0 14px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${tab === t.key ? GOLD : 'transparent'}`,
                color: tab === t.key ? TEXT : MUTED, fontSize: '12px', fontWeight: 700, cursor: 'pointer',
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
                <input style={inputStyle} value={project.title} onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Conjunto casamento" />
              </FieldGroup>
              <FieldGroup label="Prazo desejado">
                <input aria-label="Prazo desejado" style={{ ...inputStyle, colorScheme: 'dark' }} type="date" value={project.dueDate} onChange={(e) => setProject((p) => ({ ...p, dueDate: e.target.value }))} />
              </FieldGroup>
              <FieldGroup label="Responsável">
                <select aria-label="Responsável" style={{ ...inputStyle, cursor: 'pointer' }} value={project.responsibleId} onChange={(e) => setProject((p) => ({ ...p, responsibleId: e.target.value }))} disabled={teamLoading}>
                  <option value="">{teamLoading ? 'Carregando...' : 'Não atribuído'}</option>
                  {responsibles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </FieldGroup>
            </div>
          </div>

          {locked ? (
            <StatePanel
              icon="🔒"
              title="Proposta já aprovada"
              description="Esta versão está bloqueada. Para alterar peças ou valores, gere uma nova versão da proposta."
            />
          ) : tab === 'notes' ? (
            /* ---------- ABA ANOTACOES E FOTOS ---------- */
            <div style={{ marginBottom: '12px' }}>
              <SectionTitle>Anotações do atendimento</SectionTitle>
              <p style={{ fontSize: '11px', color: MUTED, marginTop: '-4px', marginBottom: '10px' }}>
                Anotações e fotos pertencem ao atendimento, não à proposta. Salvar aqui não gera proposta.
              </p>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', overflow: 'hidden', background: '#101012' }}>
                {/* toolbar de formatacao (contexto de anotacao) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#1A1A1E', flexWrap: 'wrap' }}>
                  <button type="button" style={toolBtn} title="Negrito" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><b>B</b></button>
                  <button type="button" style={toolBtn} title="Itálico" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><i>I</i></button>
                  <button type="button" style={toolBtn} title="Sublinhado" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}><u>U</u></button>
                  <button type="button" style={toolBtn} title="Lista" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}>☷</button>
                  <button type="button" style={toolBtn} title="Lista numerada" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}>1.</button>
                  <button type="button" style={toolBtn} title="Menção" onMouseDown={(e) => { e.preventDefault(); exec('insertText', '@'); }}>@</button>
                  <span style={{ flex: 1 }} />
                  <select aria-label="Canal" value={noteChannel} onChange={(e) => setNoteChannel(e.target.value)} style={{ ...inputStyle, height: '28px', width: '110px', fontSize: '11px' }}>
                    <option>WhatsApp</option><option>Presencial</option><option>Telefone</option><option>E-mail</option>
                  </select>
                  <select aria-label="Prioridade" value={notePriority} onChange={(e) => setNotePriority(e.target.value)} style={{ ...inputStyle, height: '28px', width: '95px', fontSize: '11px' }}>
                    <option>Normal</option><option>Alta</option><option>Urgente</option>
                  </select>
                </div>
                <div
                  ref={notesRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Anotações do atendimento"
                  style={{ minHeight: '110px', padding: '12px 14px', color: TEXT_DIM, fontSize: '12px', lineHeight: 1.6, outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                />
                {/* Fotos e referencias */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: TEXT_DIM }}>Fotos e referências do atendimento</div>
                      <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>Anexe fotos das joias desejadas, desenhos, medidas ou referências do cliente</div>
                    </div>
                    <span style={{ fontSize: '9px', color: MUTED, flexShrink: 0 }}>{photos.length} de 8 fotos</span>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" multiple aria-label="Adicionar fotos" style={{ display: 'none' }} onChange={(e) => { handleAddPhotos(e.target.files); if (photoInputRef.current) photoInputRef.current.value = ''; }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {photos.map((ph) => (
                      <div key={ph.id} title={ph.name} style={{ position: 'relative', width: '82px', height: '82px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.10)', overflow: 'hidden', backgroundColor: '#17171B', backgroundImage: `url(${ph.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <button type="button" onClick={() => removePhoto(ph.id)} aria-label={`Remover ${ph.name}`} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', border: 'none', borderRadius: '50%', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    {photos.length < 8 && (
                      <button type="button" onClick={() => photoInputRef.current?.click()} style={{ width: '82px', height: '82px', border: `1px dashed ${GOLD}55`, background: 'rgba(200,169,122,0.06)', color: GOLD, borderRadius: '8px', fontSize: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
                        <b style={{ fontSize: '20px', fontWeight: 400 }}>＋</b><span>Adicionar</span>
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '9px', color: MUTED, marginTop: '8px', marginBottom: 0 }}>As fotos são anexadas ao atendimento (persistência da galeria fica para etapa futura de backend).</p>
                </div>
              </div>
            </div>
          ) : (
            /* ---------- ABA COTACAO ---------- */
            <>
              {pieces.length === 0 ? (
                <StatePanel
                  icon="◇"
                  title="Nenhuma peça adicionada"
                  description="Adicione a primeira peça para montar a ficha técnica e o orçamento."
                  action={<button type="button" onClick={addPiece} style={{ height: '32px', padding: '0 16px', background: 'rgba(200,169,122,0.12)', border: `1px solid ${GOLD}44`, borderRadius: '7px', color: GOLD, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>＋ Nova peça</button>}
                />
              ) : (
                <div style={{ marginBottom: '18px' }}>
                  <SectionTitle>Peças do projeto ({pieces.length})</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pieces.map((p, idx) => {
                      const ready = pieceHasMaterial(p);
                      const activeMatTab: MaterialTab = matTab[p.tempId] ?? 'store';
                      return (
                        <div key={p.tempId} style={{ border: `1px solid ${ready ? 'rgba(45,212,191,0.22)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '9px', background: '#17171B', overflow: 'hidden' }}>
                          {/* Cabecalho do card */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)' }}>
                            <button type="button" onClick={() => patchPiece(p.tempId, { collapsed: !p.collapsed })} aria-label={p.collapsed ? 'Expandir peça' : 'Recolher peça'} style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', borderRadius: '7px', background: 'rgba(200,169,122,0.10)', border: `1px solid ${GOLD}33`, color: GOLD, fontFamily: 'Georgia, serif', fontWeight: 800, cursor: 'pointer', fontSize: '12px' }}>{idx + 1}</button>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || `Peça ${idx + 1}`}</div>
                              <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>{[p.category, p.tech.metal, p.tech.aroMedida && `Aro ${p.tech.aroMedida}`].filter(Boolean).join(' · ') || 'Preencha a ficha técnica'}</div>
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap', color: ready ? TEAL : AMBER, background: ready ? 'rgba(45,212,191,0.12)' : 'rgba(224,160,82,0.12)', border: `1px solid ${ready ? 'rgba(45,212,191,0.22)' : 'rgba(224,160,82,0.22)'}` }}>
                              {ready ? 'Pronta para proposta' : 'Sem material'}
                            </span>
                            <div style={{ textAlign: 'right', minWidth: '78px' }}>
                              <strong style={{ display: 'block', color: GOLD, fontFamily: 'Georgia, serif', fontSize: '15px' }}>{brl(piecePriceCents(p))}</strong>
                              <span style={{ color: MUTED, fontSize: '9px' }}>leitura</span>
                            </div>
                            <button type="button" onClick={() => duplicatePiece(p.tempId)} aria-label="Duplicar peça" style={{ width: '28px', height: '28px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: MUTED, cursor: 'pointer', fontSize: '12px' }}>⧉</button>
                            <button type="button" onClick={() => removePiece(p.tempId)} aria-label="Remover peça" style={{ width: '28px', height: '28px', background: '#1A1A1E', border: '1px solid rgba(224,82,82,0.20)', borderRadius: '6px', color: RED, cursor: 'pointer', fontSize: '14px' }}>×</button>
                          </div>

                          {!p.collapsed && (
                            <div style={{ padding: '13px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111114' }}>
                              {/* Ficha tecnica (Categoria = unico dropdown; demais texto, opcionais) */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                  <FieldGroup label="Nome da peça">
                                    <input style={inputStyle} value={p.title} onChange={(e) => patchPiece(p.tempId, { title: e.target.value })} placeholder="Ex: Anel solitário ouro 18k" />
                                  </FieldGroup>
                                </div>
                                <FieldGroup label="Categoria">
                                  <select aria-label={`Categoria da peça ${idx + 1}`} style={{ ...inputStyle, cursor: 'pointer' }} value={p.category} onChange={(e) => patchPiece(p.tempId, { category: e.target.value })}>
                                    <option value="">Selecionar...</option>
                                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </FieldGroup>
                                <FieldGroup label="Quantidade"><input style={inputStyle} value={p.tech.quantidade} onChange={(e) => patchPieceTech(p.tempId, 'quantidade', e.target.value)} /></FieldGroup>
                                <FieldGroup label="Metal"><input style={inputStyle} value={p.tech.metal} onChange={(e) => patchPieceTech(p.tempId, 'metal', e.target.value)} placeholder="Ouro amarelo 18k" /></FieldGroup>
                                <FieldGroup label="Pedra"><input style={inputStyle} value={p.tech.pedra} onChange={(e) => patchPieceTech(p.tempId, 'pedra', e.target.value)} placeholder="Diamante 0,30 ct" /></FieldGroup>
                                <FieldGroup label="Aro / medida"><input style={inputStyle} value={p.tech.aroMedida} onChange={(e) => patchPieceTech(p.tempId, 'aroMedida', e.target.value)} placeholder="17" /></FieldGroup>
                                <FieldGroup label="Peso estimado"><input style={inputStyle} value={p.tech.peso} onChange={(e) => patchPieceTech(p.tempId, 'peso', e.target.value)} placeholder="4,20 g" /></FieldGroup>
                                <FieldGroup label="Largura"><input style={inputStyle} value={p.tech.largura} onChange={(e) => patchPieceTech(p.tempId, 'largura', e.target.value)} placeholder="2,2 mm" /></FieldGroup>
                                <FieldGroup label="Espessura"><input style={inputStyle} value={p.tech.espessura} onChange={(e) => patchPieceTech(p.tempId, 'espessura', e.target.value)} placeholder="1,6 mm" /></FieldGroup>
                                <FieldGroup label="Acabamento"><input style={inputStyle} value={p.tech.acabamento} onChange={(e) => patchPieceTech(p.tempId, 'acabamento', e.target.value)} placeholder="Polido" /></FieldGroup>
                                <FieldGroup label="Cor / banho"><input style={inputStyle} value={p.tech.corBanho} onChange={(e) => patchPieceTech(p.tempId, 'corBanho', e.target.value)} placeholder="Ouro amarelo" /></FieldGroup>
                                <FieldGroup label="Cravação"><input style={inputStyle} value={p.tech.cravacao} onChange={(e) => patchPieceTech(p.tempId, 'cravacao', e.target.value)} placeholder="Garra 6 pontas" /></FieldGroup>
                                <FieldGroup label="Gravação"><input style={inputStyle} value={p.tech.gravacao} onChange={(e) => patchPieceTech(p.tempId, 'gravacao', e.target.value)} placeholder="Data / nome" /></FieldGroup>
                                <div style={{ gridColumn: 'span 2' }}>
                                  <FieldGroup label="Referência / modelo"><input style={inputStyle} value={p.tech.referencia} onChange={(e) => patchPieceTech(p.tempId, 'referencia', e.target.value)} placeholder="Solitário clássico" /></FieldGroup>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <FieldGroup label="Especificações técnicas">
                                    <textarea value={p.tech.especificacoes} onChange={(e) => patchPieceTech(p.tempId, 'especificacoes', e.target.value)} placeholder="Detalhes de fabricação, perfil, acabamento, gravação interna..." style={{ ...inputStyle, height: 'auto', minHeight: '58px', padding: '9px 11px', resize: 'vertical' }} />
                                  </FieldGroup>
                                </div>
                              </div>

                              {/* Materiais da peca */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '15px 0 8px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: TEXT_DIM, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  Materiais desta peça
                                  <span style={{ color: GOLD, fontSize: '9px', fontWeight: 800, border: `1px solid ${GOLD}44`, background: 'rgba(200,169,122,0.10)', borderRadius: '999px', padding: '2px 7px' }}>Obrigatório</span>
                                </div>
                                {/* segmented control: origem do material (RN-07) */}
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {([{ k: 'store', l: 'Estoque próprio · loja' }, { k: 'custody', l: 'Custódia · cliente' }] as const).map((seg) => (
                                    <button key={seg.k} type="button" onClick={() => setPieceMatTab(p.tempId, seg.k)} style={{ padding: '5px 9px', fontSize: '10px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${activeMatTab === seg.k ? (seg.k === 'custody' ? `${BLUE}55` : `${GOLD}55`) : 'rgba(255,255,255,0.08)'}`, background: activeMatTab === seg.k ? (seg.k === 'custody' ? 'rgba(91,156,246,0.12)' : 'rgba(200,169,122,0.12)') : 'transparent', color: activeMatTab === seg.k ? (seg.k === 'custody' ? BLUE : GOLD) : MUTED }}>{seg.l}</button>
                                  ))}
                                </div>
                              </div>

                              {p.materials.length === 0 && (
                                <div style={{ border: `1px dashed ${AMBER}4D`, borderRadius: '7px', padding: '9px', textAlign: 'center', color: AMBER, fontSize: '11px', marginBottom: '8px' }}>
                                  Selecione a matéria-prima, metal, pedra ou material que será usado na fabricação desta peça.
                                </div>
                              )}

                              {/* Lista de materiais selecionados (estoque + custodia) */}
                              {p.materials.map((m) => {
                                const lineCents = Math.round(qtyOf(m.quantity) * m.unitPriceCents);
                                const custody = m.origin === 'customer_custody';
                                return (
                                  <div key={m.tempId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 90px 26px', gap: '7px', alignItems: 'center', padding: '8px', marginBottom: '6px', background: '#1A1A1E', border: `1px solid ${custody ? 'rgba(91,156,246,0.22)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '7px' }}>
                                    <div style={{ minWidth: 0 }}>
                                      <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.05em', padding: '1px 5px', borderRadius: '4px', color: custody ? BLUE : GOLD, background: custody ? 'rgba(91,156,246,0.12)' : 'rgba(200,169,122,0.12)' }}>
                                        {custody ? 'CUSTÓDIA · CLIENTE' : 'ESTOQUE · LOJA'}
                                      </span>
                                      {custody ? (
                                        <input style={{ ...inputStyle, height: '26px', fontSize: '11px', marginTop: '3px' }} value={m.label} onChange={(e) => patchMaterial(p.tempId, m.tempId, { label: e.target.value })} placeholder="Material/joia do cliente" />
                                      ) : (
                                        <>
                                          <div style={{ fontSize: '11px', color: TEXT_DIM, fontWeight: 700, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</div>
                                          <div style={{ fontSize: '9px', color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.detail}</div>
                                        </>
                                      )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden', background: '#111113' }}>
                                      <input style={{ ...inputStyle, height: '28px', fontSize: '11px', textAlign: 'right', border: 'none', background: 'transparent' }} inputMode="decimal" value={m.quantity} onChange={(e) => patchMaterial(p.tempId, m.tempId, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} aria-label="Quantidade" />
                                      <span style={{ padding: '0 8px', color: GOLD, fontSize: '10px', fontWeight: 800, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>{m.unit}</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: custody ? BLUE : GOLD, fontWeight: 600, textAlign: 'right' }}>{custody ? (m.creditCents > 0 ? `− ${brl(m.creditCents)}` : 'crédito —') : brl(lineCents)}</div>
                                    <button type="button" onClick={() => removeMaterial(p.tempId, m.tempId)} aria-label="Remover material" style={{ width: '24px', height: '24px', background: 'transparent', border: '1px solid rgba(224,82,82,0.22)', borderRadius: '5px', color: RED, cursor: 'pointer', fontSize: '12px' }}>×</button>
                                  </div>
                                );
                              })}

                              {/* Seletor: estoque proprio */}
                              {activeMatTab === 'store' && (
                                <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', background: '#0D0D0F', marginTop: '4px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 800, color: TEXT_DIM, marginBottom: '6px' }}>Selecionar matéria-prima do estoque</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '7px' }}>
                                    <input style={{ ...inputStyle, height: '32px' }} value={materialTarget === p.tempId ? materialSearch : ''} onFocus={() => setMaterialTarget(p.tempId)} onChange={(e) => { setMaterialTarget(p.tempId); setMaterialSearch(e.target.value); }} placeholder="Buscar ouro, prata, pedra, código ou descrição..." />
                                    <button type="button" onClick={() => setMaterialTarget(p.tempId)} style={{ height: '32px', padding: '0 12px', background: 'rgba(200,169,122,0.10)', border: `1px solid ${GOLD}44`, borderRadius: '6px', color: GOLD, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Buscar</button>
                                  </div>
                                  <div style={{ display: 'flex', gap: '5px', margin: '8px 0', flexWrap: 'wrap' }}>
                                    {STOCK_FILTERS.map((f) => (
                                      <button key={f.key} type="button" onClick={() => { setStockFilter(f.key); setMaterialTarget(p.tempId); }} style={{ padding: '4px 9px', fontSize: '9px', borderRadius: '20px', cursor: 'pointer', border: `1px solid ${stockFilter === f.key ? `${GOLD}55` : 'rgba(255,255,255,0.08)'}`, background: stockFilter === f.key ? 'rgba(200,169,122,0.12)' : '#1A1A1E', color: stockFilter === f.key ? GOLD : MUTED }}>{f.label}</button>
                                    ))}
                                  </div>
                                  {materialTarget === p.tempId && (
                                    <>
                                      {searchError && <div style={{ color: RED, fontSize: '10px', marginBottom: '6px' }}>{searchError}</div>}
                                      {searching && <div style={{ color: MUTED, fontSize: '11px', padding: '4px 0' }}>Buscando...</div>}
                                      {!searching && materialSearch.trim() && searchResults.length === 0 && !searchError && <div style={{ color: MUTED, fontSize: '11px', padding: '4px 0' }}>Nenhum produto encontrado.</div>}
                                      {!searching && searchResults.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '6px' }}>
                                          {searchResults.map((product) => {
                                            const unit = product.is_raw_material ? 'g' : 'un';
                                            return (
                                              <div key={product.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '7px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)', background: '#17171B', borderRadius: '7px', padding: '7px' }}>
                                                <div style={{ minWidth: 0 }}>
                                                  <div style={{ fontSize: '10px', fontWeight: 700, color: TEXT_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                                                  <div style={{ fontSize: '8px', color: MUTED }}>{product.code}{typeof product.stock_quantity === 'number' ? ` · ${product.stock_quantity} ${unit}` : ''} · {brl(product.price_cents)}</div>
                                                </div>
                                                <button type="button" onClick={() => addOwnStockMaterial(p.tempId, product)} aria-label={`Adicionar ${product.name}`} style={{ width: '25px', height: '25px', border: `1px solid ${GOLD}55`, background: 'rgba(200,169,122,0.12)', color: GOLD, borderRadius: '5px', fontWeight: 800, cursor: 'pointer' }}>＋</button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Seletor: custodia do cliente */}
                              {activeMatTab === 'custody' && (
                                <div style={{ border: `1px solid ${BLUE}33`, borderRadius: '8px', padding: '10px', background: 'rgba(91,156,246,0.05)', marginTop: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: TEXT_DIM }}>Material ou joia do cliente em custódia</div>
                                    <span style={{ fontSize: '9px', color: BLUE }}>Patrimônio do cliente</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '5px', marginBottom: '9px' }}>
                                    {([{ k: 'existing', l: 'Selecionar custódia existente' }, { k: 'new', l: '＋ Adicionar material/joia' }] as const).map((ct) => (
                                      <button key={ct.k} type="button" onClick={() => { setCustodySubTab(ct.k); setCustodyTarget(p.tempId); }} style={{ flex: 1, height: '30px', fontSize: '10px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${BLUE}33`, background: (custodyTarget === p.tempId && custodySubTab === ct.k) ? 'rgba(91,156,246,0.16)' : 'transparent', color: (custodyTarget === p.tempId && custodySubTab === ct.k) ? '#9EC5FF' : MUTED }}>{ct.l}</button>
                                    ))}
                                  </div>
                                  {(custodyTarget !== p.tempId || custodySubTab === 'existing') ? (
                                    <div style={{ fontSize: '10px', color: MUTED, lineHeight: 1.5, padding: '4px 2px' }}>
                                      O subsistema de lotes de custódia (recebimentos já avaliados) ainda não está disponível no backend. Use <strong style={{ color: '#9EC5FF' }}>＋ Adicionar material/joia</strong> para registrar agora o item entregue pelo cliente.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px' }}>
                                      <FieldGroup label="Tipo de item">
                                        <select aria-label="Tipo de item em custódia" style={{ ...inputStyle, cursor: 'pointer' }} value={custodyForm.tipo} onChange={(e) => setCustodyForm((f) => ({ ...f, tipo: e.target.value }))}>
                                          <option>Metal / matéria-prima</option><option>Joia para derreter</option><option>Pedra / cristal</option><option>Sucata</option>
                                        </select>
                                      </FieldGroup>
                                      <FieldGroup label="Material / teor"><input style={inputStyle} value={custodyForm.material} onChange={(e) => setCustodyForm((f) => ({ ...f, material: e.target.value }))} placeholder="Ex: Ouro 18k" /></FieldGroup>
                                      <FieldGroup label="Peso bruto"><input style={inputStyle} value={custodyForm.pesoBruto} onChange={(e) => setCustodyForm((f) => ({ ...f, pesoBruto: e.target.value }))} placeholder="0,00 g" /></FieldGroup>
                                      <FieldGroup label="Peso líquido"><input style={inputStyle} value={custodyForm.pesoLiquido} onChange={(e) => setCustodyForm((f) => ({ ...f, pesoLiquido: e.target.value }))} placeholder="0,00 g" /></FieldGroup>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <FieldGroup label="Descrição da joia/material"><input style={inputStyle} value={custodyForm.descricao} onChange={(e) => setCustodyForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: cordão antigo com fecho quebrado" /></FieldGroup>
                                      </div>
                                      <FieldGroup label="Valor de referência"><input style={inputStyle} value={custodyForm.valorRef} onChange={(e) => setCustodyForm((f) => ({ ...f, valorRef: e.target.value }))} placeholder="R$ por g/un" /></FieldGroup>
                                      <FieldGroup label="Crédito negociado"><input style={inputStyle} inputMode="numeric" value={custodyForm.creditoStr} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setCustodyForm((f) => ({ ...f, creditoStr: n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '' })); }} placeholder="R$ 0,00" /></FieldGroup>
                                      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => registerCustodyMaterial(p.tempId)} style={{ height: '32px', padding: '0 14px', background: 'rgba(91,156,246,0.14)', border: `1px solid ${BLUE}44`, borderRadius: '7px', color: '#9EC5FF', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Registrar em custódia e vincular à peça</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Acoes da peca */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '7px', marginTop: '12px' }}>
                                <button type="button" onClick={() => removePiece(p.tempId)} style={{ height: '32px', padding: '0 12px', background: 'rgba(224,82,82,0.07)', border: '1px solid rgba(224,82,82,0.20)', borderRadius: '7px', color: RED, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Remover peça</button>
                                <button type="button" onClick={() => duplicatePiece(p.tempId)} style={{ height: '32px', padding: '0 12px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Duplicar</button>
                                <button type="button" onClick={() => collapsePiece(p.tempId)} style={{ height: '32px', padding: '0 12px', background: 'rgba(200,169,122,0.10)', border: `1px solid ${GOLD}44`, borderRadius: '7px', color: GOLD, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Salvar e recolher peça</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button type="button" onClick={addPiece} style={{ marginTop: '10px', width: '100%', minHeight: '44px', background: 'rgba(200,169,122,0.035)', border: `1px dashed ${GOLD}44`, borderRadius: '8px', color: GOLD, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>＋ Nova peça neste projeto</button>

                  {piecesMissingMaterial.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', padding: '9px 10px', border: `1px solid ${GOLD}44`, background: 'rgba(200,169,122,0.10)', color: GOLD, borderRadius: '7px', fontSize: '10px', lineHeight: 1.45 }}>
                      <span>!</span>
                      <span>Existe peça sem material selecionado. Selecione a matéria-prima/material obrigatório antes de gerar a proposta.</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', padding: '10px 12px', color: RED, fontSize: '12px', marginTop: '12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Resumo fixo (so na aba Cotacao, com >=1 peca) */}
        {tab === 'cotacao' && !locked && pieces.length > 0 && (
          <div style={{ position: 'sticky', bottom: 0, background: '#101012', borderTop: `1px solid ${GOLD}22`, padding: '12px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: MUTED, marginBottom: '6px' }}>Peças anexadas ({validPieces.length}/{pieces.length})</div>
                <div style={{ maxHeight: '84px', overflowY: 'auto' }}>
                  {pieces.map((p, idx) => (
                    <div key={p.tempId} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', padding: '3px 0', color: TEXT_DIM }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idx + 1}. {p.title || `Peça ${idx + 1}`}</span>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>{brl(piecePriceCents(p))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#A8A4A0', padding: '2px 0' }}><span>Subtotal das peças</span><strong style={{ color: TEXT }}>{brl(subtotalCents)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#A8A4A0', padding: '2px 0' }}>
                  <span>Crédito material cliente</span>
                  <input aria-label="Crédito material do cliente" style={{ ...inputStyle, height: '26px', width: '104px', textAlign: 'right', color: BLUE }} inputMode="numeric" value={customerCreditStr} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setCustomerCreditStr(n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''); }} placeholder="0,00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#A8A4A0', padding: '2px 0' }}><span>Sinal sugerido (50%)</span><strong style={{ color: TEXT }}>{brl(sinalCents)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${GOLD}33`, marginTop: '6px', paddingTop: '7px' }}>
                  <span style={{ fontSize: '12px', color: TEXT_DIM }}>Total da proposta</span>
                  <strong style={{ fontFamily: 'Georgia, serif', color: GOLD, fontSize: '19px' }}>{brl(totalCents)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer — acoes mudam por aba */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', color: MUTED }}>{tab === 'notes' ? `${photos.length} foto(s) anexada(s)` : `${validPieces.length} de ${pieces.length} peça(s) pronta(s)`}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
          {tab === 'notes' ? (
            <>
              <button type="button" onClick={() => notify.success('Anotações salvas', 'Rascunho do atendimento (local)')} style={{ height: '34px', padding: '0 14px', background: 'rgba(91,156,246,0.12)', border: `1px solid ${BLUE}44`, borderRadius: '7px', color: BLUE, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Salvar anotações</button>
              <button type="button" onClick={() => setTab('cotacao')} style={{ height: '34px', padding: '0 18px', background: GOLD, border: `1px solid ${GOLD}`, borderRadius: '7px', color: '#111', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Ir para cotação →</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => notify.success('Cotação salva', 'Rascunho técnico/comercial (local)')} style={{ height: '34px', padding: '0 14px', background: 'rgba(91,156,246,0.12)', border: `1px solid ${BLUE}44`, borderRadius: '7px', color: BLUE, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Salvar cotação</button>
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={saving || !canGenerate}
                style={{
                  height: '34px', padding: '0 20px',
                  background: canGenerate ? GOLD : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${canGenerate ? GOLD : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: '7px', color: canGenerate ? '#111' : MUTED,
                  fontSize: '12px', fontWeight: 700,
                  cursor: saving || !canGenerate ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Gerar Proposta
              </button>
            </>
          )}
        </div>
      </div>

      {/* Previa da proposta (confirmar geracao) */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Prévia da proposta"
          style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.74)', padding: '24px', zIndex: 1100 }}
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowPreview(false); }}
        >
          <div style={{ width: 'min(680px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#141417', border: `1px solid ${GOLD}55`, borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ color: GOLD, fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>PRÉVIA · AINDA NÃO SALVA</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", margin: '4px 0 0', fontSize: '18px', color: TEXT }}>{project.title || 'Proposta multi-peças'}</h2>
              </div>
              <button type="button" onClick={() => setShowPreview(false)} aria-label="Fechar prévia" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: MUTED, fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: MUTED, marginBottom: '8px' }}>Itens da proposta</div>
              {pieces.map((p, idx) => (
                <div key={p.tempId} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '10px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)', background: '#17171B', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', borderRadius: '7px', background: 'rgba(200,169,122,0.10)', border: `1px solid ${GOLD}33`, color: GOLD, fontFamily: 'Georgia, serif', fontWeight: 800 }}>{idx + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: TEXT }}>{p.title || `Peça ${idx + 1}`}</div>
                    <div style={{ fontSize: '10px', color: MUTED }}>{[p.category, p.tech.metal, p.tech.pedra].filter(Boolean).join(' · ') || 'Ficha técnica em rascunho'}</div>
                  </div>
                  <strong style={{ color: GOLD, fontFamily: 'Georgia, serif' }}>{brl(piecePriceCents(p))}</strong>
                </div>
              ))}
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: '#17171B', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#A8A4A0', padding: '2px 0' }}><span>Subtotal das peças</span><strong style={{ color: TEXT }}>{brl(subtotalCents)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#A8A4A0', padding: '2px 0' }}><span>Crédito negociado</span><strong style={{ color: BLUE }}>− {brl(customerCreditCents)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${GOLD}33`, marginTop: '6px', paddingTop: '7px' }}>
                  <span style={{ fontSize: '12px', color: TEXT_DIM }}>Total da proposta</span>
                  <strong style={{ fontFamily: 'Georgia, serif', color: GOLD, fontSize: '20px' }}>{brl(totalCents)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', border: '1px solid rgba(45,212,191,0.18)', background: 'rgba(45,212,191,0.06)', color: '#8CC9AA', padding: '9px 10px', borderRadius: '7px', fontSize: '10px', lineHeight: 1.45, marginTop: '10px' }}>
                <span>→</span>
                <span>Ao confirmar, a proposta é registrada na aba <strong>Propostas</strong> da ficha do cliente. Envio, PDF, WhatsApp e “Fazer venda” são etapas posteriores (Fase 2).</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button type="button" onClick={() => setShowPreview(false)} disabled={saving} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer' }}>Voltar e editar</button>
              <button type="button" onClick={handleConfirmProposal} disabled={saving} style={{ height: '34px', padding: '0 20px', background: GOLD, border: `1px solid ${GOLD}`, borderRadius: '7px', color: '#111', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Gerando...' : 'Confirmar geração da proposta'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
