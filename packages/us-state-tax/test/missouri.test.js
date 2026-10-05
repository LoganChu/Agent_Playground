// Missouri. The first state to exempt capital gains outright, the state whose
// eight brackets are one indexed number, and the state whose largest marginal
// rate is a CLIFF made out of the federal tax bill.
//
// Every expected figure below is computed from the statute by hand and written
// out, not read back out of the engine — Day 27's rule, and the reason three of
// these numbers are not the ones the module header was first drafted with.
//
// The federal figures are written out by hand too, rather than imported from
// `us-federal-tax`. That is not duplication for its own sake: the mutation
// harness SKIPS a test file that resolves a path out of its own package, so
// importing the federal engine here would quietly take every Missouri figure
// out of the audit with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILING_STATUSES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/**
 * 2026 federal figures, by hand.
 *
 * Standard deduction $16,100 single / $32,200 joint / $24,150 head of
 * household. Single rate schedule: 10% to $12,400, 12% to $50,400, 22% to
 * $105,700, 24% to $201,775.
 */
const STD_2026 = { single: 16_100, joint: 32_200, headOfHousehold: 24_150 };

/** Federal tax on a single filer's TAXABLE income, 2026. */
const federalSingleTax = (taxable) => {
  if (taxable <= 12_400) return taxable * 0.1;
  if (taxable <= 50_400) return 1_240 + (taxable - 12_400) * 0.12;
  if (taxable <= 105_700) return 1_240 + 4_560 + (taxable - 50_400) * 0.22;
  return 1_240 + 4_560 + 12_166 + (taxable - 105_700) * 0.24;
};

/**
 * Federal tax on a single filer's TAXABLE income, 2025 — a different schedule
 * and a different standard deduction, written out because the 2025 Missouri
 * answer is a function of the 2025 FEDERAL answer and reusing the 2026 one
 * would quietly measure a household that does not exist.
 */
const federalSingleTax2025 = (taxable) => {
  if (taxable <= 11_925) return taxable * 0.1;
  if (taxable <= 48_475) return 1_192.5 + (taxable - 11_925) * 0.12;
  return 1_192.5 + 4_386 + (taxable - 48_475) * 0.22;
};

const wageFederal2025 = (wages) => {
  const taxable = Math.max(0, wages - 15_750);
  return {
    adjustedGrossIncome: wages,
    taxableIncome: taxable,
    deduction: 15_750,
    deductionKind: 'standard',
    incomeTaxBeforeRefundableCredits: federalSingleTax2025(taxable),
  };
};

/** A single filer on wages alone, 2026: the federal basis Missouri reads. */
const wageFederal = (wages, deduction = STD_2026.single) => {
  const taxable = Math.max(0, wages - deduction);
  return {
    adjustedGrossIncome: wages,
    taxableIncome: taxable,
    deduction,
    deductionKind: 'standard',
    incomeTaxBeforeRefundableCredits: federalSingleTax(taxable),
  };
};

const mo = ({ year = 2026, filingStatus = 'single', federal, ...fields } = {}) =>
  stateIncomeTax({ state: 'MO', year, filingStatus, ...fields, federal });

/** The 2026 schedule, by hand: $1,348 a band and 0 / 2 / 2.5 / 3 / 3.5 / 4 / 4.5%. */
const STEP_2026 = 1_348;
const BAND_RATES = [0, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045];
const TOP_RATE = 0.047;

const missouriTax = (taxable, step) => {
  let tax = 0;
  for (let i = 0; i < BAND_RATES.length; i += 1) {
    const bottom = step * i;
    const top = step * (i + 1);
    if (taxable <= bottom) return tax;
    tax += (Math.min(taxable, top) - bottom) * BAND_RATES[i];
  }
  return tax + Math.max(0, taxable - step * 7) * TOP_RATE;
};

// ---------------------------------------------------------------------------
// § 143.011: eight brackets that are one number
// ---------------------------------------------------------------------------

test('the eight brackets are the first one times one through seven, in both years', () => {
  // § 143.011.5 indexes the bracket as a block, so the schedule is generated
  // from one figure. Written as a loop over both years and all five statuses
  // because the claim is about the RELATION and not about eight numbers: a
  // transcribed table could satisfy three spot checks and still have drifted.
  for (const [year, step] of [
    [2025, 1_313],
    [2026, 1_348],
  ]) {
    const def = getStateDefinition('MO', year);
    for (const status of FILING_STATUSES) {
      const bands = def.rate.byStatus[status];
      assert.equal(bands.length, 8, `${year} ${status}: eight bands`);
      for (let i = 0; i < 7; i += 1) {
        assert.equal(bands[i].upTo, step * (i + 1), `${year} ${status} band ${i} ceiling`);
        assert.equal(bands[i].rate, BAND_RATES[i], `${year} ${status} band ${i} rate`);
      }
      assert.equal(bands[7].rate, TOP_RATE, `${year} ${status} top rate`);
      assert.equal(bands[7].upTo, Infinity, `${year} ${status} top band is open`);
    }
  }
});

test('the whole graduated schedule is worth $180.63 for 2026 and $175.94 for 2025', () => {
  // The tax on the first seven bands is the band width times the sum of the
  // rates — 0.195 — and a flat 4.7% on the same money is 0.047 times seven
  // band widths. The difference is constant at every income above the top of
  // the schedule, which is the claim, so it is checked at five of them.
  for (const [year, step, saving] of [
    [2026, 1_348, 180.63],
    [2025, 1_313, 175.94],
  ]) {
    const top = step * 7;
    money(missouriTax(top, step), step * 0.195, `${year}: tax on the whole schedule`);
    money(top * TOP_RATE - missouriTax(top, step), saving, `${year}: the saving`);
    for (const taxable of [20_000, 60_000, 250_000, 1_000_000]) {
      money(
        taxable * TOP_RATE - missouriTax(taxable, step),
        saving,
        `${year}: the saving at ${taxable} of taxable income`,
      );
    }
  }
});

test('the brackets do NOT double on a joint return — they do not move at all', () => {
  // Alabama's $40 discount becomes $80 for a couple because its schedule
  // doubles. Missouri's does not: § 143.011 sets one schedule and every status
  // reads it, so the discount is the same figure for one person and for two.
  const def = getStateDefinition('MO', 2026);
  const single = def.rate.byStatus.single;
  for (const status of FILING_STATUSES) {
    assert.deepEqual(def.rate.byStatus[status], single, `${status} reads the single schedule`);
  }
});

// ---------------------------------------------------------------------------
// § 143.171: the federal income tax deduction, and the cliff it is built on
// ---------------------------------------------------------------------------

test('a single filer on $50,000 of wages: 25% of a $3,820 federal bill', () => {
  // Federal: $50,000 less the $16,100 standard deduction is $33,900 of taxable
  // income; $12,400 at 10% and $21,500 at 12% is $3,820.
  const federal = wageFederal(50_000);
  money(federal.incomeTaxBeforeRefundableCredits, 3_820, 'the federal bill');
  // Missouri AGI is $50,000, which § 143.171.2 puts in the 25% step because
  // the boundary is "not in excess of fifty thousand dollars".
  const r = mo({ federal });
  money(r.stateAdjustedGrossIncome, 50_000, 'Missouri AGI');
  money(r.deduction, 16_100 + 955, 'the standard deduction plus 25% of $3,820');
  money(r.taxableIncome, 32_945, 'Missouri taxable income');
  money(r.tax, 1_367.78, 'Missouri tax');
});

test('the boundary belongs to the step BELOW it, at all four boundaries', () => {
  // "twenty-five thousand dollars or less", then "in excess of twenty-five
  // thousand dollars" — so the filer standing exactly on the figure keeps the
  // higher share. A loop over the four, because one spot check would not show
  // that the convention is the same at every one of them.
  for (const [boundary, above, below] of [
    [25_000, 0.25, 0.35],
    [50_000, 0.15, 0.25],
    [100_000, 0.05, 0.15],
    [125_000, 0, 0.05],
  ]) {
    // `result.deduction` is rounded to the cent, so the expectation is too.
    const cents = (x) => Math.round(x * 100) / 100;
    const onIt = mo({ federal: wageFederal(boundary) });
    const federalTax = wageFederal(boundary).incomeTaxBeforeRefundableCredits;
    money(
      onIt.deduction - STD_2026.single,
      cents(STD_2026.single + federalTax * below) - STD_2026.single,
      `exactly ${boundary}: the lower step's share`,
    );
    const justOver = wageFederal(boundary + 1);
    money(
      mo({ federal: justOver }).deduction - STD_2026.single,
      cents(STD_2026.single + justOver.incomeTaxBeforeRefundableCredits * above) -
        STD_2026.single,
      `${boundary + 1}: the higher step's share`,
    );
  }
});

test('one dollar at $100,000 costs $61.94, and it is the largest of the four cliffs', () => {
  // Measured rather than asserted from a formula, because the cliff is the
  // interaction of two schedules: the federal bill rises by the federal
  // marginal rate at the same dollar the Missouri share falls by ten points.
  // The cents come off the rounding of the deduction, which is why these are
  // written to the cent rather than to the dollar.
  const jump = (boundary) =>
    mo({ federal: wageFederal(boundary + 1) }).tax - mo({ federal: wageFederal(boundary) }).tax;
  money(jump(25_000), 4.05, 'the $25,000 cliff');
  money(jump(50_000), 18, 'the $50,000 cliff');
  money(jump(100_000), 61.94, 'the $100,000 cliff');
  money(jump(125_000), 44.07, 'the $125,000 cliff');
  // The largest, and larger than the next by a factor of 1.4.
  const jumps = [25_000, 50_000, 100_000, 125_000].map(jump);
  assert.equal(Math.max(...jumps), jumps[2], '$100,000 is the largest cliff');
});

test('the engine reports a marginal rate of 6,194% at $100,000, and says so', () => {
  // `marginalRate` is the tax on ONE MORE DOLLAR of income, which is exactly
  // what a cliff makes absurd and exactly what a caller needs to see. The
  // figure is not a bug in the report: it is the report doing its job on a
  // provision where the usual word "rate" has stopped meaning anything.
  const at = (wages, year = 2026) =>
    mo({ year, federal: year === 2026 ? wageFederal(wages) : wageFederal2025(wages) })
      .marginalRate;
  // Four places, because the engine rounds the CENT of tax on one dollar and
  // then reports the rate, so the fourth place is real.
  money(at(100_000), 61.946, 'one dollar at $100,000');
  money(at(125_000), 44.0735, 'one dollar at $125,000');
  // And one dollar either side of it is an ordinary 4.7% state again, which is
  // the half of the claim that makes the first half worth printing.
  money(at(99_000), 0.047, 'a thousand dollars below');
  money(at(101_000), 0.047, 'a thousand dollars above');
  // 2025, where the schedule is $1,313 wide and the cliff is in the same place
  // because § 143.171.2's thresholds are not indexed at all.
  money(at(50_000, 2025), 18.2431, 'the 2025 cliff at $50,000');
});

test('the federal earned income credit comes off the deduction AND funds a credit', () => {
  // Missouri reads the federal earned income credit TWICE, in opposite
  // directions, and this is the only state in the package that does.
  //
  // The MO-1040 line 9 worksheet subtracts it from the federal income tax
  // deduction, which RAISES Missouri tax — Alabama's rule at a fraction of
  // Alabama's rate. And § 143.177 then matches 20% of the same credit as the
  // working family tax credit, which LOWERS it by four times as much. So the
  // net is a cut, and a model that found only the first half would have the
  // sign right and the size wrong by a factor of five.
  //
  // A SEPARATE return isolates the first half, because § 143.177.2 bars it
  // from the credit and leaves the worksheet alone.
  const base = wageFederal(30_000);
  const withCredit = { ...base, earnedIncomeCredit: 1_000 };
  const plain = mo({ filingStatus: 'marriedFilingSeparately', federal: base });
  const credited = mo({ filingStatus: 'marriedFilingSeparately', federal: withCredit });
  assert.ok(credited.tax > plain.tax, 'on a separate return the credit raises Missouri tax');
  // $30,000 of Missouri AGI is the 25% step, so $1,000 of credit is $250 of
  // deduction. Missouri taxable income is $13,545 — above the $9,436 where the
  // top rate begins — so the $250 is charged 4.7%, not one of the seven lower
  // band rates the household's first $9,436 was charged.
  money(credited.deduction, plain.deduction - 250, 'the deduction falls by 25% of the credit');
  money(credited.tax - plain.tax, 11.75, 'the credit costs 25% x 4.7%');

  // And the other half, on a single return where both apply. 20% of $1,000 is
  // $200 of credit against $11.75 of extra tax — so the same input is worth
  // $188.25 net, and the engine reports the two separately rather than netting
  // them, because they are two provisions.
  const single = mo({ federal: withCredit });
  const singlePlain = mo({ federal: base });
  const wftc = single.credits.find((c) => c.name === 'Working family tax credit');
  money(wftc.amount, 200, '20% of the federal credit');
  assert.equal(wftc.refundable, false, 'and it is not refundable');
  money(singlePlain.tax - single.tax, 200 - 11.75, 'the net is a cut of $188.25');
});

test('the working family tax credit is barred to a separate return and to an investor', () => {
  // Two all-or-nothing gates, and the second is a CONFORMITY DATE rather than
  // a figure Missouri chose. § 143.177.3(1) reads § 32 as it stood on
  // 1 January 2021, so the disqualifying investment income is the pre-ARPA
  // limit the Department of Revenue indexes and prints on Form MO-WFTC —
  // $4,400 for 2025. A filer with $5,000 of investment income keeps the whole
  // FEDERAL credit and loses the whole Missouri one.
  const federal = { ...wageFederal(30_000), earnedIncomeCredit: 1_000 };
  const named = (r) => r.credits.find((c) => c.name === 'Working family tax credit')?.amount ?? 0;
  money(named(mo({ federal })), 200, 'a single filer gets it');
  money(named(mo({ filingStatus: 'marriedFilingSeparately', federal })), 0, 'a separate return does not');
  money(named(mo({ federal, investmentIncome: 4_400 })), 200, 'exactly at the limit keeps it');
  money(named(mo({ federal, investmentIncome: 4_401 })), 0, 'one dollar over loses all of it');
  // $200 of credit on one dollar of investment income, which is the sharpest
  // cliff on a low-income Missouri return and is invisible federally.
  const atLimit = mo({ federal, investmentIncome: 4_400 });
  const over = mo({ federal, investmentIncome: 4_401 });
  assert.ok(over.tax > atLimit.tax, 'and it costs real tax');
});

test('the refundable CHILD tax credit raises Alabama tax and leaves Missouri alone', () => {
  // The two states in this package that deduct the federal income tax do not
  // subtract the same refundable credits, and a single shared constant in the
  // engine would have charged a Missouri family for a credit their own form
  // ignores. Alabama's worksheet takes the refundable child tax credit;
  // Missouri's starts from Form 1040 LINE 22, which line 28 never reduced.
  const base = wageFederal(40_000);
  const withCtc = { ...base, additionalChildTaxCredit: 1_600 };
  const moPlain = mo({ federal: base, dependents: 1 });
  const moCredited = mo({ federal: withCtc, dependents: 1 });
  money(moCredited.tax, moPlain.tax, 'Missouri does not see the refundable child credit');

  const al = (federal) =>
    stateIncomeTax({ state: 'AL', year: 2026, filingStatus: 'single', dependents: 1, federal });
  assert.ok(al(withCtc).tax > al(base).tax, 'Alabama does');
  // 5% of $1,600, which is the whole of the difference between two worksheets.
  money(al(withCtc).tax - al(base).tax, 80, 'and it is 5% of $1,600');
});

// ---------------------------------------------------------------------------
// HB 594: capital gains, and what the subtraction does to the chart above
// ---------------------------------------------------------------------------

test('a $60,000 gain saves $2,960.79, which is $140.79 MORE than the rate times the gain', () => {
  // $90,000 of wages and $60,000 of long-term gain. Federal AGI $150,000,
  // taxable $133,900: $73,900 of ordinary income is taxed 10/12/22 for
  // $10,970, and the $60,000 of gain sits entirely above the $49,450 zero
  // bracket at 15% for $9,000. No net investment income tax — $150,000 is
  // below the $200,000 threshold.
  const federalTax = 10_970 + 9_000;
  const federal = {
    adjustedGrossIncome: 150_000,
    taxableIncome: 133_900,
    deduction: STD_2026.single,
    deductionKind: 'standard',
    incomeTaxBeforeRefundableCredits: federalTax,
  };
  const r = mo({ federal, netCapitalGain: 60_000 });
  // The gain comes out of MISSOURI AGI, which drops the filer from the 0% step
  // at $150,000 into the 15% step at $90,000.
  money(r.stateAdjustedGrossIncome, 90_000, 'Missouri AGI, net of the gain');
  money(r.deduction, STD_2026.single + federalTax * 0.15, 'standard deduction plus 15%');
  money(r.taxableIncome, 70_904.5, 'Missouri taxable income');
  money(r.tax, 3_151.88, 'Missouri tax with the exemption');

  // The same household under the law as it stood through 2024: the gain is in
  // Missouri AGI, so the filer is above $125,000 and deducts nothing at all.
  const without = missouriTax(150_000 - STD_2026.single, STEP_2026);
  money(without, 6_112.668, 'Missouri tax if the gain were still taxed');
  money(without - r.tax, 2_960.79, 'what the exemption is worth');
  // 4.7% of the gain is $2,820. The other $140.79 is 4.7% of the federal tax
  // deduction the subtraction unlocked — the exemption paying for itself
  // twice, once on the gain and once on the federal tax charged ON the gain.
  money(without - r.tax - 60_000 * TOP_RATE, 140.79, 'the second half of the exemption');
  money(federalTax * 0.15 * TOP_RATE, 140.79, 'which is the unlocked deduction at 4.7%');
});

test('short-term gain is exempt too, and Missouri reads ONE field for both', () => {
  // "all income reported as a capital gain for federal income tax purposes".
  // Massachusetts splits the two because it charges them 8.5% and 5%; Missouri
  // does not, so a caller who puts a short-term gain in the Massachusetts field
  // and nothing in `netCapitalGain` is told so rather than silently taxed.
  const federal = wageFederal(80_000);
  const told = mo({ federal, shortTermCapitalGains: 20_000 });
  assert.ok(
    told.notes.some((n) => n.includes('A SHORT-TERM GAIN WAS SUPPLIED')),
    'the note fires when the gain is in the wrong field',
  );
  const r = mo({ federal, netCapitalGain: 20_000 });
  money(r.stateAdjustedGrossIncome, 60_000, 'the whole net gain comes out');
  assert.ok(
    !r.notes.some((n) => n.includes('A SHORT-TERM GAIN WAS SUPPLIED')),
    'and not when it is in the right one',
  );
});

test('the $5,000 cap could not bind before 2025 and binds now, for at most $181.68', () => {
  // A single filer with $25,000 of wages and $4,000,000 of long-term gain.
  // Missouri AGI is $25,000 — the 35% step — against a federal bill near
  // $900,000, so the uncapped deduction would be $315,000.
  const federalTax = 900_000;
  const federal = {
    adjustedGrossIncome: 4_025_000,
    taxableIncome: 4_008_900,
    deduction: STD_2026.single,
    deductionKind: 'standard',
    incomeTaxBeforeRefundableCredits: federalTax,
  };
  const r = mo({ federal, netCapitalGain: 4_000_000 });
  money(r.stateAdjustedGrossIncome, 25_000, 'Missouri AGI is the wages alone');
  money(r.deduction, STD_2026.single + 5_000, 'the cap, not 35% of $900,000');
  money(r.taxableIncome, 3_900, '$25,000 less $16,100 less $5,000');
  money(r.tax, 57.06, 'the tax the cap produces');

  // And the honest size of it. The 35% step tops out at $25,000 of Missouri
  // AGI and the standard deduction is $16,100, so the most taxable income the
  // cap can ever create for a single filer in this step is $8,900 — and the
  // most it can ever COST them is the tax on $8,900 less the tax on $3,900.
  const uncapped = missouriTax(Math.max(0, 25_000 - STD_2026.single - 315_000), STEP_2026);
  money(uncapped, 0, 'uncapped, this filer owes nothing');
  money(missouriTax(8_900, STEP_2026) - 57.06, 181.68, 'the most the cap is ever worth here');

  // On a JOINT return in the same step the cap cannot bind at all, because the
  // $32,200 standard deduction already exceeds the $25,000 of income the step
  // allows. A rule that is unreachable for one status and worth $181.68 for
  // another is worth saying out loud.
  const joint = mo({
    filingStatus: 'marriedFilingJointly',
    federal: { ...federal, deduction: STD_2026.joint },
    netCapitalGain: 4_000_000,
  });
  money(joint.tax, 0, 'a couple in the 35% step owes nothing with or without the cap');
});

test('the cap binds in the 25% step, under every filing status', () => {
  // Written BEFORE the mutation audit rather than after it, because the
  // prediction was that four of the five cap cells would survive: the test
  // above reaches the $5,000 single figure and the joint one only through a
  // return that owes nothing either way, and a figure no answer moves is a
  // figure no test is checking.
  //
  // The 25% step is where every status can reach it. Missouri AGI of $50,000
  // is above every standard deduction here, and a federal bill of $200,000 —
  // a filer with a very large capital gain and $50,000 of wages — puts 25% at
  // $50,000 against caps of $5,000 and $10,000.
  const federalTax = 200_000;
  const caps = {
    single: 5_000,
    marriedFilingJointly: 10_000,
    marriedFilingSeparately: 5_000,
    headOfHousehold: 5_000,
    qualifyingSurvivingSpouse: 5_000,
  };
  const deductions = {
    single: STD_2026.single,
    marriedFilingJointly: STD_2026.joint,
    marriedFilingSeparately: STD_2026.single,
    headOfHousehold: STD_2026.headOfHousehold,
    qualifyingSurvivingSpouse: STD_2026.joint,
  };
  for (const status of FILING_STATUSES) {
    const deduction = deductions[status];
    const r = mo({
      filingStatus: status,
      federal: {
        adjustedGrossIncome: 2_050_000,
        taxableIncome: 2_050_000 - deduction,
        deduction,
        deductionKind: 'standard',
        incomeTaxBeforeRefundableCredits: federalTax,
      },
      netCapitalGain: 2_000_000,
    });
    money(r.stateAdjustedGrossIncome, 50_000, `${status}: Missouri AGI is the wages alone`);
    money(r.deduction, deduction + caps[status], `${status}: the cap, not 25% of $200,000`);
    // Less the $1,400 § 143.161.2 addition, which only two of the five have.
    const exemption = status === 'headOfHousehold' || status === 'qualifyingSurvivingSpouse' ? 1_400 : 0;
    money(
      r.taxableIncome,
      Math.max(0, 50_000 - deduction - caps[status] - exemption),
      `${status}: taxable income`,
    );
    // And it really is the cap doing it: a quarter of $200,000 is $50,000,
    // five times the largest of the caps and ten times the other four.
    assert.ok(federalTax * 0.25 >= caps[status] * 5, `${status}: the uncapped share is far larger`);
  }
});

// ---------------------------------------------------------------------------
// § 143.124 and § 143.125: the retirement sections that disagree with each other
// ---------------------------------------------------------------------------

/** A retired single filer, 65, with $70,000 of income and a $5,000 federal bill. */
const retiredFederal = {
  adjustedGrossIncome: 70_000,
  taxableIncome: 70_000 - STD_2026.single,
  deduction: STD_2026.single,
  deductionKind: 'standard',
  incomeTaxBeforeRefundableCredits: 5_000,
};

test("Social Security EATS the public pension exemption: $7,633 on identical income", () => {
  // The whole of Missouri's retirement story in two returns with the same
  // $70,000 on them, the same federal basis and the same age.
  const allPension = mo({
    federal: retiredFederal,
    filerAge: 65,
    retirement: { filer: { governmentPension: 70_000 } },
  });
  const split = mo({
    federal: retiredFederal,
    filerAge: 65,
    taxableSocialSecurity: 30_000,
    retirement: { filer: { governmentPension: 40_000, socialSecurityBenefits: 35_000 } },
  });
  // Missouri AGI is $70,000 on both, so the federal tax deduction is 15% of
  // $5,000 on both and the only difference is MO-A Part 3.
  money(allPension.stateAdjustedGrossIncome, 70_000, 'Missouri AGI, pension only');
  money(split.stateAdjustedGrossIncome, 70_000, 'Missouri AGI, pension and benefit');
  const retirementDeduction = (r) => r.deduction - STD_2026.single - 750;
  money(retirementDeduction(allPension), 47_633, 'capped at the maximum Social Security benefit');
  // $30,000 of Section C, then min($40,000, $47,633) less that $30,000.
  money(retirementDeduction(split), 40_000, 'the benefit consumed $30,000 of the ceiling');
  money(
    retirementDeduction(allPension) - retirementDeduction(split),
    7_633,
    'what receiving Social Security costs this retiree',
  );
  assert.ok(split.tax > allPension.tax, 'and the one with the benefit pays more');

  // The 2025 ceiling is the same $47,633 and is a SEPARATE figure: the 2026
  // one is that number carried forward because Form MO-A is published in
  // January. Asserted in both years, so that the carry-forward is a claim
  // something checks rather than two copies nobody compares.
  const in2025 = mo({
    year: 2025,
    federal: { ...retiredFederal, deduction: 15_750, taxableIncome: 70_000 - 15_750 },
    filerAge: 65,
    retirement: { filer: { governmentPension: 70_000 } },
  });
  money(in2025.deduction - 15_750 - 750, 47_633, 'the 2025 ceiling is the same figure');
  assert.equal(
    getStateDefinition('MO', 2026).provisionalFigures[0].carriedForwardFrom,
    2025,
    'and 2026 says which year it was carried from',
  );
});

test('military retired pay is outside the ceiling and the offset both', () => {
  // § 143.124.9. The same $70,000, in the field that says it is military.
  const military = mo({
    federal: retiredFederal,
    filerAge: 65,
    taxableSocialSecurity: 30_000,
    retirement: { filer: { militaryRetirement: 40_000, socialSecurityBenefits: 35_000 } },
  });
  // $30,000 of Social Security plus the WHOLE $40,000, where the same money as
  // a civil service pension deducted $40,000 in total.
  money(military.deduction - STD_2026.single - 750, 70_000, 'all of it comes off');
  money(military.taxableIncome, 0, 'and there is nothing left to tax');
});

test('the private pension deduction is withdrawn dollar for dollar, and gone by $31,000', () => {
  // § 143.124.2: $6,000 a person, less the amount Missouri AGI (net of the
  // taxable Social Security) exceeds $25,000 for a single filer. A loop over
  // the band, because the claim is that the slope is exactly one.
  for (const [agi, expected] of [
    [25_000, 6_000],
    [26_000, 5_000],
    [28_000, 3_000],
    [31_000, 0],
    [40_000, 0],
  ]) {
    const federal = wageFederal(agi);
    const r = mo({
      federal,
      filerAge: 65,
      retirement: { filer: { employerPlanPension: 6_000 } },
    });
    const share = agi <= 25_000 ? 0.35 : agi <= 50_000 ? 0.25 : 0.15;
    const fedDeduction = federal.incomeTaxBeforeRefundableCredits * share;
    money(
      r.deduction - STD_2026.single - fedDeduction,
      expected,
      `private pension deduction at ${agi}`,
    );
  }
});

test("the two halves of MO-A disagree about Social Security, on one form", () => {
  // Section A charges the benefit AGAINST the public pension exemption.
  // Section B's income test takes the same benefit back OUT of Missouri AGI
  // before measuring it. So one dollar of Social Security destroys a dollar of
  // public pension exemption and protects a dollar of private pension one.
  const federal = {
    adjustedGrossIncome: 36_000,
    taxableIncome: 36_000 - STD_2026.single,
    deduction: STD_2026.single,
    deductionKind: 'standard',
    incomeTaxBeforeRefundableCredits: 1_500,
  };
  // $30,000 of wages and $6,000 of private pension: Missouri AGI $36,000, so
  // the $6,000 deduction is withdrawn to zero by the $11,000 of excess.
  const noBenefit = mo({
    federal,
    filerAge: 65,
    retirement: { filer: { employerPlanPension: 6_000 } },
  });
  // The same $36,000, but $11,000 of it is taxable Social Security. The income
  // test is on $25,000, so the whole $6,000 survives.
  const withBenefit = mo({
    federal,
    filerAge: 65,
    taxableSocialSecurity: 11_000,
    retirement: { filer: { employerPlanPension: 6_000, socialSecurityBenefits: 13_000 } },
  });
  const fedDeduction = 1_500 * 0.25;
  money(
    noBenefit.deduction - STD_2026.single - fedDeduction,
    0,
    'no benefit: the private pension deduction is gone',
  );
  money(
    withBenefit.deduction - STD_2026.single - fedDeduction,
    11_000 + 6_000,
    'with the benefit: the benefit is exempt AND the $6,000 survives',
  );
});

test('Social Security is taxable below 62, which is where Missouri differs from Alabama', () => {
  const federal = {
    adjustedGrossIncome: 40_000,
    taxableIncome: 40_000 - STD_2026.single,
    deduction: STD_2026.single,
    deductionKind: 'standard',
    incomeTaxBeforeRefundableCredits: 2_000,
  };
  const young = mo({ federal, filerAge: 60, taxableSocialSecurity: 20_000 });
  const old = mo({ federal, filerAge: 62, taxableSocialSecurity: 20_000 });
  money(young.deduction - old.deduction, -20_000, 'the whole benefit arrives at 62');
  // And at any age where it is disability. § 143.125 gates the age and not the
  // benefit, which is the one place a Missouri return asks whether a person is
  // disabled.
  const disabled = mo({
    federal,
    filerAge: 60,
    taxableSocialSecurity: 20_000,
    retirement: { filer: { socialSecurityBenefits: 24_000, totallyDisabled: true } },
  });
  money(disabled.deduction, old.deduction, 'disability has no age test');
});

// ---------------------------------------------------------------------------
// § 143.131, § 143.161, § 143.022: the three that are short
// ---------------------------------------------------------------------------

test('the federal age addition comes through, and Missouri takes 15% of it back', () => {
  // § 143.131.2. The engine reads `federal.deduction` whole, so the § 63(f)
  // additional amount for a filer at 65 reaches Missouri with no Missouri
  // provision involved — and then the OTHER Missouri provision claws part of
  // it back, which is the thing worth a test.
  //
  // $2,050 more federal deduction is $2,050 less federal taxable income, which
  // at 12% is $246 less federal TAX, which at the 15% step is $36.90 less
  // Missouri federal income tax deduction. So the age addition is worth
  // $2,013.10 of Missouri deduction rather than $2,050.
  //
  // THE GENERAL FORM: in Missouri every federal deduction is worth (1 - s x m)
  // of itself, where s is the § 143.171 share and m the federal marginal rate.
  // Alabama's version of the same effect is 100% of m, which is why its
  // marginal rate is regressive; Missouri's is at most 35% of m and steps.
  const plain = mo({ federal: wageFederal(60_000) });
  const aged = mo({ federal: wageFederal(60_000, 16_100 + 2_050), filerAge: 67 });
  money(aged.deduction - plain.deduction, 2_013.1, 'the age addition, net of the clawback');
  money(2_050 - (aged.deduction - plain.deduction), 2_050 * 0.12 * 0.15, 'which is s x m of it');
});

test('there is no personal or dependent exemption, and $1,400 for two statuses', () => {
  // § 143.161.1 defines both by reference to the federal exemption, which is
  // zero. § 143.161.2 is Missouri's own and survives.
  const def = getStateDefinition('MO', 2026);
  assert.equal(def.exemption.perDependent, 0, 'a dependent is worth nothing');
  for (const status of ['single', 'marriedFilingJointly', 'marriedFilingSeparately']) {
    assert.equal(def.exemption.perFiler[status], 0, `${status} has no exemption`);
  }
  for (const status of ['headOfHousehold', 'qualifyingSurvivingSpouse']) {
    assert.equal(def.exemption.perFiler[status], 1_400, `${status} has $1,400`);
  }
  // And it is worth $65.80 at the top rate, which is the whole of what a
  // Missouri head of household gets for the status.
  const withChild = mo({
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: 80_000,
      taxableIncome: 80_000 - STD_2026.headOfHousehold,
      deduction: STD_2026.headOfHousehold,
      deductionKind: 'standard',
      incomeTaxBeforeRefundableCredits: 6_000,
    },
    dependents: 2,
  });
  money(withChild.exemptions, 1_400, 'two dependents add nothing to it');
});

test('a fifth of business income comes off, at every income', () => {
  // § 143.022. Ohio's rule of the same name deducts the FIRST $250,000 whole;
  // Missouri deducts a fifth of every dollar and never stops.
  const federal = wageFederal(100_000);
  const plain = mo({ federal });
  const trader = mo({ federal, businessIncome: 50_000 });
  money(trader.deduction - plain.deduction, 10_000, '20% of $50,000');
  const large = mo({ federal, businessIncome: 250_000 });
  money(large.deduction - plain.deduction, 50_000, 'and 20% of $250,000, with no cap');
});

test('a $75,000 salary is $2,552.77 and not 4.7% of the gross', () => {
  // The whole package in one assertion.
  //
  // Asked what Missouri charges a single filer on $75,000 of 2025 salary, the
  // answer at the top of a search engine today is $3,525 — which is 4.7% of
  // $75,000 to the cent, the rate times the gross, with neither the standard
  // deduction Missouri adopts from § 63(c) nor the federal income tax
  // deduction § 143.171.2 grants.
  //
  // This test pins OUR figure and derives theirs rather than quoting it,
  // because a third party's number can change tomorrow and the arithmetic
  // cannot. What it asserts is that the gap is exactly the two provisions.
  const federal = wageFederal2025(75_000);
  money(federal.incomeTaxBeforeRefundableCredits, 7_949, 'the 2025 federal bill');
  const r = mo({ year: 2025, federal });
  money(r.deduction, 15_750 + 1_192.35, 'the standard deduction plus 15% of $7,949');
  money(r.taxableIncome, 58_057.65, 'Missouri taxable income');
  money(r.tax, 2_552.77, 'Missouri tax');

  // And the two halves of the $972.23, each priced at the rate that applies to
  // it. Both are above $9,436 of taxable income, so both are at 4.7%.
  const flat = 75_000 * TOP_RATE;
  money(flat, 3_525, 'the rate times the gross');
  money(flat - r.tax, 972.23, 'what the two provisions are worth together');
  money((15_750 + 1_192.35) * TOP_RATE, 796.29, 'the deductions at 4.7%');
  // The remaining $175.94 is the graduated schedule itself — the discount the
  // zero band and the six lower rates are worth, which this file measures
  // independently above. A figure that is NOT the deductions is the third
  // thing a flat-rate model misses, and it is the same figure at every income.
  money(flat - r.tax - (15_750 + 1_192.35) * TOP_RATE, 175.94, 'and the schedule');
});

// ---------------------------------------------------------------------------
// What the return says about itself
// ---------------------------------------------------------------------------

test('a return with no federal bill on it is TOLD what that cost', () => {
  const silent = mo({
    federal: {
      adjustedGrossIncome: 100_000,
      taxableIncome: 83_900,
      deduction: STD_2026.single,
      deductionKind: 'standard',
    },
  });
  assert.ok(
    silent.notes.some((n) => n.includes('NO FEDERAL INCOME TAX WAS SUPPLIED')),
    'the note fires',
  );
  money(silent.deduction, STD_2026.single, 'and the deduction really is the standard one alone');
  // It is not a rounding error: the omission is $1,975.50 of deduction.
  const told = mo({ federal: wageFederal(100_000) });
  money(silent.tax - told.tax, 1_975.5 * TOP_RATE, 'what the missing figure cost');
});

test('2026 is provisional for exactly two figures, and both are on forms not yet printed', () => {
  // Both are figures that exist ONLY on a Missouri form. The pension ceiling
  // is the maximum Social Security benefit on MO-A Part 3 Section A line 7;
  // the investment income limit is the pre-ARPA § 32(i) amount on Form
  // MO-WFTC line 3, which the IRS stopped publishing when ARPA replaced it, so
  // not even a federal release can settle that one.
  const def = getStateDefinition('MO', 2026);
  assert.equal(def.status, 'provisional');
  assert.deepEqual(
    def.provisionalFigures.map((f) => f.path).sort(),
    ['earnedIncomeCredit.investmentIncomeLimit', 'stateRetirementDeduction.publicPensionCap'],
  );
  assert.equal(getStateDefinition('MO', 2025).status, 'published');
  // Everything else about 2026 was read: the rate, the bracket width and the
  // standard deduction all come from documents published before the year
  // began.
  assert.equal(getStateDefinition('MO', 2026).rate.byStatus.single[0].upTo, 1_348);
});
