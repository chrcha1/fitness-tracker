# Track — Design Document

A personal, phone-first fitness tracker for one user. Not a community, not a platform. The goal is to be the calmest, most-used tracker on your phone — opened daily for ~10 seconds, deleted from your home screen never.

---

## 1. Vision

> Make showing up easy, make progress visible, and never make me feel bad.

Track is a **personal commitment device**. It lives between two competing forces every fitness app fights:

- **Engagement** (the app needs you to come back so habits form)
- **Pressure** (too much engagement turns into guilt, then deletion)

The successful apps resolve this with three moves: **closure visuals, forgiving streaks, and trend-based insight**. We do the same — sized for one person, with one schema, owned forever.

### Core principles

1. **One thumb, ten seconds.** The most common interaction is opening the app, glancing at today, marking one thing done, closing it. Optimize that path before anything else.
2. **Glanceable > comprehensive.** Every screen answers a question in one second. Detail is one tap deeper, never the default.
3. **Trends > totals.** "Is this week better than last week?" beats "how many sessions ever?" Numbers without context are noise.
4. **Closure beats counting.** A ring filling, a Saturday hit, a streak alive — these are stronger motivators than a 78/100 counter. Counting is for accountants.
5. **Forgiveness is a feature.** Missing a day is not punished. Streaks can freeze. The app coaches the next move, never grades the last one.
6. **Personal, not social.** No leaderboards, no shared feeds, no "your friend just completed…" Every comparison is **you vs. last-you**.
7. **Your data, fully owned.** Local-first. Syncs to your own Gist. Exportable. No vendor lock-in. If GitHub disappears, the data fits in an email attachment.
8. **Calm aesthetic.** Whitespace, restraint, one accent color per modality, no badge spam, no notifications you didn't ask for.

### What this app explicitly is **not**

- A social platform (no feed, no friends, no follow)
- A coaching app (no plans dictated, no AI nutritionist)
- A medical device (no calorie counting, no diagnostics)
- A gear or marketplace surface (no ads, ever)
- A cross-discipline mega-tracker (no sleep, steps, hydration — Apple Health does that)

---

## 2. What we steal, from whom

| App | What works | What we take |
|---|---|---|
| **Apple Fitness Rings** | Closure as the primary motivator. Three rings, one job each: close them. | A **daily/weekly closure ring** per tab. Filling the ring *is* the action. |
| **Duolingo** | Streaks tie identity to the app. "I'm a 200-day-streak person." Streak freeze removes guilt. | **Streaks per tab**, with a **streak shield** that auto-spends when you miss a day (max 1/wk). |
| **Whoop / Oura** | Week trends, recovery scores, "how does this week compare to baseline." | **Weekly summary card** every Sunday with deltas vs. last week. |
| **Strava** | Personal records detected automatically; segments turn passive routes into compounding stats. | **Auto-detected PRs**: longest Z2, fastest interval, heaviest lift volume, lowest 7-day-avg weight. |
| **Strong / Hevy** | Logging a set takes one tap. History per exercise. Volume math. | Lifting tab gains **set-level logging** with auto-volume. |
| **Headspace** | Streak grace, gentle copy, never shames. | All system copy is encouraging, never accusatory. ("Catch up" never "missed".) |
| **Notion / Things** | The user owns the canvas. Calm typography. | **Per-day notes** (optional). One bottom-line aesthetic across the app. |
| **Cal AI / MyFitnessPal** | Quick-log shortcuts, last-value defaults. | **Defaults from history**: last weight is the next default; common Z2 durations are quick chips. |
| **Robinhood / Apple Stocks** | Sparklines that explain a number with one glance. | **Sparkline next to every hero number** (last 14 days). |
| **GitHub contribution graph** | The grid *is* the motivation. One year, at a glance. | A **year-heatmap** view per tab: 365 cells, fill them. |

The pattern across all winners: **the visualization is the product**. Numbers describe; pictures motivate.

---

## 3. Where we are today (audit)

**What's already strong:**
- 4 tabs (Zone 2, Intervals, Lifting, Weight) with distinct accent colors
- Per-day calendar grids, long-press editor
- iOS PWA install with standalone manifest
- GitHub Gist sync (multi-device, free, owner-controlled)
- Offline-first localStorage with last-write-wins merge
- Saturday weight goal trajectory (156→140 by 8/29)
- Inline goals on calendar Saturdays
- Milestone celebrations at 10/25/50/75/100 Z2
- Tested core data layer; CI on every push

**Honest gaps:**
- No **Today** home — all 4 tabs are siloed; no consolidated daily ritual
- Streaks exist for lifting/intervals but aren't celebrated; Z2 has no streak at all
- No **trend arrows** ("this week vs. last")
- No **PR detection** (longest Z2, lowest weight, etc.)
- No **streak forgiveness** (one missed day kills the chain)
- Goals are hardcoded (100 sessions, 156→140) — no settings UI to tune
- No **year heatmap** view
- No **per-day notes**
- No Apple Health import (weight especially is duplicated effort)
- Onboarding doesn't exist; first-time experience drops you in cold

---

## 4. Information architecture

Keep the four modal tabs. **Add a fifth at the front: Today.**

```
[Today]  [Zone 2]  [Intervals]  [Lifting]  [Weight]
```

- **Today** = the new default landing tab. Every modality's "what to do today" in a single scroll. Zone 2 ring, intervals checkbox, lifting tags, weigh-in field, weekly streak summary. Closes the "where do I start" question.
- The four modal tabs remain the deep view for that domain — calendar, chart, settings, history.

This single change is the largest quality-of-life win in the document.

---

## 5. Enhancement themes

### 5.1 The daily ritual: Today tab

A vertical scroll of "did I do this today" cards. One per modality. Tap a card to open its tab.

```
┌─────────────────────────────────────┐
│ MAY 2 · SATURDAY                    │
│                                     │
│  ⬤ Zone 2     50 min  [✓ done]     │
│  ⬤ Intervals  not yet  [Mark]      │
│  ⬤ Lifting    Up · Lo  [Edit]      │
│  ⬤ Weight     156.0 lb  on pace    │
│                                     │
│  This week: 3 / 5 days complete    │
│  🔥 5-day streak                    │
└─────────────────────────────────────┘
```

Underneath, a 7-day strip showing each day's completeness across all modalities (Apple Fitness style mini-rings). Last item: a **weekly summary card** that auto-appears every Sunday.

### 5.2 Closure and streaks

- **Closure rings** per tab (small ring icon next to tab label when today's goal is closed).
- **Streaks per tab** with their own definition:
  - Zone 2: consecutive days with a session
  - Intervals: consecutive *weeks* with at least one session
  - Lifting: consecutive days with tags logged (or weekly variant)
  - Weight: consecutive days with at least one weigh-in
- **Streak shield** — one auto-applied freeze per week per tab. Missing a day spends a shield rather than breaking the streak. Visible: "🛡️ shield used Apr 28."
- Visible streak count on each tab hero.

### 5.3 Trends & insights

For every hero number, show a **delta vs. prior period**:

- Zone 2 sessions this week: **3** ▲ +1 vs. last week
- Avg weight this week: **156.4** ▼ −0.6 vs. last week
- Lifting days this week: **2** ▲ +1
- Intervals this week: **1** ✓ on plan

Add **forecast lines**:

- Zone 2: "At your 7-day pace, you'll hit 100 by **Nov 12** (19 days early)."
- Weight: 14-day moving average projected forward, dotted, against the goal trajectory.

### 5.4 Personal records (PRs)

Detect automatically. Show on hero card and announce when broken:

- Zone 2: longest single session (mins), longest streak, most sessions in a week
- Intervals: most sessions in a month
- Lifting: longest streak of distinct tag-types in a week
- Weight: lowest 7-day moving average, biggest weekly drop (capped to keep healthy)

A new PR shows up in a small "🏆 New PR" toast and persists as a list on the menu screen.

### 5.5 Friction reduction

- **Quick-log from PWA shortcut** (long-press app icon on iOS): "Log Z2", "Log weight". iOS supports this via the manifest's `shortcuts` field — limited but real.
- **Smart defaults**: last weight pre-fills next weigh-in. Last Z2 duration pre-selects on the wheel.
- **Smart undo**: tapping an empty cell marks done with a default; tapping a done cell prompts to remove. Long-press always opens the editor.
- **Voice log** (web Speech API): say "fifty minutes" — overkill, but the foundation is one event handler.

### 5.6 Personalization & goal tuning

A **Goals** sheet in the menu where everything that's currently hardcoded becomes editable:

- Zone 2 target sessions (default 100)
- Zone 2 deadline (already editable)
- Weight: starting weight, target weight, weekly drop rate, plan start Saturday
- Intervals: weekly target sessions
- Lifting: weekly target days, optional per-tag weekly goals (e.g., "Upper 2x/wk")
- Tab visibility (hide a tab you don't use)
- Custom rewards: "At 50 Z2 sessions, treat self to {anything}."

All of these persist locally and to Gist (next to `store`/`meta`).

### 5.7 Visual polish & feel

- **Dark mode** that follows iOS system. The current design is essentially light-mode only.
- **Animated count-ups** when the hero number changes (300ms, eased).
- **Sparkline next to hero number** — last 14 days, 60×20px, single color.
- **Confetti** is already in; restrain to PRs and milestones (don't fire on every session).
- **Haptic patterns**: short tick on save, double tap on PR, success buzz on milestone.
- **Tab swipe** gesture: horizontal swipe across the body to switch tabs.
- **Pull-to-refresh** triggers a sync pull (works on iOS PWA via overscroll).
- **Status bar tint** matches the active tab's accent color.
- **Year heatmap** view, opened from the menu — 365 cells colored by activity intensity, GitHub-style.
- **Typography**: keep the current SF Pro feel; add tabular numerals everywhere a number lives in a column.

### 5.8 Reliability & data trust

- **Apple Health import** for weight: one-time CSV import via "Health → Export Health Data → unzip → drop the export into the app." (Browser file API, no native bridge needed.)
- **Apple Health one-way export** for completed Z2 sessions: write a `.ics` calendar file the user can import — no HealthKit access from a PWA, but iCal works.
- **Conflict UI**: when two devices wrote at the same minute, show a tiny "Merged 2 edits from another device" toast.
- **Backup**: Gist revision history is automatic. Surface a "Restore from history" UI that lists past gist revisions and previews diffs.
- **Onboarding** (3 cards on first run): set Zone 2 deadline, set weight goal, paste sync token. Skippable.
- **Error states** that say what to do, never just "Sync error."

### 5.9 Performance & PWA polish

- **App icon variants** — current is a 3-dot abstract; add user-selectable icons (3-4 variants).
- **Splash screen** matching the active accent.
- **Offline indicator** in the topbar pill.
- **Service worker** for true offline (cache index.html + core.js + manifest). Currently the app loads from network first.
- **Bundle**: still one HTML + one JS file. No frameworks. <40KB compressed remains the budget.

---

## 6. Per-tab deep dives

### Zone 2 (green)
**Existing:** 100 by Dec 1, calendar, today card, hero count, 6 logged.
**Add:**
- Daily streak with shield
- Sparkline of last 14 days' minutes
- Forecast: "At pace, you'll finish on {date}"
- PR: longest single session
- Weekly hit rate ("4/7 days this week")
- Optional heart rate field on each session (manual; HR data is Z2's whole point)

### Intervals (purple)
**Existing:** weekly target = 1 session, calendar, hit-rate stat.
**Add:**
- Weekly streak (consecutive weeks with ≥1 session)
- Editable weekly target (1, 2, 3 / week)
- PR: most sessions in a calendar month
- "Next interval recommendation" — the day with longest gap since the last session, suggested.
- Optional duration logging exists; surface average duration as a stat.

### Lifting (orange)
**Existing:** tag-based logging (Up/Lo/Co/Pu/St), days logged, weekly count, streak, top tag.
**Add:**
- **Set-level logging** (optional per session): exercise → reps × weight, tracked per exercise. Auto-volume.
- PR: heaviest set per exercise; longest tag-diversity streak.
- Per-tag weekly target ("Upper 2x/wk") with progress bars.
- Last-session recall: opening the editor preselects last session's tags.

### Weight (blue)
**Existing:** AM/PM logging, calendar, latest, 7-day avg, 7-day trend, count, Saturday goal trajectory inline on calendar, line chart.
**Add:**
- 14-day moving average overlay on chart (smoother than 7-day)
- Forecast line: linear regression of last 14 days projected forward, dotted
- Apple Health CSV import
- PR: lowest 7-day average, biggest weekly drop (with healthy cap)
- "Goal hit" badges accumulating on each Saturday cell
- Configurable plan: edit start Sat, start weight, target, rate per week
- Optional unit toggle (lb/kg)

### Today (new tab, would be tab 1)
- Per-modality "today" cards
- 7-day mini-grid showing all modalities' completeness per day
- Weekly summary auto-card on Sundays
- Active streaks across all tabs
- Time-of-day-aware copy ("Morning weigh-in?", "Evening Z2 walk?")

---

## 7. Anti-features (do **not** ship)

- Social feed, comments, kudos, follow, leaderboard
- Push notifications more than once a day (and only opt-in)
- Subscriptions, paywall, premium tier
- AI coach that prescribes workouts
- Calorie or macro tracking
- Step counting (it's Apple Health's job)
- Gamification beyond honest milestones (no XP system, no levels, no avatar)
- Achievements bloat: cap badges at ~10 lifetime; everything else is a PR (factual)
- Dark patterns: grace must be silent and free; no "buy a streak freeze for $0.99"

---

## 8. Roadmap

Sized to your context: solo developer, weekend cadence, single-file PWA.

### Phase 1 — Trust & polish (1 weekend)
*Before adding anything new, make what's there feel solid.*
- [ ] Service worker for true offline
- [ ] Onboarding flow (3 cards, skippable)
- [ ] Editable goals sheet (Zone 2 target/deadline, weight plan, intervals/lifting weekly targets)
- [ ] Settings backed up to Gist alongside data
- [ ] Dark mode

### Phase 2 — Daily ritual (1 weekend)
*The biggest engagement unlock.*
- [ ] Today tab (new tab #1, default landing)
- [ ] Streaks per tab + streak shield logic
- [ ] Trend deltas on every hero number
- [ ] Weekly summary card on Sundays
- [ ] Sparklines next to hero numbers

### Phase 3 — Insight & PRs (1 weekend)
- [ ] Auto-detected PRs (per tab, ~3 each)
- [ ] PR list view in menu
- [ ] Forecast lines (Zone 2 finish date, weight trajectory)
- [ ] 14-day moving average on weight chart
- [ ] Year heatmap view per tab

### Phase 4 — Lifting depth (1 weekend)
- [ ] Set-level logging (exercise + reps × weight)
- [ ] Per-tag weekly targets and progress
- [ ] Volume tracking + chart
- [ ] Last-session recall in editor

### Phase 5 — Imports & iOS feel (ongoing)
- [ ] Apple Health CSV import for weight
- [ ] PWA manifest shortcuts (long-press app icon → quick log)
- [ ] Tab swipe gesture
- [ ] Pull-to-refresh
- [ ] Custom app icon picker
- [ ] Status bar tint per tab

Each phase is shippable on its own and CI-tested before push.

---

## 9. Technical constraints

- **Stays single-file-ish.** `index.html` + `core.js` + `tests/`. No build step, no bundler, no framework. If a feature requires a bundler, the feature is wrong-shaped for this app.
- **Pure-logic-in-core.** Anything testable lives in `core.js`. The rule: if it has a date or a number in it, write a test.
- **CI must stay green.** `node --test` runs on every push; that's the contract.
- **No external runtime deps.** No CDN scripts, no analytics, no fonts beyond system. The whole app must work in airplane mode after first load.
- **Storage stays JSON.** Schema migrations are versioned (`v1`, `v2`, `v3`). Every schema bump comes with a migration test.
- **Gist as backend.** No server, no API, no auth besides the user's PAT. If a feature needs a server, it's a different app.

---

## 10. Visual language

- **Color per modality** (existing): Zone 2 green, Intervals purple, Lifting orange, Weight blue. New "Today" tab uses neutral ink with the active modality's accent borrowed in context.
- **Type scale**: hero 36px, headers 20px, body 14px, micro 11px. Tabular numerals on all numbers.
- **Cards**: 22px radius, 1px border, soft shadow. No gradients besides accent tints.
- **Spacing**: 16px page padding, 26px between major sections.
- **Motion**: 200ms ease for state, 300ms cubic-bezier for emphasis (rings, count-ups), 1.4s for celebrations.

---

## 11. Personal layer (specifically for you)

Hardcoded ambitions that the app is built around:

- **100 Zone 2 sessions** by **2026-12-01**
- **156 → 140 lb**, −1 lb / week, every Saturday from **2026-05-09** to **2026-08-29**
- **At least 1 interval session per week**, ongoing
- **Lifting**: at least 2 days a week (default; tunable). Tag mix bias toward upper/lower balance.

Built-in identity, not configuration:
- "Christelle's Track" rather than "Track" once an account is set
- Custom celebration copy ("Fight on" easter egg for USC)
- A page in the menu that just lists, plainly: **"What I am working on right now."** Reads from Goals settings. Updated yearly at most.

---

## 12. Open questions (for you)

1. **Today tab:** are you in? (My recommendation: yes, biggest unlock.)
2. **Streak shields:** auto-applied, or do you want to manually spend? (Recommend: auto. Less guilt, identical effect.)
3. **Lifting depth:** would you actually log set-by-set, or are tags enough? (If tags are enough, kill set logging from the roadmap.)
4. **Weight units:** lb-only is fine, right? (Toggle is small; just confirming default.)
5. **Apple Health import** priority — high (you weigh in every day) or low?
6. **Heart rate field** on Zone 2 sessions — useful, or noise? (Z2's whole purpose is HR-zone-based, so useful in theory, but adds a friction point.)
7. **Notifications:** do you want a single end-of-day "log today?" reminder, or none at all?

Answers to these decide which Phase 2 items survive the cut.

---

*One file, one user, one goal at a time. Build the thing you'll actually open.*
