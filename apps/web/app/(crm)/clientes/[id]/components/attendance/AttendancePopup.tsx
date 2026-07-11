'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AtSign, Mic, MicOff, X } from 'lucide-react';
import { notify } from '@/lib/toast';
import type { AttendanceBlock, PipelineStage } from '../types';
import AI3DSection from './AI3DSection';
import ServiceOrderModal from '../os/ServiceOrderModal';

// TASK-002 (#9): o popup de Atendimento E o modal do mockup
// docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html,
// dividido nas 2 abas do fluxo: "1. Anotacoes e fotos" (bloco de notas REAL do
// atendimento — unico bloco de notas, com persistencia via blocks) e
// "2. Cotacao" (OS multi-peca, pane do ServiceOrderModal). O layout antigo
// (editor solto + dropdown "Ordem de Servico") foi REMOVIDO — sem caixas redundantes.

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
type WorkflowTab = 'notes' | 'cotacao';

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'whatsapp',   label: 'WhatsApp'   },
  { value: 'presencial', label: 'Presencial' },
  { value: 'email',      label: 'E-mail'     },
];

interface PhotoPreview { name: string; dataUrl: string; file: File }
const MAX_PHOTOS = 8;
const ALLOWED_ATTENDANCE_TAGS = new Set(['A', 'B', 'BR', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'U', 'UL']);
const REMOVE_WITH_CONTENT_TAGS = new Set(['BUTTON', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'MATH', 'OBJECT', 'OPTION', 'SCRIPT', 'SELECT', 'STYLE', 'SVG', 'TEXTAREA']);

// ---- Tokens do mockup (:root do mockup-2026-06-15) ----
const V = {
  base: '#0F0F11',
  surface: '#131316',
  elevated: '#1A1A1E',
  gold: '#BFA06A',
  goldDim: 'rgba(191,160,106,0.11)',
  goldBorder: 'rgba(191,160,106,0.28)',
  text: '#F0EBE3',
  secondary: '#A09A94',
  muted: '#66616A',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.11)',
  red: '#E05252',
  blue: '#4A9EFF',
  strip: '#111113',
} as const;

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

const control: React.CSSProperties = {
  minHeight: '34px',
  border: `1px solid ${V.borderMid}`,
  background: V.elevated,
  color: V.text,
  borderRadius: '7px',
  padding: '0 11px',
  outline: 'none',
  fontSize: '12px',
  boxSizing: 'border-box',
  width: '100%',
  fontFamily: 'Inter, sans-serif',
};

const toolCss: React.CSSProperties = {
  minWidth: '29px', height: '29px', border: `1px solid ${V.border}`, background: V.elevated,
  color: V.secondary, borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const btn: React.CSSProperties = {
  minHeight: '34px', borderRadius: '7px', padding: '0 13px', fontSize: '11px', fontWeight: 750,
  border: `1px solid ${V.borderMid}`, background: V.elevated, color: V.secondary, cursor: 'pointer',
};
const btnGold: React.CSSProperties = { ...btn, background: V.gold, borderColor: V.gold, color: '#111' };
const btnBlue: React.CSSProperties = { ...btn, background: 'rgba(74,158,255,0.12)', borderColor: 'rgba(74,158,255,0.25)', color: V.blue };

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
  const [tab,            setTab]            = useState<WorkflowTab>('notes');
  const [selectedStageId, setSelectedStageId] = useState(currentStageId ?? '');
  const [title,          setTitle]          = useState(block?.title ?? '');
  const [priority,       setPriority]       = useState<Priority>('normal');
  const [channel,        setChannel]        = useState<Channel>('whatsapp');
  const [photos,         setPhotos]         = useState<PhotoPreview[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [savedBlockId,   setSavedBlockId]   = useState<string | null>(block?.id ?? null);
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

  // "Salvar anotacoes" = salva o rascunho do atendimento SEM gerar proposta e sem fechar
  // (page-spec: regras dos botoes da aba Anotacoes).
  async function handleSaveNotes() {
    if (!title.trim()) { setError('Informe o título do atendimento.'); return; }
    setSaving(true);
    setError(null);
    try {
      await persistAttendance(blockPipelineStatus);
      if (selectedStageId && selectedStageId !== currentStageId) {
        await onStageChange(selectedStageId);
      }
      onSaved();
      notify.success('Anotações salvas', 'Rascunho do atendimento');
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* .modal — o popup INTEIRO segue o mockup */}
      <div
        style={{ background: V.base, border: `1px solid ${V.borderMid}`, borderRadius: '12px', width: '100%', maxWidth: '1080px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* .modal-head: etapa da pipeline + titulo do atendimento + fechar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 18px', borderBottom: `1px solid ${V.border}`, flexShrink: 0 }}>
          <select
            aria-label="Etapa da pipeline"
            title={leadId ? 'A etapa será atualizada ao salvar' : 'Cliente sem lead vinculado ao pipeline'}
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            disabled={!leadId || pipelineStages.length === 0}
            style={{
              ...control,
              width: '180px',
              flexShrink: 0,
              cursor: leadId && pipelineStages.length > 0 ? 'pointer' : 'not-allowed',
              background: selectedStage ? `${selectedStage.color}18` : V.elevated,
              border: `1px solid ${selectedStage?.color ?? V.borderMid}`,
              color: selectedStage?.color ?? V.muted,
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

          <input
            style={{ ...control, flex: 1 }}
            placeholder="Título do atendimento..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <button onClick={onClose} title="Fechar" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: V.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', flexShrink: 0 }}><X size={15} /></button>
        </div>

        {/* .workflow-tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '9px 18px 0', background: V.strip, borderBottom: `1px solid ${V.border}`, flexShrink: 0 }}>
          {([{ key: 'notes', label: '1. Anotações e fotos' }, { key: 'cotacao', label: '2. Cotação' }] as const).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  minHeight: '35px', padding: '0 16px', borderRadius: '7px 7px 0 0', cursor: 'pointer',
                  border: `1px solid ${active ? V.goldBorder : 'transparent'}`, borderBottom: 0,
                  background: active ? V.base : 'transparent',
                  color: active ? V.gold : V.muted, fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'notes' ? (
          <>
            {/* ---------- 1. ANOTACOES E FOTOS (.notes-layout) — bloco de notas UNICO e real ---------- */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 18px 22px' }}>
              <div style={{ border: `1px solid ${V.border}`, background: '#101012', borderRadius: '9px', overflow: 'hidden' }}>
                {/* .notes-toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 10px', borderBottom: `1px solid ${V.border}`, background: V.surface, flexWrap: 'wrap' }}>
                  {([
                    { cmd: 'bold',      icon: <Bold size={13} />,      title: 'Negrito (Ctrl+B)'    },
                    { cmd: 'italic',    icon: <Italic size={13} />,    title: 'Itálico (Ctrl+I)'    },
                    { cmd: 'underline', icon: <Underline size={13} />, title: 'Sublinhado (Ctrl+U)' },
                    { cmd: 'insertUnorderedList', icon: <List size={13} />,        title: 'Lista com marcadores' },
                    { cmd: 'insertOrderedList',   icon: <ListOrdered size={13} />, title: 'Lista numerada'       },
                  ] as { cmd: string; icon: ReactNode; title: string }[]).map((b) => (
                    <button key={b.cmd} type="button" title={b.title} onMouseDown={(e) => { e.preventDefault(); execCmd(b.cmd); }} style={toolCss}>
                      {b.icon}
                    </button>
                  ))}
                  {/* @ mention */}
                  <div style={{ position: 'relative' }} ref={mentionRef}>
                    <button type="button" title="Mencionar colega (@)" onMouseDown={(e) => { e.preventDefault(); handleMention(); }} style={toolCss}>
                      <AtSign size={13} />
                    </button>
                    {mentionOpen && (
                      <div style={{ position: 'absolute', top: '32px', left: 0, zIndex: 200, background: V.elevated, border: `1px solid ${V.borderMid}`, borderRadius: '6px', minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                        {mentionUsers.length === 0 ? (
                          <div style={{ padding: '8px 12px', fontSize: '11px', color: V.muted }}>Nenhum usuário</div>
                        ) : (
                          mentionUsers.map((u) => (
                            <button
                              key={u.id}
                              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                              style={{ width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent', border: 'none', color: V.text, fontSize: '12px', cursor: 'pointer' }}
                            >
                              {u.name}
                              <span style={{ fontSize: '10px', color: V.muted, marginLeft: '6px' }}>{u.role}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {/* gravacao de voz */}
                  <button
                    type="button"
                    title={recording ? 'Parar gravação' : 'Gravar voz (transcreve para texto)'}
                    onMouseDown={(e) => { e.preventDefault(); toggleRecording(); }}
                    style={{ ...toolCss, minWidth: undefined, padding: '0 8px', gap: '5px', background: recording ? 'rgba(224,82,82,0.15)' : V.elevated, border: `1px solid ${recording ? 'rgba(224,82,82,0.30)' : V.border}`, color: recording ? V.red : V.secondary }}
                  >
                    {recording ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{recording ? 'Parar' : 'Gravar'}</span>
                  </button>
                  <span style={{ flex: 1 }} />
                  <select aria-label="Canal de atendimento" title="Canal de atendimento" value={channel} onChange={(e) => setChannel(e.target.value as Channel)} style={{ ...control, width: '105px', minHeight: '29px', cursor: 'pointer' }}>
                    {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <select aria-label="Prioridade" title="Prioridade" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={{ ...control, width: '90px', minHeight: '29px', cursor: 'pointer' }}>
                    <option value="normal">Normal</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                {/* .editor (real, sanitizado e persistido) */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Anotações do atendimento"
                  data-placeholder="Descreva o atendimento, preferências..."
                  style={{ minHeight: '150px', padding: '15px 20px', color: V.text, fontSize: '12px', lineHeight: 1.6, outline: 'none' }}
                />

                {/* .photo-section */}
                <div style={{ borderTop: `1px solid ${V.border}`, padding: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: V.text }}>Fotos e referências do atendimento</div>
                      <div style={{ marginTop: '4px', fontSize: '9px', lineHeight: 1.35, color: V.muted }}>Anexe fotos das joias desejadas, desenhos, medidas ou referências enviadas pelo cliente</div>
                    </div>
                    <span style={{ fontSize: '9px', color: V.secondary, flexShrink: 0 }}>{photos.length} de {MAX_PHOTOS} fotos</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {photos.map((photo, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '82px', height: '82px', border: `1px solid ${V.borderMid}`, borderRadius: '8px', overflow: 'hidden', backgroundColor: '#171719', backgroundImage: `url(${photo.dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <small style={{ position: 'absolute', left: '4px', right: '4px', bottom: '4px', padding: '2px 4px', borderRadius: '4px', background: 'rgba(0,0,0,0.72)', color: V.secondary, fontSize: '7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.name}</small>
                        <button type="button" onClick={() => removePhoto(idx)} aria-label={`Remover ${photo.name}`} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', border: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <label style={{ width: '82px', height: '82px', border: `1px dashed ${V.goldBorder}`, background: V.goldDim, color: V.gold, borderRadius: '8px', fontSize: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
                        <b style={{ fontSize: '20px', fontWeight: 400 }}>＋</b><span>Adicionar foto</span>
                        <input type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* .notes-hint */}
              <div style={{ display: 'flex', gap: '7px', marginTop: '12px', padding: '9px 10px', border: '1px solid rgba(74,158,255,0.18)', background: 'rgba(74,158,255,0.06)', color: '#82BAFF', borderRadius: '7px', fontSize: '10px', lineHeight: 1.45 }}>
                <span>→</span>
                <span>Depois de registrar as informações do atendimento, avance para <strong>Cotação</strong> para criar uma ou mais peças, selecionar materiais e montar a proposta.</span>
              </div>

              {/* IA 3D (funcionalidade existente, contexto do atendimento) */}
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setAiExpanded((v) => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: `1px solid ${V.border}`, borderRadius: aiExpanded ? '8px 8px 0 0' : '8px', padding: '10px 14px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.muted }}>
                    ✨ Gerar modelo 3D com IA
                  </span>
                  <span style={{ fontSize: '12px', color: V.muted }}>{aiExpanded ? '▲' : '▼'}</span>
                </button>
                {aiExpanded && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${V.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '14px' }}>
                    <AI3DSection blockId={savedBlockId} />
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', fontSize: '12px', color: V.red }}>
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* .modal-foot (aba Anotacoes) */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${V.border}`, background: V.strip }}>
              <span style={{ color: V.muted, fontSize: '10px' }}>{photos.length} foto(s) anexada(s)</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={onClose} style={btn}>Cancelar</button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={saving || !title.trim()}
                style={{ ...btnBlue, opacity: saving || !title.trim() ? 0.6 : 1, cursor: saving || !title.trim() ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Salvando...' : 'Salvar anotações'}
              </button>
              <button type="button" onClick={() => setTab('cotacao')} style={btnGold}>Ir para cotação →</button>
            </div>
          </>
        ) : (
          /* ---------- 2. COTACAO — pane do ServiceOrderModal ocupa o modal inteiro ---------- */
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <ServiceOrderModal
              customerId={customerId}
              embedded
              submitBlocked={!title.trim()}
              onBeforeCreate={prepareAttendanceForServiceOrder}
              onClose={onClose}
              onSaved={() => {
                onSaved();
                onOSCreated?.();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
