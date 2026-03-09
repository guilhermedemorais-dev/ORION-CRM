-- Migration 014: Align automation schema with n8n naming

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'automation_flows'
      AND column_name = 'activepieces_flow_id'
  ) THEN
    EXECUTE 'ALTER TABLE automation_flows RENAME COLUMN activepieces_flow_id TO n8n_workflow_id';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'automation_executions'
      AND column_name = 'activepieces_run_id'
  ) THEN
    EXECUTE 'ALTER TABLE automation_executions RENAME COLUMN activepieces_run_id TO n8n_execution_id';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_flows_ap_id;
CREATE INDEX IF NOT EXISTS idx_flows_n8n_id
  ON automation_flows (n8n_workflow_id)
  WHERE n8n_workflow_id IS NOT NULL;

