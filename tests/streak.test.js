const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

const today = new Date(2026, 4, 1); // Fri 5/1/2026

test('dayHasContent semantics per tab', () => {
  assert.equal(T.dayHasContent('cardio', { mins: 30 }), true);
  assert.equal(T.dayHasContent('cardio', { mins: null }), true, 'cardio: presence is enough');
  assert.equal(T.dayHasContent('cardio', undefined), false);
  assert.equal(T.dayHasContent('intervals', {}), true);
  assert.equal(T.dayHasContent('weight', { am: 156, pm: null }), true);
  assert.equal(T.dayHasContent('weight', { am: null, pm: null }), false);
  assert.equal(T.dayHasContent('weight', undefined), false);
  assert.equal(T.dayHasContent('lifting', { tags: ['upper'] }), true);
  assert.equal(T.dayHasContent('lifting', { tags: [] }), false);
  assert.equal(T.dayHasContent('lifting', {}), false);
});

test('currentStreak (daily) : empty data returns 0', () => {
  const s = T.currentStreak('cardio', {}, today);
  assert.deepEqual(s, { length: 0, shieldsUsed: [] });
});

test('currentStreak (daily) : chain ending today', () => {
  const map = {
    '2026-04-29': { mins: 50 },
    '2026-04-30': { mins: 50 },
    '2026-05-01': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 3);
});

test('currentStreak (daily) : today empty doesn\'t penalize, chain continues from yesterday', () => {
  const map = {
    '2026-04-29': { mins: 50 },
    '2026-04-30': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 2);
});

test('currentStreak (daily) : gap breaks streak without shield', () => {
  const map = {
    '2026-04-28': { mins: 50 }, // 4/28
    // 4/29 missing
    '2026-04-30': { mins: 50 },
    '2026-05-01': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today);
  assert.equal(s.length, 2, 'chain breaks at the missed 4/29');
});

test('currentStreak (daily) : one shield/wk forgives a single missed day', () => {
  const map = {
    '2026-04-26': { mins: 50 },
    '2026-04-27': { mins: 50 },
    '2026-04-28': { mins: 50 },
    // 4/29 missing → shield should cover this
    '2026-04-30': { mins: 50 },
    '2026-05-01': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today, { shieldsPerWeek: 1 });
  assert.equal(s.length, 6);
  assert.deepEqual(s.shieldsUsed, ['2026-04-29']);
});

test('currentStreak (daily) : shield runs out on second miss in same window', () => {
  const map = {
    '2026-04-26': { mins: 50 },
    // 4/27 missing
    '2026-04-28': { mins: 50 },
    // 4/29 missing : second miss, no more shields
    '2026-04-30': { mins: 50 },
    '2026-05-01': { mins: 50 },
  };
  const s = T.currentStreak('cardio', map, today, { shieldsPerWeek: 1 });
  // Walking back: 5/1✓ 4/30✓ 4/29✗(shield used) 4/28✓ 4/27✗(no shields left) → break.
  assert.equal(s.length, 4);
  assert.deepEqual(s.shieldsUsed, ['2026-04-29']);
});

test('currentStreak (weekly) : counts consecutive weeks with ≥1 entry', () => {
  // weekly streak for intervals: weeks of 4/26, 4/19, 4/12 all have entries.
  const map = {
    '2026-04-13': { mins: 30 }, // week of 4/12
    '2026-04-22': { mins: 30 }, // week of 4/19
    '2026-04-30': { mins: 30 }, // week of 4/26
  };
  const s = T.currentStreak('intervals', map, today, { mode: 'weekly' });
  assert.equal(s.length, 3);
});

test('currentStreak (weekly) : current empty week does not penalize', () => {
  // No entry in current week (4/26-5/2), but last week had one.
  const map = {
    '2026-04-22': { mins: 30 }, // week of 4/19
  };
  const s = T.currentStreak('intervals', map, today, { mode: 'weekly' });
  assert.equal(s.length, 1);
});

test('trendDelta : count of days, week-over-week', () => {
  const map = {
    // last 7 days (4/25-5/1): 3 entries
    '2026-04-26': { mins: 50 },
    '2026-04-29': { mins: 50 },
    '2026-05-01': { mins: 50 },
    // prior 7 days (4/18-4/24): 1 entry
    '2026-04-22': { mins: 50 },
  };
  const t = T.trendDelta('cardio', map, today);
  assert.equal(t.current, 3);
  assert.equal(t.previous, 1);
  assert.equal(t.delta, 2);
});

test('trendDelta : custom metric (sum of minutes)', () => {
  const map = {
    '2026-04-26': { mins: 50 },
    '2026-04-29': { mins: 30 },
    '2026-05-01': { mins: 60 },
    '2026-04-22': { mins: 45 },
  };
  const t = T.trendDelta('cardio', map, today, {
    metric: (_tab, e) => (e && typeof e.mins === 'number') ? e.mins : 0,
  });
  assert.equal(t.current, 140);
  assert.equal(t.previous, 45);
  assert.equal(t.delta, 95);
});

test('sparklineSeries : 14-day window, oldest→newest', () => {
  const map = {
    '2026-05-01': { mins: 50 }, // last
    '2026-04-29': { mins: 50 },
    '2026-04-22': { mins: 50 }, // first in window (4/18-5/1)
  };
  const s = T.sparklineSeries('cardio', map, today, { days: 14 });
  assert.equal(s.values.length, 14);
  assert.equal(s.values[s.values.length - 1], 1, '5/1 = today, has entry');
  assert.equal(s.values[0], 0, '4/18 has no entry');
});

test('sparklineSeries : custom value extractor (weight avg)', () => {
  const map = {
    '2026-05-01': { am: null, pm: 157 },
    '2026-04-30': { am: 158, pm: 156 },
  };
  const s = T.sparklineSeries('weight', map, today, {
    days: 5,
    value: (_tab, e) => T.weightAvg(e) || 0,
  });
  assert.equal(s.values.length, 5);
  assert.equal(s.values[s.values.length - 1], 157);
  assert.equal(s.values[s.values.length - 2], 157); // (158+156)/2
});

test('weightAvg', () => {
  assert.equal(T.weightAvg({ am: 156, pm: 158 }), 157);
  assert.equal(T.weightAvg({ am: null, pm: 157 }), 157);
  assert.equal(T.weightAvg({ am: 156, pm: null }), 156);
  assert.equal(T.weightAvg({ am: null, pm: null }), null);
  assert.equal(T.weightAvg(null), null);
});

test('phantom keys never affect streaks', () => {
  // Regression: streak math must use sanitized data.
  const corruptedMap = {
    '2026-04-30': { mins: 50 },
    '2026-05-01': { mins: 50 },
    cardio: {}, weight: {}, lifting: {}, intervals: {},
  };
  const s = T.currentStreak('cardio', corruptedMap, today);
  assert.equal(s.length, 2);
});
