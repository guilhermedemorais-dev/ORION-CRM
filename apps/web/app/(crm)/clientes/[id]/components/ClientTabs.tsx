'use client';

export type TabKey =
  | 'ficha'
  | 'atendimento'
  | 'proposta'
  | 'pedidos'
  | 'os'
  | 'entrega'
  | 'historico';

interface Tab {
  key: TabKey;
  label: string;
  badge?: number;
}

interface Props {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  badges?: Partial<Record<TabKey, number>>;
}

const TABS: Tab[] = [
  { key: 'ficha', label: 'Ficha' },
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'os', label: 'OS' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'historico', label: 'Histórico' },
];

export default function ClientTabs({ activeTab, onTabChange, badges = {} }: Props) {
  return (
    <div
      style={{
        height: '44px',
        background: '#141417',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 20px',
        gap: '2px',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const badge = badges[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              height: '40px',
              padding: '0 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #C8A97A' : '2px solid transparent',
              color: isActive ? '#C8A97A' : '#7A7774',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tab.label}
            {badge !== undefined && badge > 0 && (
              <span
                style={{
                  background: 'rgba(200,169,122,0.10)',
                  border: '1px solid rgba(200,169,122,0.20)',
                  borderRadius: '20px',
                  padding: '1px 5px',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#C8A97A',
                  lineHeight: 1.4,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
