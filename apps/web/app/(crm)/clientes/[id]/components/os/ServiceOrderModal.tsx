'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';

// TASK-002 (#9): modal de OS tecnica multi-pecas (projeto -> pecas -> proposta).
// LAYOUT: copia 1:1 do mockup docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html
// (mesma estrutura de regioes, paleta e hierarquia). Unicas divergencias aprovadas:
// preco da peca e SOMENTE LEITURA calculado (RN-08) e nada de custo/mao de obra/perda/
// preco manual (RN-06) — decisao Guilherme 2026-07-10 "backend e a verdade do preco".
// Specs: docs/specs/production/os-multi-piece-proposal/{page-spec,validation-rules,api}.md
// Persistencia real: POST /api/internal/proposals (TASK-005).

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
  creditCents: number; // custodia: credito negociado (soma no credito da proposta)
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
  locked?: boolean; // proposta ja registrada/aprovada (edicao = Fase 2)
  onBeforeCreate?: () => Promise<string>;
  onClose: () => void;
  onSaved: () => void;
}

// ---- Tokens do mockup (:root do mockup-2026-06-15) ----
const V = {
  base: '#0F0F11',
  surface: '#131316',
  elevated: '#1A1A1E',
  gold: '#BFA06A',
  goldDim: 'rgba(191,160,106,0.11)',
  goldBorder: 'rgba(191,160,106,0.28)',
  text: '#F0EBE3',
  secondary: '#A09A94',
  muted: '#66616A',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.11)',
  green: '#4CAF82',
  greenText: '#8CC9AA',
  red: '#E05252',
  amber: '#F0A040',
  blue: '#4A9EFF',
  purple: '#9C6FDE',
  purpleLight: '#C6A9F3',
  strip: '#111113',
} as const;

const control: React.CSSProperties = {
  minHeight: '34px',
  border: `1px solid ${V.borderMid}`,
  background: V.elevated,
  color: V.text,
  borderRadius: '7px',
  padding: '0 11px',
  outline: 'none',
  width: '100%',
  fontSize: '12px',
  boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif',
};

const labelCss: React.CSSProperties = {
  display: 'block',
  margin: '0 0 5px',
  fontSize: '9px',
  color: V.muted,
  fontWeight: 800,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
};

const btn: React.CSSProperties = {
  minHeight: '34px',
  borderRadius: '7px',
  padding: '0 13px',
  fontSize: '11px',
  fontWeight: 750,
  border: `1px solid ${V.borderMid}`,
  background: V.elevated,
  color: V.secondary,
  cursor: 'pointer',
};
const btnGold: React.CSSProperties = { ...btn, background: V.gold, borderColor: V.gold, color: '#111' };
const btnGoldSoft: React.CSSProperties = { ...btn, background: V.goldDim, borderColor: V.goldBorder, color: V.gold };
const btnBlue: React.CSSProperties = { ...btn, background: 'rgba(74,158,255,0.12)', borderColor: 'rgba(74,158,255,0.25)', color: V.blue };
const btnDanger: React.CSSProperties = { ...btn, color: V.red, borderColor: 'rgba(224,82,82,0.2)', background: 'rgba(224,82,82,0.07)' };
const iconBtn: React.CSSProperties = {
  width: '28px', height: '28px', border: `1px solid ${V.border}`, background: V.elevated,
  color: V.secondary, borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
};

const CATEGORY_OPTIONS = ['Anel', 'Aliança', 'Colar', 'Pingente', 'Brinco', 'Pulseira', 'Cordão', 'Outro'];
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
    tempId: uid('p'), category: '', title: '', tech: emptyTech(), materials: [], collapsed: false,
  };
}

// Chips do mockup (Metais/Pedras/Insumos/Pecas prontas) sobre o cadastro real
// (backend so tem is_raw_material + texto) -> classificacao client-side.
function matchesStockFilter(p: ProductOption, filter: StockFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'prontas') return !p.is_raw_material;
  if (!p.is_raw_material) return false;
  const hay = `${p.name} ${p.category ?? ''}`.toLowerCase();
  if (filter === 'metais') return /(ouro|prata|platina|paladio|bronze|metal|\bau\b|\bag\b)/.test(hay);
  if (filter === 'pedras') return /(pedra|diamante|safira|rubi|esmeralda|zirc|cristal|brilhante|topazio|ametista)/.test(hay);
  return !/(ouro|prata|platina|metal|diamante|safira|rubi|esmeralda|pedra|zirc|cristal)/.test(hay);
}

function inventoryIcon(p: ProductOption): string {
  const n = p.name.toLowerCase();
  if (/ouro/.test(n)) return 'Au';
  if (/prata/.test(n)) return 'Ag';
  if (/(diamante|pedra|safira|rubi|esmeralda|zirc|cristal|brilhante)/.test(n)) return '◇';
  return '◆';
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

  // project-bar (dentro da Cotacao, como no mockup)
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

  // Origem do material por peca (segmented) + busca de estoque direcionada
  const [matTab, setMatTab] = useState<Record<string, MaterialTab>>({});
  const [materialTarget, setMaterialTarget] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [feedback, setFeedback] = useState<{ pieceId: string; msg: string } | null>(null);

  // Custodia (subsistema de lotes inexistente -> registro manual local)
  const [custodySubTab, setCustodySubTab] = useState<Record<string, CustodySubTab>>({});
  const [custodyForm, setCustodyForm] = useState({
    tipo: 'Metal / matéria-prima', material: '', pesoBruto: '', pesoLiquido: '',
    descricao: '', valorRef: '', creditoStr: '', observacoes: '',
  });
  const [custodyFiles, setCustodyFiles] = useState<string[]>([]);
  const custodyFileRef = useRef<HTMLInputElement>(null);

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
        /* equipe opcional */
      } finally {
        if (active) setTeamLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Busca de produtos (estoque proprio) com debounce
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
        if (stockFilter === 'prontas') params.set('is_raw_material', 'false');
        else if (stockFilter !== 'all') params.set('is_raw_material', 'true');
        const res = await fetch(`/api/internal/products?${params.toString()}`);
        if (!res.ok) throw new Error('search');
        const data = await res.json();
        const rows: ProductOption[] = Array.isArray(data?.data) ? data.data : [];
        setSearchResults(rows.filter((p) => matchesStockFilter(p, stockFilter)));
      } catch {
        setSearchResults([]);
        setSearchError('Não foi possível carregar os materiais. A OS foi preservada.');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [materialTarget, materialSearch, stockFilter, searchNonce]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(t);
  }, [feedback]);

  // ---- Pecas ----
  const setPieceMatTab = useCallback((pieceId: string, value: MaterialTab) => {
    setMatTab((prev) => ({ ...prev, [pieceId]: value }));
  }, []);

  const addPiece = useCallback(() => setPieces((prev) => [...prev, newPiece()]), []);
  const removePiece = useCallback((id: string) => setPieces((prev) => prev.filter((p) => p.tempId !== id)), []);
  const duplicatePiece = useCallback((id: string) => {
    setPieces((prev) => {
      const src = prev.find((p) => p.tempId === id);
      if (!src) return prev;
      return [...prev, {
        ...src,
        tempId: uid('p'),
        title: src.title ? `${src.title} (cópia)` : '',
        tech: { ...src.tech },
        materials: src.materials.map((m) => ({ ...m, tempId: uid('m') })),
        collapsed: false,
      }];
    });
  }, []);
  const patchPiece = useCallback((id: string, patch: Partial<DraftPiece>) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, ...patch } : p)));
  }, []);
  const patchPieceTech = useCallback((id: string, key: keyof PieceTech, value: string) => {
    setPieces((prev) => prev.map((p) => (p.tempId === id ? { ...p, tech: { ...p.tech, [key]: value } } : p)));
  }, []);

  // ---- Materiais ----
  const addOwnStockMaterial = useCallback((pieceId: string, product: ProductOption) => {
    setPieces((prev) => prev.map((p) => {
      if (p.tempId !== pieceId) return p;
      if (p.materials.some((m) => m.origin === 'own_stock' && m.productId === product.id)) return p;
      const unit = product.is_raw_material ? 'g' : 'un';
      const stock = typeof product.stock_quantity === 'number' ? `${product.stock_quantity} ${unit} disponíveis` : 'Estoque próprio';
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
    setFeedback({ pieceId, msg: `${product.name} adicionado à peça. Ajuste a quantidade na lista.` });
  }, []);

  const registerCustodyMaterial = useCallback((pieceId: string) => {
    const label = custodyForm.material.trim() || custodyForm.descricao.trim();
    if (!label || !custodyForm.descricao.trim()) {
      setError('Preencha a descrição da joia/material do cliente antes de registrar a custódia.');
      return;
    }
    const credit = centsFromInput(custodyForm.creditoStr);
    setPieces((prev) => prev.map((p) => {
      if (p.tempId !== pieceId) return p;
      return {
        ...p,
        materials: [...p.materials, {
          tempId: uid('m'), origin: 'customer_custody',
          label,
          detail: `${custodyForm.descricao.trim()}${custodyForm.pesoBruto ? ` · bruto ${custodyForm.pesoBruto}` : ''} · custódia separada do estoque`,
          quantity: custodyForm.pesoLiquido || '1',
          unit: custodyForm.tipo.startsWith('Pedra') ? 'un' : 'g',
          unitPriceCents: 0,
          creditCents: credit,
        }],
      };
    }));
    if (credit > 0) {
      setCustomerCreditStr((prevStr) => {
        const total = centsFromInput(prevStr) + credit;
        return (total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    }
    setCustodyForm({ tipo: 'Metal / matéria-prima', material: '', pesoBruto: '', pesoLiquido: '', descricao: '', valorRef: '', creditoStr: '', observacoes: '' });
    setCustodyFiles([]);
    setError(null);
  }, [custodyForm]);

  const patchMaterial = useCallback((pieceId: string, matId: string, patch: Partial<DraftMaterial>) => {
    setPieces((prev) => prev.map((p) => (p.tempId !== pieceId ? p : {
      ...p, materials: p.materials.map((m) => (m.tempId === matId ? { ...m, ...patch } : m)),
    })));
  }, []);

  const removeMaterial = useCallback((pieceId: string, matId: string) => {
    setPieces((prev) => prev.map((p) => (p.tempId !== pieceId ? p : {
      ...p, materials: p.materials.filter((m) => m.tempId !== matId),
    })));
  }, []);

  // ---- Fotos do atendimento (local; persistencia da galeria = backend futuro) ----
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
  const canGenerate = pieces.length > 0 && piecesMissingMaterial.length === 0 && !submitBlocked && !locked;

  async function handleConfirmProposal() {
    setSaving(true);
    setError(null);
    try {
      const resolvedAttendanceBlockId = onBeforeCreate ? await onBeforeCreate() : attendanceBlockId;
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
        throw new Error(body?.message ?? `Backend da proposta indisponível (HTTP ${res.status}).`);
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
      setError('Existe peça sem material selecionado. Selecione a matéria-prima/material obrigatório antes de gerar a proposta.');
      setTab('cotacao');
      return;
    }
    setError(null);
    setShowPreview(true);
  }

  const toolCss: React.CSSProperties = {
    minWidth: '29px', height: '29px', border: `1px solid ${V.border}`, background: V.elevated,
    color: V.secondary, borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
  };
  const exec = (cmd: string, value?: string) => {
    notesRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const footStatus = tab === 'notes'
    ? `${photos.length} foto(s) anexada(s)`
    : `Cotação em rascunho · ${validPieces.length} de ${pieces.length} peça(s) completa(s)`;

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
      {/* .modal */}
      <div
        style={{
          background: V.base,
          border: `1px solid ${embedded ? 'rgba(45,212,191,0.18)' : V.borderMid}`,
          borderTop: embedded ? 'none' : undefined,
          borderRadius: embedded ? '0 0 8px 8px' : '12px',
          width: '100%',
          maxWidth: embedded ? 'none' : '1080px',
          maxHeight: embedded ? 'none' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* .modal-head */}
        {!embedded && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 18px', borderBottom: `1px solid ${V.border}` }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '16px', color: V.text, fontWeight: 600, margin: 0, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Atendimento · OS técnica multi-peças
            </h2>
            <button onClick={onClose} aria-label="Fechar" style={{ width: '28px', height: '28px', border: 0, background: 'transparent', color: V.muted, fontSize: '17px', borderRadius: '5px', cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* .workflow-tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '9px 18px 0', background: V.strip, borderBottom: `1px solid ${V.border}`, flexShrink: 0 }}>
          {([{ key: 'notes', label: '1. Anotações e fotos' }, { key: 'cotacao', label: '2. Cotação' }] as const).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  minHeight: '35px', padding: '0 16px', borderRadius: '7px 7px 0 0', cursor: 'pointer',
                  border: `1px solid ${active ? V.goldBorder : 'transparent'}`, borderBottom: 0,
                  background: active ? V.base : 'transparent',
                  color: active ? V.gold : V.muted, fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* panes (scroll) */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {locked ? (
            <div style={{ padding: '30px', textAlign: 'center', margin: '16px 18px', border: `1px dashed ${V.borderMid}`, borderRadius: '9px', color: V.secondary }}>
              <div style={{ fontSize: '30px', marginBottom: '8px' }}>🔒</div>
              <h3 style={{ fontFamily: 'Georgia, serif', color: V.text, margin: '0 0 5px' }}>Proposta já aprovada</h3>
              <p style={{ fontSize: '12px', margin: 0 }}>Esta versão está bloqueada. Para alterar peças ou valores, gere uma nova versão da proposta.</p>
            </div>
          ) : tab === 'notes' ? (
            /* ---------- 1. ANOTACOES E FOTOS (.notes-layout) ---------- */
            <div style={{ padding: '16px 18px 22px' }}>
              <div style={{ border: `1px solid ${V.border}`, background: '#101012', borderRadius: '9px', overflow: 'hidden' }}>
                {/* .notes-toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 10px', borderBottom: `1px solid ${V.border}`, background: V.surface, flexWrap: 'wrap' }}>
                  <button type="button" style={toolCss} title="Negrito" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><b>B</b></button>
                  <button type="button" style={toolCss} title="Itálico" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><i>I</i></button>
                  <button type="button" style={toolCss} title="Sublinhado" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}><u>U</u></button>
                  <button type="button" style={toolCss} title="Lista" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}>☷</button>
                  <button type="button" style={toolCss} title="Lista numerada" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}>1.</button>
                  <button type="button" style={toolCss} title="Menção" onMouseDown={(e) => { e.preventDefault(); exec('insertText', '@'); }}>@</button>
                  <span style={{ flex: 1 }} />
                  <select aria-label="Canal" value={noteChannel} onChange={(e) => setNoteChannel(e.target.value)} style={{ ...control, width: '105px', minHeight: '29px' }}>
                    <option>WhatsApp</option><option>Presencial</option><option>Telefone</option><option>E-mail</option>
                  </select>
                  <select aria-label="Prioridade" value={notePriority} onChange={(e) => setNotePriority(e.target.value)} style={{ ...control, width: '90px', minHeight: '29px' }}>
                    <option>Normal</option><option>Alta</option><option>Urgente</option>
                  </select>
                </div>
                {/* .editor */}
                <div
                  ref={notesRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Anotações do atendimento"
                  style={{ minHeight: '150px', padding: '15px 20px', color: V.secondary, fontSize: '12px', lineHeight: 1.6, outline: 'none' }}
                />
                {/* .photo-section */}
                <div style={{ borderTop: `1px solid ${V.border}`, padding: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: V.text }}>Fotos e referências do atendimento</div>
                      <div style={{ marginTop: '4px', fontSize: '9px', lineHeight: 1.35, color: V.muted }}>Anexe fotos das joias desejadas, desenhos, medidas ou referências enviadas pelo cliente</div>
                    </div>
                    <span style={{ fontSize: '9px', color: V.secondary, flexShrink: 0 }}>{photos.length} de 8 fotos</span>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" multiple aria-label="Adicionar fotos" style={{ display: 'none' }} onChange={(e) => { handleAddPhotos(e.target.files); if (photoInputRef.current) photoInputRef.current.value = ''; }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {photos.map((ph) => (
                      <div key={ph.id} style={{ position: 'relative', width: '82px', height: '82px', border: `1px solid ${V.borderMid}`, borderRadius: '8px', overflow: 'hidden', backgroundColor: '#171719', backgroundImage: `url(${ph.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <small style={{ position: 'absolute', left: '4px', right: '4px', bottom: '4px', padding: '2px 4px', borderRadius: '4px', background: 'rgba(0,0,0,0.72)', color: V.secondary, fontSize: '7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.name}</small>
                        <button type="button" onClick={() => removePhoto(ph.id)} aria-label={`Remover ${ph.name}`} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', border: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    {photos.length < 8 && (
                      <button type="button" onClick={() => photoInputRef.current?.click()} style={{ width: '82px', height: '82px', border: `1px dashed ${V.goldBorder}`, background: V.goldDim, color: V.gold, borderRadius: '8px', fontSize: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
                        <b style={{ fontSize: '20px', fontWeight: 400 }}>＋</b><span>Adicionar foto</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* .notes-hint */}
              <div style={{ display: 'flex', gap: '7px', marginTop: '12px', padding: '9px 10px', border: '1px solid rgba(74,158,255,0.18)', background: 'rgba(74,158,255,0.06)', color: '#82BAFF', borderRadius: '7px', fontSize: '10px', lineHeight: 1.45 }}>
                <span>→</span>
                <span>Depois de registrar as informações do atendimento, avance para <strong>Cotação</strong> para criar uma ou mais peças, selecionar materiais e montar a proposta.</span>
              </div>
            </div>
          ) : (
            /* ---------- 2. COTACAO (.modal-scroll > .os-shell) ---------- */
            <div style={{ padding: '16px 18px 22px' }}>
              {/* .project-bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.7fr', gap: '10px', marginBottom: '12px' }}>
                <label>
                  <span style={labelCss}>Nome do projeto</span>
                  <input style={control} value={project.title} onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Conjunto casamento" />
                </label>
                <label>
                  <span style={labelCss}>Prazo desejado</span>
                  <input aria-label="Prazo desejado" style={{ ...control, colorScheme: 'dark' }} type="date" value={project.dueDate} onChange={(e) => setProject((p) => ({ ...p, dueDate: e.target.value }))} />
                </label>
                <label>
                  <span style={labelCss}>Responsável</span>
                  <select aria-label="Responsável" style={{ ...control, cursor: 'pointer' }} value={project.responsibleId} onChange={(e) => setProject((p) => ({ ...p, responsibleId: e.target.value }))} disabled={teamLoading}>
                    <option value="">{teamLoading ? 'Carregando...' : 'Não atribuído'}</option>
                    {responsibles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
              </div>

              {pieces.length === 0 ? (
                /* .state-panel vazio */
                <div style={{ padding: '30px', textAlign: 'center', border: `1px dashed ${V.borderMid}`, borderRadius: '9px', color: V.secondary }}>
                  <div style={{ fontSize: '30px', marginBottom: '8px' }}>◇</div>
                  <h3 style={{ fontFamily: 'Georgia, serif', color: V.text, margin: '0 0 5px' }}>Nenhuma peça adicionada</h3>
                  <p style={{ fontSize: '12px', margin: '0 0 12px' }}>Adicione a primeira peça para montar a ficha técnica e o orçamento.</p>
                  <button type="button" onClick={addPiece} style={btnGoldSoft}>＋ Nova peça</button>
                </div>
              ) : (
                <>
                  {/* .piece-list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    {pieces.map((p, idx) => {
                      const ready = pieceHasMaterial(p);
                      const active = !p.collapsed;
                      const activeMatTab: MaterialTab = matTab[p.tempId] ?? 'store';
                      const storeMaterials = p.materials.filter((m) => m.origin === 'own_stock');
                      const custodyMaterials = p.materials.filter((m) => m.origin === 'customer_custody');
                      const subTab: CustodySubTab = custodySubTab[p.tempId] ?? 'existing';
                      const meta = [
                        p.category, p.tech.metal, p.tech.pedra,
                        p.tech.aroMedida && `Aro ${p.tech.aroMedida}`,
                        ready ? 'Materiais definidos' : null,
                      ].filter(Boolean).join(' · ') || 'Preencha a ficha técnica e selecione os materiais';
                      return (
                        <article key={p.tempId} style={{ border: `1px solid ${active ? V.goldBorder : V.borderMid}`, background: V.surface, borderRadius: '9px', overflow: 'hidden', boxShadow: active ? '0 0 0 1px rgba(191,160,106,0.06)' : undefined }}>
                          {/* .piece-head */}
                          <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto auto auto', alignItems: 'center', gap: '9px', padding: '10px 12px' }}>
                            <div style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', borderRadius: '7px', background: V.goldDim, border: `1px solid ${V.goldBorder}`, color: V.gold, fontFamily: 'Georgia, serif', fontWeight: 800 }}>{idx + 1}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 750, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || `Nova peça sem título`}</div>
                              <div style={{ fontSize: '10px', color: V.muted, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
                            </div>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px',
                              padding: '4px 8px', fontSize: '9px', fontWeight: 800, whiteSpace: 'nowrap',
                              color: ready ? V.greenText : V.gold,
                              border: `1px solid ${ready ? 'rgba(76,175,130,0.22)' : V.goldBorder}`,
                              background: ready ? 'rgba(76,175,130,0.08)' : V.goldDim,
                            }}>
                              {ready ? 'Pronta para proposta' : 'Sem material'}
                            </span>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ display: 'block', color: V.gold, fontFamily: 'Georgia, serif', fontSize: '15px' }}>{brl(piecePriceCents(p))}</strong>
                              <span style={{ color: V.muted, fontSize: '9px' }}>calculado · leitura</span>
                            </div>
                            <button type="button" onClick={() => patchPiece(p.tempId, { collapsed: !p.collapsed })} aria-label={active ? `Recolher peça ${idx + 1}` : `Expandir peça ${idx + 1}`} style={iconBtn}>{active ? '▲' : '▼'}</button>
                          </div>

                          {/* .piece-body */}
                          {active && (
                            <div style={{ borderTop: `1px solid ${V.border}`, padding: '13px', background: '#111114' }}>
                              {/* ficha tecnica: grid 4 colunas do mockup */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px' }}>
                                <label style={{ gridColumn: 'span 2' }}>
                                  <span style={labelCss}>Nome da peça</span>
                                  <input style={control} value={p.title} onChange={(e) => patchPiece(p.tempId, { title: e.target.value })} placeholder="Digite o nome da peça" />
                                </label>
                                <label>
                                  <span style={labelCss}>Categoria</span>
                                  <select aria-label={`Categoria da peça ${idx + 1}`} style={{ ...control, cursor: 'pointer' }} value={p.category} onChange={(e) => patchPiece(p.tempId, { category: e.target.value })}>
                                    <option value="">Selecionar...</option>
                                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </label>
                                <label><span style={labelCss}>Quantidade</span><input style={control} value={p.tech.quantidade} onChange={(e) => patchPieceTech(p.tempId, 'quantidade', e.target.value)} /></label>
                                <label><span style={labelCss}>Metal</span><input style={control} value={p.tech.metal} onChange={(e) => patchPieceTech(p.tempId, 'metal', e.target.value)} placeholder="Ouro amarelo 18k" /></label>
                                <label><span style={labelCss}>Pedra</span><input style={control} value={p.tech.pedra} onChange={(e) => patchPieceTech(p.tempId, 'pedra', e.target.value)} placeholder="Diamante 0,30 ct" /></label>
                                <label><span style={labelCss}>Aro / medida</span><input style={control} value={p.tech.aroMedida} onChange={(e) => patchPieceTech(p.tempId, 'aroMedida', e.target.value)} placeholder="17" /></label>
                                <label><span style={labelCss}>Peso estimado</span><input style={control} value={p.tech.peso} onChange={(e) => patchPieceTech(p.tempId, 'peso', e.target.value)} placeholder="4,20 g" /></label>
                                <label><span style={labelCss}>Largura</span><input style={control} value={p.tech.largura} onChange={(e) => patchPieceTech(p.tempId, 'largura', e.target.value)} placeholder="2,2 mm" /></label>
                                <label><span style={labelCss}>Espessura</span><input style={control} value={p.tech.espessura} onChange={(e) => patchPieceTech(p.tempId, 'espessura', e.target.value)} placeholder="1,6 mm" /></label>
                                <label><span style={labelCss}>Acabamento</span><input style={control} value={p.tech.acabamento} onChange={(e) => patchPieceTech(p.tempId, 'acabamento', e.target.value)} placeholder="Polido" /></label>
                                <label><span style={labelCss}>Cor / banho</span><input style={control} value={p.tech.corBanho} onChange={(e) => patchPieceTech(p.tempId, 'corBanho', e.target.value)} placeholder="Ouro amarelo" /></label>
                                <label><span style={labelCss}>Cravação</span><input style={control} value={p.tech.cravacao} onChange={(e) => patchPieceTech(p.tempId, 'cravacao', e.target.value)} placeholder="Garra 6 pontas" /></label>
                                <label><span style={labelCss}>Gravação</span><input style={control} value={p.tech.gravacao} onChange={(e) => patchPieceTech(p.tempId, 'gravacao', e.target.value)} placeholder="M&L · 20.08.2026" /></label>
                                <label style={{ gridColumn: 'span 2' }}><span style={labelCss}>Referência / modelo</span><input style={control} value={p.tech.referencia} onChange={(e) => patchPieceTech(p.tempId, 'referencia', e.target.value)} placeholder="Solitário clássico, aro delicado" /></label>
                                <label style={{ gridColumn: '1 / -1' }}>
                                  <span style={labelCss}>Especificações técnicas</span>
                                  <textarea value={p.tech.especificacoes} onChange={(e) => patchPieceTech(p.tempId, 'especificacoes', e.target.value)} style={{ ...control, minHeight: '66px', resize: 'vertical', padding: '9px 11px', height: 'auto' }} />
                                </label>
                              </div>

                              {/* .subhead: MATERIAIS DESTA PECA + segmented */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '15px 0 8px', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '10px', color: V.secondary, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  Materiais desta peça
                                  <span style={{ color: V.gold, fontSize: '9px', fontWeight: 800, border: `1px solid ${V.goldBorder}`, background: V.goldDim, borderRadius: '999px', padding: '3px 7px', textTransform: 'none', letterSpacing: 'normal' }}>Obrigatório</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {([{ k: 'store', l: 'Estoque próprio · loja' }, { k: 'custody', l: 'Custódia · cliente' }] as const).map((seg) => {
                                    const segActive = activeMatTab === seg.k;
                                    return (
                                      <button key={seg.k} type="button" onClick={() => setPieceMatTab(p.tempId, seg.k)} style={{
                                        border: `1px solid ${segActive ? V.goldBorder : V.border}`, color: segActive ? V.gold : V.muted,
                                        background: segActive ? V.goldDim : 'transparent', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', cursor: 'pointer',
                                      }}>{seg.l}</button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div style={{ margin: '-2px 0 8px', color: V.gold, fontSize: '9px' }}>
                                Selecione a matéria-prima, metal, pedra ou material que será usado na fabricação desta peça.
                              </div>

                              {activeMatTab === 'store' ? (
                                <>
                                  {/* .material-source (estoque) */}
                                  <div style={{ border: `1px solid ${V.border}`, background: '#0D0D0F', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                                      <div>
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: V.text }}>Selecionar matéria-prima do estoque</div>
                                        <div style={{ marginTop: '4px', fontSize: '9px', lineHeight: 1.35, color: V.muted }}>Busca produtos, matéria-prima e pedras pelo cadastro real do estoque</div>
                                      </div>
                                      <span style={{ fontSize: '9px', color: V.green, flexShrink: 0 }}>● Estoque disponível</span>
                                    </div>
                                    {/* .search-line */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '7px' }}>
                                      <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '7px', color: V.muted, fontSize: '14px', pointerEvents: 'none' }}>⌕</span>
                                        <input
                                          style={{ ...control, paddingLeft: '29px' }}
                                          value={materialTarget === p.tempId ? materialSearch : ''}
                                          onFocus={() => setMaterialTarget(p.tempId)}
                                          onChange={(e) => { setMaterialTarget(p.tempId); setMaterialSearch(e.target.value); }}
                                          placeholder="Buscar ouro, prata, pedra, código ou descrição..."
                                        />
                                      </div>
                                      <button type="button" style={btnGoldSoft} onClick={() => { setMaterialTarget(p.tempId); setSearchNonce((n) => n + 1); }}>Buscar</button>
                                    </div>
                                    {/* .filter-row */}
                                    <div style={{ display: 'flex', gap: '5px', margin: '8px 0', flexWrap: 'wrap' }}>
                                      {STOCK_FILTERS.map((f) => {
                                        const fActive = stockFilter === f.key;
                                        return (
                                          <button key={f.key} type="button" onClick={() => { setStockFilter(f.key); setMaterialTarget(p.tempId); }} style={{
                                            border: `1px solid ${fActive ? V.goldBorder : V.border}`, background: fActive ? V.goldDim : V.elevated,
                                            color: fActive ? V.gold : V.muted, borderRadius: '20px', padding: '4px 8px', fontSize: '9px', cursor: 'pointer',
                                          }}>{f.label}</button>
                                        );
                                      })}
                                    </div>
                                    {/* resultados */}
                                    {materialTarget === p.tempId && searchError && (
                                      <div style={{ padding: '12px', textAlign: 'center', border: `1px dashed ${V.borderMid}`, borderRadius: '8px' }}>
                                        <div style={{ color: V.red, fontSize: '11px', marginBottom: '8px' }}>! {searchError}</div>
                                        <button type="button" style={btnDanger} onClick={() => setSearchNonce((n) => n + 1)}>Tentar novamente</button>
                                      </div>
                                    )}
                                    {materialTarget === p.tempId && !searchError && (
                                      <>
                                        {searching && <div style={{ color: V.muted, fontSize: '11px', padding: '4px 0' }}>Buscando...</div>}
                                        {!searching && !materialSearch.trim() && <div style={{ color: V.muted, fontSize: '10px', padding: '4px 0' }}>Digite para buscar no estoque.</div>}
                                        {!searching && materialSearch.trim() && searchResults.length === 0 && <div style={{ color: V.muted, fontSize: '11px', padding: '4px 0' }}>Nenhum produto encontrado.</div>}
                                        {!searching && searchResults.length > 0 && (
                                          /* .inventory-results 3 colunas */
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '6px' }}>
                                            {searchResults.map((product) => {
                                              const unit = product.is_raw_material ? 'g' : 'un';
                                              return (
                                                <div key={product.id} style={{ minWidth: 0, display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: '7px', alignItems: 'center', border: `1px solid ${V.border}`, background: V.surface, borderRadius: '7px', padding: '7px' }}>
                                                  <div style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '6px', background: V.goldDim, color: V.gold, fontSize: '12px' }}>{inventoryIcon(product)}</div>
                                                  <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '10px', fontWeight: 750, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                                                    <div style={{ fontSize: '8px', color: V.muted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.code}{typeof product.stock_quantity === 'number' ? ` · ${product.stock_quantity} ${unit} disponíveis` : ''}</div>
                                                  </div>
                                                  <button type="button" onClick={() => addOwnStockMaterial(p.tempId, product)} aria-label={`Adicionar ${product.name}`} style={{ width: '25px', height: '25px', border: `1px solid ${V.goldBorder}`, background: V.goldDim, color: V.gold, borderRadius: '5px', fontWeight: 800, cursor: 'pointer' }}>＋</button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </>
                                    )}
                                    {/* .material-feedback */}
                                    {feedback?.pieceId === p.tempId && (
                                      <div style={{ marginTop: '7px', padding: '7px 9px', border: '1px solid rgba(76,175,130,0.18)', background: 'rgba(76,175,130,0.06)', color: V.greenText, borderRadius: '6px', fontSize: '9px' }}>{feedback.msg}</div>
                                    )}
                                  </div>

                                  {/* .selected-label + .material-row (estoque) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: V.secondary, fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '9px 0 6px' }}>
                                    Materiais selecionados nesta peça
                                    <span style={{ flex: 1, height: '1px', background: V.border }} />
                                  </div>
                                  {storeMaterials.length === 0 && (
                                    <div style={{ fontSize: '10px', color: V.muted, padding: '4px 0 8px' }}>Nenhum material do estoque selecionado nesta peça.</div>
                                  )}
                                  {storeMaterials.map((m) => (
                                    <div key={m.tempId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) 88px 120px 28px', gap: '7px', alignItems: 'center', padding: '8px', background: V.elevated, border: `1px solid ${V.border}`, borderRadius: '7px', marginBottom: '6px' }}>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</div>
                                        <div style={{ color: V.muted, fontSize: '9px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.detail}</div>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', border: `1px solid ${V.border}`, background: V.strip, borderRadius: '5px', overflow: 'hidden' }}>
                                        <input aria-label={`Quantidade de ${m.label}`} inputMode="decimal" style={{ height: '29px', border: 0, background: 'transparent', color: V.text, textAlign: 'right', width: '100%', padding: '0 8px', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }} value={m.quantity} onChange={(e) => patchMaterial(p.tempId, m.tempId, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} />
                                        <span style={{ padding: '0 8px', color: V.gold, fontSize: '10px', fontWeight: 800, borderLeft: `1px solid ${V.border}` }}>{m.unit}</span>
                                      </div>
                                      <div style={{ fontSize: '10px', color: V.secondary, textAlign: 'right' }}>{brl(Math.round(qtyOf(m.quantity) * m.unitPriceCents))}</div>
                                      <button type="button" onClick={() => removeMaterial(p.tempId, m.tempId)} aria-label="Remover material" style={iconBtn}>×</button>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                /* .custody-box (roxa, como no mockup) */
                                <div style={{ padding: '10px', border: '1px solid rgba(156,111,222,0.22)', background: 'rgba(156,111,222,0.06)', borderRadius: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', fontWeight: 800, color: V.text }}>Material ou joia do cliente em custódia</div>
                                      <div style={{ marginTop: '4px', fontSize: '9px', lineHeight: 1.35, color: V.muted }}>Use um lote já recebido ou registre agora o item entregue pelo cliente</div>
                                    </div>
                                    <span style={{ fontSize: '9px', color: V.purpleLight, flexShrink: 0 }}>Patrimônio do cliente</span>
                                  </div>
                                  {/* .custody-tabs */}
                                  <div style={{ display: 'flex', gap: '5px', marginBottom: '9px' }}>
                                    {([{ k: 'existing', l: 'Selecionar custódia existente' }, { k: 'new', l: '＋ Adicionar material/joia' }] as const).map((ct) => {
                                      const ctActive = subTab === ct.k;
                                      return (
                                        <button key={ct.k} type="button" onClick={() => setCustodySubTab((prev) => ({ ...prev, [p.tempId]: ct.k }))} style={{
                                          flex: 1, minHeight: '31px', border: `1px solid rgba(156,111,222,${ctActive ? '0.38' : '0.22'})`,
                                          background: ctActive ? 'rgba(156,111,222,0.12)' : 'transparent',
                                          color: ctActive ? V.purpleLight : V.secondary, borderRadius: '6px', fontSize: '10px', cursor: 'pointer',
                                        }}>{ct.l}</button>
                                      );
                                    })}
                                  </div>
                                  {subTab === 'existing' ? (
                                    <div>
                                      <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '7px', color: V.muted, fontSize: '14px', pointerEvents: 'none' }}>⌕</span>
                                        <input style={{ ...control, paddingLeft: '29px' }} disabled placeholder="Buscar lote por material, descrição ou código..." />
                                      </div>
                                      <div style={{ marginTop: '8px', padding: '12px', textAlign: 'center', border: '1px dashed rgba(156,111,222,0.3)', borderRadius: '7px', color: V.secondary, fontSize: '10px', lineHeight: 1.5 }}>
                                        Nenhum lote de custódia disponível — o cadastro de lotes recebidos (avaliação/consignação) ainda não existe no sistema.
                                        Use <strong style={{ color: V.purpleLight }}>＋ Adicionar material/joia</strong> para registrar agora o item entregue pelo cliente.
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px' }}>
                                      <label>
                                        <span style={labelCss}>Tipo de item *</span>
                                        <select aria-label="Tipo de item em custódia" style={{ ...control, cursor: 'pointer' }} value={custodyForm.tipo} onChange={(e) => setCustodyForm((f) => ({ ...f, tipo: e.target.value }))}>
                                          <option>Metal / matéria-prima</option><option>Joia para derreter</option><option>Pedra / cristal</option><option>Sucata</option>
                                        </select>
                                      </label>
                                      <label><span style={labelCss}>Material / teor</span><input style={control} value={custodyForm.material} onChange={(e) => setCustodyForm((f) => ({ ...f, material: e.target.value }))} placeholder="Ex: Ouro 18k" /></label>
                                      <label><span style={labelCss}>Peso bruto *</span><input style={control} value={custodyForm.pesoBruto} onChange={(e) => setCustodyForm((f) => ({ ...f, pesoBruto: e.target.value }))} placeholder="0,00 g" /></label>
                                      <label><span style={labelCss}>Peso líquido *</span><input style={control} value={custodyForm.pesoLiquido} onChange={(e) => setCustodyForm((f) => ({ ...f, pesoLiquido: e.target.value }))} placeholder="0,00 g" /></label>
                                      <label style={{ gridColumn: 'span 2' }}><span style={labelCss}>Descrição da joia/material *</span><input style={control} value={custodyForm.descricao} onChange={(e) => setCustodyForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: cordão antigo com fecho quebrado" /></label>
                                      <label><span style={labelCss}>Valor de referência</span><input style={control} value={custodyForm.valorRef} onChange={(e) => setCustodyForm((f) => ({ ...f, valorRef: e.target.value }))} placeholder="R$ por g/un" /></label>
                                      <label><span style={labelCss}>Crédito negociado</span><input style={control} inputMode="numeric" value={custodyForm.creditoStr} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setCustodyForm((f) => ({ ...f, creditoStr: n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '' })); }} placeholder="R$ 0,00" /></label>
                                      <label style={{ gridColumn: 'span 2' }}>
                                        <span style={labelCss}>Observações do recebimento</span>
                                        <textarea value={custodyForm.observacoes} onChange={(e) => setCustodyForm((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Estado, marcas, avarias, acordo com o cliente..." style={{ ...control, minHeight: '66px', resize: 'vertical', padding: '9px 11px', height: 'auto' }} />
                                      </label>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={labelCss}>Fotos / evidências</span>
                                        <input ref={custodyFileRef} type="file" accept="image/*" multiple aria-label="Fotos do material recebido" style={{ display: 'none' }} onChange={(e) => { const names = Array.from(e.target.files ?? []).map((f) => f.name); setCustodyFiles((prev) => [...prev, ...names]); if (custodyFileRef.current) custodyFileRef.current.value = ''; }} />
                                        <button type="button" onClick={() => custodyFileRef.current?.click()} style={{ width: '100%', minHeight: '54px', border: '1px dashed rgba(156,111,222,0.3)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#B797E7', fontSize: '10px', background: 'rgba(156,111,222,0.035)', cursor: 'pointer' }}>
                                          ＋ {custodyFiles.length > 0 ? `${custodyFiles.length} foto(s) selecionada(s)` : 'Adicionar fotos do material recebido'}
                                        </button>
                                      </div>
                                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => registerCustodyMaterial(p.tempId)} style={btnGoldSoft}>Registrar em custódia e vincular à peça</button>
                                      </div>
                                    </div>
                                  )}

                                  {/* .selected-label + custody rows */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: V.secondary, fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '9px 0 6px' }}>
                                    Custódia vinculada à peça
                                    <span style={{ flex: 1, height: '1px', background: V.border }} />
                                  </div>
                                  {custodyMaterials.length === 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '7px', alignItems: 'center', padding: '8px', background: V.elevated, border: `1px solid ${V.border}`, borderRadius: '7px' }}>
                                      <div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: V.text }}>Nenhum material de custódia selecionado</div>
                                        <div style={{ color: V.muted, fontSize: '9px', marginTop: '2px' }}>Selecione um lote existente ou registre um novo recebimento</div>
                                      </div>
                                      <div style={{ fontSize: '10px', color: V.purple }}>Crédito: —</div>
                                    </div>
                                  ) : custodyMaterials.map((m) => (
                                    <div key={m.tempId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) 88px 120px 28px', gap: '7px', alignItems: 'center', padding: '8px', background: V.elevated, border: '1px solid rgba(156,111,222,0.22)', borderRadius: '7px', marginBottom: '6px' }}>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</div>
                                        <div style={{ color: V.muted, fontSize: '9px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.detail}</div>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', border: `1px solid ${V.border}`, background: V.strip, borderRadius: '5px', overflow: 'hidden' }}>
                                        <input aria-label={`Quantidade de ${m.label}`} inputMode="decimal" style={{ height: '29px', border: 0, background: 'transparent', color: V.text, textAlign: 'right', width: '100%', padding: '0 8px', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }} value={m.quantity} onChange={(e) => patchMaterial(p.tempId, m.tempId, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} />
                                        <span style={{ padding: '0 8px', color: V.purpleLight, fontSize: '10px', fontWeight: 800, borderLeft: `1px solid ${V.border}` }}>{m.unit}</span>
                                      </div>
                                      <div style={{ fontSize: '10px', color: V.purple, textAlign: 'right' }}>{m.creditCents > 0 ? `Crédito: ${brl(m.creditCents)}` : 'Crédito: pendente'}</div>
                                      <button type="button" onClick={() => removeMaterial(p.tempId, m.tempId)} aria-label="Remover material" style={iconBtn}>×</button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* .piece-actions */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '7px', marginTop: '12px' }}>
                                <button type="button" onClick={() => removePiece(p.tempId)} style={btnDanger}>Remover peça</button>
                                <button type="button" onClick={() => duplicatePiece(p.tempId)} style={btn}>Duplicar</button>
                                <button type="button" onClick={() => patchPiece(p.tempId, { collapsed: true })} style={btnGoldSoft}>Salvar e recolher peça</button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  {/* .add-piece */}
                  <button type="button" onClick={addPiece} style={{ width: '100%', marginTop: '9px', minHeight: '45px', border: `1px dashed ${V.goldBorder}`, background: 'rgba(191,160,106,0.035)', color: V.gold, borderRadius: '8px', fontSize: '11px', fontWeight: 750, cursor: 'pointer' }}>
                    ＋ Nova peça neste projeto
                  </button>

                  {/* .proposal-alert */}
                  {piecesMissingMaterial.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '10px', padding: '9px 10px', border: `1px solid ${V.goldBorder}`, background: V.goldDim, color: V.gold, borderRadius: '7px', fontSize: '10px', lineHeight: 1.45 }}>
                      <span>!</span>
                      <span>Existe peça sem material selecionado. Selecione a matéria-prima/material obrigatório antes de gerar a proposta.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div style={{ margin: '0 18px 14px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', padding: '10px 12px', color: V.red, fontSize: '12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* .quote-summary-bar (fixo acima do rodape, so na Cotacao) */}
        {tab === 'cotacao' && !locked && pieces.length > 0 && (
          <div style={{ flexShrink: 0, padding: '10px 18px', borderTop: `1px solid ${V.border}`, background: '#101012' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,0.6fr)', gap: '12px' }}>
              {/* Pecas anexadas a proposta */}
              <div style={{ border: `1px solid ${V.border}`, background: V.surface, borderRadius: '9px', padding: '12px' }}>
                <div style={{ fontSize: '10px', color: V.secondary, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '8px' }}>Peças anexadas à proposta</div>
                <div style={{ maxHeight: '96px', overflowY: 'auto' }}>
                  {pieces.map((p, idx) => (
                    <div key={p.tempId} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: `1px solid ${V.border}`, fontSize: '11px', color: V.secondary }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idx + 1}. {p.title || 'Nova peça sem título'}</span>
                      <span style={{ color: V.text, fontWeight: 700, flexShrink: 0 }}>{brl(piecePriceCents(p))}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', border: '1px solid rgba(76,175,130,0.18)', background: 'rgba(76,175,130,0.06)', color: V.greenText, padding: '7px 9px', borderRadius: '7px', fontSize: '10px', lineHeight: 1.45, marginTop: '10px' }}>
                  <span>✓</span>
                  <span>Ao gerar, a proposta salva uma versão destas peças. Alterações posteriores na OS não modificam a proposta já enviada.</span>
                </div>
              </div>
              {/* Resumo comercial */}
              <div style={{ border: `1px solid ${V.border}`, background: V.surface, borderRadius: '9px', padding: '12px' }}>
                <div style={{ fontSize: '10px', color: V.secondary, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '8px' }}>Resumo comercial</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: V.secondary, fontSize: '10px', padding: '3px 0' }}>
                  <span>Subtotal das peças</span><strong style={{ color: V.text }}>{brl(subtotalCents)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', color: V.secondary, fontSize: '10px', padding: '3px 0' }}>
                  <span>Crédito material cliente</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <strong style={{ color: V.purple }}>−</strong>
                    <input aria-label="Crédito material do cliente" style={{ ...control, minHeight: '26px', height: '26px', width: '96px', textAlign: 'right', color: V.purpleLight, fontSize: '10px', padding: '0 8px' }} inputMode="numeric" value={customerCreditStr} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setCustomerCreditStr(n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''); }} placeholder="0,00" />
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: V.secondary, fontSize: '10px', padding: '3px 0' }}>
                  <span>Sinal sugerido (50%)</span><strong style={{ color: V.text }}>{brl(sinalCents)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${V.goldBorder}`, marginTop: '8px', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: V.secondary }}>Total da proposta</span>
                  <strong style={{ fontFamily: 'Georgia, serif', color: V.gold, fontSize: '21px' }}>{brl(totalCents)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* .modal-foot */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${V.border}`, background: V.strip }}>
          <span style={{ color: V.muted, fontSize: '10px' }}>{footStatus}</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={btn}>Cancelar</button>
          {tab === 'notes' ? (
            <>
              <button type="button" style={btnBlue} onClick={() => notify.success('Anotações salvas', 'Rascunho do atendimento (local)')}>Salvar anotações</button>
              <button type="button" style={btnGold} onClick={() => setTab('cotacao')}>Ir para cotação →</button>
            </>
          ) : (
            <>
              <button type="button" style={btnBlue} onClick={() => notify.success('Cotação salva', 'Rascunho técnico/comercial (local)')}>Salvar cotação</button>
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={saving}
                style={{ ...btnGold, opacity: canGenerate && !saving ? 1 : 0.45, cursor: canGenerate && !saving ? 'pointer' : 'not-allowed' }}
              >
                Gerar Proposta
              </button>
            </>
          )}
        </div>
      </div>

      {/* .proposal-preview */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Prévia da proposta"
          style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.74)', padding: '24px', zIndex: 1100 }}
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowPreview(false); }}
        >
          <div style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflow: 'auto', background: V.base, border: `1px solid ${V.goldBorder}`, borderRadius: '12px', boxShadow: '0 30px 100px #000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '18px 20px', borderBottom: `1px solid ${V.border}` }}>
              <div>
                <div style={{ color: V.gold, fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>PRÉVIA · AINDA NÃO SALVA</div>
                <h2 style={{ fontFamily: 'Georgia, serif', margin: '4px 0 0', fontSize: '19px', color: V.text }}>{project.title ? `Proposta — ${project.title}` : 'Proposta multi-peças'}</h2>
              </div>
              <button type="button" onClick={() => setShowPreview(false)} aria-label="Fechar prévia" style={{ width: '28px', height: '28px', border: 0, background: 'transparent', color: V.muted, fontSize: '17px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '10px', color: V.secondary, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '8px' }}>Itens da proposta</div>
              {pieces.map((p, idx) => (
                <div key={p.tempId} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: '10px', alignItems: 'center', border: `1px solid ${V.border}`, background: V.surface, borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', borderRadius: '7px', background: V.goldDim, border: `1px solid ${V.goldBorder}`, color: V.gold, fontFamily: 'Georgia, serif', fontWeight: 800 }}>{idx + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 750, color: V.text }}>{p.title || `Peça ${idx + 1}`}</div>
                    <div style={{ fontSize: '10px', color: V.muted, marginTop: '3px' }}>{[p.category, p.tech.metal, p.tech.pedra, p.tech.gravacao && 'gravação'].filter(Boolean).join(' · ') || 'Ficha técnica em rascunho'}</div>
                  </div>
                  <strong style={{ color: V.gold, fontFamily: 'Georgia, serif' }}>{brl(piecePriceCents(p))}</strong>
                </div>
              ))}
              <div style={{ border: `1px solid ${V.border}`, background: V.surface, borderRadius: '9px', padding: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: V.secondary, fontSize: '10px', padding: '3px 0' }}>
                  <span>Subtotal das peças</span><strong style={{ color: V.text }}>{brl(subtotalCents)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: V.secondary, fontSize: '10px', padding: '3px 0' }}>
                  <span>Crédito negociado</span><strong style={{ color: V.purple }}>− {brl(customerCreditCents)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${V.goldBorder}`, marginTop: '8px', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: V.secondary }}>Total da proposta</span>
                  <strong style={{ fontFamily: 'Georgia, serif', color: V.gold, fontSize: '21px' }}>{brl(totalCents)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', border: '1px solid rgba(76,175,130,0.18)', background: 'rgba(76,175,130,0.06)', color: V.greenText, padding: '9px 10px', borderRadius: '7px', fontSize: '10px', lineHeight: 1.45, marginTop: '10px' }}>
                <span>→</span>
                <span>Depois de salva, esta proposta aparecerá na aba <strong>Propostas</strong>. Envio por PDF/WhatsApp/e-mail e “Fazer venda” são etapas posteriores.</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: `1px solid ${V.border}` }}>
              <button type="button" onClick={() => setShowPreview(false)} disabled={saving} style={btn}>Voltar e editar</button>
              <button type="button" onClick={handleConfirmProposal} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Gerando...' : 'Confirmar geração da proposta'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
