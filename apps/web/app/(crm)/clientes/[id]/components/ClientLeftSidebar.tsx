'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, X, Plus } from 'lucide-react';
import { formatCurrencyFromCents, formatCurrencyShort, getInitials } from '@/lib/utils';
import { notify } from '@/lib/toast';
import type { CustomerFull, CustomerStats } from './types';

const ACCEPTED_PHOTO_MIME = 'image/png,image/jpeg,image/webp';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_TAGS = 30;
const MAX_TAG_LEN = 40;

interface Props {
  customer: CustomerFull;
  stats: CustomerStats | null;
  onUpdate: (updated: Partial<CustomerFull>) => void;
  // Tags só são editáveis em clientes (leads não têm registro em customers para gravar).
  canEditTags?: boolean;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtAttDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// Linha de atendente (avatar + rótulo + nome + data) usada na seção Responsável.
function AttendantRow({ label, name, at }: { label: string; name: string | null; at?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%',
        background: 'linear-gradient(135deg,#1a3a2a,#2a5a3a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 700, color: '#3FB87A', flexShrink: 0,
      }}>
        {getInitials(name ?? '?')}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '9px', color: '#7A7774', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#F0EDE8' }}>{name ?? '—'}</div>
        {at ? <div style={{ fontSize: '10px', color: '#7A7774' }}>{fmtAttDate(at)}</div> : null}
      </div>
    </div>
  );
}

const S = {
  sb: {
    width: '224px',
    flexShrink: 0,
    background: '#0F0F11',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  hero: {
    padding: '14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  heroRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    marginBottom: '9px',
  },
  av: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#2a2018,#3d3020)',
    border: '1.5px solid rgba(200,169,122,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Playfair Display', serif",
    fontSize: '15px',
    fontWeight: 700,
    color: '#C8A97A',
    position: 'relative' as const,
    flexShrink: 0,
  },
  onlineDot: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: '10px',
    height: '10px',
    background: '#3FB87A',
    border: '2px solid #0F0F11',
    borderRadius: '50%',
  },
  hname: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '13px',
    fontWeight: 700,
    color: '#F0EDE8',
  },
  hsince: {
    fontSize: '10px',
    color: '#7A7774',
    marginTop: '1px',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '3px',
    marginBottom: '9px',
  },
  badge: (bg: string, border: string, color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 7px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 600,
    background: bg,
    border: `1px solid ${border}`,
    color,
  }),
  metrics: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '5px',
  },
  mbox: {
    background: '#1A1A1E',
    borderRadius: '7px',
    padding: '7px 9px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  mval: (color: string) => ({
    fontFamily: "'Playfair Display', serif",
    fontSize: '14px',
    fontWeight: 700,
    color,
  }),
  mlbl: {
    fontSize: '9px',
    color: '#7A7774',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginTop: '1px',
  },
  section: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 14px',
  },
  sTitle: {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#7A7774',
    marginBottom: '7px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  rowL: {
    fontSize: '11px',
    color: '#7A7774',
  },
  rowV: (gold = false) => ({
    fontSize: '11px',
    fontWeight: 500,
    color: gold ? '#C8A97A' : '#C8C4BE',
  }),
};

export default function ClientLeftSidebar({ customer, stats, onUpdate, canEditTags = true }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Mostra a foto recém-enviada antes do refresh (route handler invalida server cache).
  const [optimisticPhoto, setOptimisticPhoto] = useState<string | null>(null);

  // ── Tags ──
  const tags = customer.tags ?? [];
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  async function persistTags(next: string[]): Promise<void> {
    const previous = customer.tags ?? [];
    onUpdate({ tags: next }); // otimista
    setSavingTags(true);
    try {
      const res = await fetch(`/api/internal/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) {
        onUpdate({ tags: previous }); // reverte
        notify.error('Falha ao salvar tags', 'Tente novamente.');
      }
    } catch {
      onUpdate({ tags: previous });
      notify.error('Erro de rede', 'Não foi possível salvar as tags.');
    } finally {
      setSavingTags(false);
    }
  }

  function handleAddTag() {
    const value = tagDraft.trim().slice(0, MAX_TAG_LEN);
    if (!value) { setAddingTag(false); setTagDraft(''); return; }
    if (tags.length >= MAX_TAGS) {
      notify.error('Limite de tags', `Máximo de ${MAX_TAGS} tags por cliente.`);
      return;
    }
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTagDraft('');
      return;
    }
    void persistTags([...tags, value]);
    setTagDraft('');
  }

  function handleRemoveTag(tag: string) {
    void persistTags(tags.filter((t) => t !== tag));
  }

  const ini = getInitials(customer.name);
  const ltv = stats?.ltv_cents ?? customer.ltv_cents ?? customer.lifetime_value_cents ?? 0;
  const ordersCount = stats?.orders_count ?? customer.orders_count ?? 0;
  const pendingOs = stats?.pending_os ?? (customer.has_pending_os ? 1 : 0);
  const lastDays = stats?.last_interaction_days ?? null;

  const photoUrl = optimisticPhoto ?? customer.photo_url ?? null;

  const handlePickPhoto = () => {
    if (uploading) return;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handlePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite reupload do mesmo arquivo
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('Use PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError('Arquivo maior que 5 MB.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append('photo', file);

    try {
      const res = await fetch(`/api/internal/customers/${customer.id}/photo`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({} as { photo_url?: string; message?: string }));
      if (!res.ok) {
        setUploadError(typeof data.message === 'string' ? data.message : 'Falha ao enviar a foto.');
        return;
      }
      if (typeof data.photo_url === 'string') {
        // Cache-busting para forçar reload da imagem (mesmo arquivo pode ter substituído).
        setOptimisticPhoto(`${data.photo_url}?v=${Date.now()}`);
      }
      router.refresh();
    } catch {
      setUploadError('Falha de rede ao enviar a foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={S.sb}>

      {/* ── HERO ── */}
      <div style={S.hero}>
        <div style={S.heroRow}>
          <button
            type="button"
            onClick={handlePickPhoto}
            disabled={uploading}
            aria-label={photoUrl ? 'Alterar foto do cliente' : 'Adicionar foto do cliente'}
            title={photoUrl ? 'Alterar foto' : 'Adicionar foto'}
            style={{
              ...S.av,
              cursor: uploading ? 'wait' : 'pointer',
              padding: 0,
              overflow: 'hidden',
              backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!photoUrl && !uploading ? ini : null}
            {uploading ? <Loader2 size={16} className="animate-spin" color="#C8A97A" /> : null}
            {!uploading && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-end',
                  padding: '2px',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    background: 'rgba(0,0,0,0.65)',
                    border: '1px solid rgba(200,169,122,0.6)',
                    borderRadius: '50%',
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={8} color="#C8A97A" />
                </span>
              </span>
            )}
            <div style={S.onlineDot} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_PHOTO_MIME}
            onChange={handlePhotoFile}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <div>
            <div style={S.hname}>{customer.name.split(' ')[0]}</div>
            <div style={S.hsince}>Cliente desde {fmtDate(customer.created_at)}</div>
          </div>
        </div>
        {uploadError ? (
          <div
            role="alert"
            style={{
              marginBottom: '8px',
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(224,82,82,0.10)',
              border: '1px solid rgba(224,82,82,0.30)',
              color: '#E05252',
              fontSize: '10px',
              lineHeight: 1.3,
            }}
          >
            {uploadError}
          </div>
        ) : null}

        {/* Badges */}
        <div style={S.badges}>
          {customer.whatsapp_number && (
            <span style={S.badge('rgba(37,211,102,0.10)', 'rgba(37,211,102,0.20)', '#25D366')}>💬 WhatsApp</span>
          )}
          {customer.is_converted && (
            <span style={S.badge('rgba(200,169,122,0.10)', 'rgba(200,169,122,0.25)', '#C8A97A')}>Convertido</span>
          )}
          {ltv >= 500000 && (
            <span style={S.badge('rgba(167,139,250,0.10)', 'rgba(167,139,250,0.25)', '#A78BFA')}>⭐ VIP</span>
          )}
        </div>

        {/* Metrics 2×2 */}
        <div style={S.metrics}>
          <div style={S.mbox}>
            <div style={S.mval('#C8A97A')}>{formatCurrencyShort(ltv)}</div>
            <div style={S.mlbl}>LTV Total</div>
          </div>
          <div style={S.mbox}>
            <div style={S.mval('#3FB87A')}>{ordersCount}</div>
            <div style={S.mlbl}>Compras</div>
          </div>
          <div style={S.mbox}>
            <div style={S.mval(pendingOs > 0 ? '#F0A040' : '#5B9CF6')}>{pendingOs}</div>
            <div style={S.mlbl}>Em aberto</div>
          </div>
          <div style={S.mbox}>
            <div style={S.mval(lastDays !== null && lastDays > 14 ? '#E05252' : '#F0A040')}>
              {lastDays !== null ? `${lastDays}d` : '—'}
            </div>
            <div style={S.mlbl}>Sem interação</div>
          </div>
        </div>
      </div>

      {/* ── INFORMAÇÕES ── */}
      <div style={S.section}>
        <div style={S.sTitle}>Informações</div>
        <div style={S.row}><span style={S.rowL}>Origem</span><span style={S.rowV()}>{customer.origin ?? '—'}</span></div>
        <div style={S.row}><span style={S.rowL}>Valor est.</span><span style={S.rowV(true)}>{ltv > 0 ? formatCurrencyShort(ltv) : '—'}</span></div>
        <div style={S.row}><span style={S.rowL}>Criado</span><span style={S.rowV()}>{fmtDate(customer.created_at)}</span></div>
        {customer.preferred_metal && (
          <div style={S.row}><span style={S.rowL}>Metal pref.</span><span style={S.rowV()}>{customer.preferred_metal}</span></div>
        )}
        {customer.ring_size && (
          <div style={S.row}><span style={S.rowL}>Tamanho anel</span><span style={S.rowV()}>{customer.ring_size}</span></div>
        )}
      </div>

      {/* ── RESPONSÁVEL ── */}
      <div style={S.section}>
        <div style={S.sTitle}>Responsável</div>
        {(() => {
          const first = customer.first_attendant;
          const current = customer.current_attendant
            ?? (customer.assigned_to ? { id: customer.assigned_to.id, name: customer.assigned_to.name, at: null } : null);

          if (!first && !current) {
            return <div style={{ fontSize: '11px', color: '#7A7774' }}>Sem responsável</div>;
          }

          // Mesma pessoa começou e atende agora → mostra uma linha só.
          if (first && current && first.id === current.id) {
            return <AttendantRow label="Responsável · desde" name={current.name} at={first.at} />;
          }

          return (
            <>
              {current && <AttendantRow label="Atendendo agora" name={current.name} at={current.at} />}
              {first && <AttendantRow label="Começou a atender" name={first.name} at={first.at} />}
            </>
          );
        })()}
      </div>

      {/* ── TAGS ── */}
      <div style={S.section}>
        <div style={S.sTitle}>
          <span>Tags</span>
          {canEditTags && (
            <button
              type="button"
              onClick={() => setAddingTag((v) => !v)}
              disabled={savingTags || tags.length >= MAX_TAGS}
              aria-label="Adicionar tag"
              title={tags.length >= MAX_TAGS ? `Máximo de ${MAX_TAGS} tags` : 'Adicionar tag'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#C8A97A', background: 'none', border: 'none',
                cursor: savingTags || tags.length >= MAX_TAGS ? 'not-allowed' : 'pointer',
                padding: 0, opacity: tags.length >= MAX_TAGS ? 0.4 : 1,
              }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 5px 2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 500,
                background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.25)', color: '#C8A97A',
              }}
            >
              {tag}
              {canEditTags && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={savingTags}
                  aria-label={`Remover tag ${tag}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', padding: 0, color: '#C8A97A',
                    cursor: savingTags ? 'not-allowed' : 'pointer', opacity: 0.7,
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {tags.length === 0 && !addingTag && (
            <span style={{ fontSize: '11px', color: '#7A7774' }}>Nenhuma tag</span>
          )}
        </div>

        {addingTag && (
          <input
            autoFocus
            value={tagDraft}
            maxLength={MAX_TAG_LEN}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
              else if (e.key === 'Escape') { setAddingTag(false); setTagDraft(''); }
            }}
            onBlur={handleAddTag}
            placeholder="Nova tag e Enter"
            style={{
              marginTop: '6px', width: '100%', height: '26px', boxSizing: 'border-box',
              background: '#1A1A1E', border: '1px solid rgba(200,169,122,0.30)', borderRadius: '5px',
              padding: '0 8px', fontSize: '11px', color: '#F0EDE8', outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        )}
      </div>

      {/* ── ACESSOS ── */}
      <div style={S.section}>
        <div style={S.sTitle}>Acessos</div>
        {customer.assigned_to ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#C8C4BE' }}>{customer.assigned_to.name}</span>
            <span style={S.badge('rgba(91,156,246,0.10)', 'rgba(91,156,246,0.25)', '#5B9CF6')}>
              {customer.assigned_to.role ?? 'Atendente'}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#7A7774' }}>Nenhum acesso configurado</div>
        )}
      </div>

    </div>
  );
}
