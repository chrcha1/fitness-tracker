# Nutrition Integration — Plan

Integrating `cal-macro-track` (your existing nutrition app at `~/Documents/Claude/Projects/cal-macro-track/`) into the fitness tracker as a fifth data tab, with a Claude wrapper that lets you talk and have it auto-log entries.

This is a major refactor. This doc plans it end-to-end so we can execute in phases.

---

## 1. Vision

> Open the app. Tap **Nutrition**. Type *"two scrambled eggs and a piece of sourdough toast"*. Watch entries populate the day with calories, protein, carbs, fat — already saved, already synced.

**Three things have to be true** for this to feel right:

1. **Friction below brain-stem.** Logging a meal can't take more than 3 seconds of attention. If it does, you won't do it. The chat box is the only sustainable input modality for someone who lives in the app.
2. **One source of truth.** Nutrition data must live in the same data layer as fitness data — same gist, same auto-sync, same ownership model. No second login, no second device pairing, no second backup story.
3. **Phone-shaped.** The current dashboard is a desktop layout that *resizes* to phones. The integrated version is designed phone-first — every primary action sits in the thumb arc.

**What this is not:**

- A calorie-counting prison. No daily lockout, no "you've exceeded your limit" alerts.
- A barcode-scanning app. Talking is faster than scanning.
- A meal-plan generator. You decide what to eat; the app remembers what you ate.
- A shared social feed. Same anti-features as the rest of Track.

---

## 2. Current state — audit

### `cal-macro-track` (existing nutrition app)

**File layout:**
```
cal-macro-track/
├── dashboard.html           # the bookmarked page (mostly desktop layout)
├── index.html               # entry/landing page
├── data/
│   ├── profile.json         # bio + goals + protein zones
│   ├── log.json             # daily food entries + workouts (keyed YYYY-MM-DD)
│   ├── foods.json           # food reference catalog
│   └── weight_history.json  # weight time-series
├── images/
└── README.md
```

**How it works today:**
- You tell Claude (in a chat) what you ate.
- Claude edits `data/log.json` directly, commits, pushes.
- Pages serves the dashboard; you bookmark it on phone.
- ~30 seconds from "I just ate" to dashboard reflecting it.

**Data shape (good — well-designed):**
```json
"2026-04-23": {
  "entries": [
    {
      "id": "e1", "time": "09:00",
      "food": "Coffee with collagen",
      "portion": "~1 scoop (12g collagen)",
      "emoji": "☕", "cls": "coffee",
      "macros": { "calories": 45, "protein_g": 11, "carbs_g": 0, "fat_g": 0 },
      "confidence": "estimate",
      "source_url": "...",
      "source_label": "Vital (ref)"
    },
    ...
  ],
  "workouts": [...]
}
```

This schema is excellent — `confidence` + `source_url` + `source_label` capture provenance, which is exactly right for a tracker that has to be trusted.

**Strengths:**
- Clean data model
- Per-day grouping
- Provenance tracking
- Dashboard renders well on mobile-resize
- Already on GitHub (presumably; user mentioned "Documents")

**Gaps:**
- **Logging requires Claude-as-a-developer.** You're paying API tokens for someone to be your scribe; the loop is slow (commit + push + Pages rebuild = ~30s) and requires being on a Mac with the repo cloned.
- **Two apps, two URLs, two PWA installs.** Your fitness data and food data live in separate worlds.
- **Desktop-first dashboard.** Wide hero, two-column hero-wrap, calendar with 7-day strip — works on phone but doesn't *feel* phone-native.
- **No streaks, no ritual surface, no integration with weight/lifting context.** The system doesn't say "you weighed 156 today, here's how protein looks against goal."

### `fitness-tracker` (this repo)

**Strengths it brings:**
- Live PWA with offline support, gist sync, auto-repair, dark mode
- Already-installed home-screen icon
- 5-tab structure with Today as the daily ritual surface
- Pure-logic-in-`core.js` + Node test suite + CI
- `weight` data is duplicated effort — already lives here too

**Gaps for nutrition:**
- No food data model
- No chat surface
- No Claude API calls anywhere (only GitHub gist sync)

---

## 3. Architecture options

### Option A — Two separate apps (status quo, plus mobile polish)
- Keep `cal-macro-track` independent
- Just make its dashboard mobile-first
- Add a Claude-API chat panel to it directly (no integration with Track)

**Pros:** smallest change. **Cons:** preserves the dual-app problem you flagged. **Verdict:** not what you asked for.

### Option B — Monorepo, separate URLs
- Move `cal-macro-track` into the `fitness-tracker` repo as a sibling folder
- Two `index.html` files, two Pages routes
- Share `core.js` for common logic

**Pros:** unified deployment, shared code. **Cons:** still two apps from the user's perspective (two PWA installs, two home-screen icons, two URLs).

### Option C — One app, Nutrition as a 6th tab ⭐ recommended
- Add a `Nutrition` tab to the existing fitness tracker
- Migrate `cal-macro-track`'s data into the same gist as the fitness data
- Build a chat-driven logging flow inside the Nutrition tab
- Retire the standalone `cal-macro-track` after data migration; keep the repo as historical archive

**Pros:** one app, one PWA, one sync, one mental model. **Cons:** larger refactor; bigger gist payload; more code in one HTML file.

**Recommended:** **Option C.** The whole point of your request is integration. Half-integration is the worst outcome.

### Tab order with Nutrition added

```
[Today]  [Zone 2]  [Intervals]  [Lifting]  [Nutrition]  [Weight]
```

Nutrition next to Weight because they're the two outcome-tracking tabs (input vs body). The three "did I do the workout" tabs cluster together. Today stays primary.

---

## 4. Data model unification

### Current `store` shape (fitness)
```json
{
  "cardio":    { "YYYY-MM-DD": { "mins": 50 } },
  "intervals": { "YYYY-MM-DD": { "mins": 30 } },
  "lifting":   { "YYYY-MM-DD": { "tags": ["upper", "lower"] } },
  "weight":    { "YYYY-MM-DD": { "am": 156.4, "pm": 157.1 } }
}
```

### Add a `nutrition` field
```json
{
  ...
  "nutrition": {
    "YYYY-MM-DD": {
      "entries": [
        {
          "id": "n_2026-05-02_001",
          "time": "09:05",
          "food": "Coffee with collagen",
          "portion": "~1 scoop (12g collagen)",
          "macros": { "calories": 45, "protein_g": 11, "carbs_g": 0, "fat_g": 0 },
          "confidence": "estimate",
          "source": "claude-haiku-4-5",
          "raw_input": "coffee with collagen this morning"
        }
      ]
    }
  }
}
```

Notes:
- `id` becomes `n_<date>_<seq>` so cross-tab IDs never collide
- `source` records what created the entry (`claude-haiku-4-5`, `manual`, `imported`) for audit
- `raw_input` keeps the original utterance for replay/correction
- `cls`, `emoji`, `image_url` from the old schema can come along — they're optional decoration
- `workouts` field from the old schema is dropped — already covered by `cardio`/`intervals`/`lifting`

### Profile + goals
Move `profile.json` content into a top-level `profile` field in the gist:
```json
{
  "store": { ... },
  "profile": {
    "bio": { "height_in": 65.5, "weight_lb": 156, "age": 22, "sex": "F", "last_updated": "2026-05-02" },
    "goals": {
      "calories_kcal": 1650,
      "calorie_window": [1600, 1700],
      "protein_g_target": 130,
      "weight_target_lb": 140,
      "weight_loss_per_week_lb": 1
    }
  },
  ...
}
```

This profile is what the Claude wrapper uses to compute *contextual* answers ("you've hit 80g protein with one meal left to go").

### Migration plan
- `core.js` gets a `migrateNutritionFromCalMacroTrack(legacyLog)` function
- One-time UI: "Import nutrition history from cal-macro-track" → upload `log.json` → backfill `store.nutrition`
- Existing `weight_history.json` data also gets imported into `store.weight` (deduped against current entries)

---

## 5. The Claude wrapper — talk and it logs

### Design goal

The user types or dictates a freeform message. Claude returns **structured nutrition entries** (one or many) that the app appends to today's log. No back-and-forth, no clarification, no confirmation step in the common case — confirm only when *confidence is low*.

### Two architectural choices

#### (A) Browser-direct API call (recommended) ⭐
- The Anthropic SDK supports browser-direct calls with `dangerouslyAllowBrowser: true`
- The user's API key lives in the browser (localStorage), exactly like the GitHub PAT for sync
- No server, no proxy, no $/month
- Same threat model as the GitHub PAT: keys live on your phone, you trust your phone

**Trade-offs:**
- Anyone with browser access (or an XSS) can read the key. For a personal PWA on your own device, this is the same risk as the existing GitHub PAT.
- Direct usage means the API key is sent from a browser — Anthropic flags this as "dangerous" because it usually leaks to end-users; here, you *are* the end user, so the warning doesn't apply.

#### (B) Cloudflare Worker proxy (alternative)
- A 30-line worker holds the API key as a secret
- Browser calls the worker, worker calls Claude
- Worker is free up to 100K requests/day on Cloudflare's free plan

**Trade-offs:**
- Adds an external dependency (Cloudflare account)
- Adds ~50ms latency
- Better hygiene if you ever share the URL with someone
- More work to set up

**Recommendation: A.** This is a single-user app on your own phone. The proxy is overkill for the threat model.

### Model choice

| Model | Cost in/out (per 1M tok) | Why pick it |
|---|---|---|
| **Haiku 4.5** | $1 / $5 | Default — nutrition extraction is structured, simple, well-suited to Haiku. ~$0.001 per meal logged. Recommended starting point for personal use. |
| **Sonnet 4.6** | $3 / $15 | If Haiku misses on edge cases (rare ingredients, recipe disambiguation). |
| **Opus 4.7** | $5 / $25 | Overkill for this task; reach for it only if both Haiku and Sonnet underperform. |

For a single-person app logging maybe 5 meals/day, expect <$1/month on Haiku 4.5 even with prompt-caching turned off. With caching the cost halves or better.

### Prompt design

**System prompt** (cached — same bytes every request, hits prompt cache from request #2 onward):

```
You are a nutrition logging assistant for a personal tracker.

Your only job: convert the user's freeform description of food into one or more
structured entries by calling the `log_food` tool. Never reply with text — always
use the tool.

Profile:
- Goal: 1650 kcal/day, ≥130g protein, weight 156→140 lb at -1 lb/wk
- Diet: omnivore, no allergies
- Common pantry items: collagen peptides (Vital), NURRI shakes, BUILT puffs,
  Trader Joe's chili lime chicken strips, sourdough toast, eggs

Rules:
1. Estimate macros from typical USDA values when no brand is given. Set
   confidence: "estimate".
2. When the user names a brand (e.g. "BUILT puff"), use labeled values from
   memory. Set confidence: "labeled".
3. When the user is vague ("a sandwich"), pick a sensible default and set
   confidence: "estimate". Don't ask clarifying questions.
4. Round calories to nearest 5, protein/carb/fat to nearest 0.5g.
5. If multiple foods, emit one entry per food, all in the same tool call.
6. Use HH:MM in 24-hour local time for the `time` field; default to "now"
   wording is the current time.
```

**Tool definition:**
```json
{
  "name": "log_food",
  "description": "Append one or more food entries to today's nutrition log.",
  "input_schema": {
    "type": "object",
    "properties": {
      "entries": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "time": { "type": "string", "description": "HH:MM 24-hour local time" },
            "food": { "type": "string", "description": "Concise dish/food name" },
            "portion": { "type": "string", "description": "Amount as natural language" },
            "macros": {
              "type": "object",
              "properties": {
                "calories": { "type": "number" },
                "protein_g": { "type": "number" },
                "carbs_g": { "type": "number" },
                "fat_g": { "type": "number" }
              },
              "required": ["calories", "protein_g", "carbs_g", "fat_g"]
            },
            "confidence": { "type": "string", "enum": ["labeled", "estimate", "guess"] },
            "source_label": { "type": "string", "description": "Brand or reference, optional" }
          },
          "required": ["time", "food", "portion", "macros", "confidence"]
        }
      }
    },
    "required": ["entries"]
  }
}
```

**Per-message user prompt:** the user's literal message, plus a small footer with current time + today's already-logged entries (so Claude doesn't double-log "I had eggs again" if eggs were just added).

**Adaptive thinking:** `thinking: {type: "adaptive"}` on Haiku 4.5 — wait, Haiku doesn't support effort parameter. On Haiku, just call without thinking. On Sonnet 4.6 / Opus 4.7, add `thinking: {type: "adaptive"}` for harder cases.

### Prompt caching

Cache the system prompt + tool definition. From request #2 onward (within 5 minutes), they cost ~10% of the original. Critical for everyday use where you log multiple meals close together.

```ts
client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  tools: [LOG_FOOD_TOOL],
  tool_choice: { type: "tool", name: "log_food" }, // force the tool every time
  messages: [{ role: "user", content: userInputWithFooter }],
})
```

Forcing `tool_choice` guarantees we never get text back — only structured entries.

### UX flow

```
┌─────────────────────────────────────────┐
│  Nutrition · Fri May 2                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  900 kcal · 78g P · 60g C · 22g F│   │   ← live totals
│  │  ████████████░░░░░ goal 1650    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Today                                  │
│  ┌─────────────────────────────────┐   │
│  │ 09:05  ☕ Coffee + collagen      │   │
│  │        45 kcal · 11g P          │   │
│  │ 09:10  🥥 BUILT Puff             │   │
│  │        140 kcal · 17g P         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [ What did you eat? ─────────  →  ]   │  ← chat input pinned bottom
└─────────────────────────────────────────┘
```

- **Hero**: today's totals vs goal, single bar (calories) + protein number
- **Today's entries**: time + emoji + food + macros, in chronological order, tap to edit/delete
- **Chat input**: pinned at the bottom (above the tabbar). Sends to Claude on submit.
- **Pending state**: while Claude is thinking, the input shows a spinner and the entry is added optimistically (greyed out) once the tool returns
- **Low-confidence entries**: shown with a small "✏️ confirm" affordance — tap to adjust before saving

**Voice input:** the chat input has a microphone icon that uses the Web Speech API. iOS Safari supports it. Tap-and-hold, dictate, release, send.

**Edit:** tap an entry to open a sheet with editable fields. Save updates the entry; delete removes it.

**Past days:** the calendar above the entry list lets you scroll back. The chat input always logs to *today*; to log a past day, use the editor.

---

## 6. Mobile-friendly redesign

The existing `dashboard.html` is desktop-shaped. For the integrated tab:

| Old layout | New layout |
|---|---|
| Two-column `hero-wrap` (1.1fr 0.9fr) | Single column |
| Wide `cal` strip with 7 day cells | Compact 7-day strip matching the existing fitness-tracker style |
| `app` max-width 920px, padding 36px | Fits the existing 18px padding container |
| Cream paper aesthetic | Adapts to the existing light/dark theme — paper accent only on Nutrition tab cards |
| Foods rendered as horizontal cards | Vertical timeline (one per row, time-stamped) |

The cream/serif aesthetic of the original is great — keep it as the **Nutrition tab's accent color** (analogous to how each tab has its own accent in the fitness tracker). The rest of the app stays its current color system.

---

## 7. Phased plan

Each phase is testable, shippable, and reversible.

### Phase A — Data layer (1 weekend)
- [ ] Add `nutrition: {}` to `store` shape in `core.js`
- [ ] Add `profile: {}` to gist payload (alongside `store`, `meta`, `deadline`)
- [ ] Update `parseGistContent` to handle new fields (and ignore them safely on old clients during the transition)
- [ ] Add `sanitizeStore` test for nutrition entry shape
- [ ] Write `migrateFromCalMacroTrack(logJson, weightHistoryJson)` import function with tests
- [ ] One-time UI: Settings → "Import from cal-macro-track" file picker
- [ ] Run import on your data; verify gist contains nutrition history

### Phase B — Nutrition tab UI (no AI yet) (1 weekend)
- [ ] Add `Nutrition` to tab bar (between Lifting and Weight)
- [ ] Hero with live totals (calories + protein + carbs + fat) vs goals
- [ ] Today's timeline of entries with time + emoji + food + macros
- [ ] Tap-to-edit sheet with editable fields
- [ ] Calendar to scroll past days (matches existing fitness-tracker calendar)
- [ ] No chat yet — entries can only be added via edit sheet
- [ ] Update Today tab to show today's calorie ring + protein progress

### Phase C — Claude wrapper, manual model picker (1 weekend)
- [ ] Settings: "Anthropic API key" input (paste, store in localStorage like GitHub PAT)
- [ ] Settings: model picker (default Haiku 4.5, options Sonnet 4.6 / Opus 4.7)
- [ ] Chat input pinned to bottom of Nutrition tab
- [ ] On submit: call `client.messages.create()` with `tool_choice: {type: "tool", name: "log_food"}`, append entries to today
- [ ] Optimistic rendering with greyed-out pending state
- [ ] Error handling: 401 → "Check your API key", 429 → "Slow down", 500/529 → "Anthropic service issue, try again"
- [ ] Prompt caching enabled on system + tools

### Phase D — Polish (1 weekend)
- [ ] Voice input (Web Speech API)
- [ ] Low-confidence entries get a "✏️ confirm" pill
- [ ] Daily summary card on Today tab: "1650 / 1650 kcal · 130g P (goal hit)"
- [ ] Edit history (each entry shows its `raw_input` on long-press for audit)
- [ ] Suggested portions: when typing, last week's same-name food autosuggests its portion + macros
- [ ] Profile editor sheet (edit weight goals, calorie target, protein target inline)

### Phase E — Long-term niceties (later)
- [ ] Recipe memory: "I had my standard breakfast" pulls from named saved combos
- [ ] Weekly nutrition review on Sundays (combined with existing weekly summary)
- [ ] Export entries to CSV
- [ ] Photo input: take a picture of food, vision model extracts entry (needs Sonnet/Opus)

---

## 8. Cost estimate (browser-direct, Haiku 4.5)

Assumptions: 5 meals logged per day, average 80 input tokens per meal (system + tool cached after request 1; each meal request is ~50 user-input tokens + ~30 tool-output tokens).

| Period | Cached tokens (read) | Uncached tokens | Output tokens | Est. cost |
|---|---|---|---|---|
| Day | ~6,000 | ~50 | ~150 | $0.001 |
| Month | ~180,000 | ~1,500 | ~4,500 | $0.04 |
| Year | ~2,200,000 | ~18,000 | ~55,000 | $0.50 |

If you upgrade to Sonnet 4.6 for harder cases: ~3× the above (still <$2/year for personal use).

For comparison, the cost of Claude editing your `log.json` directly today (the current Claude-as-scribe pattern) is roughly **100× higher** because the conversation has to keep loading the whole repo into context.

---

## 9. Migration of existing nutrition data

Two paths from the current cal-macro-track to the integrated app:

1. **Cold cutover (recommended)** — Import history → switch — then the standalone app becomes archive. One day of overlap.
2. **Parallel run** — Both apps sync the same gist. Risky because schemas can drift; not worth the complexity.

**Recommended cutover:**
1. Phase A ships, you import the history (one-time upload of `log.json`)
2. Phases B + C ship, you start logging via the new app
3. After two weeks of confidence, archive `cal-macro-track` repo (don't delete — keep as historical record)

---

## 10. Open questions

1. **Voice input priority:** is dictation important enough to prioritize in Phase D, or can it wait? (My take: it's the killer feature — bumping it earlier might be worth it.)
2. **Photo input:** would you actually use it, or would it be a feature that ships and never gets used? (My take: skip until you ask for it.)
3. **Profile editor:** can the goals stay hardcoded in code (1650 kcal, 130g protein), or do you want them editable in-app from day one? (Affects Phase B vs Phase D.)
4. **Model default:** start with Haiku 4.5 (cheap, fast, sufficient for structured extraction), or default to Sonnet 4.6 for safety? (My take: Haiku — you can always upgrade in settings if quality issues appear.)
5. **`cal-macro-track` archive plan:** keep the repo around as a historical archive after cutover, or fully retire it? (My take: keep it. Costs nothing and the README + data files are nice provenance.)
6. **Nutrition-aware Today tab:** should the Today tab show *today's* protein progress (similar to the Z2 ring), or only the dedicated Nutrition tab? (My take: yes, add a protein ring to Today — it's the metric that drives behavior.)

---

## Summary

- **One app**, six tabs, one gist, one PWA install. (Option C above.)
- **Browser-direct Claude API** with the user's own API key in localStorage. Same threat model as the GitHub PAT.
- **Tool-use structured extraction** with `claude-haiku-4-5` as the default model. ~$0.50/year for personal use.
- **Five-phase rollout** (A–E), each phase shippable on its own with tests.
- **Data migration is one-time** — import the existing `log.json` once, then retire the standalone app.

Picking up from this doc, the next concrete step is **Phase A** — extending `core.js` and the gist schema to hold nutrition data without yet shipping any UI for it. Tested, mergeable, and lays the foundation for everything else.

Tell me which of the §10 open questions to lock in and we'll start Phase A.
