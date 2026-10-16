// South Carolina. The first state in this package whose two supported years are
// two different LAWS, and the only state whose deduction is a staircase built by
// rounding a fraction rather than by counting steps of income.
//
// Every expected figure below is computed from the statute by hand and written
// out rather than read back out of the engine — Day 27's rule — and three of
// them came from a document rather than from arithmetic: SCDOR Information
// Letter 26-20's own worked SCIAD figures, which is what caught the ulp defect
// in Part 3.
//
// Federal figures are written out by hand rather than imported from
// `us-federal-tax`: the mutation harness SKIPS a test file that resolves a path
// out of its own package, so importing the federal engine here would quietly
// take every South Carolina figure out of the audit with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** The federal standard deductions a 2025 or 2026 filer actually takes (OBBBA). */
const FEDERAL_DEDUCTION = {
  single: 15_750,
  marriedFilingSeparately: 15_750,
  headOfHousehold: 23_625,
  marriedFilingJointly: 31_500,
  qualifyingSurvivingSpouse: 31_500,
};

/**
 * § 63(f)'s additional standard deduction for 2025, per aged or blind person —
 * Rev. Proc. 2024-40 § 3.15, the same table `FEDERAL_DEDUCTION` above comes from.
 *
 * **IT IS HERE BECAUSE A FEDERAL BLOCK WITHOUT IT IS A HOUSEHOLD THAT CANNOT
 * EXIST.** This file had eighteen households of 65 and over, every one of them
 * handed a federal standard deduction of exactly the basic amount — and South
 * Carolina's 2025 add-back is measured against the federal deduction, so the
 * suite was asking the engine about a filer of 70 who took a 40-year-old's
 * deduction. The engine answered correctly and the answer was about nobody. The
 * defect that hid behind it cost a real filer of 65 $120 of tax, and the
 * instrument that found it was `site/test/compute.test.js`, which cannot write
 * an impossible federal block because it runs the federal engine.
 */
const FEDERAL_AGED_ADDITION = {
  single: 2_000,
  headOfHousehold: 2_000,
  marriedFilingSeparately: 1_600,
  marriedFilingJointly: 1_600,
  qualifyingSurvivingSpouse: 1_600,
};

/**
 * How many § 63(f) boxes this household checks, counted the way
 * `us-federal-tax`'s `standardDeductionFor` counts them: the filer always, the
 * spouse only on a joint return. A qualifying surviving spouse counts nobody but
 * the filer, because the spouse is dead.
 */
const agedConditions = (filingStatus, filerAge, spouseAge) =>
  (filerAge >= 65 ? 1 : 0) +
  (filingStatus === 'marriedFilingJointly' && spouseAge >= 65 ? 1 : 0);

const federal = (agi, filingStatus = 'single', extra = {}, filerAge = 0, spouseAge = 0) => {
  const deduction =
    FEDERAL_DEDUCTION[filingStatus] +
    agedConditions(filingStatus, filerAge, spouseAge) * FEDERAL_AGED_ADDITION[filingStatus];
  return {
    adjustedGrossIncome: agi,
    taxableIncome: Math.max(0, agi - deduction),
    deduction,
    deductionKind: 'standard',
    ...extra,
  };
};

const sc = (opts) => {
  const { year = 2026, filingStatus = 'single', agi = 50_000, fed = {}, ...rest } = opts ?? {};
  return stateIncomeTax({
    state: 'SC',
    year,
    filingStatus,
    federal: federal(agi, filingStatus, fed, rest.filerAge ?? 0, rest.spouseAge ?? 0),
    ...rest,
  });
};

// ---------------------------------------------------------------------------
// Part 1 — the two regimes, on one household
// ---------------------------------------------------------------------------

test('the same single filer on $50,000 pays two different taxes under two different laws', () => {
  // 2025. Federal taxable income is $50,000 - $15,750 = $34,250, and South
  // Carolina adds back the $750 the One Big Beautiful Bill Act put into the
  // standard deduction, because § 12-6-40(A)(1)(a) reads the Code as it stood on
  // 31 December 2024 and Rev. Proc. 2024-40 had indexed the pre-OBBBA figure to
  // $15,000. So the base is $35,000, and the schedule charges 0% on the first
  // $3,560, 3% on the next $14,270 and 6% on the rest:
  //   0 + 0.03 x 14,270 + 0.06 x 17,170 = 428.10 + 1,030.20 = 1,458.30
  const y2025 = sc({ year: 2025 });
  money(y2025.taxableIncome, 35_000, '2025 base');
  money(y2025.tax, 1_458.3, '2025 tax');
  assert.equal(y2025.addBacks.length, 1);
  money(y2025.addBacks[0].amount, 750, 'the OBBBA add-back');

  // 2026. The base is federal AGI and the SCIAD stands where the federal
  // deduction did: $15,000 reduced by 15,000 x (50,000 - 40,000) / 55,000 =
  // 2,727.27, rounded DOWN to $2,720, so the deduction is $12,280 and the base
  // is $37,720. Two bands: 1.99% on $30,000 and 5.21% on $7,720.
  //   597.00 + 402.212 = 999.212 -> 999.21
  const y2026 = sc({ year: 2026 });
  money(y2026.deduction, 12_280, 'SCIAD');
  money(y2026.taxableIncome, 37_720, '2026 base');
  money(y2026.tax, 999.21, '2026 tax');
  assert.equal(y2026.addBacks.length, 0, '2026 starts above every federal deduction');

  // Act 110 is worth $459.09 to this filer.
  money(y2025.tax - y2026.tax, 459.09, 'what the reform is worth here');
});

test('the 2025 schedule is the same three bands for every filing status', () => {
  // § 12-6-510 does not widen the brackets on a joint return, so the whole
  // graduated schedule is worth $641.70 to ONE filer and a couple get one
  // filer's worth between them: $3,560 at 6% plus $14,270 at 3%.
  money(3_560 * 0.06 + 14_270 * 0.03, 641.7, 'what the schedule is worth');
  const single = sc({ year: 2025, agi: 60_000 });
  const joint = sc({ year: 2025, filingStatus: 'marriedFilingJointly', agi: 120_000 });
  money(single.tax, 2_058.3, 'single at $60,000');
  money(joint.tax, 4_758.3, 'joint at $120,000');
  money(joint.tax - 2 * single.tax, 641.7, "the couple lose one filer's schedule");
});

test("the 2026 marriage penalty IS the $966 SCDOR prints on the rate schedule", () => {
  // $966 is $30,000 x (5.21% - 1.99%): the constant that makes the two-band
  // schedule continuous at the threshold, which SCDOR prints as "5.21% minus
  // $966". It is also exactly what a couple lose by not getting a second
  // $30,000 band — the same number for the same reason, and the only source of
  // a South Carolina marriage penalty in 2026, because the SCIAD's base and its
  // denominator BOTH double between the single and joint columns and so the
  // deduction is perfectly proportional.
  money(30_000 * (0.0521 - 0.0199), 966, 'the printed constant');
  const single = sc({ agi: 60_000 });
  const joint = sc({ filingStatus: 'marriedFilingJointly', agi: 120_000 });
  // The bases agree to the cent, which is the proportionality claim.
  money(joint.taxableIncome, 2 * single.taxableIncome, 'the two bases agree');
  // And the penalty is a CENT light, which is not an error: the single return's
  // own tax is 1,662.445 and is reported rounded up, twice. The difference of
  // the answers as reported, not of the figures behind them — the rule Arizona's
  // head-of-household OBBBA figure established on Day 48.
  money(joint.tax - 2 * single.tax, 965.99, 'the penalty as reported');
  assert.equal(single.tax, 1_662.45, 'the half-cent that rounds up');
});

// ---------------------------------------------------------------------------
// Part 2 — the SCIAD, and the three figures a document settles
// ---------------------------------------------------------------------------

/** base, phase-out start, denominator — § 12-6-1140(15) as IL 26-20 states it. */
const SCIAD = {
  single: [15_000, 40_000, 55_000],
  marriedFilingSeparately: [15_000, 40_000, 55_000],
  headOfHousehold: [22_500, 60_000, 82_500],
  marriedFilingJointly: [30_000, 80_000, 110_000],
  qualifyingSurvivingSpouse: [30_000, 80_000, 110_000],
};

test('the SCIAD is whole at its threshold, half at the midpoint and gone at the end', () => {
  // The Department's own worked figures. Each midpoint is start + denominator/2
  // and each end is start + denominator, so the expected deduction is the base,
  // half the base and nothing — and every one of them is a round number, which
  // is what makes them the right probes for the defect in Part 3.
  for (const [filingStatus, [base, start, denominator]] of Object.entries(SCIAD)) {
    money(sc({ filingStatus, agi: start }).deduction, base, `${filingStatus} at the threshold`);
    money(
      sc({ filingStatus, agi: start + denominator / 2 }).deduction,
      base / 2,
      `${filingStatus} at the midpoint`,
    );
    money(
      sc({ filingStatus, agi: start + denominator }).deduction,
      0,
      `${filingStatus} at the end of the phase-out`,
    );
  }
});

test('the withdrawal rate is 3/11 for EVERY filing status, and that is not a coincidence', () => {
  // Each denominator is exactly eleven thirds of its own base. So the SCIAD is
  // one withdrawal rate with three starting points, the peak marginal rate is
  // the same in all five columns, and the proportionality is what makes the 2026
  // marriage penalty come out at the printed constant.
  //
  // Asserted rather than assumed, because the day an amendment moves one base
  // without its denominator is the day this stops being one number — and
  // nothing else in the package would notice.
  for (const [filingStatus, [base, , denominator]] of Object.entries(SCIAD)) {
    assert.equal(denominator, (base * 11) / 3, `${filingStatus}: the ratio is not 3/11`);
  }
  // And the declaration carries the DENOMINATOR, not the quotient. Part 3 is why.
  const def = getStateDefinition('SC', 2026).deduction;
  for (const [filingStatus, [, start, denominator]] of Object.entries(SCIAD)) {
    assert.deepEqual(def.tiers[filingStatus], [{ above: start, denominator }], filingStatus);
  }
  // THE PROPORTIONALITY, ASSERTED AGAINST THE DEFINITION AND NOT AGAINST THE
  // TABLE ABOVE. The first version of this test checked 3/11 against its own
  // literals, which is Day 27's rule applied correctly and is also why two
  // hoisted `byStatus` tables in the module were read by NOTHING — the mutation
  // audit found all eight of their figures. The tables are gone; this is the
  // assertion they were hoisted for, pointed at the only remaining copy.
  for (const filingStatus of Object.keys(SCIAD)) {
    const [{ denominator }] = def.tiers[filingStatus];
    assert.equal(
      denominator,
      (def.maximum[filingStatus] * 11) / 3,
      `${filingStatus}: the shipped denominator is no longer eleven thirds of the shipped base`,
    );
  }
});

test('THE ULP: storing the quotient instead of the denominator cost $10 of deduction', () => {
  // The defect this file's Part 2 probes were written to catch, kept as a test
  // because the fix is a parameter SHAPE and a future refactor could undo it.
  //
  // 15,000 / 55,000 is 3/11, which no binary float holds: the nearest double is
  // one ulp BELOW it. Multiply that by $27,500 and the product is
  // 7,499.9999999999991 — and § 12-6-1140(15)(b)'s rounding of the reduction
  // down to the next lowest $10 turns the missing ulp into a WHOLE STEP. The
  // single filer at $67,500 kept $7,510 where the Department's worked example
  // says $7,500, and at the end of the phase-out $10 of deduction was left
  // standing at $95,000.
  const quotient = 15_000 / 55_000;
  assert.ok(quotient < 3 / 11 || quotient * 27_500 < 7_500, 'the premise: the quotient is low');
  assert.equal(Math.floor((quotient * 27_500) / 10) * 10, 7_490, 'what the quotient produces');
  assert.equal(Math.floor(((15_000 * 27_500) / 55_000) / 10) * 10, 7_500, 'dividing last');
  // And the engine does the second one.
  money(sc({ agi: 67_500 }).deduction, 7_500, 'the engine divides last');
  money(sc({ agi: 95_000 }).deduction, 0, 'and reaches zero');
});

test('the SCIAD staircase steps 37, 37 and 36 dollars of income, repeating', () => {
  // $10 of reduction at 3/11 of a dollar is $36.66..., so the steps of an
  // integer-dollar income cannot all be the same width. Neither Alabama's $500
  // nor Connecticut's $1,000 has this problem, because both statutes count
  // steps of INCOME and South Carolina's rounds the REDUCTION.
  const deductionAt = (agi) => sc({ agi }).deduction;
  const boundaries = [];
  let previous = deductionAt(40_000);
  for (let agi = 40_001; agi <= 40_300; agi += 1) {
    const now = deductionAt(agi);
    if (now !== previous) boundaries.push(agi);
    previous = now;
  }
  // Each step takes exactly $10 and the widths run 37, 37, 36.
  assert.deepEqual(
    boundaries.slice(0, 8),
    [40_037, 40_074, 40_110, 40_147, 40_184, 40_220, 40_257, 40_294],
    'the step boundaries',
  );
  const widths = boundaries.slice(1, 7).map((b, i) => b - boundaries[i]);
  assert.deepEqual(widths, [37, 36, 37, 37, 36, 37], 'the widths repeat 37/37/36');
  money(deductionAt(40_036) - deductionAt(40_037), 10, 'one step is $10 of deduction');
});

test('the top rate is 5.21% and the highest marginal rate is 57.31%', () => {
  // The figure that appears in no rate table, because it is two rules meeting:
  // at a step boundary one dollar of income takes $10 of deduction with it, so
  // taxable income rises by $11 and the tax by eleven times the statutory rate.
  //
  // In the lower band the same dollar costs 1.99% x 11 = 21.89%.
  money(sc({ agi: 40_036 }).marginalRate, 0.2189, 'the step dollar in the 1.99% band');
  money(sc({ agi: 40_037 }).marginalRate, 0.0199, 'the dollar after it');
  money(sc({ agi: 50_009 }).marginalRate, 0.5731, 'the step dollar in the 5.21% band');
  money(sc({ agi: 50_000 }).marginalRate, 0.0521, 'a dollar inside a step');
  // 5.21% x 11 and 1.99% x 11 to the point, so the claim is arithmetic and not
  // an observation about this particular income.
  money(0.0521 * 11, 0.5731, '5.21% x 11');
  money(0.0199 * 11, 0.2189, '1.99% x 11');
  // And what a CONTINUOUS reading of the same fraction would report, which is
  // the correct average across a step and wrong about every single dollar.
  money(0.0521 * (14 / 11), 0.066318, 'the smooth rate, to six places');
});

test('no South Carolina subtraction buys back any SCIAD, because it is read against FEDERAL AGI', () => {
  // The opposite of Wisconsin, whose sliding scale is read against the state's
  // own income so that every subtraction buys part of the deduction back. Here a
  // $40,000 capital gain changes South Carolina's taxable income and leaves the
  // deduction untouched.
  const plain = sc({ agi: 90_000 });
  const withGain = sc({ agi: 90_000, netCapitalGain: 40_000 });
  money(withGain.deduction, plain.deduction, 'the deduction does not move');
  assert.ok(withGain.taxableIncome < plain.taxableIncome, 'but the base does');
  money(plain.taxableIncome - withGain.taxableIncome, 0.44 * 40_000, '44% of the gain');
});

// ---------------------------------------------------------------------------
// Part 3 — the 44% capital gain deduction, and the basis it SHARES with Wisconsin
// ---------------------------------------------------------------------------

test('44% of net capital gain: 2.9176% on a gain against 5.21% on a wage', () => {
  const withGain = sc({ agi: 200_000, netCapitalGain: 100_000 });
  const withoutGain = sc({ agi: 200_000 });
  money(withGain.tax, 7_161.6, 'tax with the deduction');
  money(withoutGain.tax, 9_454, 'tax without it');
  money(withoutGain.tax - withGain.tax, 2_292.4, 'what the deduction is worth');
  // The effective rate on a qualifying gain, in both years.
  money(0.0521 * (1 - 0.44), 0.029176, '2026');
  money(0.06 * (1 - 0.44), 0.0336, '2025');
});

test('South Carolina reaches WISCONSIN’s capital-gain base by a different statute', () => {
  // § 12-6-1150(A) deducts a share of "net capital gain", which is the IRC
  // § 1222(11) term: net long-term gain over net short-term LOSS. Wis. Stat.
  // § 71.05(6)(b)9 reaches the same base by its own words — "the capital gains
  // and capital losses for all assets shall be netted before application of the
  // percentage" — and Arizona's Form 140 worksheet reaches a DIFFERENT one by
  // excluding short-term items rather than netting them.
  //
  // So Day 48's three-way discriminator needed no fourth variant for the
  // twenty-sixth state, and this is the evidence that it is at the right
  // granularity: the two statutes that agree share a variant and the one that
  // differs has its own. What South Carolina adds is that its base is a FEDERAL
  // cross-reference, so it moves if Congress amends § 1222(11) and Wisconsin's
  // does not.
  assert.equal(
    getStateDefinition('SC', 2026).capitalGainsSubtraction.basis.kind,
    'longTermNetted',
  );
  assert.equal(
    getStateDefinition('WI', 2026).capitalGainsSubtraction.basis.kind,
    'longTermNetted',
  );
  assert.equal(
    getStateDefinition('AZ', 2026).capitalGainsSubtraction.basis.kind,
    'longTermExcludingShortTerm',
  );

  // And the bases agree on a grid rather than by inspection. The subtraction
  // each state reports, divided by its own share, is the base it used.
  const baseUsed = (state, netCapitalGain, shortTermCapitalGains) => {
    const def = getStateDefinition(state, 2026);
    const input = {
      state,
      year: 2026,
      filingStatus: 'single',
      federal: federal(200_000),
      netCapitalGain,
      shortTermCapitalGains,
    };
    if (state === 'AZ') input.longTermCapitalGainAfter2011 = netCapitalGain - shortTermCapitalGains;
    const found = stateIncomeTax(input).computedSubtractions.find((s) =>
      s.name.toLowerCase().includes('capital gain'),
    );
    return (found?.amount ?? 0) / def.capitalGainsSubtraction.share;
  };
  for (const [net, short] of [
    [100_000, 0],
    [100_000, 30_000],
    [40_000, 0],
    [60_000, 60_000],
    [0, 0],
  ]) {
    money(
      baseUsed('SC', net, short),
      baseUsed('WI', net, short),
      `SC and WI disagree at net ${net} / short ${short}`,
    );
  }
  // The one household that tells all three apart: a $30,000 short-term gain
  // behind a $70,000 long-term one. SC and Wisconsin net it out of the base and
  // Arizona ignores it, so Arizona's base is the larger.
  money(baseUsed('SC', 100_000, 30_000), 70_000, 'SC nets the short-term gain out');
  money(baseUsed('AZ', 100_000, 30_000), 70_000, 'Arizona excludes it from the start');
});

test("the bound on Wisconsin's basis CANNOT BIND, and South Carolina is how that was found", () => {
  // Reading Wisconsin's basis to see whether South Carolina needed a fourth
  // variant turned up a guard that can never fire. The engine computes
  //
  //   longTerm = max(0, netGain - shortTermCapitalGains)
  //   base     = min(netGain, longTerm)
  //
  // and `shortTermCapitalGains` is validated NON-NEGATIVE, so netGain - short is
  // never above netGain and the max() cannot raise it past netGain either
  // (netGain is non-negative too). The min() is therefore an identity on every
  // input the engine accepts.
  //
  // It is left in place and asserted rather than deleted: the comment above it
  // is a claim about the STATUTE — § 71.05(6)(b)9 does bound the exclusion by
  // the net gain as a whole — and the reason it cannot bind here is a property
  // of this engine's input shape, which a future field could change. What was
  // wrong was only that nothing said so.
  //
  // THE RULE: A BOUND THAT CANNOT BIND IS A CLAIM ABOUT THE INPUT SHAPE, NOT
  // ABOUT THE LAW, AND IT NEEDS A TEST THAT SAYS WHICH.
  assert.throws(
    () =>
      stateIncomeTax({
        state: 'WI',
        year: 2026,
        filingStatus: 'single',
        federal: federal(100_000),
        netCapitalGain: 50_000,
        shortTermCapitalGains: -10_000,
      }),
    /shortTermCapitalGains/,
    'a short-term LOSS cannot be expressed, which is why the bound is unreachable',
  );
});

// ---------------------------------------------------------------------------
// Part 4 — retirement: a floor, not an addition
// ---------------------------------------------------------------------------

test('the retirement deduction is $3,000 at any age and $10,000 from 65', () => {
  // § 12-6-1170(A)(1), and the first band begins at 0 rather than at an age
  // test: South Carolina is the only state in `retirementIncomeSubtractions`
  // where a 50-year-old with a pension has a subtraction at all.
  const at = (age) =>
    sc({ year: 2025, agi: 60_000, filerAge: age, retirement: { filer: { employerPlanPension: 60_000 } } });
  money(at(50).tax, 1_878.3, 'age 50');
  // $1,038.30 and not $1,158.30: the 66-year-old's FEDERAL deduction carries
  // § 63(f)'s additional $2,000, which South Carolina's frozen Code allows in
  // full, and the $120 between the two figures is that $2,000 at 6%. Day 52.
  money(at(66).tax, 1_038.3, 'age 66');
  money(at(50).tax - at(66).tax, 840, 'what turning 65 is worth');
  // $14,000 of extra deduction at 6%, and only $12,000 of it is South Carolina's:
  // the $10,000 cap in place of $3,000, plus the $5,000 of senior deduction that
  // survives the offset, plus § 63(f)'s $2,000 inside the federal deduction the
  // state's frozen Code allows in full.
  money(12_000 * 0.06, 720, 'the state deduction behind the difference');
  money(2_000 * 0.06, 120, '\u00a7 63(f) behind the rest of it');
  money((12_000 + 2_000) * 0.06, 840, 'the two together');
});

test('the senior deduction is a FLOOR of $15,000 and asks nothing about the income', () => {
  // § 12-6-1170(B) allows $15,000 of ANY income at 65, "reduced by any amount
  // the taxpayer deducts pursuant to subsection (A)". So a 66-year-old with
  // $60,000 of wages and one with $60,000 of pension reach the same tax, and the
  // split between the two lines is bookkeeping.
  const wages = sc({ year: 2025, agi: 60_000, filerAge: 66 });
  const pension = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 66,
    retirement: { filer: { employerPlanPension: 60_000 } },
  });
  money(wages.tax, 1_038.3, 'wages at 66');
  money(pension.tax, 1_038.3, 'pension at 66');
  money(wages.computedSubtractions.reduce((t, s) => t + s.amount, 0), 15_000, 'the wage earner');
  money(pension.computedSubtractions.reduce((t, s) => t + s.amount, 0), 15_000, 'the pensioner');
});

test('military retired pay is deducted in FULL at any age, and eats the senior deduction', () => {
  // § 12-6-1171, the Workforce Enhancement and Military Recognition Act of 2022.
  // Uncapped, no age test — and because § 12-6-1170(B) is reduced by it, the
  // military retiree gets no senior deduction: the offset removes a deduction
  // the exemption had already made unnecessary.
  for (const age of [50, 66]) {
    const r = sc({
      year: 2025,
      agi: 60_000,
      filerAge: age,
      retirement: { filer: { militaryRetirement: 60_000 } },
    });
    money(r.tax, 0, `military retired pay at ${age}`);
    money(r.computedSubtractions.reduce((t, s) => t + s.amount, 0), 60_000, `all of it at ${age}`);
  }
  // The same $60,000 as a civilian government pension is charged the ordinary
  // cap, which is New York's construction with the two swapped.
  const civilian = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 50,
    retirement: { filer: { governmentPension: 60_000 } },
  });
  money(civilian.tax, 1_878.3, 'a state trooper at 50');
});

// ---------------------------------------------------------------------------
// Part 5 — the credits, and two ceilings on the same arithmetic
// ---------------------------------------------------------------------------

test('the two wage earner credit caps the INCOME where Wisconsin caps the CREDIT', () => {
  // § 12-6-3330(B)(1): 0.7% of the lesser of $50,000 or the lower-earning
  // spouse's qualified earned income. So the $350 everybody quotes is 0.7% OF
  // THE CEILING and not a parameter — and the declaration says so.
  const credit = (lesserSpouseIncome) =>
    sc({ year: 2025, filingStatus: 'marriedFilingJointly', agi: 120_000, lesserSpouseIncome })
      .credits.find((c) => c.name.includes('Two wage earner')).amount;
  money(credit(20_000), 140, '0.7% of $20,000');
  money(credit(60_000), 350, 'the ceiling binds on the income');
  money(credit(50_000), 350, 'and is reached exactly at $50,000');
  const scRule = getStateDefinition('SC', 2025).marriedCoupleCredit;
  const wiRule = getStateDefinition('WI', 2025).marriedCoupleCredit;
  assert.equal(scRule.cap.kind, 'earnedIncome');
  assert.equal(wiRule.cap.kind, 'credit');
  // Stored as the statute attached it, which is the point: 0.7% x $50,000 is
  // $350 and is NOT what South Carolina's statute says.
  assert.equal(scRule.cap.max, 50_000);
  money(scRule.cap.max * scRule.rate, 350, 'the quoted maximum is derived');
});

test('the earned income credit is 125% of the federal one and capped at $200 from 2026', () => {
  const credit = (year, earnedIncomeCredit) =>
    sc({
      year,
      filingStatus: 'headOfHousehold',
      agi: 45_000,
      dependents: 2,
      dependentAges: [4, 8],
      fed: { earnedIncomeCredit },
    }).credits.find((c) => c.name.includes('earned income')).amount;
  money(credit(2025, 2_400), 3_000, '125% of $2,400, uncapped in 2025');
  money(credit(2026, 2_400), 200, 'capped in 2026');
  // The cap binds from $160 of federal credit upward and nowhere below it, so it
  // takes nothing from the smallest claims.
  money(credit(2026, 160), 200, 'exactly at the binding point');
  money(credit(2026, 100), 125, 'below it the 125% match is untouched');
  assert.equal(getStateDefinition('SC', 2025).earnedIncomeCredit.maximum, undefined);
  assert.equal(getStateDefinition('SC', 2026).earnedIncomeCredit.maximum, 200);
});

test('the young child deduction is the dependent exemption read twice', () => {
  // § 12-6-1160 sets it EQUAL to the § 12-6-1140(13) amount rather than naming a
  // figure, so a dependent under six is worth exactly double one of seven. Kept
  // as two fields so they can be told apart; asserted equal so the day South
  // Carolina decouples them is noticed.
  for (const year of [2025, 2026]) {
    const e = getStateDefinition('SC', year).exemption;
    assert.equal(e.perQualifyingChild, e.perDependent, `${year}: § 12-6-1160 is no longer equal`);
    assert.equal(e.qualifyingChildMaxAge, 5, `${year}: under six`);
    assert.equal(e.perFiler.single, 0, `${year}: no filer exemption`);
  }
  // And a toddler really is worth twice a schoolchild.
  const toddler = sc({ agi: 60_000, dependents: 1, dependentAges: [3] });
  const child = sc({ agi: 60_000, dependents: 1, dependentAges: [9] });
  money(toddler.exemptions - child.exemptions, 4_930, 'the second $4,930');
});

// ---------------------------------------------------------------------------
// Part 6 — conformity: the date that stopped mattering
// ---------------------------------------------------------------------------

test('2025 adds back five federal deductions and 2026 adds back none', () => {
  const taken = {
    qualifiedBusinessIncome: 4_000,
    tips: 3_000,
    overtime: 2_000,
    senior: 6_000,
    carLoanInterest: 1_000,
  };
  const y2025 = sc({ year: 2025, agi: 80_000, federalDeductions: taken });
  // The four Schedule 1-A deductions and § 199A, plus the standard deduction
  // add-back — six entries, because the sixth is a difference of parameters
  // rather than a figure the caller hands over.
  assert.equal(y2025.addBacks.length, 6, 'five supplied deductions and the standard one');
  money(
    y2025.addBacks.reduce((t, a) => t + a.amount, 0),
    16_000 + 750,
    'everything South Carolina refuses',
  );
  const y2026 = sc({ year: 2026, agi: 80_000, federalDeductions: taken });
  assert.equal(y2026.addBacks.length, 0, 'federal AGI is above all of them');
});

test('THE FINDING: the add-back makes South Carolina look INDIFFERENT to the federal figure', () => {
  // `federal-conformity.test.js` decides which states must declare conformity by
  // MOVING a below-AGI federal figure and watching the tax. South Carolina 2025
  // does not move — because it adds the movement straight back — so the most
  // non-conforming state in this package is the one the probe calls indifferent.
  //
  // THE RULE: A SENSITIVITY PROBE MEASURES WHETHER THE MODEL COMPENSATES FOR A
  // FEDERAL FIGURE, NOT WHETHER THE STATE READS THE FEDERAL CODE.
  const at = (deduction) =>
    stateIncomeTax({
      state: 'SC',
      year: 2025,
      filingStatus: 'single',
      federal: {
        adjustedGrossIncome: 80_000,
        taxableIncome: 80_000 - deduction,
        deduction,
        deductionKind: 'standard',
      },
    }).tax;
  // INDIFFERENT TO EXACTLY THE $750 THE ADD-BACK NAMES, AND TO NOTHING ELSE.
  //
  // This assertion read `at(15_750) === at(16_750)` until Day 52 and it was the
  // defect written down as a property of the statute. The add-back was
  // `federal.deduction - 15,000` uncapped, which cancels: the base became
  // AGI - $15,000 for every household, so the state was indifferent to the WHOLE
  // federal standard deduction rather than to the part it refuses — and
  // § 63(f)'s additional $2,000 for a filer of 65, which the frozen Code gives
  // in full, disappeared with the rest. $120 of tax at the 6% top rate.
  //
  // THE RULE: A PROBE THAT MOVES A PARAMETER BY EXACTLY THE AMOUNT A RULE IS
  // SUPPOSED TO CANCEL CANNOT TELL A BOUNDED CANCELLATION FROM AN UNBOUNDED ONE.
  // `federal-conformity.test.js` moves the deduction from $15,000 to $15,750 and
  // reports South Carolina as insensitive, which is RIGHT and will stay right;
  // what it cannot see is the dollar after the $750. Both assertions are needed
  // and only one of them was here.
  assert.equal(at(15_000), at(15_750), 'the $750 the state refuses changes nothing');
  money(at(15_750) - at(16_750), 60, 'and the next $1,000 is the filer\u2019s, at 6%');
  assert.equal(getStateDefinition('SC', 2025).federalConformity.governs, 'recognizedDeductions');
  assert.equal(getStateDefinition('SC', 2026).federalConformity, undefined);

  // AND THE INSENSITIVITY IS A PROPERTY OF THE HOUSEHOLD, NOT OF THE STATE. The
  // add-back is a difference floored at zero, so a filer whose federal standard
  // deduction is BELOW the pre-OBBBA figure — a dependent on a limited standard
  // deduction — moves with the federal figure like any Colorado filer.
  assert.notEqual(at(1_350), at(2_350), 'a dependent filer IS sensitive');
  money(at(1_350) - at(2_350), 60, 'and moves at the 6% rate');

  // AND THE HOUSEHOLD THE WHOLE THING IS ABOUT: a filer of 65 took $17,750
  // federally — $15,750 basic and § 63(f)'s $2,000 — and adds back $750, so the
  // $2,000 survives into the South Carolina base as a deduction.
  money(at(15_750) - at(17_750), 120, 'a filer of 65 keeps § 63(f) at 6%');

  // An ITEMIZER adds back nothing here: § 63(c)(7) is the standard deduction and
  // they took none of it.
  const itemizer = stateIncomeTax({
    state: 'SC',
    year: 2025,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: 80_000,
      taxableIncome: 60_000,
      deduction: 20_000,
      deductionKind: 'itemized',
    },
  });
  assert.equal(itemizer.addBacks.length, 0, 'an itemizer has no § 63(c)(7) to add back');
});

// ---------------------------------------------------------------------------
// Part 7 — every money figure in South Carolina's PROSE is one the engine computes
// ---------------------------------------------------------------------------

/**
 * The surviving-spouse household the notes are about, hoisted because the prose
 * instrument and Part 12 both read it and a second copy would be a second thing
 * to keep right.
 */
const WIDOW = {
  filer: {
    employerPlanPension: 20_000,
    survivorPension: 15_000,
    survivorMilitaryRetirement: 30_000,
    deceasedSpouseAge: 70,
  },
};
/** The same dollars with no field to put them in, which is what v0.45.0 had. */
const AS_HER_OWN = { filer: { employerPlanPension: 35_000, militaryRetirement: 30_000 } };

test('every dollar figure in a South Carolina note is accounted for, in one of FOUR ways', () => {
  // Days 46, 47 and 48 each ended with the same worklist item: the only class of
  // claim in this package with no instrument over it is a money figure in PROSE.
  // Three days running the errors found by re-reading were in note text and doc
  // comments, and on Day 48 one of them had the right magnitude and the WRONG
  // UNITS — a subtraction quoted as a tax, which a plausibility check passes.
  //
  // This is that instrument, scoped to one state. **And building it found that
  // the item is harder than three days of worklists assumed**: the first version
  // accounted for figures in two ways, as a PARAMETER or as an ANSWER, and
  // flagged fifteen. Not one of the fifteen was wrong. They were the notes'
  // own households — "a couple at $120,000", "a $2,400 federal credit" — and
  // figures derived from two parameters, like the $966 that is
  // $30,000 x (5.21% - 1.99%).
  //
  // THE RULE: A MONEY FIGURE IN PROSE HAS FOUR PROVENANCES AND NOT TWO. It is a
  // parameter, an answer, an INPUT the sentence is describing, or a DERIVATION
  // from other parameters — and an instrument that knows only the first two
  // reports a state's own worked examples as defects. The registry the standing
  // item asks for has to carry all four, and the two new ones are the two that
  // cannot be found automatically: somebody has to say which households a note
  // is about and what each derived figure is derived from. That is the real cost
  // of the item, and it is why this is one state and not a package-wide sweep.
  // Day 50: the accounting is now NAMED rather than anonymous. The first
  // version was a `Set` of numbers, which answers "is this figure accounted
  // for" and not "by what" — so a wrong figure could be excused by an unrelated
  // coincidence somewhere else in the state, and a declared derivation that no
  // note mentions was invisible. That second half is Day 49's own defect in
  // instrument form: a value hoisted for a test that the test does not read.
  const accounted = new Map();
  const add = (n, source) => {
    const key = Math.round(n * 100) / 100;
    if (!accounted.has(key)) accounted.set(key, new Set());
    accounted.get(key).add(source);
  };
  /** Sources that have to earn their place: a declared one nothing cites is dead. */
  const declared = new Set();
  const declare = (n, source) => {
    declared.add(source);
    add(n, source);
  };

  // (1) PARAMETERS — every numeric leaf of both definitions.
  for (const year of [2025, 2026]) {
    const walk = (node, seen) => {
      if (node === null || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      for (const value of Object.values(node)) {
        if (typeof value === 'number' && Number.isFinite(value)) add(value, 'parameter');
        else walk(value, seen);
      }
    };
    walk(getStateDefinition('SC', year), new WeakSet());
  }

  // (2) ANSWERS — every household a note names, computed here.
  const H = {
    single60k2025: sc({ year: 2025, agi: 60_000 }),
    joint120k2025: sc({ year: 2025, filingStatus: 'marriedFilingJointly', agi: 120_000 }),
    single60k2026: sc({ agi: 60_000 }),
    joint120k2026: sc({ filingStatus: 'marriedFilingJointly', agi: 120_000 }),
    senior66wages: sc({ year: 2025, agi: 60_000, filerAge: 66 }),
    pension50: sc({
      year: 2025,
      agi: 60_000,
      filerAge: 50,
      retirement: { filer: { employerPlanPension: 60_000 } },
    }),
    pension66: sc({
      year: 2025,
      agi: 60_000,
      filerAge: 66,
      retirement: { filer: { employerPlanPension: 60_000 } },
    }),
    military50: sc({
      year: 2025,
      agi: 60_000,
      filerAge: 50,
      retirement: { filer: { militaryRetirement: 60_000 } },
    }),
    gain2026: sc({ agi: 200_000, netCapitalGain: 100_000 }),
    noGain2026: sc({ agi: 200_000 }),
    single50k2025: sc({ year: 2025 }),
    single50k2026: sc({ year: 2026 }),
    eitc2025: sc({
      year: 2025,
      filingStatus: 'headOfHousehold',
      agi: 45_000,
      dependents: 2,
      dependentAges: [4, 8],
      fed: { earnedIncomeCredit: 2_400 },
    }),
    eitc2026: sc({
      year: 2026,
      filingStatus: 'headOfHousehold',
      agi: 45_000,
      dependents: 2,
      dependentAges: [4, 8],
      fed: { earnedIncomeCredit: 2_400 },
    }),
    twoEarner: sc({
      year: 2025,
      filingStatus: 'marriedFilingJointly',
      agi: 120_000,
      lesserSpouseIncome: 60_000,
    }),
    // Day 51's household: the widow of a career soldier, in both years and both
    // ways round. Her four detail lines ARE the note's four figures, so they are
    // accounted as answers rather than excused by a coincidence elsewhere —
    // which is what the first run of this instrument did to all but one of them.
    widow2025: sc({ year: 2025, agi: 150_000, filerAge: 65, retirement: WIDOW }),
    widow2026: sc({ year: 2026, agi: 150_000, filerAge: 65, retirement: WIDOW }),
    widowAsHerOwn2025: sc({ year: 2025, agi: 150_000, filerAge: 65, retirement: AS_HER_OWN }),
    widowAsHerOwn2026: sc({ year: 2026, agi: 150_000, filerAge: 65, retirement: AS_HER_OWN }),
  };
  for (const [name, r] of Object.entries(H)) {
    add(r.tax, `answer ${name}.tax`);
    add(r.taxBeforeCredits, `answer ${name}.taxBeforeCredits`);
    add(r.deduction, `answer ${name}.deduction`);
    add(r.taxableIncome, `answer ${name}.taxableIncome`);
    add(r.exemptions, `answer ${name}.exemptions`);
    for (const s of r.computedSubtractions) add(s.amount, `answer ${name}.${s.name}`);
    for (const c of r.credits) add(c.amount, `answer ${name}.${c.name}`);
    for (const a of r.addBacks) add(a.amount, `answer ${name}.addBack`);
  }
  // Answers about a PAIR of households, which is what a comparison note quotes.
  add(H.single50k2025.tax - H.single50k2026.tax, 'answer the reform is worth');
  add(H.noGain2026.tax - H.gain2026.tax, 'answer what the 44% deduction is worth');
  add(H.joint120k2025.tax - 2 * H.single60k2025.tax, 'answer the 2025 marriage penalty');
  add(H.joint120k2026.tax - 2 * H.single60k2026.tax, 'answer the 2026 marriage penalty');
  add(H.pension50.tax - H.pension66.tax, 'answer what turning 65 is worth');
  add(2 * H.single60k2025.tax, 'answer two single filers at $60,000');
  const subtracted = (r) => r.computedSubtractions.reduce((sum, d) => sum + d.amount, 0);
  add(subtracted(H.widow2025), 'answer what the widow deducts');
  add(subtracted(H.widowAsHerOwn2025), 'answer what the same dollars deduct as her own');
  add(
    subtracted(H.widow2025) - subtracted(H.widowAsHerOwn2025),
    'answer what the survivor fields are worth in deduction',
  );
  add(H.widowAsHerOwn2025.tax - H.widow2025.tax, 'answer the widow 2025 tax');
  add(H.widowAsHerOwn2026.tax - H.widow2026.tax, 'answer the widow 2026 tax');

  // (3) INPUTS — the households the sentences are about. Declared, because
  // nothing can infer which numbers in a sentence are its subject.
  // $50,000 was in this list until Day 50 and no note cited it. It went out
  // when the dead-declaration check above found it, which is the check
  // earning its place on its first run.
  for (const income of [120_000, 100_000, 60_000, 45_000, 2_400]) {
    declare(income, `input $${income.toLocaleString('en-US')} of income`);
  }
  // The § 12-6-1170(C)(1) note's own household: $60,000 of military retired pay
  // behind a $20,000 civilian pension, quoted as the pair and as its sum.
  declare(70_000, 'input the sergeant\u2019s $60,000 and $20,000 together');
  declare(20_000, 'input the civilian pension behind the retired pay');

  // (4) DERIVATIONS — recomputed from the definitions' own parameters rather
  // than listed, so a note's arithmetic is checked and not merely excused.
  const d2025 = getStateDefinition('SC', 2025);
  const d2026 = getStateDefinition('SC', 2026);
  const bands2025 = d2025.rate.byStatus.single;
  const bands2026 = d2026.rate.byStatus.single;
  // The width of the 3% band, which is the second band's ceiling less the first's.
  declare(bands2025[1].upTo - bands2025[0].upTo, 'derivation the width of the 3% band');
  // The continuity constant SCDOR prints: the threshold times the rate step.
  declare(
    bands2026[0].upTo * (bands2026[1].rate - bands2026[0].rate),
    'derivation the $966 continuity constant',
  );
  // What one step dollar adds to taxable income: the dollar plus the $10 of
  // deduction it takes with it.
  declare(1 + d2026.deduction.roundReductionDownTo, 'derivation the eleven dollars of a step');
  // § 12-6-1170(C)(1), priced at both years' top rates. The deduction (C)(1)
  // takes away is the whole of (A)'s 65-and-over cap, so what it is worth is
  // that cap at the top rate — and the two years disagree because the schedule
  // changed and not because the provision did.
  const sharedCap = d2025.retirementIncomeSubtractions[0].capByAge[1].cap;
  declare(sharedCap * bands2025[2].rate, 'derivation (C)(1) at the 2025 top rate');
  declare(sharedCap * bands2026[1].rate, 'derivation (C)(1) at the 2026 top rate');
  // § 63(f)'s 2025 addition for a single filer who has attained 65, which is a
  // FEDERAL parameter the note names because South Carolina's frozen Code allows
  // it in full and the standard deduction add-back must not reach it. There is no
  // fifth provenance for "a federal figure the sentence quotes", so it is
  // declared here beside the derivations it feeds — and `FEDERAL_AGED_ADDITION`
  // at the top of this file is the copy the households are built from, so the
  // note and the fixture cannot disagree.
  declare(FEDERAL_AGED_ADDITION.single, 'federal \u00a7 63(f) at 65, single, 2025');
  // What turning 65 is worth in DEDUCTION, state and federal together: the
  // $15,000 floor in place of the under-65 cap, plus § 63(f).
  const under65Cap = d2025.retirementIncomeSubtractions[0].capByAge[0].cap;
  declare(
    d2025.agedIncomeSubtraction.maximum - under65Cap + FEDERAL_AGED_ADDITION.single,
    'derivation the deduction turning 65 is worth, state and federal',
  );
  // And § 63(f) priced at the 2025 top rate, which is what the three days of the
  // add-back defect cost a South Carolina filer of 65.
  declare(
    FEDERAL_AGED_ADDITION.single * bands2025[2].rate,
    'derivation \u00a7 63(f) at the 2025 top rate',
  );
  // Where the $15,000 floor stops absorbing (C)(1): the senior deduction less
  // the cap it is reduced by. Below that much retired pay the hole is filled.
  declare(
    d2025.agedIncomeSubtraction.maximum - sharedCap,
    'derivation where the floor stops absorbing (C)(1)',
  );
  // The surviving spouse, and the instrument caught the first version of this
  // one: the gap is THREE amounts, not two. The decedent's own (A) cap, the
  // filer's own (A) cap — which (C)(1) destroys on a veteran's own return and
  // the surviving-spouse carve-out does not — and what is left of the senior
  // deduction after the filer's own (A) reduces it under (B)'s own words.
  // $10,000 + $10,000 + $5,000, and the senior deduction is NOT kept whole,
  // which is what the first draft of the note said.
  //
  // DAY 51 MODELLED IT, so this is now a derivation the ENGINE also produces —
  // `answer what the survivor fields are worth in deduction` above is the same
  // $25,000 computed by running the household. Keeping both is the point: the
  // declaration is the statute's arithmetic and the answer is the code's, and an
  // instrument that accepted only one of them could not tell them apart.
  declare(
    sharedCap * 2 + Math.max(0, d2025.agedIncomeSubtraction.maximum - sharedCap),
    'derivation what the surviving-spouse carve-out is worth',
  );
  // The income one $10 step costs at the 3/11 withdrawal rate, TRUNCATED to
  // cents — the prose writes it "$36.66..." with the ellipsis, because the value
  // does not terminate.
  const scidad = d2026.deduction;
  const stepIncome =
    (d2026.deduction.roundReductionDownTo * scidad.tiers.single[0].denominator) /
    scidad.maximum.single;
  add(Math.floor(stepIncome * 100) / 100);
  // The $12,000 of extra deduction behind the senior note's $720 — which was
  // declared on Day 49 and cited by nothing, because the note explained the
  // $720 as "the deduction, not the income" without ever saying how much
  // deduction. The note now says $12,000 and the derivation is live.
  declare(
    d2025.agedIncomeSubtraction.maximum - d2025.retirementIncomeSubtractions[0].capByAge[0].cap,
    'derivation the $12,000 behind the senior $720',
  );

  const unaccounted = [];
  /** Which sources some note actually cited, for the dead-declaration check. */
  const cited = new Set();
  for (const year of [2025, 2026]) {
    for (const note of getStateDefinition('SC', year).notes) {
      for (const [, dollars] of note.matchAll(/\$([\d,]+(?:\.\d{2})?)/g)) {
        const figure = Number(dollars.replace(/,/g, ''));
        for (const source of accounted.get(figure) ?? []) cited.add(source);
        if (!accounted.has(figure)) {
          unaccounted.push(`${year}: $${dollars} in "${note.slice(0, 60)}..."`);
        }
      }
    }
  }
  assert.deepEqual(
    unaccounted,
    [],
    `${unaccounted.length} dollar figures in South Carolina's notes are not accounted for as a ` +
      'parameter, an answer, a declared input or a derivation. Either the prose is wrong, or the ' +
      'household it describes is missing from the list above, or its arithmetic needs writing out ' +
      '— and the first is why this test exists.',
  );
  // AND THE OTHER DIRECTION, which is Day 49's defect in instrument form: a
  // household or a derivation declared "for the test" that no note mentions is
  // a figure nothing reads, sitting in a test file and proving nothing. It is
  // only asserted for the DECLARED sources — parameters and answers are
  // enumerated wholesale and most of them are rightly uncited.
  assert.deepEqual(
    [...declared].filter((source) => !cited.has(source)).sort(),
    [],
    'a declared input or derivation above is cited by no note — either the prose that needed it ' +
      'was deleted, or it was never the provenance of anything',
  );

  // A coverage test that covers nothing passes.
  const counted = [2025, 2026]
    .flatMap((year) => getStateDefinition('SC', year).notes)
    .join(' ')
    .match(/\$[\d,]+/g);
  assert.ok(counted.length > 25, `only ${counted?.length} dollar figures found in the notes`);
});

// ---------------------------------------------------------------------------
// Part 9 — § 12-6-1170(C)(1), the subsection Day 49 did not read
//
// Day 49 modelled § 12-6-1171 as an exemption that sits OUTSIDE the ordinary
// $3,000/$10,000 retirement deduction, on the reasoning that it is a separate
// statute with its own form line. It is a separate statute, and it is not
// outside the cap: § 12-6-1170(C)(1) reduces "the deduction allowed by this
// section" — which is (A) as well as (B) — by whatever the taxpayer deducts
// under § 12-6-1171. The 2025 SC1040 instructions put that reduction on line 3
// of the line p-1 and p-2 worksheets, before the retirement income limit.
//
// So a military retiree with any other retirement income was given up to
// $10,000 of deduction South Carolina takes away, which understates the tax —
// the direction that matters.
// ---------------------------------------------------------------------------

/** A single filer with `military` of retired pay and `pension` behind it. */
const sergeant = (year, filerAge, military, pension, agi = 150_000) =>
  sc({
    year,
    agi,
    filerAge,
    retirement: { filer: { militaryRetirement: military, employerPlanPension: pension } },
  });

test('§ 12-6-1170(C)(1): military retired pay comes off the (A) cap, not past it', () => {
  // 2025, base is federal taxable income plus the $750 OBBBA add-back. At 65 the
  // federal deduction is $17,750 — $15,750 basic and § 63(f)'s $2,000 — so
  // 150,000 - 17,750 + 750 = 133,000. The military pay comes out in full and
  // leaves NOTHING of the $10,000: max(0, 10,000 - 60,000) = 0. The senior
  // deduction is then reduced by the $60,000 and is also nothing.
  //   133,000 - 60,000 = 73,000 taxable
  //   3% x (17,830 - 3,560) = 428.10, 6% x (73,000 - 17,830) = 3,310.20
  money(sergeant(2025, 65, 60_000, 20_000).tax, 3_738.3, 'a retired sergeant at 65');

  // AND THE AGE NO LONGER MATTERS FOR THIS HOUSEHOLD, which is the clearest
  // statement of what (C)(1) does: at 50 the cap is $3,000 instead of $10,000
  // and the answer is the same, because the military pay has spent both the
  // cap and the senior deduction.
  // AND THE TWO ARE NO LONGER THE SAME NUMBER, which is Day 52 and is not about
  // (C)(1) at all: the 65-year-old's FEDERAL deduction is $2,000 larger under
  // § 63(f), so the identical South Carolina subtraction sits on a smaller base.
  // The claim is about the SUBTRACTION, so that is what is compared, and the
  // $120 of tax between them is a federal figure at South Carolina's rate.
  // Holding the federal deduction fixed across two ages — which this file did
  // until Day 52 — is a household that cannot exist, and it is why the suite
  // could not see the add-back swallowing § 63(f).
  const at50 = sergeant(2025, 50, 60_000, 20_000);
  const at65 = sergeant(2025, 65, 60_000, 20_000);
  assert.deepEqual(at50.computedSubtractions, at65.computedSubtractions);
  money(at50.tax, 3_858.3, 'the same household at 50');
  money(at50.tax - at65.tax, 120, 'and the gap is § 63(f) at 6%, not (C)(1)');

  // 2026, where the base is federal AGI and the SCIAD is fully phased out:
  //   150,000 - 60,000 = 90,000 taxable
  //   1.99% x 30,000 = 597.00, 5.21% x 60,000 = 3,126.00
  money(sergeant(2026, 65, 60_000, 20_000).tax, 3_723, 'the reform year');
});

test('the $15,000 floor absorbs (C)(1) below $5,000 of retired pay and not above it', () => {
  // The two rules compose into a floor: at 65 the total subtraction is
  // max(15,000, M + min(P, max(0, 10,000 - M))). Below $5,000 of military pay
  // the senior deduction fills the hole (C)(1) makes and the answer is
  // unchanged; above it, every dollar of the hole is real.
  //   133,000 - 15,000 = 118,000 taxable
  //   428.10 + 6% x (118,000 - 17,830) = 428.10 + 6,010.20
  money(sergeant(2025, 65, 5_000, 20_000).tax, 6_438.3, 'at the $5,000 boundary');
  // $6,000 of retired pay: the subtraction is still $15,000, where before this
  // fix it was $16,000.
  money(sergeant(2025, 65, 6_000, 20_000).tax, 6_438.3, 'one dollar past the boundary');
  // $20,000 and above is where the whole $10,000 is gone: the subtraction is
  // the military pay alone.
  //   133,000 - 20,000 = 113,000 -> 428.10 + 6% x 95,170 = 6,138.30
  money(sergeant(2025, 65, 20_000, 20_000).tax, 6_138.3, 'the whole cap gone');
});

test('a military retiree with NO other retirement income is unaffected by (C)(1)', () => {
  // The case Day 49 tested, and it was right: with nothing in the pool there is
  // nothing for the reduced cap to have covered.
  for (const age of [50, 66]) {
    const r = sc({
      year: 2025,
      agi: 60_000,
      filerAge: age,
      retirement: { filer: { militaryRetirement: 60_000 } },
    });
    money(r.tax, 0, `military retired pay at ${age}`);
  }
});

// ---------------------------------------------------------------------------
// Part 10 — the label, found in the published tarball on Day 49
//
// The tax was right and the result object said
//   [{ name: 'Retirement deduction', amount: 60000 }]
// for $60,000 that comes out under § 12-6-1171 and could never come out under
// § 12-6-1170(A), whose cap is $10,000. A caller — or a language model — reading
// that against this package's own documented cap has been handed a
// contradiction. Two statutes, two lines.
// ---------------------------------------------------------------------------

test('§ 12-6-1171 gets its own detail line, named for its own statute', () => {
  const military = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 50,
    retirement: { filer: { militaryRetirement: 60_000 } },
  });
  assert.deepEqual(military.computedSubtractions, [
    { name: 'Military retirement deduction', amount: 60_000 },
  ]);

  // And with a civilian pension behind it, the reduced (A) deduction is nothing,
  // so there is no second line to print rather than a line of zero.
  assert.deepEqual(sergeant(2025, 65, 60_000, 20_000).computedSubtractions, [
    { name: 'Military retirement deduction', amount: 60_000 },
  ]);

  // Both statutes at once: $4,000 of retired pay leaves $6,000 of the $10,000,
  // and the senior deduction tops the pair up to $15,000. Three lines, three
  // provisions, and they sum to the subtraction.
  const both = sergeant(2025, 65, 4_000, 20_000);
  assert.deepEqual(both.computedSubtractions, [
    { name: 'Military retirement deduction', amount: 4_000 },
    { name: 'Retirement deduction', amount: 6_000 },
    { name: 'Senior deduction (age 65)', amount: 5_000 },
  ]);

  // A civilian government pension is NOT exempt — § 12-6-1171 is about military
  // service — so it prints under (A) alone and there is no military line.
  assert.deepEqual(
    sc({
      year: 2025,
      agi: 60_000,
      filerAge: 50,
      retirement: { filer: { governmentPension: 60_000 } },
    }).computedSubtractions,
    [{ name: 'Retirement deduction', amount: 3_000 }],
  );
});

// ---------------------------------------------------------------------------
// Part 11 — the same household, answered by an independent model
//
// policyengine-us 2.41.3 models § 12-6-1170(C)(1) and publishes a test for it:
// `sc_retirement_deduction_indv.yaml` case 3, a filer of 70 with $7,000 of
// taxable pension income and $6,000 of military retired pay, expecting a
// retirement deduction of $4,000. Run in a virtualenv here, the same household
// returns
//
//   sc_military_deduction_indv     6000
//   sc_retirement_deduction_indv   4000     <- 10,000 - 6,000, limited by 7,000
//   sc_senior_exemption            5000     <- 15,000 - 6,000 - 4,000
//
// which is this package's three detail lines, to the dollar and in the same
// decomposition, from a model that is not this one. Day 46's rule is that a
// provision wants more than one route before it is trusted; this is the fourth
// for (C)(1), after the statute's own words, the SC1040 line p worksheets and
// SC Revenue Ruling #22-11.
//
// THE FEDERAL SIDE IS WHY THIS IS A UNIT TEST AND NOT A GRID ROW. In
// policyengine-us 2.41.3 `military_retirement_pay` is not among
// `gov.irs.gross_income.sources`, so a household whose only income is military
// retired pay has a federal AGI of ZERO in that model — measured, not inferred:
// `military_retirement_pay = 60_000` returns `adjusted_gross_income = 0` and
// then deducts the $60,000 from a state base that never contained it. The
// differential harness cannot ask the two models about a veteran until that is
// true on both sides, which is recorded in `tools/differential/README.md`.
// ---------------------------------------------------------------------------

test('policyengine-us agrees on (C)(1), line for line', () => {
  // Federal figures for a 70-year-old single filer on $7,000: the standard
  // deduction covers all of it, so the 2025 South Carolina base is zero and the
  // interesting part is the subtraction, not the tax.
  const r = sc({
    year: 2025,
    agi: 7_000,
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 7_000, militaryRetirement: 6_000 } },
  });
  assert.deepEqual(r.computedSubtractions, [
    { name: 'Military retirement deduction', amount: 6_000 },
    { name: 'Retirement deduction', amount: 4_000 },
    { name: 'Senior deduction (age 65)', amount: 5_000 },
  ]);
  money(r.tax, 0, 'no tax on $7,000 at 70');
});

// ---------------------------------------------------------------------------
// Part 12 — THE SURVIVING SPOUSE. Day 50 declared this household NOT MODELLED
// and wrote its arithmetic into the state's notes; Day 51 modelled it.
//
// It is the one South Carolina household where this package was too generous to
// the STATE rather than to the filer, and the direction matters for the same
// reason Day 50's did in reverse: a filer who is overcharged does not get a
// letter telling them so.
//
// Four routes before a line was written, which is Day 46's rule:
//   1. § 12-6-1170(A) — the deduction is allowed to a surviving spouse "in the
//      same manner" the deceased spouse would have taken it.
//   2. The SC1040 line p instructions — "$3,000 or $10,000 of the qualified
//      retirement income, based on the age of the deceased"; "in addition to the
//      individual retirement deduction claimed from the taxpayer's own
//      retirement plan"; and "do not reduce the surviving spouse retirement
//      deduction by any surviving spouse military retirement deduction taken."
//   3. SCDOR's own guidance — the cap rises "for the year the deceased spouse
//      would have been 65 and older", and the age 65 and older deduction "is not
//      reduced by any surviving spouse retirement deduction".
//   4. policyengine-us 2.41.3, which has `sc_retirement_deduction_survivors`
//      and `sc_military_deduction_survivors` and publishes fixtures for both.
// ---------------------------------------------------------------------------

test('a widow of a career soldier keeps $25,000 of deduction the shared cap was taking', () => {
  // THE HEADLINE HOUSEHOLD, and it is Day 50's Part 5 arithmetic with an input
  // to express it. A single filer of 65 whose husband would have been 70, with
  // her own $20,000 civilian pension, his $30,000 of military retired pay and
  // his $15,000 pension, on $150,000 of income.
  //
  //   her own § 12-6-1170(A)                    $10,000   (her age: 65)
  //   his § 12-6-1171, in full and uncapped     $30,000
  //   his § 12-6-1170(A)                        $10,000   (HIS age: 70)
  //   § 12-6-1170(B), reduced by HER OWN alone  $ 5,000   ($15,000 - $10,000)
  //                                             -------
  //                                             $55,000
  //
  // Against the $30,000 the same dollars got when a caller had no field for them
  // and had to call them her own: the military pay exempt in full, and
  // (C)(1) taking the whole $10,000 cap and the whole $15,000 senior deduction
  // with it. $25,000 of deduction, and all four lines named for their own
  // statute.
  // WIDOW and AS_HER_OWN are the hoisted pair the prose instrument also reads, so
  // the note's figures and this test's figures are the same household by
  // construction rather than by two copies agreeing.
  const survivor = WIDOW;
  const asHerOwn = AS_HER_OWN;

  const r2025 = sc({ year: 2025, agi: 150_000, filerAge: 65, retirement: survivor });
  assert.deepEqual(r2025.computedSubtractions, [
    { name: 'Retirement deduction', amount: 10_000 },
    { name: 'Surviving spouse military retirement deduction', amount: 30_000 },
    { name: 'Surviving spouse retirement deduction', amount: 10_000 },
    { name: 'Senior deduction (age 65)', amount: 5_000 },
  ]);
  // 2025: federal taxable is $150,000 - $17,750 = $132,250 — her deduction
  // carries § 63(f)'s $2,000 because she is 65 — plus the $750 OBBBA add-back
  // = $133,000, less $55,000 = $78,000. The schedule charges 0% on $3,560, 3% on
  // $14,270 and 6% above:
  //   0.03 x 14,270 + 0.06 x (78,000 - 17,830) = 428.10 + 3,610.20 = 4,038.30
  money(r2025.taxableIncome, 78_000, '2025 base');
  money(r2025.tax, 4_038.30, '2025 tax');

  const before2025 = sc({ year: 2025, agi: 150_000, filerAge: 65, retirement: asHerOwn });
  money(before2025.taxableIncome, 103_000, '2025 base as her own');
  // 428.10 + 0.06 x (103,000 - 17,830) = 428.10 + 5,110.20 = 5,538.30
  money(before2025.tax, 5_538.30, '2025 tax as her own');
  // $25,000 of deduction at the 6% top rate, to the cent.
  money(before2025.tax - r2025.tax, 1_500, '2025 cost of the shared cap');

  const r2026 = sc({ year: 2026, agi: 150_000, filerAge: 65, retirement: survivor });
  // 2026: the SCIAD is fully withdrawn at $150,000 of federal AGI, so the base
  // is $150,000 - $55,000 = $95,000, charged 1.99% on $30,000 and 5.21% above:
  //   0.0199 x 30,000 + 0.0521 x 65,000 = 597.00 + 3,386.50 = 3,983.50
  money(r2026.taxableIncome, 95_000, '2026 base');
  money(r2026.tax, 3_983.50, '2026 tax');
  const before2026 = sc({ year: 2026, agi: 150_000, filerAge: 65, retirement: asHerOwn });
  // 597.00 + 0.0521 x 90,000 = 597.00 + 4,689.00 = 5,286.00
  money(before2026.tax, 5_286, '2026 tax as her own');
  // $25,000 at 5.21%.
  money(before2026.tax - r2026.tax, 1_302.50, '2026 cost of the shared cap');
});

test('the deceased spouse keeps ageing, so the cap belongs to somebody not on the return', () => {
  // SCDOR: the deduction rises to $10,000 "for the year the deceased spouse
  // would have been 65 and older" — not the year they died. So reading the
  // claimant's own age is wrong in BOTH directions, and these two households are
  // the two directions.
  //
  // A widow of 55 whose husband would have been 70 holds a $10,000 cap.
  const young = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 55,
    retirement: { filer: { survivorPension: 40_000, deceasedSpouseAge: 70 } },
  });
  assert.deepEqual(young.computedSubtractions, [
    { name: 'Surviving spouse retirement deduction', amount: 10_000 },
  ]);
  // And a widow of 70 whose husband would have been 60 holds $3,000 — while her
  // OWN age still buys her the $15,000 senior deduction, which the survivor
  // claim does not touch.
  const old = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 70,
    retirement: { filer: { survivorPension: 40_000, deceasedSpouseAge: 60 } },
  });
  assert.deepEqual(old.computedSubtractions, [
    { name: 'Surviving spouse retirement deduction', amount: 3_000 },
    { name: 'Senior deduction (age 65)', amount: 15_000 },
  ]);
  // Supplying her own age in the decedent's field is the substitution that looks
  // right: it would give the first household $3,000 and the second $10,000, both
  // wrong, and $7,000 of deduction apart in each direction.
  const wrongWayRound = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 55,
    retirement: { filer: { survivorPension: 40_000, deceasedSpouseAge: 55 } },
  });
  money(
    young.computedSubtractions[0].amount - wrongWayRound.computedSubtractions[0].amount,
    7_000,
    'the cost of reading the wrong person age',
  );
});

test('an absent deceased-spouse age takes the lowest band rather than the largest', () => {
  // The same principle as an unsupplied `filerAge`: an unknown age must not buy
  // the bigger figure. $3,000, not $10,000.
  const r = sc({
    year: 2025,
    agi: 60_000,
    filerAge: 70,
    retirement: { filer: { survivorPension: 40_000 } },
  });
  assert.deepEqual(r.computedSubtractions, [
    { name: 'Surviving spouse retirement deduction', amount: 3_000 },
    { name: 'Senior deduction (age 65)', amount: 15_000 },
  ]);
});

test('(C)(1) governs the veteran own return and not the widow — policyengine-us case 2', () => {
  // `sc_retirement_deduction_survivors.yaml` case 2, in the 2022-onwards regime
  // this package's two years are both inside: survivor pension $4,000, survivor
  // military retired pay $6,000, cap $3,000. The reference model returns
  // $3,000 — measured in a virtualenv here, not read off the fixture — and
  // $3,000 is the WHOLE cap rather than `max($3,000 - $6,000, 0) = $0`.
  //
  // THAT IS THE TEST THAT DISCRIMINATES. If (C)(1) reached a surviving spouse
  // this figure would be zero, and the instructions say in terms that it does
  // not: "do not reduce the surviving spouse retirement deduction by any
  // surviving spouse military retirement deduction taken."
  const r = sc({
    year: 2025,
    agi: 10_000,
    filerAge: 64,
    retirement: {
      filer: { survivorPension: 4_000, survivorMilitaryRetirement: 6_000, deceasedSpouseAge: 64 },
    },
  });
  assert.deepEqual(r.computedSubtractions, [
    { name: 'Surviving spouse military retirement deduction', amount: 6_000 },
    { name: 'Surviving spouse retirement deduction', amount: 3_000 },
  ]);

  // Case 1 of the same fixture, at 70: survivor pension $1,000 against a
  // $10,000 cap, and $4,000 of survivor military pay exempt in full beside it.
  const case1 = sc({
    year: 2025,
    agi: 10_000,
    filerAge: 70,
    retirement: {
      filer: { survivorPension: 1_000, survivorMilitaryRetirement: 4_000, deceasedSpouseAge: 70 },
    },
  });
  assert.deepEqual(case1.computedSubtractions, [
    { name: 'Surviving spouse military retirement deduction', amount: 4_000 },
    { name: 'Surviving spouse retirement deduction', amount: 1_000 },
    // AND THE WHOLE $15,000, which is the third claim: the survivor's two
    // deductions do not reduce § 12-6-1170(B). Measured in the reference model
    // too — `sc_senior_exemption` returns 15,000 for this household, where the
    // same $5,000 of her OWN income would have cut it to $10,000.
    { name: 'Senior deduction (age 65)', amount: 15_000 },
  ]);
});

test('the survivor claim is in addition to her own, and the two caps are separate', () => {
  // The instructions' own sentence, as arithmetic. A widow of 70 whose husband
  // would have been 70, with $12,000 of her own pension and $12,000 of his:
  // $10,000 from each cap, not $10,000 between them. And the senior deduction is
  // reduced by HER $10,000 alone.
  const r = sc({
    year: 2025,
    agi: 80_000,
    filerAge: 70,
    retirement: {
      filer: { employerPlanPension: 12_000, survivorPension: 12_000, deceasedSpouseAge: 70 },
    },
  });
  assert.deepEqual(r.computedSubtractions, [
    { name: 'Retirement deduction', amount: 10_000 },
    { name: 'Surviving spouse retirement deduction', amount: 10_000 },
    { name: 'Senior deduction (age 65)', amount: 5_000 },
  ]);
  // $25,000 of subtraction against the $15,000 a single cap plus the floor would
  // have given her — the same $10,000 of difference the headline household has,
  // arriving through the cap rather than through (C)(1).
  const onlyHerOwn = sc({
    year: 2025,
    agi: 80_000,
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 24_000 } },
  });
  money(
    r.computedSubtractions.reduce((sum, d) => sum + d.amount, 0),
    25_000,
    'two caps',
  );
  money(
    onlyHerOwn.computedSubtractions.reduce((sum, d) => sum + d.amount, 0),
    15_000,
    'one cap and the floor',
  );
});

test('a household with only survivor income still reaches the rule', () => {
  // The rule is skipped when it subtracts nothing, and the filer's own halves
  // are both zero here. Testing only those would have skipped the rule and taxed
  // her whole pension — which is why the emptiness test reads the survivor claim
  // too.
  const r = sc({
    year: 2025,
    agi: 40_000,
    filerAge: 50,
    retirement: { filer: { survivorPension: 9_000, deceasedSpouseAge: 66 } },
  });
  assert.deepEqual(r.computedSubtractions, [
    { name: 'Surviving spouse retirement deduction', amount: 9_000 },
  ]);
});
