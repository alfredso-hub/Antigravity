-- ═══════════════════════════════════════════════
-- Velocity App - Commit Dates & Metadata
-- Run this in the Supabase SQL Editor AFTER 07_admin_rls_bypass.sql
-- ═══════════════════════════════════════════════

-- Add start_date, race_date, and commit_metadata to user_plan_commits
ALTER TABLE user_plan_commits
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS race_date DATE,
  ADD COLUMN IF NOT EXISTS commit_metadata JSONB DEFAULT '{}';
