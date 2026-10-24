// Louisiana. The twenty-seventh taxing state in this package, and the one whose
// 2025 return is least like its own reputation: every summary leads with the
// flat 3% rate, and the half that decides most returns is that Act 11 of the
// 2024 Third Extraordinary Session REPEALED every exemption Louisiana had.
//
// Every expected figure below is computed from the statute by hand and written
// out, not read back out of the engine. Day 27's rule: a test written from the
// data can only confirm the data.
//
// And one group of tests here is doing a job no other state's file has had to
// do. The 2026 figures come from a Revenue Information Bulletin that this
// sandbox cannot open — `dam.ldr.la.gov` does not resolve — so they arrived as a
// third party's quotation. Day 45's route for exactly that situation is to check
// a second party's reading ARITHMETICALLY against the state's own published
// mechanism, and `the 2026 figures are rederived from the statute's own
// mechanism` below is that check, run in CI rather than done once in a
// scratchpad. It is the strongest part of this file, because it is the part that
// could have refused the figures.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILING_STATUSES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** Louisiana starts from federal AGI — R.S. 47:293(1). */
const federal = (agi, eitc) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
  ...(eitc === undefined ? {} : { earnedIncomeCredit: eitc }),
});

// `eitc` is a helper option and goes INSIDE `federal`, where the engine's field
// lives. Day 38's rule: a helper that spreads its own options into the engine is
// a machine for silent typos, and `strict.mjs` is what refuses them — it refused
// this file's first draft, which passed `earnedIncomeCredit` at the top level.
const la = ({ agi = 60_000, year = 2025, filingStatus = 'single', eitc, ...fields } = {}) =>
  stateIncomeTax({ state: 'LA', year, filingStatus, ...fields, federal: federal(agi, eitc) });

const subtractionNamed = (result, fragment) =>
  result.computedSubtractions.find((s) => s.name.toLowerCase().includes(fragment))?.amount ?? 0;

// The four parameters, written out once. Everything below is arithmetic on these.
const SINGLE_DEDUCTION = { 2025: 12_500, 2026: 12_838 };
const RETIREMENT_CAP = { 2025: 12_000, 2026: 12_324 };
const RATE = 0.03;

// ---------------------------------------------------------------------------
// The rate and the deduction.
// ---------------------------------------------------------------------------

test('a flat 3% on federal AGI less the standard deduction, in every status and both years', () => {
  // R.S. 47:32(A) as amended by Act 11 — one rate, no bands, no status variation.
  // The loop rather than the four assertions I had in mind, because a loop is the
  // only version that can contradict its author.
  for (const year of [2025, 2026]) {
    const single = SINGLE_DEDUCTION[year];
    // R.S. 47:294(A)(2): joint, head of household and qualified surviving spouse
    // are 200% of the single amount. The statute states the percentage, so this
    // test states it too rather than naming a second figure.
    const expected = {
      single,
      marriedFilingSeparately: single,
      marriedFilingJointly: single * 2,
      headOfHousehold: single * 2,
      qualifyingSurvivingSpouse: single * 2,
    };
    for (const filingStatus of FILING_STATUSES) {
      money(
        la({ year, filingStatus, agi: 100_000 }).tax,
        (100_000 - expected[filingStatus]) * RATE,
        `LA ${year} ${filingStatus}`,
      );
    }
  }
});

test("Louisiana's head of household gets the FULL joint deduction, not one and a half", () => {
  // The claim the module's note makes, priced. Most states in this package give a
  // head of household 1.5x the single figure; R.S. 47:294(A)(2) names head of
  // household in the same clause as a joint return, so the ratio is 2.
  for (const year of [2025, 2026]) {
    const single = SINGLE_DEDUCTION[year];
    const def = getStateDefinition('LA', year);
    assert.equal(def.deduction.amounts.headOfHousehold, single * 2, `LA ${year} HOH is 200%`);
    assert.equal(
      def.deduction.amounts.headOfHousehold,
      def.deduction.amounts.marriedFilingJointly,
      `LA ${year} HOH equals joint`,
    );
  }
  // And what the usual ratio would cost a Louisiana head of household in 2025:
  // (12,500 x 1.5) = 18,750 against 25,000, which is 6,250 of deduction at 3%.
  const scaled = (100_000 - 12_500 * 1.5) * RATE;
  money(scaled - la({ year: 2025, filingStatus: 'headOfHousehold', agi: 100_000 }).tax, 187.5);
});

test('a filer below the standard deduction owes nothing rather than a negative amount', () => {
  money(la({ agi: 10_000 }).tax, 0);
  money(la({ agi: 12_500 }).tax, 0);
  money(la({ agi: 12_501 }).tax, 0.03);
});

// ---------------------------------------------------------------------------
// The 2026 figures, rederived. This is the Day 45 check.
// ---------------------------------------------------------------------------

test("the 2026 figures are rederived from the statute's own mechanism", () => {
  // R.S. 47:294(B) and 47:44.1(A) both adjust the prior year's amount by the
  // percentage increase in CPI-U. BLS reported the all-items increase for the
  // twelve months ending December 2025 as 2.7%. Everything below follows from
  // those two facts and the 2025 amounts, and NONE of it reads a 2026 figure out
  // of the definition first.
  //
  // THE FACTOR IS AN EXACT RATIONAL AND NOT THE DECIMAL LITERAL `1.027`, and
  // that is not fastidiousness — it is the difference between the published
  // figure and a figure one dollar below it. `12_500 * 1.027` is
  // 12837.499999999998 in binary floating point, so `Math.round` of it is
  // **12,837**. The single deduction's derivation lands EXACTLY on a rounding
  // boundary, which is the one place the representation error can change the
  // answer, and it is the only one of Louisiana's three 2026 figures that does:
  // `12_000 * 1.027` and `25_000 * 1.027` are each a hair low too and round to
  // 12,324 and 25,675 regardless. This file's first draft used the literal and
  // failed here, which is how the boundary was found.
  const indexed = (amount) => Math.round((amount * 1027) / 1000);

  // The single deduction: 12,500 x 1.027 = 12,837.50, rounded to 12,838.
  assert.equal((12_500 * 1027) / 1000, 12_837.5, 'exactly on the boundary');
  assert.equal(Math.round(12_500 * 1.027), 12_837, 'and the decimal literal falls off it');
  assert.equal(indexed(12_500), 12_838);
  assert.equal(getStateDefinition('LA', 2026).deduction.amounts.single, indexed(12_500));

  // The retirement exemption: 12,000 x 1.027 = 12,324 EXACTLY. No rounding
  // convention can move this one, which is what makes it the strongest of the
  // three corroborations.
  assert.equal((12_000 * 1027) / 1000, 12_324);
  assert.equal(getStateDefinition('LA', 2026).retirementIncomeSubtractions[0].cap, indexed(12_000));

  // And the joint deduction, which is the one that DISCRIMINATES — the two
  // plausible orders of operations give two different answers, and the published
  // figure picks one of them.
  const doubleTheRoundedSingle = 2 * indexed(12_500); // the statute's order
  const roundTheIndexedJoint = indexed(25_000); // the other order
  assert.equal(doubleTheRoundedSingle, 25_676);
  assert.equal(roundTheIndexedJoint, 25_675);
  assert.notEqual(doubleTheRoundedSingle, roundTheIndexedJoint);
  assert.equal(
    getStateDefinition('LA', 2026).deduction.amounts.marriedFilingJointly,
    doubleTheRoundedSingle,
    'the package follows R.S. 47:294(A)(2): double the rounded single amount',
  );
  // Three cents of tax on a joint return, and the only thing that decides it is
  // which of the two sentences in R.S. 47:294 is the parameter.
  money(
    (100_000 - roundTheIndexedJoint) * RATE -
      la({ year: 2026, filingStatus: 'marriedFilingJointly', agi: 100_000 }).tax,
    0.03,
  );
});

test('the 2026 WITHHOLDING deduction is a different figure, and the gap is priced', () => {
  // LAC 61:I.1501's proposed 2026 withholding tables carry 12,875 and 25,750 —
  // the same statutory index read over the twelve months ending SEPTEMBER 2025,
  // which BLS reported as 3.0%, because a withholding table has to exist before
  // the year it withholds for and no October 2025 index was ever published.
  //
  // Both are correct for their own purpose. This package computes the RETURN, and
  // the assertion is here so that a future run cannot quietly adopt the payroll
  // figure as the return's.
  assert.equal(Math.round(12_500 * 1.03), 12_875);
  assert.equal(Math.round(12_500 * 1.03) * 2, 25_750);
  const def = getStateDefinition('LA', 2026);
  assert.equal(def.deduction.amounts.single, 12_838, 'the RETURN figure, not the withholding one');
  assert.equal(12_875 - 12_838, 37, 'the gap in deduction for a single filer');
  money((12_875 - 12_838) * RATE, 1.11, 'the gap in tax for a single filer');
  money((25_750 - 25_676) * RATE, 2.22, 'the gap in tax on a joint return');
});

// ---------------------------------------------------------------------------
// The repeal. Act 11 left Louisiana with no exemptions of any kind.
// ---------------------------------------------------------------------------

test('Act 11 left no exemption for a dependent, an age or a blindness', () => {
  const def = getStateDefinition('LA', 2025);
  assert.equal(def.exemption, undefined, 'no exemption rule at all');
  // And measured through the engine rather than asserted from the definition,
  // because an absent rule is only worth anything if nothing else picks the job
  // up. Each of these moved a Louisiana return before 2025 and none moves one now.
  const base = la({ agi: 60_000, filingStatus: 'marriedFilingJointly' }).tax;
  for (const [label, fields] of [
    ['four dependents', { dependents: 4, dependentAges: [2, 7, 11, 15] }],
    ['both filers at 70', { filerAge: 70, spouseAge: 70 }],
    ['a blind filer', { blindOrDisabled: true }],
    ['all of them', { dependents: 4, dependentAges: [2, 7, 11, 15], filerAge: 70, blindOrDisabled: true }],
  ]) {
    money(
      la({ agi: 60_000, filingStatus: 'marriedFilingJointly', ...fields }).tax,
      base,
      `${label} moves no Louisiana figure`,
    );
  }
  // The repealed figures, for the record: $9,000 of personal exemption plus
  // $4,000 of dependents would have been $13,000 of exemption under the old law,
  // against $25,000 of standard deduction now.
  money(base, (60_000 - 25_000) * RATE);
});

// ---------------------------------------------------------------------------
// Retirement: two statutes, one cap, and the per-person rule.
// ---------------------------------------------------------------------------

test('the retirement exemption is capped per person and gated at 65', () => {
  for (const year of [2025, 2026]) {
    const cap = RETIREMENT_CAP[year];
    const ded = SINGLE_DEDUCTION[year] * 2;
    // Both over 65, the whole pension in one spouse's name: ONE cap.
    money(
      la({
        year,
        agi: 40_000,
        filingStatus: 'marriedFilingJointly',
        filerAge: 66,
        spouseAge: 66,
        retirement: { filer: { employerPlanPension: 40_000 } },
      }).tax,
      Math.max(0, 40_000 - cap - ded) * RATE,
      `LA ${year} one name`,
    );
    // Split evenly: TWO caps, which is 12,000 more of exemption in 2025.
    money(
      la({
        year,
        agi: 40_000,
        filingStatus: 'marriedFilingJointly',
        filerAge: 66,
        spouseAge: 66,
        retirement: {
          filer: { employerPlanPension: 20_000 },
          spouse: { employerPlanPension: 20_000 },
        },
      }).tax,
      Math.max(0, 40_000 - 2 * Math.min(cap, 20_000) - ded) * RATE,
      `LA ${year} split`,
    );
    // Below 65 nothing is exempt at all.
    money(
      la({
        year,
        agi: 40_000,
        filingStatus: 'marriedFilingJointly',
        filerAge: 60,
        spouseAge: 60,
        retirement: {
          filer: { employerPlanPension: 20_000 },
          spouse: { employerPlanPension: 20_000 },
        },
      }).tax,
      Math.max(0, 40_000 - ded) * RATE,
      `LA ${year} both under 65`,
    );
  }
  // The 2025 price of the asymmetry, written out: $90 apart on identical income,
  // decided by whose name is on the plan.
  const oneName = la({
    agi: 40_000,
    filingStatus: 'marriedFilingJointly',
    filerAge: 66,
    spouseAge: 66,
    retirement: { filer: { employerPlanPension: 40_000 } },
  }).tax;
  const split = la({
    agi: 40_000,
    filingStatus: 'marriedFilingJointly',
    filerAge: 66,
    spouseAge: 66,
    retirement: {
      filer: { employerPlanPension: 20_000 },
      spouse: { employerPlanPension: 20_000 },
    },
  }).tax;
  money(oneName, 90);
  money(split, 0);
  money(oneName - split, 90, 'the per-person rule, priced');
});

test('the household `retirementIncome` fallback buys ONE exemption, not two', () => {
  // The fallback attributes the whole household figure to the filer, so a couple
  // who split their pension and pass a single total are understated in Louisiana.
  // This is asserted rather than left in a note, because the note is the only
  // thing standing between a caller and a wrong answer with no symptom.
  const total = la({
    agi: 40_000,
    filingStatus: 'marriedFilingJointly',
    filerAge: 66,
    spouseAge: 66,
    retirementIncome: 40_000,
  }).tax;
  money(total, 90, 'one cap, like the one-name case');
});

test('government and military retired pay are exempt in full, outside the cap and at any age', () => {
  // R.S. 47:44.2, which has no age test. A Louisiana trooper who retired at 48
  // pays nothing, where the R.S. 47:44.1 cap would have reached all but $12,000.
  for (const field of ['governmentPension', 'militaryRetirement']) {
    money(
      la({ agi: 55_000, filerAge: 48, retirement: { filer: { [field]: 55_000 } } }).tax,
      0,
      `${field} at 48`,
    );
    // And it does not consume the $12,000, which only a household with BOTH can
    // show: $55,000 of government pension and $20,000 of IRA at 70 leaves
    // $20,000 - $12,000 = $8,000 in the base, less the $12,500 deduction.
    money(
      la({
        agi: 75_000,
        filerAge: 70,
        retirement: { filer: { [field]: 55_000, iraDistributions: 20_000 } },
      }).tax,
      0,
      `${field} does not consume the cap`,
    );
  }
  // The same figures with the government pension reclassified as an ordinary
  // employer plan — which is what ANOTHER state's public pension is in Louisiana.
  // $75,000 less $12,000 of cap less $12,500 of deduction at 3%.
  money(
    la({
      agi: 75_000,
      filerAge: 70,
      retirement: { filer: { employerPlanPension: 55_000, iraDistributions: 20_000 } },
    }).tax,
    (75_000 - 12_000 - 12_500) * RATE,
    "an out-of-state public pension is ordinary retirement income here",
  );
  // And at 50 an out-of-state public pension gets nothing at all.
  money(
    la({ agi: 50_000, filerAge: 50, retirement: { filer: { employerPlanPension: 50_000 } } }).tax,
    (50_000 - 12_500) * RATE,
  );
});

test('an IRA distribution is inside the exemption, which the forms say and the rule does not', () => {
  // La. Admin. Code 61:I.1311 names pension and annuity income and not an IRA;
  // the IT-540 instructions and RIB 05-015 both include one. This package follows
  // the forms, and this test is what makes that choice visible rather than
  // implicit — if a future run reads the regulation and decides the other way,
  // this is the test that has to be changed on purpose.
  money(
    la({ year: 2026, agi: 30_000, filerAge: 70, retirement: { filer: { iraDistributions: 30_000 } } })
      .tax,
    (30_000 - 12_324 - 12_838) * RATE,
  );
  assert.ok(
    getStateDefinition('LA', 2025).notes.some((n) => n.includes('61:I.1311')),
    'the gap is disclosed in a note the caller sees',
  );
});

test('the exemption reports under two names, because it comes from two statutes', () => {
  const r = la({
    agi: 75_000,
    filerAge: 70,
    retirement: { filer: { governmentPension: 55_000, iraDistributions: 20_000 } },
  });
  money(subtractionNamed(r, 'exempt state, local and federal'), 55_000, 'R.S. 47:44.2, uncapped');
  money(subtractionNamed(r, 'annual retirement income exemption'), 12_000, 'R.S. 47:44.1, capped');
});

// ---------------------------------------------------------------------------
// Social Security, and the earned income credit.
// ---------------------------------------------------------------------------

test('the federally taxable part of a Social Security benefit comes back out', () => {
  // Schedule E code 07E. The benefit is inside the federal AGI this state starts
  // from, so exempting it is a subtraction and not an omission.
  money(
    la({ agi: 50_000, taxableSocialSecurity: 10_000 }).tax,
    (50_000 - 10_000 - 12_500) * RATE,
  );
  assert.equal(getStateDefinition('LA', 2025).subtractsTaxableSocialSecurity, true);
});

test('the earned income credit is 5% of the federal one and refundable', () => {
  // R.S. 47:297.8(A) and (B). Refundable is the half that matters: a Louisiana
  // return with no liability still pays it out.
  const r = la({ agi: 20_000, filingStatus: 'headOfHousehold', dependents: 1, eitc: 4_000 });
  const credit = r.credits.find((c) => c.name === 'Louisiana earned income credit');
  assert.ok(credit, 'the credit is reported by name');
  money(credit.amount, 200);
  // $20,000 of AGI is below the $25,000 head-of-household deduction, so there is
  // no tax for the credit to offset and the whole $200 is a refund.
  money(r.tax, -200, 'refundable, so the answer is negative');
});

// ---------------------------------------------------------------------------
// The shape of the state-year itself.
// ---------------------------------------------------------------------------

test('both Louisiana years are published, and nothing is carried forward', () => {
  // The reason is worth an assertion: R.S. 47:294(B)'s indexation BEGINS on
  // 1 January 2026, so 2025 is a statutory figure with nothing to index and 2026
  // is a released one. There has never been a Louisiana figure to carry forward,
  // which is why this is the first state here to arrive published in both years.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('LA', year);
    assert.equal(def.status, 'published', `LA ${year}`);
    assert.equal(def.provisionalFigures, undefined, `LA ${year} has no provisional figures`);
  }
});

test('Louisiana levies no local income tax', () => {
  assert.equal(getStateDefinition('LA', 2025).localities, undefined);
  money(la({ agi: 60_000 }).localTaxes.length, 0);
});

test('the rate is the same in both years and the answer is not', () => {
  // Louisiana is the only state in this package whose two years differ with no
  // parameter amended and nothing read late: the indexation provision itself
  // starts in 2026.
  assert.equal(getStateDefinition('LA', 2025).rate.rate, getStateDefinition('LA', 2026).rate.rate);
  assert.notEqual(la({ year: 2025, agi: 100_000 }).tax, la({ year: 2026, agi: 100_000 }).tax);
  money(
    la({ year: 2025, agi: 100_000 }).tax - la({ year: 2026, agi: 100_000 }).tax,
    (12_838 - 12_500) * RATE,
    'the whole of the difference is the indexed deduction',
  );
});
