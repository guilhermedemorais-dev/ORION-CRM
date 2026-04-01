import type { AiContextData } from './components/AiContextCard';
export type { AiContextData };

export type AppointmentStatus =
  | 'AGENDADO'
  | 'CONFIRMADO_CLIENTE'
  | 'EM_ATENDIMENTO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'NAO_COMPARECEU';

export type AppointmentSource = 'MANUAL' | 'CRM' | 'WHATSAPP_BOT';

export interface AppointmentRecord {
  id: string;
  type: string; // free-text: "Visita Showroom", "Reunião Online", etc.
  status: AppointmentStatus;
  source: AppointmentSource;
  starts_at: string;   // ISO 8601
  ends_at: string;     // ISO 8601
  notes?: string | null;
  lead?: { id: string; name: string; whatsapp_number?: string | null } | null;
  customer?: { id: string; name: string; whatsapp_number?: string | null } | null;
  assigned_to?: { id: string; name: string } | null;
  pipeline_id?: string | null;
  ai_context?: AiContextData | null;
  created_at: string;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  reminder_sent_at?: string | null;
}
