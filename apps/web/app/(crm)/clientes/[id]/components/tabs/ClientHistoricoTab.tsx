'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, UserCheck, Pencil, ArrowRightLeft, StickyNote,
  ShoppingBag, CreditCard, Star, MessageCircle, Package,
  Truck, FileText, Wrench, AlertCircle, Circle, ChevronDown,
  ChevronUp, RefreshCw, Mail, ThumbsUp, Clock,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  customerId: string;
}

type SubTab = 'timeline' | 'whatsapp' | 'email' | 'feedback';

interface LogItem {
  id: string;
  type: string;
  description: string;
  user_name?: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

function fmtDateShort(d: string): string {
  try {
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function groupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function groupByDate(items: LogItem[]): Array<{ label: string; items: LogItem[] }> {
  const map = new Map<string, LogItem[]>();
  for (const item of items) {
    const label = groupLabel(item.created_at);
    const group = map.get(label) ?? [];
    group.push(item);
    map.set(label, group);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ── Event type config ─────────────────────────────────────────────────────────

interface EventConfig {
  icon: ReactNode;
  color: string;
  bg: string;
  border: string;
  category: string;
}

function getEventConfig(type: string): EventConfig {
  const configs: Record<string, EventConfig> = {
    created:            { icon: <UserPlus size={13} />,      color: '#3FB87A', bg: 'rgba(63,184,122,0.12)',    border: 'rgba(63,184,122,0.25)',    category: 'Cliente' },
    converted:          { icon: <UserCheck size={13} />,     color: '#C8A97A', bg: 'rgba(200,169,122,0.12)',   border: 'rgba(200,169,122,0.25)',   category: 'Cliente' },
    updated:            { icon: <Pencil size={13} />,        color: '#5B9CF6', bg: 'rgba(91,156,246,0.12)',    border: 'rgba(91,156,246,0.25)',    category: 'Cliente' },
    status_changed:     { icon: <ArrowRightLeft size={13} />,color: '#F0A040', bg: 'rgba(240,160,64,0.12)',    border: 'rgba(240,160,64,0.25)',    category: 'Atendimento' },
    note_added:         { icon: <StickyNote size={13} />,    color: '#C8A97A', bg: 'rgba(200,169,122,0.12)',   border: 'rgba(200,169,122,0.25)',   category: 'Atendimento' },
    attendance_created: { icon: <MessageCircle size={13} />, color: '#A78BFA', bg: 'rgba(167,139,250,0.12)',   border: 'rgba(167,139,250,0.25)',   category: 'Atendimento' },
    attendance_updated: { icon: <Pencil size={13} />,        color: '#A78BFA', bg: 'rgba(167,139,250,0.10)',   border: 'rgba(167,139,250,0.20)',   category: 'Atendimento' },
    pipeline_advanced:  { icon: <ArrowRightLeft size={13} />,color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)',    border: 'rgba(45,212,191,0.25)',    category: 'Atendimento' },
    order_created:      { icon: <ShoppingBag size={13} />,   color: '#A78BFA', bg: 'rgba(167,139,250,0.12)',   border: 'rgba(167,139,250,0.25)',   category: 'Pedido' },
    order_updated:      { icon: <Pencil size={13} />,        color: '#A78BFA', bg: 'rgba(167,139,250,0.10)',   border: 'rgba(167,139,250,0.20)',   category: 'Pedido' },
    payment_received:   { icon: <CreditCard size={13} />,    color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)',    border: 'rgba(45,212,191,0.25)',    category: 'Pagamento' },
    os_created:         { icon: <Wrench size={13} />,        color: '#F0A040', bg: 'rgba(240,160,64,0.12)',    border: 'rgba(240,160,64,0.25)',    category: 'Produção' },
    os_updated:         { icon: <RefreshCw size={13} />,     color: '#F0A040', bg: 'rgba(240,160,64,0.10)',    border: 'rgba(240,160,64,0.20)',    category: 'Produção' },
    os_concluded:       { icon: <Wrench size={13} />,        color: '#3FB87A', bg: 'rgba(63,184,122,0.12)',    border: 'rgba(63,184,122,0.25)',    category: 'Produção' },
    delivery_created:   { icon: <Truck size={13} />,         color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)',    border: 'rgba(45,212,191,0.25)',    category: 'Entrega' },
    delivery_updated:   { icon: <Truck size={13} />,         color: '#5B9CF6', bg: 'rgba(91,156,246,0.10)',    border: 'rgba(91,156,246,0.20)',    category: 'Entrega' },
    delivered:          { icon: <Package size={13} />,       color: '#3FB87A', bg: 'rgba(63,184,122,0.12)',    border: 'rgba(63,184,122,0.25)',    category: 'Entrega' },
    proposal_created:   { icon: <FileText size={13} />,      color: '#5B9CF6', bg: 'rgba(91,156,246,0.12)',    border: 'rgba(91,156,246,0.25)',    category: 'Proposta' },
    whatsapp:           { icon: <MessageCircle size={13} />, color: '#3FB87A', bg: 'rgba(63,184,122,0.12)',    border: 'rgba(63,184,122,0.25)',    category: 'WhatsApp' },
    feedback:           { icon: <Star size={13} />,          color: '#C8A97A', bg: 'rgba(200,169,122,0.12)',   border: 'rgba(200,169,122,0.25)',   category: 'Feedback' },
  };
  return configs[type] ?? {
    icon: <Circle size={10} />,
    color: '#7A7774', bg: 'rgba(122,119,116,0.10)', border: 'rgba(122,119,116,0.20)', category: 'Sistema',
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  'Cliente':      '#5B9CF6',
  'Atendimento':  '#A78BFA',
  'Pedido':       '#A78BFA',
  'Pagamento':    '#2DD4BF',
  'Produção':     '#F0A040',
  'Entrega':      '#2DD4BF',
  'Proposta':     '#5B9CF6',
  'WhatsApp':     '#3FB87A',
  'Feedback':     '#C8A97A',
  'Sistema':      '#7A7774',
};

// ── Metadata renderer ─────────────────────────────────────────────────────────

function MetadataBlock({ meta }: { meta: Record<string, unknown> }) {
  const entries = Object.entries(meta).filter(([k]) =>
    !['id', 'customer_id', 'created_by'].includes(k)
  );
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {entries.map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const isOldNew = key === 'old_value' || key === 'new_value';
        return (
          <div key={key} style={{ display: 'flex', gap: '6px', fontSize: '10px', lineHeight: 1.4 }}>
            <span style={{ color: '#7A7774', flexShrink: 0, minWidth: '80px' }}>{label}:</span>
            <span style={{
              color: key === 'new_value' ? '#3FB87A' : key === 'old_value' ? '#E05252' : '#C8C4BE',
              fontFamily: isOldNew ? 'monospace' : undefined,
            }}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── LogEntry ──────────────────────────────────────────────────────────────────

function TimelineEntry({ item, isLast }: { item: LogItem; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getEventConfig(item.type);
  const hasDetail = item.metadata && Object.keys(item.metadata).length > 0;
  const catColor = CATEGORY_COLORS[cfg.category] ?? '#7A7774';

  return (
    <div style={{ display: 'flex', gap: '0', position: 'relative' }}>
      {/* Vertical line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', flexShrink: 0 }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', zIndex: 1,
          background: cfg.bg, border: `1.5px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color, flexShrink: 0,
        }}>
          {cfg.icon}
        </div>
        {!isLast && (
          <div style={{ width: '1.5px', flex: 1, background: 'rgba(255,255,255,0.05)', minHeight: '16px' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? '0' : '14px', paddingLeft: '10px' }}>
        {/* Category badge + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px',
            color: catColor, padding: '1px 5px',
            background: `${catColor}14`, border: `1px solid ${catColor}28`, borderRadius: '4px',
          }}>
            {cfg.category}
          </span>
          <span style={{ fontSize: '10px', color: '#7A7774' }}>
            {item.user_name && <>{item.user_name} · </>}
            {fmtDateShort(item.created_at)}
          </span>
        </div>

        {/* Description */}
        <div style={{ fontSize: '12px', color: '#C8C4BE', lineHeight: 1.5, marginBottom: hasDetail ? '0' : undefined }}>
          {item.description}
        </div>

        {/* Expand button */}
        {hasDetail && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              marginTop: '4px', background: 'transparent', border: 'none',
              color: '#5B9CF6', fontSize: '10px', cursor: 'pointer', padding: 0,
            }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? 'Menos detalhes' : 'Ver detalhes'}
          </button>
        )}

        {/* Metadata detail */}
        {expanded && item.metadata && (
          <div style={{
            marginTop: '6px', padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '6px',
          }}>
            <MetadataBlock meta={item.metadata} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Date group header ─────────────────────────────────────────────────────────

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '12px', marginTop: '4px',
    }}>
      <span style={{
        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.7px', color: '#7A7774', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

// ── WAMessage ─────────────────────────────────────────────────────────────────

function WAMessage({ item }: { item: LogItem }) {
  const isInbound = item.type === 'inbound' || item.metadata?.direction === 'inbound';
  return (
    <div style={{ display: 'flex', justifyContent: isInbound ? 'flex-start' : 'flex-end', marginBottom: '8px' }}>
      <div style={{
        maxWidth: '72%',
        background: isInbound ? '#1A1A1E' : 'rgba(63,184,122,0.12)',
        border: `1px solid ${isInbound ? 'rgba(255,255,255,0.08)' : 'rgba(63,184,122,0.20)'}`,
        borderRadius: isInbound ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
        padding: '8px 12px',
      }}>
        {isInbound && (
          <div style={{ fontSize: '10px', color: '#7A7774', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MessageCircle size={10} color="#3FB87A" /> Cliente
          </div>
        )}
        <div style={{ fontSize: '12px', color: '#F0EDE8', lineHeight: 1.5 }}>{item.description}</div>
        <div style={{ fontSize: '10px', color: '#7A7774', marginTop: '3px', textAlign: 'right' }}>
          {fmtDate(item.created_at)}
        </div>
      </div>
    </div>
  );
}

// ── FeedbackCard ──────────────────────────────────────────────────────────────

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const label = item.rating >= 5 ? 'Excelente' : item.rating >= 4 ? 'Ótimo' : item.rating >= 3 ? 'Bom' : item.rating >= 2 ? 'Regular' : 'Ruim';
  const color = item.rating >= 4 ? '#3FB87A' : item.rating >= 3 ? '#F0A040' : '#E05252';
  return (
    <div style={{
      background: '#141417', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px', padding: '14px 16px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={13} fill={star <= item.rating ? '#C8A97A' : 'transparent'} color={star <= item.rating ? '#C8A97A' : '#3A3A40'} />
            ))}
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color }}>{label}</span>
        </div>
        <span style={{ fontSize: '11px', color: '#7A7774' }}>{fmtDate(item.created_at)}</span>
      </div>
      {item.comment && (
        <div style={{
          fontSize: '12px', color: '#C8C4BE', lineHeight: 1.6,
          padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px',
        }}>
          "{item.comment}"
        </div>
      )}
    </div>
  );
}

// ── Summary strip (resumo numérico no topo) ───────────────────────────────────

interface SummaryItem { label: string; value: number; icon: ReactNode; color: string }

function SummaryStrip({ items }: { items: LogItem[] }) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const cat = getEventConfig(item.type).category;
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  const strips: SummaryItem[] = [
    { label: 'Atendimentos', value: counts['Atendimento'] ?? 0, icon: <MessageCircle size={12} />, color: '#A78BFA' },
    { label: 'Pedidos',      value: (counts['Pedido'] ?? 0) + (counts['Pagamento'] ?? 0), icon: <ShoppingBag size={12} />, color: '#A78BFA' },
    { label: 'Produção',     value: counts['Produção'] ?? 0, icon: <Wrench size={12} />, color: '#F0A040' },
    { label: 'Entregas',     value: counts['Entrega'] ?? 0, icon: <Truck size={12} />, color: '#2DD4BF' },
  ].filter((s) => s.value > 0);

  if (strips.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
      {strips.map((s) => (
        <div key={s.label} style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px',
          background: `${s.color}10`, border: `1px solid ${s.color}28`,
          borderRadius: '20px',
        }}>
          <span style={{ color: s.color }}>{s.icon}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: s.color }}>{s.value}</span>
          <span style={{ fontSize: '10px', color: '#7A7774' }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const ALL_CATEGORIES = ['Todos', 'Cliente', 'Atendimento', 'Pedido', 'Produção', 'Entrega', 'Proposta', 'Pagamento'];

function FilterChips({ active, onChange, available }: { active: string; onChange: (v: string) => void; available: Set<string> }) {
  const visible = ALL_CATEGORIES.filter((c) => c === 'Todos' || available.has(c));
  if (visible.length <= 2) return null;
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
      {visible.map((cat) => {
        const isActive = active === cat;
        const color = CATEGORY_COLORS[cat] ?? '#7A7774';
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            style={{
              height: '24px', padding: '0 10px',
              background: isActive ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? `${color}40` : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '20px',
              fontSize: '10px', fontWeight: isActive ? 700 : 400,
              color: isActive ? color : '#7A7774',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[80, 60, 90, 55, 75].map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#202026', flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ height: '10px', width: `${w}%`, background: '#202026', borderRadius: '4px', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: '8px', width: '40%', background: '#1A1A1E', borderRadius: '4px', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientHistoricoTab({ customerId }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('timeline');
  const [items, setItems] = useState<LogItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('Todos');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (subTab === 'feedback') {
        const res = await fetch(`/api/internal/customers/${customerId}/feedback`);
        if (!res.ok) throw new Error('Erro');
        const data = await res.json();
        setFeedback(Array.isArray(data) ? data : (data.data ?? []));
      } else if (subTab === 'whatsapp') {
        const res = await fetch(`/api/internal/customers/${customerId}/history?type=whatsapp`);
        if (!res.ok) throw new Error('Erro');
        const data = await res.json();
        setItems(Array.isArray(data) ? data : (data.data ?? []));
      } else if (subTab === 'timeline') {
        const res = await fetch(`/api/internal/customers/${customerId}/history?type=log&limit=200`);
        if (!res.ok) throw new Error('Erro');
        const data = await res.json();
        setItems(Array.isArray(data) ? data : (data.data ?? []));
      } else {
        setItems([]);
      }
    } catch {
      setError('Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, [customerId, subTab]);

  useEffect(() => { fetchData(); setFilter('Todos'); }, [fetchData]);

  const availableCategories = new Set(items.map((i) => getEventConfig(i.type).category));

  const filteredItems = filter === 'Todos'
    ? items
    : items.filter((i) => getEventConfig(i.type).category === filter);

  const groups = groupByDate(filteredItems);

  const SUB_TABS: { key: SubTab; label: string; icon: ReactNode }[] = [
    { key: 'timeline', label: 'Histórico', icon: <Clock size={12} /> },
    { key: 'whatsapp', label: 'WhatsApp',  icon: <MessageCircle size={12} /> },
    { key: 'email',    label: 'E-mail',    icon: <Mail size={12} /> },
    { key: 'feedback', label: 'Avaliações',icon: <ThumbsUp size={12} /> },
  ];

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: '2px', marginBottom: '16px',
        background: 'rgba(255,255,255,0.03)', borderRadius: '9px', padding: '3px',
        width: 'fit-content', border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {SUB_TABS.map((t) => {
          const isActive = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              style={{
                height: '28px', padding: '0 12px',
                background: isActive ? '#1A1A1E' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(255,255,255,0.10)' : 'transparent'}`,
                borderRadius: '6px',
                color: isActive ? '#F0EDE8' : '#7A7774',
                fontSize: '11px', fontWeight: isActive ? 600 : 400,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span style={{ color: isActive ? '#C8A97A' : '#7A7774' }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading && <Skeleton />}

      {!loading && error && (
        <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
          <button type="button" onClick={fetchData} style={{ height: '30px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '12px', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Timeline ── */}
      {!loading && !error && subTab === 'timeline' && (
        <>
          {items.length > 0 && <SummaryStrip items={items} />}
          {items.length > 0 && (
            <FilterChips active={filter} onChange={setFilter} available={availableCategories} />
          )}

          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(122,119,116,0.08)', border: '1px solid rgba(122,119,116,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Clock size={20} color="#7A7774" />
              </div>
              <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nenhum evento registrado</p>
              <p style={{ color: '#7A7774', fontSize: '12px' }}>As ações neste cliente aparecerão aqui em ordem cronológica.</p>
            </div>
          ) : (
            groups.map(({ label, items: groupItems }) => (
              <div key={label} style={{ marginBottom: '6px' }}>
                <DateGroupHeader label={label} />
                {groupItems.map((item, idx) => (
                  <TimelineEntry key={item.id} item={item} isLast={idx === groupItems.length - 1} />
                ))}
              </div>
            ))
          )}
        </>
      )}

      {/* ── WhatsApp ── */}
      {!loading && !error && subTab === 'whatsapp' && (
        <div>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(63,184,122,0.07)', border: '1px solid rgba(63,184,122,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <MessageCircle size={20} color="#3FB87A" />
              </div>
              <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nenhuma mensagem registrada</p>
              <p style={{ color: '#7A7774', fontSize: '12px' }}>Mensagens trocadas pelo WhatsApp aparecem aqui.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((item) => <WAMessage key={item.id} item={item} />)}
            </div>
          )}
        </div>
      )}

      {/* ── E-mail ── */}
      {!loading && !error && subTab === 'email' && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(91,156,246,0.07)', border: '1px solid rgba(91,156,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Mail size={20} color="#5B9CF6" />
          </div>
          <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Histórico de e-mails</p>
          <p style={{ color: '#7A7774', fontSize: '12px' }}>Em breve — integração com Gmail e SMTP.</p>
        </div>
      )}

      {/* ── Feedback ── */}
      {!loading && !error && subTab === 'feedback' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', color: '#F0EDE8', fontWeight: 600, margin: 0 }}>Avaliações do cliente</h3>
              {feedback.length > 0 && (
                <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px' }}>
                  Média: {' '}
                  <span style={{ color: '#C8A97A', fontWeight: 600 }}>
                    {(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)} ★
                  </span>
                  {' '}· {feedback.length} avaliação{feedback.length !== 1 ? 'ões' : ''}
                </div>
              )}
            </div>
            <button
              type="button"
              style={{ height: '28px', padding: '0 12px', background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.25)', borderRadius: '6px', color: '#C8A97A', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Star size={11} /> Solicitar avaliação
            </button>
          </div>
          {feedback.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(200,169,122,0.07)', border: '1px solid rgba(200,169,122,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <ThumbsUp size={20} color="#C8A97A" />
              </div>
              <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nenhuma avaliação ainda</p>
              <p style={{ color: '#7A7774', fontSize: '12px' }}>Solicite uma avaliação para receber o feedback deste cliente.</p>
            </div>
          ) : (
            feedback.map((f) => <FeedbackCard key={f.id} item={f} />)
          )}
        </>
      )}
    </>
  );
}
