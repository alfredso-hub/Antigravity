-- ═══════════════════════════════════════════════
-- Velocity App - Supabase Schema Setup
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    tuning_mode TEXT DEFAULT 'single',
    single_pb JSONB DEFAULT '{"distance": "5k", "time": ""}',
    all_pbs JSONB DEFAULT '{"5k": "", "10k": "", "half": "", "marathon": ""}',
    goal_time TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    distance TEXT NOT NULL DEFAULT 'marathon',
    duration_weeks INT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Plan weeks table
CREATE TABLE IF NOT EXISTS plan_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    days JSONB NOT NULL DEFAULT '[]'
);

-- 4. User plan customizations (per-user day reordering)
CREATE TABLE IF NOT EXISTS user_plan_customizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    day_order JSONB NOT NULL DEFAULT '[]',
    UNIQUE(user_id, plan_id, week_number)
);

-- ═══════════════════════════════════════════════
-- Row Level Security Policies
-- ═══════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plan_customizations ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update only their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Plans: all authenticated users can read, creator can modify
CREATE POLICY "Authenticated users can view all plans"
    ON plans FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create plans"
    ON plans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Plan creators can update their plans"
    ON plans FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "Plan creators can delete their plans"
    ON plans FOR DELETE
    USING (auth.uid() = created_by);

-- Plan weeks: follow plan access rules
CREATE POLICY "Authenticated users can view all plan weeks"
    ON plan_weeks FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create plan weeks"
    ON plan_weeks FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- User customizations: users can only access their own
CREATE POLICY "Users can view own customizations"
    ON user_plan_customizations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customizations"
    ON user_plan_customizations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customizations"
    ON user_plan_customizations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customizations"
    ON user_plan_customizations FOR DELETE
    USING (auth.uid() = user_id);
