'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AtSign, Mic, MicOff, MessageCircle, AlertCircle, X } from 'lucide-react';
import type { AttendanceBlock } from '../types';
import AI3DSection from './AI3DSection';

interface TeamUser { id: string; name: string; role: string; }

interface Props {
  customerId: string;
  block?: AttendanceBlock | null;
  onClose: () => void;
  onSaved: () => void;
  onOSCreated?: () => void;
}

type BlockType = 'atendimento' | 'consulta_peca' | 'ligacao' | 'visita' | 'email';
type PipelineStatus = 'ATENDIMENTO' | 'PROPOSTA' | 'PEDIDO' | 'OS' | 'ENTREGA';
type Priority = 'normal' | 'urgente';
type Channel = 'whatsapp' | 'presencial' | 'email';

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'atendimento',   label: 'Atendimento'     },
  { value: 'consulta_peca', label: 'Consulta de Peça' },
  { value: 'ligacao',       label: 'Ligação'          },
  { value: 'visita',        label: 'Visita'           },
  { value: 'email',         label: 'E-mail'           },
];

const PIPELINE_OPTIONS: { value: PipelineStatus; label: string; color: string }[] = [
  { value: 'ATENDIMENTO', label: 'Atendimento', color: '#C8A97A' },
  { value: 'PROPOSTA',    label: 'Proposta',    color: '#A78BFA' },
  { value: 'PEDIDO',      label: 'Pedido',      color: '#5B9CF6' },
  { value: 'OS',          label: 'OS',          color: '#2DD4BF' },
  { value: 'ENTREGA',     label: 'Entrega',     color: '#3FB87A' },
];

// CSS variables fallback — inline colors for each status
const STATUS_COLORS: Record<PipelineStatus, { bg: string; border: string; text: string }> = {
  ATENDIMENTO: { bg: 'rgba(200,169,122,0.10)', border: 'rgba(200,169,122,0.30)', text: '#C8A97A' },
  PROPOSTA:    { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)', text: '#A78BFA' },
  PEDIDO:      { bg: 'rgba(91,156,246,0.10)',  border: 'rgba(91,156,246,0.30)',  text: '#5B9CF6' },
  OS:          { bg: 'rgba(45,212,191,0.10)',  border: 'rgba(45,212,191,0.30)',  text: '#2DD4BF' },
  ENTREGA:     { bg: 'rgba(63,184,122,0.10)',  border: 'rgba(63,184,122,0.30)',  text: '#3FB87A' },
};

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'whatsapp',   label: 'WhatsApp'   },
  { value: 'presencial', label: 'Presencial' },
  { value: 'email',      label: 'E-mail'     },
];

interface PhotoPreview { name: string; dataUrl: string; file: File }
const MAX_PHOTOS = 5;

function normalizeBlockType(raw: string | undefined | null): BlockType {
  const map: Record<string, BlockType> = {
    atendimento: 'atendimento', consulta_peca: 'consulta_peca',
    ligacao: 'ligacao', visita: 'visita', email: 'email',
  };
  return map[raw ?? ''] ?? 'atendimento';
}

function normalizePipelineStatus(raw: string | undefined | null): PipelineStatus {
  const valid: PipelineStatus[] = ['ATENDIMENTO', 'PROPOSTA', 'PEDIDO', 'OS', 'ENTREGA'];
  const up = (raw ?? '').toUpperCase() as PipelineStatus;
  return valid.includes(up) ? up : 'ATENDIMENTO';
}

function parseCents(str: string): number {
  const n = parseFloat(str.replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

const inputStyle: React.CSSProperties = {
  height: '32px',
  background: '#1A1A1E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '6px',
  padding: '0 10px',
  fontSize: '12px',
  color: '#F0EDE8',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#E8E4DE',
  display: 'block',
  marginBottom: '3px',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: '#7A7774',
  paddingBottom: '6px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  marginBottom: '10px',
};

export default function AttendancePopup({ customerId, block, onClose, onSaved, onOSCreated }: Props) {
  const isNew = !block;

  const [blockType,      setBlockType]      = useState<BlockType>(normalizeBlockType(block?.block_type));
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(normalizePipelineStatus(block?.pipeline_status));
  const [title,          setTitle]          = useState(block?.title ?? '');
  const [priority,       setPriority]       = useState<Priority>('normal');
  const [channel,        setChannel]        = useState<Channel>('whatsapp');
  const [photos,         setPhotos]         = useState<PhotoPreview[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [savedBlockId,   setSavedBlockId]   = useState<string | null>(block?.id ?? null);

  // Collapsible sections
  const [specsExpanded, setSpecsExpanded] = useState(false);
  const [aiExpanded,    setAiExpanded]    = useState(false);

  // Fabrication specs
  const [productName,   setProductName]   = useState(block?.product_name ?? '');
  const [dueDate,       setDueDate]       = useState(block?.due_date?.slice(0, 10) ?? '');
  const [metal,         setMetal]         = useState(block?.metal ?? '');
  const [stone,         setStone]         = useState(block?.stone ?? '');
  const [ringSize,      setRingSize]      = useState(block?.ring_size ?? '');
  const [weightGrams,   setWeightGrams]   = useState(block?.weight_grams != null ? String(block.weight_grams) : '');
  const [finish,        setFinish]        = useState(block?.finish ?? '');
  const [engraving,     setEngraving]     = useState(block?.engraving ?? '');
  const [prongCount,    setProngCount]    = useState(block?.prong_count != null ? String(block.prong_count) : '');
  const [bandThickness, setBandThickness] = useState(block?.band_thickness != null ? String(block.band_thickness) : '');
  const [techNotes,     setTechNotes]     = useState(block?.tech_notes ?? '');
  const [designerId,    setDesignerId]    = useState(block?.designer_id ?? '');
  const [jewelerId,     setJewelerId]     = useState(block?.jeweler_id ?? '');
  const [depositStr,    setDepositStr]    = useState(block ? String((block.deposit_cents ?? 0) / 100) : '');
  const [totalStr,      setTotalStr]      = useState(block ? String((block.total_cents ?? 0) / 100) : '');

  const editorRef = useRef<HTMLDivElement>(null);

  // Restore content when editing
  useEffect(() => {
    if (editorRef.current && block?.content) {
      editorRef.current.innerHTML = block.content;
    }
  }, [block?.content]);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-expand specs when pipeline reaches OS
  useEffect(() => {
    if (pipelineStatus === 'OS' || pipelineStatus === 'PEDIDO') setSpecsExpanded(true);
  }, [pipelineStatus]);

  function execCmd(cmd: string) {
    document.execCommand(cmd, false, undefined);
    editorRef.current?.focus();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotos((prev) => [...prev, { name: file.name, dataUrl: ev.target?.result as string, file }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removePhoto(idx: number) { setPhotos((prev) => prev.filter((_, i) => i !== idx)); }

  const [recording, setRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<{ stop(): void } | null>(null);

  // @ mention
  const [mentionOpen, setMentionOpen]   = useState(false);
  const [mentionUsers, setMentionUsers] = useState<TeamUser[]>([]);
  const mentionRef = useRef<HTMLDivElement>(null);

  async function handleMention() {
    editorRef.current?.focus();
    document.execCommand('insertText', false, '@');
    if (mentionUsers.length === 0) {
      try {
        const res = await fetch('/api/internal/users?role=ATENDENTE,ADMIN,MESTRE');
        if (res.ok) {
          const json = await res.json();
          setMentionUsers(Array.isArray(json) ? json : (json.data ?? []));
        }
      } catch { /* non-fatal */ }
    }
    setMentionOpen(true);
  }

  function insertMention(user: TeamUser) {
    editorRef.current?.focus();
    document.execCommand('insertText', false, `${user.name} `);
    setMentionOpen(false);
  }

  // Close mention dropdown on outside click
  useEffect(() => {
    if (!mentionOpen) return;
    function handleClick(e: MouseEvent) {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mentionOpen]);

  function toggleRecording() {
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    interface SpeechRecognitionResult { readonly 0: { readonly transcript: string }; }
    interface SpeechRecognitionResultList extends Iterable<SpeechRecognitionResult> { readonly length: number; }
    interface SpeechRecognitionEvt { readonly results: SpeechRecognitionResultList; }
    interface SpeechRecognitionInstance {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: ((event: SpeechRecognitionEvt) => void) | null;
      onend: (() => void) | null;
      start(): void; stop(): void;
    }
    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
    const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor; };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { alert('SpeechRecognition não suportado neste navegador.'); return; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event: SpeechRecognitionEvt) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(' ');
      if (editorRef.current) editorRef.current.innerHTML += ' ' + text;
    };
    rec.onend = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  async function handleSave() {
    if (!title.trim()) return;

    // Validate OS transition
    if (pipelineStatus === 'OS' && !productName.trim()) {
      setError('Preencha o nome do produto antes de avançar para OS.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const content = editorRef.current?.innerHTML ?? '';
      const url = isNew
        ? `/api/internal/customers/${customerId}/blocks`
        : `/api/internal/blocks/${block!.id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const body = {
        title: title.trim(),
        block_type: blockType,
        content,
        status: 'open',
        priority,
        channel,
        pipeline_status: pipelineStatus,
        product_name: productName || undefined,
        due_date: dueDate || undefined,
        metal: metal || undefined,
        stone: stone || undefined,
        ring_size: ringSize || undefined,
        weight_grams: weightGrams ? parseFloat(weightGrams) : undefined,
        finish: finish || undefined,
        engraving: engraving || undefined,
        prong_count: prongCount ? parseInt(prongCount, 10) : undefined,
        band_thickness: bandThickness ? parseFloat(bandThickness) : undefined,
        tech_notes: techNotes || undefined,
        designer_id: designerId || undefined,
        jeweler_id: jewelerId || undefined,
        deposit_cents: parseCents(depositStr),
        total_cents: parseCents(totalStr),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.message ?? `Erro ${res.status} ao salvar.`);
        return;
      }

      const data = await res.json();
      const blockId = isNew ? data.id : block!.id;
      if (isNew && blockId) setSavedBlockId(blockId);

      onSaved();
      if (pipelineStatus === 'OS' && isNew) onOSCreated?.();
      onClose();
    } catch {
      setError('Falha de conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  }

  const currentStatusColors = STATUS_COLORS[pipelineStatus];
  const saveLabel = saving
    ? 'Salvando...'
    : pipelineStatus === 'OS'
    ? 'Salvar + Aprovar OS'
    : 'Salvar';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {/* 1st: block type */}
          <select
            aria-label="Tipo de bloco"
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
            style={{ ...inputStyle, width: '155px', cursor: 'pointer' }}
          >
            {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* 2nd: pipeline status (mini kanban) */}
          <select
            aria-label="Status do pipeline"
            value={pipelineStatus}
            onChange={(e) => setPipelineStatus(e.target.value as PipelineStatus)}
            style={{
              ...inputStyle,
              width: '130px',
              cursor: 'pointer',
              background: currentStatusColors.bg,
              border: `1px solid ${currentStatusColors.border}`,
              color: currentStatusColors.text,
              fontWeight: 600,
            }}
          >
            {PIPELINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* title */}
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Título do atendimento..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <button onClick={onClose} title="Fechar" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: '#7A7774', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', flexShrink: 0 }}><X size={15} /></button>
        </div>

        {/* ── TOOLBAR ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, flexWrap: 'wrap' }}>
          {([
            { cmd: 'bold',      icon: <Bold size={13} />,      title: 'Negrito (Ctrl+B)'   },
            { cmd: 'italic',    icon: <Italic size={13} />,    title: 'Itálico (Ctrl+I)'   },
            { cmd: 'underline', icon: <Underline size={13} />, title: 'Sublinhado (Ctrl+U)' },
          ] as { cmd: string; icon: ReactNode; title: string }[]).map((b) => (
            <button key={b.cmd} title={b.title} onMouseDown={(e) => { e.preventDefault(); execCmd(b.cmd); }}
              style={{ width: '28px', height: '28px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#C8C4BE', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {b.icon}
            </button>
          ))}
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
          {([
            { cmd: 'insertUnorderedList', icon: <List size={13} />,        title: 'Lista com marcadores' },
            { cmd: 'insertOrderedList',   icon: <ListOrdered size={13} />, title: 'Lista numerada'       },
          ] as { cmd: string; icon: ReactNode; title: string }[]).map((b) => (
            <button key={b.cmd} title={b.title} onMouseDown={(e) => { e.preventDefault(); execCmd(b.cmd); }}
              style={{ width: '28px', height: '28px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#C8C4BE', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {b.icon}
            </button>
          ))}
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
          {/* @ mention */}
          <div style={{ position: 'relative' }} ref={mentionRef}>
            <button
              title="Mencionar colega (@)"
              onMouseDown={(e) => { e.preventDefault(); handleMention(); }}
              style={{ width: '28px', height: '28px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#C8C4BE', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <AtSign size={13} />
            </button>
            {mentionOpen && (
              <div style={{ position: 'absolute', top: '32px', left: 0, zIndex: 200, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                {mentionUsers.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '11px', color: '#7A7774' }}>Nenhum usuário</div>
                ) : (
                  mentionUsers.map((u) => (
                    <button
                      key={u.id}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                      style={{ width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent', border: 'none', color: '#F0EDE8', fontSize: '12px', cursor: 'pointer' }}
                    >
                      {u.name}
                      <span style={{ fontSize: '10px', color: '#7A7774', marginLeft: '6px' }}>{u.role}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
          <button
            title={recording ? 'Parar gravação' : 'Gravar voz (transcreve para texto)'}
            onMouseDown={(e) => { e.preventDefault(); toggleRecording(); }}
            style={{ height: '28px', padding: '0 8px', background: recording ? 'rgba(224,82,82,0.15)' : '#1A1A1E', border: `1px solid ${recording ? 'rgba(224,82,82,0.30)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '4px', color: recording ? '#E05252' : '#C8C4BE', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {recording ? <MicOff size={13} /> : <Mic size={13} />}
            <span>{recording ? 'Parar' : 'Gravar'}</span>
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <MessageCircle size={12} style={{ color: '#7A7774', flexShrink: 0 }} />
            <select title="Canal de atendimento" value={channel} onChange={(e) => setChannel(e.target.value as Channel)} style={{ ...inputStyle, width: '100px', cursor: 'pointer' }}>
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <AlertCircle size={12} style={{ color: '#7A7774', flexShrink: 0 }} />
            <select title="Prioridade" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={{ ...inputStyle, width: '84px', cursor: 'pointer' }}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>

        {/* ── EDITOR ── */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{ minHeight: '100px', padding: '14px 20px', color: '#F0EDE8', fontSize: '13px', lineHeight: 1.6, outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
          data-placeholder="Descreva o atendimento, preferências..."
        />

        {/* ── FOTOS DE REFERÊNCIA ── */}
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {photos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }}>
                <img src={photo.dataUrl} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label style={{ width: '60px', height: '60px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A7774', fontSize: '20px', cursor: 'pointer' }}>
                +
                <input type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        {/* ── ESPECIFICAÇÕES DE FABRICAÇÃO (colapsável) ── */}
        <div style={{ margin: '0 20px 10px' }}>
          <button
            onClick={() => setSpecsExpanded((v) => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: specsExpanded ? 'rgba(45,212,191,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${specsExpanded ? 'rgba(45,212,191,0.20)' : 'rgba(255,255,255,0.08)'}`, borderRadius: specsExpanded ? '8px 8px 0 0' : '8px', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: specsExpanded ? '#2DD4BF' : '#7A7774' }}>
              ⚙️ Especificações de Fabricação
            </span>
            <span style={{ fontSize: '12px', color: '#7A7774' }}>{specsExpanded ? '▲' : '▼'}</span>
          </button>

          {specsExpanded && (
            <div style={{ background: 'rgba(45,212,191,0.03)', border: '1px solid rgba(45,212,191,0.12)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px' }}>
              {/* Nome do produto */}
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Nome do produto / peça{pipelineStatus === 'OS' ? ' *' : ''}</label>
                <input style={inputStyle} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex: Anel Solitário Ouro 18k" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select aria-label="Prioridade" style={{ ...inputStyle, cursor: 'pointer' }} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    <option value="normal">Normal</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prazo</label>
                  <input aria-label="Prazo" style={inputStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div style={sectionHeaderStyle}>Especificações</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Metal</label>
                  <select aria-label="Metal" style={{ ...inputStyle, cursor: 'pointer' }} value={metal} onChange={(e) => setMetal(e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="Ouro 18k amarelo">Ouro 18k amarelo</option>
                    <option value="Ouro 18k branco">Ouro 18k branco</option>
                    <option value="Ouro 18k rosé">Ouro 18k rosé</option>
                    <option value="Prata 950">Prata 950</option>
                    <option value="Platina">Platina</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Pedra principal</label>
                  <input style={inputStyle} value={stone} onChange={(e) => setStone(e.target.value)} placeholder="Ex: Diamante 0.30ct H/SI1" />
                </div>
                <div>
                  <label style={labelStyle}>Tamanho do aro</label>
                  <input style={inputStyle} value={ringSize} onChange={(e) => setRingSize(e.target.value)} placeholder="Ex: 17" />
                </div>
                <div>
                  <label style={labelStyle}>Peso estimado (g)</label>
                  <input style={inputStyle} value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} placeholder="Ex: 4.5" />
                </div>
                <div>
                  <label style={labelStyle}>Acabamento</label>
                  <select aria-label="Acabamento" style={{ ...inputStyle, cursor: 'pointer' }} value={finish} onChange={(e) => setFinish(e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="Polido">Polido</option>
                    <option value="Escovado">Escovado</option>
                    <option value="Fosco">Fosco</option>
                    <option value="Combinado">Combinado</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Gravação</label>
                  <input style={inputStyle} value={engraving} onChange={(e) => setEngraving(e.target.value)} placeholder="Texto a gravar..." />
                </div>
                <div>
                  <label style={labelStyle}>Nº garras</label>
                  <input style={inputStyle} value={prongCount} onChange={(e) => setProngCount(e.target.value)} placeholder="Ex: 4" type="number" min="0" />
                </div>
                <div>
                  <label style={labelStyle}>Espessura aro (mm)</label>
                  <input style={inputStyle} value={bandThickness} onChange={(e) => setBandThickness(e.target.value)} placeholder="Ex: 2.0" />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Observações técnicas</label>
                <textarea
                  style={{ ...inputStyle, height: '64px', padding: '8px 10px', resize: 'vertical' as const }}
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  placeholder="Detalhes adicionais para a equipe de produção..."
                />
              </div>

              <div style={sectionHeaderStyle}>Equipe</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Designer 3D (ID)</label>
                  <input style={inputStyle} value={designerId} onChange={(e) => setDesignerId(e.target.value)} placeholder="UUID do designer" />
                </div>
                <div>
                  <label style={labelStyle}>Ourives (ID)</label>
                  <input style={inputStyle} value={jewelerId} onChange={(e) => setJewelerId(e.target.value)} placeholder="UUID do ourives" />
                </div>
              </div>

              <div style={sectionHeaderStyle}>Valores</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Sinal / Entrada (R$)</label>
                  <input style={inputStyle} value={depositStr} onChange={(e) => setDepositStr(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label style={labelStyle}>Total (R$)</label>
                  <input style={inputStyle} value={totalStr} onChange={(e) => setTotalStr(e.target.value)} placeholder="0,00" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── IA 3D (colapsável) ── */}
        <div style={{ margin: '0 20px 14px' }}>
          <button
            onClick={() => setAiExpanded((v) => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: aiExpanded ? '8px 8px 0 0' : '8px', padding: '10px 14px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7774' }}>
              ✨ Gerar modelo 3D com IA
            </span>
            <span style={{ fontSize: '12px', color: '#7A7774' }}>{aiExpanded ? '▲' : '▼'}</span>
          </button>
          {aiExpanded && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '14px' }}>
              <AI3DSection blockId={savedBlockId} />
            </div>
          )}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{ margin: '0 20px 12px', padding: '10px 14px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', fontSize: '12px', color: '#E05252' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {pipelineStatus === 'OS' && (
            <span style={{ fontSize: '11px', color: '#2DD4BF' }}>
              ⚙️ Número SO será gerado automaticamente
            </span>
          )}
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button onClick={onClose} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              style={{
                height: '34px', padding: '0 20px',
                background: pipelineStatus === 'OS' ? 'rgba(45,212,191,0.15)' : 'rgba(200,169,122,0.15)',
                border: `1px solid ${pipelineStatus === 'OS' ? 'rgba(45,212,191,0.30)' : 'rgba(200,169,122,0.30)'}`,
                borderRadius: '7px',
                color: pipelineStatus === 'OS' ? '#2DD4BF' : '#C8A97A',
                fontSize: '12px', fontWeight: 600,
                cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
                opacity: saving || !title.trim() ? 0.7 : 1,
              }}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
