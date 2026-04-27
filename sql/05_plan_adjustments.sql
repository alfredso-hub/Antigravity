-- ═══════════════════════════════════════════════
-- Velocity App - Plan Adjustments Schema
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    state_before JSONB DEFAULT '{}',
    state_after JSONB DEFAULT '{}',
    schedule_adjustments JSONB DEFAULT '{}'
);

-- Row Level Security
ALTER TABLE plan_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adjustments"
    ON plan_adjustments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adjustments"
    ON plan_adjustments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adjustments"
    ON plan_adjustments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own adjustments"
    ON plan_adjustments FOR DELETE
    USING (auth.uid() = user_id);
