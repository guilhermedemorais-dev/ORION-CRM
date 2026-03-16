import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { requireRole } from '../middleware/rbac.js';
import { getCarrierAdapter } from '../services/carriers/registry.js';
import type { ShipmentInput } from '../services/carriers/ICarrierAdapter.js';

const router = Router();

// ── GET /api/v1/customers/:id/deliveries ─────────────────────────────────────
router.get(
    '/:customerId/deliveries',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE', 'PRODUCAO', 'DESIGNER_3D']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { customerId } = req.params as { customerId: string };
            const result = await query(
                `SELECT d.*,
                        o.order_number,
                        so.order_number AS so_number,
                        cc.name AS carrier_name,
                        cc.logo_url AS carrier_logo_url,
                        cc.slug AS carrier_slug
                 FROM deliveries d
                 LEFT JOIN orders o ON o.id = d.order_id
                 LEFT JOIN service_orders so ON so.id = d.so_id
                 LEFT JOIN carriers_config cc ON cc.id = d.carrier_config_id
                 WHERE d.customer_id = $1
                 ORDER BY d.created_at DESC`,
                [customerId],
            );
            res.json({ data: result.rows });
        } catch (err) { next(err); }
    },
);

// ── POST /api/v1/deliveries ────────────────────────────────────────────────────
// Cria entrega. Se carrier_config_id fornecido, chama a API da transportadora.
const createDeliverySchema = z.object({
    order_id: z.string().uuid().optional(),
    so_id: z.string().uuid().optional(),
    customer_id: z.string().uuid(),
    type: z.enum(['store_pickup', 'shipping']).default('store_pickup'),
    carrier_config_id: z.string().uuid().optional(),
    service: z.string().max(60).optional(),
    address: z.string().max(400).optional(),
    declared_value_cents: z.number().int().min(0).default(0),
    balance_cents: z.number().int().min(0).default(0),
    scheduled_at: z.string().optional(),
    pickup_scheduled_at: z.string().optional(),
    notes: z.string().max(1000).optional(),
    // Sender info (overrides defaults from settings)
    sender_name: z.string().max(200).optional(),
    sender_phone: z.string().max(30).optional(),
    sender_zip: z.string().max(10).optional(),
    sender_street: z.string().max(300).optional(),
    sender_number: z.string().max(20).optional(),
    sender_neighborhood: z.string().max(100).optional(),
    sender_city: z.string().max(100).optional(),
    sender_state: z.string().max(2).optional(),
    // Package
    weight_grams: z.number().int().min(1).default(100),
    length_cm: z.number().min(1).default(10),
    width_cm: z.number().min(1).default(10),
    height_cm: z.number().min(1).default(5),
});

router.post(
    '/',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createDeliverySchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados inválidos.', parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))));
                return;
            }

            const d = parsed.data;

            // Fetch customer for recipient data
            const custResult = await query<{
                name: string; cpf: string | null; cnpj: string | null;
                whatsapp_number: string; zip_code: string | null; address_full: string | null;
                city: string | null; state: string | null;
            }>(
                'SELECT name, cpf, cnpj, whatsapp_number, zip_code, address_full, city, state FROM customers WHERE id = $1',
                [d.customer_id],
            );
            const customer = custResult.rows[0];
            if (!customer) { next(AppError.notFound('Cliente não encontrado.')); return; }

            // Fetch org settings for sender defaults
            const settingsResult = await query<{
                company_name: string; phone: string | null; address: Record<string, string> | null;
            }>('SELECT company_name, phone, address FROM settings LIMIT 1');
            const settings = settingsResult.rows[0];

            let carrierOrderId: string | null = null;
            let trackingCode: string | null = null;
            let labelUrl: string | null = null;
            let estimatedAt: string | null = null;
            let freightCents = 0;
            let insuranceCents = 0;

            // If shipping with carrier, call the carrier API
            if (d.type === 'shipping' && d.carrier_config_id) {
                const carrierResult = await query<{
                    adapter_type: string;
                    credentials: Record<string, string>;
                    base_url: string | null;
                    default_service: string | null;
                    insurance_pct: number;
                    min_insurance_cents: number;
                }>(
                    'SELECT adapter_type, credentials, base_url, default_service, insurance_pct, min_insurance_cents FROM carriers_config WHERE id = $1 AND active = true',
                    [d.carrier_config_id],
                );
                const carrier = carrierResult.rows[0];
                if (!carrier) { next(AppError.badRequest('Transportadora não encontrada ou inativa.')); return; }

                const senderAddress = settings?.address ?? {};
                const shipmentInput: ShipmentInput = {
                    sender: {
                        name: d.sender_name ?? settings?.company_name ?? 'Joalheria',
                        phone: d.sender_phone ?? settings?.phone ?? '',
                        address: {
                            zip_code: d.sender_zip ?? String(senderAddress['zip_code'] ?? ''),
                            street: d.sender_street ?? String(senderAddress['street'] ?? ''),
                            number: d.sender_number ?? String(senderAddress['number'] ?? 'S/N'),
                            neighborhood: d.sender_neighborhood ?? String(senderAddress['neighborhood'] ?? ''),
                            city: d.sender_city ?? String(senderAddress['city'] ?? ''),
                            state: d.sender_state ?? String(senderAddress['state'] ?? ''),
                        },
                    },
                    recipient: {
                        name: customer.name,
                        cpf_cnpj: customer.cpf ?? customer.cnpj ?? undefined,
                        phone: customer.whatsapp_number,
                        address: {
                            zip_code: customer.zip_code ?? '',
                            street: customer.address_full ?? '',
                            number: '',
                            neighborhood: '',
                            city: customer.city ?? '',
                            state: customer.state ?? '',
                        },
                    },
                    package: {
                        weight_grams: d.weight_grams,
                        length_cm: d.length_cm,
                        width_cm: d.width_cm,
                        height_cm: d.height_cm,
                    },
                    declared_value_cents: d.declared_value_cents,
                    service: d.service ?? carrier.default_service ?? 'PADRAO',
                    notes: d.notes,
                    pickup_scheduled_at: d.pickup_scheduled_at,
                };

                try {
                    const adapter = getCarrierAdapter(carrier.adapter_type);
                    const shipment = await adapter.createShipment(shipmentInput, carrier.credentials, carrier.base_url ?? undefined);
                    carrierOrderId = shipment.carrier_order_id;
                    trackingCode = shipment.tracking_code;
                    labelUrl = shipment.label_url;
                    estimatedAt = shipment.estimated_delivery_at;
                    freightCents = shipment.freight_cents;

                    // Calculate insurance
                    const insurancePct = Number(carrier.insurance_pct ?? 0);
                    insuranceCents = Math.max(
                        carrier.min_insurance_cents,
                        Math.round((d.declared_value_cents * insurancePct) / 100),
                    );
                } catch (carrierErr) {
                    // Log but don't fail — create delivery record without dispatch
                    console.error('Carrier API error:', carrierErr);
                }
            }

            const result = await query<{ id: string }>(
                `INSERT INTO deliveries
                   (order_id, so_id, customer_id, type, carrier_config_id, service, address,
                    declared_value_cents, balance_cents, scheduled_at, pickup_scheduled_at,
                    notes, carrier_order_id, tracking_code, label_url, estimated_at,
                    freight_cents, insurance_cents, status, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                 RETURNING id`,
                [
                    d.order_id ?? null, d.so_id ?? null, d.customer_id, d.type,
                    d.carrier_config_id ?? null, d.service ?? null, d.address ?? null,
                    d.declared_value_cents, d.balance_cents, d.scheduled_at ?? null,
                    d.pickup_scheduled_at ?? null, d.notes ?? null,
                    carrierOrderId, trackingCode, labelUrl, estimatedAt,
                    freightCents, insuranceCents,
                    d.type === 'store_pickup' ? 'pending' : (trackingCode ? 'posted' : 'pending'),
                    req.user!.id,
                ],
            );

            const delivId = result.rows[0]?.id;
            if (!delivId) throw AppError.internal(req.requestId ?? 'unknown');

            await createAuditLog({ userId: req.user!.id, action: 'CREATE', entityType: 'deliveries', entityId: delivId, oldValue: null, newValue: d, req });

            const delivery = await query(
                `SELECT d.*, cc.name AS carrier_name, cc.logo_url AS carrier_logo_url
                 FROM deliveries d LEFT JOIN carriers_config cc ON cc.id = d.carrier_config_id
                 WHERE d.id = $1`, [delivId],
            );
            res.status(201).json(delivery.rows[0]);
        } catch (err) { next(err); }
    },
);

// ── GET /api/v1/deliveries/:id/tracking ──────────────────────────────────────
router.get(
    '/:id/tracking',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{
                tracking_code: string | null;
                carrier_config_id: string | null;
                tracking_events: unknown[];
            }>(
                'SELECT tracking_code, carrier_config_id, tracking_events FROM deliveries WHERE id = $1',
                [id],
            );
            const delivery = result.rows[0];
            if (!delivery) { next(AppError.notFound('Entrega não encontrada.')); return; }
            if (!delivery.tracking_code || !delivery.carrier_config_id) {
                res.json({ events: delivery.tracking_events ?? [] });
                return;
            }

            const carrierResult = await query<{
                adapter_type: string;
                credentials: Record<string, string>;
                base_url: string | null;
            }>(
                'SELECT adapter_type, credentials, base_url FROM carriers_config WHERE id = $1',
                [delivery.carrier_config_id],
            );
            const carrier = carrierResult.rows[0];
            if (!carrier) { res.json({ events: delivery.tracking_events ?? [] }); return; }

            const adapter = getCarrierAdapter(carrier.adapter_type);
            const events = await adapter.getTracking(
                delivery.tracking_code,
                carrier.credentials,
                carrier.base_url ?? undefined,
            );

            if (events.length > 0) {
                // Persist updated events
                const lastEvent = events[events.length - 1];
                const statusMap: Record<string, string> = {
                    POSTED: 'posted',
                    IN_TRANSIT: 'in_transit',
                    OUT_FOR_DELIVERY: 'out_for_delivery',
                    DELIVERED: 'delivered',
                    FAILED: 'failed',
                    RETURNED: 'failed',
                };
                const newStatus = statusMap[lastEvent?.status ?? ''] ?? 'in_transit';

                await query(
                    `UPDATE deliveries SET tracking_events = $1::jsonb, status = $2,
                     ${newStatus === 'delivered' ? 'delivered_at = NOW(),' : ''}
                     updated_at = NOW() WHERE id = $3`,
                    [JSON.stringify(events), newStatus, id],
                );
            }

            res.json({ events });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/deliveries/:id ──────────────────────────────────────────────
router.patch(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const allowed = ['type', 'address', 'scheduled_at', 'tracking_code', 'notes', 'balance_cents', 'label_url'];
            const sets: string[] = [];
            const values: unknown[] = [];

            for (const key of allowed) {
                if (req.body[key] !== undefined) { values.push(req.body[key]); sets.push(`${key} = $${values.length}`); }
            }
            if (sets.length === 0) { res.json({ message: 'Nenhuma alteração.' }); return; }
            sets.push('updated_at = NOW()');
            values.push(id);

            await query(`UPDATE deliveries SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'deliveries', entityId: id, oldValue: null, newValue: req.body, req });
            res.json({ id });
        } catch (err) { next(err); }
    },
);

// ── PATCH /api/v1/deliveries/:id/status ──────────────────────────────────────
router.patch(
    '/:id/status',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE', 'PRODUCAO']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const status = String(req.body['status'] ?? '');
            const validStatuses = ['pending', 'posted', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
            if (!validStatuses.includes(status)) { next(AppError.badRequest('Status inválido.')); return; }

            const sets = ['status = $1', 'updated_at = NOW()'];
            const values: unknown[] = [status];
            if (status === 'delivered') { sets.push('delivered_at = NOW()'); }
            values.push(id);

            await query(`UPDATE deliveries SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'deliveries', entityId: id, oldValue: null, newValue: { status }, req });
            res.json({ id, status });
        } catch (err) { next(err); }
    },
);

// ── DELETE /api/v1/deliveries/:id — cancelar entrega (apenas se pending/posted) ──
router.delete(
    '/:id',
    authenticate,
    requireRole(['ADMIN', 'ATENDENTE', 'MESTRE']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params as { id: string };
            const result = await query<{
                status: string;
                carrier_config_id: string | null;
                carrier_order_id: string | null;
            }>(
                'SELECT status, carrier_config_id, carrier_order_id FROM deliveries WHERE id = $1',
                [id],
            );
            const delivery = result.rows[0];
            if (!delivery) { next(AppError.notFound('Entrega não encontrada.')); return; }

            if (!['pending', 'posted'].includes(delivery.status)) {
                next(AppError.conflict('DELIVERY_NOT_CANCELLABLE', 'Só é possível cancelar entregas com status "pendente" ou "postado".'));
                return;
            }

            // Try to cancel with carrier
            if (delivery.carrier_config_id && delivery.carrier_order_id) {
                const carrierResult = await query<{
                    adapter_type: string;
                    credentials: Record<string, string>;
                    base_url: string | null;
                }>(
                    'SELECT adapter_type, credentials, base_url FROM carriers_config WHERE id = $1',
                    [delivery.carrier_config_id],
                );
                const carrier = carrierResult.rows[0];
                if (carrier) {
                    try {
                        const adapter = getCarrierAdapter(carrier.adapter_type);
                        await adapter.cancelShipment(delivery.carrier_order_id, carrier.credentials, carrier.base_url ?? undefined);
                    } catch {
                        // Log but proceed with local cancellation
                    }
                }
            }

            await query(
                `UPDATE deliveries SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [id],
            );
            await createAuditLog({ userId: req.user!.id, action: 'UPDATE', entityType: 'deliveries', entityId: id, oldValue: null, newValue: { status: 'cancelled' }, req });
            res.json({ id, status: 'cancelled' });
        } catch (err) { next(err); }
    },
);

export default router;
