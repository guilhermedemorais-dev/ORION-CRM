-- Migration 023: User Notification Preferences

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_new_lead_whatsapp BOOLEAN NOT NULL DEFAULT false,
  notify_order_paid BOOLEAN NOT NULL DEFAULT false,
  notify_production_delayed BOOLEAN NOT NULL DEFAULT false,
  notify_low_stock BOOLEAN NOT NULL DEFAULT false,
  notify_lead_inactive BOOLEAN NOT NULL DEFAULT false,
  notify_goal_reached BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

