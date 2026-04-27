-- ═══════════════════════════════════════════════
-- Velocity App - Admin, Timeline Events & Plan Commits
-- Run this in the Supabase SQL Editor AFTER 01_schema.sql
-- ═══════════════════════════════════════════════

-- 1. Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. User Events table (races, sickness, injury)
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('race', 'sickness', 'injury')),
    start_date DATE NOT NULL,
    end_date DATE,
    distance TEXT,
    time TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Plan Commits table
CREATE TABLE IF NOT EXISTS user_plan_commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    committed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)  -- one active commitment per user
);

-- ═══════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════

-- Enable RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plan_commits ENABLE ROW LEVEL SECURITY;

-- User Events: users can CRUD only their own rows
CREATE POLICY "Users can view own events"
    ON user_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
    ON user_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
    ON user_events FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
    ON user_events FOR DELETE
    USING (auth.uid() = user_id);

-- User Plan Commits: users can CRUD only their own rows
CREATE POLICY "Users can view own commits"
    ON user_plan_commits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commits"
    ON user_plan_commits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commits"
    ON user_plan_commits FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own commits"
    ON user_plan_commits FOR DELETE
    USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
-- Admin Override Policies for Plans & Plan Weeks
-- ═══════════════════════════════════════════════

-- Admins can update any plan
CREATE POLICY "Admins can update any plan"
    ON plans FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can delete any plan
CREATE POLICY "Admins can delete any plan"
    ON plans FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can update any plan weeks
CREATE POLICY "Admins can update any plan weeks"
    ON plan_weeks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can delete any plan weeks
CREATE POLICY "Admins can delete any plan weeks"
    ON plan_weeks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════
-- Set admin flag for Alfred Söder
-- (Run this after the user has logged in at least once)
-- ═══════════════════════════════════════════════
UPDATE profiles
SET is_admin = true
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'alfredsoder0@gmail.com'
);
