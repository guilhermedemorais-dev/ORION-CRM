-- Migration 039: Add INSTAGRAM to lead_source enum
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'INSTAGRAM';
