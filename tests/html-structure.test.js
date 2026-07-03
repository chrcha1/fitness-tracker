// Static HTML structure tests. No DOM required: read the file, regex for
// expected anchors. These catch entire categories of bugs you can only see
// on a phone otherwise (missing tab, bad data-tab, wrong order).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ============================================================
// Tab bar invariants.
// ============================================================

test('html: tabbar contains exactly 6 tab buttons', () => {
  const matches = html.match(/<button class="tab"\s+data-tab="[^"]+"/g) || [];
  assert.equal(matches.length, 6, `expected 6 tab buttons, got ${matches.length}`);
});

test('html: tab buttons appear in the canonical order', () => {
  const expected = ['today', 'cardio', 'intervals', 'lifting', 'weight', 'nutrition'];
  const found = [];
  const re = /<button class="tab"\s+data-tab="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) found.push(m[1]);
  assert.deepEqual(found, expected, 'tab order must match canonical sequence');
});

test('html: every tab has an SVG icon and a label', () => {
  // Locate the <nav class="tabbar">...</nav> block and check each button.
  const navMatch = html.match(/<nav class="tabbar">[\s\S]*?<\/nav>/);
  assert.ok(navMatch, 'must have a <nav class="tabbar">');
  const nav = navMatch[0];
  const buttons = nav.match(/<button class="tab"[\s\S]*?<\/button>/g) || [];
  for (const btn of buttons) {
    assert.ok(/<svg[\s\S]*?<\/svg>/.test(btn), `tab missing SVG: ${btn.slice(0, 80)}`);
    assert.ok(/<span class="tab-label">[^<]+<\/span>/.test(btn), `tab missing label: ${btn.slice(0, 80)}`);
  }
});

test('html: exactly one tab is data-active="true" (the default)', () => {
  const navMatch = html.match(/<nav class="tabbar">[\s\S]*?<\/nav>/);
  const nav = navMatch[0];
  const trueCount = (nav.match(/data-active="true"/g) || []).length;
  assert.equal(trueCount, 1, 'exactly one tab should be active by default');
});

test('html: the default-active tab matches body[data-tab="..."]', () => {
  const navMatch = html.match(/<nav class="tabbar">[\s\S]*?<\/nav>/);
  const activeMatch = navMatch[0].match(/data-tab="([^"]+)"\s+data-active="true"/);
  const bodyMatch = html.match(/<body[^>]+data-tab="([^"]+)"/);
  assert.ok(activeMatch && bodyMatch);
  assert.equal(activeMatch[1], bodyMatch[1], 'tab and body must agree on the default tab');
});

// ============================================================
// View invariants. Every tab must have a view div with id="view-<tab>".
// ============================================================

test('html: every tab has a corresponding view-<tab> div', () => {
  const expected = ['today', 'cardio', 'intervals', 'lifting', 'nutrition', 'weight'];
  for (const tab of expected) {
    const re = new RegExp(`<div class="view[^"]*"\\s+id="view-${tab}"`);
    assert.ok(re.test(html), `missing <div id="view-${tab}">`);
  }
});

test('html: exactly one view has class="view active" (the landing view)', () => {
  // A second active view would render two views simultaneously.
  const matches = html.match(/<div class="view active"\s+id="view-[^"]+"/g) || [];
  assert.equal(matches.length, 1, 'exactly one default-active view');
});

// ============================================================
// JS routing must include every tab.
// ============================================================

test('js: setTab valid tab list contains all 6 tabs', () => {
  // Find the line where setTab gates valid tabs.
  const m = html.match(/if\s*\(!\[([^\]]+)\]\.includes\(tab\)\)\s*tab\s*=\s*'today'/);
  assert.ok(m, 'expected the setTab valid-tab guard');
  const list = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  for (const tab of ['today','cardio','intervals','lifting','nutrition','weight']) {
    assert.ok(list.includes(tab), `setTab guard missing ${tab}`);
  }
});

test('js: render dispatcher handles all 6 tabs', () => {
  for (const tab of ['today','cardio','intervals','lifting','nutrition','weight']) {
    const re = new RegExp(`currentTab === '${tab}'`);
    assert.ok(re.test(html), `render dispatcher missing branch for ${tab}`);
  }
});

test('js: titles map covers all 6 tabs', () => {
  const m = html.match(/const titles\s*=\s*\{([^}]+)\}/);
  assert.ok(m, 'expected titles map');
  const block = m[1];
  for (const tab of ['today','cardio','intervals','lifting','nutrition','weight']) {
    assert.ok(new RegExp(`${tab}:`).test(block), `titles map missing ${tab}`);
  }
});

// ============================================================
// CSS tabbar layout invariants. Catches accidental width / overflow regressions.
// ============================================================

test('css: tabbar distributes tabs equally (grid or flex)', () => {
  const blocks = html.match(/\.tabbar\s*\{[\s\S]*?\}/g) || [];
  const primary = blocks.find(b => /position:\s*fixed/.test(b));
  assert.ok(primary, 'no .tabbar block with position:fixed');
  const equalGrid = /display:\s*grid/.test(primary) && /grid-template-columns:\s*repeat\(\s*\d+\s*,\s*1fr\s*\)/.test(primary);
  const equalFlex = /display:\s*flex/.test(primary);
  assert.ok(equalGrid || equalFlex, 'tabbar must lay out tabs with equal-width grid columns or flex');
});

test('css: tabs cannot overflow the tabbar width', () => {
  const blocks = html.match(/\.tabbar\s*\{[\s\S]*?\}/g) || [];
  const primary = blocks.find(b => /position:\s*fixed/.test(b));
  assert.ok(primary, 'no .tabbar block with position:fixed');
  if (/display:\s*grid/.test(primary)) {
    // repeat(N, 1fr) columns cannot overflow; just confirm it's declared.
    assert.ok(/grid-template-columns:\s*repeat\(\s*\d+\s*,\s*1fr\s*\)/.test(primary),
      'grid tabbar must use repeat(N, 1fr) columns');
  } else {
    // Flex layout needs shrink-to-zero tabs to guarantee fit.
    const tabBlockMatch = html.match(/\.tab\s*\{[\s\S]*?\}/);
    assert.ok(tabBlockMatch);
    assert.ok(/flex:\s*1/.test(tabBlockMatch[0]), '.tab must declare flex:1');
    assert.ok(/min-width:\s*0/.test(tabBlockMatch[0]), '.tab must declare min-width:0');
  }
});

test('css: tabbar is fixed to the bottom of the viewport', () => {
  // There can be multiple .tabbar blocks (desktop overrides). Find the one
  // that declares position:fixed so we're checking the primary rule.
  const blocks = html.match(/\.tabbar\s*\{[\s\S]*?\}/g) || [];
  const primary = blocks.find(b => /position:\s*fixed/.test(b));
  assert.ok(primary, 'no .tabbar block with position:fixed');
  // Accept flush-to-edge (bottom: 0) or a floating safe-area dock
  // (bottom: max(env(safe-area-inset-bottom), NNpx)).
  assert.ok(/bottom:\s*(0|max\(env\(safe-area-inset-bottom\))/.test(primary),
    'tabbar must anchor to the viewport bottom (0 or safe-area max())');
});

// ============================================================
// Service worker bookkeeping.
// ============================================================

test('sw.js: cache name follows track-vN convention so versions are bumpable', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/const CACHE\s*=\s*'track-v\d+'/.test(sw), 'CACHE must be track-v<N>');
});

test('sw.js: install hook registers ASSETS including index.html and core.js', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/index\.html/.test(sw));
  assert.ok(/core\.js/.test(sw));
});

test('sw.js: install hook calls skipWaiting (so updates take effect immediately)', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/skipWaiting/.test(sw), 'SW must skipWaiting on install for fast rollout');
});

test('sw.js: activate hook calls clients.claim()', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/clients\.claim/.test(sw));
});

test('sw.js: bypasses api.github.com so sync hits live data', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/api\.github\.com/.test(sw));
});

// ============================================================
// Modality cards on the Today tab match the tab list (no card without a tab,
// no tab without a card).
// ============================================================

test('html: Today tab has a modality card for every modal tab', () => {
  // Modal tabs exclude 'today' itself.
  const modal = ['cardio','intervals','lifting','nutrition','weight'];
  for (const tab of modal) {
    const re = new RegExp(`<div class="modality-card"\\s+data-modality="${tab}"`);
    assert.ok(re.test(html), `Today tab missing modality-card for ${tab}`);
  }
});

test('html: every modality-card has a status element', () => {
  const modal = ['cardio','intervals','lifting','nutrition','weight'];
  for (const tab of modal) {
    const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
    const re = new RegExp(`id="todayStatus${cap}"`);
    assert.ok(re.test(html), `missing #todayStatus${cap}`);
  }
});

// ============================================================
// Em-dash ban (catches any new ones that slip in).
// ============================================================

// ============================================================
// Today tab is the default landing surface and must give the user a path
// to every other tab. The next block of tests asserts that everything is
// accessible from Today: each modality has a card, each card has wired
// handlers (click/tap routes), and there's no orphan modality whose only
// access path is the bottom tabbar.
// ============================================================

test('today: every modal tab has a corresponding modality-card on Today', () => {
  // Five modal tabs (everything except Today itself) each get a card.
  for (const tab of ['cardio','intervals','lifting','nutrition','weight']) {
    const re = new RegExp(`<div class="modality-card"\\s+data-modality="${tab}"\\s+id="todayCard${tab.charAt(0).toUpperCase()}${tab.slice(1)}"`);
    assert.ok(re.test(html), `Today tab missing modality-card for ${tab}`);
  }
});

test('today: every modality-card has a status text element with a stable id', () => {
  // The id pattern `todayStatus<Tab>` is what render code targets to
  // update the live status copy ("Done · 50 min", "Mark today complete").
  for (const tab of ['cardio','intervals','lifting','nutrition','weight']) {
    const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
    assert.ok(new RegExp(`id="todayStatus${cap}"`).test(html), `missing #todayStatus${cap}`);
  }
});

test('today: every modality-card has a closure ring (svg + ring-bg + ring-fg)', () => {
  // The ring is what tells the user at a glance whether they did the thing.
  // Each card needs the SVG with both background circle and foreground
  // (animated) circle.
  const cards = html.match(/<div class="modality-card"[\s\S]*?<\/div>/g) || [];
  assert.ok(cards.length >= 5, `expected 5+ modality cards, got ${cards.length}`);
  for (const card of cards) {
    assert.ok(/<svg[\s\S]*?<\/svg>/.test(card), `card missing SVG: ${card.slice(0, 60)}`);
    assert.ok(/class="ring-bg"/.test(card), 'card missing ring-bg');
    assert.ok(/class="ring-fg"/.test(card), 'card missing ring-fg');
    assert.ok(/class="ring-check"/.test(card), 'card missing ring-check (checkmark icon shown when done)');
  }
});

test('today: tap-handler loop iterates every modal tab (so no card is dead)', () => {
  // The render code attaches tap+long-press handlers in a `for (const tab
  // of [...]) { ... }` loop. The loop list must include all modal tabs.
  const m = html.match(/for \(const tab of \[([^\]]+)\]\) \{[\s\S]*?todayCard/);
  assert.ok(m, 'expected the modality-card handler loop');
  const list = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    assert.ok(list.includes(tab), `card handler loop missing ${tab}`);
  }
});

test('today: 7-day completion strip iterates every modal tab for dots', () => {
  // The dot-coloring loop on the today week-strip must also hit every tab,
  // otherwise certain modalities would never get their colored dot on that
  // mini-grid.
  const m = html.match(/for \(const tab of \[([^\]]+)\]\)[\s\S]*?week-cell-dot/);
  assert.ok(m, 'expected week-cell dots iteration');
  const list = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    assert.ok(list.includes(tab), `week-cell dots loop missing ${tab}`);
  }
});

test('today: each modality dot color rule exists in CSS', () => {
  // If we add a tab to the dot loop but forget the .week-cell-dot.X rule,
  // the dot renders invisible. Lock that here too.
  for (const tab of ['cardio','intervals','lifting','weight','nutrition']) {
    assert.ok(new RegExp(`\\.week-cell-dot\\.${tab}`).test(html),
      `missing CSS for .week-cell-dot.${tab}`);
  }
});

test('today: greeting greet/sub elements both exist for time-of-day copy', () => {
  // The render reads these by id and they need to be present.
  assert.ok(/id="todayGreetDate"/.test(html));
  assert.ok(/id="todayGreetText"/.test(html));
  assert.ok(/id="todayGreetSub"/.test(html));
});

test('today: weekly summary container exists (toggled visible on Sun/Mon)', () => {
  assert.ok(/id="todayWeeklySummary"/.test(html));
});

// ============================================================
// Cross-device sync freshness. The user expects edits on their laptop to
// reach their phone (and vice-versa) without manual refresh. We verify
// that the page registers all the right pull triggers.
// ============================================================

test('sync: pulls from gist on initial load', () => {
  // The boot sequence kicks off a gistPull() once at startup if syncConfig
  // exists. Find that pattern.
  assert.ok(/gistPull\(\)\.then/.test(html), 'expected initial gistPull on boot');
});

test('sync: pulls when window gains focus', () => {
  // Switching tabs back to the app, or returning to it from another window,
  // should trigger a fresh pull.
  assert.ok(/window\.addEventListener\('focus'[\s\S]*?gistPull\(\)/.test(html),
    'expected window focus listener to call gistPull');
});

test('sync: pulls on visibilitychange (iOS PWA returning from background)', () => {
  // iOS PWAs don't always fire 'focus' when returning from backgrounded
  // state. visibilitychange covers that case.
  assert.ok(/visibilitychange[\s\S]*?gistPull\(\)/.test(html),
    'expected visibilitychange listener to call gistPull');
});

test('sync: background polling interval is set (so updates appear within ~30s)', () => {
  // setInterval that calls gistPull periodically. We check for the
  // setInterval call near a gistPull reference and a 30000ms timeout.
  assert.ok(/setInterval\([\s\S]*?gistPull[\s\S]*?\d{4,5}\)/.test(html),
    'expected setInterval polling that calls gistPull every ~30s');
});

// ============================================================
// Tab → view → render dispatch must be coherent end-to-end.
// ============================================================

test('coherence: every tab id has a matching view-id, render branch, and title entry', () => {
  // This catches the common mistake of adding a tab in one place and
  // forgetting to wire any of the other three.
  const tabs = ['today','cardio','intervals','lifting','nutrition','weight'];
  for (const tab of tabs) {
    // 1. tab button
    assert.ok(new RegExp(`<button class="tab"\\s+data-tab="${tab}"`).test(html),
      `tab button missing for ${tab}`);
    // 2. view-<tab> div
    assert.ok(new RegExp(`<div class="view[^"]*"\\s+id="view-${tab}"`).test(html),
      `view-${tab} div missing`);
    // 3. render dispatcher branch
    assert.ok(new RegExp(`currentTab === '${tab}'`).test(html),
      `render dispatcher missing branch for ${tab}`);
    // 4. titles map entry
    assert.ok(new RegExp(`${tab}:\\s*['"]`).test(html),
      `titles map missing entry for ${tab}`);
  }
});

// ============================================================
// Touch and mouse interaction parity. The app must work on iOS Safari
// (touch) AND on a laptop browser (mouse). Most interactive elements
// should accept both kinds of events.
// ============================================================

test('touch: primary interactive surfaces wire both touch and mouse', () => {
  // The three primary interactive surfaces (modality cards, day cells, today
  // buttons) must work on both iPhone (touch) and laptop (mouse). We find
  // each function declaration and grab a generous slab of source after it
  // to confirm both event families are wired.
  // Day cells use a single delegated listener set per calendar container
  // (delegateDayInteractions) rather than per-cell listeners.
  const requiredFunctions = ['delegateDayInteractions', 'attachTodayBtn'];
  for (const fn of requiredFunctions) {
    const idx = html.indexOf(`function ${fn}`);
    assert.ok(idx >= 0, `couldn't find function ${fn}`);
    // Grab the next ~3000 chars: enough to fit the whole function body.
    const slab = html.slice(idx, idx + 3000);
    assert.ok(/addEventListener\('touchstart'/.test(slab), `${fn} missing touchstart`);
    assert.ok(/addEventListener\('mousedown'/.test(slab), `${fn} missing mousedown (laptop)`);
    assert.ok(/addEventListener\('touchend'/.test(slab), `${fn} missing touchend`);
    assert.ok(/addEventListener\('mouseup'/.test(slab), `${fn} missing mouseup (laptop)`);
  }
});

test('touch: every touchend surface attaches a touchcancel cleanup too', () => {
  // touchcancel fires when iOS interrupts a touch (e.g. system gesture or
  // call). Without a touchcancel handler, state can get stuck (long-press
  // timer never clears). Scan the source for parity.
  const blocks = html.split(/\n/);
  const touchendLines = [];
  for (let i = 0; i < blocks.length; i++) {
    if (/addEventListener\('touchend'/.test(blocks[i])) touchendLines.push(i);
  }
  for (const i of touchendLines) {
    const window = blocks.slice(i, Math.min(blocks.length, i + 5)).join('\n');
    assert.ok(/addEventListener\('touchcancel'/.test(window),
      `touchend at line ${i + 1} has no nearby touchcancel (state can stick on iOS interruption)`);
  }
});

// ============================================================
// Em dash ban (still active).
// ============================================================

test('source files contain zero em dashes', () => {
  const files = ['index.html', 'core.js', 'sw.js'];
  for (const f of files) {
    const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!txt.includes('—'), `${f} contains em dashes`);
  }
});