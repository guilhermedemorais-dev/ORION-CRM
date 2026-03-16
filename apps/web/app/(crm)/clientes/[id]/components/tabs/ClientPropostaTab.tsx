'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, Eye, Download, Trash2, Paperclip } from 'lucide-react';

interface Props {
  customerId: string;
}

interface ProposalPdf {
  id: string;
  name: string;
  size_bytes: number;
  url: string;
  uploaded_at: string;
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return d;
  }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PdfCard({
  pdf,
  onDelete,
}: {
  pdf: ProposalPdf;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: '#141417',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* PDF icon */}
      <div
        style={{
          width: '40px',
          height: '48px',
          borderRadius: '6px',
          background: 'rgba(224,82,82,0.12)',
          border: '1px solid rgba(224,82,82,0.22)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          gap: '2px',
        }}
      >
        <FileText size={18} color="#E05252" />
        <span style={{ fontSize: '8px', fontWeight: 700, color: '#E05252', letterSpacing: '.5px' }}>PDF</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#F0EDE8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '3px',
          }}
        >
          {pdf.name}
        </div>
        <div style={{ fontSize: '11px', color: '#7A7774', display: 'flex', gap: '10px' }}>
          <span>{fmtSize(pdf.size_bytes)}</span>
          <span>·</span>
          <span>{fmtDate(pdf.uploaded_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          title="Visualizar"
          onClick={() => window.open(pdf.url, '_blank')}
          style={{
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '6px',
            color: '#C8C4BE',
            cursor: 'pointer',
          }}
        >
          <Eye size={14} />
        </button>
        <a
          href={pdf.url}
          download={pdf.name}
          title="Baixar"
          style={{
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(91,156,246,0.08)',
            border: '1px solid rgba(91,156,246,0.20)',
            borderRadius: '6px',
            color: '#5B9CF6',
            textDecoration: 'none',
          }}
        >
          <Download size={14} />
        </a>
        <button
          title="Excluir"
          onClick={() => onDelete(pdf.id)}
          style={{
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(224,82,82,0.08)',
            border: '1px solid rgba(224,82,82,0.18)',
            borderRadius: '6px',
            color: '#E05252',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      style={{
        background: '#202026',
        borderRadius: '10px',
        height: '72px',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

export default function ClientPropostaTab({ customerId }: Props) {
  const [pdfs, setPdfs] = useState<ProposalPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPdfs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/customers/${customerId}/proposals/attachments`);
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setPdfs(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      setError('Erro ao carregar propostas.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchPdfs(); }, [fetchPdfs]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf') {
        alert('Apenas arquivos PDF são aceitos.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert('O arquivo não pode ultrapassar 20 MB.');
        return;
      }

      setUploading(true);
      try {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch(`/api/internal/customers/${customerId}/proposals/attachments`, {
          method: 'POST',
          body,
        });
        if (!res.ok) throw new Error('Upload falhou');
        const created: ProposalPdf = await res.json();
        setPdfs((prev) => [created, ...prev]);
      } catch {
        alert('Não foi possível fazer o upload. Tente novamente.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [customerId],
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Excluir esta proposta?')) return;
    try {
      await fetch(`/api/internal/customers/${customerId}/proposals/attachments/${id}`, {
        method: 'DELETE',
      });
      setPdfs((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('Não foi possível excluir. Tente novamente.');
    }
  }, [customerId]);

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        aria-label="Anexar proposta em PDF"
        title="Anexar proposta em PDF"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '16px',
            color: '#F0EDE8',
            fontWeight: 600,
            margin: 0,
          }}
        >
          Propostas
        </h2>
        <button
          title="Anexar proposta em PDF"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            height: '32px',
            padding: '0 14px',
            background: uploading ? 'rgba(200,169,122,0.06)' : 'rgba(200,169,122,0.12)',
            border: '1px solid rgba(200,169,122,0.25)',
            borderRadius: '7px',
            color: '#C8A97A',
            fontSize: '12px',
            fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? (
            <>
              <Upload size={13} />
              Enviando…
            </>
          ) : (
            <>
              <Paperclip size={13} />
              Anexar PDF
            </>
          )}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          style={{
            background: 'rgba(224,82,82,0.10)',
            border: '1px solid rgba(224,82,82,0.25)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
          <button
            onClick={fetchPdfs}
            style={{
              height: '30px',
              padding: '0 14px',
              background: 'transparent',
              border: '1px solid rgba(224,82,82,0.25)',
              borderRadius: '6px',
              color: '#E05252',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && pdfs.length === 0 && (
        <div
          style={{
            border: '2px dashed rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '48px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(200,169,122,0.08)',
              border: '1px solid rgba(200,169,122,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Paperclip size={22} color="#C8A97A" />
          </div>
          <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            Nenhuma proposta anexada
          </p>
          <p style={{ color: '#7A7774', fontSize: '12px', marginBottom: '14px' }}>
            Clique em "Anexar PDF" para adicionar propostas a este cliente.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: '30px',
              padding: '0 16px',
              background: 'rgba(200,169,122,0.10)',
              border: '1px solid rgba(200,169,122,0.22)',
              borderRadius: '6px',
              color: '#C8A97A',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Paperclip size={12} />
            Anexar primeiro PDF
          </button>
        </div>
      )}

      {/* PDF drive list */}
      {!loading && !error && pdfs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pdfs.map((pdf) => (
            <PdfCard key={pdf.id} pdf={pdf} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </>
  );
}
