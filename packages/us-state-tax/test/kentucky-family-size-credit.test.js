// Kentucky's family size tax credit — KRS 141.066, Schedule ITC Section C.
//
// The largest single provision this package ever shipped late. It is a
// percentage of the WHOLE Kentucky tax, 100% of it at or below a poverty-line
// threshold, and until v0.62.0 this package charged every Kentucky filer below
// that threshold their entire bill: $495.20 on a single filer at exactly
// $15,650, $189.20 on one at $8,000.
//
// ## WHAT THESE TESTS ARE FOR, WHICH IS NOT "THE ARITHMETIC RUNS"
//
// Day 71 found this gap with `tools/anchors` and deliberately refused to ship
// the credit, for a reason worth keeping in front of whoever reads this file:
// the rate table was in hand, and the BASE it is measured on had not been read.
// A staircase computed on a guessed base trades a declared gap for an
// undeclared defect.
//
// What closed it was not finding a Kentucky document — no Kentucky host
// resolves from this sandbox, and three were tried again today. It was finding
// that the printed grid is RE-DERIVABLE, and then checking the derivation
// against figures Kentucky itself published:
//
//   1. sixteen 2025 cutoff cells, at 127% and 133% of all four thresholds
//   2. the Schedule ITC's own worked example   — size 2, $22,650 -> 80%
//   3. the 740 instructions' own worked example — size 4, $33,000 -> 90%
//   4. tools/anchors 2025-KY-ky-10, a filled return — single, $15,650 -> $0.00
//
// Every one of those is a number produced OUTSIDE this repository, and (2) and
// (3) are the strongest of the four for a reason that has nothing to do with
// their source: each is consistent with the 2025 threshold amounts and with no
// other year's. A family of two at $22,650 is 80% against 2025's $21,150 and
// 70% against 2024's $20,440. So the two examples pin the staircase and the
// thresholds TOGETHER, and a package that had either wrong would fail them.
//
// ## THE FINDING: THE REFERENCE MODEL'S 1.270032 IS AN ARTIFACT OF ONE YEAR
//
// `policyengine-us` stores the eighth and tenth steps as `1.270032` and
// `1.330032` and the other eight as round numbers. The last group of tests
// shows what those two constants are: not a figure from a document, but a nudge
// that reproduces 2025's printed cutoffs because every 2025 threshold amount is
// an odd multiple of $50 — and `1.30`, sitting unfitted between the two fitted
// ones, is the proof, because 130% of a multiple of $50 is a whole number.
//
// The two readings agree at every integer income in 2025. They disagree at
// eleven in 2026, each worth ten points of a household's entire tax.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

const CREDIT = 'Kentucky family size tax credit';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** A Kentucky return at `agi` of wages, with `size - 1` people besides the filer. */
const ky = (agi, size, opts = {}) => {
  const { year = 2025, filerAge, spouseAge } = opts;
  // Size is built from DEPENDENTS on a single return rather than from a spouse,
  // so one knob moves the family size and nothing else: a joint return would
  // move the filer count too, and in Kentucky it would move the standard
  // deduction on the combined-separate election this package does not model.
  return stateIncomeTax({
    state: 'KY',
    year,
    filingStatus: 'single',
    dependents: size - 1,
    federal: { adjustedGrossIncome: agi },
    earnedIncome: agi,
    ...(filerAge === undefined ? {} : { filerAge }),
    ...(spouseAge === undefined ? {} : { spouseAge }),
  });
};

const creditOf = (result) => {
  const hit = result.credits.filter((c) => c.name.startsWith(CREDIT));
  assert.equal(hit.length, 1, `exactly one ${CREDIT} line`);
  return hit[0].amount;
};

/** The share of the remaining tax the staircase gave, recovered exactly. */
const shareOf = (result, personalCredits = 0) => {
  const remaining = result.taxBeforeCredits - personalCredits;
  assert.ok(remaining > 0, 'the household has a bill for the credit to be a share of');
  return creditOf(result) / remaining;
};

// ===========================================================================
// THE ANCHOR THE WHOLE DAY TURNED ON
// ===========================================================================

test('a single Kentucky filer at exactly the threshold amount owes NOTHING', () => {
  // tools/anchors 2025-KY-ky-10. The expected answer is $0.00 and it comes off
  // a filled return, not off this package and not off a model this package
  // chose. Before v0.62.0 this household was charged $495.20 — the whole bill,
  // and the largest single overstatement in any state here.
  const r = ky(15_650, 1);
  money(r.taxBeforeCredits, 495.2, 'the bill the credit forgives');
  money(creditOf(r), 495.2, 'the credit is the whole bill');
  money(r.tax, 0, 'and the tax is nothing');
});

test('the 100% step reaches down to no income at all, and does not go negative', () => {
  for (const agi of [0, 1, 1_000, 8_000, 14_500, 15_649, 15_650]) {
    const r = ky(agi, 1);
    money(r.tax, 0, `single at $${agi}`);
    assert.ok(creditOf(r) >= 0, 'a credit is never negative');
    assert.ok(creditOf(r) <= r.taxBeforeCredits + 0.005, 'nor more than the bill');
  }
  // The $8,000 household is the one the status sweep pins, and it is the
  // plainest statement of what was wrong: $189.20 of tax on $8,000 of wages.
  money(ky(8_000, 1).taxBeforeCredits, 189.2, 'the bill at $8,000');
});

// ===========================================================================
// KENTUCKY'S OWN TWO WORKED EXAMPLES — and each rules out every other year
// ===========================================================================

test("Schedule ITC's own example: a family of two at $22,650 gets 80%", () => {
  money(shareOf(ky(22_650, 2)), 0.8, 'the printed example');
  // 2024's threshold for a family of two was $20,440, which would put this
  // household at 110.8% and on the 70% step. The example is therefore evidence
  // for the 2025 THRESHOLD as well as for the staircase, which is why it is
  // worth more than a figure read out of a parameter file.
  const ratio2024 = 22_650 / 20_440;
  assert.ok(ratio2024 > 1.08 && ratio2024 <= 1.12, 'the 2024 reading would be 70%');
});

test("the 740 instructions' own example: a family of four at $33,000 gets 90%", () => {
  money(shareOf(ky(33_000, 4)), 0.9, 'the printed example');
  // 2024's family-of-four threshold was $31,200: 105.8%, the 80% step.
  const ratio2024 = 33_000 / 31_200;
  assert.ok(ratio2024 > 1.04 && ratio2024 <= 1.08, 'the 2024 reading would be 80%');
});

// ===========================================================================
// THE SIXTEEN ATTESTED 2025 CUTOFF CELLS
// ===========================================================================

// The whole-dollar cutoffs Kentucky prints at 127% and 133% of each of the four
// threshold amounts, with the credit percentage on each side of each. These are
// the eight cells where the product lands on exactly $.50 — the only eight in
// 2025 that are not whole numbers — so they are the only cells in the year that
// can tell a rounded cutoff from an unrounded one, and they fix the direction.
const CUTOFF_CELLS = [
  [1, 19_876, 0.3], [1, 19_877, 0.2], [1, 20_815, 0.1], [1, 20_816, 0],
  [2, 26_861, 0.3], [2, 26_862, 0.2], [2, 28_130, 0.1], [2, 28_131, 0],
  [3, 33_846, 0.3], [3, 33_847, 0.2], [3, 35_445, 0.1], [3, 35_446, 0],
  [4, 40_831, 0.3], [4, 40_832, 0.2], [4, 42_760, 0.1], [4, 42_761, 0],
];

test('all sixteen printed 2025 cutoff cells, and the dollar either side of each', () => {
  for (const [size, agi, share] of CUTOFF_CELLS) {
    const r = ky(agi, size);
    money(creditOf(r), share * r.taxBeforeCredits, `size ${size} at $${agi}`);
  }
});

test('the cutoff is ROUNDED UP and the band is "not over" — both halves measured', () => {
  // 127% of $15,650 is $19,875.50. Rounded up the cutoff is $19,876 and a filer
  // AT it is still on the 30% step; truncated it would be $19,875 and the same
  // filer would be on the 20% step. The difference is ten points of the bill.
  const at = ky(19_876, 1);
  money(shareOf(at), 0.3, 'at the rounded cutoff');
  const above = ky(19_877, 1);
  money(shareOf(above), 0.2, 'one dollar above it');
  // And what the dollar is worth, which is the reason the rounding matters.
  const worth = creditOf(at) - creditOf(above) * (at.taxBeforeCredits / above.taxBeforeCredits);
  assert.ok(worth > 60, `one dollar of income is worth $${worth.toFixed(2)} here`);
});

// ===========================================================================
// THE BASE IS THE TAX AFTER THE PERSONAL CREDITS, AND THE ORDER IS LOAD-BEARING
// ===========================================================================

test('the staircase is a share of the tax AFTER the $40 age credit', () => {
  const r = ky(18_000, 1, { filerAge: 70 });
  money(r.taxBeforeCredits, 589.2, 'the bill');
  // 18,000 / 15,650 = 115.0%, so the 60% step.
  money(shareOf(r, 40), 0.6, 'the step');
  money(creditOf(r), 0.6 * (589.2 - 40), 'a share of what is left after the $40');
  money(r.tax, 589.2 - 40 - 0.6 * (589.2 - 40), 'and the tax');
});

test('reversing the two credits would produce a negative tax, and does not', () => {
  // A filer at 65 on the 100% step. Taking the percentage of the WHOLE bill and
  // the $40 afterwards gives -$40 on a credit KRS 141.066 does not refund.
  const r = ky(15_000, 1, { filerAge: 68 });
  money(r.tax, 0, 'exactly nothing, not less');
  assert.ok(r.tax >= 0, 'never negative');
  const aged = r.credits.filter((c) => c.name.includes('age 65 or over'));
  assert.equal(aged.length, 1);
  money(aged[0].amount, 40, 'the $40 is still claimed');
  money(creditOf(r), Math.max(0, r.taxBeforeCredits - 40), 'and this credit takes the rest');
});

test('a filer whose whole bill is below $40 has nothing left for this credit', () => {
  // The floor is what makes the ordering safe rather than merely correct.
  const r = ky(4_000, 1, { filerAge: 80 });
  money(r.taxBeforeCredits, 29.2, 'a $4,000 wage leaves $730 of taxable income');
  assert.ok(r.taxBeforeCredits < 40, `the bill is $${r.taxBeforeCredits.toFixed(2)}`);
  money(creditOf(r), 0, 'no remaining tax to credit');
  money(r.tax, 0, 'and the tax is nothing');
});

// ===========================================================================
// THE FAMILY SIZE CAP
// ===========================================================================

test('the maximum family size is four, so a fifth person moves nothing', () => {
  const four = ky(40_000, 4);
  for (const size of [5, 6, 7, 9]) {
    money(creditOf(ky(40_000, size)), creditOf(four), `size ${size} reads the size-4 column`);
  }
  // And it is a real cap rather than a coincidence of this income: the credit is
  // non-zero there, so a larger threshold would have changed it.
  assert.ok(creditOf(four) > 0, 'the cap binds somewhere it can be seen');
});

test('the four threshold amounts Kentucky publishes for 2025, derived', () => {
  // $15,650 / $21,150 / $26,650 / $32,150. Found by walking the 100% step: the
  // largest income at which the credit is still the whole bill IS the threshold.
  const expected = { 1: 15_650, 2: 21_150, 3: 26_650, 4: 32_150 };
  for (const [size, threshold] of Object.entries(expected)) {
    money(ky(threshold, Number(size)).tax, 0, `size ${size} at the threshold`);
    assert.ok(ky(threshold + 1, Number(size)).tax > 0, `size ${size} one dollar above it`);
  }
});

// ===========================================================================
// MODIFIED GROSS INCOME IS THE LARGER OF THE TWO AGIs
// ===========================================================================

test('a Kentucky subtraction does not buy eligibility for this credit', () => {
  // THE WHOLE REASON THIS BASE EXISTS. A retiree with $30,000 of pension has
  // almost no Kentucky AGI — KRS 141.019(1) excludes up to $31,110 — and
  // $30,000 of federal AGI. Measured on Kentucky AGI the household would be
  // under the threshold and pay nothing; measured on the larger figure, as
  // KRS 141.066 requires, it is at 191.7% and gets no credit at all.
  const r = stateIncomeTax({
    state: 'KY',
    year: 2025,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 30_000 },
    retirementIncome: 30_000,
  });
  assert.ok(r.stateAdjustedGrossIncome < 1_000, 'the pension exclusion empties Kentucky AGI');
  money(creditOf(r), 0, 'and the credit is nothing, on the federal figure');
});

test('the caller can supply the worksheet figure, and it is what gets used', () => {
  const derived = ky(15_650, 1);
  money(derived.tax, 0, 'derived: the 100% step');
  // The same household with a lump-sum distribution on the worksheet. Line (d)
  // is not in federal AGI, so nothing on this return implies it.
  const supplied = stateIncomeTax({
    state: 'KY',
    year: 2025,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 15_650 },
    earnedIncome: 15_650,
    kentuckyModifiedGrossIncome: 30_000,
  });
  money(creditOf(supplied), 0, 'the supplied figure is above 133% and buys no credit');
  money(supplied.tax, 495.2, 'so the whole bill stands');
  assert.ok(
    supplied.taxBeforeCredits === derived.taxBeforeCredits,
    'and the TAX base is untouched by it — it only chooses the step',
  );
});

test('the derived figure is named as an assumption only when it can still be wrong', () => {
  // New Mexico's rebate line set this rule and it is the same one here: a floor
  // on the income is a CEILING on the credit, so a return the staircase has
  // already settled at zero cannot be moved by a larger true figure, and
  // annotating it would report an uncertainty the arithmetic has closed.
  const inside = ky(16_000, 1);
  assert.match(creditNameOf(inside), /assumed: modified gross income/);
  assert.match(creditNameOf(inside), /kentuckyModifiedGrossIncome/);
  const outside = ky(40_000, 1);
  money(creditOf(outside), 0, 'no credit at 255% of the threshold');
  assert.doesNotMatch(creditNameOf(outside), /assumed/);
  // And a supplied figure is never an assumption.
  const supplied = stateIncomeTax({
    state: 'KY',
    year: 2025,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 16_000 },
    earnedIncome: 16_000,
    kentuckyModifiedGrossIncome: 16_000,
  });
  assert.doesNotMatch(creditNameOf(supplied), /assumed/);
  money(creditOf(supplied), creditOf(inside), 'and the same answer');
});

function creditNameOf(result) {
  const hit = result.credits.filter((c) => c.name.startsWith(CREDIT));
  assert.equal(hit.length, 1);
  return hit[0].name;
}

// ===========================================================================
// THE REFERENCE MODEL'S TWO FITTED CONSTANTS
// ===========================================================================

const GUIDELINE = { 2025: [15_650, 5_500], 2026: [15_960, 5_680] };
const PERCENTS = [100, 104, 108, 112, 116, 120, 124, 127, 130, 133];
const thresholdFor = (year, size) => {
  const [first, additional] = GUIDELINE[year];
  return first + additional * (Math.min(size, 4) - 1);
};

test('only 127% and 133% of a 2025 threshold are not whole dollars — all eight at $.50', () => {
  // This is the whole explanation for `1.270032` and `1.330032`, and it is
  // arithmetic rather than opinion: every 2025 threshold amount is an odd
  // multiple of $50, and of the ten statutory percentages only these two
  // multiply $50 into something other than a whole number.
  const fractional = [];
  for (const size of [1, 2, 3, 4]) {
    for (const percent of PERCENTS) {
      const product = (percent * thresholdFor(2025, size)) / 100;
      if (!Number.isInteger(product)) fractional.push([size, percent, product]);
    }
  }
  assert.equal(fractional.length, 8, 'eight fractional cells in the whole 2025 grid');
  assert.deepEqual(
    [...new Set(fractional.map(([, percent]) => percent))].sort((a, b) => a - b),
    [127, 133],
    'and they are at exactly two of the ten percentages',
  );
  for (const [size, percent, product] of fractional) {
    assert.equal(product - Math.floor(product), 0.5, `size ${size} at ${percent}% lands on $.50`);
  }
  // 130% sits BETWEEN the two fitted constants and is left round in the
  // reference model. This is why: 130% of a multiple of $50 is whole.
  for (const size of [1, 2, 3, 4]) {
    assert.ok(Number.isInteger((130 * thresholdFor(2025, size)) / 100), `130% at size ${size}`);
  }
});

test('the fitted constants and the rounded cutoff agree at EVERY 2025 income', () => {
  // So taking the rule that explains the printed grid costs nothing against the
  // one year both readings can be checked against. That is what makes it
  // shippable rather than merely better-argued.
  const fitted = [100, 104, 108, 112, 116, 120, 124, 1.270032, 1.3, 1.330032];
  for (const size of [1, 2, 3, 4]) {
    const threshold = thresholdFor(2025, size);
    for (let agi = 0; agi <= threshold * 1.5; agi += 1) {
      const rounded = PERCENTS.findIndex((p) => agi <= Math.round((p * threshold) / 100));
      const ratio = agi / threshold;
      const asFitted = fitted.findIndex((p) => ratio <= (p >= 100 ? p / 100 : p));
      assert.equal(rounded, asFitted, `2025 size ${size} at $${agi}`);
    }
  }
});

test('and they disagree at eleven incomes in 2026, each worth ten points of the bill', () => {
  // 2026's guideline is $15,960 and $5,680 — multiples of $40 and $10, and of
  // $50 only at family size four — so eight of the ten percentages produce a
  // fractional cutoff where in 2025 only two did, and a constant fitted to 2025
  // stops reproducing the rule it was fitted to.
  const fitted = [100, 104, 108, 112, 116, 120, 124, 1.270032, 1.3, 1.330032];
  const disagreements = [];
  for (const size of [1, 2, 3, 4]) {
    const threshold = thresholdFor(2026, size);
    for (let agi = 0; agi <= threshold * 1.5; agi += 1) {
      const rounded = PERCENTS.findIndex((p) => agi <= Math.round((p * threshold) / 100));
      const ratio = agi / threshold;
      const asFitted = fitted.findIndex((p) => ratio <= (p >= 100 ? p / 100 : p));
      if (rounded !== asFitted) disagreements.push([size, agi]);
    }
  }
  assert.equal(disagreements.length, 11, 'eleven integer incomes across the four family sizes');
  assert.deepEqual(
    disagreements,
    [
      [1, 17_237], [1, 18_514],
      [2, 22_506], [2, 24_237], [2, 26_834],
      [3, 28_413], [3, 29_506], [3, 33_877], [3, 34_697],
      [4, 41_911], [4, 43_891],
    ],
    'and they are these, by family size and income',
  );
  // What one of them costs. The 2026 rate is 3.5%.
  const r = ky(34_697, 3, { year: 2026 });
  const step = 0.1 * r.taxBeforeCredits;
  assert.ok(step > 100, `ten points of this household's bill is $${step.toFixed(2)}`);
});

// ===========================================================================
// THE SHAPE OF THE STAIRCASE, AS DATA
// ===========================================================================

test('the rule carries ten steps, written as integer percentage points', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('KY', year).familySizeTaxCredit;
    assert.ok(rule, `KY ${year} has the credit`);
    assert.equal(rule.steps.length, 10);
    assert.equal(rule.maximumFamilySize, 4);
    assert.equal(rule.refundable, false);
    assert.deepEqual(rule.steps.map((s) => s.thresholdPercent), PERCENTS);
    assert.deepEqual(
      rule.steps.map((s) => s.creditShare),
      [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
    );
    // INTEGERS, not decimals. Both halves of that choice are load-bearing and
    // the second is why it is asserted here: `mutantOf` reaches an integer at or
    // above 100 and declines a decimal at or above 1, so written `1.04 … 1.33`
    // these ten figures would be ten numbers the deliberate-error audit cannot
    // perturb, and written `104 … 133` they are ten it can.
    for (const step of rule.steps) {
      assert.ok(Number.isInteger(step.thresholdPercent), 'a percentage point is an integer');
      assert.ok(step.thresholdPercent >= 100, 'and at or above 100, so the audit reaches it');
    }
  }
});

test('the staircase is non-increasing in income, which is what makes a floor a ceiling', () => {
  // The direction the whole `kentuckyModifiedGrossIncome` argument rests on: a
  // derived income that is too LOW can only produce a credit that is too HIGH.
  //
  // THE SLACK IS A CENT AND IT IS NOT LAZINESS. The credit on the result is
  // rounded to cents, so dividing it back by the bill does NOT recover the
  // statutory share: at $16,029 and $16,166 the staircase gives 90% at both and
  // the recovered quotients straddle 0.9 in the last bits. A test that compares
  // recovered shares exactly fails there, and what it would be measuring is the
  // rounding rather than the staircase. So the claim is made in money, which is
  // the unit the answer is actually in: the credit never exceeds what the share
  // at a LOWER income would have paid on this bill, to within a cent.
  for (const year of [2025, 2026]) {
    for (const size of [1, 2, 3, 4]) {
      let previousShare = Infinity;
      for (let agi = 0; agi <= thresholdFor(year, size) * 1.4; agi += 137) {
        const r = ky(agi, size, { year });
        const bill = r.taxBeforeCredits;
        if (bill <= 0) {
          money(creditOf(r), 0, `${year} size ${size} at $${agi} has no bill`);
          continue;
        }
        assert.ok(
          creditOf(r) <= previousShare * bill + 0.01,
          `${year} size ${size} at $${agi}: paid ${creditOf(r).toFixed(2)} against a ceiling ` +
            `set at a lower income`,
        );
        previousShare = creditOf(r) / bill;
      }
    }
  }
});

test('2026 carries its own guideline and its own rate, and both moved', () => {
  const r2025 = ky(15_650, 1);
  const r2026 = ky(15_650, 1, { year: 2026 });
  money(r2025.tax, 0, '2025 at the 2025 threshold');
  money(r2026.tax, 0, '2026 is below its own larger threshold too');
  // $15,960 is 2026's threshold, and one dollar above it leaves the 100% step.
  money(ky(15_960, 1, { year: 2026 }).tax, 0, '2026 at its own threshold');
  assert.ok(ky(15_961, 1, { year: 2026 }).tax > 0, 'and one dollar above it');
  // The 2025 threshold is NOT the 2026 one: a package carrying last year's
  // figure would charge this household.
  assert.ok(ky(15_700, 1, { year: 2026 }).tax === 0, '$15,700 is free in 2026');
  assert.ok(ky(15_700, 1, { year: 2025 }).tax > 0, 'and not in 2025');
});
