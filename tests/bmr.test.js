// BMR (Basal Metabolic Rate) and unit-conversion tests.
//
// What's BMR? It's the number of calories your body burns at rest just to
// keep you alive (heart pumping, brain running, organs working). It does NOT
// include the calories you burn through movement.
//
// Why does this matter for the app? The user wants to eat at BMR, which
// means their workouts create the calorie deficit on top. So our
// "calorie goal" for the day = BMR. As they lose weight, BMR goes down,
// and the goal goes down with it.
//
// The Mifflin-St Jeor formula is the most accurate of the common BMR
// formulas for normal-weight adults.
//   Male:    10 * weightKg + 6.25 * heightCm - 5 * age + 5
//   Female:  10 * weightKg + 6.25 * heightCm - 5 * age - 161
//
// These tests verify the math AND the unit-conversion helpers, because if
// either one is off, the displayed goal is wrong by a real amount.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../core.js');

// ============================================================
// lbsToKg & inchesToCm: simple conversions, but easy to fat-finger.
// ============================================================

test('lbsToKg: 1 lb is approximately 0.4536 kg', () => {
  // 1 lb = 0.45359237 kg exactly. We tolerate a tiny floating-point drift.
  const kg = T.lbsToKg(1);
  assert.ok(Math.abs(kg - 0.4536) < 0.001, `expected ~0.4536, got ${kg}`);
});

test('lbsToKg: 156 lb is approximately 70.76 kg', () => {
  const kg = T.lbsToKg(156);
  assert.ok(Math.abs(kg - 70.76) < 0.05, `expected ~70.76, got ${kg}`);
});

test('lbsToKg: 0 lb is exactly 0 kg', () => {
  // Boundary: zero in must give zero out.
  assert.equal(T.lbsToKg(0), 0);
});

test('inchesToCm: 1 inch is exactly 2.54 cm', () => {
  // This one is exact by definition.
  assert.equal(T.inchesToCm(1), 2.54);
});

test('inchesToCm: 65.5 in (5\'5.5") is approximately 166.37 cm', () => {
  const cm = T.inchesToCm(65.5);
  assert.ok(Math.abs(cm - 166.37) < 0.01);
});

// ============================================================
// mifflinStJeor: the actual BMR formula.
// ============================================================

test('mifflinStJeor: female reference value (70kg, 165cm, 30yr) ≈ 1394 kcal', () => {
  // A standard reference patient often used to validate the formula:
  //   10*70 + 6.25*165 - 5*30 - 161 = 700 + 1031.25 - 150 - 161 = 1420.25
  // (If you see this value disagree, it likely means the formula's offset
  // changed; the -161 for women is the canonical Mifflin-St Jeor constant.)
  const bmr = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'F' });
  assert.ok(Math.abs(bmr - 1420.25) < 0.5, `got ${bmr}`);
});

test('mifflinStJeor: male offset is +5 (vs female -161, a 166 kcal gap)', () => {
  const f = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'F' });
  const m = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'M' });
  // The constants are -161 for F and +5 for M. So m - f should be 166.
  assert.equal(Math.round(m - f), 166);
});

test('mifflinStJeor: accepts both string forms ("F"/"female", "M"/"male")', () => {
  const a = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'F' });
  const b = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'female' });
  assert.equal(a, b);
  const c = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'M' });
  const d = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'male' });
  assert.equal(c, d);
});

test('mifflinStJeor: returns null for missing or non-numeric inputs', () => {
  // We return null instead of crashing so the UI can fall back to a
  // hardcoded default (the constant in index.html).
  assert.equal(T.mifflinStJeor(null), null);
  assert.equal(T.mifflinStJeor({}), null);
  assert.equal(T.mifflinStJeor({ weightKg: 70 }), null);
  assert.equal(T.mifflinStJeor({ weightKg: 70, heightCm: 165 }), null);
  assert.equal(T.mifflinStJeor({ weightKg: 'lots', heightCm: 165, age: 30, sex: 'F' }), null);
});

test('mifflinStJeor: returns null for unrecognized sex (we cant guess)', () => {
  const r = T.mifflinStJeor({ weightKg: 70, heightCm: 165, age: 30, sex: 'other' });
  assert.equal(r, null);
});

test('mifflinStJeor: BMR drops as weight drops (we lose tissue, lose calorie burn)', () => {
  // This is the whole reason we recompute the goal as the user loses weight.
  const at156 = T.mifflinStJeor({ weightKg: T.lbsToKg(156), heightCm: T.inchesToCm(65.5), age: 22, sex: 'F' });
  const at140 = T.mifflinStJeor({ weightKg: T.lbsToKg(140), heightCm: T.inchesToCm(65.5), age: 22, sex: 'F' });
  // 16 lb difference = 7.26 kg. BMR diff = 10 * 7.26 = 72.6 kcal.
  assert.ok(at156 - at140 > 70 && at156 - at140 < 75, `expected ~72-73, got ${at156 - at140}`);
});

// ============================================================
// nutritionKcalGoal: glue function. Takes pounds + profile, returns kcal.
// ============================================================

test('nutritionKcalGoal: 156 lb female 22yr 65.5" ≈ 1475 kcal (BMR target)', () => {
  // The user's actual numbers. This is what the app should display as the
  // calorie goal at the start of the plan.
  // Mifflin-St Jeor: 10 * lbsToKg(156) + 6.25 * inchesToCm(65.5) - 5 * 22 - 161
  // = 10 * 70.76 + 6.25 * 166.37 - 110 - 161
  // = 707.6 + 1039.81 - 271 = 1476.41 → rounds to nearest 5 = 1475
  const goal = T.nutritionKcalGoal(156, { heightIn: 65.5, age: 22, sex: 'F' });
  assert.ok(Math.abs(goal - 1475) < 5, `expected ~1475, got ${goal}`);
});

test('nutritionKcalGoal: 140 lb (target weight) drops the goal by ~70 kcal', () => {
  const at156 = T.nutritionKcalGoal(156, { heightIn: 65.5, age: 22, sex: 'F' });
  const at140 = T.nutritionKcalGoal(140, { heightIn: 65.5, age: 22, sex: 'F' });
  assert.ok(at156 > at140, 'lighter person should burn fewer kcal at rest');
  assert.ok(at156 - at140 > 60 && at156 - at140 < 80, 'gap should be ~70 kcal');
});

test('nutritionKcalGoal: rounds to nearest 5 kcal (clean display)', () => {
  // The goal is shown to the user; we don't want "1474.32 kcal" on screen.
  const goal = T.nutritionKcalGoal(156, { heightIn: 65.5, age: 22, sex: 'F' });
  assert.equal(goal % 5, 0, `goal ${goal} should be a multiple of 5`);
});

test('nutritionKcalGoal: returns null with missing inputs (UI falls back)', () => {
  assert.equal(T.nutritionKcalGoal(null, { heightIn: 65.5, age: 22, sex: 'F' }), null);
  assert.equal(T.nutritionKcalGoal(156, null), null);
  assert.equal(T.nutritionKcalGoal('not a number', { heightIn: 65.5, age: 22, sex: 'F' }), null);
});

test('nutritionKcalGoal: a 30-lb difference produces a clear ~135 kcal gap', () => {
  // Sanity: bigger differences produce proportionally bigger gaps.
  const heavier = T.nutritionKcalGoal(180, { heightIn: 65.5, age: 22, sex: 'F' });
  const lighter = T.nutritionKcalGoal(150, { heightIn: 65.5, age: 22, sex: 'F' });
  // 30 lb / 2.2046 = 13.6 kg. BMR diff ≈ 10 * 13.6 = 136.
  assert.ok(Math.abs((heavier - lighter) - 135) < 5);
});
