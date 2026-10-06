// Oregon. The third state that deducts the federal income tax, the first whose
// deduction is an INCOME subtraction, and the state with five cliffs where its
// own top rate starts — which the subtraction then holds the filer below.
//
// Every expected figure below is computed from the statute by hand and written
// out rather than read back out of the engine — Day 27's rule, and the reason
// the module header's cliff table says $153.22 for its first two rows and not
// the $173.25 it was first drafted with. The engine contradicted the header and
// the engine was right.
//
// Federal figures are written out by hand rather than imported from
// `us-federal-tax`: the mutation harness SKIPS a test file that resolves a path
// out of its own package, so importing the federal engine here would quietly
// take every Oregon figure out of the audit with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILING_STATUSES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

// The engine rounds each answer to the cent, so a figure derived by SUBTRACTING
// two answers — which is what every cliff below is — can sit a whole cent away
// from the exact arithmetic. $1,750 x 8.75% + 8.75c is $153.2125 and the engine
// reports $153.22, and both are right. Used only where the expected value is a
// difference of two rounded figures.
const toTheCent = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) <= 0.011,
    `${msg ?? 'amount'}: expected ${expected} to the cent, got ${actual}`,
  );

const STD_2026 = { single: 16_100, joint: 32_200, headOfHousehold: 24_150 };
const STD_2025 = { single: 15_750, joint: 31_500, headOfHousehold: 23_625 };

/** A plain Oregon wage household. `fedTax` is Form 1040 line 22. */
const or = ({
  agi,
  year = 2026,
  filingStatus = 'single',
  fedTax = 0,
  fedStd,
  ...rest
}) =>
  stateIncomeTax({
    state: 'OR',
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: agi,
      deduction: fedStd ?? (year >= 2026 ? STD_2026.single : STD_2025.single),
      deductionKind: 'standard',
      taxableIncome: Math.max(0, agi - (fedStd ?? (year >= 2026 ? STD_2026.single : STD_2025.single))),
      incomeTaxBeforeRefundableCredits: fedTax,
    },
    earnedIncome: agi,
    ...rest,
  });

/** The Oregon schedule, by hand, on Oregon TAXABLE income. */
const schedule = (taxable, year, doubled) => {
  const [a, b] = year >= 2026 ? [4_550, 11_400] : [4_400, 11_100];
  const [lo, hi, top] = doubled ? [a * 2, b * 2, 250_000] : [a, b, 125_000];
  if (taxable <= lo) return taxable * 0.0475;
  if (taxable <= hi) return lo * 0.0475 + (taxable - lo) * 0.0675;
  if (taxable <= top) return lo * 0.0475 + (hi - lo) * 0.0675 + (taxable - hi) * 0.0875;
  return (
    lo * 0.0475 + (hi - lo) * 0.0675 + (top - hi) * 0.0875 + (taxable - top) * 0.099
  );
};

// ---------------------------------------------------------------------------
// The schedule, and the one boundary that has not moved since 1993
// ---------------------------------------------------------------------------

test('the rate schedule is four rates and the top threshold is unindexed', () => {
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('OR', year);
    for (const status of FILING_STATUSES) {
      const bands = def.rate.byStatus[status];
      assert.deepEqual(
        bands.map((band) => band.rate),
        [0.0475, 0.0675, 0.0875, 0.099],
        `${status} ${year} rates`,
      );
      // $125,000 single and separate, $250,000 for the three that file on the
      // joint schedule — and the SAME figure in both years, because ORS 316.037
      // does not index it. Thirty-three years of inflation have walked the top
      // bracket down the income distribution with no Oregon legislature
      // involved.
      const doubled =
        status === 'marriedFilingJointly' ||
        status === 'headOfHousehold' ||
        status === 'qualifyingSurvivingSpouse';
      assert.equal(bands[2].upTo, doubled ? 250_000 : 125_000, `${status} ${year} top threshold`);
    }
  }
});

test('the joint column is exactly twice the single one at every indexed boundary', () => {
  // The doubling IS the provision, so it is asserted rather than transcribed:
  // a second table of four numbers could drift from it by a dollar and nothing
  // would catch it.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('OR', year);
    const single = def.rate.byStatus.single;
    const joint = def.rate.byStatus.marriedFilingJointly;
    for (const i of [0, 1]) {
      assert.equal(joint[i].upTo, single[i].upTo * 2, `${year} boundary ${i}`);
    }
  }
});

test('separate files on the SINGLE schedule and head of household on the JOINT one', () => {
  // The reverse of the pattern in most of this package, and worth $1,000 of
  // Oregon tax to a single parent at $60,000.
  const def = getStateDefinition('OR', 2026);
  assert.deepEqual(def.rate.byStatus.marriedFilingSeparately, def.rate.byStatus.single);
  assert.deepEqual(
    def.rate.byStatus.headOfHousehold,
    def.rate.byStatus.marriedFilingJointly,
  );
});

// ---------------------------------------------------------------------------
// The federal tax subtraction: a ceiling chart on FEDERAL AGI
// ---------------------------------------------------------------------------

test('the subtraction is the whole federal bill below the ceiling', () => {
  // $60,000 single 2026, federal bill $5,000 — well under the $8,750 ceiling,
  // so the whole of it comes off Oregon AGI.
  //   Oregon AGI       60,000 - 5,000 = 55,000
  //   taxable          55,000 - 2,910 = 52,090
  //   tax              216.125 + 462.375 + 3,560.375 = 4,238.875
  //   exemption credit                         263
  const r = or({ agi: 60_000, fedTax: 5_000 });
  money(r.stateAdjustedGrossIncome, 55_000, 'Oregon AGI');
  money(r.taxableIncome, 52_090, 'taxable');
  toTheCent(r.tax, schedule(52_090, 2026, false) - 263, 'tax');
  money(r.tax, 3_975.88, 'tax, by hand, rounded to the cent by the engine');
});

test('it is an INCOME subtraction, so it comes off Oregon AGI and not the deduction', () => {
  // The placement is the second provision. Alabama's Form 40 line 12 and
  // Missouri's MO-1040 line 13 sit below the standard-or-itemized choice;
  // Oregon's is on Schedule OR-ASC, inside Oregon AGI.
  const r = or({ agi: 60_000, fedTax: 5_000 });
  money(r.deduction, 2_910, 'the deduction is the standard deduction alone');
  money(r.stateAdjustedGrossIncome, 55_000, 'and the subtraction is inside AGI');
});

test('the ceiling is read against FEDERAL AGI and binds above it', () => {
  // A federal bill of $20,000 is above every ceiling, so the subtraction IS the
  // ceiling at each step.
  const ceiling = (agi) => {
    const r = or({ agi, fedTax: 20_000 });
    return agi - r.stateAdjustedGrossIncome;
  };
  // 2026: $8,750 / $7,000 / $5,250 / $3,500 / $1,750 / nothing.
  money(ceiling(124_999), 8_750, 'below the first step');
  money(ceiling(125_000), 7_000, 'exactly on $125,000');
  money(ceiling(130_000), 5_250, 'exactly on $130,000');
  money(ceiling(135_000), 3_500, 'exactly on $135,000');
  money(ceiling(140_000), 1_750, 'exactly on $140,000');
  money(ceiling(145_000), 0, 'exactly on $145,000');
  money(ceiling(500_000), 0, 'and gone above it');
});

test('the boundary belongs to the LOWER step — the opposite of Missouri', () => {
  // Form OR-40's Table 4 prints "$125,000–$130,000", which is ambiguous at both
  // ends. The Department of Revenue's 2026 withholding formula writes the same
  // row as "greater than or equal to $125,000 and less than $130,000", so the
  // filer standing exactly on the figure takes the SMALLER ceiling. Missouri's
  // § 143.171.2 says "or less" and gives its boundary filer the LARGER share.
  const ceiling = (agi) => agi - or({ agi, fedTax: 20_000 }).stateAdjustedGrossIncome;
  money(ceiling(124_999.99), 8_750, 'a cent below keeps the maximum');
  money(ceiling(125_000), 7_000, 'exactly on it does not');
});

test('the five cliffs, and why the first two cost less', () => {
  // The lost $1,750 is charged at whatever Oregon rate the filer is on, and the
  // subtraction holds them below the $125,000 where 9.9% starts. So the first
  // two steps are 8.75% and the last three 9.9%.
  const taxAt = (agi) => or({ agi, fedTax: 20_000 }).tax;
  const cost = (b) => taxAt(b) - taxAt(b - 1);
  toTheCent(cost(125_000), 1_750 * 0.0875 + 0.0875, '$125,000');
  toTheCent(cost(135_000), 1_750 * 0.099 + 0.099, '$135,000');
  toTheCent(cost(140_000), 1_750 * 0.099 + 0.099, '$140,000');
  toTheCent(cost(145_000), 1_750 * 0.099 + 0.099, '$145,000');
  // Written out, because these are the numbers the module header claims.
  toTheCent(cost(125_000), 153.2125, '$125,000 by hand');
  toTheCent(cost(135_000), 173.3475, '$135,000 by hand');
  // And the point of the test: the first two are cheaper than the last three,
  // by the difference between 8.75% and 9.9% of $1,750.
  toTheCent(cost(135_000) - cost(125_000), 1_750 * (0.099 - 0.0875), 'the gap');
});

test("Oregon's top rate does not reach a single filer until $133,161 of federal AGI", () => {
  // Nominally it begins at $125,000. The state's own subtraction keeps Oregon
  // taxable income below the threshold until $133,161, which is the single most
  // useful thing in this module that no rate table can show.
  assert.ok(or({ agi: 133_160, fedTax: 20_000 }).taxableIncome <= 125_000, 'at $133,160');
  assert.ok(or({ agi: 133_161, fedTax: 20_000 }).taxableIncome > 125_000, 'at $133,161');
});

test('the chart is exactly marriage-neutral', () => {
  // A separate return gets half the ceiling at the SAME thresholds, not half the
  // thresholds — so 2 x sep(x) = single(x) = joint(2x) at every income. No other
  // chart in this package balances.
  for (const year of [2025, 2026]) {
    const steps = getStateDefinition('OR', year).federalIncomeTaxDeduction.capSteps;
    const single = steps.single;
    const separate = steps.marriedFilingSeparately;
    const joint = steps.marriedFilingJointly;
    for (let i = 0; i < single.length; i += 1) {
      assert.equal(separate[i].from, single[i].from, `${year} separate threshold ${i}`);
      money(separate[i].amount * 2, single[i].amount, `${year} separate amount ${i}`);
      money(joint[i].amount, single[i].amount, `${year} joint amount ${i}`);
      if (i > 0) {
        assert.equal(joint[i].from, single[i].from * 2, `${year} joint threshold ${i}`);
      }
    }
  }
});

test('the ceiling rose from $8,500 to $8,750, which an uprated estimate would have missed', () => {
  // The 2026 figures come from the Department of Revenue's own 2026 withholding
  // formula. An inflation-uprated estimate from the 2025 figure, rounded down to
  // the nearest $50 the way the series behaves, gives $8,700 — so this is one of
  // the places where a published document and a model's forecast differ, and the
  // document exists.
  const ceiling = (year) =>
    getStateDefinition('OR', year).federalIncomeTaxDeduction.capSteps.single[0].amount;
  money(ceiling(2025), 8_500, '2025');
  money(ceiling(2026), 8_750, '2026');
});

// ---------------------------------------------------------------------------
// The credit list that is pairwise different in all three states
// ---------------------------------------------------------------------------

test('Oregon subtracts the refundable credits EXCEPT the earned income credit', () => {
  const lists = {
    AL: getStateDefinition('AL', 2026).federalIncomeTaxDeduction.refundableCredits,
    MO: getStateDefinition('MO', 2026).federalIncomeTaxDeduction.refundableCredits,
    OR: getStateDefinition('OR', 2026).federalIncomeTaxDeduction.refundableCredits,
  };
  assert.ok(lists.AL.includes('earnedIncomeCredit'), 'Alabama takes the EITC out');
  assert.ok(lists.MO.includes('earnedIncomeCredit'), 'Missouri takes the EITC out');
  assert.ok(!lists.OR.includes('earnedIncomeCredit'), 'Oregon leaves the EITC in');
  assert.ok(!lists.MO.includes('additionalChildTaxCredit'), 'Missouri leaves the CTC in');
  assert.ok(lists.OR.includes('additionalChildTaxCredit'), 'Oregon takes the CTC out');
  // No two of the three are the same list, which is the whole reason this is a
  // declared list and not a constant inside the engine.
  const seen = new Set(Object.values(lists).map((l) => [...l].sort().join(',')));
  assert.equal(seen.size, 3, 'three states, three distinct lists');
});

test('the federal EITC does not touch the Oregon subtraction', () => {
  // The same $6,000 of federal earned income credit raises an Alabama bill, is
  // irrelevant to the Oregon subtraction, and lowers the Oregon total through
  // the state match instead.
  const base = or({ agi: 40_000, fedTax: 2_000 });
  const r = stateIncomeTax({
    state: 'OR',
    year: 2026,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: 40_000,
      deduction: STD_2026.single,
      deductionKind: 'standard',
      taxableIncome: 40_000 - STD_2026.single,
      incomeTaxBeforeRefundableCredits: 2_000,
      earnedIncomeCredit: 6_000,
    },
    earnedIncome: 40_000,
  });
  money(
    r.stateAdjustedGrossIncome,
    base.stateAdjustedGrossIncome,
    'the EITC leaves Oregon AGI alone',
  );
});

// ---------------------------------------------------------------------------
// The earned income credit, and the rate SB 1507 moved
// ---------------------------------------------------------------------------

test('the match is 9% and 12% in 2025 and 14% and 17% in 2026', () => {
  const run = (year, ages) =>
    stateIncomeTax({
      state: 'OR',
      year,
      filingStatus: 'headOfHousehold',
      federal: {
        adjustedGrossIncome: 25_000,
        deduction: year >= 2026 ? STD_2026.headOfHousehold : STD_2025.headOfHousehold,
        deductionKind: 'standard',
        taxableIncome: 0,
        incomeTaxBeforeRefundableCredits: 0,
        earnedIncomeCredit: 4_328,
      },
      earnedIncome: 25_000,
      dependents: ages.length,
      dependentAges: ages,
    }).credits.find((c) => c.name === 'Oregon earned income credit').amount;
  money(run(2025, [8]), 4_328 * 0.09, '2025, no young child');
  money(run(2025, [2]), 4_328 * 0.12, '2025, child of 2');
  money(run(2026, [8]), 4_328 * 0.14, '2026, no young child');
  money(run(2026, [2]), 4_328 * 0.17, '2026, child of 2');
  // SB 1507 is worth more than half the credit again: $216.40 a year on this
  // household, and the package covers both sides of it.
  money(run(2026, [8]) - run(2025, [8]), 4_328 * 0.05, 'what SB 1507 moved');
});

test('"under the age of three" is stored as the inclusive age 2', () => {
  const rule = getStateDefinition('OR', 2026).earnedIncomeCredit;
  assert.equal(rule.youngChildMaxAge, 2);
  const run = (age) =>
    stateIncomeTax({
      state: 'OR',
      year: 2026,
      filingStatus: 'headOfHousehold',
      federal: {
        adjustedGrossIncome: 25_000,
        deduction: STD_2026.headOfHousehold,
        deductionKind: 'standard',
        taxableIncome: 0,
        incomeTaxBeforeRefundableCredits: 0,
        earnedIncomeCredit: 4_328,
      },
      earnedIncome: 25_000,
      dependents: 1,
      dependentAges: [age],
    }).credits.find((c) => c.name === 'Oregon earned income credit').amount;
  money(run(2), 4_328 * 0.17, 'a two-year-old qualifies');
  money(run(3), 4_328 * 0.14, 'a three-year-old does not');
});

// ---------------------------------------------------------------------------
// The Oregon Kids Credit: a phase-out defined by a width
// ---------------------------------------------------------------------------

const kids = (agi, n, year = 2026, age = 3) =>
  stateIncomeTax({
    state: 'OR',
    year,
    filingStatus: 'marriedFilingJointly',
    federal: {
      adjustedGrossIncome: agi,
      deduction: year >= 2026 ? STD_2026.joint : STD_2025.joint,
      deductionKind: 'standard',
      taxableIncome: Math.max(0, agi - (year >= 2026 ? STD_2026.joint : STD_2025.joint)),
      incomeTaxBeforeRefundableCredits: 0,
    },
    earnedIncome: agi,
    dependents: n,
    dependentAges: Array(n).fill(age),
  }).credits.find((c) => c.name === 'Oregon Kids Credit').amount;

test('the credit is $1,050 a child under six, up to five of them', () => {
  money(kids(20_000, 1), 1_050, 'one child');
  money(kids(20_000, 5), 5_250, 'five children');
  money(kids(20_000, 6), 5_250, 'and a sixth adds nothing');
  money(kids(20_000, 2, 2026, 6), 0, 'a six-year-old does not qualify');
  money(kids(20_000, 2, 2026, 5), 2_100, 'a five-year-old does');
});

test('the phase-out is a WIDTH, so the implied marginal rate grows with the family', () => {
  // $5,000 of Oregon AGI takes the whole credit, whatever its size — so the rate
  // is credit/width and rises with the number of children. At the statutory
  // maximum of five it exceeds 100%.
  for (const [n, rate] of [[1, 0.21], [3, 0.63], [4, 0.84], [5, 1.05]]) {
    const lost = kids(26_550, n) - kids(31_550, n);
    money(lost / 5_000, rate, `${n} children`);
  }
  // Which means a family with five children under six is strictly worse off at
  // the top of the band than at the bottom, before Oregon's own rate and before
  // anything federal.
  assert.ok(kids(26_550, 5) - kids(31_550, 5) > 5_000, 'more than the income that caused it');
});

test('the credit is withdrawn linearly and is gone at the top of the band', () => {
  money(kids(26_550, 2), 2_100, 'at the threshold');
  money(kids(29_050, 2), 1_050, 'half way');
  money(kids(31_550, 2), 0, 'at the top');
  money(kids(40_000, 2), 0, 'and above it');
});

test('the Kids Credit reads OREGON AGI, so the federal tax subtraction buys some back', () => {
  // The placement of the federal tax subtraction is load-bearing exactly here: a
  // family whose federal bill lowers Oregon AGI is further down the Kids Credit
  // phase-out than their federal AGI alone would put them.
  const withFederalTax = stateIncomeTax({
    state: 'OR',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: {
      adjustedGrossIncome: 30_000,
      deduction: STD_2026.joint,
      deductionKind: 'standard',
      taxableIncome: 0,
      incomeTaxBeforeRefundableCredits: 2_000,
    },
    earnedIncome: 30_000,
    dependents: 1,
    dependentAges: [3],
  }).credits.find((c) => c.name === 'Oregon Kids Credit').amount;
  // Oregon AGI is 30,000 - 2,000 = 28,000, which is $1,450 into a $5,000 band,
  // so 71% of the credit survives instead of 31%.
  money(withFederalTax, 1_050 * (1 - 1_450 / 5_000), 'with a $2,000 federal bill');
  money(kids(30_000, 1), 1_050 * (1 - 3_450 / 5_000), 'without one');
  assert.ok(withFederalTax > kids(30_000, 1), 'the federal bill bought credit back');
});

// ---------------------------------------------------------------------------
// The exemption credit, and the word "exceed"
// ---------------------------------------------------------------------------

test('the exemption credit is a cliff whose boundary filer KEEPS it', () => {
  // ORS 316.085(5) allows it where federal AGI "does not exceed" the figure, so
  // the filer standing exactly on $100,000 keeps it — the opposite of Ohio's
  // § 5747.022, which allows its credit only BELOW the figure.
  const credit = (agi) =>
    or({ agi, fedTax: 0 }).credits.find((c) => c.name === 'Oregon exemption credit').amount;
  money(credit(99_999), 263, 'below');
  money(credit(100_000), 263, 'exactly on it');
  money(credit(100_001), 0, 'and a dollar over');
});

test('a SEPARATE return claims the spouse too, where the spouse has no income', () => {
  // The defect the differential grid found, and the reason it is worth having.
  // Oregon's instructions let a filer "filing separately but your spouse has no
  // income", whose spouse "can't be claimed as a dependent on someone else's
  // return", check the Regular exemption box for the spouse — so a separate
  // Oregon return claims TWO exemption credits. This package claimed one, and was
  // $263 too high for every such return, until PolicyEngine's answer for a
  // separate filer with a $55,000 pension came back $251.91 lower.
  const run = (extra) =>
    or({
      agi: 55_000,
      fedTax: 4_420,
      filingStatus: 'marriedFilingSeparately',
      ...extra,
    });
  const credit = (r) =>
    r.credits.find((c) => c.name === 'Oregon exemption credit').amount;
  money(credit(run({})), 263, 'one credit without the spouse');
  money(
    credit(run({ spouseHasNoGrossIncomeAndIsNotADependent: true })),
    526,
    'two with them',
  );
  // And the input is required rather than assumed: a return that does not say
  // gets one credit, which is the answer that does not flatter the filer.
  money(
    run({}).tax - run({ spouseHasNoGrossIncomeAndIsNotADependent: true }).tax,
    263,
    'what the spouse is worth',
  );
});

test('the spouse is claimed on a SEPARATE return and nowhere else', () => {
  const rule = getStateDefinition('OR', 2026).exemptionCredit;
  assert.equal(rule.separateReturnSpouse.spouse, 'claimed');
  // A joint return already counts two people, so the flag must not add a third.
  const joint = or({
    agi: 55_000,
    fedTax: 4_420,
    filingStatus: 'marriedFilingJointly',
    spouseHasNoGrossIncomeAndIsNotADependent: true,
  });
  money(
    joint.credits.find((c) => c.name === 'Oregon exemption credit').amount,
    526,
    'two and not three',
  );
  // And a single filer has no spouse to claim.
  const single = or({
    agi: 55_000,
    fedTax: 4_420,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
  });
  money(
    single.credits.find((c) => c.name === 'Oregon exemption credit').amount,
    263,
    'one',
  );
});

test('Ohio and California are deliberately NOT given the separate-return spouse', () => {
  // Day 30's rule: a provision read for one state is not evidence about another.
  // The field was added for Oregon because Oregon's instructions were read; a
  // default of 'claimed' would have answered the question for two states nobody
  // has asked it of, and changed both their answers.
  for (const state of ['OH', 'CA']) {
    const rule = getStateDefinition(state, 2026).exemptionCredit;
    assert.ok(rule !== undefined, `${state} has an exemption credit`);
    assert.equal(
      rule.separateReturnSpouse,
      undefined,
      `${state} has not been read on the separate-return spouse`,
    );
  }
});

test('the credit is per person and worth $256 in 2025 and $263 in 2026', () => {
  const run = (year, status, dependents) =>
    stateIncomeTax({
      state: 'OR',
      year,
      filingStatus: status,
      federal: {
        adjustedGrossIncome: 50_000,
        deduction: STD_2026.single,
        deductionKind: 'standard',
        taxableIncome: 34_000,
        incomeTaxBeforeRefundableCredits: 0,
      },
      earnedIncome: 50_000,
      dependents,
      dependentAges: Array(dependents).fill(10),
    }).credits.find((c) => c.name === 'Oregon exemption credit').amount;
  money(run(2025, 'single', 0), 256, '2025 single');
  money(run(2026, 'single', 0), 263, '2026 single');
  money(run(2026, 'marriedFilingJointly', 0), 526, '2026 joint is two people');
  money(run(2026, 'marriedFilingJointly', 2), 1_052, '2026 family of four');
  // A credit and not an exemption, so it is worth the same at every rate.
  money(run(2026, 'single', 0), 263, 'the same $263 whatever the bracket');
});

// ---------------------------------------------------------------------------
// The aged-or-blind addition, which lives inside the standard deduction
// ---------------------------------------------------------------------------

test('a single filer of 65 gets MORE than a joint filer, per person', () => {
  // The only figure in this package where that is true: $1,200 single or head of
  // household against $1,000 each on a joint return.
  const rule = getStateDefinition('OR', 2026).standardDeductionAgedOrBlindAddition;
  money(rule.amount.single, 1_200, 'single');
  money(rule.amount.headOfHousehold, 1_200, 'head of household');
  money(rule.amount.marriedFilingJointly, 1_000, 'joint');
  assert.ok(rule.amount.single > rule.amount.marriedFilingJointly, 'single exceeds joint');
});

test('the age and blindness additions stack on one person', () => {
  const deduction = (opts) => or({ agi: 60_000, fedTax: 0, ...opts }).deduction;
  money(deduction({}), 2_910, 'neither');
  money(deduction({ filerAge: 65 }), 2_910 + 1_200, '65');
  money(deduction({ blindOrDisabled: 1 }), 2_910 + 1_200, 'blind');
  money(deduction({ filerAge: 65, blindOrDisabled: 1 }), 2_910 + 2_400, 'both, on one person');
  money(deduction({ filerAge: 64 }), 2_910, 'and 64 is not 65');
});

test('an itemizing filer loses the age addition with the standard deduction', () => {
  // The addition is INSIDE the standard deduction — ORS 316.695(8) — so the
  // figure it is part of is the one compared with the itemized total. Every aged
  // EXEMPTION in this package survives itemizing; this does not.
  const itemized = or({
    agi: 60_000,
    fedTax: 0,
    filerAge: 65,
    stateItemizedDeductions: 9_000,
  });
  money(itemized.deduction, 9_000, 'the itemized figure wins outright');
  const standard = or({ agi: 60_000, fedTax: 0, filerAge: 65 });
  money(standard.deduction, 4_110, 'and the standard one carried the $1,200');
});

// ---------------------------------------------------------------------------
// The retirement credit the average retiree cannot reach
// ---------------------------------------------------------------------------

const retiree = ({ benefit, pension, year = 2026, status = 'single', age = 70, agi }) =>
  stateIncomeTax({
    state: 'OR',
    year,
    filingStatus: status,
    filerAge: age,
    federal: {
      adjustedGrossIncome: agi ?? pension,
      deduction: STD_2026.single,
      deductionKind: 'standard',
      taxableIncome: Math.max(0, (agi ?? pension) - STD_2026.single),
      incomeTaxBeforeRefundableCredits: 0,
    },
    taxableSocialSecurity: 0,
    retirement: { filer: { employerPlanPension: pension, socialSecurityBenefits: benefit } },
  }).credits.find((c) => c.name === 'Oregon retirement income credit').amount;

test('the base is reduced dollar for dollar by the GROSS Social Security benefit', () => {
  // 9% of the lesser of the pension and the reduced base. With $14,000 of
  // pension and no benefit the base is the whole $7,500.
  money(retiree({ benefit: 0, pension: 14_000 }), 7_500 * 0.09, 'no benefit');
  money(retiree({ benefit: 5_000, pension: 14_000 }), 2_500 * 0.09, '$5,000 of benefit');
  money(retiree({ benefit: 7_500, pension: 14_000 }), 0, 'and $7,500 kills it outright');
  money(retiree({ benefit: 20_000, pension: 14_000 }), 0, 'as does an ordinary benefit');
});

test('it is the LESSER of the pension and the base', () => {
  money(retiree({ benefit: 0, pension: 3_000 }), 3_000 * 0.09, 'a small pension caps it');
  money(retiree({ benefit: 0, pension: 7_500 }), 7_500 * 0.09, 'exactly on the base');
  money(retiree({ benefit: 0, pension: 50_000, agi: 14_000 }), 7_500 * 0.09, 'the base caps it');
});

test('household income above the threshold reduces the base again', () => {
  // Household income is federal AGI plus tax-exempt interest less the taxable
  // benefit. $20,000 of AGI is $5,000 over the $15,000 single threshold.
  money(retiree({ benefit: 0, pension: 20_000 }), (7_500 - 5_000) * 0.09, '$5,000 over');
  money(retiree({ benefit: 0, pension: 22_500 }), 0, 'and $7,500 over ends it');
});

test('the age test is 62 and it is on the person', () => {
  assert.equal(getStateDefinition('OR', 2026).reducedBaseRetirementCredit.minimumAge, 62);
  money(retiree({ benefit: 0, pension: 14_000, age: 62 }), 675, 'at 62');
  money(retiree({ benefit: 0, pension: 14_000, age: 61 }), 0, 'and nothing at 61');
});

test('none of the five retirement figures has moved since 2018', () => {
  const a = getStateDefinition('OR', 2025).reducedBaseRetirementCredit;
  const b = getStateDefinition('OR', 2026).reducedBaseRetirementCredit;
  assert.equal(a.rate, b.rate);
  assert.deepEqual(a.base, b.base);
  assert.deepEqual(a.householdIncomeThreshold, b.householdIncomeThreshold);
  assert.equal(a.minimumAge, b.minimumAge);
});

// ---------------------------------------------------------------------------
// Social Security, and the kicker that is in one year and not the other
// ---------------------------------------------------------------------------

test('Oregon does not tax Social Security', () => {
  const r = stateIncomeTax({
    state: 'OR',
    year: 2026,
    filingStatus: 'single',
    filerAge: 70,
    federal: {
      adjustedGrossIncome: 50_000,
      deduction: STD_2026.single,
      deductionKind: 'standard',
      taxableIncome: 50_000 - STD_2026.single,
      incomeTaxBeforeRefundableCredits: 0,
    },
    taxableSocialSecurity: 18_000,
  });
  money(r.stateAdjustedGrossIncome, 32_000, 'the whole taxable benefit comes out');
});

test('the 2025 return carries a kicker note and the 2026 return does not', () => {
  // The kicker is a BIENNIUM, not a phase-in: the credit lands on odd tax years
  // because the biennium it measures ends on 30 June of odd years. It is the one
  // provision in this package that exists in one of the two supported years and
  // not the other for that reason.
  // Matched on the CONDITIONAL note's own words. The static note list carries a
  // "THE KICKER IS NOT MODELLED" entry in both years — which is right, because
  // the rule is absent from the package in both — and the first draft of this
  // test matched that instead and could not fail.
  const note = (year) =>
    or({ agi: 60_000, fedTax: 5_000, year }).notes.some((n) =>
      n.includes('TAX YEAR 2025 HAS A KICKER'),
    );
  assert.ok(note(2025), '2025 says so');
  assert.ok(!note(2026), '2026 does not');
  // And the rate itself is named in the note rather than left as "a kicker".
  const text = or({ agi: 60_000, fedTax: 5_000, year: 2025 }).notes.join(' ');
  assert.match(text, /9\.863%/);
});

// ---------------------------------------------------------------------------
// The notes that fire when an input the answer needs is missing
// ---------------------------------------------------------------------------

test('a return with no federal tax is told what the omission cost', () => {
  const notes = or({ agi: 80_000, fedTax: 0 }).notes.join(' ');
  assert.match(notes, /NO FEDERAL INCOME TAX WAS SUPPLIED/);
});

test('a return with dependents but no ages is told about both credits', () => {
  const notes = stateIncomeTax({
    state: 'OR',
    year: 2026,
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: 25_000,
      deduction: STD_2026.headOfHousehold,
      deductionKind: 'standard',
      taxableIncome: 0,
      incomeTaxBeforeRefundableCredits: 0,
      earnedIncomeCredit: 4_328,
    },
    earnedIncome: 25_000,
    dependents: 2,
  }).notes.join(' ');
  // One note for both credits. It was two, and `notes.test.js` rejected the
  // Kids Credit half as a note nobody could read: its predicate wanted
  // dependents without ages, and every household in the battery that has
  // dependents has their ages.
  assert.match(notes, /TWO OREGON CREDITS NEED `dependentAges`/);
  assert.match(notes, /Kids Credit is \$1,050 for each dependent UNDER SIX/);
  assert.match(notes, /LOWER rate was used/);
});

test('every filing status answers, in both years', () => {
  for (const year of [2025, 2026]) {
    for (const status of FILING_STATUSES) {
      const r = or({ agi: 70_000, fedTax: 6_000, year, filingStatus: status });
      assert.ok(Number.isFinite(r.tax), `${status} ${year}`);
      assert.ok(r.tax > 0, `${status} ${year} is positive`);
    }
  }
});
