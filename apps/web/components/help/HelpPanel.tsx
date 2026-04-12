'use client';

import React, { useState } from 'react';
import { X, HelpCircle, BookOpen } from 'lucide-react';
import type { HelpContext } from '@/hooks/useHelpContext';
import { HELP_CONTENT, type HelpItem, type HelpSectionData } from './helpContent';
import { ModuleTutorial } from './ModuleTutorial';

interface Props {
  context: HelpContext;
  onClose: () => void;
}

type HelpTab = 'ajuda' | 'tutorial';

function HelpItemRow({ icon, label, description }: HelpItem) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
      <div
        style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: 'var(--orion-elevated)',
          border: '1px solid var(--orion-border-mid)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--orion-text-secondary)',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--orion-text)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--orion-text-secondary)', lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  );
}

function HelpSectionBlock({ title, items }: HelpSectionData) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.7px', color: 'var(--orion-text-muted)',
          marginBottom: 10, paddingBottom: 6,
          borderBottom: '1px solid var(--orion-border-low)',
        }}
      >
        {title}
      </div>
      {items.map((item) => (
        <HelpItemRow key={item.label} {...item} />
      ))}
    </div>
  );
}

export function HelpPanel({ context, onClose }: Props) {
  const data = HELP_CONTENT[context];
  const [activeTab, setActiveTab] = useState<HelpTab>('ajuda');

  return (
    <>
      <style>{`
        @keyframes helpSlideIn {
          from { transform: translateX(320px); }
          to   { transform: translateX(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 149,
          background: 'rgba(0,0,0,0.3)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', right: 0, top: 0,
          width: 380, height: '100vh',
          zIndex: 150,
          background: 'var(--orion-surface)',
          borderLeft: '1px solid var(--orion-border-mid)',
          boxShadow: '-8px 0 32px rgba(0,0,0,.4)',
          display: 'flex', flexDirection: 'column',
          animation: 'helpSlideIn 200ms ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px 0',
            borderBottom: '1px solid var(--orion-border-low)',
            display: 'flex', flexDirection: 'column', gap: 12,
            position: 'relative', flexShrink: 0,
          }}
        >
          {/* Top row: icon + title + close */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--orion-gold-bg)',
                border: '1px solid var(--orion-gold-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--orion-gold)',
              }}
            >
              <HelpCircle size={16} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--orion-text)' }}>Central de Ajuda</div>
              <div style={{ fontSize: 11, color: 'var(--orion-text-secondary)', marginTop: 2 }}>Documentação e tutoriais do módulo</div>
            </div>
            <button
              onClick={onClose}
              style={{
                position: 'absolute', right: 14, top: 14,
                width: 28, height: 28, borderRadius: 6,
                background: 'transparent',
                border: '1px solid var(--orion-border-mid)',
                color: 'var(--orion-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--orion-elevated)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('ajuda')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: 6,
                border: activeTab === 'ajuda' ? '1px solid var(--orion-gold-border)' : '1px solid transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 150ms',
                background: activeTab === 'ajuda' ? 'var(--orion-gold-bg)' : 'transparent',
                color: activeTab === 'ajuda' ? 'var(--orion-gold)' : 'var(--orion-text-secondary)',
              }}
            >
              <HelpCircle size={13} />
              Ajuda
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tutorial')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: 6,
                border: activeTab === 'tutorial' ? '1px solid var(--orion-gold-border)' : '1px solid transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 150ms',
                background: activeTab === 'tutorial' ? 'var(--orion-gold-bg)' : 'transparent',
                color: activeTab === 'tutorial' ? 'var(--orion-gold)' : 'var(--orion-text-secondary)',
              }}
            >
              <BookOpen size={13} />
              Tutorial
            </button>
          </div>
        </div>

        {/* Context badge */}
        <div style={{ margin: '12px 16px 0', flexShrink: 0 }}>
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--orion-gold-bg)',
              border: '1px solid var(--orion-gold-border)',
              borderRadius: 6,
              fontSize: 11, fontWeight: 600,
              color: 'var(--orion-gold)',
            }}
          >
            📍 Você está em: {data.pageTitle}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'ajuda' ? (
          <div style={{ padding: '16px 16px 20px', overflowY: 'auto', flex: 1 }}>
            {data.sections.map((section) => (
              <HelpSectionBlock key={section.title} {...section} />
            ))}
          </div>
        ) : (
          <ModuleTutorial context={context} />
        )}
      </div>
    </>
  );
}
