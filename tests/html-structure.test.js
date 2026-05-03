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
  const expected = ['today', 'cardio', 'intervals', 'lifting', 'nutrition', 'weight'];
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

test('css: tabbar uses display:flex (so tabs distribute equally)', () => {
  assert.ok(/\.tabbar\s*\{[\s\S]*?display:\s*flex/.test(html), 'tabbar must be display:flex');
});

test('css: .tab uses flex with shrink-to-zero so 6 tabs always fit', () => {
  // Either flex:1 or flex:1 1 0 is acceptable, both with min-width:0.
  const tabBlockMatch = html.match(/\.tab\s*\{[\s\S]*?\}/);
  assert.ok(tabBlockMatch);
  const block = tabBlockMatch[0];
  assert.ok(/flex:\s*1/.test(block), '.tab must declare flex:1');
  assert.ok(/min-width:\s*0/.test(block), '.tab must declare min-width:0');
});

test('css: tabbar is fixed to the bottom of the viewport', () => {
  // There can be multiple .tabbar blocks (desktop overrides). Find the one
  // that declares position:fixed so we're checking the primary rule.
  const blocks = html.match(/\.tabbar\s*\{[\s\S]*?\}/g) || [];
  const primary = blocks.find(b => /position:\s*fixed/.test(b));
  assert.ok(primary, 'no .tabbar block with position:fixed');
  assert.ok(/bottom:\s*0/.test(primary));
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

test('source files contain zero em dashes', () => {
  const files = ['index.html', 'core.js', 'sw.js'];
  for (const f of files) {
    const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!txt.includes('—'), `${f} contains em dashes`);
  }
});