'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface ParsedRow {
    name: string;
    whatsapp_number: string;
    source: string;
    email: string | null;
    raw: Record<string, string>;
}

interface ImportResult {
    success: number;
    duplicate: number;
    errors: { row: number; message: string }[];
}

interface LeadsImportDialogProps {
    pipelineId: string;
    onClose: () => void;
    onImported: () => Promise<void> | void;
}

const SOURCE_VALUES = ['WHATSAPP', 'BALCAO', 'INDICACAO', 'INSTAGRAM', 'OUTRO'];

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

function stripBom(text: string): string {
    if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
    return text;
}

function isLikelyTextCsv(text: string): boolean {
    // Reject obvious binaries (NUL bytes in first 4KB indicate binary).
    const probe = text.slice(0, 4096);
    for (let i = 0; i < probe.length; i++) {
        if (probe.charCodeAt(i) === 0) return false;
    }
    return true;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const cleaned = stripBom(text);
    const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    const splitLine = (line: string) => {
        const out: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                out.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur);
        return out.map((c) => c.trim());
    };
    const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
    const rows = lines.slice(1).map(splitLine);
    return { headers, rows };
}

function normalizePhone(input: string): string {
    const cleaned = input.replace(/\D/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('55') && cleaned.length >= 12) return `+${cleaned}`;
    if (cleaned.length >= 10) return `+55${cleaned}`;
    return `+${cleaned}`;
}

function normalizeSource(input: string): string {
    const upper = (input || '').toUpperCase().trim();
    return SOURCE_VALUES.includes(upper) ? upper : 'OUTRO';
}

const NAME_KEYS = ['name', 'nome', 'lead', 'cliente'];
const PHONE_KEYS = ['whatsapp', 'whatsapp_number', 'telefone', 'phone', 'celular', 'numero'];
const SOURCE_KEYS = ['source', 'origem', 'canal'];
const EMAIL_KEYS = ['email', 'e-mail'];

function findKey(headers: string[], options: string[]): number {
    for (const opt of options) {
        const idx = headers.indexOf(opt);
        if (idx >= 0) return idx;
    }
    return -1;
}

export function LeadsImportDialog({ pipelineId, onClose, onImported }: LeadsImportDialogProps) {
    const [step, setStep] = useState<Step>('upload');
    const [fileName, setFileName] = useState<string>('');
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState<ImportResult | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && step !== 'importing') onClose();
        };
        document.addEventListener('keydown', onEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onEsc);
            document.body.style.overflow = '';
        };
    }, [onClose, step]);

    async function handleFile(file: File) {
        setParseError(null);
        setFileName(file.name);
        if (file.size > MAX_CSV_BYTES) {
            setParseError(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 5 MB.`);
            return;
        }
        const text = await file.text();
        if (!isLikelyTextCsv(text)) {
            setParseError('O arquivo não parece ser um CSV de texto válido.');
            return;
        }
        const { headers, rows: rawRows } = parseCsv(text);
        if (headers.length === 0 || rawRows.length === 0) {
            setParseError('Arquivo CSV vazio ou sem cabeçalho.');
            return;
        }
        const nameIdx = findKey(headers, NAME_KEYS);
        const phoneIdx = findKey(headers, PHONE_KEYS);
        const sourceIdx = findKey(headers, SOURCE_KEYS);
        const emailIdx = findKey(headers, EMAIL_KEYS);
        if (nameIdx < 0 || phoneIdx < 0) {
            setParseError(`Cabeçalho deve incluir uma coluna "nome" e uma de "whatsapp"/"telefone". Encontrado: ${headers.join(', ')}`);
            return;
        }
        const parsed: ParsedRow[] = rawRows.map((r) => {
            const raw: Record<string, string> = {};
            headers.forEach((h, i) => { raw[h] = r[i] ?? ''; });
            return {
                name: r[nameIdx] ?? '',
                whatsapp_number: normalizePhone(r[phoneIdx] ?? ''),
                source: normalizeSource(sourceIdx >= 0 ? r[sourceIdx] ?? '' : 'WHATSAPP'),
                email: emailIdx >= 0 ? (r[emailIdx] || null) : null,
                raw,
            };
        }).filter((r) => r.name.trim().length > 0 && r.whatsapp_number.length > 3);

        if (parsed.length === 0) {
            setParseError('Nenhuma linha válida encontrada após processar o CSV.');
            return;
        }
        setRows(parsed);
        setStep('preview');
    }

    function onChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
    }

    async function startImport() {
        setStep('importing');
        setProgress({ done: 0, total: rows.length });
        const errors: ImportResult['errors'] = [];
        let success = 0;
        let duplicate = 0;
        let done = 0;

        const CONCURRENCY = 8;
        const sendOne = async (row: ParsedRow, rowIndex: number) => {
            try {
                const response = await fetch('/api/internal/leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: row.name,
                        whatsapp_number: row.whatsapp_number,
                        source: row.source,
                        email: row.email ?? undefined,
                        pipeline_id: pipelineId,
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    errors.push({ row: rowIndex + 2, message: typeof payload.message === 'string' ? payload.message : `HTTP ${response.status}` });
                } else if (payload.duplicate_prevented) {
                    duplicate++;
                } else {
                    success++;
                }
            } catch (err) {
                errors.push({ row: rowIndex + 2, message: err instanceof Error ? err.message : 'Erro de rede' });
            } finally {
                done++;
                setProgress({ done, total: rows.length });
            }
        };

        for (let i = 0; i < rows.length; i += CONCURRENCY) {
            const chunk = rows.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map((row, j) => sendOne(row, i + j)));
        }

        setResult({ success, duplicate, errors });
        setStep('done');
        await onImported();
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => step !== 'importing' && onClose()}
        >
            <div
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] shadow-2xl shadow-black/50"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/5 p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                            <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">Pipeline</p>
                            <h2 className="font-serif text-[20px] font-semibold text-white">Importar leads</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={step === 'importing'}
                        onClick={onClose}
                        aria-label="Fechar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[color:var(--orion-text-muted)] transition hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-40"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5">
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <p className="text-[12px] text-[color:var(--orion-text-secondary)]">
                                Envie um arquivo <strong className="text-white">CSV</strong> com cabeçalho. Colunas suportadas:
                                {' '}<code className="text-brand-gold">nome</code>,{' '}
                                <code className="text-brand-gold">whatsapp</code>,{' '}
                                <code className="text-brand-gold">origem</code> (opcional),{' '}
                                <code className="text-brand-gold">email</code> (opcional).
                            </p>
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] py-10 px-6 transition-colors hover:border-brand-gold/40 hover:bg-brand-gold/5"
                            >
                                <Upload className="h-7 w-7 text-[color:var(--orion-text-muted)]" />
                                <span className="text-[13px] font-semibold text-white">Selecionar arquivo CSV</span>
                                <span className="text-[11px] text-[color:var(--orion-text-muted)]">ou arraste e solte aqui</span>
                            </button>
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={onChangeFile}
                                aria-label="Arquivo CSV"
                            />
                            {parseError && (
                                <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>{parseError}</span>
                                </div>
                            )}
                            <div className="rounded-md border border-white/5 bg-black/30 p-3 text-[11px] text-[color:var(--orion-text-muted)]">
                                <p className="font-semibold text-[color:var(--orion-text-secondary)] mb-1">Exemplo de CSV:</p>
                                <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
{`nome,whatsapp,origem,email
Maria Silva,+5511999990001,WHATSAPP,maria@email.com
João Souza,11988887777,INDICACAO,`}
                                </pre>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-3">
                            <p className="text-[12px] text-[color:var(--orion-text-secondary)]">
                                <strong className="text-white">{rows.length}</strong> {rows.length === 1 ? 'lead' : 'leads'} prontos para importar de <span className="text-brand-gold">{fileName}</span>.
                            </p>
                            <div className="overflow-x-auto rounded-md border border-white/5">
                                <table className="w-full text-[11px]">
                                    <thead className="bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)]">
                                        <tr>
                                            <th className="text-left px-3 py-2">Nome</th>
                                            <th className="text-left px-3 py-2">WhatsApp</th>
                                            <th className="text-left px-3 py-2">Origem</th>
                                            <th className="text-left px-3 py-2">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {rows.slice(0, 5).map((r, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2 text-white truncate max-w-[180px]">{r.name}</td>
                                                <td className="px-3 py-2 text-[color:var(--orion-text-secondary)]">{r.whatsapp_number}</td>
                                                <td className="px-3 py-2 text-[color:var(--orion-text-secondary)]">{r.source}</td>
                                                <td className="px-3 py-2 text-[color:var(--orion-text-muted)] truncate max-w-[180px]">{r.email ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {rows.length > 5 && (
                                    <div className="px-3 py-2 text-center text-[10px] text-[color:var(--orion-text-muted)] border-t border-white/5">
                                        + {rows.length - 5} linha(s) adicionais
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="space-y-3 py-6">
                            <p className="text-[13px] text-white text-center">
                                Importando lead {progress.done} de {progress.total}...
                            </p>
                            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-brand-gold transition-all"
                                    style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                                />
                            </div>
                            <p className="text-center text-[11px] text-[color:var(--orion-text-muted)]">
                                Não feche esta janela enquanto a importação está em andamento.
                            </p>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                                <div className="text-[12px] text-emerald-200">
                                    <strong>{result.success}</strong> lead(s) importados com sucesso.
                                    {result.duplicate > 0 && <> · {result.duplicate} duplicado(s) reaproveitado(s).</>}
                                </div>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="rounded-md border border-rose-500/25 bg-rose-500/10 px-4 py-3">
                                    <p className="text-[12px] font-semibold text-rose-300 mb-2">
                                        {result.errors.length} linha(s) com erro:
                                    </p>
                                    <ul className="space-y-1 text-[11px] text-rose-200 max-h-40 overflow-y-auto">
                                        {result.errors.map((e, i) => (
                                            <li key={i}>Linha {e.row}: {e.message}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-white/5 p-4 bg-black/20">
                    {step === 'upload' && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 px-4 rounded-md border border-white/10 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                    )}
                    {step === 'preview' && (
                        <>
                            <button
                                type="button"
                                onClick={() => { setStep('upload'); setRows([]); }}
                                className="h-9 px-4 rounded-md border border-white/10 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-white transition-colors"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={() => void startImport()}
                                className={cn(
                                    'inline-flex h-9 items-center gap-2 rounded-md bg-brand-gold px-4 text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light'
                                )}
                            >
                                Importar {rows.length} {rows.length === 1 ? 'lead' : 'leads'}
                            </button>
                        </>
                    )}
                    {step === 'done' && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 px-4 rounded-md bg-brand-gold text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
                        >
                            Concluir
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
