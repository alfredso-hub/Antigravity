-- ═══════════════════════════════════════════════
-- Velocity App - Admin RLS Bypass Policies
-- Allows admin users to read/write any row on
-- tables that use user_id, enabling Sandbox Mode.
-- Run this in the Supabase SQL Editor AFTER 06_sandbox_user.sql
-- ═══════════════════════════════════════════════

-- Helper: reusable admin check expression
-- EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)

-- ── user_plan_commits ──
CREATE POLICY "Admins can manage any plan commits"
    ON user_plan_commits FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ── user_workouts ──
CREATE POLICY "Admins can manage any user workouts"
    ON user_workouts FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ── user_events ──
CREATE POLICY "Admins can manage any user events"
    ON user_events FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ── plan_adjustments ──
CREATE POLICY "Admins can manage any plan adjustments"
    ON plan_adjustments FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ── user_plan_customizations ──
CREATE POLICY "Admins can manage any plan customizations"
    ON user_plan_customizations FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
