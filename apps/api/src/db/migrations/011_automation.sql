-- Migration 011: Automation Flows + Executions

CREATE TYPE flow_status AS ENUM ('draft', 'active', 'inactive', 'error');
CREATE TYPE execution_status AS ENUM ('running', 'success', 'failed', 'timeout');

CREATE TABLE automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status flow_status NOT NULL DEFAULT 'draft',
  activepieces_flow_id VARCHAR(255) UNIQUE,
  flow_definition JSONB NOT NULL DEFAULT '{}',
  trigger_type VARCHAR(100) NOT NULL,
  last_deployed_at TIMESTAMPTZ,
  last_execution_at TIMESTAMPTZ,
  execution_count INTEGER NOT NULL DEFAULT 0 CHECK (execution_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flows_status ON automation_flows (status);
CREATE INDEX idx_flows_trigger ON automation_flows (trigger_type);
CREATE INDEX idx_flows_ap_id ON automation_flows (activepieces_flow_id) WHERE activepieces_flow_id IS NOT NULL;

CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES automation_flows(id),
  activepieces_run_id VARCHAR(255),
  status execution_status NOT NULL,
  trigger_payload JSONB,
  result JSONB,
  error JSONB,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_exec_flow ON automation_executions (flow_id);
CREATE INDEX idx_exec_status ON automation_executions (status);
CREATE INDEX idx_exec_started ON automation_executions (started_at DESC);
