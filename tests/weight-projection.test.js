// weightProjection: least-squares trend over recent weigh-ins projected to
// the target weight.
const { test } = require('node:test');
const assert = require('node:assert');
const T = require('../core.js');

const d = (s) => T.parseDate(s);
const e = (key, avg) => ({ date: d(key), avg });

test('projection: steady 0.5 lb/day loss hits target on the expected date', () => {
  const entries = [e('2026-07-01', 150), e('2026-07-03', 149), e('2026-07-05', 148)];
  const p = T.weightProjection(entries, 140);
  assert.ok(p);
  assert.ok(Math.abs(p.slopePerDay - (-0.5)) < 1e-9);
  assert.equal(p.anchorValue, 148);
  // 8 lb to go at 0.5/day = 16 days after Jul 5 = Jul 21.
  assert.equal(T.fmtKey(p.etaDate), '2026-07-21');
});

test('projection: rising trend has no eta', () => {
  const entries = [e('2026-07-01', 150), e('2026-07-05', 152)];
  const p = T.weightProjection(entries, 140);
  assert.ok(p);
  assert.ok(p.slopePerDay > 0);
  assert.equal(p.etaDate, null);
});

test('projection: flat trend has no eta', () => {
  const entries = [e('2026-07-01', 150), e('2026-07-03', 150), e('2026-07-05', 150)];
  const p = T.weightProjection(entries, 140);
  assert.ok(p);
  assert.equal(p.etaDate, null);
});

test('projection: already at/below target -> eta is the latest weigh-in date', () => {
  const entries = [e('2026-07-01', 142), e('2026-07-05', 139.5)];
  const p = T.weightProjection(entries, 140);
  assert.ok(p);
  assert.equal(T.fmtKey(p.etaDate), '2026-07-05');
});

test('projection: fewer than 2 points returns null', () => {
  assert.equal(T.weightProjection([], 140), null);
  assert.equal(T.weightProjection([e('2026-07-01', 150)], 140), null);
  assert.equal(T.weightProjection(null, 140), null);
});

test('projection: only points inside the trailing window shape the slope', () => {
  // Two old points falling fast, then a month gap, then two recent points
  // falling slowly. The old slope must not leak in.
  const entries = [
    e('2026-04-01', 170), e('2026-04-05', 160),
    e('2026-07-01', 150), e('2026-07-08', 149),
  ];
  const p = T.weightProjection(entries, 140, 28);
  assert.ok(p);
  // Recent slope: -1 lb / 7 days.
  assert.ok(Math.abs(p.slopePerDay - (-1 / 7)) < 1e-9);
});

test('projection: two same-day points cannot fit a line (degenerate x) -> null', () => {
  const entries = [e('2026-07-05', 150), e('2026-07-05', 149)];
  assert.equal(T.weightProjection(entries, 140), null);
});

test('projection: window with a single recent point returns null', () => {
  const entries = [e('2026-01-01', 160), e('2026-07-05', 150)];
  assert.equal(T.weightProjection(entries, 140, 28), null);
});
