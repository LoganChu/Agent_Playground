// New Mexico — NMSA 1978 §§ 7-2-2, 7-2-5.2, 7-2-5.8, 7-2-5.13, 7-2-5.14, 7-2-7,
// 7-2-18.15, 7-2-34, 7-2-39.
//
// ## What this file is evidence of, and what it is not
//
// No New Mexico primary document was opened from the sandbox this state was
// added in: tax.newmexico.gov, realfile.tax.newmexico.gov, nmlegis.gov,
// nmonesource.com and law.justia.com all fail to resolve. So the usual Day 27
// caution applies with unusual force — a test written from the data can only
// confirm the data.
//
// TWO ASSERTIONS IN THIS FILE ESCAPE THAT, AND THEY ARE THE REASON TO TRUST THE
// REST:
//
//  1. `the TaxAct PIT-1 case reproduces` replays a household whose New Mexico
//     taxable income and tax were computed by TAXACT'S OWN PIT-1 AND PIT-ADJ
//     (TAXSIM case 907, 2025), not by this package and not by the reference
//     model. It exercises the whole single rate schedule to the top band and
//     the $2,500 capital-gains cap in one figure.
//  2. `the minus-one dependent rule reproduces an independent fixture` replays
//     a TAXSIM-derived case whose expected New Mexico taxable income is
//     $152,000 — which is $200,000 of AGI less $40,000 of federal itemized
//     deduction less $8,000 for THREE dependents. A model paying $4,000 a
//     dependent would produce $148,000 and a model paying nothing $160,000, so
//     this one figure discriminates between all three readings of § 7-2-39.
//
// Everything else here is a regression guard, a premise assertion, or a
// measurement over the whole package.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORTED_LOCALITIES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  stateIncomeTax,
} from '../dist/esm/index.js';

/** The federal deduction a New Mexico return reads off Form 1040 line 12. */
const FEDERAL_DEDUCTION = {
  2025: {
    single: 15_750,
    marriedFilingJointly: 31_500,
    marriedFilingSeparately: 15_750,
    headOfHousehold: 23_625,
    qualifyingSurvivingSpouse: 31_500,
  },
  2026: {
    single: 16_100,
    marriedFilingJointly: 32_200,
    marriedFilingSeparately: 16_100,
    headOfHousehold: 24_150,
    qualifyingSurvivingSpouse: 32_200,
  },
};
/** The § 63(f) addition per qualifying condition, which line 12 includes. */
const AGED_ADDITION = {
  2025: { single: 2_000, marriedFilingJointly: 1_600, marriedFilingSeparately: 1_600, headOfHousehold: 2_000, qualifyingSurvivingSpouse: 1_600 },
  2026: { single: 2_050, marriedFilingJointly: 1_650, marriedFilingSeparately: 1_650, headOfHousehold: 2_050, qualifyingSurvivingSpouse: 1_650 },
};

function nm(o) {
  const year = o.year ?? 2026;
  const filingStatus = o.filingStatus ?? 'single';
  let deduction = o.deduction ?? FEDERAL_DEDUCTION[year][filingStatus];
  if (o.agedBoxes) deduction += AGED_ADDITION[year][filingStatus] * o.agedBoxes;
  return stateIncomeTax({
    state: 'NM',
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: o.agi,
      taxableIncome: Math.max(0, o.agi - deduction),
      deduction,
      deductionKind: o.deductionKind ?? 'standard',
      earnedIncomeCredit: o.earnedIncomeCredit,
    },
    dependents: o.dependents,
    dependentAges: o.dependentAges,
    filerAge: o.filerAge,
    spouseAge: o.spouseAge,
    taxableSocialSecurity: o.taxableSocialSecurity,
    netCapitalGain: o.netCapitalGain,
    shortTermCapitalGains: o.shortTermCapitalGains,
    retirement: o.retirement,
    subtractions: o.subtractions,
    blindOrDisabled: o.blindOrDisabled,
    newMexicoModifiedGrossIncome: o.modifiedGrossIncome,
    taxExemptInterest: o.taxExemptInterest,
  });
}
const cents = (n) => Math.round(n * 100) / 100;

test('the TaxAct PIT-1 case reproduces, which is the only outside evidence for the rate schedule', () => {
  // TAXSIM case 907, tax year 2025, single: $145,701.33 of taxable interest and
  // $754,613.38 of long-term capital gains. The expected figures are TaxAct's
  // own PIT-1 line 17 and line 22 as the reference model's fixture records them
  // — $882,064 of New Mexico taxable income and $49,400 of tax — and they were
  // produced by filling in the form rather than by any model here.
  //
  // THIS ONE HOUSEHOLD EXERCISES THE WHOLE SINGLE SCHEDULE. $882,064 is above
  // the 5.9% threshold, so every band below it contributes, and a wrong
  // threshold or rate anywhere in the six would move the answer.
  const r = nm({ year: 2025, agi: 900_314.71, netCapitalGain: 754_613.38 });
  // TaxAct carries whole dollars of taxable income; this package carries cents.
  assert.equal(cents(r.taxableIncome), 882_064.71);
  assert.equal(cents(r.tax), 49_399.82);
  assert.ok(
    Math.abs(r.tax - 49_400) < 5,
    `inside TaxAct's own $5 margin: ${r.tax} against 49,400`,
  );
  // And the whole of the deduction is the $2,500 cap: 900,314.71 - 15,750 -
  // 2,500 = 882,064.71, which is the identity that says the 40% element did not
  // fire. A model still applying 40% to this gain would deduct $301,845.35.
  assert.equal(cents(900_314.71 - 15_750 - 2_500), 882_064.71);
});

test('the minus-one dependent rule reproduces an independent fixture, and no other reading does', () => {
  // A TAXSIM-derived case the reference model ships with an expected New Mexico
  // taxable income of $152,000: one filer of 70, a spouse of 40, THREE children
  // of 10, $200,000 of employment income and $40,000 of deductible mortgage
  // interest, so the return itemizes federally and PIT-1 line 12 is $40,000.
  //
  // 200,000 - 40,000 - 8,000 = 152,000, and the $8,000 is TWO dependents at
  // $4,000 when the return claims three. The arithmetic is run here for 2026
  // because this module covers 2025 and 2026 and the fixture's year is 2022;
  // the figures the identity turns on — the $4,000 and the subtraction of one —
  // are unindexed and identical in every year since 2019.
  const three = nm({
    filingStatus: 'marriedFilingJointly',
    agi: 200_000,
    deduction: 40_000,
    deductionKind: 'itemized',
    dependents: 3,
    dependentAges: [10, 10, 10],
  });
  assert.equal(three.taxableIncome, 152_000, "the reference model's own expected figure");

  // AND THE DISCRIMINATION IS THE POINT. The other two readings of § 7-2-39
  // produce different numbers on this household, so the fixture settles which
  // one New Mexico has.
  assert.equal(200_000 - 40_000 - 3 * 4_000, 148_000, '$4,000 a dependent would give this');
  assert.equal(200_000 - 40_000 - 0, 160_000, 'no deduction at all would give this');

  // A family with ONE child gets nothing, which is the finding.
  const one = nm({
    filingStatus: 'marriedFilingJointly',
    agi: 200_000,
    deduction: 40_000,
    deductionKind: 'itemized',
    dependents: 1,
    dependentAges: [10],
  });
  assert.equal(one.taxableIncome, 160_000);
});

test('the $4,000 overstatement is the SAME number at every family size', () => {
  // The Arkansas property, and the reason this finding is sellable: a buyer
  // checks one household and the figure they see is the figure every other
  // household shows. Each step of family size is worth exactly $4,000 of
  // deduction, so the gap between "for each dependent" and "for each dependent
  // in excess of one" never grows.
  const taxable = [1, 2, 3, 4].map(
    (n) =>
      nm({
        filingStatus: 'marriedFilingJointly',
        agi: 90_000,
        dependents: n,
        dependentAges: Array(n).fill(10),
      }).taxableIncome,
  );
  assert.deepEqual(taxable, [57_800, 53_800, 49_800, 45_800]);
  for (let i = 1; i < taxable.length; i += 1) {
    assert.equal(taxable[i - 1] - taxable[i], 4_000, 'one dependent is always $4,000');
  }
  // At $90,000 of joint AGI the deduction comes out of the 4.7% band, so the
  // error a "$4,000 a dependent" model makes is $188.00 — measured, not
  // 4,000 x a rate chosen by eye.
  const oneChild = nm({ filingStatus: 'marriedFilingJointly', agi: 90_000, dependents: 1, dependentAges: [10] });
  const twoChildren = nm({ filingStatus: 'marriedFilingJointly', agi: 90_000, dependents: 2, dependentAges: [10, 10] });
  // `taxBeforeCredits` AND NOT `tax`, SINCE DAY 68, and the reason is that the
  // second child now moves TWO provisions rather than one. The child income tax
  // credit of § 7-2-18.34 pays $106 a child at $90,000 of AGI, so the whole
  // bill differs by $294 between these two households and only $188 of that is
  // the deduction this test is about.
  //
  // > **A TEST THAT MEASURES A FINDING ON THE BOTTOM LINE MEASURES EVERY
  // > PROVISION THE INPUT TOUCHES.** This one read `tax` for a day and was
  // > right only while New Mexico had nothing else keyed to a dependent count.
  // > Adding a per-child credit broke it, which is the test doing its job —
  // > and the fix is to measure the finding where the finding happens.
  assert.equal(cents(oneChild.taxBeforeCredits - twoChildren.taxBeforeCredits), 188);
  // The whole-bill figure, pinned too, so the $188 cannot be mistaken for what
  // a second child is worth in New Mexico — which is $294 at this income.
  assert.equal(cents(oneChild.tax - twoChildren.tax), 294);
  assert.equal(cents(294 - 188), 106, 'the difference is one child of the § 7-2-18.34 credit');
});

test('§ 7-2-39 reaches two of the five statuses, and a widow is not one of them', () => {
  const def = getStateDefinition('NM', 2026);
  assert.deepEqual(def.dependentDeduction.amount, {
    single: 0,
    marriedFilingJointly: 4_000,
    marriedFilingSeparately: 0,
    headOfHousehold: 4_000,
    qualifyingSurvivingSpouse: 0,
  });
  // THE SURVIVING-SPOUSE CELL IS THE ONE THAT HAD TO BE WRITTEN OUT, because
  // `byStatus` defaults it to the joint figure and the literal reading of the
  // subsection is zero. It is worth $188.00 on a widow with two children at
  // $90,000 of AGI, which is the amount a model that defaults her to joint is
  // wrong by.
  const widow = nm({ filingStatus: 'qualifyingSurvivingSpouse', agi: 90_000, dependents: 2, dependentAges: [8, 10] });
  const asJoint = nm({ filingStatus: 'marriedFilingJointly', agi: 90_000, dependents: 2, dependentAges: [8, 10] });
  assert.equal(cents(widow.tax - asJoint.tax), 188);
  // And she reads the JOINT rate schedule, which is the half New Mexico does
  // give her: her taxable income differs from the joint household's by exactly
  // the $4,000 and by nothing else.
  assert.equal(widow.taxableIncome - asJoint.taxableIncome, 4_000);
});

test('head of household and surviving spouse read the joint rate schedule, and it is ONE object', () => {
  for (const year of [2025, 2026]) {
    const { byStatus } = getStateDefinition('NM', year).rate;
    assert.equal(
      byStatus.headOfHousehold,
      byStatus.marriedFilingJointly,
      `NM ${year}: § 7-2-7(B) writes one schedule for joint returns, surviving spouses and heads of household, so these must be the same array rather than two copies`,
    );
    assert.equal(byStatus.qualifyingSurvivingSpouse, byStatus.marriedFilingJointly);
  }
});

test('the separate schedule is exactly half the joint one at every threshold', () => {
  // An observation about two published schedules and not a relation § 7-2-7
  // states: the section writes all three out. Asserted so that a year in which
  // one column moves and the other does not fails here.
  for (const year of [2025, 2026]) {
    const { byStatus } = getStateDefinition('NM', year).rate;
    const joint = byStatus.marriedFilingJointly;
    const separate = byStatus.marriedFilingSeparately;
    assert.equal(separate.length, joint.length);
    joint.forEach((band, i) => {
      assert.equal(separate[i].rate, band.rate, `NM ${year} band ${i}: same rate`);
      if (band.upTo === Infinity) {
        assert.equal(separate[i].upTo, Infinity);
      } else {
        assert.equal(separate[i].upTo, band.upTo / 2, `NM ${year} band ${i}: half the threshold`);
      }
    });
  }
});

test('reading a head of household against the single column overcharges, and the error settles to $1,319', () => {
  // The figures a model defaulting a head of household to the single schedule
  // produces, against the ones § 7-2-7(B) gives. Taken on the schedules
  // directly so the deduction does not enter: these are tax on net taxable
  // income, which is the figure PIT-1 line 17 carries.
  const { byStatus } = getStateDefinition('NM', 2026).rate;
  const taxOn = (brackets, income) => {
    let remaining = income;
    let floor = 0;
    let tax = 0;
    for (const band of brackets) {
      const width = Math.min(remaining, band.upTo - floor);
      if (width <= 0) break;
      tax += width * band.rate;
      remaining -= width;
      floor = band.upTo;
    }
    return cents(tax);
  };
  const rows = [66_500, 100_000, 210_000, 315_000, 400_000].map((income) => [
    income,
    taxOn(byStatus.headOfHousehold, income),
    taxOn(byStatus.single, income),
  ]);
  assert.deepEqual(rows, [
    [66_500, 2_514.5, 2_716.5],
    [100_000, 4_089, 4_358],
    [210_000, 9_479, 9_748],
    [315_000, 14_624, 15_943],
    [400_000, 19_639, 20_958],
  ]);
  // The gap is CONSTANT above $315,000, because both schedules run at 5.9%
  // there. $1,319.00 at every net taxable income from that point on.
  assert.equal(rows[3][2] - rows[3][1], 1_319);
  assert.equal(rows[4][2] - rows[4][1], 1_319);
  // And constant at $269.00 from $100,000 to $210,000, for the same reason one
  // band down.
  assert.equal(rows[1][2] - rows[1][1], 269);
  assert.equal(rows[2][2] - rows[2][1], 269);
});

test("the low- and middle-income exemption's income limit can zero a positive exemption in NO household", () => {
  // § 7-2-5.8 prints a taper AND a limit, and each limit is exactly where its
  // own taper reaches zero. THE PREMISE IS WHAT IS ASSERTED, because nothing in
  // a suite of answers can see a redundant rule stop being redundant: the day
  // one of the two figures moves and the other does not, a cliff appears that
  // no answer-level test is looking for.
  const def = getStateDefinition('NM', 2026).lowAndMiddleIncomeExemption;
  for (const status of ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'qualifyingSurvivingSpouse']) {
    const end = def.reductionStart[status] + def.maxPerExemption / def.reductionRate[status];
    const limit = def.incomeLimit[status];
    assert.ok(
      limit >= end - 1 && limit <= Math.ceil(end),
      `${status}: the printed limit ${limit} must be where the taper ends (${end.toFixed(2)}), or the limit becomes a cliff`,
    );
  }
  // The single row is the one that is not exact, and it is a THIRD OF A DOLLAR
  // wide: 20,000 + 2,500/0.15 = 36,666.666..., against a printed 36,667. This
  // package clamps the per-exemption amount at zero; the independent reference
  // model does not, so inside this window that model computes a NEGATIVE
  // exemption and adds it to taxable income.
  assert.equal(def.incomeLimit.single, 36_667);
  assert.equal(cents(2_500 - 0.15 * (36_667 - 20_000)), -0.05);
  // Measured here: the tax rises smoothly across the window and the boundary,
  // with no step at either end.
  const taxes = [36_666, 36_667, 36_668].map((agi) => cents(nm({ agi }).tax));
  assert.deepEqual(taxes, [609.33, 609.38, 609.42]);
  for (let i = 1; i < taxes.length; i += 1) {
    assert.ok(taxes[i] - taxes[i - 1] < 0.1, 'no cliff at or above the printed limit');
  }
});

test('the low- and middle-income exemption is PER EXEMPTION, and a widow counts as one', () => {
  // $2,500 is the figure the statute prints and four times it is what a joint
  // return with two children gets. The multiplier is the whole of its size.
  const couple = nm({ filingStatus: 'marriedFilingJointly', agi: 45_000 });
  const withTwo = nm({ filingStatus: 'marriedFilingJointly', agi: 45_000, dependents: 2, dependentAges: [8, 10] });
  // At $45,000 the per-exemption amount is 2,500 - 0.10 x 15,000 = $1,000.
  // Two exemptions against four is $2,000 of difference, and the dependent
  // deduction adds $4,000 for the second child: $6,000 in all.
  assert.equal(couple.taxableIncome - withTwo.taxableIncome, 6_000);

  // AND A SURVIVING SPOUSE IS ONE EXEMPTION, NOT TWO. § 151 allowed a
  // qualifying widow(er) one personal exemption: the spouse is dead. This is
  // the v0.24.0 class of defect that doubled five states' allowances for a
  // widow, and New Mexico is the first rule added since that needs the
  // distinction — so it is asserted rather than left to the helper.
  const widow = nm({ filingStatus: 'qualifyingSurvivingSpouse', agi: 45_000 });
  const joint = nm({ filingStatus: 'marriedFilingJointly', agi: 45_000 });
  // Same federal deduction, same rate schedule, same taper rate and threshold;
  // the ONLY difference is the exemption count, so the gap is one $1,000
  // per-exemption amount.
  assert.equal(widow.taxableIncome - joint.taxableIncome, 1_000);
});

test('the aged-or-blind staircase collides with the rebate table at two boundaries', () => {
  // THE MEASUREMENT, and it is here because the first draft of this module
  // priced these steps by multiplying $1,000 by two of New Mexico's six rates.
  // No filer at any of the eight boundaries is in either band: the exemption
  // expires at $28,500 of AGI for a single filer, and a single New Mexican
  // there has $8,125 of taxable income once the federal deduction and the
  // other two allowances are taken.
  const step = (base, boundary) =>
    cents(nm({ ...base, agi: boundary + 1 }).tax - nm({ ...base, agi: boundary }).tax);
  const single = { filingStatus: 'single', filerAge: 70, agedBoxes: 1 };
  // THE FIRST TWO BOUNDARIES STOPPED BEING FREE ON DAY 69 AND § 7-2-5.2 DID NOT
  // CHANGE. § 7-2-14's rebate table ends a band at $18,000 and at $19,500, and
  // so does this staircase for a single filer — so the dollar at each of those
  // two incomes is charged TWICE, once by an allowance that steps down and once
  // by a refundable rebate that steps down beside it. A filer of 70 is a
  // THREE-exemption household on Table 1 (one federal exemption plus two for
  // age), so the rebate falls $189 to $166 at $18,000 and $166 to $160 at
  // $19,500 — and those are exactly the $23 and $6 below.
  //
  // THE THIRD COLLISION COSTS NOTHING, AND THAT IS THE PART WORTH A TEST. Both
  // schedules also have a boundary at $21,000, but Table 1's $19,501-$21,000
  // and $21,001-$23,000 rows are IDENTICAL — the one duplicated pair in the
  // whole table — so the rebate does not move there. Three shared boundaries,
  // two live and one cancelled by a duplicate row.
  assert.deepEqual(
    [18_000, 19_500, 21_000, 22_500, 24_000, 25_500, 27_000, 28_500].map((b) => step(single, b)),
    [23, 6, 0, 0, 14.27, 15.01, 30.34, 32.04],
  );
  // The collision is the rebate and nothing else, shown rather than asserted
  // from the totals: the rebate's own step at each boundary accounts for the
  // whole of the difference from the pre-Day-69 figures.
  const rebateAt = (agi) =>
    nm({ ...single, agi }).credits.find((c) => c.name.includes('low income comprehensive')).amount;
  assert.deepEqual(
    [18_000, 19_500, 21_000].map((b) => rebateAt(b) - rebateAt(b + 1)),
    [23, 6, 0],
  );
  assert.equal(rebateAt(19_501), rebateAt(21_000), 'the one duplicated pair of rows');
  // THE FIGURE THE EXPLANATION TURNS ON, PINNED, because the first draft of this
  // module asserted it from arithmetic done in my head and got it wrong by
  // $725: a single New Mexican of 70 at $28,500 of AGI — the income at which
  // § 7-2-5.2's exemption expires — has $8,125 of taxable income, which is
  // inside the 3.2% band and nowhere near the 4.3% one the first draft priced
  // these steps at. $28,500 less $18,150 of federal deduction, less the table's
  // last $1,000, less § 7-2-5.8's $1,225.
  assert.equal(nm({ ...single, agi: 28_500 }).taxableIncome, 8_125);
  assert.ok(8_125 < 16_500, 'inside the 3.2% band, which is what makes the steps cheap');
  const both70 = { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70, agedBoxes: 2 };
  // AND THE JOINT STAIRCASE COLLIDES WITH THE REBATE'S ELIGIBILITY CLIFF AT
  // $36,000, WHICH IS THE WHOLE REBATE AND NOT A STEP OF IT. PIT-RC Section 2
  // says "If line 13 is MORE than $36,000, DO NOT complete line 14", so one
  // dollar there takes the LAST row's amount to nothing — and a couple both 70
  // is a SIX-exemption household (two federal exemptions plus two each for
  // age), which reads the last column: $86 for 2025, lost entire. § 7-2-5.2's
  // joint staircase steps at $36,000 too, and costs nothing there, so the
  // whole $86 is the rebate.
  assert.deepEqual(
    [30_000, 33_000, 36_000, 39_000, 42_000, 45_000, 48_000, 51_000].map((b) => step(both70, b)),
    [0, 0, 86, 0, 0, 30.02, 48.74, 64.04],
  );
  // The largest step in the state, and it is the joint $51,000 boundary because
  // BOTH people's exemptions fall on the same dollar: $2,000 of allowance at
  // 3.2%, plus four cents of the low- and middle-income taper, which is zero
  // there for a different reason — it ends at $55,000.
  assert.equal(step(both70, 51_000), 64.04);
});

test('aged and blind do not stack on one person, which is the opposite of § 63(f)', () => {
  // § 7-2-5.2 reaches a person "sixty-five years of age or older OR blind", so
  // the rule counts PEOPLE and not conditions. There is no input that would let
  // a single filer claim it twice, and the shape of the rule is what says so:
  // it carries an age and a step table and no per-condition multiplier.
  const rule = getStateDefinition('NM', 2026).agedOrBlindExemptionSteps;
  assert.equal(rule.age, 65);
  assert.equal(Object.keys(rule).sort().join(','), 'age,cite,steps');
  // A joint return with one person of 65 gets one amount and with two gets two.
  // $45,000 of AGI rather than $40,000, because at $40,000 both households have
  // no taxable income at all and the comparison would be vacuous — which is the
  // same fact the staircase test above measures: these allowances expire at
  // incomes where the federal deduction has already taken the tax to zero.
  const one = nm({ filingStatus: 'marriedFilingJointly', agi: 45_000, filerAge: 70, spouseAge: 60, agedBoxes: 1 });
  const two = nm({ filingStatus: 'marriedFilingJointly', agi: 45_000, filerAge: 70, spouseAge: 70, agedBoxes: 2 });
  assert.ok(one.taxableIncome > 0 && two.taxableIncome > 0, 'both households must have taxable income');
  // The table gives $3,000 each at $45,000 of joint AGI — the sixth row, since
  // $45,000 is exactly the fifth boundary and the comparison is inclusive — and
  // the second person's § 63(f) addition is $1,650 on top, so the gap is
  // $4,650 of allowance for one extra person of 65.
  assert.equal(one.taxableIncome - two.taxableIncome, 4_650);
});

test('the Social Security exemption is a cliff, the boundary is inclusive, and the three figures are unindexed', () => {
  const limit = getStateDefinition('NM', 2026).taxableSocialSecurityLimit.atOrBelow;
  assert.deepEqual(limit, {
    single: 100_000,
    marriedFilingJointly: 150_000,
    marriedFilingSeparately: 75_000,
    headOfHousehold: 150_000,
    qualifyingSurvivingSpouse: 150_000,
  });
  // UNINDEXED: identical in both years. HB 249 of 2024 would have indexed all
  // three from tax year 2025 and was postponed indefinitely on 6 February 2024.
  assert.deepEqual(getStateDefinition('NM', 2025).taxableSocialSecurityLimit.atOrBelow, limit);

  // The boundary is inclusive — "does not exceed" — so a filer exactly at the
  // figure keeps the whole exemption.
  const at = nm({ filingStatus: 'marriedFilingJointly', agi: 150_000, taxableSocialSecurity: 60_000, filerAge: 70, spouseAge: 70 });
  const over = nm({ filingStatus: 'marriedFilingJointly', agi: 150_001, taxableSocialSecurity: 60_000, filerAge: 70, spouseAge: 70 });
  assert.equal(cents(at.tax), 2_105.6);
  assert.equal(cents(over.tax), 4_961.25);
  assert.equal(cents(over.tax - at.tax), 2_855.65);
  // The naive `benefit x top rate` product overstates it, because $60,000 of
  // benefit straddles the 4.7% and 4.9% bands.
  assert.equal(cents(60_000 * 0.049), 2_940);
  assert.ok(2_940 - 2_855.65 > 84, 'the product is $84.35 high, which is why the figure is measured');

  // And it scales with the benefit rather than with the income.
  const big = (agi) => nm({ filingStatus: 'marriedFilingJointly', agi, taxableSocialSecurity: 85_000, filerAge: 70, spouseAge: 70 }).tax;
  assert.equal(cents(big(150_001) - big(150_000)), 3_961.85);
});

test('NEW MEXICO HAS THE LARGEST LIVE SOCIAL SECURITY DISCONTINUITY HERE, AND THE SET IS WALKED', () => {
  // Day 66's rule: a sentence with "largest" in it is a claim about a set, and
  // the way to check it is to walk the set. The set here is every state-year
  // this package ships, and the probe is the same household in each: a couple
  // both 70 with $60,000 of federally taxable Social Security benefit, swept
  // across federal AGI, looking for the largest jump in tax caused by ONE
  // DOLLAR.
  //
  // The sweep is coarse on purpose — the thresholds this is looking for are
  // round numbers — and it is a lower bound on every state including this one,
  // which is the right direction for a superlative: a state whose cliff this
  // sweep misses can only make the claim weaker, and the claim is about the
  // state the sweep FINDS.
  const probes = [];
  for (let agi = 20_000; agi <= 260_000; agi += 5_000) probes.push(agi);
  for (const extra of [75_000, 100_000, 150_000]) probes.push(extra);

  const worst = new Map();
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      if (!getStateDefinition(state, year)) continue;
      let biggest = 0;
      for (const agi of probes) {
        const base = {
          state,
          year,
          filingStatus: 'marriedFilingJointly',
          dependents: 0,
          filerAge: 70,
          spouseAge: 70,
          taxableSocialSecurity: 60_000,
          // The two states with no federal starting line need their own base,
          // and a state that does not read these ignores them.
          pennsylvaniaTaxableIncome: agi,
          newJerseyGrossIncome: agi,
          massachusettsFivePercentIncome: agi,
        };
        const of = (a) =>
          stateIncomeTax({
            ...base,
            pennsylvaniaTaxableIncome: a,
            newJerseyGrossIncome: a,
            massachusettsFivePercentIncome: a,
            federal: {
              adjustedGrossIncome: a,
              taxableIncome: Math.max(0, a - 32_200),
              deduction: 32_200,
              deductionKind: 'standard',
            },
          }).tax;
        const jump = of(agi + 1) - of(agi);
        if (jump > biggest) biggest = jump;
      }
      if (biggest > 1) worst.set(`${state}:${year}`, cents(biggest));
    }
  }

  // Every state-year with a discontinuity bigger than a dollar on this
  // household. A state arriving here, or a figure moving, fails this test —
  // which is the point: the superlative is maintained by measurement.
  const ranked = [...worst.entries()].sort((a, b) => b[1] - a[1]);
  assert.ok(ranked.length > 0, 'the probe finds something, or it is not probing');
  assert.equal(
    ranked[0][0].slice(0, 2),
    'NM',
    `the largest Social Security discontinuity on this household belongs to New Mexico; found ${JSON.stringify(ranked.slice(0, 4))}`,
  );
  assert.equal(ranked[0][1], 2_855.65);
});

test('the armed forces exemption is $30,000 with no age test, in both years', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('NM', year).militaryRetirementSubtraction;
    // The two caps are deliberately equal: § 7-2-5.13 has no age condition, so
    // `ageThreshold` is unreachable and a retiree of 42 and one of 72 exempt
    // the same figure. Asserted because a cap that differed by age would be a
    // silent change in a rule the statute does not condition.
    assert.equal(rule.capUnderAge, 30_000);
    assert.equal(rule.capAtOrAboveAge, 30_000);
  }
  const young = nm({ agi: 50_000, filerAge: 42, retirement: { filer: { militaryRetirement: 50_000 } } });
  const old = nm({ agi: 50_000, filerAge: 70, agedBoxes: 1, retirement: { filer: { militaryRetirement: 50_000 } } });
  // 50,000 - 16,100 - 30,000 = 3,900 for the younger filer; the older one has
  // the § 63(f) addition inside line 12 as well.
  assert.equal(young.taxableIncome, 3_900);
  assert.equal(old.taxableIncome, 3_900 - 2_050);
});

test('exactly two New Mexico provisions are unpublished for 2026, and both are the indexed ones', () => {
  // THE SAMENESS OF THE TWO YEARS IS THE STATUTE AND NOT A CARRY-FORWARD, for
  // every figure but one. HB 252 of 2024 wrote the rate schedules for taxable
  // years beginning on or after 1 January 2025 with no cost-of-living
  // provision, and §§ 7-2-5.2, 7-2-5.8, 7-2-5.14, 7-2-34 and 7-2-39 are flat
  // amounts with no indexing clause.
  //
  // §§ 7-2-18.34(D) AND 7-2-14 ARE THE EXCEPTIONS AND THEY ARE THE WHOLE OF
  // THEM. The child income tax credit's seven per-child amounts and the low
  // income comprehensive tax rebate's 23 rows of amounts are the only indexed
  // figures in the New Mexico income tax, which is why this state's provisional
  // list is exactly thirty entries long.
  //
  // DAY 68 ASSERTED SEVEN AND CALLED THAT A PROPERTY OF NEW MEXICO. It was a
  // property of what had been modelled — exactly the trap Day 67 fell into when
  // it asserted NO provisional figure before the child credit existed — and the
  // rebate's arrival moved the number for the second time in two days without
  // anything in New Mexico changing at all. The comment is kept because the
  // shape of the error is the useful part: a provenance count is a claim about
  // this package, and it improves whenever the package models LESS.
  //
  // THE 23 REBATE ENTRIES POINT AT `rows.N.amounts` AND NOT AT `rows.N`, which
  // is the distinction worth a test of its own: § 7-2-14 indexes the amounts
  // and NOT the income bands, and all five published tables (2021 to 2025)
  // print the same 23 bands. Flagging `upTo` would claim a debt that does not
  // exist.
  assert.equal(getStateDefinition('NM', 2025).status, 'published');
  assert.equal(getStateDefinition('NM', 2025).provisionalFigures, undefined);
  const for2026 = getStateDefinition('NM', 2026);
  assert.equal(for2026.status, 'provisional');
  assert.equal(for2026.provisionalFigures.length, 30);
  const rebate = for2026.provisionalFigures.filter((e) => e.path.startsWith('lowIncomeRebate.'));
  const child = for2026.provisionalFigures.filter((e) =>
    e.path.startsWith('childIncomeTaxCredit.'),
  );
  assert.equal(rebate.length, 23);
  assert.equal(child.length, 7);
  for (const [i, entry] of child.entries()) {
    assert.equal(entry.path, `childIncomeTaxCredit.steps.${i}.amount`);
    assert.equal(entry.reason, 'awaiting-publication');
    assert.equal(entry.carriedForwardFrom, 2025);
  }
  for (const [i, entry] of rebate.entries()) {
    assert.equal(entry.path, `lowIncomeRebate.rows.${i}.amounts`);
    assert.equal(entry.reason, 'awaiting-publication');
    assert.equal(entry.carriedForwardFrom, 2025);
  }
  // And the bands themselves are NOT flagged, which is the other half of the
  // claim and the half a count cannot make.
  assert.equal(
    for2026.provisionalFigures.filter((e) => e.path.endsWith('.upTo')).length,
    0,
    "§ 7-2-14 indexes the rebate's amounts and not its income bands",
  );
  // Nothing else in the state is provisional, asserted by the path prefix
  // rather than by the count alone: a figure added to this list later would
  // otherwise pass on length while describing a different state.
  assert.ok(
    for2026.provisionalFigures.every(
      (e) =>
        e.path.startsWith('childIncomeTaxCredit.') || e.path.startsWith('lowIncomeRebate.rows.'),
    ),
    'a figure outside the child credit and the rebate is awaiting publication and should be explained',
  );
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('NM', year);
    assert.ok(def.status === 'published' || def.status === 'provisional');
  }
  // And the two definitions agree on every figure a filer reads.
  const a = getStateDefinition('NM', 2025);
  const b = getStateDefinition('NM', 2026);
  assert.deepEqual(a.rate, b.rate);
  assert.deepEqual(a.dependentDeduction, b.dependentDeduction);
  assert.deepEqual(a.lowAndMiddleIncomeExemption, b.lowAndMiddleIncomeExemption);
  assert.deepEqual(a.agedOrBlindExemptionSteps, b.agedOrBlindExemptionSteps);
  assert.deepEqual(a.capitalGainsSubtraction, b.capitalGainsSubtraction);
  // AND THE CHILD CREDIT IS THE ONE THAT MUST NOT BE COMPARED THIS WAY, because
  // its 2026 amounts are 2025's only until January 2027. Equality here is the
  // carry-forward and `provisional.test.js` is what guards it.
  assert.deepEqual(
    a.childIncomeTaxCredit.steps.map((s) => s.amount),
    b.childIncomeTaxCredit.steps.map((s) => s.amount),
  );
  // The ANSWERS still differ between the years, and the only thing that moves
  // them is the federal deduction — which is the whole claim of
  // `deduction: { kind: 'federal' }`.
  assert.notEqual(nm({ year: 2025, agi: 60_000 }).tax, nm({ year: 2026, agi: 60_000 }).tax);
});

test('the capital gains deduction is the $2,500 cap and reads IRC § 1222(11)', () => {
  const rule = getStateDefinition('NM', 2026).capitalGainsSubtraction;
  assert.equal(rule.share, 1);
  assert.equal(rule.cap, 2_500);
  assert.equal(rule.basis.kind, 'longTermNetted');
  // Capped: a $200,000 gain and a $2,000 gain get $2,500 and $2,000.
  const big = nm({ agi: 250_000, netCapitalGain: 200_000 });
  const small = nm({ agi: 60_000, netCapitalGain: 2_000 });
  assert.equal(big.taxableIncome, 250_000 - 16_100 - 2_500);
  assert.equal(small.taxableIncome, 60_000 - 16_100 - 2_000);
  // § 1222(11) is net long-term gain LESS net short-term loss, so a short-term
  // loss eats the deduction and a short-term gain cannot create one.
  const shortLoss = nm({ agi: 60_000, netCapitalGain: 2_000, shortTermCapitalGains: 1_500 });
  assert.equal(shortLoss.taxableIncome, 60_000 - 16_100 - 500);
  // What a model still applying the repealed 40% would give, which is the
  // figure the notes price: 40% of $200,000 is $80,000 of deduction against the
  // $2,500 this package allows, and the $77,500 of difference comes out of the
  // 5.9% and 4.9% bands.
  const asForty = nm({ agi: 250_000, deduction: 16_100 + 0.4 * 200_000 });
  assert.equal(asForty.taxableIncome, 153_900);
  assert.equal(cents(big.tax), 11_010.6);
  assert.equal(cents(asForty.tax), 6_999.1);
  assert.equal(cents(big.tax - asForty.tax), 4_011.5);
});

test('the working families tax credit is 25% of the federal credit and refundable', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('NM', year).earnedIncomeCredit;
    assert.equal(rule.matchRate, 0.25);
    assert.equal(rule.refundable, true);
  }
  // Refundable means it can take the bill below zero, which is the half of
  // "refundable" a non-refundable state's test cannot see.
  const r = nm({
    filingStatus: 'headOfHousehold',
    agi: 24_000,
    dependents: 2,
    dependentAges: [6, 8],
    earnedIncomeCredit: 6_000,
  });
  // A refundable credit takes the bill BELOW zero, which is the half of
  // "refundable" that a non-refundable state's test cannot see.
  // -1,500 on Day 67, -2,774 on Day 68, -2,911 TODAY, and the state has not
  // legislated once in between. Each step is a provision this package started
  // modelling: § 7-2-18.34's child credit at $637 a child, and now § 7-2-14's
  // rebate. THREE refundable credits now, so the bill is asserted as the sum
  // and each one on its own credit line, which is where a claim about ONE
  // credit belongs.
  assert.equal(cents(r.tax), -2_911);
  assert.equal(cents(-2_911 + 1_274 + 137), -1_500, 'the rest is § 7-2-18.34 and § 7-2-14');
  // $137 is Table 1 at THREE exemptions — one head of household plus two
  // dependents — and the $23,001-$24,500 row. Modified gross income was not
  // supplied, so the engine read the floor, which for a wage household with no
  // untaxed income IS federal AGI and the answer is exact.
  const rebate = r.credits.find((c) => c.name.includes('low income comprehensive'));
  assert.equal(rebate.amount, 137);
  assert.equal(rebate.refundable, true);
  const credit = r.credits.find((c) => c.name.includes('working families'));
  assert.equal(credit.amount, 1_500, '25% of $6,000');
  assert.equal(credit.refundable, true);
});

test('New Mexico levies no local income tax', () => {
  // No city, county or school district in New Mexico levies an income tax, so
  // the state figure is the whole of a resident's income tax and `locality` is
  // never required. Asserted through the exported table rather than through a
  // definition field, because that table is what a caller reads.
  assert.equal(SUPPORTED_LOCALITIES.NM, undefined);
  assert.ok(!Object.keys(SUPPORTED_LOCALITIES).includes('NM'));
});

test('the unread \u00a7 151(b) separate-return spouse is worth $35.43 and not $33.82', () => {
  // § 7-2-5.8 multiplies $2,500 by "the number of federal exemptions". This
  // package counts one filer plus dependents on a separate return; IRC § 151(b)
  // allowed a separate filer an exemption for a spouse with no gross income who
  // is nobody's dependent, and four states here already track that through
  // `spouseHasNoGrossIncomeAndIsNotADependent`. New Mexico has not been read on
  // it and no reachable document settles it, so the gap is DECLARED in the
  // rule's cite and PRICED here.
  //
  // THE ENGINE CANNOT BE ASKED FOR THE OTHER READING, so the second exemption is
  // supplied through `subtractions` at exactly the tapered per-exemption amount,
  // which is what the cite tells a caller to do.
  //
  // > **DAY 67 PRICED THIS AT $33.82 AND THAT IS THE 2026 FIGURE, NOT THE
  // > BOUND.** The provision is in both shipped years and 2025 is worth MORE.
  // > It is Day 66's rule — a superlative needs the whole field it ranks over —
  // > met in the smallest possible way: the field was two years and only one was
  // > walked. (The 2026 figure itself was a cent out, $33.83 measured.)
  const rule = getStateDefinition('NM', 2026).lowAndMiddleIncomeExemption;
  const perExemption = (agi) =>
    agi > rule.incomeLimit.marriedFilingSeparately
      ? 0
      : Math.max(
          0,
          rule.maxPerExemption -
            Math.max(0, agi - rule.reductionStart.marriedFilingSeparately) *
              rule.reductionRate.marriedFilingSeparately,
        );
  const worth = (year, agi) =>
    cents(
      nm({ year, agi, filingStatus: 'marriedFilingSeparately' }).tax -
        nm({
          year,
          agi,
          filingStatus: 'marriedFilingSeparately',
          subtractions: perExemption(agi),
        }).tax,
    );

  // The peaks, pinned by year and by the income they sit at.
  assert.equal(worth(2025, 21_964), 35.43);
  assert.equal(worth(2026, 22_214), 33.83);

  // SWEPT, so the figures above are maxima over the whole window and not two
  // points somebody liked. Every dollar of separate AGI the question can reach.
  for (const [year, peak] of [
    [2025, 35.43],
    [2026, 33.83],
  ]) {
    let max = 0;
    for (let agi = 10_000; agi <= 30_000; agi += 1) max = Math.max(max, worth(year, agi));
    assert.equal(cents(max), peak, `${year} peaks somewhere other than ${peak}`);
  }

  // WHY 2025 IS THE LARGER YEAR, AND IT IS THE STATE'S OWN BEST FACT ABOUT
  // ITSELF. New Mexico's deduction IS the federal one, so the One Big Beautiful
  // Bill Act raising a separate filer's standard deduction from $15,750 to
  // $16,100 pushes the peak UP in income, to where § 7-2-5.8's 20% taper has
  // eaten more of the exemption. The same rolling conformity that cut New Mexico
  // tax is closing the window in which this unread question has any answer.
  assert.equal(FEDERAL_DEDUCTION[2026].marriedFilingSeparately - FEDERAL_DEDUCTION[2025].marriedFilingSeparately, 350);
  assert.ok(22_214 > 21_964, 'the peak moved up in income between the two years');

  // AND THE WINDOW IS BOUNDED AT BOTH ENDS BY A DIFFERENT PROVISION, which is
  // why the bound is tens of dollars rather than a rate times $2,500. Below the
  // federal deduction the tax is already zero; above the taper's end the
  // exemption is.
  assert.equal(worth(2026, 16_100), 0, 'at the federal deduction there is no tax to reduce');
  assert.equal(worth(2026, 27_501), 0, 'above the income limit there is no exemption');
  assert.equal(perExemption(27_500), 0, "the taper reaches zero exactly at the statute's limit");

  // The figure is in the shipped cite, so the cite and the measurement cannot
  // drift — the defect that put three wrong numbers in the repository yesterday.
  assert.match(rule.cite, /PRICED AT \$35\.43/);
  assert.match(rule.cite, /\$35\.43 at \$21,964 for 2025 against \$33\.83 at \$22,214 for 2026/);
});

test('the child income tax credit is Table 4 read as printed, band edge by band edge', () => {
  // § 7-2-18.34, and the first New Mexico rule in this package taken from a
  // PRIMARY DOCUMENT: Table 4 on page RC-11 of the Department's own 2025 PIT
  // packet, which this sandbox can fetch from the file host even though
  // tax.newmexico.gov, realfile.tax.newmexico.gov, nmlegis.gov, nmonesource.com
  // and law.justia.com all refuse to resolve.
  //
  // THE SECOND COLUMN OF THAT TABLE IS HEADED "BUT NOT OVER", so every round
  // figure is the TOP of its band and the next band opens one dollar later. The
  // pairs below are the whole of the claim: at each round figure the credit is
  // still the HIGHER amount, and one dollar past it the LOWER one.
  const perChild = (agi, extra = {}) => {
    const r = nm({
      year: 2025,
      filingStatus: 'marriedFilingJointly',
      agi,
      dependents: 2,
      dependentAges: [7, 11],
      ...extra,
    });
    const credit = r.credits.find((c) => c.name.includes('child income tax credit'));
    return credit.amount / 2;
  };

  const TABLE = [
    [0, 637],
    [25_000, 637],
    [25_001, 424],
    [50_000, 424],
    [50_001, 212],
    [75_000, 212],
    [75_001, 106],
    [100_000, 106],
    [100_001, 79],
    [200_000, 79],
    [200_001, 53],
    [350_000, 53],
    [350_001, 26],
    [1_000_000, 26],
  ];
  for (const [agi, expected] of TABLE) {
    assert.equal(perChild(agi), expected, `$${agi} of AGI`);
  }

  // THE SIX CLIFFS, priced per child, because the band edges are what a model
  // gets wrong and the amount is what it costs. $212 at $50,000 is the largest
  // and it is a quarter of the credit vanishing on one dollar of income.
  const cliffs = [25_000, 50_000, 75_000, 100_000, 200_000, 350_000].map(
    (edge) => perChild(edge) - perChild(edge + 1),
  );
  assert.deepEqual(cliffs, [213, 212, 106, 27, 26, 27]);
  assert.equal(Math.max(...cliffs), 213, 'the first edge is the largest, at $213 a child');

  // WHAT A MODEL THAT STORES THE LEFT COLUMN AS A LOWER BOUND PAYS, which is
  // the finding: one band too little at every round figure. Asserted as the
  // relation between adjacent bands rather than as a second table, so it cannot
  // drift from the steps above.
  const steps = getStateDefinition('NM', 2025).childIncomeTaxCredit.steps;
  for (let i = 1; i < steps.length; i += 1) {
    assert.equal(
      perChild(steps[i - 1].upTo),
      steps[i - 1].amount,
      'the edge pays its own band and not the one below',
    );
  }

  // A NEGATIVE AGI TAKES THE FIRST ROW, which the worksheet says in terms: "If
  // the adjusted gross income is less than zero, use the amount shown in the
  // first row of the table."
  assert.equal(perChild(-50_000), 637);
});

test('a separate New Mexico filer gets HALF the child credit and not none of it', () => {
  // § 7-2-18.34 and the PIT-RC instructions: "Married individuals filing
  // separate returns for a taxable year for which they could have filed a joint
  // return may each claim only one-half of the Child Income Tax Credit that
  // would have been claimed on a joint return."
  //
  // THIS IS WHY THE RULE IS NOT NEW JERSEY'S. N.J.S.A. 54A:4-17(c) BARS a
  // separate filer from the stepped child credit outright, and this package
  // carries that as `ineligibleFilingStatuses`. A model that reached for the
  // same field here pays a separate New Mexico filer nothing where the statute
  // gives them $318.50 on two children at $40,000 of AGI.
  const credit = (filingStatus) =>
    nm({ year: 2025, filingStatus, agi: 40_000, dependents: 2, dependentAges: [7, 11] }).credits.find(
      (c) => c.name.includes('child income tax credit'),
    ).amount;
  assert.equal(credit('marriedFilingJointly'), 848);
  assert.equal(credit('marriedFilingSeparately'), 424);
  assert.equal(credit('marriedFilingSeparately') * 2, credit('marriedFilingJointly'));
  // And the halving is the ONLY status difference: § 7-2-18.34 names no status
  // in its grant, unlike § 7-2-39, so a single filer, a head of household and a
  // surviving spouse all take the full amount. The dependent deduction of
  // § 7-2-39 reaches two statuses of five and this credit reaches all five,
  // which is the pair of facts a reader is most likely to merge.
  for (const filingStatus of ['single', 'headOfHousehold', 'qualifyingSurvivingSpouse']) {
    assert.equal(credit(filingStatus), 848, filingStatus);
  }
  const def = getStateDefinition('NM', 2025);
  assert.deepEqual(def.childIncomeTaxCredit.halvedFilingStatuses, ['marriedFilingSeparately']);
  assert.equal(def.dependentDeduction.amount.single, 0);
  assert.equal(def.childIncomeTaxCredit.refundable, true);
});

test('the child credit is refundable, and for a low-income family it is the whole answer', () => {
  // A joint New Mexico return with two children and $20,000 of wages. The
  // state's OWN tax is zero — the federal deduction alone exceeds the income —
  // so both refundable credits are money paid out.
  const r = nm({
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    agi: 20_000,
    dependents: 2,
    dependentAges: [7, 11],
    earnedIncomeCredit: 6_000,
  });
  assert.equal(cents(r.taxBeforeCredits), 0);
  // $1,274 of child credit, $1,500 of working families credit and $189 of
  // low income comprehensive tax rebate.
  assert.equal(cents(r.tax), -2_963);
  const child = r.credits.find((c) => c.name.includes('child income tax credit'));
  assert.equal(child.amount, 1_274);
  assert.equal(child.refundable, true);
  // $189 is Table 1 at FOUR exemptions — two filers plus two dependents — and
  // the $19,501-$21,000 row.
  const rebate = r.credits.find((c) => c.name.includes('low income comprehensive'));
  assert.equal(rebate.amount, 189);
  assert.equal(rebate.refundable, true);
  // WITHOUT THESE TWO RULES THE SAME HOUSEHOLD WAS COMPUTED $1,463 TOO HIGH,
  // which is what the state's own note said before Day 68 and what the
  // differential comparison measured: 46 unexplained New Mexico divergences on
  // the credit, and 13 more on the rebate that Day 68 left open.
  assert.equal(cents(-1_500 - -2_963), 1_463);
  assert.equal(cents(1_463 - 1_274), 189);
});

test('§ 152(c) is not § 32’s qualifying child, and the age test is declared where it stops', () => {
  const rule = getStateDefinition('NM', 2025).childIncomeTaxCredit;
  // § 152(c)(3)(A): under 19 at the close of the year.
  assert.equal(rule.maxAge, 18);
  const at = (age) =>
    nm({
      year: 2025,
      filingStatus: 'marriedFilingJointly',
      agi: 40_000,
      dependents: 1,
      dependentAges: [age],
    }).credits.find((c) => c.name.includes('child income tax credit')).amount;
  assert.equal(at(18), 424);
  assert.equal(at(19), 0);
  // A STUDENT UNDER 24 AND A PERMANENTLY DISABLED CHILD OF ANY AGE ALSO QUALIFY
  // UNDER § 152(c)(3) AND ARE NOT COUNTED HERE, so the credit is understated and
  // the tax overstated for those families by the whole per-child amount. The
  // omission is in the inputs rather than the statute and the note says so.
  assert.ok(
    getStateDefinition('NM', 2025).notes.some(
      (n) => /student/i.test(n) && /152\(c\)/.test(n) && /ITIN/.test(n),
    ),
    'the § 152(c) note must name the student limb and the ITIN together',
  );
  // NO AGES, NO CREDIT — deliberately, and the same decision New Jersey's
  // stepped credit makes. A count of dependents does not say they are children,
  // and guessing generously would turn a missing input into a refundable
  // credit.
  const noAges = nm({ year: 2025, filingStatus: 'marriedFilingJointly', agi: 40_000, dependents: 2 });
  assert.equal(noAges.credits.find((c) => c.name.includes('child income tax credit')).amount, 0);
});

test("New Mexico's own rate table computes $2.00 less than its own rate schedule, forever", () => {
  // READ OFF THE PIT-TRT PAGES OF THE 2025 PACKET, and it is the first finding
  // in this package that is not a model against a model: it is this package
  // against THE FORM.
  //
  // The 2025 TAX RATE TABLE is a $100-wide MIDPOINT table — the row for
  // $99,900–$100,000 prints $4,356 for a single filer, which is the exact tax at
  // $99,950 rounded. The continuation table for incomes over $100,000 then uses
  // THAT FIGURE as its base: "Single, not over $210,000: your tax is $4,356 plus
  // 4.9% of taxable income in excess of $100,000."
  //
  // So the Department's prescribed computation carries a midpoint-rounded figure
  // forward as an exact base, and every New Mexico return above $100,000 of
  // taxable income is $2.00 below the § 7-2-7 schedule — $2.50 for a separate
  // filer. It never converges, because above the breakpoint both computations
  // run at the same rate.
  //
  // > **A STATE'S RATE SCHEDULE AND ITS RATE TABLE ARE TWO DIFFERENT FUNCTIONS,
  // > AND A PACKAGE HAS TO CHOOSE.** This one computes the SCHEDULE, because
  // > § 7-2-7 is the law and the table is an aid the Department is authorised to
  // > publish. The difference is written down rather than split, and this test
  // > is what makes the claim checkable.
  const PRINTED_BASE_AT_100K = {
    single: 4_356,
    marriedFilingJointly: 4_087,
    marriedFilingSeparately: 4_492,
    headOfHousehold: 4_087,
  };
  // Taxable income of exactly $100,000, so `deduction: 0` and the AGI IS the
  // taxable income — the point is the rate schedule and nothing above it.
  const taxAtTaxableIncome = (filingStatus, ti) =>
    cents(nm({ year: 2025, filingStatus, agi: ti, deduction: 0 }).taxBeforeCredits);

  for (const [filingStatus, printed] of Object.entries(PRINTED_BASE_AT_100K)) {
    const exact = taxAtTaxableIncome(filingStatus, 100_000);
    const gap = cents(exact - printed);
    assert.equal(gap, filingStatus === 'marriedFilingSeparately' ? 2.5 : 2, filingStatus);
    // AND THE GAP IS CONSTANT ABOVE THE BREAKPOINT, which is what makes it
    // worth stating as one number. The continuation runs at the printed base
    // plus the same marginal rates this schedule uses.
    for (const ti of [150_000, 250_000, 400_000, 1_000_000]) {
      const printedTax = printedContinuation(filingStatus, ti, printed);
      assert.equal(cents(taxAtTaxableIncome(filingStatus, ti) - printedTax), gap, `${filingStatus} at ${ti}`);
    }
  }

  // The midpoint claim itself, which is where the $2.00 comes from: the printed
  // figure for the $99,900–$100,000 row IS the exact tax at $99,950, rounded.
  for (const [filingStatus, printed] of Object.entries(PRINTED_BASE_AT_100K)) {
    assert.equal(Math.round(taxAtTaxableIncome(filingStatus, 99_950)), printed, `${filingStatus} midpoint`);
  }

  // The Department's own continuation table, as published: base plus 4.9% to the
  // 5.9% breakpoint, then 5.9%. The breakpoints are the schedule's own, read
  // from the definition so the two cannot drift.
  function printedContinuation(filingStatus, ti, base) {
    const brackets = getStateDefinition('NM', 2025).rate.byStatus[filingStatus];
    const top = brackets[brackets.length - 1];
    const topFrom = brackets[brackets.length - 2].upTo;
    const fourNine = brackets[brackets.length - 2].rate;
    if (ti <= topFrom) return base + (ti - 100_000) * fourNine;
    return base + (topFrom - 100_000) * fourNine + (ti - topFrom) * top.rate;
  }
});

test('§ 7-2-18.34(D) TRUNCATES to the dollar, which rules out the 2026 projection twice over', () => {
  // TWO PUBLISHED TABLES WERE READ FROM THE DEPARTMENT'S OWN PACKETS — Table 4
  // of the 2024 PIT-RC instructions and Table 4 of the 2025 ones — and together
  // they determine the SHAPE of the subsection (D) adjustment even though
  // neither names the index it uses.
  //
  // This test is the whole justification for carrying 2025 forward into 2026
  // rather than shipping the reference model's projected figures, and it is the
  // only place in this package where a rounding RULE is inferred from published
  // data rather than read from a document.
  const BASE_2023 = [600, 400, 200, 100, 75, 50, 25];
  const PUBLISHED = {
    2024: [622, 414, 207, 103, 77, 51, 25],
    2025: [637, 424, 212, 106, 79, 53, 26],
  };

  // The 2025 column is what this package ships for both years.
  assert.deepEqual(
    getStateDefinition('NM', 2025).childIncomeTaxCredit.steps.map((s) => s.amount),
    PUBLISHED[2025],
  );

  /**
   * The interval of cumulative factors consistent with a whole published
   * column, under one rounding rule. Empty means NO single factor produces that
   * column that way — which is the finding.
   */
  const factorInterval = (published, round) => {
    let lo = 0;
    let hi = Infinity;
    for (const [i, value] of published.entries()) {
      const base = BASE_2023[i];
      const [l, h] =
        round === 'truncate'
          ? [value / base, (value + 1) / base]
          : [(value - 0.5) / base, (value + 0.5) / base];
      lo = Math.max(lo, l);
      hi = Math.min(hi, h);
    }
    return lo < hi ? [lo, hi] : null;
  };

  // ROUND-HALF-UP IS IMPOSSIBLE FOR BOTH YEARS and truncation fits both. The
  // witness is the $75 band: round-half-up needs a factor below 1.0600000 to
  // land it on $79, and the $600 band needs one at or above 1.0608333 to land
  // on $637. No number is both.
  assert.equal(factorInterval(PUBLISHED[2024], 'round'), null, '2024 under round-half-up');
  assert.equal(factorInterval(PUBLISHED[2025], 'round'), null, '2025 under round-half-up');
  const t24 = factorInterval(PUBLISHED[2024], 'truncate');
  const t25 = factorInterval(PUBLISHED[2025], 'truncate');
  assert.ok(t24 && t25, 'truncation fits both published columns');
  assert.deepEqual(t24.map((n) => n.toFixed(7)), ['1.0366667', '1.0375000']);
  assert.deepEqual(t25.map((n) => n.toFixed(7)), ['1.0616667', '1.0625000']);
  // THE $75-BAND WITNESS, stated directly so the reason survives a refactor:
  // under round-half-up the $75 band needs a factor BELOW (79+0.5)/75 to land on
  // $79, and the $600 band needs one AT OR ABOVE (637-0.5)/600 to land on $637.
  // The first ceiling is under the second floor, so no number is both.
  assert.ok(
    (79 + 0.5) / 75 < (637 - 0.5) / 600,
    'the $75 band and the $600 band cannot share a round-half-up factor',
  );

  // CONSEQUENCE ONE: A PROJECTION IN CENTS CANNOT BE WHAT NEW MEXICO PRINTS.
  // The reference model's 2026 figures are $651.44, $433.61, $216.81, $108.40,
  // $80.79, $54.20 and $26.59 — every one of them has cents, and both observed
  // columns are whole dollars reached by truncation.
  const PROJECTED_2026 = [651.44, 433.61, 216.81, 108.4, 80.79, 54.2, 26.59];
  assert.ok(
    PROJECTED_2026.some((v) => !Number.isInteger(v)),
    'the projection carries cents where the statute truncates to the dollar',
  );

  // CONSEQUENCE TWO, AND THE STRONGER ONE: THE INDEX IS WRONG TOO. The
  // projection is 2025's figures times 176.71308333/172.797 = 1.0226645, the
  // federal C-CPI-U ratio the reference model uprates with. But the one-year
  // factor New Mexico ACTUALLY realised between its own 2024 and 2025 tables
  // lies in (1.023293, 1.024920), derived from the two intervals above — and
  // the federal one-year ratio for the same pair of years is 1.0288330, outside
  // it. The federal index does not reproduce either published New Mexico
  // column, so it is not the index subsection (D) names.
  const impliedOneYear = [t25[0] / t24[1], t25[1] / t24[0]];
  assert.deepEqual(impliedOneYear.map((n) => n.toFixed(6)), ['1.023293', '1.024920']);
  const FEDERAL_ONE_YEAR_2025 = 172.797 / 167.95475;
  assert.ok(
    FEDERAL_ONE_YEAR_2025 > impliedOneYear[1],
    'the federal index over-adjusts against what New Mexico published',
  );
  // And applying the federal cumulative ratio to the 2023 base with truncation
  // gives $667 for the top band where New Mexico published $637 — $30 out on
  // one year of indexation, which is why this is not a rounding quibble.
  assert.equal(Math.floor(600 * (172.797 / 158.87191666666669)), 652);
  assert.notEqual(652, PUBLISHED[2025][0]);

  // SO 2026 CARRIES 2025 FORWARD AND SAYS SO, in seven provisionalFigures
  // entries and a note. The direction is known — every amount has risen every
  // year — so the carry-forward understates a refundable credit and overstates
  // the tax, which is the safe direction for an estimate.
  const for2026 = getStateDefinition('NM', 2026);
  assert.equal(for2026.status, 'provisional');
  assert.deepEqual(
    for2026.childIncomeTaxCredit.steps.map((s) => s.amount),
    PUBLISHED[2025],
  );
  for (let i = 1; i < 7; i += 1) {
    assert.ok(PUBLISHED[2025][i - 1] > PUBLISHED[2025][i]);
    assert.ok(PUBLISHED[2025][i] >= PUBLISHED[2024][i], 'no amount has ever fallen');
  }

  // THE BAND EDGES NEVER MOVED, which is the other half of what reading two
  // packets bought: subsection (D) adjusts the AMOUNTS and says nothing about
  // the bands, and the 2024 table prints the same seven edges as the 2025 one
  // in the same "But Not Over" shape.
  assert.deepEqual(
    getStateDefinition('NM', 2025).childIncomeTaxCredit.steps.map((s) => s.upTo),
    [25_000, 50_000, 75_000, 100_000, 200_000, 350_000, Infinity],
  );
});

// ---------------------------------------------------------------------------
// § 7-2-14's rebate table: the shipped 2025 grid, and the three earlier ones
// that are the evidence for how it is indexed.
// ---------------------------------------------------------------------------

/**
 * TABLE 1 as the Department printed it for 2021, 2023 and 2024 — 138 cells
 * each, read off the packets at the same file host the 2025 one came from.
 *
 * HERE AND NOT IN THE PACKAGE, because they are EVIDENCE and not parameters.
 * Nothing computes a 2021 New Mexico return, and shipping three dead tables to
 * every caller to support an argument made once would be the wrong trade. What
 * the package ships is the 2025 grid and a carry-forward for 2026; what this
 * file holds is the reason that carry-forward is not a projection.
 *
 * The 2022 table is omitted on purpose and its absence is an assertion below:
 * it is IDENTICAL to the 2021 one, cell for cell, and a second copy of a table
 * that must equal another is the Day 53 defect — two claims where one was
 * wanted. The test states the equality instead.
 */
const PRINTED = {
  2021: [
    [195, 260, 325, 390, 455, 520],
    [220, 315, 405, 505, 570, 675],
    [220, 315, 405, 505, 570, 705],
    [220, 315, 405, 505, 570, 730],
    [205, 310, 390, 495, 575, 730],
    [185, 285, 375, 480, 575, 700],
    [170, 250, 340, 425, 510, 665],
    [145, 210, 275, 360, 445, 600],
    [130, 185, 235, 295, 365, 480],
    [115, 170, 220, 275, 315, 390],
    [105, 155, 185, 235, 285, 335],
    [100, 130, 165, 210, 250, 300],
    [90, 115, 145, 180, 220, 260],
    [80, 105, 140, 165, 185, 230],
    [80, 105, 140, 165, 185, 230],
    [75, 100, 120, 145, 170, 195],
    [65, 90, 115, 140, 155, 180],
    [55, 80, 105, 130, 140, 170],
    [50, 75, 100, 115, 130, 155],
    [40, 55, 80, 100, 115, 130],
    [35, 50, 65, 80, 100, 105],
    [25, 40, 50, 65, 80, 90],
    [15, 35, 40, 55, 65, 75],
  ],
  2023: [
    [211, 281, 352, 422, 492, 563],
    [238, 341, 438, 546, 617, 730],
    [238, 341, 438, 546, 617, 763],
    [238, 341, 438, 546, 617, 790],
    [222, 335, 422, 536, 622, 790],
    [200, 308, 406, 519, 622, 757],
    [184, 271, 368, 460, 552, 720],
    [157, 227, 298, 390, 481, 649],
    [141, 200, 254, 319, 395, 519],
    [124, 184, 238, 298, 341, 422],
    [114, 168, 200, 254, 308, 362],
    [108, 141, 179, 227, 271, 325],
    [97, 124, 157, 195, 238, 281],
    [87, 114, 151, 179, 200, 249],
    [87, 114, 151, 179, 200, 249],
    [81, 108, 130, 157, 184, 211],
    [70, 97, 124, 151, 168, 195],
    [60, 87, 114, 141, 151, 184],
    [54, 81, 108, 124, 141, 168],
    [43, 60, 87, 108, 124, 141],
    [38, 54, 70, 87, 108, 114],
    [27, 43, 54, 70, 87, 97],
    [16, 38, 43, 60, 70, 81],
  ],
  2024: [
    [218, 291, 364, 437, 510, 583],
    [246, 353, 454, 566, 639, 757],
    [246, 353, 454, 566, 639, 791],
    [246, 353, 454, 566, 639, 819],
    [230, 347, 437, 555, 645, 819],
    [207, 319, 420, 538, 645, 785],
    [190, 280, 381, 476, 572, 746],
    [162, 235, 308, 403, 499, 673],
    [145, 207, 263, 331, 409, 538],
    [129, 190, 246, 308, 353, 437],
    [117, 173, 207, 263, 319, 375],
    [112, 145, 185, 235, 280, 336],
    [100, 129, 162, 201, 246, 291],
    [89, 117, 157, 185, 207, 258],
    [89, 117, 157, 185, 207, 258],
    [84, 112, 134, 162, 190, 218],
    [72, 100, 129, 157, 173, 201],
    [61, 89, 117, 145, 157, 190],
    [56, 84, 112, 129, 145, 173],
    [44, 61, 89, 112, 129, 145],
    [39, 56, 72, 89, 112, 117],
    [28, 44, 56, 72, 89, 100],
    [16, 39, 44, 61, 72, 84],
  ],
};

/** The feasible interval of cumulative factors under one rounding rule. */
function feasibleFactor(base, target, rule) {
  let lo = -Infinity;
  let hi = Infinity;
  for (let i = 0; i < base.length; i += 1) {
    for (let j = 0; j < base[i].length; j += 1) {
      const b = base[i][j];
      const t = target[i][j];
      // round-half-up lands on `t` for a factor in [(t-0.5)/b, (t+0.5)/b);
      // truncation for one in [t/b, (t+1)/b).
      const low = rule === 'round' ? (t - 0.5) / b : t / b;
      const high = rule === 'round' ? (t + 0.5) / b : (t + 1) / b;
      if (low > lo) lo = low;
      if (high < hi) hi = high;
    }
  }
  return { lo, hi, empty: lo >= hi };
}

/** How many of the 138 cells the best factor under `rule` can reproduce. */
function bestMatch(base, target, rule) {
  const apply = rule === 'round' ? (x) => Math.floor(x + 0.5 + 1e-9) : (x) => Math.floor(x + 1e-9);
  const candidates = new Set();
  for (let i = 0; i < base.length; i += 1) {
    for (let j = 0; j < base[i].length; j += 1) {
      for (const d of [0, 0.5, 1, -0.5]) candidates.add((target[i][j] + d) / base[i][j] + 1e-10);
    }
  }
  let best = -1;
  for (const f of candidates) {
    let hits = 0;
    for (let i = 0; i < base.length; i += 1) {
      for (let j = 0; j < base[i].length; j += 1) {
        if (apply(base[i][j] * f) === target[i][j]) hits += 1;
      }
    }
    if (hits > best) best = hits;
  }
  return best;
}

const shippedRows = (year) => getStateDefinition('NM', year).lowIncomeRebate.rows;
const shippedGrid = (year) => shippedRows(year).map((r) => [...r.amounts]);

test('the rebate table is 138 cells and it is SIX schedules, not one scaled six ways', () => {
  const rows = shippedRows(2025);
  assert.equal(rows.length, 23);
  for (const row of rows) assert.equal(row.amounts.length, 6);

  // Every row rises left to right: more exemptions is never worth less.
  for (const row of rows) {
    for (let j = 1; j < 6; j += 1) {
      assert.ok(row.amounts[j] >= row.amounts[j - 1], `row ${row.upTo} column ${j + 1}`);
    }
  }

  // THE REVERSAL AT THE BOTTOM, which is the one property of this table that
  // cannot be guessed from any summary of it: the poorest band pays LESS than
  // the next one up, in all six columns.
  const grid = shippedGrid(2025);
  assert.deepEqual(grid[0], [224, 298, 373, 448, 522, 597]);
  assert.deepEqual(grid[1], [252, 362, 465, 580, 655, 775]);
  assert.deepEqual(
    grid[1].map((v, j) => v - grid[0][j]),
    [28, 64, 92, 132, 133, 178],
    'what one dollar of modified gross income is worth at $1,000',
  );

  // And the peak is in a DIFFERENT ROW in three different places, so no single
  // profile generates the grid.
  const peakRow = (j) => grid.reduce((best, row, i) => (row[j] > grid[best][j] ? i : best), 0);
  assert.deepEqual([0, 1, 2, 3].map(peakRow), [1, 1, 1, 1], 'columns 1-4 peak at $1,001-$7,500');
  assert.equal(peakRow(4), 4, 'column 5 peaks at $7,501-$9,000');
  assert.equal(peakRow(5), 3, 'column 6 peaks at $2,501-$8,000');

  // Below the peak the grid is non-increasing down every column, which is what
  // makes a FLOOR on the income a CEILING on the rebate — the claim the derived
  // modified-gross-income figure rests on.
  for (let j = 0; j < 6; j += 1) {
    for (let i = 5; i < 23; i += 1) {
      assert.ok(grid[i][j] <= grid[i - 1][j], `column ${j + 1} rises at row ${i}`);
    }
  }

  // The one duplicated pair, which is what cancels the third collision with
  // § 7-2-5.2's staircase.
  assert.deepEqual(grid[13], grid[14]);
  assert.equal(rows[13].upTo, 21_000);
  assert.equal(rows[14].upTo, 23_000);
  const duplicates = grid.filter((row, i) => i > 0 && row.join() === grid[i - 1].join()).length;
  assert.equal(duplicates, 1, 'exactly one pair of identical rows in the whole table');
});

test('§ 7-2-14 is indexed CUMULATIVELY from the 2021 base, and the rounding rule CHANGED after 2023', () => {
  // THE ARGUMENT THAT RULES OUT A 2026 PROJECTION, AND IT IS MADE OVER 138
  // CELLS A YEAR RATHER THAN SEVEN. Day 68 made the same argument about the
  // child income tax credit from two published columns of seven amounts; here
  // the Department has published FIVE tables and each one is 138 numbers, so
  // what was an interval argument becomes an exhaustive one.
  const base = PRINTED[2021];
  const grid2025 = shippedGrid(2025);

  // (0) The 2021 and 2022 tables are identical, which is why only one is held
  // here. The 2021 one IS the statutory base the adjustment runs from.
  assert.equal(base.length, 23);
  for (const row of base) assert.equal(row.length, 6);

  // (1) EACH INDEXED YEAR IS THE BASE TIMES ONE CUMULATIVE FACTOR.
  const r2023 = feasibleFactor(base, PRINTED[2023], 'round');
  const r2024 = feasibleFactor(base, PRINTED[2024], 'trunc');
  const r2025 = feasibleFactor(base, grid2025, 'trunc');
  for (const [year, got, want] of [
    [2023, r2023, [1.082, 1.0820225]],
    [2024, r2024, [1.1220339, 1.1222222]],
    [2025, r2025, [1.1493333, 1.1494505]],
  ]) {
    assert.ok(!got.empty, `${year} has no feasible factor`);
    assert.equal(Math.round(got.lo * 1e7) / 1e7, want[0], `${year} lower bound`);
    assert.equal(Math.round(got.hi * 1e7) / 1e7, want[1], `${year} upper bound`);
  }

  // (2) THE ROUNDING RULE CHANGED, AND NEITHER YEAR IS A TYPO. Each rule fits
  // one year's 138 cells exactly and misses dozens of the other's, so this is
  // not a cell or two that could be a misprint.
  assert.equal(bestMatch(base, PRINTED[2023], 'round'), 138, '2023 is round-half-up');
  assert.equal(bestMatch(base, PRINTED[2023], 'trunc'), 100, 'and truncation misses 38 of it');
  assert.equal(bestMatch(base, PRINTED[2024], 'trunc'), 138, '2024 is truncation');
  assert.equal(bestMatch(base, PRINTED[2024], 'round'), 93, 'and rounding misses 45 of it');
  assert.equal(bestMatch(base, grid2025, 'trunc'), 138, '2025 is truncation');
  assert.equal(bestMatch(base, grid2025, 'round'), 98, 'and rounding misses 40 of it');

  // (3) CHAINING IS ARITHMETICALLY IMPOSSIBLE, which is the finding that
  // invalidates uprating the previous PUBLISHED table however good the index
  // is. No factor at all takes 2023 to 2024, or 2024 to 2025, under either
  // rule — where the base-to-2023 step works under one of them.
  for (const rule of ['round', 'trunc']) {
    assert.ok(feasibleFactor(PRINTED[2023], PRINTED[2024], rule).empty, `2023->2024 ${rule}`);
    assert.ok(feasibleFactor(PRINTED[2024], grid2025, rule).empty, `2024->2025 ${rule}`);
  }
  assert.ok(!feasibleFactor(base, PRINTED[2023], 'round').empty, 'but the base-to-2023 step fits');

  // (4) NO CELL HAS EVER FALLEN, which is the direction the carry-forward
  // relies on: carrying 2025 into 2026 understates a refundable rebate and so
  // overstates the tax.
  for (let i = 0; i < 23; i += 1) {
    for (let j = 0; j < 6; j += 1) {
      assert.ok(PRINTED[2023][i][j] >= base[i][j]);
      assert.ok(PRINTED[2024][i][j] >= PRINTED[2023][i][j]);
      assert.ok(grid2025[i][j] >= PRINTED[2024][i][j]);
    }
  }

  // (5) THE INCOME BANDS NEVER MOVED, which is why 2026 flags `amounts` and not
  // `upTo`: subsection-level indexation reaches the amounts alone.
  assert.deepEqual(shippedRows(2025).map((r) => r.upTo), shippedRows(2026).map((r) => r.upTo));
  assert.deepEqual(shippedGrid(2026), grid2025, '2026 carries 2025 forward');
});

test('the rebate is read on modified gross income, and without it the engine uses a FLOOR', () => {
  const rebate = (o) =>
    nm({ year: 2025, ...o }).credits.find((c) => c.name.includes('low income comprehensive'));

  // A pure wage household: modified gross income IS federal AGI, so the derived
  // floor is exact and the engine still says it assumed.
  const wage = rebate({ agi: 15_000 });
  assert.equal(wage.amount, 120);
  assert.match(wage.name, /assumed: modified gross income is the floor/);

  // Supplying the figure removes the assumption from the name.
  assert.equal(rebate({ agi: 15_000, modifiedGrossIncome: 15_000 }).name.includes('assumed'), false);

  // THE SOCIAL SECURITY TERM, WHICH IS THE ONE THAT MOVES REAL HOUSEHOLDS.
  // PIT-RC line 5 takes the GROSS benefit; § 86 may tax none of it. A couple on
  // $24,000 of benefit and $12,000 of pension has $12,000 of federal AGI and
  // $36,000 of modified gross income — the last dollar of the table.
  const retired = {
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    agi: 12_000,
    taxableSocialSecurity: 0,
    retirement: { filer: { socialSecurityBenefits: 24_000 }, spouse: {} },
  };
  assert.equal(rebate(retired).amount, 40, 'the floor sees the whole benefit: row $34,001-$36,000');
  assert.equal(
    rebate({ ...retired, retirement: undefined }).amount,
    212,
    'without the gross benefit the floor is AGI alone and the rebate is FIVE TIMES too generous',
  );
  // And the true figure, supplied, agrees with the floor — because for this
  // household the three terms the floor knows are the whole of PIT-RC.
  assert.equal(rebate({ ...retired, modifiedGrossIncome: 36_000 }).amount, 40);

  // Tax-exempt interest is in the floor too, and in New Mexico that is the only
  // thing it does: it changes no New Mexico tax before credits.
  assert.equal(rebate({ agi: 15_000, taxExemptInterest: 10_000 }).amount, 74);

  // A FLOOR ABOVE THE TABLE SETTLES THE ANSWER, so the engine stops saying it
  // assumed: the true figure is at or above the floor and both give zero.
  const rich = rebate({ agi: 40_000 });
  assert.equal(rich.amount, 0);
  assert.equal(rich.name.includes('assumed'), false);
});

test('the $36,000 qualification is a cliff, and the separate return is halved', () => {
  const at = (agi, o = {}) =>
    nm({ year: 2025, agi, ...o }).credits.find((c) => c.name.includes('low income comprehensive'))
      .amount;
  // PIT-RC Section 2: "If line 13 is MORE than $36,000, DO NOT complete line 14."
  assert.equal(at(36_000), 17);
  assert.equal(at(36_001), 0);
  // The non-monotonic step, live through the engine.
  assert.equal(at(1_000), 224);
  assert.equal(at(1_001), 252);
  // Halved rather than barred — § 7-2-14(A) and the Table 1 instructions.
  assert.equal(at(5_000, { filingStatus: 'marriedFilingSeparately' }), 126);
  assert.equal(at(5_000), 252);
  // Negative AGI cannot make modified gross income negative: N.M. Admin. Code
  // § 3.3.1.10 floors every item at zero, and the first row is $0-$1,000.
  assert.equal(at(-50_000), 224);
});

test('PIT-RC counts age as TWO exemptions and blindness as ONE, which no other rule here does', () => {
  const rule = getStateDefinition('NM', 2025).lowIncomeRebate;
  assert.equal(rule.agedExemptions, 2);
  assert.equal(rule.blindExemptions, 1);
  const at = (o) =>
    nm({ year: 2025, agi: 5_000, ...o }).credits.find((c) =>
      c.name.includes('low income comprehensive'),
    ).amount;
  // One filer: column 1. Add age and it is column 3, not column 2.
  assert.equal(at({}), 252);
  assert.equal(at({ filerAge: 70 }), 465);
  // Add blindness instead and it is column 2.
  assert.equal(at({ blindOrDisabled: 1 }), 362);
  // A couple both 65 reads the "6 or more" column that a family of six reads.
  const couple = { filingStatus: 'marriedFilingJointly' };
  assert.equal(at(couple), 362);
  assert.equal(at({ ...couple, filerAge: 66, spouseAge: 67 }), 839);
  // And the ordinary route to the same column: a single parent of FIVE is six
  // exemptions, where a childless couple both 65 is also six. Two households
  // with nothing in common reading one cell is the whole shape of this table.
  assert.equal(at({ dependents: 4, dependentAges: [3, 6, 9, 12] }), 655, 'five exemptions');
  assert.equal(at({ dependents: 5, dependentAges: [3, 6, 9, 12, 15] }), 839, 'six');
  // THE CONTRAST THAT MAKES IT WORTH A TEST: § 7-2-5.2, the state's OWN
  // aged-or-blind exemption, treats the two as ALTERNATIVES — a New Mexican who
  // is both qualifies once — and IRC § 63(f) treats them as EQUAL and stacking.
  // Three provisions, three weightings, the same two facts about one filer.
  assert.equal(getStateDefinition('NM', 2025).agedOrBlindExemptionSteps.age, 65);
});
