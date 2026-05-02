// Edge-case coverage. Anything here failing is a real user-visible regression.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

// ============================================================
// decideTapAction. The live bug surface for tap routing.
// ============================================================

test('decideTapAction: cardio empty + today = mark-empty', () => {
  assert.equal(T.decideTapAction('cardio', '2026-05-02', '2026-05-02', false), 'mark-empty');
});

test('decideTapAction: cardio empty + past day = open-editor', () => {
  assert.equal(T.decideTapAction('cardio', '2026-05-01', '2026-05-02', false), 'open-editor');
});

test('decideTapAction: cardio existing entry always opens editor', () => {
  assert.equal(T.decideTapAction('cardio', '2026-05-02', '2026-05-02', true), 'open-editor');
  assert.equal(T.decideTapAction('cardio', '2026-05-01', '2026-05-02', true), 'open-editor');
});

test('decideTapAction: intervals follows same routing as cardio', () => {
  assert.equal(T.decideTapAction('intervals', '2026-05-02', '2026-05-02', false), 'mark-empty');
  assert.equal(T.decideTapAction('intervals', '2026-05-02', '2026-05-02', true), 'open-editor');
  assert.equal(T.decideTapAction('intervals', '2026-05-01', '2026-05-02', false), 'open-editor');
});

test('decideTapAction: weight always opens editor (no quick-mark)', () => {
  assert.equal(T.decideTapAction('weight', '2026-05-02', '2026-05-02', false), 'open-editor');
  assert.equal(T.decideTapAction('weight', '2026-05-02', '2026-05-02', true), 'open-editor');
});

test('decideTapAction: lifting always opens editor (multi-select)', () => {
  assert.equal(T.decideTapAction('lifting', '2026-05-02', '2026-05-02', false), 'open-editor');
  assert.equal(T.decideTapAction('lifting', '2026-05-02', '2026-05-02', true), 'open-editor');
});

test('decideTapAction: nutrition opens editor', () => {
  assert.equal(T.decideTapAction('nutrition', '2026-05-02', '2026-05-02', false), 'open-editor');
});

// ============================================================
// fmtKey. Local-time correctness across DST and year boundaries.
// ============================================================

test('fmtKey: pads single-digit month/day', () => {
  assert.equal(T.fmtKey(new Date(2026, 0, 1)), '2026-01-01');
  assert.equal(T.fmtKey(new Date(2026, 8, 9)), '2026-09-09');
});

test('fmtKey: handles year boundary correctly', () => {
  assert.equal(T.fmtKey(new Date(2025, 11, 31)), '2025-12-31');
  assert.equal(T.fmtKey(new Date(2026, 0, 1)), '2026-01-01');
});

test('fmtKey: midnight local does not bleed into prior day', () => {
  // A date constructed at exactly local midnight should serialize to that day,
  // not the previous one (the bug a UTC-based serializer would have).
  const d = new Date(2026, 4, 2);
  d.setHours(0, 0, 0, 0);
  assert.equal(T.fmtKey(d), '2026-05-02');
});

test('fmtKey: late-night does not bleed into next day', () => {
  const d = new Date(2026, 4, 2, 23, 59, 59);
  assert.equal(T.fmtKey(d), '2026-05-02');
});

test('fmtKey: DST forward transition (US: 2nd Sunday of March)', () => {
  // 2026-03-08 is the US DST forward day. The Date object handles this; we just
  // verify our local-time fmtKey doesn't return the day before.
  const d = new Date(2026, 2, 8, 12, 0, 0); // noon avoids the DST hour gap
  assert.equal(T.fmtKey(d), '2026-03-08');
});

test('fmtKey: DST backward transition', () => {
  const d = new Date(2026, 10, 1, 12, 0, 0); // noon, after fall-back
  assert.equal(T.fmtKey(d), '2026-11-01');
});

// ============================================================
// nextSaturday. Calendar arithmetic.
// ============================================================

test('nextSaturday: from each day of the week', () => {
  // 2026-05-03 = Sun, 2026-05-04 = Mon, ... 2026-05-09 = Sat
  for (let day = 3; day <= 9; day++) {
    const d = new Date(2026, 4, day);
    assert.equal(T.fmtKey(T.nextSaturday(d)), '2026-05-09', `day ${day}`);
  }
});

test('nextSaturday: across month boundary', () => {
  // 2026-04-29 (Wed) → 2026-05-02 (Sat)
  const wed = new Date(2026, 3, 29);
  assert.equal(T.fmtKey(T.nextSaturday(wed)), '2026-05-02');
});

test('nextSaturday: across year boundary', () => {
  // 2025-12-30 (Tue) → 2026-01-03 (Sat)
  const tue = new Date(2025, 11, 30);
  assert.equal(T.fmtKey(T.nextSaturday(tue)), '2026-01-03');
});

// ============================================================
// weeklyWeightGoal. Plan trajectory edges.
// ============================================================

test('weeklyWeightGoal: exact target reached on the last scheduled Sat', () => {
  // 156 → 140 over 16 weeks, starting 2026-05-09.
  const start = new Date(2026, 4, 9);
  const targetSat = new Date(2026, 7, 29); // 16 weeks later: 2026-08-29
  assert.equal(T.weeklyWeightGoal(targetSat, start, 156, 140), 140);
});

test('weeklyWeightGoal: weeks past the end clamp to target', () => {
  const start = new Date(2026, 4, 9);
  assert.equal(T.weeklyWeightGoal(new Date(2027, 0, 1), start, 156, 140), 140);
  assert.equal(T.weeklyWeightGoal(new Date(2030, 0, 1), start, 156, 140), 140);
});

test('weeklyWeightGoal: zero-step plan returns startWeight forever', () => {
  const start = new Date(2026, 4, 9);
  assert.equal(T.weeklyWeightGoal(start, start, 156, 140, 0), 156);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 5, 6), start, 156, 140, 0), 156);
});

test('weeklyWeightGoal: 2lb/week step', () => {
  const start = new Date(2026, 4, 9);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 9), start, 156, 140, 2), 156);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 16), start, 156, 140, 2), 154);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 23), start, 156, 140, 2), 152);
});

test('weeklyWeightGoal: returns null before plan start (off by one)', () => {
  const start = new Date(2026, 4, 9);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 8), start, 156, 140), null);
  // The exact start-Sat should NOT return null.
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 9), start, 156, 140), 156);
});

test('weeklyWeightGoal: mid-week dates use the prior Saturday\'s goal', () => {
  // A Tuesday between 5/9 and 5/16 still snaps to the 5/9 goal of 156.
  const start = new Date(2026, 4, 9);
  const tue = new Date(2026, 4, 12);
  assert.equal(T.weeklyWeightGoal(tue, start, 156, 140), 156);
});

// ============================================================
// weightGoalSchedule. Plan generation.
// ============================================================

test('weightGoalSchedule: hard cap of 520 weeks (~10 years) prevents runaway', () => {
  // start 200, target 100, step 0 would loop forever without the cap.
  const start = new Date(2026, 0, 1);
  const schedule = T.weightGoalSchedule(start, 200, 100, 0);
  assert.ok(schedule.length <= 520, 'must terminate at the safety cap');
});

test('weightGoalSchedule: single checkpoint when start == target', () => {
  const start = new Date(2026, 4, 9);
  const schedule = T.weightGoalSchedule(start, 140, 140);
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].weight, 140);
});

test('weightGoalSchedule: dates are exactly 7 days apart', () => {
  const start = new Date(2026, 4, 9);
  const schedule = T.weightGoalSchedule(start, 156, 140);
  for (let i = 1; i < schedule.length; i++) {
    const days = (schedule[i].date - schedule[i - 1].date) / 86400000;
    assert.equal(days, 7, `gap ${i}: ${days} days`);
  }
});

// ============================================================
// weightAvg. Macro for weight chart input.
// ============================================================

test('weightAvg: ignores zero entries (treats 0 as a real number, not missing)', () => {
  // Edge: a true zero is a real measurement (impossible in practice, but tested).
  assert.equal(T.weightAvg({ am: 0, pm: 0 }), 0);
});

test('weightAvg: NaN protection', () => {
  // If somehow am/pm got corrupted to a non-number, weightAvg should not crash.
  assert.equal(T.weightAvg({ am: 'abc', pm: null }), null);
  assert.equal(T.weightAvg({ am: undefined, pm: 'xyz' }), null);
});

test('weightAvg: numeric strings are NOT silently converted', () => {
  // Defends against accidental "157.0" string entering the data.
  assert.equal(T.weightAvg({ am: '157', pm: null }), null);
});

// ============================================================
// weightSeries. Chart input pipeline.
// ============================================================

test('weightSeries: returns sorted-by-date order regardless of insertion', () => {
  const series = T.weightSeries({
    '2026-05-03': { am: null, pm: 156 },
    '2026-05-01': { am: null, pm: 158 },
    '2026-05-02': { am: 157, pm: 157 },
  });
  assert.equal(series.length, 3);
  assert.equal(T.fmtKey(series[0].date), '2026-05-01');
  assert.equal(T.fmtKey(series[1].date), '2026-05-02');
  assert.equal(T.fmtKey(series[2].date), '2026-05-03');
});

test('weightSeries: single entry', () => {
  const series = T.weightSeries({ '2026-05-01': { am: null, pm: 157 } });
  assert.equal(series.length, 1);
  assert.equal(series[0].weight, 157);
});

test('weightSeries: empty input', () => {
  assert.deepEqual(T.weightSeries({}), []);
  assert.deepEqual(T.weightSeries(null), []);
});

// ============================================================
// countSessions. The 6-vs-10 bug regression test.
// ============================================================

test('countSessions: weight tab map (different shape) still counts entries', () => {
  // Even though weight entries have {am, pm} not {mins}, countSessions cares
  // only about valid date keys.
  const map = {
    '2026-05-01': { am: 156, pm: 157 },
    '2026-05-02': { am: 155, pm: 156 },
    'cardio': {}, // phantom
  };
  assert.equal(T.countSessions(map), 2);
});

test('countSessions: ignores nutrition-shaped entries-array values', () => {
  // Nutrition entries are { entries: [...] }. countSessions doesn't unwrap, but
  // it also doesn't false-positive on phantom keys.
  const map = {
    '2026-05-01': { entries: [{ food: 'eggs' }] },
    '2026-05-02': { entries: [] },
    'profile': { age: 22 }, // phantom (would never happen but tests robustness)
  };
  assert.equal(T.countSessions(map), 2);
});

// ============================================================
// dayHasContent. Per-tab semantics.
// ============================================================

test('dayHasContent: weight with am=0 still counts (0 is a real value)', () => {
  // Edge case: if someone literally weighed in at 0 lb (lol), it should still count.
  assert.equal(T.dayHasContent('weight', { am: 0, pm: null }), true);
});

test('dayHasContent: weight rejects am as string', () => {
  assert.equal(T.dayHasContent('weight', { am: '157', pm: null }), false);
});

test('dayHasContent: lifting requires non-empty tags array', () => {
  assert.equal(T.dayHasContent('lifting', { tags: ['upper'] }), true);
  assert.equal(T.dayHasContent('lifting', { tags: [] }), false);
  assert.equal(T.dayHasContent('lifting', { tags: null }), false);
  assert.equal(T.dayHasContent('lifting', {}), false);
});

// ============================================================
// currentStreak. Long-streak boundary.
// ============================================================

test('currentStreak: works at the 730-day safety cap (long streak)', () => {
  // Build a 730-day chain.
  const today = new Date(2027, 4, 1);
  const map = {};
  for (let i = 0; i < 730; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    map[T.fmtKey(d)] = { mins: 50 };
  }
  const s = T.currentStreak('cardio', map, today);
  assert.ok(s.length >= 700, `should count most of the chain, got ${s.length}`);
  assert.ok(s.length <= 730, 'must respect the 730-day cap');
});

test('currentStreak: shieldsPerWeek=0 behaves identically to no shields', () => {
  const today = new Date(2026, 4, 1);
  const map = {
    '2026-04-29': { mins: 50 },
    '2026-04-30': { mins: 50 },
    '2026-05-01': { mins: 50 },
  };
  const a = T.currentStreak('cardio', map, today);
  const b = T.currentStreak('cardio', map, today, { shieldsPerWeek: 0 });
  assert.deepEqual(a, b);
});

// ============================================================
// trendDelta. Symmetric edges.
// ============================================================

test('trendDelta: zero data both windows', () => {
  const today = new Date(2026, 4, 1);
  const t = T.trendDelta('cardio', {}, today);
  assert.deepEqual(t, { current: 0, previous: 0, delta: 0 });
});

test('trendDelta: same value both windows = zero delta', () => {
  const today = new Date(2026, 4, 1);
  const map = {
    '2026-04-26': { mins: 50 }, // current week
    '2026-04-19': { mins: 50 }, // prior week
  };
  const t = T.trendDelta('cardio', map, today);
  assert.equal(t.delta, 0);
});

// ============================================================
// sparklineSeries. Bounds and normalization.
// ============================================================

test('sparklineSeries: window of 1 day returns single value', () => {
  const today = new Date(2026, 4, 1);
  const s = T.sparklineSeries('cardio', { '2026-05-01': { mins: 50 } }, today, { days: 1 });
  assert.equal(s.values.length, 1);
  assert.equal(s.values[0], 1);
});

test('sparklineSeries: defaults to 14 days when days unspecified', () => {
  const today = new Date(2026, 4, 1);
  const s = T.sparklineSeries('cardio', {}, today);
  assert.equal(s.values.length, 14);
});

test('sparklineSeries: all-zero values produce min=max=0', () => {
  const today = new Date(2026, 4, 1);
  const s = T.sparklineSeries('cardio', {}, today, { days: 7 });
  assert.equal(s.min, 0);
  assert.equal(s.max, 0);
});

// ============================================================
// parseGistContent. Adversarial inputs.
// ============================================================

test('parseGistContent: date-keyed map with 1 entry must parse as v1 cardio', () => {
  const r = T.parseGistContent(JSON.stringify({ '2026-05-01': { mins: 50 } }));
  assert.equal(T.countSessions(r.store.cardio), 1);
});

test('parseGistContent: object with a mix of date keys and tab keys gets sanitized', () => {
  // If the gist content somehow has both phantom tab keys AND real date keys,
  // it should still extract the real date entries.
  const r = T.parseGistContent(JSON.stringify({
    '2026-05-01': { mins: 50 },
    '2026-05-02': { mins: 50 },
    cardio: {}, // phantom that previously caused the 6-vs-10 bug
  }));
  assert.equal(T.countSessions(r.store.cardio), 2);
});

test('parseGistContent: store with missing tab keys backfills empty objects', () => {
  const r = T.parseGistContent(JSON.stringify({
    store: { cardio: { '2026-05-01': { mins: 50 } } /* no other tabs */ },
    meta: {},
  }));
  assert.deepEqual(Object.keys(r.store).sort(), ['cardio', 'intervals', 'lifting', 'nutrition', 'weight']);
});

test('parseGistContent: very large payload (1000 entries) processes without throwing', () => {
  const big = {};
  for (let i = 0; i < 1000; i++) {
    const d = new Date(2024, 0, 1 + i);
    big[T.fmtKey(d)] = { mins: 50 };
  }
  const r = T.parseGistContent(JSON.stringify({
    store: { cardio: big, weight: {}, lifting: {}, intervals: {} },
    meta: { cardio: {}, weight: {}, lifting: {}, intervals: {} },
  }));
  assert.equal(T.countSessions(r.store.cardio), 1000);
});

// ============================================================
// sanitize idempotence. Sanitizing twice == sanitizing once.
// ============================================================

test('sanitizeStore is idempotent', () => {
  const dirty = {
    cardio: { '2026-05-01': { mins: 50 }, cardio: {}, weight: {} },
    weight: {}, lifting: {}, intervals: {},
  };
  const once = T.sanitizeStore(dirty);
  const twice = T.sanitizeStore(once);
  assert.deepEqual(once, twice);
});

test('sanitizeMeta is idempotent', () => {
  const dirty = {
    cardio: { '2026-05-01': 1, foo: 9 },
    weight: {}, lifting: {}, intervals: {},
  };
  const once = T.sanitizeMeta(dirty);
  const twice = T.sanitizeMeta(once);
  assert.deepEqual(once, twice);
});

// ============================================================
// TABS array stability. Catches accidental tab additions.
// ============================================================

test('TABS includes the 5 expected tabs', () => {
  const expected = ['cardio', 'weight', 'lifting', 'intervals', 'nutrition'];
  assert.deepEqual([...T.TABS].sort(), [...expected].sort());
});

// ============================================================
// Nutrition day data + helpers.
// ============================================================

test('dayHasContent: nutrition empty entries array does not count', () => {
  assert.equal(T.dayHasContent('nutrition', { entries: [] }), false);
  assert.equal(T.dayHasContent('nutrition', {}), false);
  assert.equal(T.dayHasContent('nutrition', { entries: null }), false);
  assert.equal(T.dayHasContent('nutrition', undefined), false);
});

test('dayHasContent: nutrition with one entry counts', () => {
  const entry = { entries: [{ food: 'eggs', macros: { calories: 140, protein_g: 12 } }] };
  assert.equal(T.dayHasContent('nutrition', entry), true);
});

test('nutritionDayTotals: sums macros across multiple entries', () => {
  const day = {
    entries: [
      { food: 'eggs',   macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 } },
      { food: 'toast',  macros: { calories: 90,  protein_g: 4,  carbs_g: 18, fat_g: 1.5 } },
      { food: 'coffee', macros: { calories: 5,   protein_g: 0,  carbs_g: 0,  fat_g: 0 } },
    ],
  };
  const t = T.nutritionDayTotals(day);
  assert.equal(t.calories, 235);
  assert.equal(t.protein_g, 16);
  assert.equal(t.carbs_g, 19);
  assert.equal(t.fat_g, 11.5);
});

test('nutritionDayTotals: zeros for empty / missing inputs', () => {
  assert.deepEqual(T.nutritionDayTotals({ entries: [] }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  assert.deepEqual(T.nutritionDayTotals(undefined), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  assert.deepEqual(T.nutritionDayTotals(null), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
});

test('nutritionDayTotals: skips entries with missing macros block', () => {
  const day = {
    entries: [
      { food: 'eggs', macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 } },
      { food: 'mystery food' /* no macros */ },
      { food: 'broken', macros: null },
    ],
  };
  const t = T.nutritionDayTotals(day);
  assert.equal(t.calories, 140);
  assert.equal(t.protein_g, 12);
});

test('nutritionDayTotals: skips non-numeric macros', () => {
  const day = {
    entries: [
      { food: 'sketchy', macros: { calories: '500', protein_g: 30, carbs_g: 10, fat_g: 5 } },
    ],
  };
  const t = T.nutritionDayTotals(day);
  assert.equal(t.calories, 0); // string not coerced
  assert.equal(t.protein_g, 30);
});

test('newNutritionEntryId: shape is n_<date>_<random>', () => {
  const id = T.newNutritionEntryId('2026-05-02');
  assert.match(id, /^n_2026-05-02_[a-z0-9]{6}$/);
});

test('newNutritionEntryId: two consecutive calls produce different ids', () => {
  const a = T.newNutritionEntryId('2026-05-02');
  const b = T.newNutritionEntryId('2026-05-02');
  assert.notEqual(a, b);
});

// ============================================================
// logicalToday: 2 AM day cutoff for late-night logging.
// ============================================================

test('logicalToday: at 1 AM, today is yesterday', () => {
  const at1am = new Date(2026, 4, 2, 1, 30, 0);
  const result = T.logicalToday(at1am, 2);
  assert.equal(T.fmtKey(result), '2026-05-01', '1 AM Saturday should still log to Friday');
});

test('logicalToday: at 1:59 AM, today is still yesterday', () => {
  const at = new Date(2026, 4, 2, 1, 59, 59);
  const result = T.logicalToday(at, 2);
  assert.equal(T.fmtKey(result), '2026-05-01');
});

test('logicalToday: at 2:00 AM exactly, today flips', () => {
  const at2am = new Date(2026, 4, 2, 2, 0, 0);
  const result = T.logicalToday(at2am, 2);
  assert.equal(T.fmtKey(result), '2026-05-02', 'cutoff is exclusive at 2 AM');
});

test('logicalToday: noon is always today regardless of cutoff', () => {
  const noon = new Date(2026, 4, 2, 12, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(noon, 2)), '2026-05-02');
  assert.equal(T.fmtKey(T.logicalToday(noon, 4)), '2026-05-02');
});

test('logicalToday: 11 PM is today (well before any reasonable cutoff)', () => {
  const at = new Date(2026, 4, 2, 23, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(at, 2)), '2026-05-02');
});

test('logicalToday: cutoff=0 (no shift) returns calendar date as-is', () => {
  const at1am = new Date(2026, 4, 2, 1, 30, 0);
  assert.equal(T.fmtKey(T.logicalToday(at1am, 0)), '2026-05-02');
});

test('logicalToday: cutoff=4 (4 AM) keeps anything before 4 AM as yesterday', () => {
  const at3am = new Date(2026, 4, 2, 3, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(at3am, 4)), '2026-05-01');
  const at4am = new Date(2026, 4, 2, 4, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(at4am, 4)), '2026-05-02');
});

test('logicalToday: cutoff handles month boundary correctly', () => {
  // 2026-05-01 at 1 AM should yield 2026-04-30.
  const at1am = new Date(2026, 4, 1, 1, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(at1am, 2)), '2026-04-30');
});

test('logicalToday: cutoff handles year boundary correctly', () => {
  // 2026-01-01 at 1 AM should yield 2025-12-31.
  const at1am = new Date(2026, 0, 1, 1, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(at1am, 2)), '2025-12-31');
});

test('logicalToday: returns a Date at local midnight', () => {
  const at1am = new Date(2026, 4, 2, 1, 30, 45);
  const result = T.logicalToday(at1am, 2);
  assert.equal(result.getHours(), 0);
  assert.equal(result.getMinutes(), 0);
  assert.equal(result.getSeconds(), 0);
});

// ============================================================
// Initial-state regression: sanitizeStore must produce every tab in TABS,
// no matter what shape the input is. This is the bug that broke the
// Nutrition button in production: the live init code declared an explicit
// 4-tab object as default and missed the 5th when sanitizeStore wasn't run.
// ============================================================

test('sanitizeStore(null) covers every tab in TABS', () => {
  const out = T.sanitizeStore(null);
  for (const tab of T.TABS) {
    assert.ok(tab in out, `missing tab: ${tab}`);
    assert.deepEqual(out[tab], {}, `${tab} should default to {}`);
  }
});

test('sanitizeMeta(null) covers every tab in TABS', () => {
  const out = T.sanitizeMeta(null);
  for (const tab of T.TABS) {
    assert.ok(tab in out, `missing tab: ${tab}`);
    assert.deepEqual(out[tab], {}, `${tab} should default to {}`);
  }
});

test('sanitizeStore: any single-tab input fills all other tabs as {}', () => {
  for (const onlyTab of T.TABS) {
    const input = { [onlyTab]: { '2026-05-01': { mins: 50 } } };
    const out = T.sanitizeStore(input);
    for (const t of T.TABS) {
      assert.ok(t in out, `missing tab: ${t} when input had only ${onlyTab}`);
    }
    assert.equal(Object.keys(out[onlyTab]).length, 1, 'preserves the original tab');
  }
});

test('sanitizeStore: legacy 4-tab input still produces 5-tab output', () => {
  // Critical pre-nutrition shape, exactly what an existing user's localStorage
  // looks like before the tab was added. New tabs must materialize as {}.
  const legacy = {
    cardio: { '2026-05-01': { mins: 50 } },
    weight: { '2026-05-01': { am: null, pm: 156 } },
    lifting: { '2026-05-01': { tags: ['upper'] } },
    intervals: {},
  };
  const out = T.sanitizeStore(legacy);
  assert.ok('nutrition' in out, 'nutrition must materialize on the new client');
  assert.deepEqual(out.nutrition, {});
  // Existing data must not be lost.
  assert.equal(Object.keys(out.cardio).length, 1);
});

test('sanitizeMeta: legacy 4-tab meta still produces 5-tab output', () => {
  const legacy = {
    cardio: { '2026-05-01': 12345 },
    weight: { '2026-05-01': 67890 },
    lifting: {}, intervals: {},
  };
  const out = T.sanitizeMeta(legacy);
  assert.ok('nutrition' in out);
  assert.deepEqual(out.nutrition, {});
});

test('sanitizeStore: every TABS subset produces a full 5-tab object', () => {
  // 2^5 = 32 subsets. Test all of them.
  for (let mask = 0; mask < (1 << T.TABS.length); mask++) {
    const input = {};
    for (let i = 0; i < T.TABS.length; i++) {
      if (mask & (1 << i)) input[T.TABS[i]] = {};
    }
    const out = T.sanitizeStore(input);
    for (const tab of T.TABS) {
      assert.ok(tab in out, `missing ${tab} from subset mask ${mask.toString(2).padStart(5,'0')}`);
    }
  }
});

test('sanitizeStore: refuses to leak phantom tab keys nested in tab maps', () => {
  // The phantom-key bug from the original gist must never reappear.
  const corrupted = {
    cardio: {
      '2026-05-01': { mins: 50 },
      cardio: {}, weight: {}, lifting: {}, intervals: {}, nutrition: {},
    },
    weight: {}, lifting: {}, intervals: {}, nutrition: {},
  };
  const out = T.sanitizeStore(corrupted);
  assert.deepEqual(Object.keys(out.cardio).sort(), ['2026-05-01']);
});

test('parseGistContent: a v3 payload with no nutrition key survives', () => {
  // Old gists won't have store.nutrition. Parser must still yield a complete
  // shape so the live app doesn't crash on access.
  const r = T.parseGistContent(JSON.stringify({
    store: {
      cardio: { '2026-05-01': { mins: 50 } },
      weight: {}, lifting: {}, intervals: {},
      // no nutrition
    },
    meta: {
      cardio: { '2026-05-01': 1 },
      weight: {}, lifting: {}, intervals: {},
      // no nutrition
    },
    deadline: '2026-12-01',
  }));
  assert.ok('nutrition' in r.store);
  assert.deepEqual(r.store.nutrition, {});
  assert.ok('nutrition' in r.meta);
  assert.deepEqual(r.meta.nutrition, {});
});

test('countSessions on every TABS map yields a number, never throws', () => {
  // Defensive: every tab's empty initial value must be safely countable.
  const empty = T.sanitizeStore(null);
  for (const tab of T.TABS) {
    const n = T.countSessions(empty[tab]);
    assert.equal(typeof n, 'number');
    assert.equal(n, 0);
  }
});

test('dayHasContent on every TABS empty entry returns false safely', () => {
  for (const tab of T.TABS) {
    assert.equal(T.dayHasContent(tab, undefined), false, `${tab} undefined`);
    assert.equal(T.dayHasContent(tab, {}), false || tab === 'cardio' || tab === 'intervals',
      `${tab} empty object`);
  }
});
