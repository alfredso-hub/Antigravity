-- ═══════════════════════════════════════════════
-- Velocity App - Sandbox User
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- We use a fixed, easily identifiable UUID for the Sandbox User
-- 99999999-9999-9999-9999-999999999999

-- 1. Create the user in auth.users
-- Note: This bypasses normal sign-up but is required to satisfy Foreign Key constraints
INSERT INTO auth.users (
    id, 
    email, 
    raw_user_meta_data, 
    raw_app_meta_data, 
    aud, 
    role, 
    created_at,
    updated_at
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    'sandbox@velocity.app',
    '{"full_name": "Sandbox User"}',
    '{"provider": "email", "providers": ["email"]}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create the profile in public.profiles
INSERT INTO public.profiles (
    id,
    display_name,
    tuning_mode,
    single_pb,
    all_pbs,
    goal_time
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    'Sandbox User',
    'single',
    '{"distance": "5k", "time": "20:00", "vdot": "49.8"}',
    '{"5k": "", "10k": "", "half": "", "marathon": ""}',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 3. (Optional) Function to wipe all sandbox data
CREATE OR REPLACE FUNCTION wipe_sandbox_data()
RETURNS void AS $$
BEGIN
    DELETE FROM user_workouts WHERE user_id = '99999999-9999-9999-9999-999999999999';
    DELETE FROM plan_adjustments WHERE user_id = '99999999-9999-9999-9999-999999999999';
    DELETE FROM user_events WHERE user_id = '99999999-9999-9999-9999-999999999999';
    DELETE FROM user_plan_commits WHERE user_id = '99999999-9999-9999-9999-999999999999';
    DELETE FROM user_plan_customizations WHERE user_id = '99999999-9999-9999-9999-999999999999';
END;
$$ LANGUAGE plpgsql;
