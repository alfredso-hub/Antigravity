-- ═══════════════════════════════════════════════
-- Seed: Copenhagen Marathon Plan (Weeks 6-15 → renumbered 1-10)
-- Run this in the Supabase SQL Editor AFTER 01_schema.sql
-- ═══════════════════════════════════════════════

-- Insert the plan (using a fixed UUID so we can reference it below)
INSERT INTO plans (id, name, distance, duration_weeks, created_by)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Copenhagen Marathon (10 Weeks)',
    'marathon',
    10,
    NULL  -- system-seeded plan, no creator
);

-- Week 1 (originally Week 6)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 1,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":7.75,"pace":"easy","class":"easy","stats":{"total":7.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Steady","desc":"14 km Aerobic steady (upper E, relaxed)","dist":14,"pace":"easy","class":"easy","stats":{"total":14,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":7.75,"pace":"easy","class":"easy","stats":{"total":7.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"25 min continuous @ T inside 14-15 km total","dist":15,"pace":"threshold","class":"tempo","stats":{"total":15,"lt":0,"at":6.8,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":7.75,"pace":"easy","class":"easy","stats":{"total":7.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"30 km Long Run – last 8 km @ M","dist":30,"pace":"marathon","class":"long","stats":{"total":30,"lt":8,"at":0,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":7.75,"pace":"easy","class":"easy","stats":{"total":7.75,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 2 (originally Week 7)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 2,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"14 km Easy + strides","dist":14,"pace":"easy","class":"easy","stats":{"total":14,"lt":0,"at":0,"aboveAt":1}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"2×15 min @ T (3 min jog)","dist":15,"pace":"threshold","class":"tempo","stats":{"total":15,"lt":0,"at":8.1,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"32 km Long Run – 2×6 km @ M (3 km easy between)","dist":32,"pace":"marathon","class":"long","stats":{"total":32,"lt":12,"at":0,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 3 (originally Week 8)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 3,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":9,"pace":"easy","class":"easy","stats":{"total":9,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"14-15 km Easy","dist":15,"pace":"easy","class":"easy","stats":{"total":15,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":9,"pace":"easy","class":"easy","stats":{"total":9,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"30 min steady @ T (controlled, not forced)","dist":14,"pace":"threshold","class":"tempo","stats":{"total":14,"lt":0,"at":8.1,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":9,"pace":"easy","class":"easy","stats":{"total":9,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"34 km Long Run – last 12 km @ M","dist":34,"pace":"marathon","class":"long","stats":{"total":34,"lt":12,"at":0,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":9,"pace":"easy","class":"easy","stats":{"total":9,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 4 (originally Week 9)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 4,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"12-14 km Easy + strides","dist":14,"pace":"easy","class":"easy","stats":{"total":14,"lt":0,"at":0,"aboveAt":1}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"20-25 min @ T inside aerobic run","dist":14,"pace":"threshold","class":"tempo","stats":{"total":14,"lt":0,"at":6,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"32 km Long Run – M/T Combo Intro (10E, 6T, 2E, 10M, E)","dist":32,"pace":"marathon","class":"long","stats":{"total":32,"lt":10,"at":6,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":8.75,"pace":"easy","class":"easy","stats":{"total":8.75,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 5 (originally Week 10)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 5,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"14 km Easy","dist":14,"pace":"easy","class":"easy","stats":{"total":14,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"2×20 min @ T (controlled)","dist":16,"pace":"threshold","class":"tempo","stats":{"total":16,"lt":0,"at":10.8,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"30-32 km Long Run – Alternating Combo (3× (3 km @ M + 2 km @ T))","dist":32,"pace":"marathon","class":"long","stats":{"total":32,"lt":9,"at":6,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 6 (originally Week 11)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 6,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"14 km Easy + strides","dist":14,"pace":"easy","class":"easy","stats":{"total":14,"lt":0,"at":0,"aboveAt":1}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"25 min @ T (light, confidence-building)","dist":14,"pace":"threshold","class":"tempo","stats":{"total":14,"lt":0,"at":6.8,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"34 km Long Run – last 14 km @ M","dist":34,"pace":"marathon","class":"long","stats":{"total":34,"lt":14,"at":0,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":8.25,"pace":"easy","class":"easy","stats":{"total":8.25,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 7 (originally Week 12)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 7,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"12-14 km Easy","dist":14,"pace":"easy","class":"easy","stats":{"total":14,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"20-25 min @ T inside aerobic run","dist":14,"pace":"threshold","class":"tempo","stats":{"total":14,"lt":0,"at":6,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"30-32 km Long Run – Embedded Threshold (12E, 5T, 3E, 5T)","dist":32,"pace":"marathon","class":"long","stats":{"total":32,"lt":0,"at":10,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 8 (originally Week 13)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 8,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Easy","desc":"12 km Easy + strides","dist":12,"pace":"easy","class":"easy","stats":{"total":12,"lt":0,"at":0,"aboveAt":1}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"20 min @ T (optional, skip if fatigued)","dist":12,"pace":"threshold","class":"tempo","stats":{"total":12,"lt":0,"at":5.4,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Long","desc":"28-30 km Long Run – M/T Sandwich (8M, 6T, 8M)","dist":30,"pace":"marathon","class":"long","stats":{"total":30,"lt":16,"at":6,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 9 (originally Week 14)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 9,
    '[
        {"day":"Mon","type":"Easy","desc":"Easy run (filler)","dist":5,"pace":"easy","class":"easy","stats":{"total":5,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Tue","type":"Quality (M)","desc":"12 km @ M","dist":16,"pace":"marathon","class":"tempo","stats":{"total":16,"lt":12,"at":0,"aboveAt":0}},
        {"day":"Wed","type":"Easy","desc":"Easy run (filler)","dist":5,"pace":"easy","class":"easy","stats":{"total":5,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Quality (T)","desc":"3×2 km @ T","dist":12,"pace":"threshold","class":"tempo","stats":{"total":12,"lt":0,"at":6,"aboveAt":0}},
        {"day":"Fri","type":"Easy","desc":"Easy run (filler)","dist":5,"pace":"easy","class":"easy","stats":{"total":5,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Easy Long","desc":"20-22 km Long (easy)","dist":22,"pace":"easy","class":"long","stats":{"total":22,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sun","type":"Easy","desc":"Easy run (filler)","dist":5,"pace":"easy","class":"easy","stats":{"total":5,"lt":0,"at":0,"aboveAt":0}}
    ]'::jsonb
);

-- Week 10 (originally Week 15 - Race Week)
INSERT INTO plan_weeks (plan_id, week_number, days) VALUES (
    'a0000000-0000-0000-0000-000000000001', 10,
    '[
        {"day":"Mon","type":"Easy","desc":"10 km Easy + strides","dist":10,"pace":"easy","class":"easy","stats":{"total":10,"lt":0,"at":0,"aboveAt":1}},
        {"day":"Tue","type":"Quality (T)","desc":"3×3 min @ T","dist":8,"pace":"threshold","class":"tempo","stats":{"total":8,"lt":0,"at":2.4,"aboveAt":0}},
        {"day":"Wed","type":"Easy","desc":"8 km Easy","dist":8,"pace":"easy","class":"easy","stats":{"total":8,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Thu","type":"Easy","desc":"6 km Easy + 4×200 m strides","dist":7,"pace":"easy","class":"easy","stats":{"total":7,"lt":0,"at":0,"aboveAt":0.8}},
        {"day":"Fri","type":"Rest","desc":"Rest","dist":0,"pace":"","class":"rest","stats":{"total":0,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sat","type":"Rest","desc":"Rest","dist":0,"pace":"","class":"rest","stats":{"total":0,"lt":0,"at":0,"aboveAt":0}},
        {"day":"Sun","type":"RACE","desc":"COPENHAGEN MARATHON – May 10th","dist":42.2,"pace":"marathon","class":"interval","stats":{"total":42.2,"lt":42.2,"at":0,"aboveAt":0}}
    ]'::jsonb
);
