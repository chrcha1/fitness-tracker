# Track — Feature Inventory

A reference for every feature this app has, plans to have, and explicitly rejects. Status legend:

- **[live]** shipped and deployed
- **[planned]** designed but not implemented yet
- **[rejected]** considered and explicitly cut

If a feature is missing here, it doesn't exist. If a feature is here, it should match what's actually in the code (when status is `live`).

---

## 1. Core principles

- One thumb, ten seconds. Most-common path is open + glance + maybe one tap.
- Phone-first, desktop-also.
- Trends > totals. "Is this week better than last?" beats raw counts.
- Closure beats counting. Filling a ring beats incrementing 47 → 48.
- Forgiveness is a feature. Missed days don't reset everything.
- Personal, not social. No leaderboards, no friends, no follow.
- Your data, fully owned. Local-first, syncs to your private gist.
- Calm aesthetic. One accent color per modality, no badge spam.

Anti-features (will not ship): social feed, ads, paywalls, AI coach prescribing workouts, calorie prison alerts, step counting (Apple Health does that), achievement bloat.

---

## 2. Information architecture

Six tabs at the bottom, in this exact order:

1. **Today** — daily ritual surface, default landing
2. **Zone 2** — endurance habit, 100 sessions by 2026-12-01
3. **Intervals** — weekly cadence, 1 session per week
4. **Lifting** — tag-based logging
5. **Nutrition** — meals + macros, talk to log
6. **Weight** — body weight + Saturday goal trajectory

Each tab has its own accent color: green / purple / orange / paper / blue (Today is neutral).

---

## 3. Today tab `[live]`

The default landing screen.

| Feature | Status | Notes |
|---|---|---|
| Time-of-day greeting (morning / afternoon / evening / late night) | live | Cycles based on current hour |
| Cadence-aware subtitle (no "X of 4 done" guilt-tripping) | live | Six copy variations from "Quiet day so far" to "Big day, rest is part of the plan too" |
| Per-modality cards (Zone 2, Intervals, Lifting, Nutrition, Weight) | live | Each card has a closure ring, name, status text |
| Closure rings fill on completion | live | Ring fills 100% when the day is "done" for that modality |
| Nutrition ring fills proportionally to protein progress | live | Unlike binary done/not-done, scales with protein-to-goal ratio |
| Short-tap modality card = mark today complete | live | Cardio/intervals quick-mark; Weight/Lifting/Nutrition open editor or chat |
| Long-press modality card = navigate to that tab | live | 450ms hold |
| 7-day completion strip with colored dots per modality | live | One dot per logged modality per day, color-coded |
| Weekly summary card on Sundays + Mondays | live | Last 7 days vs prior 7 days for Z2, intervals, lifting, weight |

---

## 4. Zone 2 tab `[live]`

Goal: **100 sessions by 2026-12-01**. Currently averaging ~3-4/week.

| Feature | Status | Notes |
|---|---|---|
| Calendar grid showing every logged session | live | Months scroll vertically; today is highlighted |
| Hero: count out of 100 + hours logged + deadline | live | Big number with `/ 100 sessions` |
| Progress bar | live | Linear fill toward 100 |
| Stats row: To go, Days left, Pace per week | live | Recomputed on every render |
| Tap an empty future-day = no-op | live | Future days locked |
| Tap empty today = mark done with no time | live | The "I just finished one" fast path |
| Tap empty past day = open duration wheel | live | Lets you log time on a missed day |
| Tap any logged day = open editor with current time, with a Remove button | live | Edit-or-remove from one place |
| Long-press any non-future cell = open editor | live | 450ms |
| Wheel picker for minutes (5–180) with 30/45/60/90 quick chips | live | Snap-scrolling iOS-style |
| Streak counter (daily) with auto streak shield | live | Shown as 🔥 N in hero augment row; 🛡️ if a shield was used |
| Trend delta vs last week | live | ▲ +1 / ▼ -2 (this week count vs prior 7 days) |
| 14-day sparkline | live | Inline SVG next to hero |
| Milestone celebrations at 10/25/50/75/100 sessions | live | Confetti animation; one-shot per milestone |
| Editable deadline | live | Settings → Set Zone 2 deadline |

---

## 5. Intervals tab `[live]`

Goal: **1 session per week**, ongoing.

| Feature | Status | Notes |
|---|---|---|
| Hero: this-week count out of weekly target | live | Default target = 1 |
| Stats: Total sessions, Wk streak, Hit rate % | live | Hit rate = % of weeks with at least 1 |
| Calendar grid | live | Same shape as Z2 |
| Same tap routing as Z2 (empty today = quick mark, others open editor) | live | Shared logic |
| Wheel picker (5–120 min) with 15/20/30/45 quick chips | live | Lower default than Z2 since intervals are usually shorter |
| Weekly streak counter (consecutive weeks with at least 1 session) | live | Different from Z2's daily streak |
| Trend delta + sparkline | live | Same components as Z2 |
| Editable weekly target | planned | Currently hardcoded to 1; surface in goals sheet |

---

## 6. Lifting tab `[live]`

Tag-based session logging. Five tags, multi-select.

| Feature | Status | Notes |
|---|---|---|
| Tags: **Upper, Lower, Core, Pullups, Stretch** | live | Tap any combination per session |
| Hero: total days logged | live |  |
| Stats: This week count, Streak, Most-used tag | live |  |
| Calendar grid with one-letter tag indicators on each day cell | live | U/Lo/Co/Pu/St abbreviations |
| Tap any day = open tag-multi-select editor | live |  |
| Long-press = same | live |  |
| Streak (daily) + trend delta + sparkline | live | Same hero augment as Z2 |
| Per-tag weekly targets ("Upper 2x/wk") with progress bars | planned | Roadmap Phase 4 |
| Set-level logging (exercise + reps × weight) | rejected | Tags are enough for personal use; user explicitly confirmed |

---

## 7. Weight tab `[live]`

The body-weight-and-goal-trajectory tab.

### Logging

| Feature | Status | Notes |
|---|---|---|
| AM/PM weigh-in slots per day | live | Either, both, or neither |
| Wheel picker for weight (e.g. 100.0–250.0 in 0.5 lb steps) | live | iOS-style snap |
| Tap any day = open editor | live | Empty today included (no quick-mark path; entering a number is the action) |

### Goal trajectory

The user's plan: **start 156 lb on 2026-05-09 → 140 lb target by 2026-08-29, dropping 1 lb every Saturday**.

| Feature | Status | Notes |
|---|---|---|
| Saturday goal weight chip on every Saturday cell of the calendar | live | Small chip showing the target weight for that week (156, 155, 154, …, 140) |
| Past Saturday: green tint if you hit the goal | live | `goal-hit` class with green soft fill |
| Past Saturday: orange tint if you missed | live | `goal-miss` class with orange soft fill |
| Future Saturday: dashed soft outline (upcoming) | live |  |
| Goal card (3 blocks): Next Goal / VS Goal / Target | live | Above the chart |
| Next Goal: weight + date for upcoming Saturday | live | "156 lb · Sat, May 9" |
| VS Goal: latest weight delta from current applicable goal | live | Green if at-or-under, orange if over |
| Target: 140 lb + ETA "by Aug 29" | live |  |
| Calendar runs out to the final Saturday of the plan | live | So all 17 weekly chips are visible |

### Chart

| Feature | Status | Notes |
|---|---|---|
| SVG line chart, full-width | live | Lives between the goal card and the calendar |
| Solid blue line: actual weights (AM/PM averaged) | live |  |
| Dashed orange line: goal trajectory | live | Plots the 17 Saturday checkpoints |
| Dotted green horizontal line at 140 lb (target) | live |  |
| Today vertical marker | live | Faint vertical line at "now" on the x-axis |
| Y-axis gridlines + integer labels | live |  |
| X-axis month labels | live |  |
| 14-day moving average overlay | planned | Roadmap Phase 3 |
| Forecast line (linear regression projected forward) | planned | Roadmap Phase 3 |

### Hero stats

| Feature | Status | Notes |
|---|---|---|
| Latest weigh-in (big number) | live |  |
| 7-day avg | live |  |
| 7-day change | live | + or - delta |
| Total logged days | live |  |
| Streak counter + lower-is-better trend delta + sparkline | live | Hero augment row; weight-aware semantics (going down = good) |
| Saturday hit celebration | live | One-shot confetti when latest weight ≤ today's Saturday goal |

### Configuration

| Feature | Status | Notes |
|---|---|---|
| Plan parameters (start Sat, start lb, target lb, step lb/wk) editable in app | planned | Currently hardcoded as `WEIGHT_GOAL_*` constants |
| Unit toggle (lb / kg) | planned |  |
| Apple Health CSV import | planned | One-time import via a file picker |

---

## 8. Nutrition tab `[live]`

Meals + macros. Talk to log via Claude, or tap + to log manually.

### Logging

| Feature | Status | Notes |
|---|---|---|
| Day navigator (prev / next) | live | Scroll back to past days |
| Hero: today's calories out of goal + P/C/F | live | Default 1650 kcal goal, 130g protein |
| Calorie progress bar | live |  |
| Sub-line: "Xg protein left, Y kcal left" | live |  |
| Timeline of entries (time + food + portion + macros + kcal) | live | Chronologically sorted |
| Tap entry = open manual editor (food, portion, kcal, P, C, F) with Remove button | live |  |
| **+ button** for manual entry (no API key required) | live | Bottom-left of the chat dock |
| Empty-state copy: "Tap + to add manually, or talk to Claude" | live |  |

### Claude wrapper (the talk-to-log flow)

| Feature | Status | Notes |
|---|---|---|
| Browser-direct API call to api.anthropic.com | live | Uses `anthropic-dangerous-direct-browser-access: true` |
| API key stored in localStorage (same threat surface as the GitHub PAT) | live | Set in Settings → Anthropic API key |
| Model picker: Haiku 4.5 (default), Sonnet 4.6, Opus 4.7 | live |  |
| System prompt cached via `cache_control: ephemeral` | live | Request 2+ within 5 minutes are roughly an order of magnitude cheaper |
| Tool-use forced (`tool_choice: log_food`) so we always get structured entries | live |  |
| Tool returns array of entries (time, food, portion, macros, confidence) | live |  |
| Optimistic rendering + status pill for in-flight calls | live |  |
| Error mapping: 401 → "key rejected", 429 → "rate limited", 529 → "overloaded" | live |  |
| `raw_input` preserved on each entry for audit | live |  |
| Voice input via Web Speech API | planned | Deferred to nutrition Phase D |
| Photo-of-food vision input | rejected | Skip until requested |
| Profile/goal editor sheet (calorie target, protein target, etc.) | planned | Currently hardcoded |

### Imported history

| Feature | Status | Notes |
|---|---|---|
| 9 nutrition entries from cal-macro-track on 2026-04-23 | live | One-time import via `gh api PATCH gist` |
| 1 weight entry from cal-macro-track on 2026-04-24 (157 lb) | live | Same import |

---

## 9. App-wide

| Feature | Status | Notes |
|---|---|---|
| Single-page PWA (HTML + core.js + sw.js) | live |  |
| Default landing tab = Today on every cold open | live | Doesn't persist last tab across sessions |
| Dark mode auto (prefers-color-scheme) | live | All variables flip; tabbar uses --surface |
| 2 AM day cutoff | live | Logging before 2am locally goes into the previous calendar day's bucket |
| Service worker (network-first, falls back to cache offline) | live | Cache name `track-v4`; fresh code always wins when online |
| Auto-repair on load | live | Strips phantom tab-name keys; pushes cleaned state to gist |
| GitHub Gist sync | live | One private gist holds all data |
| Conflict resolution: last-write-wins per key, with deletion tombstones | live | `mergeTabKeys` pure function in core.js |
| Auto sync push debounced 600ms after every save | live |  |
| Offline-first localStorage cache | live |  |
| iOS PWA: Add to Home Screen launches fullscreen | live | Manifest + apple-touch-icon |
| Em dash ban (no `—` anywhere in code or copy) | live | Locked in by a test |
| Confetti milestone celebrations | live | Z2 at 10/25/50/75/100; weight goal hit on Saturday |
| Haptic feedback on all primary interactions | live | `navigator.vibrate()` |
| Phone-first column layout | live | Centered 540px column on viewports >= 1024px (laptops only); full width below |
| Em dash ban enforced via test | live | `tests/html-structure.test.js` greps source files |

### Settings menu

| Feature | Status | Notes |
|---|---|---|
| Zone 2 deadline editor | live |  |
| Cloud sync setup (GitHub PAT + Gist ID) | live |  |
| Anthropic API key + model picker | live |  |
| Export all data as JSON | live |  |
| Reset all data | live | Tombstones every key so deletes propagate |
| Editable goals sheet (Z2 target, weight plan, intervals weekly target) | planned | Currently goals are constants |
| Tab visibility toggles | planned | Hide a tab you don't use |
| Onboarding flow on first run | planned | Three cards for first-time setup |

---

## 10. Personal layer (specific to me)

Hardcoded ambitions the app is built around:

- Zone 2: **100 sessions by 2026-12-01**
- Weight: **156 lb (2026-05-09) → 140 lb (2026-08-29)**, -1 lb every Saturday
- Intervals: **1 session per week**, ongoing
- Lifting: at least **2 days per week** (default; tunable later)
- Diet: omnivore, no allergies; goal **1650 kcal/day, ≥130g protein**
- Pantry favorites the AI logger knows about: collagen peptides, NURRI shakes, BUILT puffs, Trader Joe's chili lime chicken, sourdough toast, eggs

---

## 11. Tests + CI

| Feature | Status | Notes |
|---|---|---|
| Pure-logic-in-core.js architecture | live | Anything testable lives in core.js |
| `node --test tests/*.test.js` runs the whole suite | live | Zero npm dependencies |
| GitHub Actions runs tests on every push | live | `.github/workflows/ci.yml` |
| Five test files | live | core, streak, edge-cases, exhaustive, merge, html-structure |
| Total assertions | live | 218+ |
| Test categories | live | parser shapes, sanitize idempotence, streak boundaries, weight goal math, weekly cadence, decideTapAction routing, merge conflict resolution, HTML invariants, no em dashes |

---

## 12. What I'm not building

Explicitly considered and cut:

- Social feed, friends, follow, kudos
- Push notifications more than once per day (and only opt-in)
- AI coach that prescribes workouts
- Calorie / macro prison ("you've exceeded your limit" alerts)
- Step counting (Apple Health does this)
- XP / levels / RPG progression
- Photo-of-food vision input (deferred unless requested)
- Set-level lifting logging (tags are enough)
- iOS native rewrite (PWA is the right shape)

---

## 13. Roadmap (next likely work)

Roughly in order of value-per-effort:

1. **Editable goals sheet** so plan parameters aren't hardcoded.
2. **PR detection** (longest Z2, lowest 7-day weight avg, longest streak). Auto-toast when broken.
3. **Forecast lines** (Z2 finish-by date based on pace, weight regression projected forward).
4. **Year heatmap** view per tab (GitHub-style contribution graph).
5. **Editable lifting per-tag weekly targets** (Upper 2x/wk progress bars).
6. **Voice input** on nutrition chat (Web Speech API).
7. **Apple Health weight CSV import**.
8. **Onboarding cards** on first run.
9. **PWA manifest shortcuts** (long-press app icon → "Log Z2", "Log weight").
10. **Tab swipe gestures**.

---

*If anything in here is `[live]` but not actually working, or a real feature is missing entirely, fix this doc first, then the code.*
