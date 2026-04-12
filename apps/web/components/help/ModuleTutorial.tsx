'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Lightbulb, BookOpen, Play, CheckCircle2 } from 'lucide-react';
import type { HelpContext } from '@/hooks/useHelpContext';
import { MODULE_TUTORIALS, type ModuleTutorialData, type TutorialSection, type TutorialStep } from './moduleTutorialData';

interface ModuleTutorialProps {
  context: HelpContext;
}

function TutorialStepCard({ step, index }: { step: TutorialStep; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--orion-elevated)',
        border: '1px solid var(--orion-border-mid)',
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'border-color 150ms',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            flexShrink: 0,
            background: `${step.color || '#C8A97A'}22`,
            border: `1px solid ${step.color || '#C8A97A'}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          {step.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--orion-text)' }}>
              {step.title}
            </span>
            {expanded ? (
              <ChevronDown size={14} style={{ color: 'var(--orion-text-muted)', flexShrink: 0 }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'var(--orion-text-muted)', flexShrink: 0 }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--orion-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
            {step.description}
          </div>
        </div>
      </button>

      {expanded && step.tip && (
        <div
          style={{
            margin: '0 14px 12px',
            padding: '8px 10px',
            background: `${step.color || '#C8A97A'}11`,
            border: `1px solid ${step.color || '#C8A97A'}22`,
            borderRadius: 8,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <Lightbulb size={13} style={{ color: step.color || '#C8A97A', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--orion-text)', lineHeight: 1.5, fontStyle: 'italic' }}>
            {step.tip}
          </span>
        </div>
      )}
    </div>
  );
}

function TutorialSectionBlock({ section, sectionIndex }: { section: TutorialSection; sectionIndex: number }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {collapsed ? (
          <ChevronRight size={14} style={{ color: 'var(--orion-text-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--orion-text-muted)' }} />
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.7px',
            color: 'var(--orion-text-muted)',
          }}
        >
          {section.sectionName} ({section.steps.length})
        </span>
      </button>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {section.steps.map((step, i) => (
            <TutorialStepCard key={i} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickStartChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  return (
    <div
      style={{
        margin: '0 0 16px',
        padding: 14,
        background: 'var(--orion-gold-bg)',
        border: '1px solid var(--orion-gold-border)',
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Play size={13} style={{ color: 'var(--orion-gold)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orion-gold)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Passo a passo rápido
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              background: checked[i] ? 'rgba(34,197,94,0.08)' : 'transparent',
              border: 'none',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 150ms',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                flexShrink: 0,
                border: checked[i] ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--orion-border-mid)',
                background: checked[i] ? 'rgba(34,197,94,0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {checked[i] && <CheckCircle2 size={12} style={{ color: '#22C55E' }} />}
            </div>
            <span
              style={{
                fontSize: 11,
                color: checked[i] ? 'var(--orion-text)' : 'var(--orion-text-secondary)',
                lineHeight: 1.5,
                textDecoration: checked[i] ? 'line-through' : 'none',
                opacity: checked[i] ? 0.7 : 1,
              }}
            >
              {item}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModuleTutorial({ context }: ModuleTutorialProps) {
  const data = MODULE_TUTORIALS[context];

  if (!data) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--orion-text-muted)', fontSize: 12 }}>
        <BookOpen size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
        <p>Tutorial indisponível para este módulo.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 20px', overflowY: 'auto', flex: 1 }}>
      {/* Module header */}
      <div
        style={{
          padding: '14px 16px',
          margin: '0 -16px 16px',
          background: 'linear-gradient(135deg, var(--orion-gold-bg), rgba(200,169,122,0.05))',
          borderBottom: '1px solid var(--orion-gold-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <BookOpen size={16} style={{ color: 'var(--orion-gold)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--orion-text)' }}>
            {data.moduleName}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--orion-text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {data.overview}
        </p>
      </div>

      {/* Quick start */}
      <QuickStartChecklist items={data.quickStart} />

      {/* Sections */}
      {data.sections.map((section, i) => (
        <TutorialSectionBlock key={i} section={section} sectionIndex={i} />
      ))}

      {/* Footer tip */}
      <div
        style={{
          marginTop: 20,
          padding: '12px 14px',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 10,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <Lightbulb size={14} style={{ color: '#6366F1', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            Dica Pro
          </div>
          <div style={{ fontSize: 11, color: 'var(--orion-text-secondary)', lineHeight: 1.5 }}>
            Use este tutorial como referência rápida. Com o tempo, você vai dominar todos os atalhos e fluxos naturalmente.
          </div>
        </div>
      </div>
    </div>
  );
}
