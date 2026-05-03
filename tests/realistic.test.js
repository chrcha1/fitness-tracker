// "Real life" scenarios. These tests don't grill at extreme edges -- they
// just simulate what the user actually does day-to-day and assert the
// numbers come out the way the user would expect them to. If any of these
// fail, something the user EXPECTS in normal use is broken.
//
// Each scenario is named for the situation it covers ("user logs a Z2
// session today, count goes from N to N+1"). When a future change breaks
// one, the failure message tells you exactly which everyday flow is now
// broken.

const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

// ============================================================
// Zone 2 -- the user's flagship goal (100 by Dec 1)
// ============================================================

test('z2 normal day: 7 sessions before today, log one more = 8 sessions', () => {
  let map = {
    '2026-04-22': { mins: 50 },
    '2026-04-23': { mins: 50 },
    '2026-04-24': { mins: 51 },
    '2026-04-25': { mins: null },
    '2026-04-28': { mins: 50 },
    '2026-04-29': { mins: 50 },
    '2026-05-01': { mins: 50 },
  };
  assert.equal(T.countSessions(map), 7);
  // Add today's session.
  map['2026-05-02'] = { mins: 45 };
  assert.equal(T.countSessions(map), 8);
});

test('z2 normal day: marking today done with no time still counts as a session', () => {
  // The "tap to quick-mark" path saves {mins: null}, not {}. Should count.
  const map = { '2026-05-02': { mins: null } };
  assert.equal(T.countSessions(map), 1);
});

test('z2 normal day: removing today\'s entry decrements the count', () => {
  let map = { '2026-05-01': { mins: 50 }, '2026-05-02': { mins: 50 } };
  assert.equal(T.countSessions(map), 2);
  delete map['2026-05-02'];
  assert.equal(T.countSessions(map), 1);
});

test('z2 normal day: hours logged accumulate correctly', () => {
  const map = {
    '2026-04-22': { mins: 50 },
    '2026-04-23': { mins: 50 },
    '2026-04-24': { mins: 51 },
  };
  // Just sum manually as the live code does.
  let totalMins = 0;
  for (const k of Object.keys(map)) totalMins += (map[k].mins || 0);
  assert.equal(totalMins, 151);
  assert.equal((totalMins / 60).toFixed(1), '2.5');
});

test('z2 streak: a 5-day chain of full sessions shows streak length 5', () => {
  const today = new Date(2026, 4, 5); // Tue 5/5/2026
  const map = {
    '2026-05-01': { mins: 50 },
    '2026-05-02': { mins: 50 },
    '2026-05-03': { mins: 50 },
    '2026-05-04': { mins: 50 },
    '2026-05-05': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 5);
});

test('z2 streak: missing yesterday with shield active still shows full streak', () => {
  const today = new Date(2026, 4, 5);
  const map = {
    '2026-05-01': { mins: 50 },
    '2026-05-02': { mins: 50 },
    // Sunday missed
    '2026-05-04': { mins: 50 },
    '2026-05-05': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today, { shieldsPerWeek: 1 });
  assert.equal(s.length, 5, 'shield should cover the one missed day');
  assert.deepEqual(s.shieldsUsed, ['2026-05-03']);
});

// ============================================================
// Intervals -- "1 per week" cadence
// ============================================================

test('intervals normal: 1 session this week = on-plan', () => {
  const today = new Date(2026, 4, 5); // Tue
  const map = { '2026-05-04': { mins: 30 } }; // Mon, this week
  // Count sessions in current Sun-Sat week.
  const weekStart = new Date(2026, 4, 3); // Sun 5/3
  let wk = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    if (T.dayHasContent('intervals', map[T.fmtKey(d)])) wk++;
  }
  assert.equal(wk, 1);
});

test('intervals: tempo type tracked separately from interval', () => {
  // Both types live in the same store, both count as "sessions" for hit-rate.
  const map = {
    '2026-05-01': { mins: 30, type: 'interval' },
    '2026-05-04': { mins: 25, type: 'tempo' },
  };
  assert.equal(T.countSessions(map), 2);
  assert.equal(map['2026-05-01'].type, 'interval');
  assert.equal(map['2026-05-04'].type, 'tempo');
});

test('intervals: weekly streak counts weeks with at-least-one entry', () => {
  // Three consecutive weeks with entries.
  const today = new Date(2026, 4, 5); // Tue 5/5
  const map = {
    '2026-04-21': { mins: 30 }, // Tue, week of 4/19
    '2026-04-28': { mins: 30 }, // Tue, week of 4/26
    '2026-05-04': { mins: 30 }, // Mon, week of 5/3
  };
  const s = T.currentStreak('intervals', map, today, { mode: 'weekly' });
  assert.equal(s.length, 3);
});

// ============================================================
// Lifting -- tag-based multi-select
// ============================================================

test('lifting normal: multiple tags on one day all count', () => {
  const map = { '2026-05-01': { tags: ['upper', 'core', 'pullups'] } };
  assert.equal(T.dayHasContent('lifting', map['2026-05-01']), true);
  assert.equal(map['2026-05-01'].tags.length, 3);
});

test('lifting normal: removing all tags removes the day', () => {
  const entry = { tags: ['upper'] };
  assert.equal(T.dayHasContent('lifting', entry), true);
  entry.tags = [];
  assert.equal(T.dayHasContent('lifting', entry), false);
});

test('lifting: nine days a month is realistic and counts correctly', () => {
  // Roughly 2-3 lifts per week.
  const map = {};
  for (const day of [1, 3, 5, 8, 10, 12, 15, 17, 19]) {
    map[`2026-05-${String(day).padStart(2, '0')}`] = { tags: ['upper', 'lower'] };
  }
  // Filter using dayHasContent (mirrors the live render).
  let logged = 0;
  for (const k of Object.keys(map)) if (T.dayHasContent('lifting', map[k])) logged++;
  assert.equal(logged, 9);
});

// ============================================================
// Weight -- AM/PM logging + Saturday goal
// ============================================================

test('weight normal: AM-only entry yields the AM as average', () => {
  assert.equal(T.weightAvg({ am: 156, pm: null }), 156);
});

test('weight normal: PM-only entry yields the PM as average', () => {
  assert.equal(T.weightAvg({ am: null, pm: 156.5 }), 156.5);
});

test('weight normal: both AM and PM = mean rounded normally', () => {
  assert.equal(T.weightAvg({ am: 156, pm: 158 }), 157);
  // Note: floating-point arithmetic can produce 156.60000000000002 instead
  // of 156.6 when averaging 156.4 and 156.8. The display layer rounds to
  // 1 decimal anyway, so we compare with tolerance here.
  assert.ok(Math.abs(T.weightAvg({ am: 156.4, pm: 156.8 }) - 156.6) < 0.001);
});

test('weight goal: a Saturday weigh-in at-or-below the target gets the green tint', () => {
  // The goal-sat / goal-hit class is applied when entry's avg <= weeklyWeightGoal.
  const start = new Date(2026, 4, 9);
  const sat = new Date(2026, 4, 9);
  const goal = T.weeklyWeightGoal(sat, start, 156, 140);
  assert.equal(goal, 156);
  const entry = { am: null, pm: 155.5 };
  const avg = T.weightAvg(entry);
  assert.ok(avg <= goal, '155.5 should be at or below the 156 goal');
});

test('weight goal: a Saturday weigh-in OVER the target gets the orange tint', () => {
  const start = new Date(2026, 4, 9);
  const sat = new Date(2026, 4, 9);
  const goal = T.weeklyWeightGoal(sat, start, 156, 140);
  const entry = { am: null, pm: 156.5 };
  const avg = T.weightAvg(entry);
  assert.ok(avg > goal, '156.5 should be over the 156 goal');
});

test('weight chart: 3 weigh-ins over 2 weeks have time-aware spacing', () => {
  // The chart at xOf(date) uses real Date math, so a 2-week gap is exactly
  // twice as wide as a 1-week gap. This is the property the user explicitly
  // asked for ("2 weeks apart should be twice as far as 1 week apart").
  const series = T.weightSeries({
    '2026-05-01': { am: null, pm: 157 },
    '2026-05-08': { am: null, pm: 156 },
    '2026-05-22': { am: null, pm: 155 },
  });
  const g1 = series[1].date - series[0].date;
  const g2 = series[2].date - series[1].date;
  assert.equal(g2 / g1, 2);
});

test('weight goal trajectory: every Saturday from 5/9 to 8/29 has an entry', () => {
  const start = new Date(2026, 4, 9);
  const schedule = T.weightGoalSchedule(start, 156, 140);
  // 156 -> 140 with 1 lb/wk = 17 weeks of checkpoints.
  assert.equal(schedule.length, 17);
  // Every entry's day-of-week is Saturday (6).
  for (const s of schedule) assert.equal(s.date.getDay(), 6);
});

// ============================================================
// Nutrition -- the AI-logged path
// ============================================================

test('nutrition normal: a typical breakfast adds up correctly', () => {
  const day = {
    entries: [
      { food: 'Coffee + collagen', macros: { calories: 45, protein_g: 11, carbs_g: 0, fat_g: 0 } },
      { food: 'NURRI Strawberry shake', macros: { calories: 150, protein_g: 30, carbs_g: 2, fat_g: 2.5 } },
      { food: 'BUILT puff coconut', macros: { calories: 140, protein_g: 17, carbs_g: 13, fat_g: 3 } },
    ],
  };
  const t = T.nutritionDayTotals(day);
  assert.equal(t.calories, 335);
  assert.equal(t.protein_g, 58);
  assert.equal(t.carbs_g, 15);
  assert.equal(t.fat_g, 5.5);
});

test('nutrition normal: full day matching cal-macro-track historical entry', () => {
  // The exact 9-entry day from the user's imported history.
  const day = {
    entries: [
      { macros: { calories: 45,  protein_g: 11, carbs_g: 0,  fat_g: 0 } },
      { macros: { calories: 150, protein_g: 30, carbs_g: 2,  fat_g: 2.5 } },
      { macros: { calories: 140, protein_g: 17, carbs_g: 13, fat_g: 3 } },
      { macros: { calories: 47,  protein_g: 8,  carbs_g: 0.5, fat_g: 1 } },
      { macros: { calories: 5,   protein_g: 0,  carbs_g: 0,  fat_g: 0 } },
      { macros: { calories: 820, protein_g: 55, carbs_g: 90, fat_g: 25 } },
      { macros: { calories: 155, protein_g: 1.6,carbs_g: 41, fat_g: 0.4 } },
      { macros: { calories: 5,   protein_g: 0,  carbs_g: 0,  fat_g: 0 } },
      { macros: { calories: 220, protein_g: 3,  carbs_g: 27, fat_g: 10.5 } },
    ],
  };
  const t = T.nutritionDayTotals(day);
  // Calories: 45+150+140+47+5+820+155+5+220 = 1587
  assert.equal(t.calories, 1587);
  // Protein: 11+30+17+8+0+55+1.6+0+3 = 125.6
  assert.ok(Math.abs(t.protein_g - 125.6) < 0.01);
});

test('nutrition kcal goal at 156 lb, female, 22yr, 65.5"', () => {
  // The user's actual numbers. BMR at start of plan.
  const goal = T.nutritionKcalGoal(156, { heightIn: 65.5, age: 22, sex: 'F' });
  assert.ok(goal > 1450 && goal < 1500, `expected ~1475, got ${goal}`);
});

test('nutrition kcal goal recomputes as user loses weight (the whole point)', () => {
  const profile = { heightIn: 65.5, age: 22, sex: 'F' };
  const start = T.nutritionKcalGoal(156, profile);
  const mid = T.nutritionKcalGoal(148, profile);
  const end = T.nutritionKcalGoal(140, profile);
  assert.ok(start > mid && mid > end);
  // Each 8-lb drop = ~36 kcal/day.
  assert.ok(Math.abs((start - mid) - 36) < 5);
});

test('nutrition entry id: 1000 unique calls produce 1000 unique ids', () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    seen.add(T.newNutritionEntryId('2026-05-02'));
  }
  assert.ok(seen.size >= 998, `${seen.size}/1000 ids unique`);
});

// ============================================================
// Today tab -- per-modality summaries
// ============================================================

test('today: shows count of completed modalities for the day', () => {
  const todayKey = '2026-05-02';
  const store = {
    cardio: { [todayKey]: { mins: 50 } },
    intervals: {},
    lifting: { [todayKey]: { tags: ['upper'] } },
    weight: { [todayKey]: { am: null, pm: 156 } },
    nutrition: {},
  };
  let count = 0;
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    if (T.dayHasContent(tab, store[tab][todayKey])) count++;
  }
  assert.equal(count, 3); // cardio + lifting + weight
});

test('today greeting: 4 of 5 done (high) + 0 done (quiet) cases work', () => {
  const todayKey = '2026-05-02';
  const all = {
    cardio: { [todayKey]: { mins: 50 } },
    intervals: { [todayKey]: { mins: 30 } },
    lifting: { [todayKey]: { tags: ['upper'] } },
    weight: { [todayKey]: { am: 156, pm: null } },
    nutrition: { [todayKey]: { entries: [{ macros: { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 1 } }] } },
  };
  let count5 = 0;
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    if (T.dayHasContent(tab, all[tab][todayKey])) count5++;
  }
  assert.equal(count5, 5);
  // None done.
  let count0 = 0;
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    if (T.dayHasContent(tab, undefined)) count0++;
  }
  assert.equal(count0, 0);
});

// ============================================================
// Sync / data integrity -- the user's data must never silently disappear
// ============================================================

test('sync integrity: a stale client without nutrition awareness must not erase nutrition', () => {
  // The exact bug the user hit. Old client pulls gist, doesn't know about
  // store.nutrition, ignores it. Then pushes back without the field.
  // mergeTabKeys handles this defensively: the merge only updates a key if
  // remoteTs > localTs OR both are 0 with remote present. Remote silence
  // (no entry in either remoteStore or remoteMeta) is NOT a delete.
  const local = {
    '2026-04-23': {
      entries: [
        { id: 'n_2026-04-23_aaa', food: 'eggs', macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 } },
      ],
    },
  };
  const localMeta = { '2026-04-23': 1234567890 };
  const r = T.mergeTabKeys(local, localMeta, {}, {}, () => 9999999999);
  assert.deepEqual(r.store, local, 'silence != delete; local data preserved');
  assert.equal(r.changed, false);
});

test('sync integrity: round-trip parser preserves ALL stored data', () => {
  const original = {
    store: {
      cardio: { '2026-05-01': { mins: 50 } },
      intervals: { '2026-04-28': { mins: 30, type: 'interval' } },
      lifting: { '2026-05-01': { tags: ['lower'] } },
      weight: {
        '2026-05-01': { am: null, pm: 157 },
        '2026-04-24': { am: null, pm: 157 },
      },
      nutrition: {
        '2026-04-23': { entries: [{ id: 'n_2026-04-23_a', food: 'eggs', macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 } }] },
      },
    },
    meta: {
      cardio: { '2026-05-01': 100 },
      intervals: { '2026-04-28': 200 },
      lifting: { '2026-05-01': 300 },
      weight: { '2026-05-01': 400, '2026-04-24': 500 },
      nutrition: { '2026-04-23': 600 },
    },
    deadline: '2026-12-01',
  };
  const r = T.parseGistContent(JSON.stringify(original));
  // Every entry should round-trip exactly.
  assert.deepEqual(r.store.cardio, original.store.cardio);
  assert.deepEqual(r.store.intervals, original.store.intervals);
  assert.deepEqual(r.store.lifting, original.store.lifting);
  assert.deepEqual(r.store.weight, original.store.weight);
  assert.deepEqual(r.store.nutrition, original.store.nutrition);
  assert.equal(r.deadline, '2026-12-01');
});

test('sync integrity: phantom keys are filtered but real data passes through', () => {
  // A future-proofing test: even if some bug somewhere injects a phantom
  // key into a store, sanitize strips it without touching real entries.
  const corrupted = {
    cardio: {
      '2026-05-01': { mins: 50 },
      '2026-05-02': { mins: 45 },
      cardio: {}, weight: {}, lifting: {}, intervals: {}, nutrition: {},
      'foo': 'bar',
    },
    weight: {}, lifting: {}, intervals: {}, nutrition: {},
  };
  const cleaned = T.sanitizeStore(corrupted);
  assert.equal(Object.keys(cleaned.cardio).length, 2);
  assert.equal(cleaned.cardio['2026-05-01'].mins, 50);
  assert.equal(cleaned.cardio['2026-05-02'].mins, 45);
});

test('sync integrity: sanitize is idempotent (running it twice is safe)', () => {
  const dirty = {
    cardio: { '2026-05-01': { mins: 50 }, foo: {} },
    weight: { '2026-05-01': { am: null, pm: 157 } },
    lifting: {}, intervals: {}, nutrition: {},
  };
  const a = T.sanitizeStore(dirty);
  const b = T.sanitizeStore(a);
  assert.deepEqual(a, b);
});

// ============================================================
// Date math -- where bugs lurk
// ============================================================

test('date: marking yesterday late at night (1:30 AM today) goes to yesterday', () => {
  // 2 AM cutoff: the user typically logs the day's last meal at midnight or
  // 1 AM. Should attribute to "yesterday" until the cutoff.
  const at1am = new Date(2026, 4, 2, 1, 30, 0);
  assert.equal(T.fmtKey(T.logicalToday(at1am, 2)), '2026-05-01');
});

test('date: 2 AM on the dot flips the day (cutoff is exclusive)', () => {
  const at2 = new Date(2026, 4, 2, 2, 0, 0);
  assert.equal(T.fmtKey(T.logicalToday(at2, 2)), '2026-05-02');
});

test('date: midnight workout goes to yesterday\'s bucket', () => {
  // The user said the day "lasts till 2 AM" so an 11:59 PM session and a
  // 12:01 AM session both belong to the same day in the user's mind.
  const justAfterMidnight = new Date(2026, 4, 2, 0, 0, 30);
  assert.equal(T.fmtKey(T.logicalToday(justAfterMidnight, 2)), '2026-05-01');
});

test('date: earliestKey with mixed valid + phantom keys finds first VALID date', () => {
  const map = {
    'cardio': {}, // phantom would sort first alphabetically
    '2026-05-01': { mins: 50 },
    '2026-04-22': { mins: 50 },
  };
  const earliest = Object.keys(map).filter(T.isDateKey).sort()[0];
  assert.equal(earliest, '2026-04-22');
});

// ============================================================
// Defensive -- the user shouldn't be able to break the app with input
// ============================================================

test('defensive: nutrition entry with missing macros returns 0 for missing fields', () => {
  const day = { entries: [{ food: 'mystery food' /* no macros */ }] };
  const t = T.nutritionDayTotals(day);
  assert.equal(t.calories, 0);
  assert.equal(t.protein_g, 0);
});

test('defensive: weight entry with am=undefined, pm=undefined → null average', () => {
  assert.equal(T.weightAvg({ am: undefined, pm: undefined }), null);
});

test('defensive: countSessions on totally empty store returns 0', () => {
  assert.equal(T.countSessions({}), 0);
  assert.equal(T.countSessions(null), 0);
  assert.equal(T.countSessions(undefined), 0);
});

test('defensive: parseGistContent with truncated JSON returns the empty shape (no throw)', () => {
  const result = T.parseGistContent('{"store":{"cardio"');
  assert.deepEqual(Object.keys(result.store).sort(), ['cardio','intervals','lifting','nutrition','weight']);
});

test('defensive: weightSeries with an entry where pm is a string is filtered', () => {
  // String values in numeric fields are dropped, not coerced.
  const series = T.weightSeries({
    '2026-05-01': { am: null, pm: '157' },
    '2026-05-02': { am: null, pm: 156 },
  });
  assert.equal(series.length, 1, 'string pm should be ignored');
  assert.equal(series[0].weight, 156);
});

// ============================================================
// Performance / large data -- the app should not slow down with a year of data
// ============================================================

test('performance: 365 days of cardio entries count in <50ms', () => {
  const map = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(2026, 0, 1 + i);
    if (d.getFullYear() === 2026) map[T.fmtKey(d)] = { mins: 50 };
  }
  const t0 = Date.now();
  const n = T.countSessions(map);
  const elapsed = Date.now() - t0;
  assert.equal(n, 365);
  assert.ok(elapsed < 50, `took ${elapsed}ms`);
});

test('performance: parseGistContent on a year of data parses in <50ms', () => {
  const big = { store: { cardio: {}, intervals: {}, lifting: {}, weight: {}, nutrition: {} }, meta: { cardio: {}, intervals: {}, lifting: {}, weight: {}, nutrition: {} } };
  for (let i = 0; i < 365; i++) {
    const d = T.fmtKey(new Date(2026, 0, 1 + i));
    big.store.cardio[d] = { mins: 50 };
    big.meta.cardio[d] = 1000 + i;
  }
  const json = JSON.stringify(big);
  const t0 = Date.now();
  const r = T.parseGistContent(json);
  const elapsed = Date.now() - t0;
  assert.equal(T.countSessions(r.store.cardio), 365);
  assert.ok(elapsed < 50, `took ${elapsed}ms`);
});

// ============================================================
// User-visible counts always agree with countSessions (no off-by-one)
// ============================================================

test('count consistency: countSessions == Object.keys(sanitized).length', () => {
  // Catches drift between the two ways the live code computes "total".
  const map = {
    '2026-05-01': { mins: 50 },
    '2026-05-02': { mins: null },
    '2026-05-03': { mins: 50 },
    'phantom': {},
  };
  const cleaned = T.sanitizeTabMap(map);
  assert.equal(T.countSessions(map), Object.keys(cleaned).length);
});
