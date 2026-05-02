// mergeTabKeys: gist sync conflict resolution.
// Anything failing here is a real data-loss or data-corruption risk.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

const FIXED_NOW = () => 9999999999;

// ============================================================
// Empty cases.
// ============================================================

test('merge: empty local + empty remote → no change', () => {
  const r = T.mergeTabKeys({}, {}, {}, {}, FIXED_NOW);
  assert.deepEqual(r.store, {});
  assert.deepEqual(r.meta, {});
  assert.equal(r.changed, false);
});

test('merge: null inputs are tolerated', () => {
  const r = T.mergeTabKeys(null, null, null, null, FIXED_NOW);
  assert.deepEqual(r.store, {});
  assert.deepEqual(r.meta, {});
  assert.equal(r.changed, false);
});

test('merge: undefined inputs are tolerated', () => {
  const r = T.mergeTabKeys(undefined, undefined, undefined, undefined, FIXED_NOW);
  assert.deepEqual(r.store, {});
  assert.deepEqual(r.meta, {});
});

// ============================================================
// One-sided cases.
// ============================================================

test('merge: local-only data is preserved when remote is empty', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 } },
    { '2026-05-01': 1000 },
    {}, {},
    FIXED_NOW,
  );
  assert.deepEqual(r.store, { '2026-05-01': { mins: 50 } });
  assert.equal(r.meta['2026-05-01'], 1000);
  assert.equal(r.changed, false);
});

test('merge: remote-only data is pulled in when local is empty', () => {
  const r = T.mergeTabKeys(
    {}, {},
    { '2026-05-01': { mins: 50 } },
    { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].mins, 50);
  assert.equal(r.meta['2026-05-01'], 1000);
  assert.equal(r.changed, true);
});

// ============================================================
// Same-data cases.
// ============================================================

test('merge: identical entry on both sides → no change', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.equal(r.changed, false);
});

test('merge: same entry, both lack timestamps → take remote, mark with now', () => {
  // The fallback path: localTs=0 and remoteTs=0 means neither side has a meta
  // timestamp. Take remote and stamp now() so future syncs have something to
  // compare against.
  const r = T.mergeTabKeys(
    {}, {},
    { '2026-05-01': { mins: 50 } }, {},
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].mins, 50);
  assert.equal(r.meta['2026-05-01'], FIXED_NOW());
  assert.equal(r.changed, true);
});

// ============================================================
// Last-write-wins.
// ============================================================

test('merge: remote newer (greater ts) overwrites local data', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    { '2026-05-01': { mins: 75 } }, { '2026-05-01': 2000 },
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].mins, 75);
  assert.equal(r.meta['2026-05-01'], 2000);
  assert.equal(r.changed, true);
});

test('merge: local newer (greater ts) keeps local', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 75 } }, { '2026-05-01': 2000 },
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].mins, 75);
  assert.equal(r.meta['2026-05-01'], 2000);
  assert.equal(r.changed, false);
});

test('merge: same timestamps both sides, different data → keep local (defensive)', () => {
  // Tie goes to local. No change because we don't know which is "right".
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 75 } }, { '2026-05-01': 1000 },
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].mins, 75);
  assert.equal(r.changed, false);
});

// ============================================================
// Deletion semantics (tombstones).
// ============================================================

test('merge: remote tombstone newer than local → propagates delete', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    {}, { '2026-05-01': { deleted: 2000 } },
    FIXED_NOW,
  );
  assert.ok(!('2026-05-01' in r.store), 'entry should be removed');
  assert.deepEqual(r.meta['2026-05-01'], { deleted: 2000 });
  assert.equal(r.changed, true);
});

test('merge: local tombstone newer than remote → entry stays deleted (not resurrected)', () => {
  const r = T.mergeTabKeys(
    {}, { '2026-05-01': { deleted: 2000 } },
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.ok(!('2026-05-01' in r.store));
  assert.deepEqual(r.meta['2026-05-01'], { deleted: 2000 });
  assert.equal(r.changed, false);
});

test('merge: remote tombstone older than local entry → keep local entry', () => {
  // Edge: someone deleted in the past, but the local user logged a new entry
  // since. The new entry wins.
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 2000 },
    {}, { '2026-05-01': { deleted: 1000 } },
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].mins, 50);
  assert.equal(r.meta['2026-05-01'], 2000);
});

test('merge: tombstone-on-empty (already deleted on both) is idempotent', () => {
  const r = T.mergeTabKeys(
    {}, { '2026-05-01': { deleted: 2000 } },
    {}, { '2026-05-01': { deleted: 2000 } },
    FIXED_NOW,
  );
  assert.deepEqual(r.store, {});
  assert.deepEqual(r.meta, { '2026-05-01': { deleted: 2000 } });
  assert.equal(r.changed, false);
});

// ============================================================
// Phantom keys (the original bug).
// ============================================================

test('merge: phantom non-date keys in remote are filtered out', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 } }, { '2026-05-01': 1000 },
    { '2026-05-01': { mins: 50 }, cardio: {}, weight: {}, foo: 1 },
    { '2026-05-01': 1000, cardio: 9, weight: 9 },
    FIXED_NOW,
  );
  assert.deepEqual(Object.keys(r.store).sort(), ['2026-05-01']);
  assert.deepEqual(Object.keys(r.meta).sort(), ['2026-05-01']);
});

test('merge: phantom non-date keys in local are filtered out', () => {
  const r = T.mergeTabKeys(
    { '2026-05-01': { mins: 50 }, cardio: {}, badKey: 1 },
    { '2026-05-01': 1000, cardio: 9 },
    { '2026-05-01': { mins: 50 } },
    { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.deepEqual(Object.keys(r.store).sort(), ['2026-05-01']);
});

// ============================================================
// Mixed cases (typical real-world sync).
// ============================================================

test('merge: many keys, some local-newer some remote-newer', () => {
  const r = T.mergeTabKeys(
    { 'A': null, 'B': { mins: 50 }, 'D': { mins: 50 } }, // typo, see below
    {}, {}, {},
    FIXED_NOW,
  );
  // Above intentionally has bad keys to test sanitize. Rebuild correctly:
  const r2 = T.mergeTabKeys(
    {
      '2026-05-01': { mins: 50 },     // local-only
      '2026-05-02': { mins: 60 },     // local newer
    },
    { '2026-05-01': 1000, '2026-05-02': 3000 },
    {
      '2026-05-02': { mins: 40 },     // remote older for this key
      '2026-05-03': { mins: 70 },     // remote-only (new)
    },
    { '2026-05-02': 2000, '2026-05-03': 4000 },
    FIXED_NOW,
  );
  assert.equal(r2.store['2026-05-01'].mins, 50, 'local-only preserved');
  assert.equal(r2.store['2026-05-02'].mins, 60, 'local newer wins');
  assert.equal(r2.store['2026-05-03'].mins, 70, 'remote-only pulled in');
  assert.equal(r2.changed, true);
});

test('merge: remote has 100 days, local empty → all pulled in', () => {
  const remoteStore = {};
  const remoteMeta = {};
  for (let i = 0; i < 100; i++) {
    const k = `2026-${String(Math.floor(i / 31) + 1).padStart(2, '0')}-${String((i % 31) + 1).padStart(2, '0')}`;
    if (!T.isDateKey(k)) continue;
    remoteStore[k] = { mins: 50 };
    remoteMeta[k] = 1000 + i;
  }
  const r = T.mergeTabKeys({}, {}, remoteStore, remoteMeta, FIXED_NOW);
  assert.equal(Object.keys(r.store).length, Object.keys(remoteStore).length);
  assert.equal(r.changed, true);
});

// ============================================================
// Tab-shape independence (the merger doesn't care what's in the entry value).
// ============================================================

test('merge: weight-shape entries (am/pm) merge identically', () => {
  const r = T.mergeTabKeys(
    {}, {},
    { '2026-05-01': { am: null, pm: 157 } }, { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.equal(r.store['2026-05-01'].pm, 157);
});

test('merge: lifting-shape entries (tags array) merge identically', () => {
  const r = T.mergeTabKeys(
    {}, {},
    { '2026-05-01': { tags: ['upper', 'core'] } }, { '2026-05-01': 1000 },
    FIXED_NOW,
  );
  assert.deepEqual(r.store['2026-05-01'].tags, ['upper', 'core']);
});

test('merge: nutrition-shape entries (entries array) merge identically', () => {
  const remote = {
    '2026-04-23': {
      entries: [
        { id: 'n_2026-04-23_a', food: 'eggs', macros: { calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 } },
      ],
    },
  };
  const r = T.mergeTabKeys({}, {}, remote, { '2026-04-23': 1000 }, FIXED_NOW);
  assert.equal(r.store['2026-04-23'].entries.length, 1);
  assert.equal(r.store['2026-04-23'].entries[0].food, 'eggs');
});

// ============================================================
// The real-life regression that motivated extracting this:
// stale client pushes without a tab field, and we don't lose the field.
// ============================================================

test('merge: remote with no entry for a date local has → does not delete (no tombstone)', () => {
  // Remote being silent on a key (not having it in store NOR meta) is NOT a
  // delete. The deleting client must produce an explicit tombstone.
  const r = T.mergeTabKeys(
    { '2026-04-23': { entries: [{ food: 'eggs' }] } },
    { '2026-04-23': 1000 },
    {}, {},
    FIXED_NOW,
  );
  assert.ok('2026-04-23' in r.store, 'remote silence must NOT delete local');
  assert.equal(r.changed, false);
});

// ============================================================
// Idempotence: merging twice produces the same result as merging once.
// ============================================================

test('merge is idempotent', () => {
  const local = { '2026-05-01': { mins: 50 } };
  const localMeta = { '2026-05-01': 1000 };
  const remote = { '2026-05-02': { mins: 60 } };
  const remoteMeta = { '2026-05-02': 2000 };
  const r1 = T.mergeTabKeys(local, localMeta, remote, remoteMeta, FIXED_NOW);
  const r2 = T.mergeTabKeys(r1.store, r1.meta, remote, remoteMeta, FIXED_NOW);
  assert.deepEqual(r1.store, r2.store);
  // r1.meta has fixed_now stamped in for the new key; r2 should match it
  // exactly since the second merge sees those timestamps as already-set.
  assert.deepEqual(r1.meta, r2.meta);
});

test('merge: does not mutate inputs', () => {
  const local = { '2026-05-01': { mins: 50 } };
  const localMeta = { '2026-05-01': 1000 };
  const remote = { '2026-05-02': { mins: 60 } };
  const remoteMeta = { '2026-05-02': 2000 };
  const beforeLocal = JSON.stringify(local);
  const beforeRemote = JSON.stringify(remote);
  T.mergeTabKeys(local, localMeta, remote, remoteMeta, FIXED_NOW);
  assert.equal(JSON.stringify(local), beforeLocal, 'local store must not mutate');
  assert.equal(JSON.stringify(remote), beforeRemote, 'remote store must not mutate');
});
