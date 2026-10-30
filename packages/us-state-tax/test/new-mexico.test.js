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
  assert.equal(cents(oneChild.tax - twoChildren.tax), 188);
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

test('the aged-or-blind staircase is nine steps and most of them are free', () => {
  // THE MEASUREMENT, and it is here because the first draft of this module
  // priced these steps by multiplying $1,000 by two of New Mexico's six rates.
  // No filer at any of the eight boundaries is in either band: the exemption
  // expires at $28,500 of AGI for a single filer, and a single New Mexican
  // there has $8,125 of taxable income once the federal deduction and the
  // other two allowances are taken.
  const step = (base, boundary) =>
    cents(nm({ ...base, agi: boundary + 1 }).tax - nm({ ...base, agi: boundary }).tax);
  const single = { filingStatus: 'single', filerAge: 70, agedBoxes: 1 };
  assert.deepEqual(
    [18_000, 19_500, 21_000, 22_500, 24_000, 25_500, 27_000, 28_500].map((b) => step(single, b)),
    [0, 0, 0, 0, 14.27, 15.01, 30.34, 32.04],
  );
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
  assert.deepEqual(
    [30_000, 33_000, 36_000, 39_000, 42_000, 45_000, 48_000, 51_000].map((b) => step(both70, b)),
    [0, 0, 0, 0, 0, 30.02, 48.74, 64.04],
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

test('New Mexico is published for both years and has no provisional figure', () => {
  // THE SAMENESS OF THE TWO YEARS IS THE STATUTE AND NOT A CARRY-FORWARD. HB 252
  // of 2024 wrote the rate schedules for taxable years beginning on or after 1
  // January 2025 with no cost-of-living provision, and §§ 7-2-5.2, 7-2-5.8,
  // 7-2-5.14, 7-2-34 and 7-2-39 are flat amounts with no indexing clause. The
  // one indexed figure in the New Mexico income tax is the child income tax
  // credit of § 7-2-18.34, which this module does not model — so there is
  // nothing here awaiting publication, which is unusual for a state added in
  // the year before its forms exist.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('NM', year);
    assert.equal(def.status, 'published', `NM ${year}`);
    assert.equal(def.provisionalFigures, undefined);
  }
  // And the two definitions agree on every figure a filer reads.
  const a = getStateDefinition('NM', 2025);
  const b = getStateDefinition('NM', 2026);
  assert.deepEqual(a.rate, b.rate);
  assert.deepEqual(a.dependentDeduction, b.dependentDeduction);
  assert.deepEqual(a.lowAndMiddleIncomeExemption, b.lowAndMiddleIncomeExemption);
  assert.deepEqual(a.agedOrBlindExemptionSteps, b.agedOrBlindExemptionSteps);
  assert.deepEqual(a.capitalGainsSubtraction, b.capitalGainsSubtraction);
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
  assert.equal(cents(r.tax), -1_500);
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
