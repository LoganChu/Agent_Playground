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
    ['IL', 2_925],
    ['IN', 1_000],
    ['MI', 5_900],
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
    ['IL', 2_925, 0.0495],
    ['MI', 5_900, 0.0425],
  ]) {
    const survivor = run(state, 'qualifyingSurvivingSpouse').tax;
    const single = run(state, 'single').tax;
    const joint = run(state, 'marriedFilingJointly').tax;
    money(survivor, single, `${state}: a surviving spouse pays what a single filer pays`);
    // Within a cent, not to the cent. The engine rounds each RETURN's tax, so a
    // difference of two rounded figures can sit a cent away from the unrounded
    // product: Illinois's $2,925 at 4.95% is $144.7875, and the two returns
    // differ by $144.78. Asserting the exact cent here would be asserting the
    // order of two roundings, which is not the claim. (Illinois's exemption
    // became $2,925 in v0.25.0, published, from the $2,850 this package had
    // been carrying forward from 2025.)
    assert.ok(
      Math.abs(single - joint - exemption * rate) <= 0.01,
      `${state}: the second exemption should be worth ${exemption} x ${rate}, ` +
        `and the two returns differ by ${single - joint}`,
    );
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

// ---------------------------------------------------------------------------
// v0.24.0: a one-person return cannot hold two blind people.
//
// v0.23.0 fixed the per-person EXEMPTION and left the per-person CONDITION,
// which is the same fact counted by a different helper. `filerCount()` says a
// qualifying surviving spouse is two filers — and for an AMOUNT that is often
// right, because most state returns put the status in the joint column and
// California's Form 540 goes as far as to say so about the count itself
// ("If you checked box 2 or 5, enter 2" on line 7, box 5 being this status).
//
// For a COUNT OF PEOPLE it is never right. The spouse is dead: they cannot be
// blind and they cannot turn 65. So `livingFilerCount()` now caps every
// condition, and the two helpers are kept apart rather than reconciled,
// because reconciling them would mean deciding California's personal exemption
// credit against the FTB's own instruction.
//
// THE RULE: when one fact is counted by two helpers, the bug is not that they
// disagree — it is that nothing says which question each one answers. Day 26
// found the first half of this and the second half was invisible, because it
// takes a caller who passes `blindOrDisabled: 2`, which is exactly what a
// caller who believes the status implies two filers would pass.
// ---------------------------------------------------------------------------

/** Every state whose engine reads `blindOrDisabled`, with what one claim is worth. */
const BLIND_ALLOWANCE_STATES = ['CA', 'MI', 'MS', 'IL', 'IN', 'NJ'];

const withBlind = (state, filingStatus, blindOrDisabled) =>
  stateIncomeTax({
    state,
    year: 2026,
    filingStatus,
    filerAge: 70,
    federal: { adjustedGrossIncome: 60_000, taxableIncome: 45_000, socialSecurityBenefits: 0 },
    wages: 60_000,
    newJerseyGrossIncome: 60_000,
    blindOrDisabled,
  }).totalTax;

test('a second blind claim is worth nothing on a surviving spouse’s return', () => {
  for (const state of BLIND_ALLOWANCE_STATES) {
    const one = withBlind(state, 'qualifyingSurvivingSpouse', 1);
    const two = withBlind(state, 'qualifyingSurvivingSpouse', 2);
    money(two, one, `${state}: a widow was allowed a second blind allowance`);

    // The cap is the only thing that moved. A single filer was already capped
    // at one and a joint return still gets two, so this is not "blindness now
    // counts once".
    money(
      withBlind(state, 'single', 2),
      withBlind(state, 'single', 1),
      `${state}: a single filer's cap changed`,
    );
    assert.ok(
      withBlind(state, 'marriedFilingJointly', 2) < withBlind(state, 'marriedFilingJointly', 1),
      `${state}: a joint return lost its second blind allowance`,
    );
  }
});

test('and the first blind claim is still worth the state’s own figure', () => {
  // California's is a CREDIT of $153, so it is worth $153 of tax at any rate.
  // Michigan's $3,400 exemption at 4.25% is $144.50, and Mississippi's $1,500
  // at 4.0% is $60. Asserting these is what stops the cap above being
  // satisfied by an engine that has stopped counting blindness at all.
  money(
    withBlind('CA', 'qualifyingSurvivingSpouse', 0) -
      withBlind('CA', 'qualifyingSurvivingSpouse', 1),
    153,
    'California exemption credit',
  );
  money(
    withBlind('MI', 'qualifyingSurvivingSpouse', 0) -
      withBlind('MI', 'qualifyingSurvivingSpouse', 1),
    144.5,
    'Michigan special exemption',
  );
  money(
    withBlind('MS', 'qualifyingSurvivingSpouse', 0) -
      withBlind('MS', 'qualifyingSurvivingSpouse', 1),
    60,
    'Mississippi exemption',
  );
});

test('a spouseAge on a surviving spouse’s return buys no second senior allowance', () => {
  // The same defect through the other helper: `seniorFilers` read `spouseAge`
  // whenever the filer count was two. A caller who supplies it for this status
  // has made a mistake — there is no spouse — and the engine was charging the
  // state for it.
  for (const state of ['CA', 'MS', 'IL', 'IN']) {
    const alone = stateIncomeTax({
      state,
      year: 2026,
      filingStatus: 'qualifyingSurvivingSpouse',
      filerAge: 70,
      federal: { adjustedGrossIncome: 60_000, taxableIncome: 45_000, socialSecurityBenefits: 0 },
      wages: 60_000,
    }).totalTax;
    const withGhost = stateIncomeTax({
      state,
      year: 2026,
      filingStatus: 'qualifyingSurvivingSpouse',
      filerAge: 70,
      spouseAge: 70,
      federal: { adjustedGrossIncome: 60_000, taxableIncome: 45_000, socialSecurityBenefits: 0 },
      wages: 60_000,
    }).totalTax;
    money(withGhost, alone, `${state}: a dead spouse's age was counted`);
  }
});

// ---------------------------------------------------------------------------
// v0.25.0: Illinois takes the exemption allowance away at $250,000, and a
// widow is an "other return".
//
// 35 ILCS 5/204(g) disallows the allowance ENTIRELY — it is a cliff, not a
// taper — above $500,000 "for returns with a federal filing status of married
// filing jointly, or $250,000 for all other returns". `byStatus()` defaults a
// qualifying surviving spouse to the joint figure, so this package let a widow
// keep an allowance Illinois had taken away, from $250,001 to $500,000.
//
// Found by the differential the day the grid first filed the status above
// $250,000. Day 26 put a surviving spouse in the grid and she earned $45,000,
// where this cliff cannot be reached by any amount of running. It is the same
// lesson as the federal § 24 threshold on the same day, in a different
// statute: a case reaches a threshold or it does not.
// ---------------------------------------------------------------------------

const illinois = (filingStatus, agi) =>
  stateIncomeTax({
    state: 'IL',
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: agi, taxableIncome: agi },
    wages: agi,
    dependents: 1,
    dependentAges: [10],
  }).totalTax;

test('Illinois disallows a widow’s exemption allowance above $250,000', () => {
  // Two exemptions at $2,925 and the 4.95% rate: $289.58, lost on one dollar.
  money(illinois('qualifyingSurvivingSpouse', 250_000), 12_085.43);
  money(illinois('qualifyingSurvivingSpouse', 250_001), 12_375.05);
  money(
    illinois('qualifyingSurvivingSpouse', 250_001) - illinois('qualifyingSurvivingSpouse', 250_000),
    289.62,
    'the cliff is the whole allowance plus one dollar of tax',
  );

  // And the joint return still keeps its own, twice as high.
  money(
    illinois('marriedFilingJointly', 300_001) - illinois('marriedFilingJointly', 300_000),
    0.05,
    'a joint return has no cliff at $250,000',
  );
  // Three exemptions at $2,925 and 4.95% is $434.36, and the joint cliff is
  // where Illinois takes them.
  money(
    illinois('marriedFilingJointly', 500_001) - illinois('marriedFilingJointly', 500_000),
    434.41,
    'a joint return loses its allowance at $500,000',
  );

  // Above her cliff the widow pays exactly what a single filer pays, which is
  // the whole claim: Illinois calls her an "other return" at both ends.
  money(illinois('qualifyingSurvivingSpouse', 300_000), illinois('single', 300_000));
  // And below it she is still one person against the joint return's two, which
  // is v0.23.0's fix and has to survive this one.
  money(
    illinois('marriedFilingJointly', 100_000) - illinois('qualifyingSurvivingSpouse', 100_000),
    -144.79,
    'a joint return keeps one exemption more below the cliff',
  );
});
