'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Product {
  id: string; code: string; name: string;
  category: string | null; collection: string | null; description: string | null;
  price_cents: number; cost_price_cents: number;
  stock_quantity: number; minimum_stock: number;
  metal: string | null; weight_grams: number | null;
  location: string | null; size_info: string | null; stones: string | null;
  photo_url: string | null; is_active: boolean; pdv_enabled: boolean;
  requires_production: boolean; is_low_stock: boolean;
  created_at: string; updated_at: string;
}

interface StockMovement {
  id: string; type: string; quantity: number;
  previous_stock: number; new_stock: number;
  reason: string; notes: string | null;
  created_at: string; created_by: { id: string; name: string };
}

interface Stats { active: number; critical: number; out_of_stock: number; total_cost_cents: number; }
interface Meta { total: number; page: number; limit: number; pages: number; }

interface EstoqueClientProps {
  initialProducts: Product[];
  initialMeta: Meta;
  initialStats: Stats;
}

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const fmtShortDate = (d: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(d));
const fmtWeight = (g: number | null) => g != null ? `${g}g` : '—';

function stockStatus(p: Product): 'ok' | 'low' | 'out' {
  if (p.stock_quantity === 0) return 'out';
  if (p.stock_quantity <= p.minimum_stock) return 'low';
  return 'ok';
}

const CATEGORIES = ['Anel', 'Colar', 'Brinco', 'Pulseira', 'Outro'];
const METALS = ['Ouro 18k', 'Ouro 14k', 'Prata 925', 'Aço', 'Ouro Rosé', 'Outro'];

const inp = 'w-full bg-[#202026] border border-white/[0.07] rounded-lg px-3 text-sm text-[#EDE8E0] outline-none transition-colors placeholder:text-[#4A4A52]';
const inpH = 'h-[38px]';
const lbl = 'block text-[11px] font-semibold text-[#888480] tracking-wide mb-1';
const btnGold = 'h-9 px-4 rounded-lg bg-[#C8A97A] text-black text-xs font-bold hover:bg-[#E8D5B0] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
const btnGhost = 'h-9 px-3 rounded-lg bg-[#18181C] border border-white/[0.07] text-[#888480] text-xs font-semibold hover:border-white/[0.11] hover:text-[#EDE8E0] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';

// ── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ product, onClose, onSaved, showToast }: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [saving, setSaving] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.photo_url ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const codeTimer = useRef<ReturnType<typeof setTimeout>>();

  const [f, setF] = useState({
    code: product?.code ?? '',
    name: product?.name ?? '',
    category: product?.category ?? '',
    collection: product?.collection ?? '',
    description: product?.description ?? '',
    price: product ? String(product.price_cents / 100) : '',
    cost: product ? String(product.cost_price_cents / 100) : '',
    stock_quantity: product ? String(product.stock_quantity) : '0',
    minimum_stock: product ? String(product.minimum_stock) : '5',
    location: product?.location ?? '',
    metal: product?.metal ?? '',
    weight_grams: product?.weight_grams ? String(product.weight_grams) : '',
    size_info: product?.size_info ?? '',
    stones: product?.stones ?? '',
    is_active: product?.is_active ?? true,
    pdv_enabled: product?.pdv_enabled ?? true,
    requires_production: product?.requires_production ?? false,
  });

  const set = (k: keyof typeof f, v: string | boolean) => setF(prev => ({ ...prev, [k]: v }));

  const priceNum = parseFloat(f.price) || 0;
  const costNum = parseFloat(f.cost) || 0;
  const margin = priceNum > 0 ? ((priceNum - costNum) / priceNum * 100).toFixed(1) : null;
  const stockQty = parseInt(f.stock_quantity) || 0;
  const minStock = parseInt(f.minimum_stock) || 0;
  const previewSt = stockQty === 0 ? 'out' : stockQty <= minStock ? 'low' : 'ok';

  const checkCode = (code: string) => {
    clearTimeout(codeTimer.current);
    if (code.length < 2) { setCodeStatus('idle'); return; }
    setCodeStatus('checking');
    codeTimer.current = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ code });
        if (product?.id) qs.set('exclude_id', product.id);
        const res = await fetch(`/api/internal/products/check-code?${qs.toString()}`);
        if (res.ok) { const d = await res.json(); setCodeStatus(d.available ? 'ok' : 'taken'); }
      } catch { setCodeStatus('idle'); }
    }, 400);
  };

  const handlePhotoFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { showToast('Arquivo maior que 5MB', 'error'); return; }
    setPendingPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!f.code || !f.name || priceNum <= 0) { showToast('Preencha código, nome e preço', 'error'); return; }
    if (codeStatus === 'taken') { showToast('Código já em uso', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        code: f.code, name: f.name,
        category: f.category || undefined, collection: f.collection || undefined,
        description: f.description || undefined,
        price_cents: Math.round(priceNum * 100),
        cost_price_cents: Math.round(costNum * 100),
        stock_quantity: stockQty, minimum_stock: minStock,
        location: f.location || undefined, metal: f.metal || undefined,
        weight_grams: f.weight_grams ? parseFloat(f.weight_grams) : undefined,
        size_info: f.size_info || undefined, stones: f.stones || undefined,
        is_active: f.is_active, pdv_enabled: f.pdv_enabled, requires_production: f.requires_production,
      };
      const url = product ? `/api/internal/products/${product.id}` : '/api/internal/products';
      const res = await fetch(url, { method: product ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Erro ao salvar'); }
      const saved = await res.json();
      if (pendingPhoto && saved.id) {
        const fd = new FormData(); fd.append('photo', pendingPhoto);
        await fetch(`/api/internal/products/${saved.id}/photo`, { method: 'POST', body: fd });
      }
      onSaved();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error'); }
    finally { setSaving(false); }
  };

  const ic = `${inp} ${inpH} focus:border-[rgba(200,169,122,0.5)]`;
  const sc = 'text-[10px] font-bold uppercase tracking-[0.7px] text-[#4A4A52] mb-3 pb-1.5 border-b border-white/[0.07]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: 720, maxWidth: '100%', maxHeight: '92vh', background: '#18181C', border: '1px solid rgba(255,255,255,0.11)' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 700 }}>{product ? 'Editar Produto' : 'Novo Produto'}</div>
            <div className="text-[12px] mt-0.5" style={{ color: '#4A4A52' }}>Preencha as informações do produto</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#4A4A52', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>
          {/* Foto */}
          <div>
            <div className={sc}>Foto do Produto</div>
            <div className="flex items-center gap-4 p-5 rounded-[10px] cursor-pointer transition-all" style={{ border: '2px dashed rgba(255,255,255,0.11)', background: '#202026' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const fl = e.dataTransfer.files[0]; if (fl) handlePhotoFile(fl); }}>
              <div className="w-[72px] h-[72px] rounded-[10px] flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden" style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)' }}>
                {photoPreview ? <img src={photoPreview} alt="" className="w-full h-full object-cover rounded-[10px]" /> : '📷'}
              </div>
              <div>
                <div className="text-[13px] font-semibold mb-1">Clique ou arraste uma foto</div>
                <div className="text-[11px]" style={{ color: '#4A4A52' }}>PNG, JPG ou WebP — máx. 5MB</div>
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Upload foto do produto" onChange={e => { const fl = e.target.files?.[0]; if (fl) handlePhotoFile(fl); }} />
            </div>
          </div>

          {/* Identificação */}
          <div>
            <div className={sc}>Identificação</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Código Interno *</label>
                <input className={`${ic} ${codeStatus === 'taken' ? '!border-[#E05252]' : codeStatus === 'ok' ? '!border-[#4CAF82]' : ''}`}
                  value={f.code} onChange={e => { set('code', e.target.value); checkCode(e.target.value); }} placeholder="ex: AN-0042" />
                {codeStatus === 'taken' && <div className="text-[10px] mt-1" style={{ color: '#E05252' }}>Código já em uso</div>}
                {codeStatus === 'ok' && <div className="text-[10px] mt-1" style={{ color: '#4CAF82' }}>Código disponível</div>}
              </div>
              <div>
                <label className={lbl}>Nome do Produto *</label>
                <input className={ic} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Nome do produto" />
              </div>
              <div>
                <label className={lbl}>Categoria</label>
                <select title="Categoria" className={`${inp} ${inpH} focus:border-[rgba(200,169,122,0.5)]`} value={f.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Coleção</label>
                <input className={ic} value={f.collection} onChange={e => set('collection', e.target.value)} placeholder="Coleção" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Descrição Interna</label>
                <textarea className={`${inp} focus:border-[rgba(200,169,122,0.5)] py-2.5 resize-y`} rows={3} value={f.description} onChange={e => set('description', e.target.value)} placeholder="Não exibida ao cliente" />
              </div>
            </div>
          </div>

          {/* Precificação */}
          <div>
            <div className={sc}>Precificação</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Preço de Venda (R$) *</label>
                <input className={ic} type="number" min="0.01" step="0.01" value={f.price} onChange={e => set('price', e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className={lbl}>Custo de Aquisição (R$)</label>
                <input className={ic} type="number" min="0" step="0.01" value={f.cost} onChange={e => set('cost', e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className={lbl}>Margem Estimada</label>
                <div className="h-[38px] flex items-center px-3 rounded-lg text-sm font-semibold"
                  style={{ background: '#202026', border: '1px solid rgba(255,255,255,0.07)', color: margin != null && parseFloat(margin) >= 0 ? '#4CAF82' : '#E05252' }}>
                  {margin != null ? `${margin}%` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Estoque */}
          <div>
            <div className={sc}>Estoque</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className={lbl}>{product ? 'Estoque Atual' : 'Estoque Inicial'} *</label>
                <input className={ic} type="number" min="0" step="1" value={f.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>Estoque Mínimo</label>
                <input className={ic} type="number" min="0" step="1" value={f.minimum_stock} onChange={e => set('minimum_stock', e.target.value)} placeholder="5" />
              </div>
              <div>
                <label className={lbl}>Localização</label>
                <input className={ic} value={f.location} onChange={e => set('location', e.target.value)} placeholder="ex: Vitrine A3" />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-3 rounded-lg" style={{ background: '#202026', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[11px]" style={{ color: '#4A4A52' }}>Status preview</span>
              <span className="text-[13px] font-bold" style={{ fontFamily: 'Playfair Display, serif', color: previewSt === 'ok' ? '#4CAF82' : previewSt === 'low' ? '#F0A040' : '#E05252' }}>
                {previewSt === 'ok' ? '● Em estoque' : previewSt === 'low' ? '⚠ Crítico' : '✕ Sem estoque'} ({stockQty} un.)
              </span>
            </div>
          </div>

          {/* Especificações */}
          <div>
            <div className={sc}>Especificações</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Metal / Material</label>
                <select title="Metal / Material" className={`${inp} ${inpH} focus:border-[rgba(200,169,122,0.5)]`} value={f.metal} onChange={e => set('metal', e.target.value)}>
                  <option value="">Selecionar...</option>
                  {METALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Peso (g)</label>
                <input className={ic} type="number" min="0.01" step="0.01" value={f.weight_grams} onChange={e => set('weight_grams', e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className={lbl}>Tamanho / Medida</label>
                <input className={ic} value={f.size_info} onChange={e => set('size_info', e.target.value)} placeholder="ex: Aro 18" />
              </div>
              <div>
                <label className={lbl}>Pedras / Cravação</label>
                <input className={ic} value={f.stones} onChange={e => set('stones', e.target.value)} placeholder="ex: Diamante 0.10ct" />
              </div>
            </div>
          </div>

          {/* Flags */}
          <div>
            <div className={sc}>Configurações</div>
            <div className="space-y-2.5">
              {([['is_active', 'Produto ativo'], ['pdv_enabled', 'Disponível no PDV'], ['requires_production', 'Requer produção']] as [keyof typeof f, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={f[key] as boolean} onChange={e => set(key, e.target.checked)} style={{ accentColor: '#C8A97A', width: 14, height: 14 }} />
                  <span className="text-[13px] font-medium" style={{ color: '#888480' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-3.5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#18181C' }}>
          <div className="text-[11px]" style={{ color: '#4A4A52' }}>* Campos obrigatórios</div>
          <div className="flex gap-2">
            <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#888480', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={saving} style={{ height: 38, padding: '0 20px', borderRadius: 8, background: '#C8A97A', border: 'none', color: '#000', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Salvando...' : product ? 'Salvar alterações' : 'Cadastrar Produto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Adjust Modal ──────────────────────────────────────────────────────────────
function AdjustModal({ product, onClose, onSaved, showToast }: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [type, setType] = useState('ENTRADA');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isAbsolute, setIsAbsolute] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!qty || parseInt(qty) < 1) { showToast('Informe uma quantidade válida', 'error'); return; }
    if (!reason.trim()) { showToast('Motivo é obrigatório', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/internal/products/${product.id}/movements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: parseInt(qty), reason, notes: notes || undefined, is_absolute: type === 'AJUSTE' ? isAbsolute : undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Erro'); }
      onSaved();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erro ao ajustar', 'error'); }
    finally { setSaving(false); }
  };

  const ic = `${inp} ${inpH} focus:border-[rgba(200,169,122,0.5)]`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: 480, maxWidth: '100%', background: '#18181C', border: '1px solid rgba(255,255,255,0.11)' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 700 }}>Ajuste de Estoque</div>
            <div className="text-[12px] mt-0.5" style={{ color: '#4A4A52' }}>{product.name} — atual: {product.stock_quantity} un.</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#4A4A52', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo *</label>
              <select title="Tipo de movimentação" className={`${inp} ${inpH} focus:border-[rgba(200,169,122,0.5)]`} value={type} onChange={e => setType(e.target.value)}>
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="PERDA">Perda</option>
                <option value="DEVOLUCAO">Devolução</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Quantidade *</label>
              <input className={ic} type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
          </div>
          {type === 'AJUSTE' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAbsolute} onChange={e => setIsAbsolute(e.target.checked)} style={{ accentColor: '#C8A97A', width: 14, height: 14 }} />
              <span className="text-[13px]" style={{ color: '#888480' }}>Definir quantidade exata (absoluta)</span>
            </label>
          )}
          <div>
            <label className={lbl}>Motivo *</label>
            <input className={ic} value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo do ajuste" />
          </div>
          <div>
            <label className={lbl}>Observação</label>
            <textarea className={`${inp} focus:border-[rgba(200,169,122,0.5)] py-2.5 resize-none`} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observação opcional" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#18181C' }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#888480', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} style={{ height: 38, padding: '0 20px', borderRadius: 8, background: '#C8A97A', border: 'none', color: '#000', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Registrar Ajuste'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EstoqueClient({ initialProducts, initialMeta, initialStats }: EstoqueClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [meta, setMeta] = useState(initialMeta);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('updated_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailMovements, setDetailMovements] = useState<StockMovement[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async (overrides: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ sort, dir, page: String(page), limit: '20' });
      if (search) qs.set('q', search);
      if (category) qs.set('category', category);
      if (status) qs.set('status', status);
      for (const [k, v] of Object.entries(overrides)) { if (v) qs.set(k, v); else qs.delete(k); }

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/internal/products?${qs.toString()}`),
        fetch('/api/internal/products/stats'),
      ]);
      if (!listRes.ok) throw new Error('Erro ao carregar');
      const [listData, statsData] = await Promise.all([listRes.json(), statsRes.json()]);
      setProducts(listData.data);
      setMeta(listData.meta);
      setStats(statsData);
      setSelected(new Set());
    } catch { showToast('Erro ao carregar produtos', 'error'); }
    finally { setLoading(false); }
  }, [search, category, status, sort, dir, page, showToast]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      const qs = new URLSearchParams({ sort, dir, page: '1', limit: '20' });
      if (v) qs.set('q', v);
      if (category) qs.set('category', category);
      if (status) qs.set('status', status);
      setLoading(true);
      Promise.all([fetch(`/api/internal/products?${qs}`), fetch('/api/internal/products/stats')])
        .then(async ([lr, sr]) => {
          const [ld, sd] = await Promise.all([lr.json(), sr.json()]);
          setProducts(ld.data); setMeta(ld.meta); setStats(sd); setSelected(new Set());
        })
        .catch(() => showToast('Erro ao buscar', 'error'))
        .finally(() => setLoading(false));
    }, 300);
  };

  const applyFilter = (cat: string, st: string) => {
    setCategory(cat); setStatus(st); setPage(1);
    const qs = new URLSearchParams({ sort, dir, page: '1', limit: '20' });
    if (search) qs.set('q', search);
    if (cat) qs.set('category', cat);
    if (st) qs.set('status', st);
    setLoading(true);
    Promise.all([fetch(`/api/internal/products?${qs}`), fetch('/api/internal/products/stats')])
      .then(async ([lr, sr]) => {
        const [ld, sd] = await Promise.all([lr.json(), sr.json()]);
        setProducts(ld.data); setMeta(ld.meta); setStats(sd); setSelected(new Set());
      })
      .catch(() => showToast('Erro', 'error'))
      .finally(() => setLoading(false));
  };

  const handleSort = (col: string) => {
    const nd = sort === col && dir === 'desc' ? 'asc' : 'desc';
    setSort(col); setDir(nd);
    const qs = new URLSearchParams({ sort: col, dir: nd, page: String(page), limit: '20' });
    if (search) qs.set('q', search);
    if (category) qs.set('category', category);
    if (status) qs.set('status', status);
    setLoading(true);
    fetch(`/api/internal/products?${qs}`)
      .then(r => r.json()).then(d => { setProducts(d.data); setMeta(d.meta); setSelected(new Set()); })
      .catch(() => showToast('Erro', 'error'))
      .finally(() => setLoading(false));
  };

  const handlePage = (p: number) => {
    setPage(p);
    const qs = new URLSearchParams({ sort, dir, page: String(p), limit: '20' });
    if (search) qs.set('q', search);
    if (category) qs.set('category', category);
    if (status) qs.set('status', status);
    setLoading(true);
    fetch(`/api/internal/products?${qs}`)
      .then(r => r.json()).then(d => { setProducts(d.data); setMeta(d.meta); setSelected(new Set()); })
      .catch(() => showToast('Erro', 'error'))
      .finally(() => setLoading(false));
  };

  const openDetail = async (p: Product) => {
    setDetailProduct(p); setDetailMovements([]); setDetailLoading(true);
    try {
      const res = await fetch(`/api/internal/products/${p.id}/movements?limit=5`);
      if (res.ok) { const d = await res.json(); setDetailMovements(d.data); }
    } finally { setDetailLoading(false); }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleAll = () => {
    setSelected(selected.size === products.length && products.length > 0 ? new Set() : new Set(products.map(p => p.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Desativar ${selected.size} produto(s)?`)) return;
    try {
      await Promise.all([...selected].map(id => fetch(`/api/internal/products/${id}`, { method: 'DELETE' })));
      showToast(`${selected.size} produto(s) desativado(s)`);
      void fetchData();
    } catch { showToast('Erro ao excluir', 'error'); }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/internal/products/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'estoque.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { showToast('Erro ao exportar CSV', 'error'); }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const res = await fetch('/api/internal/products/import', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'Erro');
      showToast(`Importado: ${d.imported} produto(s)${d.errors?.length ? `, ${d.errors.length} erro(s)` : ''}`);
      void fetchData();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erro ao importar', 'error'); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowCreate(false); setEditProduct(null); setAdjustProduct(null); setDetailProduct(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const sortable = ['name', 'stock_quantity', 'price_cents', 'updated_at'];

  return (
    <div style={{ background: '#0A0A0B', color: '#EDE8E0', minHeight: '100%', fontFamily: 'Inter, sans-serif' }}>
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3 p-6 pb-4">
        {[
          { label: 'Produtos Ativos', value: stats.active, sub: 'Disponíveis para venda', color: '#4CAF82' },
          { label: 'Estoque Crítico', value: stats.critical, sub: 'Abaixo do mínimo', color: '#F0A040' },
          { label: 'Sem Estoque', value: stats.out_of_stock, sub: 'Ruptura — reposição urgente', color: '#E05252' },
          { label: 'Valor em Estoque', value: fmtCurrency(stats.total_cost_cents), sub: 'Custo total × quantidade', color: '#4A9EFF' },
        ].map(k => (
          <div key={k.label} className="relative rounded-[10px] overflow-hidden" style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: k.color }} />
            <div className="text-[10px] font-semibold uppercase tracking-[0.6px] mb-1.5" style={{ color: '#4A4A52' }}>{k.label}</div>
            <div className="text-[22px] font-bold" style={{ fontFamily: 'Playfair Display, serif', color: k.color }}>{k.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: '#4A4A52' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-6 pb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none" style={{ color: '#4A4A52' }}>🔍</span>
            <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Buscar por nome ou código..."
              className="h-9 pl-8 pr-3 rounded-lg text-[13px] outline-none transition-colors placeholder:text-[#4A4A52]"
              style={{ width: 220, background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#EDE8E0' }} />
          </div>
          <select title="Filtrar por categoria" value={category} onChange={e => applyFilter(e.target.value, status)}
            className="h-9 px-3 rounded-lg text-[12px] outline-none cursor-pointer"
            style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#888480' }}>
            <option value="">Todas as categorias</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select title="Filtrar por status" value={status} onChange={e => applyFilter(category, e.target.value)}
            className="h-9 px-3 rounded-lg text-[12px] outline-none cursor-pointer"
            style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#888480' }}>
            <option value="">Todos os status</option>
            <option value="in_stock">Em estoque</option>
            <option value="critical">Estoque crítico</option>
            <option value="out_of_stock">Sem estoque</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleExport} className={btnGhost}>↑ Exportar CSV</button>
          <label className={`${btnGhost} !cursor-pointer`}>
            ↓ Importar CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
          </label>
          <button onClick={() => setShowCreate(true)} className={btnGold}>+ Adicionar Produto</button>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-6">
        <div className="flex flex-col rounded-xl overflow-hidden" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: '#18181C', borderBottom: '1px solid rgba(255,255,255,0.11)' }}>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" aria-label="Selecionar todos" checked={selected.size === products.length && products.length > 0} onChange={toggleAll}
                      style={{ accentColor: '#C8A97A', width: 15, height: 15, cursor: 'pointer' }} />
                  </th>
                  {[
                    { key: 'name', label: 'Produto' }, { key: 'code', label: 'SKU / Código' },
                    { key: 'category', label: 'Categoria' }, { key: 'stock_quantity', label: 'Estoque' },
                    { key: 'minimum_stock', label: 'Mínimo' }, { key: 'metal', label: 'Metal' },
                    { key: 'weight', label: 'Peso' }, { key: 'price_cents', label: 'Preço' },
                    { key: 'status', label: 'Status' }, { key: 'updated_at', label: 'Atualizado' },
                  ].map(col => (
                    <th key={col.key} onClick={() => sortable.includes(col.key) ? handleSort(col.key) : undefined}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] select-none whitespace-nowrap"
                      style={{ color: sort === col.key ? '#C8A97A' : '#4A4A52', cursor: sortable.includes(col.key) ? 'pointer' : 'default' }}>
                      {col.label}
                      {sortable.includes(col.key) && <span style={{ marginLeft: 4, opacity: sort === col.key ? 1 : 0.4 }}>{sort === col.key ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <td colSpan={11} className="px-3 py-3"><div className="h-4 rounded animate-pulse" style={{ background: '#202026' }} /></td>
                  </tr>
                )) : products.length === 0 ? (
                  <tr><td colSpan={11} className="py-16 text-center">
                    <div className="text-4xl mb-3">📦</div>
                    <div className="text-sm" style={{ color: '#4A4A52' }}>Nenhum produto encontrado</div>
                    {(search || category || status) && (
                      <button onClick={() => { setSearch(''); setCategory(''); setStatus(''); void fetchData({}); }}
                        style={{ color: '#C8A97A', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginTop: 8, textDecoration: 'underline' }}>
                        Limpar filtros
                      </button>
                    )}
                  </td></tr>
                ) : products.map(p => {
                  const st = stockStatus(p);
                  const isSel = selected.has(p.id);
                  return (
                    <tr key={p.id} onClick={() => openDetail(p)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: isSel ? 'rgba(200,169,122,0.08)' : undefined, borderLeft: isSel ? '2px solid #C8A97A' : '2px solid transparent', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? 'rgba(200,169,122,0.08)' : ''; }}>
                      <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={isSel} onClick={e => toggleSelect(p.id, e)} onChange={() => {}} style={{ accentColor: '#C8A97A', width: 15, height: 15, cursor: 'pointer' }} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[38px] h-[38px] rounded-[7px] flex items-center justify-center text-lg flex-shrink-0 overflow-hidden" style={{ background: '#202026', border: '1px solid rgba(255,255,255,0.07)' }}>
                            {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : '💍'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold truncate max-w-[160px]" style={{ color: '#EDE8E0' }}>{p.name}</div>
                            <div className="text-[11px]" style={{ color: '#4A4A52' }}>{p.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: '#888480' }}>{p.code}</td>
                      <td className="px-3 py-2.5">{p.category
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-semibold" style={{ background: 'rgba(74,158,255,0.12)', color: '#4A9EFF' }}>{p.category}</span>
                        : <span style={{ color: '#4A4A52' }}>—</span>}</td>
                      <td className="px-3 py-2.5"><span className="text-[13px] font-bold" style={{ color: st === 'ok' ? '#EDE8E0' : st === 'low' ? '#F0A040' : '#E05252' }}>{p.stock_quantity}</span></td>
                      <td className="px-3 py-2.5 text-[12px]" style={{ color: '#4A4A52' }}>{p.minimum_stock}</td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: '#888480' }}>{p.metal ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: '#888480' }}>{fmtWeight(p.weight_grams)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 700, color: '#C8A97A' }}>{fmtCurrency(p.price_cents)}</td>
                      <td className="px-3 py-2.5">
                        {st === 'ok' ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[11px] font-semibold whitespace-nowrap" style={{ background: 'rgba(76,175,130,0.12)', color: '#4CAF82' }}>● Em estoque</span>
                          : st === 'low' ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[11px] font-semibold whitespace-nowrap" style={{ background: 'rgba(240,160,64,0.12)', color: '#F0A040' }}>⚠ Crítico</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[11px] font-semibold whitespace-nowrap" style={{ background: 'rgba(224,82,82,0.12)', color: '#E05252' }}>✕ Sem estoque</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] whitespace-nowrap" style={{ color: '#4A4A52' }}>{fmtShortDate(p.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#18181C' }}>
            <div className="text-[12px]" style={{ color: '#4A4A52' }}>Exibindo {products.length} de {meta.total} produtos</div>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => page > 1 && handlePage(page - 1)}
                style={{ minWidth: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#888480', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.3 : 1, fontSize: 12, padding: '0 8px' }}>
                Anterior
              </button>
              {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => handlePage(p)}
                  style={{ minWidth: 30, height: 30, borderRadius: 6, border: page === p ? '1px solid rgba(200,169,122,0.28)' : '1px solid rgba(255,255,255,0.07)', background: page === p ? 'rgba(200,169,122,0.12)' : 'transparent', color: page === p ? '#C8A97A' : '#888480', fontWeight: page === p ? 700 : 400, cursor: 'pointer', fontSize: 12, padding: '0 8px' }}>
                  {p}
                </button>
              ))}
              <button disabled={page >= meta.pages} onClick={() => page < meta.pages && handlePage(page + 1)}
                style={{ minWidth: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#888480', cursor: page >= meta.pages ? 'not-allowed' : 'pointer', opacity: page >= meta.pages ? 0.3 : 1, fontSize: 12, padding: '0 8px' }}>
                Próximo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-xl z-50"
          style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.11)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'slideUp 0.2s ease' }}>
          <span className="text-[13px] font-semibold" style={{ color: '#C8A97A' }}>{selected.size} selecionado(s)</span>
          <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <button onClick={handleExport} className={btnGhost} style={{ height: 32, fontSize: 12 }}>↓ Exportar seleção</button>
          <button onClick={() => { const first = products.find(p => selected.has(p.id)); if (first) setAdjustProduct(first); }}
            className={btnGhost} style={{ height: 32, fontSize: 12 }}>± Ajustar estoque</button>
          <button onClick={handleBulkDelete} style={{ height: 32, fontSize: 12, padding: '0 12px', borderRadius: 8, background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.2)', color: '#E05252', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            🗑 Excluir
          </button>
        </div>
      )}

      {/* Detail panel */}
      <div className="fixed top-0 right-0 bottom-0 flex flex-col z-[60]"
        style={{ width: 360, background: '#18181C', borderLeft: '1px solid rgba(255,255,255,0.11)', transform: detailProduct ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {detailProduct && (
          <>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 700 }}>{detailProduct.name}</div>
              <button onClick={() => setDetailProduct(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#4A4A52', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin' }}>
              <div className="w-full rounded-[10px] flex items-center justify-center text-5xl mb-4 overflow-hidden" style={{ aspectRatio: '1.6', background: '#202026' }}>
                {detailProduct.photo_url ? <img src={detailProduct.photo_url} alt="" className="w-full h-full object-cover" /> : '💍'}
              </div>
              {[
                ['Código', detailProduct.code], ['Categoria', detailProduct.category ?? '—'],
                ['Coleção', detailProduct.collection ?? '—'], ['Metal', detailProduct.metal ?? '—'],
                ['Peso', fmtWeight(detailProduct.weight_grams)], ['Tamanho', detailProduct.size_info ?? '—'],
                ['Pedras', detailProduct.stones ?? '—'], ['Localização', detailProduct.location ?? '—'],
                ['Preço de venda', fmtCurrency(detailProduct.price_cents)], ['Custo', fmtCurrency(detailProduct.cost_price_cents)],
                ['Estoque atual', `${detailProduct.stock_quantity} un.`], ['Estoque mínimo', String(detailProduct.minimum_stock)],
                ['PDV habilitado', detailProduct.pdv_enabled ? 'Sim' : 'Não'], ['Requer produção', detailProduct.requires_production ? 'Sim' : 'Não'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-[12px]" style={{ color: '#4A4A52' }}>{label}</span>
                  <span className="text-[13px] font-semibold" style={{ color: '#EDE8E0' }}>{value}</span>
                </div>
              ))}
              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.7px] mb-3 pb-1.5" style={{ color: '#4A4A52', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>Movimentações recentes</div>
                {detailLoading ? <div className="text-[12px]" style={{ color: '#4A4A52' }}>Carregando...</div>
                  : detailMovements.length === 0 ? <div className="text-[12px]" style={{ color: '#4A4A52' }}>Nenhuma movimentação.</div>
                  : detailMovements.map(m => (
                    <div key={m.id} className="py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold" style={{ color: '#C8A97A' }}>{m.type}</span>
                        <span className="text-[11px]" style={{ color: '#4A4A52' }}>{fmtShortDate(m.created_at)}</span>
                      </div>
                      <div className="text-[12px]" style={{ color: '#888480' }}>{m.previous_stock} → {m.new_stock} (qtd. {m.quantity})</div>
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: '#4A4A52' }}>{m.reason}</div>
                      <div className="text-[11px]" style={{ color: '#4A4A52' }}>Por {m.created_by.name}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="flex gap-2 px-5 py-3.5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setEditProduct(detailProduct)} style={{ flex: 1, height: 36, borderRadius: 8, background: '#C8A97A', border: 'none', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Editar</button>
              <button onClick={() => setAdjustProduct(detailProduct)} style={{ flex: 1, height: 36, borderRadius: 8, background: '#202026', border: '1px solid rgba(255,255,255,0.07)', color: '#888480', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Ajustar Estoque</button>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {(showCreate || editProduct) && (
        <ProductModal
          product={editProduct}
          onClose={() => { setShowCreate(false); setEditProduct(null); }}
          onSaved={() => {
            const msg = editProduct ? 'Produto atualizado' : 'Produto cadastrado';
            setShowCreate(false); setEditProduct(null);
            showToast(msg); void fetchData();
          }}
          showToast={showToast}
        />
      )}

      {adjustProduct && (
        <AdjustModal
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSaved={async () => {
            setAdjustProduct(null); showToast('Estoque ajustado'); void fetchData();
            if (detailProduct) await openDetail(adjustProduct);
          }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium z-[100]"
          style={{ background: toast.type === 'success' ? 'rgba(76,175,130,0.15)' : 'rgba(224,82,82,0.15)', border: `1px solid ${toast.type === 'success' ? 'rgba(76,175,130,0.3)' : 'rgba(224,82,82,0.3)'}`, color: toast.type === 'success' ? '#4CAF82' : '#E05252' }}>
          {toast.message}
        </div>
      )}

      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}
