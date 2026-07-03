// Apple Watch ingestion pipeline: normalization, Zone 2 qualification,
// day mapping, and per-day aggregation. All via pure TrackCore helpers.
const { test } = require('node:test');
const assert = require('node:assert');
const T = require('../core.js');

// ===== qualifiesAsZone2: HR boundaries (inclusive, unrounded) =====

test('HR 139.96 does not qualify (no pre-rounding)', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 139.96, durationMin: 30 }, {}), false);
});

test('HR 140.0 qualifies (inclusive lower bound)', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 140.0, durationMin: 30 }, {}), true);
});

test('HR 155.0 qualifies (inclusive upper bound)', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 155.0, durationMin: 30 }, {}), true);
});

test('HR 155.04 does not qualify (no pre-rounding)', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 155.04, durationMin: 30 }, {}), false);
});

test('HR mid-zone qualifies', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 147.5, durationMin: 45 }, {}), true);
});

// ===== qualifiesAsZone2: duration boundary =====

test('duration 19.99 min does not qualify', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 145, durationMin: 19.99 }, {}), false);
});

test('duration 20.0 min qualifies (inclusive)', () => {
  assert.equal(T.qualifiesAsZone2({ avgHr: 145, durationMin: 20.0 }, {}), true);
});

test('custom config thresholds are honored', () => {
  const cfg = { hrMin: 130, hrMax: 145, minMins: 30 };
  assert.equal(T.qualifiesAsZone2({ avgHr: 132, durationMin: 30 }, cfg), true);
  assert.equal(T.qualifiesAsZone2({ avgHr: 146, durationMin: 30 }, cfg), false);
  assert.equal(T.qualifiesAsZone2({ avgHr: 132, durationMin: 29 }, cfg), false);
});

test('null/missing workout never qualifies', () => {
  assert.equal(T.qualifiesAsZone2(null, {}), false);
  assert.equal(T.qualifiesAsZone2(undefined, {}), false);
});

// ===== normalizeWatchInbox: accepted shapes =====

test('normalize: single object', () => {
  const out = T.normalizeWatchInbox({ start: '2026-07-01T08:00:00Z', duration_min: 32, avg_hr: 146 });
  assert.equal(out.length, 1);
  assert.equal(out[0].durationMin, 32);
  assert.equal(out[0].avgHr, 146);
  assert.ok(out[0].start instanceof Date);
});

test('normalize: array of objects', () => {
  const out = T.normalizeWatchInbox([
    { start: '2026-07-01T08:00:00Z', duration_min: 32, avg_hr: 146 },
    { start: '2026-07-02T08:00:00Z', duration_min: 25, avg_hr: 150 },
  ]);
  assert.equal(out.length, 2);
});

test('normalize: {workouts:[...]} wrapper', () => {
  const out = T.normalizeWatchInbox({ workouts: [{ start: '2026-07-01T08:00:00Z', duration_min: 32, avg_hr: 146 }] });
  assert.equal(out.length, 1);
});

test('normalize: JSON string input', () => {
  const out = T.normalizeWatchInbox('{"start":"2026-07-01T08:00:00Z","duration_min":32,"avg_hr":146}');
  assert.equal(out.length, 1);
});

test('normalize: malformed JSON string returns empty, never throws', () => {
  assert.deepEqual(T.normalizeWatchInbox('{"start": nope'), []);
  assert.deepEqual(T.normalizeWatchInbox(''), []);
  assert.deepEqual(T.normalizeWatchInbox(null), []);
  assert.deepEqual(T.normalizeWatchInbox(undefined), []);
});

test('normalize: alternate field spellings', () => {
  const out = T.normalizeWatchInbox({ startDate: '2026-07-01T08:00:00Z', duration_sec: 1800, avgHr: '148.5' });
  assert.equal(out.length, 1);
  assert.equal(out[0].durationMin, 30);
  assert.equal(out[0].avgHr, 148.5);
});

test('normalize: records missing start/duration/hr are dropped, valid ones kept', () => {
  const out = T.normalizeWatchInbox([
    { duration_min: 30, avg_hr: 145 },                                    // no start
    { start: '2026-07-01T08:00:00Z', avg_hr: 145 },                       // no duration
    { start: '2026-07-01T08:00:00Z', duration_min: 30 },                  // no hr
    { start: 'not-a-date', duration_min: 30, avg_hr: 145 },               // bad date
    { start: '2026-07-01T08:00:00Z', duration_min: -5, avg_hr: 145 },     // bad duration
    { start: '2026-07-01T09:00:00Z', duration_min: 30, avg_hr: 145 },     // valid
    'garbage', null, 42,
  ]);
  assert.equal(out.length, 1);
});

test('normalize: deterministic synthesized id from start+duration when no uuid', () => {
  const rec = { start: '2026-07-01T08:00:00.000Z', duration_min: 32.4, avg_hr: 146 };
  const a = T.normalizeWatchInbox(rec);
  const b = T.normalizeWatchInbox(rec);
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].id, '2026-07-01T08:00:00.000Z|32');
});

test('normalize: explicit id/uuid wins over synthesized', () => {
  assert.equal(T.normalizeWatchInbox({ id: 'abc', start: '2026-07-01T08:00:00Z', duration_min: 30, avg_hr: 145 })[0].id, 'abc');
  assert.equal(T.normalizeWatchInbox({ uuid: 'u-1', start: '2026-07-01T08:00:00Z', duration_min: 30, avg_hr: 145 })[0].id, 'u-1');
});

// ===== logicalDayKey: 2 AM cutoff =====

test('2AM cutoff: 1:59 AM workout belongs to the previous day', () => {
  assert.equal(T.logicalDayKey(new Date(2026, 6, 2, 1, 59), 2), '2026-07-01');
});

test('2AM cutoff: 2:00 AM workout belongs to the same day', () => {
  assert.equal(T.logicalDayKey(new Date(2026, 6, 2, 2, 0), 2), '2026-07-02');
});

test('2AM cutoff: 3:00 AM and evening workouts belong to the same day', () => {
  assert.equal(T.logicalDayKey(new Date(2026, 6, 2, 3, 0), 2), '2026-07-02');
  assert.equal(T.logicalDayKey(new Date(2026, 6, 2, 21, 30), 2), '2026-07-02');
});

test('2AM cutoff: 1 AM on the 1st of a month rolls back to previous month', () => {
  assert.equal(T.logicalDayKey(new Date(2026, 6, 1, 1, 0), 2), '2026-06-30');
});

// ===== applyWatchWorkout: per-day aggregation =====

test('apply: empty day creates an auto entry with source and workoutIds', () => {
  const r = T.applyWatchWorkout(null, 32, 146, 'w1');
  assert.equal(r.changed, true);
  assert.deepEqual(r.entry, { mins: 32, avgHr: 146, auto: true, source: 'watch', workoutIds: ['w1'] });
});

test('apply: duplicate workoutId is a no-op', () => {
  const day = { mins: 32, avgHr: 146, auto: true, source: 'watch', workoutIds: ['w1'] };
  const r = T.applyWatchWorkout(day, 32, 146, 'w1');
  assert.equal(r.changed, false);
  assert.deepEqual(r.entry, day);
});

test('apply: second qualifying workout sums minutes with duration-weighted HR', () => {
  const day = { mins: 30, avgHr: 140, auto: true, source: 'watch', workoutIds: ['w1'] };
  const r = T.applyWatchWorkout(day, 60, 152, 'w2');
  assert.equal(r.changed, true);
  assert.equal(r.entry.mins, 90);
  // (140*30 + 152*60) / 90 = 148
  assert.equal(r.entry.avgHr, 148);
  assert.deepEqual(r.entry.workoutIds, ['w1', 'w2']);
});

test('apply: manual entry minutes are preserved, only missing avgHr filled', () => {
  const manual = { mins: 45 };
  const r = T.applyWatchWorkout(manual, 32, 146, 'w1');
  assert.equal(r.changed, true);
  assert.equal(r.entry.mins, 45);
  assert.equal(r.entry.avgHr, 146);
  assert.equal(r.entry.auto, undefined);
  assert.deepEqual(r.entry.workoutIds, ['w1']);
});

test('apply: manual entry with existing avgHr is not overwritten', () => {
  const manual = { mins: 45, avgHr: 142 };
  const r = T.applyWatchWorkout(manual, 32, 150, 'w1');
  assert.equal(r.entry.avgHr, 142);
});

test('apply: pure - input entry is never mutated', () => {
  const day = { mins: 30, avgHr: 140, auto: true, source: 'watch', workoutIds: ['w1'] };
  const frozen = JSON.stringify(day);
  T.applyWatchWorkout(day, 60, 152, 'w2');
  assert.equal(JSON.stringify(day), frozen);
});

test('apply: same-day aggregation still counts as one session', () => {
  // Session counting is per date key; a day with two summed workouts is one
  // entry in the cardio map, hence one session toward the 100 goal.
  let day = T.applyWatchWorkout(null, 30, 145, 'w1').entry;
  day = T.applyWatchWorkout(day, 25, 150, 'w2').entry;
  const store = T.sanitizeStore({ cardio: { '2026-07-01': day } });
  assert.equal(T.countSessions(store.cardio), 1);
});

// ===== Backward compatibility =====

test('backward compat: old gist shape without watch fields parses fine', () => {
  const old = JSON.stringify({
    store: { cardio: { '2026-05-01': { mins: 30 } }, weight: {}, lifting: {}, intervals: {}, nutrition: {} },
    meta: { cardio: { '2026-05-01': 1746000000000 }, weight: {}, lifting: {}, intervals: {}, nutrition: {} },
    deadline: '2026-12-01',
  });
  const parsed = T.parseGistContent(old);
  assert.equal(parsed.store.cardio['2026-05-01'].mins, 30);
  assert.equal(parsed.deadline, '2026-12-01');
});

test('backward compat: watch fields on cardio entries survive sanitize + merge', () => {
  const entry = { mins: 32, avgHr: 146, auto: true, source: 'watch', workoutIds: ['w1'] };
  const store = T.sanitizeStore({ cardio: { '2026-07-01': entry } });
  assert.deepEqual(store.cardio['2026-07-01'], entry);
  const merged = T.mergeTabKeys({}, {}, store.cardio, { '2026-07-01': 5 });
  assert.deepEqual(merged.store['2026-07-01'], entry);
});

test('backward compat: manual cardio entry without watch fields is untouched by sanitize', () => {
  const store = T.sanitizeStore({ cardio: { '2026-05-01': { mins: 30 } } });
  assert.deepEqual(store.cardio['2026-05-01'], { mins: 30 });
});
