// Centraliza resolução de paths e validação de uploads.
// Todas as rotas que aceitam arquivo DEVEM usar este módulo — não construir paths
// manualmente nem confiar apenas em MIME do request (vide CLAUDE.md).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/** Raiz onde todos os uploads vivem (volume Docker compartilhado com NGINX). */
export function uploadsRoot(): string {
    return env().UPLOAD_PATH;
}

/** Constrói um path absoluto seguro dentro de uploadsRoot.
 *  Rejeita segmentos que escapariam da raiz (defense in depth contra traversal). */
export function resolveUploadDir(...segments: string[]): string {
    const root = path.resolve(uploadsRoot());
    const target = path.resolve(root, ...segments);
    if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
        throw new Error('Invalid upload path: escapes uploads root.');
    }
    return target;
}

/** Garante que o diretório existe (recursivo) e retorna o path absoluto. */
export async function ensureUploadDir(...segments: string[]): Promise<string> {
    const dir = resolveUploadDir(...segments);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

/** URL pública servida pelo NGINX (`/uploads/<...segments>/<filename>`).
 *  Usa caminho relativo para o frontend; o reverse proxy resolve. */
export function publicUploadUrl(...segments: string[]): string {
    return `/uploads/${segments.map(encodeURIComponent).join('/')}`;
}

// ── Magic-byte sniffing ──────────────────────────────────────────────────────
// CLAUDE.md exige: validar tipo de arquivo por magic bytes, não por extensão.

export type ImageKind = 'png' | 'jpeg' | 'webp';
export type DocKind = 'pdf';

export function sniffImage(buffer: Buffer): ImageKind | null {
    if (buffer.length < 12) return null;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'jpeg';
    }
    // WebP: 'RIFF' .... 'WEBP'
    if (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return 'webp';
    }
    return null;
}

export function sniffPdf(buffer: Buffer): DocKind | null {
    if (buffer.length < 4) return null;
    // PDF: 25 50 44 46 ('%PDF')
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return 'pdf';
    }
    return null;
}

export function imageExtension(kind: ImageKind): string {
    return kind === 'jpeg' ? 'jpg' : kind;
}
