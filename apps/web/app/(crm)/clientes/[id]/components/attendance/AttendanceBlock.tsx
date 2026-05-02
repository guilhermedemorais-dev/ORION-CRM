'use client';

import type { AttendanceBlock as AttendanceBlockType } from '../types';

interface Props {
  block: AttendanceBlockType;
  onEdit: (block: AttendanceBlockType) => void;
}

const ALLOWED_ATTENDANCE_TAGS = new Set(['A', 'B', 'BR', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'U', 'UL']);
const REMOVE_WITH_CONTENT_TAGS = new Set(['BUTTON', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'MATH', 'OBJECT', 'OPTION', 'SCRIPT', 'SELECT', 'STYLE', 'SVG', 'TEXTAREA']);

function sanitizeAttendanceHtml(html: string): string {
  if (typeof window === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLDivElement | null;
  if (!container) return '';

  function sanitizeElement(element: Element): void {
    Array.from(element.children).forEach(sanitizeElement);

    const tag = element.tagName.toUpperCase();
    if (REMOVE_WITH_CONTENT_TAGS.has(tag)) {
      element.remove();
      return;
    }

    if (!ALLOWED_ATTENDANCE_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (tag === 'A' && name === 'href') {
        const value = attribute.value.trim();
        const normalized = value.toLowerCase();
        const isSafeLink = value.length > 0 && (
          normalized.startsWith('http://')
          || normalized.startsWith('https://')
          || normalized.startsWith('mailto:')
          || normalized.startsWith('tel:')
          || value.startsWith('/')
          || value.startsWith('#')
        );

        if (!isSafeLink) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute('href', value);
          element.setAttribute('rel', 'noopener noreferrer');
          element.setAttribute('target', '_blank');
        }
        return;
      }

      element.removeAttribute(attribute.name);
    });
  }

  Array.from(container.children).forEach(sanitizeElement);
  return container.innerHTML.trim();
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  atendimento:   { bg: 'rgba(200,169,122,0.08)', border: 'rgba(200,169,122,0.15)', color: '#C8A97A', icon: '📋' },
  consulta_peca: { bg: 'rgba(91,156,246,0.08)',  border: 'rgba(91,156,246,0.15)',  color: '#5B9CF6', icon: '💎' },
  ligacao:       { bg: 'rgba(63,184,122,0.08)',  border: 'rgba(63,184,122,0.15)',  color: '#3FB87A', icon: '📞' },
  visita:        { bg: 'rgba(240,160,64,0.08)',  border: 'rgba(240,160,64,0.15)',  color: '#F0A040', icon: '🏪' },
  email:         { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)', color: '#A78BFA', icon: '✉️' },
  // legacy
  open: { bg: 'rgba(200,169,122,0.08)', border: 'rgba(200,169,122,0.15)', color: '#C8A97A', icon: '📋' },
  done: { bg: 'rgba(63,184,122,0.08)',  border: 'rgba(63,184,122,0.15)',  color: '#3FB87A', icon: '✓'  },
  note: { bg: 'rgba(91,156,246,0.08)',  border: 'rgba(91,156,246,0.15)',  color: '#5B9CF6', icon: '📝' },
};

const PIPELINE_BADGE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  ATENDIMENTO: { bg: 'rgba(200,169,122,0.10)', border: 'rgba(200,169,122,0.30)', text: '#C8A97A', label: 'Atendimento' },
  PROPOSTA:    { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)', text: '#A78BFA', label: 'Proposta'    },
  PEDIDO:      { bg: 'rgba(91,156,246,0.10)',  border: 'rgba(91,156,246,0.30)',  text: '#5B9CF6', label: 'Pedido'      },
  OS:          { bg: 'rgba(45,212,191,0.10)',  border: 'rgba(45,212,191,0.30)',  text: '#2DD4BF', label: 'OS'          },
  ENTREGA:     { bg: 'rgba(63,184,122,0.10)',  border: 'rgba(63,184,122,0.30)',  text: '#3FB87A', label: 'Entrega'     },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente', urgente: 'Urgente',
};

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function AttendanceBlockCard({ block, onEdit }: Props) {
  const typeStyle = TYPE_COLORS[block.block_type] ?? TYPE_COLORS['note'];
  const pipelineKey = (block.pipeline_status ?? 'ATENDIMENTO').toUpperCase();
  const pipelineBadge = PIPELINE_BADGE[pipelineKey] ?? PIPELINE_BADGE['ATENDIMENTO'];

  return (
    <div
      style={{
        background: '#141417',
        border: `1px solid ${typeStyle.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px',
          background: typeStyle.bg,
          borderBottom: `1px solid ${typeStyle.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{typeStyle.icon}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {block.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Pipeline status badge */}
          <span
            style={{
              background: pipelineBadge.bg,
              border: `1px solid ${pipelineBadge.border}`,
              borderRadius: '20px',
              padding: '1px 8px',
              fontSize: '10px',
              fontWeight: 700,
              color: pipelineBadge.text,
            }}
          >
            {pipelineBadge.label}
          </span>

          {/* Priority badge (only if non-normal) */}
          {block.priority && block.priority !== 'normal' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: block.priority === 'urgente' || block.priority === 'urgent' ? '#E05252' : '#F0A040',
                background: block.priority === 'urgente' || block.priority === 'urgent' ? 'rgba(224,82,82,0.10)' : 'rgba(240,160,64,0.10)',
                border: block.priority === 'urgente' || block.priority === 'urgent' ? '1px solid rgba(224,82,82,0.25)' : '1px solid rgba(240,160,64,0.25)',
                borderRadius: '20px',
                padding: '1px 6px',
              }}
            >
              {PRIORITY_LABELS[block.priority] ?? block.priority}
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{ padding: '6px 14px', fontSize: '11px', color: '#7A7774' }}>
        {block.created_by_name && <span>{block.created_by_name}</span>}
        <span style={{ margin: '0 4px' }}>·</span>
        <span>{fmtDate(block.created_at)}</span>
        {block.channel && (
          <>
            <span style={{ margin: '0 4px' }}>·</span>
            <span>{block.channel}</span>
          </>
        )}
        {block.so_number && (
          <>
            <span style={{ margin: '0 4px' }}>·</span>
            <span style={{ color: '#2DD4BF', fontWeight: 600 }}>{block.so_number}</span>
          </>
        )}
      </div>

      {/* Body */}
      {block.content && (
        <div
          dangerouslySetInnerHTML={{ __html: sanitizeAttendanceHtml(block.content) }}
          style={{ padding: '8px 14px', fontSize: '12px', color: '#C8C4BE', lineHeight: 1.6, maxHeight: '120px', overflow: 'hidden' }}
        />
      )}

      {/* Specs summary (if has fabrication data) */}
      {(block.metal || block.stone || block.product_name) && (
        <div style={{ padding: '6px 14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {block.product_name && (
            <span style={{ fontSize: '11px', color: '#C8C4BE', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 6px' }}>
              {block.product_name}
            </span>
          )}
          {block.metal && (
            <span style={{ fontSize: '11px', color: '#C8C4BE', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 6px' }}>
              {block.metal}
            </span>
          )}
          {block.stone && (
            <span style={{ fontSize: '11px', color: '#C8C4BE', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 6px' }}>
              {block.stone}
            </span>
          )}
          {block.total_cents > 0 && (
            <span style={{ fontSize: '11px', color: '#3FB87A', background: 'rgba(63,184,122,0.08)', border: '1px solid rgba(63,184,122,0.20)', borderRadius: '4px', padding: '1px 6px' }}>
              {fmt(block.total_cents)}
            </span>
          )}
        </div>
      )}

      {/* Thumbnails */}
      {block.attachments && block.attachments.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', padding: '8px 14px', flexWrap: 'wrap' }}>
          {block.attachments.slice(0, 4).map((att, idx) => (
            <div key={idx} style={{ width: '48px', height: '48px', borderRadius: '5px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              {att.type.startsWith('image/') ? (
                <img src={att.url} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : '📎'}
            </div>
          ))}
          {block.attachments.length > 4 && (
            <div style={{ width: '48px', height: '48px', borderRadius: '5px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#7A7774' }}>
              +{block.attachments.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => onEdit(block)}
          style={{ height: '28px', padding: '0 12px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '5px', color: '#C8C4BE', fontSize: '11px', cursor: 'pointer' }}
        >
          Editar
        </button>
      </div>
    </div>
  );
}
