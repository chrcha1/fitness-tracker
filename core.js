// Pure data logic — no DOM, no localStorage, no fetch.
// Importable in Node for tests; exposed on window in the browser.
(function (root) {
  'use strict';

  const TABS = ['cardio', 'weight', 'lifting', 'intervals'];

  function isDateKey(k) {
    if (typeof k !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
    const [y, m, d] = k.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    return true;
  }

  // Strip any keys that aren't valid date strings. This is what catches the
  // phantom tab-name keys ("cardio","weight",…) that a buggy migration left
  // nested inside store.cardio in the gist.
  function sanitizeTabMap(map) {
    const out = {};
    if (!map || typeof map !== 'object') return out;
    for (const k of Object.keys(map)) {
      if (isDateKey(k)) out[k] = map[k];
    }
    return out;
  }

  function sanitizeStore(store) {
    const out = { cardio: {}, weight: {}, lifting: {}, intervals: {} };
    if (!store || typeof store !== 'object') return out;
    for (const tab of TABS) out[tab] = sanitizeTabMap(store[tab]);
    return out;
  }

  function sanitizeMeta(meta) {
    const out = { cardio: {}, weight: {}, lifting: {}, intervals: {} };
    if (!meta || typeof meta !== 'object') return out;
    for (const tab of TABS) out[tab] = sanitizeTabMap(meta[tab]);
    return out;
  }

  // True if a sanitize pass changed anything in store or meta.
  function needsRepair(store, meta) {
    const before = JSON.stringify({ store, meta });
    const after = JSON.stringify({
      store: sanitizeStore(store),
      meta: sanitizeMeta(meta),
    });
    return before !== after;
  }

  function countSessions(tabMap) {
    return Object.keys(sanitizeTabMap(tabMap)).length;
  }

  // Parse a gist file body into the canonical { store, meta, deadline } shape.
  // Handles every legacy shape we've ever written, never throws.
  function parseGistContent(content) {
    const empty = {
      store: { cardio: {}, weight: {}, lifting: {}, intervals: {} },
      meta:  { cardio: {}, weight: {}, lifting: {}, intervals: {} },
      deadline: null,
    };
    let parsed;
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (_) { return empty; }
    if (!parsed || typeof parsed !== 'object') return empty;

    // New shape (v3): { store, meta, deadline }
    if (parsed.store && typeof parsed.store === 'object') {
      return {
        store: sanitizeStore(parsed.store),
        meta: sanitizeMeta(parsed.meta),
        deadline: parsed.deadline || null,
      };
    }

    // v2: { data: { ...cardio map }, meta: { ...cardio meta }, deadline }
    if (parsed.data && typeof parsed.data === 'object') {
      return {
        store: sanitizeStore({ cardio: parsed.data }),
        meta: sanitizeMeta({ cardio: parsed.meta }),
        deadline: parsed.deadline || null,
      };
    }

    // v1: a bare cardio map. Only treat as such if at least one key looks like
    // a date — otherwise a pristine seed like {cardio:{},weight:{},…} would be
    // mistaken for cardio data and cause the bug we're trying to prevent.
    const looksLikeCardioMap = Object.keys(parsed).some(isDateKey);
    if (looksLikeCardioMap) {
      return {
        store: sanitizeStore({ cardio: parsed }),
        meta: { cardio: {}, weight: {}, lifting: {}, intervals: {} },
        deadline: null,
      };
    }

    return empty;
  }

  // Format a Date as YYYY-MM-DD in local time.
  function fmtKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Find the next Saturday on or after a given date (local time).
  function nextSaturday(d) {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = out.getDay(); // 0=Sun … 6=Sat
    const delta = (6 - dow + 7) % 7;
    out.setDate(out.getDate() + delta);
    return out;
  }

  // Weekly weight goal trajectory. Goal drops by stepLb every weekly checkpoint
  // (default Saturday) starting from startSat. Floors at targetWeight.
  // Returns null for dates before startSat.
  function weeklyWeightGoal(date, startSat, startWeight, targetWeight, stepLb) {
    if (stepLb == null) stepLb = 1;
    if (date < startSat) return null;
    const weeksOut = Math.floor((date - startSat) / (7 * 86400000));
    const goal = startWeight - weeksOut * stepLb;
    return Math.max(targetWeight, goal);
  }

  // Build the full schedule of Saturday checkpoints from startSat down to target.
  function weightGoalSchedule(startSat, startWeight, targetWeight, stepLb) {
    if (stepLb == null) stepLb = 1;
    const schedule = [];
    let w = startWeight;
    let d = new Date(startSat.getFullYear(), startSat.getMonth(), startSat.getDate());
    let safety = 0;
    while (w >= targetWeight && safety++ < 520) { // hard cap of ~10 years
      schedule.push({ date: new Date(d), weight: w });
      if (w === targetWeight) break;
      w = Math.max(targetWeight, w - stepLb);
      d.setDate(d.getDate() + 7);
    }
    return schedule;
  }

  // Daily averaged weight series for charting. Returns sorted [{date, key, weight}].
  function weightSeries(weightStore) {
    const out = [];
    const clean = sanitizeTabMap(weightStore);
    for (const key of Object.keys(clean).sort()) {
      const v = clean[key] || {};
      const vals = [v.am, v.pm].filter((x) => typeof x === 'number');
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      out.push({ key, date: parseDate(key), weight: avg });
    }
    return out;
  }

  const TrackCore = {
    TABS,
    isDateKey,
    sanitizeTabMap,
    sanitizeStore,
    sanitizeMeta,
    needsRepair,
    countSessions,
    parseGistContent,
    fmtKey,
    parseDate,
    nextSaturday,
    weeklyWeightGoal,
    weightGoalSchedule,
    weightSeries,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TrackCore;
  else root.TrackCore = TrackCore;
})(typeof window !== 'undefined' ? window : globalThis);
