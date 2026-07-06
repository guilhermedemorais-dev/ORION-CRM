'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AtSign, Mic, MicOff, MessageCircle, AlertCircle, X } from 'lucide-react';
import type { AttendanceBlock, PipelineStage } from '../types';
import AI3DSection from './AI3DSection';
import ServiceOrderModal from '../os/ServiceOrderModal';

interface TeamUser { id: string; name: string; role: string; status?: string; }

interface Props {
  customerId: string;
  block?: AttendanceBlock | null;
  pipelineStages: PipelineStage[];
  currentStageId: string | null;
  leadId: string | null;
  onStageChange: (stageId: string) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
  onOSCreated?: () => void;
}

type BlockType = 'atendimento' | 'consulta_peca' | 'ligacao' | 'visita' | 'email';
type PipelineStatus = 'ATENDIMENTO' | 'PROPOSTA' | 'PEDIDO' | 'OS' | 'ENTREGA';
type Priority = 'normal' | 'urgente';
type Channel = 'whatsapp' | 'presencial' | 'email';

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'whatsapp',   label: 'WhatsApp'   },
  { value: 'presencial', label: 'Presencial' },
  { value: 'email',      label: 'E-mail'     },
];

interface PhotoPreview { name: string; dataUrl: string; file: File }
const MAX_PHOTOS = 5;
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

export default function AttendancePopup({
  customerId,
  block,
  pipelineStages,
  currentStageId,
  leadId,
  onStageChange,
  onClose,
  onSaved,
  onOSCreated,
}: Props) {
  const blockType = normalizeBlockType(block?.block_type);
  const blockPipelineStatus = normalizePipelineStatus(block?.pipeline_status);
  const [selectedStageId, setSelectedStageId] = useState(currentStageId ?? '');
  const [title,          setTitle]          = useState(block?.title ?? '');
  const [priority,       setPriority]       = useState<Priority>('normal');
  const [channel,        setChannel]        = useState<Channel>('whatsapp');
  const [photos,         setPhotos]         = useState<PhotoPreview[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [savedBlockId,   setSavedBlockId]   = useState<string | null>(block?.id ?? null);

  const [serviceOrderExpanded, setServiceOrderExpanded] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  // Restore content when editing
  useEffect(() => {
    if (editorRef.current && block?.content) {
      editorRef.current.innerHTML = sanitizeAttendanceHtml(block.content);
    }
  }, [block?.content]);

  useEffect(() => {
    setSelectedStageId(currentStageId ?? '');
  }, [currentStageId]);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
        const res = await fetch('/api/internal/users?role=ROOT,ADMIN,GERENTE,ATENDENTE,PRODUCAO');
        if (res.ok) {
          const json = await res.json();
          const users = Array.isArray(json) ? json : (json.data ?? []);
          setMentionUsers(users.filter((user: TeamUser) => user.status !== 'inactive'));
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

  async function persistAttendance(targetPipelineStatus: PipelineStatus): Promise<string> {
    const content = sanitizeAttendanceHtml(editorRef.current?.innerHTML ?? '');
    const existingBlockId = savedBlockId ?? block?.id ?? null;
    const url = existingBlockId
      ? `/api/internal/blocks/${existingBlockId}`
      : `/api/internal/customers/${customerId}/blocks`;
    const method = existingBlockId ? 'PATCH' : 'POST';
    const body = {
      title: title.trim(),
      block_type: blockType,
      ...(method === 'POST' && leadId ? { lead_id: leadId } : {}),
      content,
      status: 'open',
      priority,
      channel,
      pipeline_status: targetPipelineStatus,
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message ?? `Erro ${res.status} ao salvar.`);
    }

    const data = await res.json();
    const blockId = existingBlockId ?? data.id ?? data.data?.id;
    if (!blockId) throw new Error('O atendimento foi salvo sem identificador.');
    if (!existingBlockId) setSavedBlockId(blockId);
    return blockId;
  }

  async function handleSave() {
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    try {
      await persistAttendance(blockPipelineStatus);
      if (selectedStageId && selectedStageId !== currentStageId) {
        await onStageChange(selectedStageId);
      }

      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha de conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  }

  async function prepareAttendanceForServiceOrder(): Promise<string> {
    if (!title.trim()) throw new Error('Informe o título do atendimento.');
    setError(null);
    const blockId = await persistAttendance(blockPipelineStatus);
    if (selectedStageId && selectedStageId !== currentStageId) {
      await onStageChange(selectedStageId);
    }
    return blockId;
  }

  const selectedStage = pipelineStages.find((stage) => stage.id === selectedStageId) ?? null;
  const saveLabel = saving
    ? 'Salvando...'
    : 'Salvar';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', width: '100%', maxWidth: serviceOrderExpanded ? '900px' : '720px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {/* Uses the lead's real pipeline stages and persists the move on save. */}
          <select
            aria-label="Etapa da pipeline"
            title={leadId ? 'A etapa será atualizada ao salvar' : 'Cliente sem lead vinculado ao pipeline'}
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            disabled={!leadId || pipelineStages.length === 0}
            style={{
              ...inputStyle,
              width: '180px',
              cursor: leadId && pipelineStages.length > 0 ? 'pointer' : 'not-allowed',
              background: selectedStage ? `${selectedStage.color}18` : '#1A1A1E',
              border: `1px solid ${selectedStage?.color ?? 'rgba(255,255,255,0.10)'}`,
              color: selectedStage?.color ?? '#7A7774',
              fontWeight: 600,
              opacity: leadId && pipelineStages.length > 0 ? 1 : 0.7,
            }}
          >
            {!selectedStageId && pipelineStages.length > 0 && (
              <option value="">Selecione uma etapa</option>
            )}
            {pipelineStages.length === 0 && (
              <option value="">{leadId ? 'Pipeline sem etapas' : 'Sem lead no pipeline'}</option>
            )}
            {pipelineStages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.name}</option>
            ))}
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

        {/* ── ORDEM DE SERVIÇO (colapsável e independente da etapa) ── */}
        <div style={{ margin: '0 20px 14px' }}>
          <button
            onClick={() => setServiceOrderExpanded((value) => !value)}
            aria-expanded={serviceOrderExpanded}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: serviceOrderExpanded ? 'rgba(45,212,191,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${serviceOrderExpanded ? 'rgba(45,212,191,0.20)' : 'rgba(255,255,255,0.08)'}`, borderRadius: serviceOrderExpanded ? '8px 8px 0 0' : '8px', padding: '10px 14px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: serviceOrderExpanded ? '#2DD4BF' : '#7A7774' }}>
              Ordem de Serviço
            </span>
            <span style={{ fontSize: '12px', color: '#7A7774' }}>{serviceOrderExpanded ? '▲' : '▼'}</span>
          </button>
          {serviceOrderExpanded && (
            <ServiceOrderModal
              customerId={customerId}
              embedded
              submitBlocked={!title.trim()}
              onBeforeCreate={prepareAttendanceForServiceOrder}
              onClose={() => setServiceOrderExpanded(false)}
              onSaved={() => {
                onSaved();
                onOSCreated?.();
              }}
            />
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
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button onClick={onClose} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              style={{
                height: '34px', padding: '0 20px',
                background: 'rgba(200,169,122,0.15)',
                border: '1px solid rgba(200,169,122,0.30)',
                borderRadius: '7px',
                color: '#C8A97A',
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
