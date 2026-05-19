-- ─── Session Categories ───
-- Admin-managed tags for organizing the global session library.

CREATE TABLE IF NOT EXISTS session_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    color       text NOT NULL DEFAULT '#6B9972',
    sort_order  int NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE session_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Anyone can read session categories"
    ON session_categories FOR SELECT USING (true);

-- Only admins can create/update/delete categories
CREATE POLICY "Admins manage session categories"
    ON session_categories FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Seed starter categories
INSERT INTO session_categories (name, color, sort_order) VALUES
    ('VO2max',     '#3B6B8A', 1),
    ('Threshold',  '#B89A40', 2),
    ('Long Run',   '#6B9972', 3),
    ('Recovery',   '#5A7A6A', 4),
    ('Hills',      '#C07840', 5),
    ('Race Pace',  '#C0504A', 6),
    ('Easy',       '#6B6B8A', 7)
ON CONFLICT (name) DO NOTHING;
