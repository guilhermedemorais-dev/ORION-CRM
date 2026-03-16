// Shared types for the Customer Panel

export interface CustomerFull {
  id: string;
  name: string;
  whatsapp_number: string;
  email: string | null;
  cpf: string | null;
  social_name: string | null;
  rg: string | null;
  birth_date: string | null;
  gender: string | null;
  instagram: string | null;
  phone_landline: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  address_full: string | null;
  cnpj: string | null;
  company_name: string | null;
  company_address: string | null;
  preferred_metal: string | null;
  ring_size: string | null;
  preferred_channel: string | null;
  special_dates: string | null;
  remarketing_notes: string | null;
  origin: string | null;
  notes: string | null;
  is_converted: boolean;
  lifetime_value_cents: number;
  ltv_cents: number;
  orders_count: number;
  last_order_at: string | null;
  has_pending_os: boolean;
  created_at: string;
  updated_at: string;
  assigned_to: { id: string; name: string; role?: string } | null;
}

export interface CustomerStats {
  ltv_cents: number;
  orders_count: number;
  pending_os: number;
  last_interaction_days: number;
  open_proposals: number;
}

export interface AttendanceBlock {
  id: string;
  customer_id: string;
  lead_id: string | null;
  title: string;
  block_type: string;
  content: string | null;
  status: string;
  priority: string | null;
  channel: string | null;
  attachments: Array<{ name: string; url: string; type: string; size: number }>;
  has_3d: boolean;
  ai_render_id: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  // pipeline / OS fields
  pipeline_status: string;
  product_name: string | null;
  due_date: string | null;
  metal: string | null;
  stone: string | null;
  ring_size: string | null;
  weight_grams: number | null;
  finish: string | null;
  engraving: string | null;
  prong_count: number | null;
  band_thickness: number | null;
  tech_notes: string | null;
  designer_id: string | null;
  jeweler_id: string | null;
  designer_name: string | null;
  jeweler_name: string | null;
  deposit_cents: number;
  total_cents: number;
  so_number: string | null;
  so_approved_at: string | null;
}

export interface AIRender {
  id: string;
  status: string;
  piece_type: string | null;
  metal: string | null;
  stone: string | null;
  band_thickness: number | null;
  setting_height: number | null;
  prong_count: number | null;
  band_profile: string | null;
  render_url_front: string | null;
  render_url_top: string | null;
  render_url_side: string | null;
  is_approved: boolean;
}

export interface ServiceOrder {
  id: string;
  order_number: string;
  product_name: string;
  priority: string;
  status: string;
  current_step: string;
  steps_done: string[];
  specs: Record<string, unknown>;
  designer_name: string | null;
  jeweler_name: string | null;
  due_date: string | null;
  deposit_cents: number;
  total_cents: number;
  days_open: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  type: string;
  status: string;
  order_number: string | null;
  so_number: string | null;
  tracking_code: string | null;
  label_url: string | null;
  address: string | null;
  scheduled_at: string | null;
  delivered_at: string | null;
  estimated_at: string | null;
  balance_cents: number;
  declared_value_cents: number;
  freight_cents: number;
  insurance_cents: number;
  carrier_config_id: string | null;
  carrier_order_id: string | null;
  tracking_events: Array<{ timestamp: string; status: string; description: string; location: string | null }>;
  notes: string | null;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
}

export interface LeadRecord {
  id: string;
  name: string | null;
  stage_id: string | null;
  pipeline_id: string;
  whatsapp_number?: string;
  converted_customer_id?: string | null;
}

export interface OrderRecord {
  id: string;
  order_number: string;
  type: string;
  status: string;
  final_amount_cents: number;
  payment_method: string | null;
  created_at: string;
  nfe_status: string | null;
}
