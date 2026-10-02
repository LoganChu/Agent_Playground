// The suite was a suite for 2026, and nothing said so.
//
// ## How this file was found
//
// Day 32 left a rule and an unanswered question. The rule: an assertion on a
// DIFFERENCE tests the difference and nothing else, because a term on both sides
// of a subtraction cancels — which is how a Virginia age deduction sat at the
// wrong value for a month underneath its own passing test. The question: how much
// of this suite is differences?
//
// That question cannot be answered by reading assertions, because the tell is not
// in their shape. `assert.equal(r.tax, 1612.40)` is a level, and it is still blind
// to any parameter the household cannot reach. The only honest form of the
// question is operational:
//
//   IF THIS NUMBER WERE WRONG, WOULD ANY TEST FAIL?
//
// So `tools/mutation/mutate.mjs` sets each number in the built output wrong, one
// at a time, and runs the suite. 698 mutants, 654 killed, 93.7%. The 44 survivors
// are parameters this package could be shipped with a wrong value for, and they
// were not scattered:
//
//   data/2026.js      3 of 238 survived
//   data/2025.js     20 of 236 survived
//   data/2024.js     18 of 194 survived
//
// Nineteen of 2025's survivors have an exact counterpart in 2024, and NO
// counterpart in 2026. The same EITC credit rates, the same § 199A rates, the
// same child-credit phase-in, the same Additional Medicare threshold: pinned in
// 2026, unpinned in the two years behind it.
//
// **THE RULE: a multi-year engine's suite is a suite for ONE year unless
// something makes it run every year.** The newest year is the year the work
// happens in, so it gets the households; the years behind it get their tables
// transcribed and then nothing ever calls them again. And the failure is
// invisible from inside a test file, because every individual test is fine — the
// gap is in the set of years the set of tests happens to mention.
//
// This package advertises "three tax years, not one" as its first differentiator.
// Two of the three were materially less verified than the third.
//
// ## What this file does about it, in two parts that make DIFFERENT claims
//
// The two halves are separated deliberately, because one is a statutory claim and
// one is only a reachability claim, and conflating them would be the same mistake
// one level up.
//
//   PART 1 is a claim about the LAW. These parameters are fixed by statute and
//   have never been indexed, so they must be identical in every year this package
//   covers, and the citation is what makes the assertion evidence rather than a
//   restatement of the table. If 2027 arrives with a typo in one of them, this
//   fails — and that is the whole point, because a transcription error in an
//   un-indexed figure is exactly the error nobody rechecks.
//
//   PART 2 is a claim about REACHABILITY ONLY. The figures there are indexed, so
//   the expected values necessarily come from the table, and Day 27's rule applies
//   in full: a test written from the data can only confirm the data. What these
//   assertions add is not that the number is right but that it is LOAD-BEARING —
//   that the computation reads it, in this year, for this filing status. That is
//   the property the mutation run found missing, and it is worth having on its own.
//   It is not worth mislabelling.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILING_STATUSES,
  LATEST_YEAR,
  SUPPORTED_YEARS,
  SOCIAL_SECURITY_TAXABILITY,
  earnedIncomeCredit,
  estimateFederalTax,
  getYearParameters,
  longTermCapitalGainsTax,
  quarterlyEstimatedPayments,
  scheduleOneAParameters,
  socialSecurityTaxability,
  standardDeduction,
  computePaycheck,
} from './strict.mjs';

/** Walk a dotted path, so a declaration can name a parameter rather than fetch it. */
const at = (obj, path) =>
  path.split('.').reduce((o, k) => (o === undefined ? undefined : o[/^\d+$/.test(k) ? Number(k) : k]), obj);

// ---------------------------------------------------------------------------
// PART 1 — the parameters the Code sets, which no Revenue Procedure moves
// ---------------------------------------------------------------------------

/**
 * Every federal parameter in this package that is set by STATUTE and is not
 * inflation-adjusted, with the provision that sets it.
 *
 * The rule for adding a row: the citation must be to a provision that states the
 * number, not to a Revenue Procedure that publishes it for a year. A figure a
 * Revenue Procedure republishes annually belongs in Part 2 however long it has
 * happened to sit still — § 24(h)(2)'s $2,000 was un-indexed for eight years and
 * then OBBBA moved it, and a row here would have been a ratchet against the
 * change rather than a guard on it.
 */
const STATUTORY = [
  // § 32(b)(1) — the credit and phase-out percentages, by number of qualifying
  // children. Unmoved since the 1996 table; only the dollar amounts are indexed
  // under § 32(j).
  { path: 'earnedIncomeCredit.table.0.creditRate', value: 0.0765, cite: '§ 32(b)(1) — 7.65% with no qualifying children' },
  { path: 'earnedIncomeCredit.table.0.phaseOutRate', value: 0.0765, cite: '§ 32(b)(1) — 7.65% phase-out with no qualifying children' },
  { path: 'earnedIncomeCredit.table.1.creditRate', value: 0.34, cite: '§ 32(b)(1) — 34% with one qualifying child' },
  { path: 'earnedIncomeCredit.table.1.phaseOutRate', value: 0.1598, cite: '§ 32(b)(1) — 15.98% phase-out with one qualifying child' },
  { path: 'earnedIncomeCredit.table.2.creditRate', value: 0.4, cite: '§ 32(b)(1) — 40% with two qualifying children' },
  { path: 'earnedIncomeCredit.table.2.phaseOutRate', value: 0.2106, cite: '§ 32(b)(1) — 21.06% phase-out with two qualifying children' },
  { path: 'earnedIncomeCredit.table.3.creditRate', value: 0.45, cite: '§ 32(b)(1) — 45% with three or more qualifying children' },
  { path: 'earnedIncomeCredit.table.3.phaseOutRate', value: 0.2106, cite: '§ 32(b)(1) — the 21.06% phase-out is shared with the two-child row' },

  // § 24(d)(1)(B) — the refundable portion phases in at 15% of earned income over
  // $2,500. The RATE and the THRESHOLD are both in the statute; the $1,700 ceiling
  // beside them is indexed under § 24(h)(5) and is therefore not here.
  { path: 'childTaxCredit.refundable.phaseInRate', value: 0.15, cite: '§ 24(d)(1)(B)(i) — 15 percent of so much of the taxpayer’s earned income as exceeds $2,500' },
  { path: 'childTaxCredit.refundable.phaseInThreshold', value: 2_500, cite: '§ 24(d)(1)(B)(i) — the $2,500 floor, un-indexed since the TCJA wrote it' },
  // § 24(b)(1) — "$50 for each $1,000 (or fraction thereof)". The fraction clause
  // is why `rounding` is `up`, and the two numbers are the statute's own.
  { path: 'childTaxCredit.phaseOut.amountPerIncrement', value: 50, cite: '§ 24(b)(1) — $50 for each $1,000' },
  { path: 'childTaxCredit.phaseOut.increment', value: 1_000, cite: '§ 24(b)(1) — each $1,000 (or fraction thereof)' },

  // § 199A — every percentage in the section. The threshold amounts beside them
  // are indexed under § 199A(e)(2) and are not here.
  { path: 'section199A.deductionRate', value: 0.2, cite: '§ 199A(a) — 20 percent of qualified business income' },
  { path: 'section199A.w2WageRate', value: 0.5, cite: '§ 199A(b)(2)(B)(i) — 50 percent of W-2 wages' },
  { path: 'section199A.w2WageAlternativeRate', value: 0.25, cite: '§ 199A(b)(2)(B)(ii) — 25 percent of W-2 wages, plus' },
  { path: 'section199A.qualifiedPropertyRate', value: 0.025, cite: '§ 199A(b)(2)(B)(ii) — 2.5 percent of unadjusted basis' },

  // § 3101(b)(2) / § 1401(b)(2) — the Additional Medicare Tax thresholds. Written
  // into the Code by the ACA and never indexed, which is why they bind on more
  // people every year. The separate figure is half the joint one, which is the
  // one place in this list where the statute does the halving.
  { path: 'additionalMedicareThreshold.single', value: 200_000, cite: '§ 3101(b)(2)(C) — $200,000 in any other case' },
  { path: 'additionalMedicareThreshold.marriedFilingJointly', value: 250_000, cite: '§ 3101(b)(2)(A) — $250,000 in the case of a joint return' },
  { path: 'additionalMedicareThreshold.marriedFilingSeparately', value: 125_000, cite: '§ 3101(b)(2)(B) — $125,000 in the case of a married taxpayer filing separately' },
  { path: 'additionalMedicareThreshold.headOfHousehold', value: 200_000, cite: '§ 3101(b)(2)(C) — head of household takes the "any other case" figure' },
  { path: 'additionalMedicareThreshold.qualifyingSurvivingSpouse', value: 200_000, cite: '§ 3101(b)(2)(C) — a surviving spouse does not file a joint return, so they take the "any other case" figure' },

  // § 1402(a)(12) — net earnings from self-employment are reduced by 7.65%, so the
  // factor is 0.9235. The statute states the deduction; 0.9235 is its complement
  // and the figure the Schedule SE worksheet prints.
  { path: 'seNetEarningsFactor', value: 0.9235, cite: '§ 1402(a)(12) — a deduction equal to 7.65 percent of net earnings, so 92.35% remains' },
  { path: 'seMinimumNetEarnings', value: 400, cite: '§ 1402(b)(2) — no self-employment tax below $400 of net earnings' },
];

test('every statutory parameter is identical in every supported year, and equal to the Code’s figure', () => {
  assert.ok(SUPPORTED_YEARS.length >= 2, 'a cross-year test needs at least two years');
  for (const row of STATUTORY) {
    for (const year of SUPPORTED_YEARS) {
      const actual = at(getYearParameters(year), row.path);
      assert.notEqual(actual, undefined, `${row.path} is missing from ${year} — a renamed parameter must not silently pass`);
      assert.equal(
        actual,
        row.value,
        `${year}: ${row.path} is ${actual}, and ${row.cite} says ${row.value}`,
      );
    }
  }
});

test('every statutory row names a provision of the Code rather than a Revenue Procedure', () => {
  // A Revenue Procedure publishes a year's figure; only the Code fixes one for
  // every year. A row citing the former is asserting sameness with no authority
  // for it, which is the ratchet this file is supposed to avoid building.
  for (const row of STATUTORY) {
    assert.match(row.path, /^[\w.]+$/);
    assert.match(row.cite, /§/, `${row.path} must cite a section of the Code`);
    assert.doesNotMatch(
      row.cite,
      /Rev\.?\s*Proc|Revenue Procedure|Notice \d/i,
      `${row.path} cites a published figure rather than a statutory one — it belongs in Part 2`,
    );
  }
});

// § 86's fractions are in one table shared by every year rather than in the
// per-year files, so sameness is structural there and the useful assertion is
// against the statute alone.
test('§ 86’s fractions are the Code’s, and the first tier really is a LESSER-OF', () => {
  const p = SOCIAL_SECURITY_TAXABILITY;
  assert.equal(p.benefitFractionInCombinedIncome, 0.5, '§ 86(b)(1) — one-half of the benefits, in combined income');
  assert.equal(p.firstTierBenefitFraction, 0.5, '§ 86(a)(1)(A) — one-half of the benefits');
  assert.equal(p.firstTierExcessFraction, 0.5, '§ 86(a)(1)(B) — one-half of the excess over the base amount');
  assert.equal(p.secondTierExcessFraction, 0.85, '§ 86(a)(2)(A)(i) — 85 percent of the excess over the adjusted base');
  assert.equal(p.secondTierBracketFraction, 0.5, '§ 86(a)(2)(A)(ii) — plus the lesser of the first-tier amount');
  assert.equal(p.maximumBenefitFraction, 0.85, '§ 86(a)(2)(B) — never more than 85 percent of the benefits');

  // The mutation run halved `firstTierBenefitFraction` and the whole suite stayed
  // green, which means no household in it had the BENEFIT arm of § 86(a)(1)
  // binding. Tier one is `min(½ × benefits, ½ × excess)`, so the benefit arm binds
  // exactly when the benefit is SMALLER than the excess — a modest benefit beside
  // a middling pension, which is a common shape and was untested.
  //
  // Single filer, $4,000 of benefits, $31,000 of other income:
  //   combined income  = 31,000 + ½ × 4,000      = 33,000   (inside tier one)
  //   excess over base = 33,000 − 25,000         =  8,000
  //   ½ × excess       =  4,000     ½ × benefits =  2,000   -> the benefit arm
  const benefitArm = socialSecurityTaxability({
    filingStatus: 'single',
    socialSecurityBenefits: 4_000,
    adjustedGrossIncomeExcludingSocialSecurity: 31_000,
  });
  assert.equal(benefitArm.tier, 1, 'inside tier one, or the arms are not the ones being compared');
  assert.equal(benefitArm.taxableBenefits, 2_000, 'half of the benefit, because the benefit is the lesser arm');

  // And the other arm on the same shape, so the pair is asserted against each
  // other rather than each alone: raise the benefit and the EXCESS becomes the
  // lesser one.
  //   combined income  = 31,000 + ½ × 20,000     = 41,000 -> tier two, so lower
  //   the other income to keep it in tier one.
  const excessArm = socialSecurityTaxability({
    filingStatus: 'single',
    socialSecurityBenefits: 20_000,
    adjustedGrossIncomeExcludingSocialSecurity: 21_000,
  });
  //   combined = 21,000 + 10,000 = 31,000; excess = 6,000; ½ = 3,000 < 10,000
  assert.equal(excessArm.tier, 1);
  assert.equal(excessArm.taxableBenefits, 3_000, 'half of the excess, because the excess is the lesser arm');
  assert.ok(
    benefitArm.taxableBenefits < excessArm.taxableBenefits,
    'the two arms are distinct computations and must not be the same branch',
  );
});

test('LATEST_YEAR is the latest year, and is not merely asserted to be', () => {
  // A survivor of the mutation run. `LATEST_YEAR` is exported public API and the
  // default year for every entry point, and nothing tied it to the years actually
  // shipped: adding 2027's parameters without touching it would leave every
  // default caller on 2026 with no test failing. Day 30's rule — a table that
  // states a RELATION cannot drift from the data it describes.
  assert.equal(LATEST_YEAR, Math.max(...SUPPORTED_YEARS));
  assert.ok(SUPPORTED_YEARS.includes(LATEST_YEAR));
  // And ascending, which `SUPPORTED_YEARS` documents and nothing checked.
  assert.deepEqual([...SUPPORTED_YEARS].sort((a, b) => a - b), [...SUPPORTED_YEARS]);
});

// ---------------------------------------------------------------------------
// PART 2 — indexed figures, proved LOAD-BEARING in every year and every status
// ---------------------------------------------------------------------------
//
// Read the header before adding to this part. These assertions take their
// expected values from the table they are testing, so they are not evidence that
// the table is right. They are evidence that the table is READ.

/**
 * A fixed household `$5,000` above each finite § 1(h) ceiling, and the tax it
 * owes, for every supported year and filing status.
 *
 * Generated from the build once and then FROZEN, which is the whole mechanism:
 * the household is a constant, so moving a ceiling moves the answer and this
 * fails. The first version of this test computed its probe FROM the ceiling —
 * `gains = ceiling + 1` — and doubling the ceiling therefore moved the probe with
 * it, so the mutant survived a test written specifically to kill it. That is
 * Day 27's rule in its sharpest form yet: a test written from the data can only
 * confirm the data, and a test whose HOUSEHOLD is read out of the parameter is
 * invariant to the parameter no matter how many levels it asserts.
 *
 * What this is, honestly: a regression pin. The expected figures came from this
 * package, so they are not independent evidence that the ceilings are right —
 * `test/taxes.test.js` carries the published-figure checks. What they are is a
 * guarantee that no ceiling in any year or status can change without a test
 * saying so, which is exactly what was missing for single and head of household
 * in 2024 and 2025.
 */
const CAPITAL_GAINS_PINS = [
  [2024, 'single', 52_025, 750],
  [2024, 'single', 523_900, 71781.25],
  [2024, 'marriedFilingJointly', 99_050, 750],
  [2024, 'marriedFilingJointly', 588_750, 74455],
  [2024, 'marriedFilingSeparately', 52_025, 750],
  [2024, 'marriedFilingSeparately', 296_850, 37723.75],
  [2024, 'headOfHousehold', 68_000, 750],
  [2024, 'headOfHousehold', 556_350, 74252.5],
  [2024, 'qualifyingSurvivingSpouse', 99_050, 750],
  [2024, 'qualifyingSurvivingSpouse', 588_750, 74455],
  [2025, 'single', 53_350, 750],
  [2025, 'single', 538_400, 73757.5],
  [2025, 'marriedFilingJointly', 101_700, 750],
  [2025, 'marriedFilingJointly', 605_050, 76502.5],
  [2025, 'marriedFilingSeparately', 53_350, 750],
  [2025, 'marriedFilingSeparately', 305_000, 38747.5],
  [2025, 'headOfHousehold', 69_750, 750],
  [2025, 'headOfHousehold', 571_700, 76292.5],
  [2025, 'qualifyingSurvivingSpouse', 101_700, 750],
  [2025, 'qualifyingSurvivingSpouse', 605_050, 76502.5],
  [2026, 'single', 54_450, 750],
  [2026, 'single', 550_500, 75407.5],
  [2026, 'marriedFilingSeparately', 54_450, 750],
  [2026, 'marriedFilingSeparately', 311_850, 39610],
  [2026, 'marriedFilingJointly', 103_900, 750],
  [2026, 'marriedFilingJointly', 618_700, 78220],
  [2026, 'headOfHousehold', 71_200, 750],
  [2026, 'headOfHousehold', 584_600, 78010],
  [2026, 'qualifyingSurvivingSpouse', 103_900, 750],
  [2026, 'qualifyingSurvivingSpouse', 618_700, 78220],
];

test('every long-term capital gains ceiling is pinned, in every year and every status', () => {
  // The mutation run doubled `48_350` (2025 single) and `64_750` (2025 head of
  // household) and nothing failed; the joint figures were pinned and the others
  // were not. A rate boundary is the cheapest thing in a tax engine to test and
  // the easiest to leave to one filing status.
  assert.equal(
    CAPITAL_GAINS_PINS.length,
    SUPPORTED_YEARS.length * FILING_STATUSES.length * 2,
    'two pins for every year and status, or a year or status has no pin at all',
  );
  for (const [year, filingStatus, longTermGains, expected] of CAPITAL_GAINS_PINS) {
    assert.ok(SUPPORTED_YEARS.includes(year), `${year} is pinned and not shipped`);
    assert.ok(FILING_STATUSES.includes(filingStatus));
    const { tax } = longTermCapitalGainsTax({
      ordinaryTaxableIncome: 0,
      longTermGains,
      filingStatus,
      year,
    });
    assert.equal(
      Math.round(tax * 100) / 100,
      expected,
      `${year} ${filingStatus}: $${longTermGains.toLocaleString('en-US')} of gains`,
    );
  }
});

test('the dollar above each capital gains ceiling costs the next rate up', () => {
  // The structural half, and it is a DIFFERENCE, so it is here as a companion to
  // the pins above rather than instead of them. What it adds is § 1(h)'s shape:
  // three rates, ascending, with the step at each boundary equal to the next rate.
  for (const year of SUPPORTED_YEARS) {
    for (const filingStatus of FILING_STATUSES) {
      const brackets = getYearParameters(year).longTermCapitalGains[filingStatus];
      assert.equal(brackets.length, 3, `${year} ${filingStatus}: § 1(h) has three rates`);
      assert.deepEqual(
        brackets.map((b) => b.rate),
        [0, 0.15, 0.2],
        `${year} ${filingStatus}: § 1(h)(1) sets 0%, 15% and 20% in that order`,
      );
      assert.equal(brackets[2].upTo, Infinity, 'the 20% rate has no ceiling');
      for (let i = 0; i < brackets.length - 1; i++) {
        const ceiling = brackets[i].upTo;
        const step = (g) =>
          longTermCapitalGainsTax({ ordinaryTaxableIncome: 0, longTermGains: g, filingStatus, year }).tax;
        assert.equal(
          Math.round((step(ceiling + 1) - step(ceiling)) * 100) / 100,
          brackets[i + 1].rate,
          `${year} ${filingStatus}: the dollar above ${ceiling} must cost ${brackets[i + 1].rate}`,
        );
      }
      // Ascending, with no zero-width band — a duplicated ceiling would make one
      // rate unreachable and every step assertion above would still pass.
      assert.ok(brackets[0].upTo < brackets[1].upTo, `${year} ${filingStatus}: the 15% band must have width`);
    }
  }
});

/**
 * § 32(i)'s investment-income cliff, as a frozen household per year.
 *
 * Same lesson as the capital gains pins: the first version computed its probe as
 * `limit + 1`, so doubling the limit moved the probe and the mutant lived. The
 * amounts here are constants.
 */
const EITC_INVESTMENT_PINS = [
  // year, investment income, credit — one household just under each year's limit
  // and one just over it. 2024 $11,600, 2025 $11,950, 2026 $12,200.
  [2024, 11_500, true],
  [2024, 11_700, false],
  [2025, 11_900, true],
  [2025, 12_000, false],
  [2026, 12_100, true],
  [2026, 12_300, false],
];

test('the EITC investment income cliff falls in the right place in every year', () => {
  // § 32(i) disqualifies a filer whose disqualified investment income exceeds the
  // limit. The limit is indexed, and the mutation run doubled 2025's `11_950` and
  // 2024's `11_600` with nothing failing: the cliff was tested in 2026 only.
  //
  // The pins straddle each year's limit with FIXED amounts, which is what makes
  // them sensitive to it — and they also cross-check the years against each
  // other, because $12,000 of investment income is fatal in 2025 and fine in 2026.
  for (const [year, investmentIncome, eligible] of EITC_INVESTMENT_PINS) {
    const result = earnedIncomeCredit({
      filingStatus: 'single',
      qualifyingChildren: 1,
      earnedIncome: 20_000,
      adjustedGrossIncome: 20_000 + investmentIncome,
      investmentIncome,
      year,
    });
    if (eligible) {
      assert.ok(result.credit > 0, `${year}: $${investmentIncome.toLocaleString('en-US')} is under the limit`);
    } else {
      assert.equal(result.credit, 0, `${year}: $${investmentIncome.toLocaleString('en-US')} is over the limit`);
      // § 32(i) is a cliff and not a phase-out, so the loss is the WHOLE credit.
      // Asserting that the trapezoid is untouched is what says which of the two
      // it is: eligibility moved, not the arithmetic.
      assert.ok(result.phasedInCredit > 0, 'the credit they would have had is still reported');
    }
  }
  // And $12,000 really does mean different things in two adjacent years, which is
  // the whole claim of a multi-year engine.
  const twelveThousand = (year) =>
    earnedIncomeCredit({
      filingStatus: 'single',
      qualifyingChildren: 1,
      earnedIncome: 20_000,
      adjustedGrossIncome: 32_000,
      investmentIncome: 12_000,
      year,
    }).credit;
  assert.equal(twelveThousand(2025), 0);
  assert.ok(twelveThousand(2026) > 0);
});

test('the § 6654 safe harbor knows that a separate return halves the threshold', () => {
  // `HIGH_INCOME_SAFE_HARBOR_AGI_MFS` survived the mutation run: nothing filed a
  // separate return through `quarterlyEstimatedPayments`, so the 110% rule was
  // tested at $150,000 and never at the $75,000 that applies to half of it.
  //
  // § 6654(d)(1)(C)(i) raises the prior-year safe harbor to 110% where prior-year
  // AGI exceeded $150,000, and (ii) reads that as $75,000 for a separate return.
  // A prior-year tax large enough that 110% of it still beats 90% of this year's,
  // so the 110% figure is the one that lands in `priorYearTarget` and is visible.
  const plan = (filingStatus, priorYearAdjustedGrossIncome) =>
    quarterlyEstimatedPayments(
      estimateFederalTax({ year: LATEST_YEAR, filingStatus, w2Wages: 500_000 }),
      { priorYearTotalTax: 20_000, priorYearAdjustedGrossIncome },
    );

  // A separate filer at $80,000 of prior-year AGI is over the $75,000 line, and a
  // single filer at the same AGI is nowhere near the $150,000 one. Same prior-year
  // tax, same current year, and the plans differ by $2,000 on filing status alone.
  const separate = plan('marriedFilingSeparately', 80_000);
  const single = plan('single', 80_000);
  // The household has to be a real one. `EstimateInput` silently ignores a field
  // it does not know, so the first draft of this test passed every assertion below
  // while running a filer with NO INCOME — the field was `wages` and the property
  // is `w2Wages`. Pinning a LEVEL on the household is what caught it, which is
  // Day 32's rule turned back on the test that was written to apply it.
  assert.ok(separate.currentYearTarget > 100_000, 'the filer must actually owe tax');
  assert.ok(single.currentYearTarget > 100_000, 'and so must the one being compared with them');
  assert.equal(separate.usedHigherPriorYearRate, true, 'a separate filer above $75,000 owes 110% of last year');
  assert.equal(single.usedHigherPriorYearRate, false, 'a single filer at the same AGI owes 100%');
  assert.equal(separate.priorYearTarget, 22_000);
  assert.equal(single.priorYearTarget, 20_000);
  assert.equal(separate.basis, 'priorYearSafeHarbor');
  assert.equal(single.basis, 'priorYearSafeHarbor');

  // And the boundary itself, on each side, so the threshold is read rather than
  // merely exceeded. § 6654(d)(1)(C)(i) says "exceeds", so the line itself is out.
  assert.equal(plan('marriedFilingSeparately', 75_000).usedHigherPriorYearRate, false);
  assert.equal(plan('marriedFilingSeparately', 75_001).usedHigherPriorYearRate, true);
  assert.equal(plan('single', 150_000).usedHigherPriorYearRate, false);
  assert.equal(plan('single', 150_001).usedHigherPriorYearRate, true);
});

/**
 * The aged and blind additional standard deduction, § 63(f), for every year,
 * filing status and combination.
 *
 * The mutation run found the UNMARRIED figure unpinned in all three years —
 * `1_950` in 2024, `2_000` in 2025, `2_050` in 2026 — while the married one was
 * tested. That is the more common of the two: every unmarried filer over 65 in the
 * country takes it, and it was the one number here nothing could see.
 *
 * Three columns rather than one, because § 63(f) stacks: one amount for age, one
 * for blindness, and a filer who is both takes both. Asserting only the aged
 * column cannot tell a doubled amount from a doubled multiplier.
 */
const AGED_BLIND_PINS = [
  // year, status, base, age 65+, age 65+ AND blind
  [2024, 'single', 14_600, 16_550, 18_500],
  [2024, 'marriedFilingJointly', 29_200, 30_750, 32_300],
  [2024, 'marriedFilingSeparately', 14_600, 16_150, 17_700],
  [2024, 'headOfHousehold', 21_900, 23_850, 25_800],
  [2024, 'qualifyingSurvivingSpouse', 29_200, 30_750, 32_300],
  [2025, 'single', 15_750, 17_750, 19_750],
  [2025, 'marriedFilingJointly', 31_500, 33_100, 34_700],
  [2025, 'marriedFilingSeparately', 15_750, 17_350, 18_950],
  [2025, 'headOfHousehold', 23_625, 25_625, 27_625],
  [2025, 'qualifyingSurvivingSpouse', 31_500, 33_100, 34_700],
  [2026, 'single', 16_100, 18_150, 20_200],
  [2026, 'marriedFilingJointly', 32_200, 33_850, 35_500],
  [2026, 'marriedFilingSeparately', 16_100, 17_750, 19_400],
  [2026, 'headOfHousehold', 24_150, 26_200, 28_250],
  [2026, 'qualifyingSurvivingSpouse', 32_200, 33_850, 35_500],
];

test('§ 63(f)’s aged and blind amounts are pinned for every year and status', () => {
  assert.equal(AGED_BLIND_PINS.length, SUPPORTED_YEARS.length * FILING_STATUSES.length);
  for (const [year, filingStatus, base, aged, agedAndBlind] of AGED_BLIND_PINS) {
    assert.equal(standardDeduction({ year, filingStatus }), base, `${year} ${filingStatus}: base`);
    assert.equal(
      standardDeduction({ year, filingStatus, age65OrOlder: true }),
      aged,
      `${year} ${filingStatus}: § 63(f)(1) age`,
    );
    assert.equal(
      standardDeduction({ year, filingStatus, age65OrOlder: true, blind: true }),
      agedAndBlind,
      `${year} ${filingStatus}: § 63(f)(1) and (f)(2) stack`,
    );
    // The increment is the same for both conditions, and equal to the parameter.
    const extra = getYearParameters(year).additionalStandardDeduction[filingStatus];
    assert.equal(aged - base, extra, `${year} ${filingStatus}: one amount for age`);
    assert.equal(agedAndBlind - aged, extra, `${year} ${filingStatus}: a second, equal amount for blindness`);
  }
  // § 63(f) gives the UNMARRIED filer the larger amount, which is the opposite of
  // every other figure in the standard deduction and is easy to transcribe the
  // wrong way round. Stated as a relation so it cannot drift with indexation.
  for (const year of SUPPORTED_YEARS) {
    const p = getYearParameters(year).additionalStandardDeduction;
    assert.ok(
      p.single > p.marriedFilingJointly,
      `${year}: § 63(f)(3) allows the larger amount to an individual who is NOT married`,
    );
    assert.equal(p.single, p.headOfHousehold, `${year}: a head of household is unmarried for § 63(f)(3)`);
    assert.equal(
      p.marriedFilingSeparately,
      p.marriedFilingJointly,
      `${year}: a separate filer is married, so they take the married amount`,
    );
    assert.equal(
      p.qualifyingSurvivingSpouse,
      p.marriedFilingJointly,
      `${year}: § 63(f)(3) reaches a surviving spouse through § 63(c)(2)(A), so they take the married amount`,
    );
  }
});

test('the Additional Medicare WITHHOLDING threshold is $200,000 for everyone, in every year', () => {
  // A survivor of the mutation run, and a different parameter from
  // `additionalMedicareThreshold` in Part 1 — which is the one that settles the
  // TAX. This one settles what the employer takes out, and the two are different
  // numbers for most filers on purpose.
  //
  // § 3102(f)(1) requires an employer to withhold Additional Medicare Tax on
  // wages above $200,000 "without regard to" the employee's filing status or
  // other wages, because an employer does not know either. So a joint couple each
  // earning $180,000 has $360,000 of wages, owes the tax on $110,000 of it, and
  // has nothing withheld — the single most common source of an unexpected balance
  // due at this income, and it is a feature of the statute rather than an error.
  for (const year of SUPPORTED_YEARS) {
    const p = getYearParameters(year);
    assert.equal(
      p.withholding.additionalMedicareWithholdingThreshold,
      200_000,
      `${year}: § 3102(f)(1) — $200,000 regardless of filing status`,
    );
    // And the gap this creates, asserted rather than described: the withholding
    // threshold is BELOW the joint tax threshold and ABOVE the separate one.
    assert.ok(p.withholding.additionalMedicareWithholdingThreshold < p.additionalMedicareThreshold.marriedFilingJointly);
    assert.ok(p.withholding.additionalMedicareWithholdingThreshold > p.additionalMedicareThreshold.marriedFilingSeparately);
  }

  // Behavioural, on a single wage: one dollar over the line is withheld on at
  // 0.9%, and the dollar below it is not.
  const withheld = (wages) =>
    computePaycheck({
      year: LATEST_YEAR,
      filingStatus: 'marriedFilingJointly',
      payPeriod: 'annual',
      wagesThisPeriod: wages,
    }).additionalMedicare;
  assert.equal(withheld(200_000), 0, 'nothing is withheld at the threshold itself');
  // $1,000 over rather than $1 over: at one dollar the answer is 0.9 cents and
  // `roundCents` returns a penny, so a $1 probe measures the rounding rather than
  // the rate. Day 33's harness learned the same thing from the other side — a
  // mutant that dies of rounding teaches nothing, and neither does an assertion
  // that passes because of it.
  assert.equal(withheld(201_000), 9, '0.9% of the $1,000 above the threshold');
  // A joint filer whose TAX threshold is $250,000 still has withholding start at
  // $200,000, which is the § 3102(f)(1) mismatch made visible.
  assert.ok(withheld(240_000) > 0);
});

test('§ 199A’s indexed threshold is pinned in every year and status', () => {
  // 2025's joint threshold `394_600` survived. The thresholds are indexed under
  // § 199A(e)(2), so these are frozen pins rather than statutory claims — the
  // ratio between them is the statutory part and is asserted separately.
  const PINS = {
    2024: { single: 191_950, marriedFilingJointly: 383_900, marriedFilingSeparately: 191_950 },
    2025: { single: 197_300, marriedFilingJointly: 394_600, marriedFilingSeparately: 197_300 },
    2026: { single: 201_750, marriedFilingJointly: 403_500, marriedFilingSeparately: 201_775 },
  };
  for (const year of SUPPORTED_YEARS) {
    const p = getYearParameters(year).section199A.thresholdAmount;
    for (const [filingStatus, expected] of Object.entries(PINS[year])) {
      assert.equal(p[filingStatus], expected, `${year} ${filingStatus}: § 199A threshold`);
    }
    // § 199A(e)(2)(B) sets the joint threshold at twice the base figure. The
    // SEPARATE figure is where this stops being arithmetic: 2026 rounds it to
    // $201,775 — $25 ABOVE half the joint amount and above the single amount —
    // while 2024 and 2025 have it equal to single. Both are the published
    // figures, and a package that derived one from the other would be wrong in
    // one year out of three.
    assert.equal(p.marriedFilingJointly, p.single * 2, `${year}: § 199A(e)(2) — twice the single amount`);
    assert.equal(p.headOfHousehold, p.single, `${year}: head of household takes the single threshold`);
    assert.equal(p.qualifyingSurvivingSpouse, p.single, `${year}: so does a surviving spouse`);
  }
  assert.equal(
    getYearParameters(2026).section199A.thresholdAmount.marriedFilingSeparately,
    201_775,
    'the one year where the separate figure is not the single one',
  );
});

test('every parameter block’s finalYear says which year it stops applying to', () => {
  // `saltCap.finalYear` survived in 2024 (`2024`) and 2025 (`2029`). It is worth
  // knowing WHY, and the answer is the third kind of survivor: nothing reads it.
  // `scheduleOneA.finalYear` gates a provision at `obbba.ts`; `saltCap.finalYear`
  // is exported through `saltCapParameters()` and gates nothing, because the
  // caller selects the parameter block by passing a year.
  //
  // That is a fine design and a bad silence. Documented and pinned here, so it
  // cannot drift and so nobody mistakes it for a switch.
  const EXPECTED = {
    2024: { saltCap: 2024, scheduleOneA: null },
    2025: { saltCap: 2029, scheduleOneA: 2028 },
    2026: { saltCap: 2029, scheduleOneA: 2028 },
  };
  for (const year of SUPPORTED_YEARS) {
    const p = getYearParameters(year);
    assert.equal(p.saltCap.finalYear, EXPECTED[year].saltCap, `${year}: OBBBA § 70120 replaced the $10,000 cap after 2024`);
    const sched = EXPECTED[year].scheduleOneA;
    if (sched === null) {
      assert.equal(p.scheduleOneA ?? null, null, `${year}: Schedule 1-A did not exist`);
      assert.equal(scheduleOneAParameters(year), null, `${year}: and the accessor says so`);
    } else {
      assert.equal(p.scheduleOneA.finalYear, sched, `${year}: OBBBA § 70201 et seq. sunset after ${sched}`);
      assert.notEqual(scheduleOneAParameters(year), null);
    }
  }
  // And the gate really is a gate: `scheduleOneA.finalYear` is read, so a year
  // past it returns null rather than a table.
  assert.equal(scheduleOneAParameters(2024), null);
});
