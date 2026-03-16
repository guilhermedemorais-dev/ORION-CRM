'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, MessageCircle, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import type { CustomerFull } from './types';

interface Props {
  customer: CustomerFull;
  conversationId?: string;
  channel?: string;
  onClose: () => void;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string | null;
  status: string;
  created_at: string;
  sender_name?: string | null;
}

interface Conversation {
  id: string;
  status: string;
  channel: string;
  last_message_at: string | null;
}

function fmtTime(d: string): string {
  try {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
      ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  BOT:               { label: 'Bot',          color: '#A78BFA' },
  AGUARDANDO_HUMANO: { label: 'Aguardando',   color: '#F0A040' },
  EM_ATENDIMENTO:    { label: 'Em atendimento', color: '#3FB87A' },
  ENCERRADA:         { label: 'Encerrada',    color: '#7A7774' },
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  telegram: 'Telegram',
  messenger: 'Messenger',
  tiktok: 'TikTok',
};

export function QuickChatPanel({ customer, conversationId: initialConversationId, channel, onClose }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [minimized, setMinimized] = useState(false);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, minimized]);

  const fetchConversation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let convId = initialConversationId;

      // If no conversationId provided, search by phone
      if (!convId) {
        const q = customer.whatsapp_number.replace(/\D/g, '');
        const res = await fetch(`/api/internal/inbox/conversations?q=${encodeURIComponent(q)}&limit=5`);
        if (!res.ok) throw new Error('Erro');
        const data = await res.json();
        const list: Conversation[] = Array.isArray(data) ? data : (data.data ?? []);
        if (list.length === 0) {
          setConversation(null);
          setMessages([]);
          setLoading(false);
          return;
        }
        convId = list[0].id;
      }

      // Load conversation + messages
      const threadRes = await fetch(`/api/internal/inbox/conversations/${convId}`);
      if (!threadRes.ok) throw new Error('Erro ao carregar mensagens');
      const thread = await threadRes.json();
      const conv: Conversation = thread.conversation ?? thread;
      setConversation(conv);
      const msgs: Message[] = Array.isArray(thread.messages)
        ? thread.messages
        : (thread.data?.messages ?? thread.messages ?? []);
      setMessages(msgs.slice(-60));
    } catch {
      setError('Não foi possível carregar a conversa.');
    } finally {
      setLoading(false);
    }
  }, [initialConversationId, customer.whatsapp_number]);

  useEffect(() => { fetchConversation(); }, [fetchConversation]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!conversation) return;
    const interval = setInterval(fetchConversation, 15000);
    return () => clearInterval(interval);
  }, [conversation, fetchConversation]);

  async function handleSend() {
    if (!text.trim() || !conversation || sending) return;
    const msg = text.trim();
    setText('');
    setSendError(null);
    setSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, direction: 'outbound', text: msg, status: 'sending', created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`/api/internal/inbox/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg, kind: 'TEXT' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'Falha ao enviar');
      }
      const sent: Message = await res.json();
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...sent, direction: 'outbound' } : m));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const statusInfo = conversation ? (STATUS_BADGE[conversation.status] ?? STATUS_BADGE['EM_ATENDIMENTO']) : null;
  const canSend = conversation && !['ENCERRADA', 'BOT'].includes(conversation.status ?? '');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '24px',
        width: '340px',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,0.07)',
        background: '#111114',
        fontFamily: "'DM Sans', sans-serif",
        maxHeight: minimized ? '52px' : '520px',
        transition: 'max-height 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#141417',
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.06)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setMinimized((v) => !v)}
      >
        {/* Avatar */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'rgba(200,169,122,0.15)', border: '1px solid rgba(200,169,122,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, color: '#C8A97A', flexShrink: 0,
        }}>
          {customer.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {customer.name}
          </div>
          {channel && (
            <div style={{ fontSize: '10px', color: '#7A7774', marginTop: '1px' }}>
              via {CHANNEL_LABEL[channel] ?? channel}
            </div>
          )}
          {statusInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusInfo.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '10px', color: statusInfo.color }}>{statusInfo.label}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Atualizar"
            onClick={fetchConversation}
            style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: '#7A7774', cursor: 'pointer' }}
          >
            <RefreshCw size={11} />
          </button>
          <button
            type="button"
            title={minimized ? 'Expandir' : 'Minimizar'}
            onClick={() => setMinimized((v) => !v)}
            style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: '#7A7774', cursor: 'pointer' }}
          >
            <ChevronDown size={11} style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <button
            type="button"
            title="Fechar"
            onClick={onClose}
            style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: '#7A7774', cursor: 'pointer' }}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 12px 8px',
            display: 'flex', flexDirection: 'column', gap: '6px',
            minHeight: 0,
          }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: '#7A7774', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando conversa…
              </div>
            )}

            {!loading && error && (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <div style={{ fontSize: '12px', color: '#E05252', marginBottom: '8px' }}>{error}</div>
                <button type="button" onClick={fetchConversation} style={{ height: '26px', padding: '0 12px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '11px', cursor: 'pointer' }}>Tentar novamente</button>
              </div>
            )}

            {!loading && !error && !conversation && (
              <div style={{ textAlign: 'center', padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(63,184,122,0.08)', border: '1px solid rgba(63,184,122,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={18} color="#3FB87A" />
                </div>
                <div style={{ fontSize: '12px', color: '#C8C4BE', fontWeight: 500 }}>Nenhuma conversa ativa</div>
                <div style={{ fontSize: '11px', color: '#7A7774', lineHeight: 1.5 }}>
                  Este cliente ainda não iniciou conversa no WhatsApp.
                </div>
              </div>
            )}

            {!loading && !error && messages.length > 0 && messages.map((msg) => {
              const isOut = msg.direction === 'outbound';
              const isSending = msg.status === 'sending';
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '82%',
                    background: isOut
                      ? 'rgba(63,184,122,0.14)'
                      : '#1C1C20',
                    border: `1px solid ${isOut ? 'rgba(63,184,122,0.22)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: isOut ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '7px 10px',
                    opacity: isSending ? 0.6 : 1,
                  }}>
                    {!isOut && msg.sender_name && (
                      <div style={{ fontSize: '9px', color: '#3FB87A', fontWeight: 700, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        {msg.sender_name}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#F0EDE8', lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {msg.text ?? '(mídia)'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#7A7774', marginTop: '2px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '4px', alignItems: 'center' }}>
                      {isSending && <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} />}
                      {fmtTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Send error */}
          {sendError && (
            <div style={{ margin: '0 12px', padding: '6px 10px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', fontSize: '11px', color: '#E05252' }}>
              {sendError}
            </div>
          )}

          {/* Closed conversation notice */}
          {conversation && !canSend && (
            <div style={{ margin: '0 12px 8px', padding: '8px 10px', background: 'rgba(240,160,64,0.08)', border: '1px solid rgba(240,160,64,0.18)', borderRadius: '6px', fontSize: '11px', color: '#F0A040', textAlign: 'center' }}>
              {conversation.status === 'BOT'
                ? 'Conversa em atendimento pelo bot — aguarde ou assuma no Inbox.'
                : 'Conversa encerrada — não é possível enviar mensagens.'}
            </div>
          )}

          {/* Input */}
          {canSend && (
            <div style={{
              padding: '8px 10px 10px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: '6px',
              alignItems: 'flex-end',
              flexShrink: 0,
            }}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem… (Enter para enviar)"
                aria-label="Mensagem para o cliente"
                rows={1}
                style={{
                  flex: 1,
                  background: '#0D0D10',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '8px',
                  color: '#F0EDE8',
                  fontSize: '12px',
                  padding: '8px 10px',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.4,
                  maxHeight: '80px',
                  overflowY: 'auto',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 80) + 'px';
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim() || sending}
                title="Enviar mensagem (Enter)"
                style={{
                  width: '34px', height: '34px', flexShrink: 0,
                  background: text.trim() ? 'rgba(63,184,122,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${text.trim() ? 'rgba(63,184,122,0.30)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '8px',
                  color: text.trim() ? '#3FB87A' : '#7A7774',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: text.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
