// Oklahoma. The twenty-ninth taxing state, the largest jurisdiction this
// package had left, and the one whose two supported years are two different
// rate schedules.
//
// Every expected figure below is computed by hand from the published schedules
// and written out, not read back out of the engine. Day 27's rule: a test
// written from the data can only confirm the data.
//
// Four groups here do a job no other state's file does.
//
// `the 2026 reform is a constant subtracted from every rate` asserts the SHAPE
// of HB 2764 rather than its figures: three thresholds unmoved, three rates
// each exactly 0.25 points lower, three bottom bands replaced by one at zero.
// That makes the whole act checkable in one place, and it is why the $22.00
// error below is $22.00 in both years.
//
// `the joint column is exactly twice the single one` records a relation the
// MODULE deliberately does not apply. § 2355(C)(1)(a) and (C)(2)(a) each write
// their own dollar amounts out incrementally, so the law states two tables and
// no relation between them — which makes storing both transcription rather than
// duplication, and makes this the right place for the observation.
//
// `the $12,200 joint threshold two third parties publish is refutable from the
// published schedule alone` is the discrimination North Dakota's indexation
// search could not make. It could have come out the other way.
//
// And `military retired pay does not consume the $10,000` is the whole content
// of the flag Day 50 deleted, measured: $475.00 of 2025 tax on a return that
// has military pay AND a second pension.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILING_STATUSES, getStateDefinition, stateIncomeTax } from './strict.mjs';

/**
 * Compare to the cent, because that is what a return is.
 *
 * The first draft of this file used a `< 0.005` tolerance against unrounded
 * hand arithmetic and three of its own assertions failed by EXACTLY half a
 * cent: Oklahoma's rates are quarter-points, so a 4.75% band on an
 * odd-dollar income lands on `.875` and the engine — correctly — publishes
 * `.88`. A tolerance narrower than the rounding step is a test of the
 * tolerance. Both sides are rounded the way the Tax Commission rounds.
 *
 * AND {@link gap} IS THE SECOND HALF OF THE SAME LESSON, which cost three more
 * assertions. What this file wants to assert about a rule is usually the
 * DIFFERENCE between two returns — what the flag is worth, what the exemption
 * is worth — and each of those returns is a figure already rounded to the cent.
 * So the quantity is `round(a) - round(b)` and not `round(a - b)`, and in a
 * state whose rates are quarter-points the two are a cent apart whenever both
 * sides land on a half-cent. The published difference across Oklahoma's
 * special-exemption limit is $42.04; the rounding of the unrounded difference
 * is $42.05; the filer pays the first.
 */
const cents = (n) => Math.round(n * 100) / 100;
const gap = (a, b) => cents(cents(a) - cents(b));
const money = (actual, expected, msg) =>
  assert.equal(
    cents(actual),
    cents(expected),
    `${msg ?? 'amount'}: expected ${cents(expected)}, got ${cents(actual)}`,
  );

/**
 * Oklahoma starts from federal AGI — Form 511 line 1 — and its own deduction
 * and exemptions come off below it, so the federal deduction in the basis
 * changes no Oklahoma figure. It is supplied only because the engine's basis
 * carries both, and is held at the single standard deduction throughout so that
 * nothing in this file varies two things at once.
 */
const federal = (agi, deduction = 15_750) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});

const ok = (year, filingStatus, agi, extra = {}) =>
  stateIncomeTax({ state: 'OK', year, filingStatus, federal: federal(agi), ...extra });

// ---------------------------------------------------------------------------
// The published schedules, by hand.
//
// § 2355(C)(1)(a), single and married filing separately, as the statute writes
// it: band widths $1,000 + $1,500 + $1,250 + $1,150 + $2,300, summing to the
// $7,200 at which the top rate begins.
const SINGLE_2025 = [
  [1_000, 0.0025],
  [2_500, 0.0075],
  [3_750, 0.0175],
  [4_900, 0.0275],
  [7_200, 0.0375],
  [Infinity, 0.0475],
];
// § 2355(C)(2)(a), joint, surviving spouse AND head of household: $2,000 +
// $3,000 + $2,500 + $2,300 + $4,600, summing to $14,400.
const JOINT_2025 = [
  [2_000, 0.0025],
  [5_000, 0.0075],
  [7_500, 0.0175],
  [9_800, 0.0275],
  [14_400, 0.0375],
  [Infinity, 0.0475],
];
// HB 2764, page 11. Four rows, and the fourth is the zero band every summary of
// the act leaves out.
const SINGLE_2026 = [
  [3_750, 0],
  [4_900, 0.025],
  [7_200, 0.035],
  [Infinity, 0.045],
];
const JOINT_2026 = [
  [7_500, 0],
  [9_800, 0.025],
  [14_400, 0.035],
  [Infinity, 0.045],
];

/** Tax on a taxable income, computed from the band table above by hand. */
const taxOn = (bands, taxable) => {
  let tax = 0;
  let floor = 0;
  for (const [top, rate] of bands) {
    if (taxable <= floor) break;
    tax += rate * (Math.min(taxable, top) - floor);
    floor = top;
  }
  return tax;
};

// The cumulative tax at the top of each 2025 band, written out so that a
// mistake in `taxOn` cannot hide behind itself.
test('the cumulative tax at each published threshold, written out', () => {
  money(taxOn(SINGLE_2025, 1_000), 2.5, 'single 2025 at $1,000');
  money(taxOn(SINGLE_2025, 2_500), 13.75, 'single 2025 at $2,500');
  money(taxOn(SINGLE_2025, 3_750), 35.625, 'single 2025 at $3,750');
  money(taxOn(SINGLE_2025, 4_900), 67.25, 'single 2025 at $4,900');
  money(taxOn(SINGLE_2025, 7_200), 153.5, 'single 2025 at $7,200');
  // Every band of the joint schedule is twice as wide at the same rate, so the
  // tax at the top of the schedule is exactly twice the single one.
  money(taxOn(JOINT_2025, 14_400), 307, 'joint 2025 at $14,400');
  money(taxOn(SINGLE_2026, 3_750), 0, 'single 2026 at $3,750 — the zero band');
  money(taxOn(SINGLE_2026, 4_900), 28.75, 'single 2026 at $4,900');
  money(taxOn(SINGLE_2026, 7_200), 109.25, 'single 2026 at $7,200');
  money(taxOn(JOINT_2026, 14_400), 218.5, 'joint 2026 at $14,400');
});

test('the engine ships the published schedules', () => {
  for (const [year, lower, upper] of [
    [2025, SINGLE_2025, JOINT_2025],
    [2026, SINGLE_2026, JOINT_2026],
  ]) {
    const rate = getStateDefinition('OK', year).rate;
    assert.equal(rate.kind, 'brackets');
    const expected = {
      single: lower,
      marriedFilingSeparately: lower,
      marriedFilingJointly: upper,
      // § 2355(C)(2) names head of household and a surviving spouse in the same
      // subsection as a joint return, so they are the joint column because the
      // statute says so and not because a default supplied it.
      headOfHousehold: upper,
      qualifyingSurvivingSpouse: upper,
    };
    for (const status of FILING_STATUSES) {
      assert.deepEqual(
        rate.byStatus[status].map((b) => [b.upTo, b.rate]),
        expected[status],
        `${status} ${year}`,
      );
    }
  }
});

test('the 2026 schedule has FOUR rows and every summary of HB 2764 says three', () => {
  for (const status of FILING_STATUSES) {
    const bands = getStateDefinition('OK', 2026).rate.byStatus[status];
    assert.equal(bands.length, 4, `${status} should have four rows`);
    assert.equal(bands.filter((b) => b.rate > 0).length, 3, 'three of them charge something');
    assert.equal(bands[0].rate, 0, 'and the first charges nothing');
  }
  // The row nobody counts is the one that decides the most returns: a single
  // filer's first $3,750 cost $35.63 in 2025 and nothing in 2026.
  money(taxOn(SINGLE_2025, 3_750), 35.625, 'what the 2026 zero band used to cost');
});

test('the 2026 reform is a constant subtracted from every rate, and no threshold moved', () => {
  // The three surviving bands keep their 2025 thresholds exactly.
  assert.deepEqual(
    SINGLE_2026.map(([top]) => top),
    [3_750, 4_900, 7_200, Infinity],
  );
  assert.deepEqual(
    SINGLE_2025.slice(2).map(([top]) => top),
    [3_750, 4_900, 7_200, Infinity],
  );
  // And each of their rates falls by exactly 0.25 percentage points.
  const surviving2025 = SINGLE_2025.slice(3).map(([, r]) => r);
  const surviving2026 = SINGLE_2026.slice(1).map(([, r]) => r);
  assert.equal(surviving2025.length, surviving2026.length);
  for (let i = 0; i < surviving2025.length; i += 1) {
    money(surviving2025[i] - surviving2026[i], 0.0025, `band ${i} rate cut`);
  }
  // THE CONSEQUENCE THAT MAKES THIS WORTH ASSERTING: subtracting a constant
  // from every POSITIVE rate leaves every gap between adjacent positive rates
  // alone, so an error expressed as a rate difference costs the same in both
  // years. The claim is about the surviving bands only — the first draft
  // compared every gap including the new 0% -> 2.5% step, which has no 2025
  // counterpart because it is the three collapsed bands, and the test said so.
  const positiveGaps = (bands) => {
    const rates = bands.map(([, r]) => r).filter((r) => r > 0);
    return rates.slice(1).map((r, i) => Math.round((r - rates[i]) * 1e6) / 1e6);
  };
  assert.deepEqual(positiveGaps(SINGLE_2026), [0.01, 0.01]);
  assert.deepEqual(positiveGaps(SINGLE_2025).slice(-2), [0.01, 0.01]);
  assert.deepEqual(positiveGaps(SINGLE_2026), positiveGaps(SINGLE_2025).slice(-2));
});

test('the joint column is exactly twice the single one, in both years, with no rounding', () => {
  // ASSERTED HERE AND NOT APPLIED IN THE MODULE. § 2355(C)(1)(a) and (C)(2)(a)
  // are two subsections that each write their own increments out, so the law
  // states two tables and states no relation between them. North Dakota's
  // separate column is half its joint one and this package refuses to derive
  // that for the same reason pointed the other way; Louisiana's joint deduction
  // IS derived, because R.S. 47:294(A)(2) says "200%" in words.
  for (const [lower, upper] of [
    [SINGLE_2025, JOINT_2025],
    [SINGLE_2026, JOINT_2026],
  ]) {
    assert.equal(lower.length, upper.length);
    for (let i = 0; i < lower.length; i += 1) {
      const [singleTop, singleRate] = lower[i];
      const [jointTop, jointRate] = upper[i];
      assert.equal(jointRate, singleRate, `band ${i} rates must match`);
      if (singleTop === Infinity) {
        assert.equal(jointTop, Infinity);
      } else {
        // Exactly twice, not twice-then-rounded: there is no rounding interval
        // anywhere in this schedule for one to be rounded to.
        assert.equal(jointTop, singleTop * 2, `band ${i} threshold`);
      }
    }
  }
});

test('the $12,200 joint threshold two third parties publish is refutable from the schedule alone', () => {
  // North Dakota's indexation search could only report that no factor reached
  // the published table. Here the arithmetic SETTLES it, three ways.
  //
  // 1. The fourth joint threshold is exactly twice the fourth single one, so
  //    the column is a doubling and $12,200 is not 2 x $7,200.
  assert.equal(JOINT_2025[3][0], SINGLE_2025[3][0] * 2);
  assert.notEqual(12_200, SINGLE_2025[5 - 1][0] * 2);
  // 2. § 2355(C)(2)(a)'s own increments sum to $14,400.
  assert.equal(2_000 + 3_000 + 2_500 + 2_300 + 4_600, 14_400);
  // 3. $12,200 is below the $14,400 the increments give AND below twice the
  //    single figure, so believing it taxes $2,200 at the top rate early.
  const width = 14_400 - 12_200;
  // THE SAME $22.00 IN BOTH YEARS, which is the rate-gap invariance above:
  // 4.75% - 3.75% in 2025 and 4.5% - 3.5% in 2026 are both exactly 1 point.
  money(width * (0.0475 - 0.0375), 22, '2025 cost of believing $12,200');
  money(width * (0.045 - 0.035), 22, '2026 cost of believing $12,200');
});

// ---------------------------------------------------------------------------
// The deduction, the exemptions and the figures they are frozen at.

test('the standard deduction is the federal 2017 figure and has not moved', () => {
  for (const year of [2025, 2026]) {
    const amounts = getStateDefinition('OK', year).deduction.amounts;
    assert.deepEqual(amounts, {
      single: 6_350,
      marriedFilingJointly: 12_700,
      marriedFilingSeparately: 6_350,
      headOfHousehold: 9_350,
      qualifyingSurvivingSpouse: 12_700,
    });
  }
  // THE SIZE OF BELIEVING OKLAHOMA FOLLOWS THE FEDERAL FIGURE, which at least
  // one published guide says it does, with the federal numbers printed.
  money((15_750 - 6_350) * 0.0475, 446.5, '2025 cost of the federal deduction');
  money((16_100 - 6_350) * 0.045, 438.75, '2026 cost of the federal deduction');
});

test('head of household gets the joint rate schedule and its own smaller deduction', () => {
  // The whole point: head of household is the joint column on one of Oklahoma's
  // three tables and a column of its own on the other two, so a model that maps
  // the status once gets two of them wrong.
  const def = getStateDefinition('OK', 2025);
  assert.deepEqual(def.rate.byStatus.headOfHousehold, def.rate.byStatus.marriedFilingJointly);
  assert.equal(def.deduction.amounts.headOfHousehold, 9_350);
  assert.notEqual(def.deduction.amounts.headOfHousehold, def.deduction.amounts.marriedFilingJointly);
  assert.equal(def.exemption.lowIncomeSeniorThreshold.headOfHousehold, 19_000);
  // $85,000 of federal AGI, by hand: 85,000 - 9,350 - 1,000 = 74,650 taxable,
  // taxed on the JOINT schedule.
  money(ok(2025, 'headOfHousehold', 85_000).tax, 307 + 0.0475 * (74_650 - 14_400), 'HOH 2025');
  // On the single schedule the same taxable income would cost more, which is
  // what makes the choice of column observable rather than a detail.
  assert.ok(taxOn(SINGLE_2025, 74_650) > taxOn(JOINT_2025, 74_650));
});

test('a worked return in each year, by hand', () => {
  // 85,000 - 6,350 standard - 1,000 exemption = 77,650 taxable.
  money(ok(2025, 'single', 85_000).tax, 153.5 + 0.0475 * (77_650 - 7_200), 'single 2025');
  money(ok(2026, 'single', 85_000).tax, 109.25 + 0.045 * (77_650 - 7_200), 'single 2026');
  // 85,000 - 12,700 - 2,000 = 70,300.
  money(
    ok(2025, 'marriedFilingJointly', 85_000).tax,
    307 + 0.0475 * (70_300 - 14_400),
    'joint 2025',
  );
  // HB 2764 is a cut at every income, and the gap widens with income because
  // the top rate fell as well as the bottom bands.
  const gapAt = (agi) => ok(2025, 'single', agi).tax - ok(2026, 'single', agi).tax;
  assert.ok(gapAt(20_000) > 0 && gapAt(85_000) > gapAt(20_000));
});

test('the special exemption test is "equal to or less than", and the boundary dollar is worth it', () => {
  const def = getStateDefinition('OK', 2025);
  assert.equal(def.exemption.perLowIncomeSeniorFiler, 1_000);
  assert.equal(def.exemption.lowIncomeSeniorThresholdInclusive, true);
  assert.deepEqual(def.exemption.lowIncomeSeniorThreshold, {
    single: 15_000,
    marriedFilingJointly: 25_000,
    marriedFilingSeparately: 12_500,
    headOfHousehold: 19_000,
    qualifyingSurvivingSpouse: 25_000,
  });
  // AT the threshold the exemption is allowed: 15,000 - 6,350 - 2,000 = 6,650.
  money(ok(2025, 'single', 15_000, { filerAge: 65 }).tax, taxOn(SINGLE_2025, 6_650), 'at $15,000');
  // One dollar over, it is gone: 15,001 - 6,350 - 1,000 = 7,651.
  money(ok(2025, 'single', 15_001, { filerAge: 65 }).tax, taxOn(SINGLE_2025, 7_651), 'at $15,001');
  // Indiana's "less than" would have denied it at exactly $15,000, so this flag
  // is worth the difference between the two answers on one dollar of income.
  const cliff = gap(
    ok(2025, 'single', 15_001, { filerAge: 65 }).tax,
    ok(2025, 'single', 15_000, { filerAge: 65 }).tax,
  );
  money(cliff, 42.04, 'one dollar of income across the special-exemption limit');
  // And Oklahoma has NO untested age exemption: a 65-year-old above the limit
  // is worth exactly what a 64-year-old is.
  assert.equal(def.exemption.perSeniorFiler, undefined);
  money(
    ok(2025, 'single', 60_000, { filerAge: 65 }).tax,
    ok(2025, 'single', 60_000, { filerAge: 64 }).tax,
    'a sixty-fifth birthday above the limit',
  );
});

// ---------------------------------------------------------------------------
// The retirement subtractions, and the flag Day 50 deleted.

test('the $10,000 retirement exclusion has NO age test', () => {
  const rule = getStateDefinition('OK', 2025).retirementIncomeSubtractions[0];
  assert.equal(rule.cap, 10_000);
  assert.equal(rule.scope, 'perPerson');
  // Neither gate is set, which is what makes Oklahoma the only state in this
  // rule whose cap reaches a 45-year-old — and the parameter published guides
  // most often report wrong about this state.
  assert.equal(rule.minimumAge, undefined);
  assert.equal(rule.cappedMinimumAge, undefined);
  const young = ok(2025, 'single', 60_000, {
    filerAge: 45,
    retirement: { filer: { employerPlanPension: 30_000 } },
  });
  const old = ok(2025, 'single', 60_000, {
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 30_000 } },
  });
  money(young.tax, old.tax, 'a 45-year-old and a 70-year-old get the same $10,000');
  // 60,000 - 10,000 excluded - 6,350 - 1,000 = 42,650 taxable.
  money(young.tax, taxOn(SINGLE_2025, 42_650), 'the exclusion at 45');
});

test('military retired pay is out in full and does NOT consume the $10,000', () => {
  const rule = getStateDefinition('OK', 2025).retirementIncomeSubtractions[0];
  assert.equal(rule.militaryExemptOutsideCap, true);
  // Setting both would be a contradiction, and `registry.test.js` refuses it.
  assert.equal(rule.militaryReducesCap, undefined);
  const household = {
    filerAge: 60,
    retirement: { filer: { militaryRetirement: 45_000, iraDistributions: 12_000 } },
  };
  // 120,000 - 45,000 military - 10,000 of the IRA - 6,350 - 1,000 = 57,650.
  const actual = ok(2025, 'single', 120_000, household);
  money(actual.tax, taxOn(SINGLE_2025, 57_650), 'military outside the cap');
  // SOUTH CAROLINA'S SHAPE, for comparison, computed by hand: § 12-6-1170(C)(1)
  // charges the military deduction against the cap, which would leave no room
  // for the IRA at all — 120,000 - 45,000 - 6,350 - 1,000 = 67,650.
  const ifChargedAgainstTheCap = taxOn(SINGLE_2025, 67_650);
  money(gap(ifChargedAgainstTheCap, actual.tax), 475, 'what the flag is worth');
});

test('the $10,000 is per person and is not transferable', () => {
  const together = ok(2025, 'marriedFilingJointly', 90_000, {
    filerAge: 66,
    spouseAge: 66,
    retirement: { filer: { employerPlanPension: 20_000 } },
  });
  const split = ok(2025, 'marriedFilingJointly', 90_000, {
    filerAge: 66,
    spouseAge: 66,
    retirement: {
      filer: { employerPlanPension: 10_000 },
      spouse: { employerPlanPension: 10_000 },
    },
  });
  // One name on the plan buys one $10,000; two names buy two. 90,000 - 10,000
  // - 12,700 - 2,000 = 65,300 against 90,000 - 20,000 - 12,700 - 2,000 = 55,300.
  money(together.tax, taxOn(JOINT_2025, 65_300), 'all in one name');
  money(split.tax, taxOn(JOINT_2025, 55_300), 'split between them');
  money(together.tax - split.tax, 10_000 * 0.0475, 'the cost of whose name is on the plan');
});

// ---------------------------------------------------------------------------
// What Oklahoma does not have, asserted so that an accidental addition fails.

test('Oklahoma ships no earned income credit, because its base is a frozen federal one', () => {
  // § 2357.43 is 5% of the federal credit computed under the IRC AS IT EXISTED
  // ON 31 DECEMBER 2020. `matchRate: 0.05` would read this year's credit, so
  // the rule is absent until there is an input for the 2020-law figure — and
  // `tools/cross-package/oklahoma-frozen-eitc.mjs` measures what the naive
  // reading would cost against us-federal-tax's own tables.
  for (const year of [2025, 2026]) {
    assert.equal(getStateDefinition('OK', year).earnedIncomeCredit, undefined);
    assert.equal(getStateDefinition('OK', year).ownEarnedIncomeCredit, undefined);
  }
  // The frozen 2020 maxima, by child count, written out here because they are
  // what the state's own statute points at.
  const FROZEN_2020 = [538, 3_584, 5_920, 6_660];
  assert.deepEqual(FROZEN_2020, [538, 3_584, 5_920, 6_660]);
  // Oklahoma's credit at the plateau is 5% of those, and it does NOT move
  // between 2025 and 2026 — which is the whole point of a frozen base.
  assert.deepEqual(
    FROZEN_2020.map((m) => Math.round(m * 0.05 * 100) / 100),
    [26.9, 179.2, 296, 333],
  );
});

test('Oklahoma has no state-defined base, no locality and no surtax', () => {
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('OK', year);
    assert.equal(def.base, 'federalAdjustedGrossIncome');
    assert.equal(def.stateDefinedBase, undefined);
    assert.equal(def.surtax, undefined);
    assert.equal(def.itemizedDeduction, undefined);
    assert.equal(def.subtractsTaxableSocialSecurity, true);
    assert.equal(def.status, 'published');
    assert.equal(def.provisionalFigures, undefined);
  }
});

test('Social Security comes out in full, for everybody, with no income test', () => {
  const low = ok(2025, 'single', 40_000, { taxableSocialSecurity: 12_000, filerAge: 70 });
  const high = ok(2025, 'single', 400_000, { taxableSocialSecurity: 12_000, filerAge: 70 });
  // 40,000 - 12,000 - 6,350 - 1,000 = 20,650.
  money(low.tax, taxOn(SINGLE_2025, 20_650), 'a low income');
  // And the same $12,000 comes out at $400,000 — no test, no taper.
  money(
    gap(taxOn(SINGLE_2025, 400_000 - 6_350 - 1_000), high.tax),
    12_000 * 0.0475,
    'the same benefit at a high income',
  );
});
