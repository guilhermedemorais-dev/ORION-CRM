import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';

// TASK-005: backend da OS multi-peca com proposta.
// Spec: docs/specs/production/os-multi-piece-proposal/{database,api}.md
// Regra critica: nenhuma resposta consumida pelo modal expoe custo/margem (RN-06).
// Preco por peca e fonte de verdade do backend (a partir do preco do produto do estoque).

const router = Router();

function generateProposalNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `PROP-${date}-${rand}`;
}

const materialSchema = z.object({
    origin: z.enum(['own_stock', 'customer_custody']),
    product_id: z.string().uuid().optional(),
    material_label: z.string().max(200).optional(),
    quantity: z.number().positive(),
    unit: z.string().max(10).optional(),
}).refine((m) => m.origin !== 'own_stock' || !!m.product_id, {
    message: 'product_id é obrigatório para material de estoque próprio',
    path: ['product_id'],
});

const pieceSchema = z.object({
    category: z.string().max(100).optional(),
    title: z.string().max(200).optional(),
    tech_specs: z.record(z.string()).optional(),
    materials: z.array(materialSchema).default([]),
});

const createProposalSchema = z.object({
    customer_id: z.string().uuid(),
    attendance_block_id: z.string().uuid().optional(),
    title: z.string().max(200).optional(),
    due_date: z.string().optional(),
    responsible_user_id: z.string().uuid().optional(),
    customer_credit_cents: z.number().int().min(0).default(0),
    pieces: z.array(pieceSchema).min(1),
});

interface PriceRow { price_cents: number }

// ── POST /api/v1/proposals ─────────────────────────────────────────────────
// Cria a proposta com pecas e materiais numa transacao e registra (status='registered').
router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = createProposalSchema.parse(req.body);

            // Toda peca precisa de ao menos um material valido (RN-04).
            const invalidPiece = data.pieces.findIndex((p) => p.materials.length === 0);
            if (invalidPiece >= 0) {
                throw new AppError(400, 'PIECE_WITHOUT_MATERIAL',
                    `A peça ${invalidPiece + 1} não tem material; material é obrigatório para gerar a proposta.`);
            }

            // Preco fonte de verdade: busca o preco do produto do estoque (nunca custo).
            const productIds = Array.from(new Set(
                data.pieces.flatMap((p) => p.materials
                    .filter((m) => m.origin === 'own_stock' && m.product_id)
                    .map((m) => m.product_id as string))
            ));
            const priceById = new Map<string, number>();
            if (productIds.length > 0) {
                const priceRes = await query<PriceRow & { id: string }>(
                    `SELECT id, price_cents FROM products WHERE id = ANY($1::uuid[])`,
                    [productIds]
                );
                for (const row of priceRes.rows) priceById.set(row.id, row.price_cents);
                const missing = productIds.filter((id) => !priceById.has(id));
                if (missing.length > 0) {
                    throw new AppError(400, 'PRODUCT_NOT_FOUND', 'Um ou mais materiais de estoque não existem.');
                }
            }

            const proposal = await transaction(async (client) => {
                const number = generateProposalNumber();

                // Calcula precos por peca e subtotal no backend.
                let subtotal = 0;
                const piecePrices = data.pieces.map((p) => {
                    const price = p.materials.reduce((sum, m) => {
                        const unit = m.origin === 'own_stock' ? (priceById.get(m.product_id as string) ?? 0) : 0;
                        return sum + Math.round(m.quantity * unit);
                    }, 0);
                    subtotal += price;
                    return price;
                });
                const total = Math.max(0, subtotal - data.customer_credit_cents);

                const propRes = await client.query(
                    `INSERT INTO proposals
                       (proposal_number, customer_id, attendance_block_id, title, due_date,
                        responsible_user_id, status, subtotal_cents, customer_credit_cents, total_cents, created_by)
                     VALUES ($1,$2,$3,$4,$5,$6,'registered',$7,$8,$9,$10)
                     RETURNING id`,
                    [number, data.customer_id, data.attendance_block_id ?? null, data.title ?? null,
                     data.due_date ?? null, data.responsible_user_id ?? null,
                     subtotal, data.customer_credit_cents, total, req.user!.id]
                );
                const proposalId = propRes.rows[0].id as string;

                for (let i = 0; i < data.pieces.length; i++) {
                    const p = data.pieces[i]!;
                    const pieceRes = await client.query(
                        `INSERT INTO proposal_pieces
                           (proposal_id, position, category, title, tech_specs, price_cents, status)
                         VALUES ($1,$2,$3,$4,$5,$6,'ready')
                         RETURNING id`,
                        [proposalId, i, p.category ?? null, p.title ?? null,
                         JSON.stringify(p.tech_specs ?? {}), piecePrices[i]]
                    );
                    const pieceId = pieceRes.rows[0].id as string;

                    for (const m of p.materials) {
                        const unit = m.origin === 'own_stock' ? (priceById.get(m.product_id as string) ?? 0) : 0;
                        await client.query(
                            `INSERT INTO proposal_piece_materials
                               (piece_id, origin, product_id, material_label, quantity, unit, unit_price_snapshot_cents)
                             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                            [pieceId, m.origin, m.product_id ?? null, m.material_label ?? null,
                             m.quantity, m.unit ?? null, unit]
                        );
                    }
                }

                return { id: proposalId, proposal_number: number, subtotal_cents: subtotal, total_cents: total };
            });

            await createAuditLog({
                userId: req.user!.id, action: 'CREATE', entityType: 'proposals',
                entityId: proposal.id, oldValue: null,
                newValue: { proposal_number: proposal.proposal_number, pieces: data.pieces.length }, req,
            });

            res.status(201).json({ data: proposal });
        } catch (err) {
            if (err instanceof z.ZodError) {
                next(new AppError(400, 'VALIDATION_ERROR', 'Dados da proposta inválidos',
                    err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }
            next(err);
        }
    }
);

// ── GET /api/v1/proposals?customer_id=... ──────────────────────────────────
// Lista proposta para a aba Propostas da ficha do cliente. Sem custo.
router.get(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const customerId = req.query['customer_id'] ? String(req.query['customer_id']) : null;
            if (!customerId) throw new AppError(400, 'MISSING_CUSTOMER', 'customer_id é obrigatório.');
            const result = await query(
                `SELECT id, proposal_number, title, status, subtotal_cents,
                        customer_credit_cents, total_cents, due_date, created_at
                 FROM proposals
                 WHERE customer_id = $1
                 ORDER BY created_at DESC`,
                [customerId]
            );
            res.json({ data: result.rows });
        } catch (err) { next(err); }
    }
);

// ── GET /api/v1/proposals/:id ──────────────────────────────────────────────
// Detalhe consolidado (pecas + materiais). Nunca retorna custo/margem.
router.get(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'GERENTE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const propRes = await query(
                `SELECT id, proposal_number, customer_id, title, status,
                        subtotal_cents, customer_credit_cents, total_cents, due_date, created_at
                 FROM proposals WHERE id = $1`,
                [id]
            );
            if (propRes.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Proposta não encontrada.');

            const piecesRes = await query(
                `SELECT id, position, category, title, tech_specs, price_cents, status
                 FROM proposal_pieces WHERE proposal_id = $1 ORDER BY position`,
                [id]
            );
            const matsRes = await query(
                `SELECT m.id, m.piece_id, m.origin, m.product_id, p.name AS product_name,
                        m.material_label, m.quantity, m.unit, m.unit_price_snapshot_cents
                 FROM proposal_piece_materials m
                 LEFT JOIN products p ON p.id = m.product_id
                 WHERE m.piece_id = ANY($1::uuid[])`,
                [piecesRes.rows.map((r) => (r as { id: string }).id)]
            );
            const matsByPiece = new Map<string, unknown[]>();
            for (const m of matsRes.rows as Array<{ piece_id: string }>) {
                const arr = matsByPiece.get(m.piece_id) ?? [];
                arr.push(m);
                matsByPiece.set(m.piece_id, arr);
            }
            const pieces = (piecesRes.rows as Array<{ id: string }>).map((p) => ({
                ...p, materials: matsByPiece.get(p.id) ?? [],
            }));

            res.json({ data: { ...propRes.rows[0], pieces } });
        } catch (err) { next(err); }
    }
);

export default router;
