'use client';

import { formatCurrencyFromCents, formatCurrencyShort, getInitials } from '@/lib/utils';
import type { CustomerFull, CustomerStats } from './types';

interface Props {
  customer: CustomerFull;
  stats: CustomerStats | null;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
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

export default function ClientLeftSidebar({ customer, stats }: Props) {
  const ini = getInitials(customer.name);
  const ltv = stats?.ltv_cents ?? customer.ltv_cents ?? customer.lifetime_value_cents ?? 0;
  const ordersCount = stats?.orders_count ?? customer.orders_count ?? 0;
  const pendingOs = stats?.pending_os ?? (customer.has_pending_os ? 1 : 0);
  const lastDays = stats?.last_interaction_days ?? null;

  return (
    <div style={S.sb}>

      {/* ── HERO ── */}
      <div style={S.hero}>
        <div style={S.heroRow}>
          <div style={S.av}>
            {ini}
            <div style={S.onlineDot} />
          </div>
          <div>
            <div style={S.hname}>{customer.name.split(' ')[0]}</div>
            <div style={S.hsince}>Cliente desde {fmtDate(customer.created_at)}</div>
          </div>
        </div>

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
        {customer.assigned_to ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#1a3a2a,#2a5a3a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: '#3FB87A', flexShrink: 0,
            }}>
              {getInitials(customer.assigned_to.name)}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#F0EDE8' }}>{customer.assigned_to.name}</div>
              {customer.assigned_to.role && (
                <div style={{ fontSize: '10px', color: '#7A7774' }}>{customer.assigned_to.role}</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#7A7774' }}>Sem responsável</div>
        )}
      </div>

      {/* ── TAGS ── */}
      <div style={S.section}>
        <div style={S.sTitle}>
          <span>Tags</span>
          <button type="button" style={{ fontSize: '10px', color: '#C8A97A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>+</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {customer.preferred_channel && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 500, background: '#202026', border: '1px solid rgba(255,255,255,0.10)', color: '#C8C4BE' }}>{customer.preferred_channel}</span>
          )}
          {customer.preferred_metal && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 500, background: '#202026', border: '1px solid rgba(255,255,255,0.10)', color: '#C8C4BE' }}>{customer.preferred_metal}</span>
          )}
          {!customer.preferred_channel && !customer.preferred_metal && (
            <span style={{ fontSize: '11px', color: '#7A7774' }}>Nenhuma tag</span>
          )}
        </div>
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
