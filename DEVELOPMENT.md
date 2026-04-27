# Velocity — Development Notes

A VDOT-based adaptive running planner built with vanilla JS + Supabase.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES Modules), HTML, CSS |
| Backend / DB | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel (static) |
| Charts | Chart.js + chartjs-adapter-date-fns + chartjs-plugin-annotation |

**Key source files:**
- `src/app.js` — All UI logic, state management, event handling
- `src/db.js` — All Supabase CRUD operations
- `src/paces.js` — VDOT / pace calculation engine (Daniels formula)
- `src/supabase.js` — Supabase client init + auth helpers
- `src/engine/adjustment.js` — Plan adjustment engine (sickness/injury rules)

---

## Database Migration Order

Run these SQL files in the Supabase SQL Editor **in order**:

| File | Purpose |
|---|---|
| `sql/01_schema.sql` | Core tables: `profiles`, `plans`, `plan_weeks`, `user_plan_customizations` |
| `sql/02_seed_copenhagen.sql` | Seeds the Copenhagen Marathon 10-week plan |
| `sql/03_admin_timeline.sql` | Adds `is_admin` to profiles; creates `user_events`, `user_plan_commits` |
| `sql/04_user_workouts.sql` | Per-user calendar workout instances with completion tracking |
| `sql/05_plan_adjustments.sql` | Logs when the adjustment engine modifies a plan |
| `sql/06_sandbox_user.sql` | Creates the fixed-UUID sandbox user for admin testing |
| `sql/07_admin_rls_bypass.sql` | Allows admins to read/write any user's rows (required for Sandbox Mode) |

---

## Key Features & Their Implementation

### VDOT Pace Calculation
- Implemented in `src/paces.js` using Jack Daniels' formula
- Three tuning modes: Single PB, All PBs (fitted average), Goal Time
- Paces saved to `profiles` table in Supabase

### Plan Templates
- Plans are stored as templates in `plans` + `plan_weeks` (relative weeks/days, no calendar dates)
- Users can reorder days per week — stored in `user_plan_customizations`

### Commit to Plan
- When a user commits, they pick a **start date** or **target race date**
- The app generates concrete `user_workouts` rows with real calendar dates (one row per session)
- Stored in `user_workouts` with status `PLANNED | COMPLETED | SKIPPED`

### Session Tick-Off & Deviation Tracking
- Users open their schedule ("View My Schedule") from the plan tab once committed
- Clicking a session opens a modal to mark it complete with actual distance/time/notes
- Stored in `user_workouts.actual_data` (JSONB)

### Adjustment Engine (`src/engine/adjustment.js`)
- Triggered automatically when a `sickness` or `injury` event is logged on the Timeline tab
- Applies Daniels rules: 75% volume reduction, post-fever intensity lock
- Converts Quality/Long sessions → Recovery sessions during the lock period
- Saves a log to `plan_adjustments`, then bulk-updates the affected `user_workouts`

### Admin Mode
- Toggled in the header (only visible to users with `profiles.is_admin = true`)
- Enables the plan delete button and the Sandbox toggle

### Sandbox Mode
- A second toggle that appears next to the Admin toggle when Admin Mode is on
- Swaps `currentUser.id` in-memory to the fixed sandbox UUID (`99999999-9999-9999-9999-999999999999`)
- All DB writes go to sandbox user's rows; real account untouched
- Admin RLS bypass policies (`07_admin_rls_bypass.sql`) are required for this to work, since the real JWT is still used for auth
- An orange sticky banner ("SANDBOX MODE ACTIVE") and a "Wipe Data" button are shown while active

### Timeline
- Tracks race results, sickness periods, and injury periods
- Rendered as a Chart.js scatter plot with coloured box annotations for health events
- Health events also appear as overlays on the main plan chart

---

## Important Gotchas

- **RLS + Sandbox**: Supabase `auth.uid()` always reflects the real JWT — swapping user IDs in JS doesn't bypass RLS. Admin bypass policies are essential.
- **Sandbox user** has a fixed UUID `99999999-9999-9999-9999-999999999999`. Must be inserted into `auth.users` via the Supabase SQL editor (normal signup flow can't create it).
- **Import order matters** in `app.js` — all Supabase db functions must be in one `import { ... } from './db.js'` block to avoid syntax errors.
- The adjustment engine currently uses a baseline VDOT of `50` as a placeholder — this should eventually be read from the user's profile.
