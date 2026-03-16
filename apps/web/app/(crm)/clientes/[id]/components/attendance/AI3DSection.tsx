'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AIRender } from '../types';

interface Props {
  blockId: string | null;
  onApprove?: (renderId: string) => void;
}

interface AI3DParams {
  piece_type: string;
  metal: string;
  stone: string;
  band_size: string;
  finish: string;
  ring_size: string;
  details: string;
}

const ringAnimStyle = `
@keyframes spina{from{transform:rotateY(0deg) rotateX(10deg)}to{transform:rotateY(360deg) rotateX(10deg)}}
@keyframes spinb{from{transform:rotateY(30deg) rotateX(10deg)}to{transform:rotateY(390deg) rotateX(10deg)}}
@keyframes spinc{from{transform:rotateY(60deg) rotateX(10deg)}to{transform:rotateY(420deg) rotateX(10deg)}}
`;

function RingView({ delay, animName }: { delay: string; animName: string }) {
  return (
    <div
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '7px solid transparent',
        background: `linear-gradient(#070708,#070708) padding-box, linear-gradient(135deg,#d4a96a,#f0d080,#c8a040) border-box`,
        boxShadow: '0 0 18px rgba(200,169,122,0.4)',
        animation: `${animName} 6s linear infinite`,
        animationDelay: delay,
      }}
    />
  );
}

function AI3DResult({
  render,
  blockId,
  onApprove,
  onRegen,
}: {
  render: AIRender;
  blockId: string | null;
  onApprove?: (id: string) => void;
  onRegen: () => void;
}) {
  const [adjForm, setAdjForm] = useState({
    band_thickness: render.band_thickness ?? 2,
    setting_height: render.setting_height ?? 3,
    prong_count: render.prong_count ?? 4,
    band_profile: render.band_profile ?? 'confort',
  });
  const [adjusting, setAdjusting] = useState(false);

  async function handleApprove() {
    if (!blockId) return;
    await fetch(`/api/internal/renders/${render.id}/approve`, {
      method: 'PATCH',
    });
    onApprove?.(render.id);
  }

  async function handleAdjust() {
    setAdjusting(true);
    try {
      await fetch(`/api/internal/renders/${render.id}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjForm),
      });
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div
      style={{
        background: '#1A1A1E',
        border: '1px solid rgba(200,169,122,0.15)',
        borderRadius: '8px',
        padding: '14px',
        marginTop: '10px',
      }}
    >
      <style>{ringAnimStyle}</style>
      {/* 3 ring views */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <RingView animName="spina" delay="0s" />
          <span style={{ fontSize: '9px', color: '#7A7774' }}>Frente</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <RingView animName="spinb" delay="0.5s" />
          <span style={{ fontSize: '9px', color: '#7A7774' }}>Topo</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <RingView animName="spinc" delay="1s" />
          <span style={{ fontSize: '9px', color: '#7A7774' }}>Lado</span>
        </div>
      </div>

      {/* Adjustment Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Espessura do aro', key: 'band_thickness', type: 'number' },
          { label: 'Altura da cravação', key: 'setting_height', type: 'number' },
          { label: 'Nº de garras', key: 'prong_count', type: 'number' },
          { label: 'Perfil do aro', key: 'band_profile', type: 'text' },
        ].map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: '10px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>
              {f.label}
            </label>
            <input
              type={f.type}
              value={String(adjForm[f.key as keyof typeof adjForm])}
              onChange={(e) => setAdjForm((prev) => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
              style={{
                height: '30px',
                width: '100%',
                background: '#141417',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '5px',
                padding: '0 8px',
                fontSize: '11px',
                color: '#F0EDE8',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => {
            const num = '';
            window.open(`https://wa.me/?text=Veja+o+modelo+3D+do+seu+pedido`, '_blank');
          }}
          style={{
            height: '28px',
            padding: '0 10px',
            background: 'rgba(63,184,122,0.10)',
            border: '1px solid rgba(63,184,122,0.25)',
            borderRadius: '5px',
            color: '#3FB87A',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          💬 WA
        </button>
        <button
          onClick={onRegen}
          style={{
            height: '28px',
            padding: '0 10px',
            background: '#1A1A1E',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '5px',
            color: '#C8C4BE',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          🔄 Regerar
        </button>
        <button
          onClick={handleAdjust}
          disabled={adjusting}
          style={{
            height: '28px',
            padding: '0 10px',
            background: '#1A1A1E',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '5px',
            color: '#C8C4BE',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Ajustar
        </button>
        <button
          onClick={handleApprove}
          style={{
            height: '28px',
            padding: '0 10px',
            background: 'rgba(63,184,122,0.10)',
            border: '1px solid rgba(63,184,122,0.25)',
            borderRadius: '5px',
            color: '#3FB87A',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✓ Aprovado → Criar OS
        </button>
      </div>
    </div>
  );
}

export default function AI3DSection({ blockId, onApprove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [render, setRender] = useState<AIRender | null>(null);
  const [pollId, setPollId] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [params, setParams] = useState<AI3DParams>({
    piece_type: 'anel',
    metal: 'ouro amarelo',
    stone: 'diamante',
    band_size: 'fino',
    finish: 'polido',
    ring_size: '16',
    details: '',
  });

  const pollRender = useCallback(async (renderId: string) => {
    const res = await fetch(`/api/internal/renders/${renderId}`);
    if (res.ok) {
      const data: AIRender = await res.json();
      if (data.status === 'done' || data.status === 'completed') {
        setRender(data);
        setLoading(false);
        setPollId(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!pollId) return;
    const interval = setInterval(() => pollRender(pollId), 2000);
    return () => clearInterval(interval);
  }, [pollId, pollRender]);

  async function handleGenerate() {
    if (!blockId) return;
    setLoading(true);
    setRender(null);
    try {
      const res = await fetch(`/api/internal/blocks/${blockId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        setPollId(data.id ?? data.render_id ?? null);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    height: '30px',
    background: '#141417',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '5px',
    padding: '0 8px',
    fontSize: '11px',
    color: '#F0EDE8',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        background: 'rgba(167,139,250,0.06)',
        border: '1px solid rgba(167,139,250,0.15)',
        borderRadius: '8px',
        overflow: 'hidden',
        marginTop: '10px',
      }}
    >
      {/* Collapsed */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span>🤖</span>
          <span style={{ fontSize: '12px', color: '#A78BFA', fontWeight: 500 }}>
            Gerar modelo 3D com IA
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowComingSoon(true);
          }}
          style={{
            height: '26px',
            padding: '0 10px',
            background: 'rgba(167,139,250,0.12)',
            border: '1px solid rgba(167,139,250,0.25)',
            borderRadius: '5px',
            color: '#A78BFA',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✨ Gerar
        </button>
      </div>

      {/* Coming soon notice */}
      {showComingSoon && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(167,139,250,0.10)' }}>
          <div style={{
            marginTop: '12px',
            background: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(167,139,250,0.20)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚀</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#A78BFA', marginBottom: '4px' }}>Função em breve</div>
            <div style={{ fontSize: '11px', color: '#7A7774', marginBottom: '12px' }}>
              A geração de modelos 3D com IA está em desenvolvimento e será disponibilizada em breve.
            </div>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{
                height: '26px', padding: '0 12px',
                background: 'transparent',
                border: '1px solid rgba(167,139,250,0.25)',
                borderRadius: '5px', color: '#A78BFA',
                fontSize: '11px', cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Expanded */}
      {expanded && !showComingSoon && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(167,139,250,0.10)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            {[
              { label: 'Tipo de peça', key: 'piece_type', options: ['anel', 'colar', 'pulseira', 'brinco', 'pingente'] },
              { label: 'Metal', key: 'metal', options: ['ouro amarelo', 'ouro branco', 'ouro rosé', 'prata', 'platina'] },
              { label: 'Pedra principal', key: 'stone', options: ['diamante', 'safira', 'rubi', 'esmeralda', 'sem pedra'] },
              { label: 'Tamanho do aro', key: 'ring_size', options: ['13','14','15','16','17','18','19','20'] },
              { label: 'Acabamento', key: 'finish', options: ['polido', 'fosco', 'diamantado', 'escovado'] },
              { label: 'Perfil', key: 'band_size', options: ['fino', 'médio', 'largo', 'confort'] },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: '10px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>
                  {f.label}
                </label>
                <select
                  aria-label={f.label}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={params[f.key as keyof AI3DParams]}
                  onChange={(e) => setParams((prev) => ({ ...prev, [f.key]: e.target.value }))}
                >
                  {f.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '10px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>
                Detalhes adicionais
              </label>
              <textarea
                value={params.details}
                onChange={(e) => setParams((prev) => ({ ...prev, details: e.target.value }))}
                placeholder="Descreva detalhes específicos da peça..."
                style={{
                  ...inputStyle,
                  height: 'auto',
                  minHeight: '52px',
                  padding: '6px 8px',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <button
            onClick={() => { setExpanded(false); setShowComingSoon(true); }}
            disabled={loading || !blockId}
            style={{
              marginTop: '10px',
              height: '32px',
              width: '100%',
              background: loading ? '#141417' : 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: '6px',
              color: '#A78BFA',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading || !blockId ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(167,139,250,0.3)',
                    borderTopColor: '#A78BFA',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Gerando modelo 3D...
              </>
            ) : (
              '✨ Gerar modelo 3D'
            )}
          </button>

          {render && (
            <AI3DResult
              render={render}
              blockId={blockId}
              onApprove={onApprove}
              onRegen={handleGenerate}
            />
          )}
        </div>
      )}
    </div>
  );
}
