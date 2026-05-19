-- ─── Saved Sessions ───
-- Global library of reusable training sessions.
-- Any user can read; only the creator can modify/delete their own.

CREATE TABLE IF NOT EXISTS saved_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    category_id     uuid REFERENCES session_categories(id) ON DELETE SET NULL,
    notes           text,
    workout_type    text NOT NULL DEFAULT 'session', -- 'easy' | 'session' | 'long' | 'hills' | 'rest'
    workout_data    jsonb NOT NULL,   -- full structured workout object (warmUp, sets, coolDown, etc.)
    auto_desc       text,             -- auto-generated description for quick display
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

ALTER TABLE saved_sessions ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read saved sessions"
    ON saved_sessions FOR SELECT USING (true);

-- Users can insert their own
CREATE POLICY "Users insert own sessions"
    ON saved_sessions FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Users can update their own
CREATE POLICY "Users update own sessions"
    ON saved_sessions FOR UPDATE
    USING (auth.uid() = created_by);

-- Users can delete their own; admins can delete any
CREATE POLICY "Users delete own sessions"
    ON saved_sessions FOR DELETE
    USING (
        auth.uid() = created_by
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_saved_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saved_sessions_updated_at
    BEFORE UPDATE ON saved_sessions
    FOR EACH ROW EXECUTE FUNCTION update_saved_sessions_updated_at();
