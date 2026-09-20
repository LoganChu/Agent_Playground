// The fifth filing status, which nothing in this project had ever filed.
//
// A qualifying surviving spouse files an individual return and is handed the
// JOINT rate schedule by § 2(a). That makes "follow the joint column" a good
// default and a bad rule, and until v0.23.0 this package applied it to two
// things it does not fit.
//
// 1. A PER-PERSON exemption is a count of people, and there is one. Illinois,
//    Indiana and Michigan were each giving a widow an exemption for a spouse who
//    is dead.
// 2. VIRGINIA has no surviving-spouse status at all. Form 760 sends a federal
//    head of household or qualifying surviving spouse to Filing Status 1,
//    Single — so the joint standard deduction and the second personal exemption
//    are both unavailable there.
//
// Georgia is the case that shows the default is a judgement rather than an
// oversight: HB 1437 writes "in the case of a married couple filing a joint
// return" against "any other taxpayer", so Georgia's surviving spouse takes the
// single deduction, and this package has said so since v0.15.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const run = (state, filingStatus, opts = {}) =>
  stateIncomeTax({
    state,
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: opts.agi ?? 45_000 },
    earnedIncome: opts.agi ?? 45_000,
    ...opts,
  });

// ---------------------------------------------------------------------------
// One person, one exemption
// ---------------------------------------------------------------------------

test('a per-person exemption counts ONE for a surviving spouse', () => {
  for (const [state, amount] of [
    ['IL', 2_850],
    ['IN', 1_000],
    ['MI', 5_800],
  ]) {
    const def = getStateDefinition(state, 2026);
    const perFiler = def.exemption.perFiler;
    assert.equal(
      perFiler.qualifyingSurvivingSpouse,
      amount,
      `${state} should allow one exemption, not two`,
    );
    assert.equal(perFiler.single, amount, `${state} single`);
    assert.equal(perFiler.marriedFilingJointly, amount * 2, `${state} joint`);
  }
});

test('the exemption a widow was getting for a dead spouse, priced', () => {
  // Same household, same income, the two statuses side by side. The surviving
  // spouse should pay the SINGLE figure's tax on the exemption line.
  for (const [state, exemption, rate] of [
    ['IL', 2_850, 0.0495],
    ['MI', 5_800, 0.0425],
  ]) {
    const survivor = run(state, 'qualifyingSurvivingSpouse').tax;
    const single = run(state, 'single').tax;
    const joint = run(state, 'marriedFilingJointly').tax;
    money(survivor, single, `${state}: a surviving spouse pays what a single filer pays`);
    money(single - joint, exemption * rate, `${state}: and the second exemption is worth this`);
  }
});

// Indiana is its own case, because two fifths of an Indiana bill is the
// county's and the state figure alone understates what the exemption is worth.
test('Indiana prices the second exemption at the COMBINED rate', () => {
  const survivor = run('IN', 'qualifyingSurvivingSpouse', { county: 'Marion' }).totalTax;
  const single = run('IN', 'single', { county: 'Marion' }).totalTax;
  const joint = run('IN', 'marriedFilingJointly', { county: 'Marion' }).totalTax;
  money(survivor, single, 'a surviving spouse pays what a single filer pays');
  // 2.95% state plus Marion County's 2.02%.
  money(single - joint, 1_000 * 0.0497, 'and the exemption is $49.70, not $29.50');
});

// ---------------------------------------------------------------------------
// Virginia has no such status
// ---------------------------------------------------------------------------

test('a Virginia surviving spouse files as SINGLE, on every figure', () => {
  const def = getStateDefinition('VA', 2026);
  assert.equal(def.deduction.amounts.qualifyingSurvivingSpouse, 8_750);
  assert.equal(def.exemption.perFiler.qualifyingSurvivingSpouse, 930);
  // These two already said single before v0.23.0, which is what made the other
  // two an inconsistency rather than a policy.
  assert.equal(def.ageDeduction.threshold.qualifyingSurvivingSpouse, 50_000);

  const survivor = run('VA', 'qualifyingSurvivingSpouse').tax;
  money(survivor, run('VA', 'single').tax, 'the same as a single filer');
  // $8,750 of deduction and $930 of exemption at 5.75%.
  money(run('VA', 'marriedFilingJointly').tax, survivor - (8_750 + 930) * 0.0575, 'joint');
});

// ---------------------------------------------------------------------------
// And where the joint figure IS right
// ---------------------------------------------------------------------------

test('a statutory amount still follows the joint column', () => {
  // Maryland's standard deduction groups "married filing joint, head of
  // household, or qualifying widow(er)" on one line of Form 502, so the joint
  // figure is the right one — and Maryland's per-person exemption already said
  // one, which is the distinction this file is about.
  const md = getStateDefinition('MD', 2026);
  assert.equal(md.deduction.amounts.qualifyingSurvivingSpouse, 6_700, 'the joint deduction');
  assert.equal(md.exemption.perFiler.qualifyingSurvivingSpouse, 3_200, 'but one exemption');
  assert.equal(md.exemption.filersClaimed.qualifyingSurvivingSpouse, 1);
});

test('Georgia gives a surviving spouse the SINGLE standard deduction, by statute', () => {
  const ga = getStateDefinition('GA', 2026);
  assert.equal(ga.deduction.amounts.qualifyingSurvivingSpouse, 15_000);
  assert.equal(ga.deduction.amounts.marriedFilingJointly, 30_000);
  // And the eligible itemizer credit counts one taxpayer for the same reason.
  const credit = (filingStatus) =>
    stateIncomeTax({
      state: 'GA',
      year: 2026,
      filingStatus,
      federal: { adjustedGrossIncome: 100_000, deductionKind: 'itemized' },
    })
      .credits.filter((c) => c.name.toLowerCase().includes('itemizer'))
      .reduce((sum, c) => sum + c.amount, 0);
  money(credit('qualifyingSurvivingSpouse'), 300);
  money(credit('marriedFilingJointly'), 600);
});
