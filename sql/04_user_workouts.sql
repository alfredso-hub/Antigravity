-- ═══════════════════════════════════════════════
-- Velocity App - User Workouts Schema
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_commit_id UUID NOT NULL REFERENCES user_plan_commits(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    workout_type TEXT NOT NULL,
    planned_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('PLANNED', 'COMPLETED', 'SKIPPED')) DEFAULT 'PLANNED',
    actual_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE user_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
    ON user_workouts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
    ON user_workouts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
    ON user_workouts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
    ON user_workouts FOR DELETE
    USING (auth.uid() = user_id);
