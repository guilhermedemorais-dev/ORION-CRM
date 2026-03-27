-- Migration 038: Expand user_role enum with ROOT, GERENTE, VENDEDOR
-- These new roles enable the expanded RBAC system:
--   ROOT      → Super admin with full system access
--   GERENTE   → Manager with team oversight capabilities
--   VENDEDOR  → Sales representative with leads/clients focus

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ROOT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GERENTE';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'VENDEDOR';
