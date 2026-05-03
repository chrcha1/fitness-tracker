// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

test('isDateKey accepts only YYYY-MM-DD strings', () => {
  assert.equal(T.isDateKey('2026-05-01'), true);
  assert.equal(T.isDateKey('2026-12-31'), true);
  assert.equal(T.isDateKey('cardio'), false);
  assert.equal(T.isDateKey('weight'), false);
  assert.equal(T.isDateKey(''), false);
  assert.equal(T.isDateKey('2026-13-01'), false);
  assert.equal(T.isDateKey('2026-05-32'), false);
  assert.equal(T.isDateKey('26-05-01'), false);
  assert.equal(T.isDateKey(null), false);
  assert.equal(T.isDateKey(undefined), false);
  assert.equal(T.isDateKey(20260501), false);
});

test('sanitizeTabMap strips phantom non-date keys (the 6-vs-10 bug)', () => {
  const corrupted = {
    '2026-04-22': { mins: 50 },
    '2026-04-23': { mins: 50 },
    '2026-04-24': { mins: 51 },
    '2026-04-28': { mins: 50 },
    '2026-04-29': { mins: 50 },
    '2026-05-01': { mins: 50 },
    cardio: {},
    weight: {},
    lifting: {},
    intervals: {},
  };
  const cleaned = T.sanitizeTabMap(corrupted);
  assert.equal(Object.keys(cleaned).length, 6);
  assert.equal(T.countSessions(corrupted), 6, 'count should be 6, not 10');
  assert.deepEqual(Object.keys(cleaned).sort(), [
    '2026-04-22', '2026-04-23', '2026-04-24',
    '2026-04-28', '2026-04-29', '2026-05-01',
  ]);
});

test('sanitizeTabMap handles null / undefined / non-object inputs', () => {
  assert.deepEqual(T.sanitizeTabMap(null), {});
  assert.deepEqual(T.sanitizeTabMap(undefined), {});
  assert.deepEqual(T.sanitizeTabMap('not-an-object'), {});
  assert.deepEqual(T.sanitizeTabMap(42), {});
  assert.deepEqual(T.sanitizeTabMap({}), {});
});

test('sanitizeStore always produces all five tabs', () => {
  const out = T.sanitizeStore({ cardio: { '2026-05-01': { mins: 30 } } });
  assert.deepEqual(Object.keys(out).sort(), ['cardio', 'intervals', 'lifting', 'nutrition', 'weight']);
  assert.deepEqual(out.weight, {});
  assert.deepEqual(out.lifting, {});
  assert.deepEqual(out.intervals, {});
  assert.deepEqual(out.nutrition, {});
});

test('sanitizeStore handles null / undefined input', () => {
  const out = T.sanitizeStore(null);
  assert.deepEqual(out, { cardio: {}, weight: {}, lifting: {}, intervals: {}, nutrition: {} });
});

test('needsRepair detects the corrupted state', () => {
  const corrupted = {
    cardio: { '2026-05-01': { mins: 30 }, cardio: {}, weight: {} },
    weight: {}, lifting: {}, intervals: {},
  };
  const meta = { cardio: {}, weight: {}, lifting: {}, intervals: {} };
  assert.equal(T.needsRepair(corrupted, meta), true);
});

test('needsRepair returns false for already-clean data', () => {
  const clean = {
    cardio: { '2026-05-01': { mins: 30 } },
    weight: {}, lifting: {}, intervals: {}, nutrition: {},
  };
  const meta = {
    cardio: { '2026-05-01': 12345 },
    weight: {}, lifting: {}, intervals: {}, nutrition: {},
  };
  assert.equal(T.needsRepair(clean, meta), false);
});

test('parseGistContent : new shape (v3)', () => {
  const r = T.parseGistContent(JSON.stringify({
    store: {
      cardio: { '2026-05-01': { mins: 50 } },
      weight: { '2026-05-01': { am: 157, pm: null } },
      lifting: {}, intervals: {},
    },
    meta: { cardio: { '2026-05-01': 1 }, weight: {}, lifting: {}, intervals: {} },
    deadline: '2026-12-01',
  }));
  assert.equal(r.deadline, '2026-12-01');
  assert.equal(T.countSessions(r.store.cardio), 1);
  assert.equal(r.store.weight['2026-05-01'].am, 157);
});

test('parseGistContent : pristine empty seed must NOT be misread as cardio data', () => {
  // This exact shape was used as the initial gist seed and triggered the bug:
  // the legacy fallback swallowed it as the cardio map.
  const r = T.parseGistContent(JSON.stringify({
    cardio: {}, weight: {}, lifting: {}, intervals: {},
  }));
  assert.deepEqual(r.store, { cardio: {}, weight: {}, lifting: {}, intervals: {}, nutrition: {} });
  assert.equal(T.countSessions(r.store.cardio), 0);
});

test('parseGistContent : v2 legacy { data, meta, deadline } shape', () => {
  const r = T.parseGistContent(JSON.stringify({
    data: { '2026-04-22': { mins: 50 }, '2026-04-23': { mins: 50 } },
    meta: { '2026-04-22': 1, '2026-04-23': 2 },
    deadline: '2026-12-01',
  }));
  assert.equal(T.countSessions(r.store.cardio), 2);
  assert.equal(r.deadline, '2026-12-01');
});

test('parseGistContent : v1 bare cardio map (date-keyed object)', () => {
  const r = T.parseGistContent(JSON.stringify({
    '2026-04-22': { mins: 50 },
    '2026-04-23': { mins: 50 },
  }));
  assert.equal(T.countSessions(r.store.cardio), 2);
});

test('parseGistContent : invalid / empty / garbage input never throws', () => {
  assert.equal(T.countSessions(T.parseGistContent('').store.cardio), 0);
  assert.equal(T.countSessions(T.parseGistContent('not json').store.cardio), 0);
  assert.equal(T.countSessions(T.parseGistContent('null').store.cardio), 0);
  assert.equal(T.countSessions(T.parseGistContent('[]').store.cardio), 0);
  assert.equal(T.countSessions(T.parseGistContent(undefined).store.cardio), 0);
});

test('parseGistContent : recovers from already-corrupted gist (the live bug)', () => {
  const corruptedGist = {
    store: {
      cardio: {
        '2026-04-22': { mins: 50 }, '2026-04-23': { mins: 50 },
        '2026-04-24': { mins: 51 }, '2026-04-28': { mins: 50 },
        '2026-04-29': { mins: 50 }, '2026-05-01': { mins: 50 },
        cardio: {}, weight: {}, lifting: {}, intervals: {},
      },
      weight: { '2026-05-01': { am: null, pm: 157 } },
      lifting: {}, intervals: {},
    },
    meta: {
      cardio: {
        '2026-04-22': 1, '2026-04-23': 2, '2026-04-24': 3,
        '2026-04-28': 4, '2026-04-29': 5, '2026-05-01': 6,
        cardio: 9, weight: 9, lifting: 9, intervals: 9,
      },
      weight: { '2026-05-01': 7 }, lifting: {}, intervals: {},
    },
    deadline: '2026-12-01',
  };
  const r = T.parseGistContent(JSON.stringify(corruptedGist));
  assert.equal(T.countSessions(r.store.cardio), 6, 'live gist must parse to 6 cardio sessions');
  assert.equal(Object.keys(r.meta.cardio).length, 6, 'meta must also be cleaned to 6 entries');
});

test('fmtKey is local-time and zero-padded', () => {
  const d = new Date(2026, 0, 5); // Jan 5, 2026 local
  assert.equal(T.fmtKey(d), '2026-01-05');
});

test('nextSaturday returns same day when given a Saturday', () => {
  const sat = new Date(2026, 4, 9); // 2026-05-09 is a Saturday
  assert.equal(sat.getDay(), 6);
  assert.equal(T.fmtKey(T.nextSaturday(sat)), '2026-05-09');
});

test('nextSaturday from Friday 2026-05-01 → 2026-05-02', () => {
  const fri = new Date(2026, 4, 1);
  assert.equal(fri.getDay(), 5);
  assert.equal(T.fmtKey(T.nextSaturday(fri)), '2026-05-02');
});

test('weeklyWeightGoal: 157 → 140 starting 2026-05-09, -1lb/wk', () => {
  const start = new Date(2026, 4, 9); // Sat 5/9
  // Goals: 5/9=156? No : user said "next Saturday goal is 156 lb (5/9)".
  // So at startSat the goal is already 156 (one lb below current 157).
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 9), start, 156, 140), 156);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 16), start, 156, 140), 155);
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 23), start, 156, 140), 154);
  // Far future floors at target.
  assert.equal(T.weeklyWeightGoal(new Date(2030, 0, 1), start, 156, 140), 140);
  // Before start = null.
  assert.equal(T.weeklyWeightGoal(new Date(2026, 4, 8), start, 156, 140), null);
});

test('weightGoalSchedule produces 17 checkpoints from 156 → 140', () => {
  const start = new Date(2026, 4, 9);
  const schedule = T.weightGoalSchedule(start, 156, 140);
  assert.equal(schedule.length, 17);
  assert.equal(schedule[0].weight, 156);
  assert.equal(schedule[schedule.length - 1].weight, 140);
  assert.equal(T.fmtKey(schedule[0].date), '2026-05-09');
  assert.equal(T.fmtKey(schedule[schedule.length - 1].date), '2026-08-29');
});

test('weightSeries averages AM/PM and ignores entries with neither', () => {
  const series = T.weightSeries({
    '2026-05-01': { am: null, pm: 157 },
    '2026-05-02': { am: 156, pm: 158 },
    '2026-05-03': { am: null, pm: null },
    'cardio': { am: 100, pm: 100 }, // phantom key : must be ignored
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].weight, 157);
  assert.equal(series[1].weight, 157);
});

test('countSessions matches what the user actually logged', () => {
  // Regression test for the 6 vs 10 bug. Anything here that returns the wrong
  // number is a bug worth blocking the build for.
  const cases = [
    [{}, 0],
    [{ '2026-05-01': {} }, 1],
    [{ '2026-05-01': {}, '2026-05-02': {} }, 2],
    [{ '2026-05-01': {}, cardio: {}, weight: {} }, 1],
    [{ cardio: {}, weight: {}, lifting: {}, intervals: {} }, 0],
  ];
  for (const [input, expected] of cases) {
    assert.equal(T.countSessions(input), expected, JSON.stringify(input));
  }
});
