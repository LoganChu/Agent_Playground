/**
 * CalEITC and the Young Child Tax Credit.
 *
 * The organising test here is the first one: this package ships 2025 and 2026,
 * and the only externally published CalEITC figures it can reach are twelve
 * values from the **2021** Form 3514 lookup table. So the first test drives the
 * credit's arithmetic with 2021 parameters and asserts against all twelve. It
 * checks the *mechanism* rather than the transcription, which is the half that
 * a future year's figures cannot re-validate on their own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CALEITC_2015_STATUTORY_AMOUNTS,
  CALEITC_ADJUSTMENT_FACTOR,
  CALEITC_RATES,
  childCountBand,
  getStateDefinition,
  ownEarnedIncomeCreditAt,
  stateIncomeTax,
} from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const CA_2025 = getStateDefinition('CA', 2025);
const CALEITC = CA_2025.ownEarnedIncomeCredit;
const YCTC = CA_2025.youngChildCredit;

/**
 * A California head-of-household return for a filer whose whole income is wages.
 *
 * `adjustedGrossIncome` in `extra` overrides the federal AGI independently of
 * earnings, which is how the two-branch worksheet lookup gets exercised. The
 * $22,500 is the *federal* standard deduction; California's own is a table and
 * the engine reads it from the definition.
 */
const ca = (earnedIncome, extra = {}) => {
  const { adjustedGrossIncome, ...rest } = extra;
  const agi = adjustedGrossIncome ?? earnedIncome;
  return stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - 22500),
      deduction: 22500,
      deductionKind: 'standard',
    },
    earnedIncome,
    ...rest,
  });
};

const creditNamed = (result, name) => result.credits.find((c) => c.name.includes(name));

// ---------------------------------------------------------------------------
// Provenance: the published table
// ---------------------------------------------------------------------------

/**
 * The 2021 CalEITC parameters, and the twelve values the Franchise Tax Board
 * published for them in the Form 3514 lookup table.
 *
 * The kink credit is the only figure California does not state anywhere: it is
 * `$200` (no children) and `$505` (one or more) as of the 2019 expansion,
 * indexed by the California CPI — 297.447 in 2021 against 280.956 in 2019, both
 * from the Department of Industrial Relations' June series. Everything else is
 * statutory: the rates are the federal § 32 credit percentages, the ceilings are
 * the § 17052(b)(1) table indexed, the factor is the Budget Act's 85%, and the
 * cap is the `$30,000` the 2019 expansion wrote.
 */
const CPI_2021_OVER_2019 = 297.447 / 280.956;
const RULE_2021 = {
  name: 'CalEITC',
  adjustmentFactor: 0.85,
  byChildCount: [
    {
      children: 0,
      phaseInRate: 0.0765,
      earnedIncomeAmount: 3922,
      finalPhaseOutStartCredit: 200 * CPI_2021_OVER_2019,
    },
    {
      children: 1,
      phaseInRate: 0.34,
      earnedIncomeAmount: 5890,
      finalPhaseOutStartCredit: 505 * CPI_2021_OVER_2019,
    },
    {
      children: 2,
      phaseInRate: 0.4,
      earnedIncomeAmount: 8268,
      finalPhaseOutStartCredit: 505 * CPI_2021_OVER_2019,
    },
    {
      children: 3,
      phaseInRate: 0.45,
      earnedIncomeAmount: 8268,
      finalPhaseOutStartCredit: 505 * CPI_2021_OVER_2019,
    },
  ],
  finalPhaseOutEnd: 30000,
  investmentIncomeLimit: 4053,
  minimumAgeWithoutChildren: 18,
  qualifyingChildMaxAge: 18,
};

/** [qualifying children, California earned income, credit] from the 2021 table. */
const FTB_2021_TABLE = [
  [0, 2925, 190],
  [0, 4925, 209],
  [0, 28925, 9],
  [1, 2925, 845],
  [1, 4925, 1423],
  [1, 28925, 28],
  [2, 2925, 995],
  [2, 4925, 1675],
  [2, 28925, 38],
  [3, 2925, 1119],
  [3, 4925, 1884],
  [3, 28925, 39],
];

test('the derivation reproduces all twelve published 2021 Form 3514 table values', () => {
  let worst = 0;
  for (const [children, income, published] of FTB_2021_TABLE) {
    const band = childCountBand(RULE_2021, children);
    const computed = ownEarnedIncomeCreditAt(RULE_2021, band, income);
    worst = Math.max(worst, Math.abs(computed - published));
    assert.ok(
      Math.abs(computed - published) < 1,
      `${children} children at $${income}: FTB publishes $${published}, this computes $${computed.toFixed(2)}`,
    );
  }
  // The table is published in income bands and rounded to the dollar, so a
  // deviation under $1 is the most agreement it can express. Pinning the worst
  // case keeps a future change to the mechanism from drifting inside that margin.
  assert.ok(worst < 0.7, `worst deviation was $${worst.toFixed(2)}`);
});

test('all three CalEITC ceilings are the 2015 statutory table indexed by one factor', () => {
  // R&TC § 17052(b)(1) prints $3,290 / $4,940 / $6,935, which is exactly half of
  // the federal 2015 earned income amounts of $6,580 / $9,880 / $13,870.
  // California indexes all three by one California CPI factor, so if one factor
  // reproduces all three then either every stored figure is right or the same
  // wrong factor was applied to all of them.
  const stored = [0, 1, 2].map(
    (n) => CALEITC.byChildCount.find((b) => b.children === n).earnedIncomeAmount,
  );
  const factors = stored.map((amount, i) => amount / CALEITC_2015_STATUTORY_AMOUNTS[i]);
  const spread = Math.max(...factors) - Math.min(...factors);
  assert.ok(
    spread < 0.0005,
    `the three implied indexing factors disagree by ${spread}: ${factors.join(', ')}`,
  );
  // And the two-child ceiling serves three or more children unchanged, which is
  // how "3 or more" appears in a table with three rows.
  const two = CALEITC.byChildCount.find((b) => b.children === 2);
  const three = CALEITC.byChildCount.find((b) => b.children === 3);
  assert.equal(two.earnedIncomeAmount, three.earnedIncomeAmount);
});

test('the phase-in rates are the federal section 32 credit percentages, unchanged', () => {
  assert.deepEqual(
    CALEITC.byChildCount.map((b) => b.phaseInRate),
    CALEITC_RATES,
  );
  assert.equal(CALEITC.adjustmentFactor, CALEITC_ADJUSTMENT_FACTOR);
  // The factor is what separates the schedule from the form: a one-child filer's
  // first $6,998 is subsidised at 28.9%, not the 34% the schedule appears to say.
  money(0.34 * CALEITC.adjustmentFactor, 0.289, 'effective one-child phase-in rate');
});

// ---------------------------------------------------------------------------
// The shape nobody draws
// ---------------------------------------------------------------------------

test('CalEITC has no plateau: the peak is one dollar wide', () => {
  for (const band of CALEITC.byChildCount) {
    const peak = band.earnedIncomeAmount;
    const at = (x) => ownEarnedIncomeCreditAt(CALEITC, band, x);
    assert.ok(at(peak) > at(peak - 1), `${band.children} children: credit should still be rising at the peak`);
    assert.ok(at(peak) > at(peak + 1), `${band.children} children: credit should already be falling one dollar past the peak`);
    // Falling at exactly the rate it climbed is what makes it a triangle rather
    // than the federal trapezoid.
    const rate = band.phaseInRate * CALEITC.adjustmentFactor;
    money(at(peak) - at(peak + 1), rate, `${band.children} children: descent rate`);
    money(at(peak) - at(peak - 1), rate, `${band.children} children: climb rate`);
  }
});

test('the steep phase-out ends at the stored kink credit and the tail is nearly flat', () => {
  const band = childCountBand(CALEITC, 2);
  const rate = band.phaseInRate * CALEITC.adjustmentFactor;
  const maximum = band.earnedIncomeAmount * rate;
  const kinkIncome = band.earnedIncomeAmount + (maximum - band.finalPhaseOutStartCredit) / rate;
  money(kinkIncome, 17778.35, 'two-child kink income');
  money(
    ownEarnedIncomeCreditAt(CALEITC, band, kinkIncome),
    band.finalPhaseOutStartCredit,
    'credit at the kink',
  );
  // 34 cents on the dollar before the kink, 4.2 cents after it.
  const before =
    ownEarnedIncomeCreditAt(CALEITC, band, kinkIncome - 1) -
    ownEarnedIncomeCreditAt(CALEITC, band, kinkIncome);
  const after =
    ownEarnedIncomeCreditAt(CALEITC, band, kinkIncome) -
    ownEarnedIncomeCreditAt(CALEITC, band, kinkIncome + 1);
  money(before, 0.34, 'slope just before the kink');
  assert.ok(after > 0.041 && after < 0.043, `slope just after the kink was ${after}`);
  // And it reaches exactly zero at the cap, which is the whole reason the tail
  // exists: the triangle alone would have ended at $17,778.
  money(ownEarnedIncomeCreditAt(CALEITC, band, CALEITC.finalPhaseOutEnd), 0, 'credit at the cap');
});

test('the CalEITC phase-in is a negative state marginal rate, and one dollar flips it', () => {
  const below = ca(8000, { dependentAges: [3, 7] });
  const above = ca(10000, { dependentAges: [3, 7] });
  assert.equal(below.marginalRate, -0.34);
  assert.equal(above.marginalRate, 0.34);
  // A 68-point swing across the $9,823 peak, invisible in any rate table.
  money(above.marginalRate - below.marginalRate, 0.68, 'swing across the peak');
});

// ---------------------------------------------------------------------------
// The Young Child Tax Credit
// ---------------------------------------------------------------------------

test('the Young Child Tax Credit phase-out rate is derived, not transcribed', () => {
  // amount / ((cap - threshold) / increment), truncated to the cent. It is the
  // rate that runs the credit to exactly zero at the CalEITC income cap, and it
  // reproduces the published figure in four of the five years it can be checked.
  const increments = (CALEITC.finalPhaseOutEnd - YCTC.phaseOut.start) / YCTC.phaseOut.increment;
  const derived = Math.floor((YCTC.amount / increments) * 100) / 100;
  assert.equal(YCTC.phaseOut.amountPerIncrement, derived);
  assert.equal(YCTC.phaseOut.amountPerIncrement, 21.71);

  const published = [
    { year: 2021, amount: 1000, start: 25000, cap: 30000, rate: 20 },
    { year: 2022, amount: 1083, start: 25000, cap: 30000, rate: 21.66 },
    { year: 2024, amount: 1154, start: 26626, cap: 31950, rate: 21.67 },
    { year: 2025, amount: 1189, start: 27425, cap: 32901, rate: 21.71 },
  ];
  for (const y of published) {
    const rate = Math.floor((y.amount / ((y.cap - y.start) / 100)) * 100) / 100;
    assert.equal(rate, y.rate, `${y.year}: derived ${rate}, published ${y.rate}`);
  }
});

test('the Young Child Tax Credit is one credit per return, not one per child', () => {
  const one = creditNamed(ca(20000, { dependentAges: [3] }), 'Young Child');
  const three = creditNamed(ca(20000, { dependentAges: [1, 3, 5] }), 'Young Child');
  assert.equal(one.amount, YCTC.amount);
  assert.equal(three.amount, YCTC.amount);
  // Every other child credit in this package scales with the family; this one
  // does not, so a test says so rather than a comment.
  assert.equal(one.amount, three.amount);
});

test('the Young Child Tax Credit phase-out is a staircase, per $100 "or fraction thereof"', () => {
  const at = (earned) => creditNamed(ca(earned, { dependentAges: [3] }), 'Young Child').amount;
  assert.equal(at(27425), 1189, 'full credit at the threshold');
  // One dollar past the threshold costs a whole increment.
  money(at(27426), 1189 - 21.71, 'one dollar over');
  money(at(27525), 1189 - 21.71, 'ninety-nine dollars later, unchanged');
  money(at(27526), 1189 - 43.42, 'the hundredth dollar costs another increment');
  // PolicyEngine-US divides without rounding up, which reads the credit off the
  // straight line instead of the staircase and overstates it by up to $21.70 for
  // every filer standing between two steps. Their own parameter file quotes the
  // statute's "or fraction thereof". Recorded rather than silently preferred.
  const smooth = 1189 - ((27500 - 27425) / 100) * 21.71;
  money(at(27500), 1189 - 21.71, 'staircase');
  assert.ok(smooth - at(27500) > 5, 'the two readings differ by more than rounding');
});

test('the Young Child Tax Credit is gated on CalEITC, so the investment cliff costs both', () => {
  // Measured at the worst point: $9,823 of earnings is exactly the two-child
  // CalEITC peak, and the Young Child Tax Credit is still whole there.
  const peak = childCountBand(CALEITC, 2).earnedIncomeAmount;
  const under = ca(peak, { dependentAges: [3, 7], investmentIncome: CALEITC.investmentIncomeLimit });
  const over = ca(peak, {
    dependentAges: [3, 7],
    investmentIncome: CALEITC.investmentIncomeLimit + 1,
  });
  money(creditNamed(under, 'CalEITC').amount, 3339.82, 'CalEITC at its peak');
  assert.equal(creditNamed(under, 'Young Child').amount, 1189);
  assert.equal(creditNamed(over, 'CalEITC').amount, 0);
  assert.equal(creditNamed(over, 'Young Child').amount, 0);
  // One dollar of interest, $4,528.82 of credit.
  money(over.tax - under.tax, 4528.82, 'cost of one dollar over the investment limit');
  // The state note asserts that figure in words, so it is checked here too.
  assert.ok(
    CA_2025.notes.some((n) => n.includes('$4,528.82') && n.includes('$9,823')),
    'the note should carry the figure this test just computed',
  );
});

test('a child aged 6 gets no Young Child Tax Credit and still gets CalEITC', () => {
  const five = ca(20000, { dependentAges: [5] });
  const six = ca(20000, { dependentAges: [6] });
  assert.equal(creditNamed(five, 'Young Child').amount, 1189);
  assert.equal(creditNamed(six, 'Young Child').amount, 0);
  assert.equal(creditNamed(five, 'CalEITC').amount, creditNamed(six, 'CalEITC').amount);
});

// ---------------------------------------------------------------------------
// Eligibility cliffs and the AGI branch
// ---------------------------------------------------------------------------

test('federal AGI at or above the cap disqualifies however small the earnings are', () => {
  const inside = ca(5000, { dependentAges: [7], adjustedGrossIncome: 32900 });
  const outside = ca(5000, { dependentAges: [7], adjustedGrossIncome: 32901 });
  assert.ok(creditNamed(inside, 'CalEITC').amount > 0);
  assert.equal(creditNamed(outside, 'CalEITC').amount, 0);
});

test('the credit is the smaller of the earned-income and AGI lookups', () => {
  // A filer with $9,823 of wages sits exactly on the two-child peak, but $12,000
  // of AGI puts them down the phase-out. Form 3514 line 6 takes the smaller.
  const both = ca(9823, { dependentAges: [3, 7], adjustedGrossIncome: 12000 });
  const band = childCountBand(CALEITC, 2);
  money(
    creditNamed(both, 'CalEITC').amount,
    ownEarnedIncomeCreditAt(CALEITC, band, 12000),
    'AGI branch wins',
  );
  // And an AGI *below* earnings does not push the filer down the schedule:
  // IRC § 32(a)(2)(B) as adopted runs that branch on the greater of the two.
  const lowAgi = ca(9823, { dependentAges: [3, 7], adjustedGrossIncome: 2000 });
  money(creditNamed(lowAgi, 'CalEITC').amount, 9823 * 0.34, 'earned-income branch stands');
});

test('a missing earnedIncome computes both credits as zero and says what it cost', () => {
  const without = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: 25000,
      taxableIncome: 2500,
      deduction: 22500,
      deductionKind: 'standard',
    },
    dependentAges: [3, 7],
  });
  assert.equal(creditNamed(without, 'CalEITC').amount, 0);
  assert.equal(creditNamed(without, 'Young Child').amount, 0);
  const note = without.notes.find((n) => n.includes('earnedIncome was not'));
  assert.ok(note, 'the result should say the field was load-bearing');
  assert.ok(note.includes('3,757'), 'and say what it is worth');
});

test('dependents without ages compute CalEITC as zero rather than on the childless schedule', () => {
  const guessed = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: 25000,
      taxableIncome: 2500,
      deduction: 22500,
      deductionKind: 'standard',
    },
    earnedIncome: 25000,
    dependents: 2,
  });
  assert.equal(creditNamed(guessed, 'CalEITC').amount, 0);
  assert.ok(guessed.notes.some((n) => n.includes('dependentAges was not supplied')));
  // The childless schedule would have paid something, and that something would
  // have been wrong by an order of magnitude.
  const band = childCountBand(CALEITC, 0);
  assert.ok(ownEarnedIncomeCreditAt(CALEITC, band, 25000) > 0);
});

test('a dependent over 18 is not a qualifying child for CalEITC', () => {
  const teen = creditNamed(ca(20000, { dependentAges: [18] }), 'CalEITC').amount;
  const adult = creditNamed(ca(20000, { dependentAges: [19] }), 'CalEITC').amount;
  const band = childCountBand(CALEITC, 0);
  assert.ok(teen > adult);
  money(adult, ownEarnedIncomeCreditAt(CALEITC, band, 20000), 'childless schedule');
});

// ---------------------------------------------------------------------------
// The whole return
// ---------------------------------------------------------------------------

test('a single parent of two at $25,000 is owed $1,520.76 by California', () => {
  const result = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: 25000,
      taxableIncome: 2500,
      deduction: 22500,
      deductionKind: 'standard',
    },
    earnedIncome: 25000,
    dependentAges: [3, 7],
  });
  // California's own deduction, not the federal one: $11,412 for a head of
  // household, so $13,588 of California taxable income at 1%.
  money(result.taxableIncome, 13588, 'California taxable income');
  money(result.taxBeforeCredits, 135.88, 'tax before credits');
  // The exemption credits ($153 + 2 x $475) more than cover it, and then the two
  // refundable credits run the return negative.
  money(creditNamed(result, 'exemption').amount, 1103, 'exemption credits');
  money(creditNamed(result, 'CalEITC').amount, 331.76, 'CalEITC');
  money(creditNamed(result, 'Young Child').amount, 1189, 'Young Child Tax Credit');
  money(result.tax, -1520.76, 'California tax');
  // Before this package modelled the two credits it returned exactly zero here,
  // which is the number every rate-table implementation still returns.
  assert.ok(result.tax < 0, 'a low-income California return is a refund, not zero');
  // On the CalEITC tail and below the Young Child threshold: 4.2 cents.
  assert.equal(result.marginalRate, 0.042);
});

test('the two credits are refundable and appended after the existing ones', () => {
  const result = ca(20000, { dependentAges: [3] });
  const names = result.credits.map((c) => c.name);
  assert.equal(names[0], CA_2025.exemptionCredit.name, 'exemption credit keeps position 0');
  assert.equal(names[names.length - 2], CALEITC.name);
  assert.equal(names[names.length - 1], YCTC.name);
  assert.equal(creditNamed(result, 'CalEITC').refundable, true);
  assert.equal(creditNamed(result, 'Young Child').refundable, true);
});

test('2026 California carries the CalEITC parameters forward and says it is provisional', () => {
  const def = getStateDefinition('CA', 2026);
  assert.equal(def.status, 'provisional');
  assert.deepEqual(def.ownEarnedIncomeCredit, CALEITC);
  assert.deepEqual(def.youngChildCredit, YCTC);
  assert.ok(def.notes[0].includes('CalEITC'), 'the provisional note names the credit');
});

test('no other state has an own-schedule earned income credit', () => {
  // Six states match the federal credit and California computes its own; the two
  // rules are mutually exclusive, and a state carrying both would double-count.
  for (const code of ['NY', 'CO', 'IL', 'IN', 'UT', 'CA']) {
    const def = getStateDefinition(code, 2025);
    assert.ok(
      !(def.earnedIncomeCredit && def.ownEarnedIncomeCredit),
      `${code} carries both earned income credit rules`,
    );
  }
  assert.ok(getStateDefinition('CA', 2025).ownEarnedIncomeCredit);
  assert.equal(getStateDefinition('NY', 2025).ownEarnedIncomeCredit, undefined);
});

// ---------------------------------------------------------------------------
// The shipped table, pinned — which the 2021 provenance test above does not do
// ---------------------------------------------------------------------------

/**
 * Twenty-eight probes across the whole of the shipped CalEITC curve, at incomes
 * that are constants.
 *
 * ## Why this is separate from the twelve FTB values at the top of the file
 *
 * That test drives the *mechanism* with 2021 parameters, because 2021 is the last
 * year California published a lookup table this package can check against. It is
 * the better test and it is the reason the mechanism can be trusted. What it
 * cannot do is notice a shipped 2025 figure moving, because it does not read one.
 *
 * Day 35's mutation audit proved that in the most specific way available: setting
 * `finalPhaseOutStartCredit` for the ONE-CHILD band to 1,271 broke nothing. The
 * two- and three-child bands were caught by the shared household battery; the
 * one-child band has no household in the final phase-out tail, and the tail is
 * where that figure lives.
 *
 * So these are a REGRESSION GUARD in the sense `bracket-pins.test.js` sets out:
 * every expected figure was computed by this package, so they cannot say the curve
 * is right. The twelve FTB values say that. These say it has not moved.
 *
 * ## Why the incomes are constants and not `band.earnedIncomeAmount`
 *
 * Day 33's rule, and the file already had one instance of what it warns against:
 * the investment-cliff test below reads `CALEITC.investmentIncomeLimit` to build
 * the household it then asserts about, so doubling the limit moves the household
 * with it and the assertion passes either way. **A test whose household is read
 * out of the parameter is blind to the parameter.** Both are now fixed by freezing
 * the income, and the relation test is kept beside it because the two claims are
 * different: one says where the cliff is, the other says a cliff exists at all.
 *
 * `$3,000` and `$7,000` are on the phase-in and the steep descent; `$12,000` to
 * `$31,000` walk the long, nearly flat tail that runs to `$32,901`, which is the
 * stretch `finalPhaseOutStartCredit` sets the slope of.
 */
const CALEITC_CURVE = [
  [0, 3_000, 195.08], [0, 7_000, 236.93], [0, 12_000, 191.19], [0, 16_000, 154.6],
  [0, 20_000, 118.01], [0, 26_000, 63.13], [0, 31_000, 17.39],
  [1, 3_000, 867], [1, 7_000, 2_021.84], [1, 12_000, 628.94], [1, 16_000, 508.58],
  [1, 20_000, 388.21], [1, 26_000, 207.66], [1, 31_000, 57.2],
  [2, 3_000, 1_020], [2, 7_000, 2_380], [2, 12_000, 2_599.64], [2, 16_000, 1_239.64],
  [2, 20_000, 541.71], [2, 26_000, 289.77], [2, 31_000, 79.82],
  [3, 3_000, 1_147.5], [3, 7_000, 2_677.5], [3, 12_000, 2_924.6], [3, 16_000, 1_394.6],
  [3, 20_000, 549.25], [3, 26_000, 293.8], [3, 31_000, 80.93],
];

test('every point of the shipped CalEITC curve, in both years', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('CA', year).ownEarnedIncomeCredit;
    for (const [children, income, expected] of CALEITC_CURVE) {
      const band = childCountBand(rule, children);
      money(
        Math.round(ownEarnedIncomeCreditAt(rule, band, income) * 100) / 100,
        expected,
        `${year}, ${children} children at $${income.toLocaleString('en-US')}`,
      );
    }
  }
  // The four bands must not all agree, or a probe in one proves nothing about the
  // others — which is how the one-child figure went unwatched while its two
  // neighbours were covered.
  const distinct = new Set(CALEITC_CURVE.filter(([, income]) => income === 20_000).map(([, , c]) => c));
  assert.equal(distinct.size, 4, 'the four child counts pay four different credits in the tail');
});

test('the investment income limit is $4,814, and a frozen household above it gets nothing', () => {
  // The frozen half of the cliff. The relation test above says a cliff exists
  // wherever the limit is; this says where it is, with an income that does not
  // move when the limit does. $6,000 is above $4,814 and below twice it, which is
  // the window a doubling has to be caught in.
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('CA', year).ownEarnedIncomeCredit;
    assert.equal(rule.investmentIncomeLimit, 4_814, `${year}: FTB 2025 Form 3514 line 19`);
  }
  const blocked = ca(9_823, { dependentAges: [3, 7], investmentIncome: 6_000 });
  assert.equal(creditNamed(blocked, 'CalEITC').amount, 0, '$6,000 of investment income');
  assert.equal(creditNamed(blocked, 'Young Child').amount, 0, 'and the credit gated on it');
  const allowed = ca(9_823, { dependentAges: [3, 7], investmentIncome: 4_000 });
  money(creditNamed(allowed, 'CalEITC').amount, 3_339.82, '$4,000 of investment income');
});
