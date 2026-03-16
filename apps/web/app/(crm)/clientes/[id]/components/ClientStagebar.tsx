'use client';

import type { PipelineStage } from './types';

interface Props {
  stages: PipelineStage[];
  currentStageId: string | null;
  leadId: string | null;
  onStageChange: (stageId: string) => void;
}

export default function ClientStagebar({ stages, currentStageId, leadId, onStageChange }: Props) {
  async function handleStageClick(stageId: string) {
    if (!leadId || stageId === currentStageId) return;
    try {
      await fetch(`/api/internal/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: stageId }),
      });
      onStageChange(stageId);
    } catch {
      // silently fail — user can retry
    }
  }

  if (!stages.length) return null;

  return (
    <div
      style={{
        height: '40px',
        background: '#0F0F11',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '6px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}
    >
      {stages.map((stage) => {
        const isActive = stage.id === currentStageId;
        return (
          <button
            key={stage.id}
            onClick={() => handleStageClick(stage.id)}
            style={{
              height: '26px',
              padding: '0 10px',
              background: isActive ? 'rgba(200,169,122,0.10)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(200,169,122,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '20px',
              color: isActive ? '#C8A97A' : '#7A7774',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              cursor: leadId ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isActive ? '#C8A97A' : (stage.color || '#7A7774'),
                flexShrink: 0,
              }}
            />
            {stage.name}
          </button>
        );
      })}
    </div>
  );
}
