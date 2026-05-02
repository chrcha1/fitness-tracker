// Pure data logic. No DOM, no localStorage, no fetch.
// Importable in Node for tests; exposed on window in the browser.
(function (root) {
  'use strict';

  const TABS = ['cardio', 'weight', 'lifting', 'intervals', 'nutrition'];

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
    const out = { cardio: {}, weight: {}, lifting: {}, intervals: {}, nutrition: {} };
    if (!store || typeof store !== 'object') return out;
    for (const tab of TABS) out[tab] = sanitizeTabMap(store[tab]);
    return out;
  }

  function sanitizeMeta(meta) {
    const out = { cardio: {}, weight: {}, lifting: {}, intervals: {}, nutrition: {} };
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
    // a date. Otherwise a pristine seed like {cardio:{},weight:{},...} would be
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

  // Compute the "logical today" given a cutoff hour.
  // If the current local hour is before cutoffHour, return yesterday's date,
  // so logging at 1 AM goes into the previous calendar day's bucket.
  // Returns a Date set to local midnight.
  function logicalToday(now, cutoffHour) {
    if (cutoffHour == null) cutoffHour = 0;
    const out = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() < cutoffHour) out.setDate(out.getDate() - 1);
    return out;
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

  // Returns true if the user logged anything for the given tab on the given key.
  // For weight, requires at least one of am/pm to be a number.
  function dayHasContent(tab, entry) {
    if (!entry) return false;
    if (tab === 'weight') {
      return typeof entry.am === 'number' || typeof entry.pm === 'number';
    }
    if (tab === 'lifting') {
      return Array.isArray(entry.tags) && entry.tags.length > 0;
    }
    if (tab === 'nutrition') {
      return Array.isArray(entry.entries) && entry.entries.length > 0;
    }
    return true; // cardio, intervals: presence of the key counts
  }

  // Sum macros across a single day's nutrition entries. Returns zeros if empty.
  function nutritionDayTotals(entry) {
    const out = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    if (!entry || !Array.isArray(entry.entries)) return out;
    for (const e of entry.entries) {
      const m = e && e.macros;
      if (!m) continue;
      if (typeof m.calories === 'number') out.calories += m.calories;
      if (typeof m.protein_g === 'number') out.protein_g += m.protein_g;
      if (typeof m.carbs_g === 'number') out.carbs_g += m.carbs_g;
      if (typeof m.fat_g === 'number') out.fat_g += m.fat_g;
    }
    return out;
  }

  // Generate a stable id for a new nutrition entry: n_<dateKey>_<rand>
  function newNutritionEntryId(dateKey) {
    const r = Math.random().toString(36).slice(2, 8);
    return `n_${dateKey}_${r}`;
  }

  // Iterate dates from `today` backwards; useful for streak math.
  function* daysBackFrom(today) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    while (true) {
      yield new Date(d);
      d.setDate(d.getDate() - 1);
    }
  }

  // currentStreak: longest run of "complete" days ending at or just before today.
  // mode: 'daily' = consecutive days; 'weekly' = consecutive weeks (Sun-Sat) with ≥1 entry.
  // shieldsPerWeek: how many missed days/weeks to forgive per 7-day window (auto-applied).
  // Returns { length, shieldsUsed: [keys] }.
  function currentStreak(tab, tabMap, today, opts) {
    opts = opts || {};
    const mode = opts.mode || 'daily';
    const shieldsPerWeek = opts.shieldsPerWeek != null ? opts.shieldsPerWeek : 0;
    const clean = sanitizeTabMap(tabMap);

    if (mode === 'weekly') {
      // A "week unit" = the Sunday→Saturday week containing the date.
      const weekStart = (d) => {
        const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        out.setDate(out.getDate() - out.getDay());
        return out;
      };
      const weekHasEntry = (sun) => {
        for (let i = 0; i < 7; i++) {
          const d = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i);
          if (dayHasContent(tab, clean[fmtKey(d)])) return true;
        }
        return false;
      };
      let length = 0;
      let cursor = weekStart(today);
      let shieldsUsed = 0;
      const used = [];
      // Don't penalize the current incomplete week. Start counting at "this week
      // OR last week" depending on whether this week has an entry.
      if (!weekHasEntry(cursor)) cursor.setDate(cursor.getDate() - 7);
      while (true) {
        if (weekHasEntry(cursor)) {
          length++;
          cursor.setDate(cursor.getDate() - 7);
          continue;
        }
        if (shieldsUsed < Math.max(0, shieldsPerWeek)) {
          shieldsUsed++;
          used.push(fmtKey(cursor));
          length++;
          cursor.setDate(cursor.getDate() - 7);
          continue;
        }
        break;
      }
      return { length, shieldsUsed: used };
    }

    // Daily mode.
    let length = 0;
    let shieldsUsedThisWindow = 0;
    let windowStartIdx = 0;
    let idx = 0;
    const used = [];
    // Don't penalize the user for "today not yet logged". If today is empty,
    // start the chain at yesterday.
    const it = daysBackFrom(today);
    let first = it.next().value;
    if (!dayHasContent(tab, clean[fmtKey(first)])) {
      first = it.next().value;
      idx++;
      windowStartIdx++;
    }
    let cur = first;
    while (true) {
      if (dayHasContent(tab, clean[fmtKey(cur)])) {
        length++;
      } else {
        // Reset shield-per-week window if we've moved past 7 days.
        if (idx - windowStartIdx >= 7) {
          shieldsUsedThisWindow = 0;
          windowStartIdx = idx;
        }
        if (shieldsUsedThisWindow < Math.max(0, shieldsPerWeek)) {
          shieldsUsedThisWindow++;
          used.push(fmtKey(cur));
          length++;
        } else {
          break;
        }
      }
      cur = it.next().value;
      idx++;
      if (idx > 730) break; // hard cap, ~2 years
    }
    return { length, shieldsUsed: used };
  }

  // Compare current 7-day window to the previous 7 days.
  // metricFn(entry) returns a number; defaults to 1 (count of days with content).
  function trendDelta(tab, tabMap, today, opts) {
    opts = opts || {};
    const metric = opts.metric || ((tab, entry) => dayHasContent(tab, entry) ? 1 : 0);
    const clean = sanitizeTabMap(tabMap);
    const sumWindow = (offset) => {
      let s = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset - i);
        s += metric(tab, clean[fmtKey(d)]);
      }
      return s;
    };
    const current = sumWindow(0);
    const previous = sumWindow(7);
    return { current, previous, delta: current - previous };
  }

  // Daily values for a sparkline. days = window length, default 14.
  // valueFn(entry) → number; default = 1 if has content, 0 otherwise.
  // Returns { values: number[], min, max } with values ordered oldest→newest.
  function sparklineSeries(tab, tabMap, today, opts) {
    opts = opts || {};
    const days = opts.days || 14;
    const valueFn = opts.value || ((tab, entry) => dayHasContent(tab, entry) ? 1 : 0);
    const clean = sanitizeTabMap(tabMap);
    const values = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      values.push(valueFn(tab, clean[fmtKey(d)]));
    }
    let min = Infinity, max = -Infinity;
    for (const v of values) {
      if (typeof v === 'number') {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 0;
    return { values, min, max };
  }

  // Decide what tapping a calendar/today cell should do.
  // Returns one of: 'mark-empty' (write {mins:null} for today),
  //                 'open-editor' (open the per-tab editor),
  // The full handleShortTap branching collapsed to one pure call so it can be tested.
  function decideTapAction(tab, key, todayKey, hasEntry) {
    if (tab === 'cardio' || tab === 'intervals') {
      if (hasEntry) return 'open-editor';
      if (key === todayKey) return 'mark-empty';
      return 'open-editor';
    }
    return 'open-editor'; // weight, lifting, nutrition all open the editor
  }

  // Average AM/PM for a single weight entry, or null if neither set.
  function weightAvg(entry) {
    if (!entry) return null;
    const vs = [entry.am, entry.pm].filter((x) => typeof x === 'number');
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
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
    logicalToday,
    nextSaturday,
    weeklyWeightGoal,
    weightGoalSchedule,
    weightSeries,
    dayHasContent,
    currentStreak,
    trendDelta,
    sparklineSeries,
    weightAvg,
    decideTapAction,
    nutritionDayTotals,
    newNutritionEntryId,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TrackCore;
  else root.TrackCore = TrackCore;
})(typeof window !== 'undefined' ? window : globalThis);
