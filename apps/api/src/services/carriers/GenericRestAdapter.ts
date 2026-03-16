/**
 * GenericRestAdapter — adapter configurable via JSON
 *
 * Works with any REST carrier that accepts JSON.
 * The credentials object can contain:
 *   - api_key / token (sent as Authorization: Bearer or X-Api-Key header)
 *   - create_shipment_url (overrides base_url + "/shipments")
 *   - tracking_url_template (e.g. "https://api.carrier.com/track/{tracking_code}")
 *   - auth_header (default: "Authorization", value prefix: "Bearer")
 *   - response_tracking_code_path (dot-path in response, e.g. "data.tracking_code")
 *   - response_label_url_path (dot-path, e.g. "data.label.pdf_url")
 */

import type {
  ICarrierAdapter,
  ShipmentInput,
  ShipmentResult,
  TrackingEvent,
  CarrierCredentials,
  QuoteResult,
} from './ICarrierAdapter.js';

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export class GenericRestAdapter implements ICarrierAdapter {
  async createShipment(
    input: ShipmentInput,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<ShipmentResult> {
    const url = credentials['create_shipment_url'] ?? `${baseUrl ?? credentials['base_url']}/shipments`;
    const authHeader = credentials['auth_header'] ?? 'Authorization';
    const authValue = credentials['api_key']
      ? `Bearer ${credentials['api_key']}`
      : credentials['token'] ?? '';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authHeader]: authValue,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`Carrier API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const trackingCodePath = credentials['response_tracking_code_path'] ?? 'tracking_code';
    const labelUrlPath = credentials['response_label_url_path'] ?? 'label_url';
    const carrierOrderIdPath = credentials['response_carrier_order_id_path'] ?? 'id';

    return {
      carrier_order_id: String(getNestedValue(data, carrierOrderIdPath) ?? ''),
      tracking_code: String(getNestedValue(data, trackingCodePath) ?? ''),
      label_url: String(getNestedValue(data, labelUrlPath) ?? ''),
      estimated_delivery_at: String(getNestedValue(data, 'estimated_delivery_at') ?? new Date().toISOString()),
      freight_cents: Number(getNestedValue(data, 'freight_cents') ?? 0),
      insurance_cents: Number(getNestedValue(data, 'insurance_cents') ?? 0),
    };
  }

  async getTracking(
    trackingCode: string,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<TrackingEvent[]> {
    const urlTemplate = credentials['tracking_url_template']
      ?? `${baseUrl ?? credentials['base_url']}/tracking/{tracking_code}`;
    const url = urlTemplate.replace('{tracking_code}', encodeURIComponent(trackingCode));

    const authHeader = credentials['auth_header'] ?? 'Authorization';
    const authValue = credentials['api_key']
      ? `Bearer ${credentials['api_key']}`
      : credentials['token'] ?? '';

    const res = await fetch(url, {
      headers: { [authHeader]: authValue },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as Record<string, unknown>;
    const eventsPath = credentials['response_events_path'] ?? 'events';
    const events = getNestedValue(data, eventsPath);

    if (!Array.isArray(events)) return [];

    return events.map((e: Record<string, unknown>) => ({
      timestamp: String(e['timestamp'] ?? e['date'] ?? new Date().toISOString()),
      status: String(e['status'] ?? 'UNKNOWN') as TrackingEvent['status'],
      description: String(e['description'] ?? e['message'] ?? ''),
      location: e['location'] ? String(e['location']) : null,
    }));
  }

  async cancelShipment(
    carrierId: string,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<void> {
    const base = baseUrl ?? credentials['base_url'] ?? '';
    const authHeader = credentials['auth_header'] ?? 'Authorization';
    const authValue = credentials['api_key']
      ? `Bearer ${credentials['api_key']}`
      : credentials['token'] ?? '';

    await fetch(`${base}/shipments/${carrierId}/cancel`, {
      method: 'POST',
      headers: { [authHeader]: authValue },
    });
  }

  async getQuote(
    input: ShipmentInput,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<QuoteResult[]> {
    const url = credentials['quote_url'] ?? `${baseUrl ?? credentials['base_url']}/quote`;
    const authHeader = credentials['auth_header'] ?? 'Authorization';
    const authValue = credentials['api_key']
      ? `Bearer ${credentials['api_key']}`
      : credentials['token'] ?? '';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [authHeader]: authValue },
      body: JSON.stringify(input),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(data) ? data : [data];

    return items.map((item: Record<string, unknown>) => ({
      freight_cents: Number(item['freight_cents'] ?? 0),
      insurance_cents: Number(item['insurance_cents'] ?? 0),
      estimated_days: Number(item['estimated_days'] ?? 0),
      service: String(item['service'] ?? 'PADRAO'),
    }));
  }
}
