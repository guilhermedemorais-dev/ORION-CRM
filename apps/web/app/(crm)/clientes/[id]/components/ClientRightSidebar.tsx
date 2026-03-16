'use client';

import { useState, useEffect } from 'react';
import { Settings2, Gem, FileText, MessageSquare } from 'lucide-react';
import type { CustomerFull, CustomerStats } from './types';

interface ChannelConversation {
  id: string;
  channel: string;
  status: string;
}

interface Props {
  customer: CustomerFull;
  stats: CustomerStats | null;
  onNewOS: () => void;
  onNewBlock: () => void;
  onOpenChat: (conversationId: string, channel: string) => void;
}

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#7A7774',
        marginBottom: '8px',
        paddingLeft: '14px',
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background: 'rgba(255,255,255,0.06)',
        margin: '14px 0',
      }}
    />
  );
}

const CHANNEL_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  whatsapp:  { label: 'WhatsApp',  color: '#25D366', bg: 'rgba(37,211,102,0.08)',  border: 'rgba(37,211,102,0.22)',  icon: '󰖣' },
  instagram: { label: 'Instagram', color: '#E1306C', bg: 'rgba(225,48,108,0.08)',  border: 'rgba(225,48,108,0.22)',  icon: '󰋾' },
  telegram:  { label: 'Telegram',  color: '#2AABEE', bg: 'rgba(42,171,238,0.08)',  border: 'rgba(42,171,238,0.22)',  icon: '󰙘' },
  messenger: { label: 'Messenger', color: '#0084FF', bg: 'rgba(0,132,255,0.08)',   border: 'rgba(0,132,255,0.22)',   icon: '󰠮' },
  tiktok:    { label: 'TikTok',    color: '#69C9D0', bg: 'rgba(105,201,208,0.08)', border: 'rgba(105,201,208,0.22)', icon: '󱑽' },
};

function ChannelIcon({ channel, size = 13 }: { channel: string; size?: number }) {
  // SVG-based icons for each channel
  if (channel === 'whatsapp') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.107.549 4.085 1.51 5.808L.057 23.75l6.101-1.596A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.634-.518-5.128-1.418l-.367-.218-3.801.996.014-3.701-.24-.381A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
    );
  }
  if (channel === 'instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    );
  }
  if (channel === 'telegram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    );
  }
  if (channel === 'messenger') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.744 6.615 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.26 5.889-3.26-6.56 6.963z"/>
      </svg>
    );
  }
  if (channel === 'tiktok') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.9a8.18 8.18 0 004.78 1.52V7c-.4 0-.79-.05-1.16-.14l-.85-.17z"/>
      </svg>
    );
  }
  // fallback
  return <MessageSquare size={size} />;
}

export default function ClientRightSidebar({ customer, stats, onNewOS, onNewBlock, onOpenChat }: Props) {
  const [conversations, setConversations] = useState<ChannelConversation[]>([]);

  useEffect(() => {
    const phone = customer.whatsapp_number.replace(/\D/g, '');
    if (!phone) return;
    fetch(`/api/internal/inbox/conversations?q=${encodeURIComponent(phone)}&limit=20`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list: ChannelConversation[] = Array.isArray(data) ? data : (data.data ?? []);
        // Deduplicate by channel — keep the most recent per channel
        const seen = new Set<string>();
        const unique = list.filter((c) => {
          if (seen.has(c.channel)) return false;
          seen.add(c.channel);
          return true;
        });
        setConversations(unique);
      })
      .catch(() => {});
  }, [customer.whatsapp_number]);

  const ltvCents = stats?.ltv_cents ?? customer.ltv_cents ?? customer.lifetime_value_cents ?? 0;
  const openProposals = stats?.open_proposals ?? 0;
  const ticketMedio = stats?.orders_count && stats.orders_count > 0
    ? Math.round(ltvCents / stats.orders_count)
    : 0;

  function handleWhatsAppExternal() {
    const num = customer.whatsapp_number.replace(/\D/g, '');
    window.open(`https://wa.me/${num}`, '_blank');
  }

  return (
    <div
      style={{
        width: '208px',
        flexShrink: 0,
        background: '#0F0F11',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto',
        paddingTop: '16px',
        paddingBottom: '24px',
      }}
    >
      {/* CONTATO */}
      <SectionLabel>Contato</SectionLabel>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', color: '#F0EDE8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {customer.name}
            </div>
            {customer.whatsapp_number && (
              <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '1px' }}>
                {customer.whatsapp_number}
              </div>
            )}
            {customer.email && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#7A7774',
                  marginTop: '1px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {customer.email}
              </div>
            )}
          </div>
          <button
            style={{
              width: '22px',
              height: '22px',
              background: '#1A1A1E',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '5px',
              color: '#C8C4BE',
              fontSize: '12px',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ›
          </button>
        </div>
      </div>

      <Divider />

      {/* CANAIS DO INBOX */}
      <SectionLabel>Inbox</SectionLabel>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {conversations.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#7A7774', paddingLeft: '2px' }}>
            Nenhuma conversa ativa
          </div>
        ) : (
          conversations.map((conv) => {
            const meta = CHANNEL_META[conv.channel] ?? {
              label: conv.channel,
              color: '#C8C4BE',
              bg: 'rgba(255,255,255,0.04)',
              border: 'rgba(255,255,255,0.10)',
            };
            return (
              <button
                key={conv.id}
                onClick={() => onOpenChat(conv.id, conv.channel)}
                style={{
                  height: '32px',
                  width: '100%',
                  background: meta.bg,
                  border: `1px solid ${meta.border}`,
                  borderRadius: '7px',
                  color: meta.color,
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '0 10px',
                  textAlign: 'left',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <ChannelIcon channel={conv.channel} size={13} />
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.label}
                </span>
                {conv.status === 'AGUARDANDO_HUMANO' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F0A040', flexShrink: 0 }} />
                )}
                {conv.status === 'EM_ATENDIMENTO' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3FB87A', flexShrink: 0 }} />
                )}
              </button>
            );
          })
        )}
      </div>

      <Divider />

      {/* AÇÕES RÁPIDAS */}
      <SectionLabel>Ações Rápidas</SectionLabel>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          {
            icon: <ChannelIcon channel="whatsapp" size={13} />,
            label: 'Abrir WhatsApp',
            color: '#25D366',
            bg: 'rgba(37,211,102,0.08)',
            border: 'rgba(37,211,102,0.20)',
            onClick: handleWhatsAppExternal,
          },
          {
            icon: <FileText size={13} />,
            label: 'Gerar Proposta',
            color: '#C8A97A',
            bg: 'rgba(200,169,122,0.08)',
            border: 'rgba(200,169,122,0.20)',
            onClick: () => {},
          },
          {
            icon: <Settings2 size={13} />,
            label: 'Nova OS',
            color: '#5B9CF6',
            bg: 'rgba(91,156,246,0.08)',
            border: 'rgba(91,156,246,0.20)',
            onClick: onNewOS,
          },
          {
            icon: <Gem size={13} />,
            label: 'Novo Bloco',
            color: '#A78BFA',
            bg: 'rgba(167,139,250,0.08)',
            border: 'rgba(167,139,250,0.20)',
            onClick: onNewBlock,
          },
        ].map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            style={{
              height: '32px',
              width: '100%',
              background: action.bg,
              border: `1px solid ${action.border}`,
              borderRadius: '7px',
              color: action.color,
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '0 10px',
              textAlign: 'left',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* EMPRESA (only if cnpj) */}
      {customer.cnpj && (
        <>
          <Divider />
          <SectionLabel>Empresa</SectionLabel>
          <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                background: '#1A1A1E',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#7A7774',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {customer.company_name ? customer.company_name.slice(0, 2).toUpperCase() : 'EM'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#C8C4BE',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {customer.company_name || 'Empresa não informada'}
              </div>
              <div style={{ fontSize: '10px', color: '#7A7774' }}>{customer.cnpj}</div>
            </div>
          </div>
        </>
      )}

      <Divider />

      {/* RESUMO FINANCEIRO */}
      <SectionLabel>Resumo Financeiro</SectionLabel>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { label: 'LTV', value: fmt(ltvCents), color: '#C8A97A' },
          {
            label: 'Em aberto',
            value: openProposals > 0 ? `${openProposals} proposta${openProposals > 1 ? 's' : ''}` : '—',
            color: '#F0A040',
          },
          { label: 'Ticket médio', value: ticketMedio > 0 ? fmt(ticketMedio) : '—', color: '#F0EDE8' },
          { label: 'NF-e emitidas', value: '—', color: '#F0EDE8' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#7A7774' }}>{item.label}</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: item.color,
                fontFamily: "'Playfair Display', serif",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
