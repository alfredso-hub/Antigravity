# Velocity — Development Notes

A VDOT-based adaptive running planner built with vanilla JS + Supabase.

---

## Deployment

| Environment | URL |
|---|---|
| Production (Vercel) | https://running-planner-two.vercel.app/ |
| Supabase project | https://supabase.com/dashboard/project/tmjhkebzxclyianmdyns |
| GitHub repo | https://github.com/alfredso-hub/Antigravity |

Deploys automatically from `main` branch on push. No build step — pure static files.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES Modules), HTML, CSS |
| Backend / DB | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel (static, `vercel.json` rewrites all routes to `index.html`) |
| Charts | Chart.js (CDN) + chartjs-adapter-date-fns + chartjs-plugin-annotation@3 |

**Key source files:**

| File | Purpose |
|---|---|
| `src/app.js` | All UI logic, global state, event handling (~3700 lines) |
| `src/db.js` | All Supabase CRUD operations |
| `src/paces.js` | VDOT / pace calculation engine (Jack Daniels formula) |
| `src/supabase.js` | Supabase client init + auth helpers |
| `src/engine/adjustment.js` | Plan adjustment engine (sickness/injury rules) |
| `index.html` | Single-page app shell, all tab content, Chart.js CDN scripts |
| `styles.css` | All CSS (dark theme, glassmorphism, tab system) |

**Global state variables in `app.js`:**

```js
let currentUser        // Supabase auth user object (null if logged out)
let allPlans           // All plan templates loaded from DB
let currentPlanWeeks   // Weeks for the currently selected plan
let currentCustomizations // User's day-reorderings for current plan
let myChart            // Plan chart (Chart.js instance)
let timelineChart      // Timeline scatter chart instance
let splitsChart        // Race Planner splits chart instance
let allUserEvents      // All user_events rows for current user
let committedPlanId    // plan_id from user_plan_commits (null if not committed)
let committedPlanData  // full user_plan_commits row
let currentWorkoutsMap // { scheduled_date → user_workout row }
let isSandboxMode      // true when sandbox toggle is on
let realCurrentUser    // preserved real user when sandbox is active
const SANDBOX_USER_ID = '99999999-9999-9999-9999-999999999999'
```

---

## Tabs Overview

| Tab | ID | Key functions |
|---|---|---|
| My Plan | `myPlanTab` | `renderPlan()`, `renderCommitButton()`, `renderProgressAnalytics()` |
| My Paces | `myPacesTab` | `loadUserProfile()`, `renderPaceTable()` |
| Timeline | `timelineTab` | `setupEventForm()`, `loadAndRenderTimeline()`, `renderTimelineChart()`, `renderEventsList()` |
| Create Plan | `createPlanTab` | `setupCreatePlan()` |
| Race Planner | `racePlannerTab` | `initRacePlanner()`, `calcSplits()`, `renderSplitsChart()` |

The Timeline tab is **lazy-loaded** — `renderTimelineChart()` and `renderEventsList()` are only called the first time the user clicks the tab (guarded by `let timelineLoaded = false` in `init()`). Subsequent data updates go through `loadAndRenderTimeline()`.

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
| `sql/08_commit_dates.sql` | Adds `start_date`, `race_date`, and `commit_metadata` JSONB to `user_plan_commits` |

---

## Key Features & Their Implementation

### VDOT Pace Calculation
- Implemented in `src/paces.js` using Jack Daniels' formula
- Three tuning modes: **Single PB**, **All PBs** (fitted average), **Goal Time**
- Paces saved to `profiles` table in Supabase
- The "My Paces" select element uses `id="pbRaceDistance"` (not `raceDistance` — see Gotchas)

### Plan Templates
- Plans stored as templates in `plans` + `plan_weeks` (relative weeks/days, no calendar dates)
- Users can reorder days per week — stored in `user_plan_customizations`

### Commit to Plan
- When a user commits, they pick a **start date** or **target race date**
- Generates concrete `user_workouts` rows with real calendar dates (one row per session)
- Status: `PLANNED | COMPLETED | SKIPPED`
- `getCommittedPlan()` must use `.maybeSingle()` not `.single()` — see Gotchas

### Session Tick-Off & Deviation Tracking
- Users open their schedule ("View My Schedule") from the plan tab once committed
- Clicking a session opens a modal to mark it complete with actual distance/time/notes
- Stored in `user_workouts.actual_data` (JSONB)

### Adjustment Engine (`src/engine/adjustment.js`)
- Triggered when a `sickness` or `injury` event is logged on the Timeline tab
- Applies Daniels rules: 75% volume reduction, post-fever intensity lock
- Converts Quality/Long sessions → Recovery sessions during lock period
- Saves a log to `plan_adjustments`, bulk-updates affected `user_workouts`
- Currently uses a baseline VDOT of `50` as placeholder — should read from user profile

### Admin Mode
- Toggled in the header (only visible to `profiles.is_admin = true`)
- Enables plan delete button and Sandbox toggle
- Set via SQL: `UPDATE profiles SET is_admin = true WHERE id = '<user-uuid>';`

### Sandbox Mode
- Appears next to Admin toggle when Admin Mode is on
- Swaps `currentUser.id` in-memory to `SANDBOX_USER_ID` (`99999999-9999-9999-9999-999999999999`)
- All DB writes go to sandbox user's rows; real account is untouched
- Requires `sql/07_admin_rls_bypass.sql` to be applied (real JWT is used for auth but writes go to sandbox rows)
- Orange sticky banner ("SANDBOX MODE ACTIVE") and "Wipe Data" button shown while active

### Timeline Tab
- Tracks race results, sickness periods, injury periods via `user_events` table
- Chart: Chart.js scatter plot (time scale on X-axis, race time in seconds on Y-axis)
- Health events: coloured box annotations via chartjs-plugin-annotation
- Health events also appear as overlays on the main plan chart
- **Lazy-loaded** on first tab click; refreshed via `loadAndRenderTimeline()` after saves/deletes
- Chart rendering is **deferred via `setTimeout(..., 0)`** inside `loadAndRenderTimeline()` to avoid blocking Supabase promise callbacks

### Race Planner Tab
- Calculates per-km/mile split paces for a target race time
- Split strategies: Even, Negative (−1%), Positive (+1%), Custom ramp
- Displays splits table + Chart.js line chart (`id="splitsChart"`)
- Chart Y-axis: pace in sec/km (lower = faster); X-axis: split number (km)
- `formatPace()` returns an HTML string with `<span>` for styled hundredths — use `innerHTML`, not `textContent`, when rendering it
- The distance select in this tab uses `id="raceDistance"`; the one in My Paces uses `id="pbRaceDistance"` (fixed duplicate-ID bug)

---

## Important Gotchas

### Supabase `.single()` vs `.maybeSingle()`
**Never use `.single()` when the query might return 0 rows.** Newer PostgREST versions return `406 Not Acceptable` instead of a PGRST116 error, which can poison the Supabase client state for concurrent requests.
- ✅ Use `.maybeSingle()` when 0 rows is a valid/expected result (e.g. `getCommittedPlan` — user may not have committed)
- ✅ Use `.single()` only when you are certain exactly 1 row will always exist

### Supabase INSERT — don't chain `.select().single()`
Chaining `.insert().select().single()` requires both INSERT and SELECT RLS policy evaluations. In some Supabase configurations this causes the request to hang indefinitely rather than returning an error. **Always do a plain `.insert()` unless you specifically need the returned row.**

### `createUserEvent` in `db.js`
Returns `{ data: null, error }` after a plain INSERT. The `data` field is always null — don't rely on the inserted row being returned.

### Duplicate element IDs — `raceDistance` / `pbRaceDistance`
`index.html` previously had two `<select id="raceDistance">` elements (one in My Paces, one in Race Planner). The Race Planner's `calcSplits()` was reading the wrong one. Fixed by renaming the My Paces select to `id="pbRaceDistance"` and updating all JS references (`loadUserProfile`, `saveProfile`-related listeners, etc.).

### RLS + Sandbox Mode
`auth.uid()` always reflects the real JWT — swapping user IDs in JS doesn't bypass RLS. The admin bypass policies in `sql/07_admin_rls_bypass.sql` are essential.

### Sandbox user
Fixed UUID `99999999-9999-9999-9999-999999999999`. Must be inserted into `auth.users` via the Supabase SQL editor — normal signup flow can't create it.

### Import order in `app.js`
All Supabase db functions must be in one `import { ... } from './db.js'` block to avoid ES module syntax errors.

### `loadAndRenderTimeline()` — deferred rendering
`renderTimelineChart()` and `renderEventsList()` are wrapped in `setTimeout(() => {...}, 0)` inside `loadAndRenderTimeline()`. This yields the event loop to let pending Supabase promise callbacks run first, preventing the second save from hanging while Chart.js initialization blocks the JS thread.

### Timeline form submit safety timer
The form submit handler sets a **10-second hard reset** (`safetyTimer`) on the submit button. If `createUserEvent` never resolves (network drop, Supabase outage), the button is always re-enabled after 10 seconds.

### `formatPace()` returns HTML
`formatPace(seconds)` returns a string like `"4:15<span class='pace-hundredths'>23</span>"`. Render it with `element.innerHTML = formatPace(...)`, not `textContent`.

### Chart.js — Timeline chart Y-axis
The timeline chart Y-axis shows race time in seconds. Lower on the axis = faster time (not inverted). The splits chart Y-axis shows pace in sec/km — also not inverted (lower = faster).

### Timeline tab lazy loading vs `loadAndRenderTimeline()`
The `timelineLoaded` flag (closure in `init()`) prevents double-rendering on tab click. `loadAndRenderTimeline()` bypasses this flag and always re-renders both the chart and the events list. Do not add calls to `setupEventForm()` inside `loadAndRenderTimeline()` — that would register duplicate submit event listeners.

---

## Common Tasks

### Add a new DB column
1. Write the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` in a new numbered SQL file under `sql/`
2. Apply it in the Supabase SQL Editor
3. Update the relevant function in `src/db.js`
4. Update the TypeScript-style JSDoc if present

### Add a new tab
1. Add the tab button + content div to `index.html` (follow the `data-tab="..."` / `id="..."` pattern)
2. Add a `setup<TabName>()` function in `app.js`
3. Call it from `init()`
4. If the tab has charts or expensive rendering, lazy-load it using the `timelineLoaded` pattern

### Deploy
```bash
git add -A && git commit -m "..." && git push
```
Vercel auto-deploys from `main`. No build command needed.

### Run locally
Open `index.html` directly in a browser via a local HTTP server (e.g. `npx serve .` or VS Code Live Server). The app uses ES modules so it won't work from `file://`.
