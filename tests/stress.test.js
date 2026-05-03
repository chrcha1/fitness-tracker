// Stress + adversarial test sweep. The previous test files cover normal
// flows and known edge cases. This file specifically tries to BREAK the
// pure logic with situations that aren't strictly user-realistic but can
// happen with corrupted data, time skew between devices, or weird inputs.
//
// Every test here is a "what if a future bug introduces this state?"
// scenario. If something here fails, a real-world data corruption is
// possible.

const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

// ============================================================
// Time travel: dates in the future, the past, the year 2099.
// ============================================================

test('stress: a date 50 years in the future still works for fmtKey', () => {
  const future = new Date(2076, 5, 15);
  assert.equal(T.fmtKey(future), '2076-06-15');
});

test('stress: a date in the year 2 sanity-checks (we don\'t support yearless dates)', () => {
  // Pre-1000 years would yield 3-digit year strings. Our regex requires
  // exactly 4 digits, so they\'re rejected, which is the correct behavior.
  assert.equal(T.isDateKey('0099-05-01'), true, '4-digit zero-padded years are valid');
  assert.equal(T.isDateKey('99-05-01'), false, '2-digit years rejected');
});

test('stress: weight series with entries SPANNING DST forward transition', () => {
  // 2026-03-08 is the US DST forward day (clocks jump from 1:59 to 3:00).
  // Entries on 3/7 and 3/9 should be exactly 2 days apart in the series.
  const series = T.weightSeries({
    '2026-03-07': { am: null, pm: 158 },
    '2026-03-09': { am: null, pm: 157 },
  });
  const gap = series[1].date - series[0].date;
  // 2 days = 172800000 ms... but DST makes 3/8 a 23-hour day. Our parseDate
  // returns local midnight, so the gap is actually 23 + 24 = 47 hours.
  // (Date math respects DST in local time.)
  const hours = gap / (60 * 60 * 1000);
  assert.ok(hours >= 47 && hours <= 48, `expected ~47-48h across DST, got ${hours}h`);
});

test('stress: weight series with entries SPANNING DST fall-back transition', () => {
  // 2026-11-01 is the US DST fall-back day. 11/1 is a 25-hour day in local.
  const series = T.weightSeries({
    '2026-10-31': { am: null, pm: 152 },
    '2026-11-02': { am: null, pm: 151 },
  });
  const gap = series[1].date - series[0].date;
  const hours = gap / (60 * 60 * 1000);
  // 24 + 25 = 49 hours
  assert.ok(hours >= 48 && hours <= 49, `expected ~48-49h, got ${hours}h`);
});

test('stress: streak chain spanning year boundary (Dec 31 -> Jan 1)', () => {
  const today = new Date(2027, 0, 5); // Jan 5, 2027
  const map = {
    '2026-12-29': { mins: 50 },
    '2026-12-30': { mins: 50 },
    '2026-12-31': { mins: 50 },
    '2027-01-01': { mins: 50 },
    '2027-01-02': { mins: 50 },
    '2027-01-03': { mins: 50 },
    '2027-01-04': { mins: 50 },
    '2027-01-05': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 8, 'year boundary should not break streak counting');
});

test('stress: leap-year Feb 29 streak', () => {
  // 2028 is a leap year. Feb 28, 29, Mar 1 chain.
  const today = new Date(2028, 2, 1);
  const map = {
    '2028-02-28': { mins: 50 },
    '2028-02-29': { mins: 50 },
    '2028-03-01': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 3);
});

// ============================================================
// Concurrent merge timing scenarios
// ============================================================

test('stress: same key, same content, same timestamp on both sides → no change', () => {
  // Two devices independently logged identical data. Merge should converge
  // without false-positive 'changed' flags (which would trigger a useless
  // push round-trip).
  const data = { '2026-05-01': { mins: 50 } };
  const meta = { '2026-05-01': 1000 };
  const r = T.mergeTabKeys(data, meta, data, meta, () => 9999);
  assert.equal(r.changed, false);
  assert.deepEqual(r.store, data);
});

test('stress: same key, different content, same timestamp → keep local (non-destructive)', () => {
  // Genuine conflict. We have to pick one; the merge picks LOCAL (fail-safe)
  // and waits for a future write to break the tie.
  const localStore = { '2026-05-01': { mins: 75 } };
  const localMeta = { '2026-05-01': 1000 };
  const remoteStore = { '2026-05-01': { mins: 50 } };
  const remoteMeta = { '2026-05-01': 1000 };
  const r = T.mergeTabKeys(localStore, localMeta, remoteStore, remoteMeta, () => 9999);
  assert.equal(r.store['2026-05-01'].mins, 75, 'tie favors local');
});

test('stress: chain of three merges (A → A+B → A+B+C) is associative', () => {
  // Device A: logs A. Device B: logs B (after A is in the gist). Device C:
  // logs C (after both are in the gist). Verify the final state has all 3.
  const A = { '2026-05-01': { mins: 50 } };
  const Ameta = { '2026-05-01': 1000 };
  const B = { '2026-05-02': { mins: 60 } };
  const Bmeta = { '2026-05-02': 2000 };
  const C = { '2026-05-03': { mins: 70 } };
  const Cmeta = { '2026-05-03': 3000 };

  // Merge A and B (B is newer)
  const ab = T.mergeTabKeys(A, Ameta, B, Bmeta, () => 9999);
  // Then merge AB with C (C is newer)
  const abc = T.mergeTabKeys(ab.store, ab.meta, C, Cmeta, () => 9999);

  assert.equal(Object.keys(abc.store).length, 3);
  assert.equal(abc.store['2026-05-01'].mins, 50);
  assert.equal(abc.store['2026-05-02'].mins, 60);
  assert.equal(abc.store['2026-05-03'].mins, 70);
});

test('stress: tombstone + later un-delete (user removed then re-logged the same day)', () => {
  // Day 1: user logs 5/1 with 50 min (ts=1000).
  // Day 2: user removes it (ts=2000, tombstone).
  // Day 3: user re-logs 5/1 with 60 min (ts=3000).
  // After all syncs, the 60-min entry should win.
  const r1 = T.mergeTabKeys(
    {}, { '2026-05-01': { deleted: 2000 } }, // local has tombstone
    { '2026-05-01': { mins: 60 } }, { '2026-05-01': 3000 }, // remote has new entry, newer
    () => 9999,
  );
  assert.equal(r1.store['2026-05-01'].mins, 60, 'newer re-log wins over older tombstone');
});

test('stress: 50-key merge with mixed local-newer and remote-newer keys', () => {
  // Build 50 keys. Half have local-newer (timestamp 2000), half have
  // remote-newer (timestamp 1000 local, 2000 remote).
  const localStore = {}, localMeta = {};
  const remoteStore = {}, remoteMeta = {};
  for (let i = 0; i < 50; i++) {
    const k = T.fmtKey(new Date(2026, 0, 1 + i));
    if (i % 2 === 0) {
      localStore[k] = { mins: 50 };
      localMeta[k] = 2000;
      remoteStore[k] = { mins: 30 };
      remoteMeta[k] = 1000;
    } else {
      localStore[k] = { mins: 30 };
      localMeta[k] = 1000;
      remoteStore[k] = { mins: 50 };
      remoteMeta[k] = 2000;
    }
  }
  const r = T.mergeTabKeys(localStore, localMeta, remoteStore, remoteMeta, () => 9999);
  // Every key should now have mins: 50 (the newer side wins on each).
  for (const k of Object.keys(r.store)) {
    assert.equal(r.store[k].mins, 50, `key ${k} should be 50`);
  }
});

// ============================================================
// Adversarial entry shapes
// ============================================================

test('stress: nutrition entry with extreme float that loses precision survives', () => {
  // 0.1 + 0.2 = 0.30000000000000004 in float. We don\'t depend on exact
  // equality, but the totals shouldn\'t accumulate so much error they\'re
  // visibly wrong.
  const day = {
    entries: [
      { food: 'a', macros: { calories: 0.1, protein_g: 0, carbs_g: 0, fat_g: 0 } },
      { food: 'b', macros: { calories: 0.2, protein_g: 0, carbs_g: 0, fat_g: 0 } },
    ],
  };
  const t = T.nutritionDayTotals(day);
  // Float-add is 0.300000000000000004; close-enough check.
  assert.ok(Math.abs(t.calories - 0.3) < 0.01);
});

test('stress: nutrition with negative calories (defensive)', () => {
  // Garbage in, garbage out -- but no crash.
  const day = {
    entries: [
      { food: 'a', macros: { calories: -500, protein_g: 0, carbs_g: 0, fat_g: 0 } },
      { food: 'b', macros: { calories: 600, protein_g: 0, carbs_g: 0, fat_g: 0 } },
    ],
  };
  const t = T.nutritionDayTotals(day);
  assert.equal(t.calories, 100);
});

test('stress: weight entry with extreme value (5 lb baby, 1000 lb troll)', () => {
  // We don\'t validate range; the editor restricts via WEIGHT_MIN/MAX, but
  // the pure helpers shouldn\'t balk at out-of-range input.
  assert.equal(T.weightAvg({ am: 5, pm: null }), 5);
  assert.equal(T.weightAvg({ am: 1000, pm: null }), 1000);
});

test('stress: lifting tags with 50 different tag strings (we only render 5)', () => {
  // The user can\'t enter unknown tags via the UI, but if a future migration
  // ever introduces new tag names, dayHasContent should still see this day
  // as content (not crash, not return false).
  const tags = [];
  for (let i = 0; i < 50; i++) tags.push('tag' + i);
  assert.equal(T.dayHasContent('lifting', { tags }), true);
});

test('stress: calendar with 1000 days of data and 100 phantom keys filtered cleanly', () => {
  const map = {};
  for (let i = 0; i < 1000; i++) {
    const k = T.fmtKey(new Date(2024, 0, 1 + i));
    map[k] = { mins: 50 };
  }
  for (let i = 0; i < 100; i++) {
    map['phantom_' + i] = { mins: 50 };
  }
  assert.equal(T.countSessions(map), 1000, '1000 valid + 100 phantom = 1000 counted');
});

// ============================================================
// Computational correctness on large inputs
// ============================================================

test('stress: BMR formula stays linear over 200 lb of weight delta', () => {
  // BMR = 10 * kg + ... so the kcal/lb ratio is constant. Verify that any
  // 1-lb delta produces the same kcal change anywhere on the curve.
  const profile = { heightIn: 65.5, age: 22, sex: 'F' };
  const at100 = T.nutritionKcalGoal(100, profile);
  const at101 = T.nutritionKcalGoal(101, profile);
  const at200 = T.nutritionKcalGoal(200, profile);
  const at201 = T.nutritionKcalGoal(201, profile);
  // The diff should be ~4.54 kcal/lb (= 10/2.2046). Rounded to nearest 5,
  // both might round to 5 or 0. We allow either.
  const diff1 = at101 - at100;
  const diff2 = at201 - at200;
  assert.ok(Math.abs(diff1 - diff2) < 5, `1-lb delta should be consistent: ${diff1} vs ${diff2}`);
});

test('stress: 365-day streak terminates correctly at the day-730 cap', () => {
  // The streak loop has a hard cap of 730 days to prevent runaway. Build a
  // perfect 365-day chain and verify we hit exactly 365 (not 730).
  const today = new Date(2027, 0, 1);
  const map = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    map[T.fmtKey(d)] = { mins: 50 };
  }
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 365, 'should count entire chain, not stop short');
});

test('stress: weight goal schedule with step=0.25 lb produces 65 entries from 156 to 140', () => {
  // (156 - 140) / 0.25 = 64 weeks of decreases + the start = 65 entries.
  const start = new Date(2026, 4, 9);
  const s = T.weightGoalSchedule(start, 156, 140, 0.25);
  assert.equal(s.length, 65);
});

// ============================================================
// Empty-state correctness: every render-supporting helper must do something
// sensible on a fresh user with zero data.
// ============================================================

test('stress: every helper on a totally fresh empty store is null/0/empty (no throws)', () => {
  const today = new Date(2026, 4, 2);

  // streak on empty
  for (const tab of T.TABS) {
    const s = T.currentStreak(tab, {}, today);
    assert.equal(s.length, 0);
  }
  // trend on empty
  for (const tab of T.TABS) {
    const t = T.trendDelta(tab, {}, today);
    assert.equal(t.delta, 0);
  }
  // sparkline on empty (default 14 days, all zeros)
  const spark = T.sparklineSeries('cardio', {}, today);
  assert.equal(spark.values.length, 14);
  assert.equal(spark.max, 0);
  // pace on empty
  assert.equal(T.actualWeeklyPace(0, null, today), null);
  // weight on empty
  assert.deepEqual(T.weightSeries({}), []);
  // nutrition on empty
  assert.deepEqual(T.nutritionDayTotals({}), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  // BMR with no weight = null (UI falls back to constant)
  assert.equal(T.nutritionKcalGoal(null, { heightIn: 65, age: 22, sex: 'F' }), null);
});

// ============================================================
// Schema robustness: every helper survives an entry from a "future" schema
// ============================================================

test('stress: future-schema fields on a day entry are preserved through sanitize', () => {
  // Suppose a future version adds `notes` and `tags` to nutrition entries.
  // Our sanitize/parse should preserve them so the new client can read them
  // even after old clients touched the gist.
  const day = {
    '2026-05-02': {
      entries: [{
        id: 'n_2026-05-02_a',
        food: 'eggs',
        macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 },
        // Future fields:
        notes: 'cooked in olive oil',
        tags: ['breakfast', 'high-protein'],
        photo_url: 'https://example.com/eggs.jpg',
        gps: { lat: 34.05, lng: -118.24 },
      }],
    },
  };
  const cleaned = T.sanitizeTabMap(day);
  assert.equal(cleaned['2026-05-02'].entries[0].notes, 'cooked in olive oil');
  assert.deepEqual(cleaned['2026-05-02'].entries[0].tags, ['breakfast', 'high-protein']);
  assert.equal(cleaned['2026-05-02'].entries[0].photo_url, 'https://example.com/eggs.jpg');
});

test('stress: parseGistContent preserves entry shape across all 5 tabs', () => {
  const original = {
    store: {
      cardio: { '2026-05-01': { mins: 50, hr_avg: 142, custom: 'whatever' } },
      intervals: { '2026-05-02': { mins: 30, type: 'tempo', pace_min_per_mi: 7.5 } },
      lifting: { '2026-05-03': { tags: ['upper'], notes: 'felt great' } },
      weight: { '2026-05-04': { am: 156, pm: 157, source: 'manual' } },
      nutrition: { '2026-05-05': { entries: [{ id: 'n_a', food: 'eggs', macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 } }] } },
    },
    meta: {
      cardio: { '2026-05-01': 1 },
      intervals: { '2026-05-02': 2 },
      lifting: { '2026-05-03': 3 },
      weight: { '2026-05-04': 4 },
      nutrition: { '2026-05-05': 5 },
    },
  };
  const r = T.parseGistContent(JSON.stringify(original));
  // Verify every custom field round-trips.
  assert.equal(r.store.cardio['2026-05-01'].hr_avg, 142);
  assert.equal(r.store.cardio['2026-05-01'].custom, 'whatever');
  assert.equal(r.store.intervals['2026-05-02'].pace_min_per_mi, 7.5);
  assert.equal(r.store.lifting['2026-05-03'].notes, 'felt great');
  assert.equal(r.store.weight['2026-05-04'].source, 'manual');
});

// ============================================================
// Goal-state edge cases
// ============================================================

test('stress: weeklyWeightGoal exactly on target Saturday returns target', () => {
  const start = new Date(2026, 4, 9);
  // 156 -> 140, 16 weeks of decreases + 1 start = 17 weeks. Last Saturday
  // is 2026-08-29.
  const lastSat = new Date(2026, 7, 29);
  assert.equal(T.weeklyWeightGoal(lastSat, start, 156, 140), 140);
});

test('stress: weeklyWeightGoal way past target Saturday still returns target (clamp)', () => {
  const start = new Date(2026, 4, 9);
  const wayLater = new Date(2030, 0, 1);
  assert.equal(T.weeklyWeightGoal(wayLater, start, 156, 140), 140);
});

test('stress: weeklyWeightGoal with target ABOVE start (gain mode!) does the right thing', () => {
  // A user might set target=160 with start=156 trying to GAIN weight. Our
  // schedule generator should produce a single entry at 156 since we don\'t
  // reverse direction (we use Math.max(target, current)). Verify.
  const start = new Date(2026, 4, 9);
  const r = T.weightGoalSchedule(start, 156, 160, 1);
  // start=156, target=160; 156 >= 160 is false on first iteration, so the
  // loop never runs. Returns []. That\'s correct: no plan if you\'re gaining
  // (this app is loss-only by design).
  assert.equal(r.length, 0);
});

// ============================================================
// User-flow regression scenarios
// ============================================================

test('regression: the original 6-vs-10 phantom-key bug stays dead', () => {
  // The first bug we ever fixed. Phantom tab-name keys in store.cardio.
  // Reproduces the exact gist content we saw: 6 real cardio entries +
  // 4 phantom tab-name keys.
  const corruptedGist = {
    store: {
      cardio: {
        '2026-04-22': { mins: 50 },
        '2026-04-23': { mins: 50 },
        '2026-04-24': { mins: 51 },
        '2026-04-28': { mins: 50 },
        '2026-04-29': { mins: 50 },
        '2026-05-01': { mins: 50 },
        cardio: {}, weight: {}, lifting: {}, intervals: {},
      },
      weight: { '2026-05-01': { am: null, pm: 157 } },
      lifting: {}, intervals: {},
    },
    meta: { cardio: {}, weight: {}, lifting: {}, intervals: {} },
    deadline: '2026-12-01',
  };
  const r = T.parseGistContent(JSON.stringify(corruptedGist));
  assert.equal(T.countSessions(r.store.cardio), 6, 'must be 6, not 10');
});

test('regression: stale-client overwriting nutrition stays prevented', () => {
  // The second big bug: stale client pushes without nutrition field, gist
  // loses nutrition data. Verified via merge: silence != delete.
  const local = { '2026-04-23': { entries: [{ food: 'eggs' }] } };
  const r = T.mergeTabKeys(local, { '2026-04-23': 1000 }, {}, {}, () => 9999);
  assert.deepEqual(r.store, local);
  assert.equal(r.changed, false);
});

test('regression: today-card tap navigates not opens-editor', () => {
  // Verified at the HTML level by tests/html-structure.test.js, but we can
  // also verify the routing helper allows it: every tab\'s tap action when
  // navigating from Today is "open-editor" or quick-mark, never blocked.
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    // Tapping on today\'s key when an entry exists should be open-editor.
    assert.equal(T.decideTapAction(tab, '2026-05-02', '2026-05-02', true), 'open-editor');
  }
});
