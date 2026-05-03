// actualWeeklyPace: how many sessions/week the user has been averaging.
// Reflects current reality, not "what's needed to hit the goal". See the
// comment block in core.js for the formula.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

test('actualWeeklyPace: 7 sessions in ~10 days from Apr 22 to May 2 ≈ 4.9/wk', () => {
  // The user's situation. They have 7 sessions logged, started Apr 22,
  // today is May 2 (10 days elapsed + 1 day buffer = 11 days = 1.57 weeks).
  // Pace = 7 / 1.57 ≈ 4.45.
  const today = new Date(2026, 4, 2);
  const pace = T.actualWeeklyPace(7, '2026-04-22', today);
  assert.ok(pace > 4 && pace < 5, `expected 4-5 sessions/wk, got ${pace}`);
});

test('actualWeeklyPace: matches user expectation that they\'re at ~4/wk pace', () => {
  // Same data, just framed as "is the pace stat showing the right ballpark".
  const today = new Date(2026, 4, 2);
  const pace = T.actualWeeklyPace(7, '2026-04-22', today);
  assert.equal(Math.round(pace), 4, 'should round to 4 (the user\'s stated expectation)');
});

test('actualWeeklyPace: returns null when no sessions yet', () => {
  const today = new Date(2026, 4, 2);
  assert.equal(T.actualWeeklyPace(0, '2026-04-22', today), null);
});

test('actualWeeklyPace: returns null when no earliest entry', () => {
  const today = new Date(2026, 4, 2);
  assert.equal(T.actualWeeklyPace(5, null, today), null);
  assert.equal(T.actualWeeklyPace(5, undefined, today), null);
});

test('actualWeeklyPace: floors weeksElapsed at 1 so day-1 doesn\'t inflate', () => {
  // If a user logs 3 sessions on their first day, raw math would give
  // 3 / (1/7) = 21/wk, which would be misleading. The 7-day floor keeps
  // pace at 3 sessions / 7 days = 3/wk on day 1.
  const today = new Date(2026, 4, 1);
  const pace = T.actualWeeklyPace(3, '2026-05-01', today);
  assert.equal(pace, 3, 'day-1 floor should give exactly N/week for N sessions');
});

test('actualWeeklyPace: 30 sessions over 30 days = ~7/wk', () => {
  // Sanity: dense logging produces a high pace.
  const today = new Date(2026, 4, 30);
  const pace = T.actualWeeklyPace(30, '2026-05-01', today);
  // 30 days / 7 = 4.29 weeks. 30 / 4.29 ≈ 7.0 (because we add 1 day buffer).
  assert.ok(pace > 6.5 && pace < 7.5);
});

test('actualWeeklyPace: 100 sessions over a year = ~1.9/wk (the original plan target)', () => {
  // The user's deadline plan: hit 100 by Dec 1 starting from April 22.
  // That's roughly 224 days = 32 weeks. 100/32 = 3.125. So if they were on
  // track, the pace stat would show ~3.1.
  const today = new Date(2026, 11, 1);
  const pace = T.actualWeeklyPace(100, '2026-04-22', today);
  // (Dec 1 - Apr 22) = 223 days + 1 day buffer = 224 days = 32 weeks.
  // 100 / 32 = 3.125
  assert.ok(pace > 3 && pace < 3.5, `expected ~3.1/wk, got ${pace}`);
});

test('actualWeeklyPace: at exactly goal ratio, pace ≈ goalSessions/weeksTotal', () => {
  // If the user is exactly on pace to hit 100 by Dec 1 starting Apr 22, the
  // weekly pace at any midpoint should approximate the constant goal pace.
  // April 22 to Dec 1 = 223 days = 31.86 weeks. Goal pace = 100/31.86 = 3.14.
  // At 25% of timeline = 56 days after Apr 22 = June 17. Expected
  // sessions = 25.
  const start = '2026-04-22';
  const goalPace = 100 / 31.86;
  const oneQuarter = new Date(2026, 5, 17); // June 17
  const expectedSessions = 25;
  const pace = T.actualWeeklyPace(expectedSessions, start, oneQuarter);
  // The 1-day buffer in the formula adds tiny error; allow 0.5/wk tolerance.
  assert.ok(Math.abs(pace - goalPace) < 0.5, `goalPace=${goalPace.toFixed(2)}, observed=${pace.toFixed(2)}`);
});
