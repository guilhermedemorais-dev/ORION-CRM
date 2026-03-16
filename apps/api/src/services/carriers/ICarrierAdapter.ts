export interface AddressData {
  zip_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country?: string;
}

export interface ShipmentParty {
  name: string;
  cpf_cnpj?: string;
  phone: string;
  address: AddressData;
}

export interface ShipmentInput {
  sender: ShipmentParty;
  recipient: ShipmentParty;
  package: {
    weight_grams: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  declared_value_cents: number;
  service: string;
  notes?: string;
  pickup_scheduled_at?: string; // ISO 8601
}

export interface ShipmentResult {
  carrier_order_id: string;
  tracking_code: string;
  label_url: string;
  estimated_delivery_at: string;
  freight_cents: number;
  insurance_cents: number;
}

export type TrackingStatus =
  | 'POSTED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'UNKNOWN';

export interface TrackingEvent {
  timestamp: string;
  status: TrackingStatus;
  description: string;
  location: string | null;
}

export interface QuoteResult {
  freight_cents: number;
  insurance_cents: number;
  estimated_days: number;
  service: string;
}

export interface CarrierCredentials {
  [key: string]: string;
}

export interface ICarrierAdapter {
  createShipment(
    input: ShipmentInput,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<ShipmentResult>;

  getTracking(
    trackingCode: string,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<TrackingEvent[]>;

  cancelShipment(
    carrierId: string,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<void>;

  getQuote?(
    input: ShipmentInput,
    credentials: CarrierCredentials,
    baseUrl?: string,
  ): Promise<QuoteResult[]>;
}
