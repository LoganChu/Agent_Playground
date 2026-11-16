// Tax year 2027, derived rather than trusted.
//
// ## WHY THIS FILE IS DIFFERENT FROM EVERY OTHER YEAR'S
//
// 2024, 2025 and 2026 were transcribed from the IRS Revenue Procedure that
// publishes them. 2027 was not: `irs.gov` is outside this project's sandbox and
// `rp-26-35.pdf` has never been opened here. What stands behind the figures is
// three independent transcription chains that agree — see the header of
// `src/data/2027.ts` — and this file is the third of them, mechanised.
//
// ## WHAT IT CAN AND CANNOT CATCH, STATED BEFORE THE ASSERTIONS
//
// § 1(f) indexes each amount from a fixed base-year figure times a cumulative
// price ratio, and then rounds. It does NOT index last year's rounded figure.
// So a test that chains 2026 -> 2027 through the published 2026 values carries
// up to one rounding unit of error per figure, and the single exact factor that
// would reproduce all sixty-eight indexed amounts from their 2026 values does
// not exist. That was measured here rather than assumed: the per-figure implied
// ratios run from 1.02439 to 1.03298, and the narrow ones do not intersect.
//
// So this file asserts a BAND and not an identity, and is honest about the
// consequence:
//
// THE REACH BELOW WAS MEASURED, NOT GUESSED. Nine single-figure edits were made
// to the built 2027 parameters and the suite was re-run against each:
//
//   CAUGHT   $109,125 -> $190,125   a transposed digit (3 tests failed)
//            $24,925  -> $24,900    the head-of-household "correction"
//            $7,552   -> $7,522     a digit inside an EITC maximum
//            $208,300 -> $208,350   a $50 move in a § 199A threshold
//            $264,550 -> $264,500   a $50 move in a single bracket ceiling
//            $661,350 -> $661,300   a $50 move with no structural partner
//            $11,210  -> $11,250    a $40 move in an EITC phase-out start
//   MISSED   $69,650  -> $69,600    the head-of-household 12% ceiling
//            $12,600  -> $12,650    the § 32(i) investment income limit
//
// The two that escape are the shape to know: a figure that belongs to no
// statutory relation AND whose 2026 base is small enough that $50 sits inside
// the indexing band. Every head-of-household-only ceiling is in that class.
// A $50 ceiling is worth a few dollars of tax and a transposed digit is worth
// thousands, so this is the right way round — but it is a reach, not a proof,
// and reading `rp-26-35.pdf` is still the thing that would settle it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILING_STATUSES,
  SUPPORTED_YEARS,
  PRIMARY_VERIFIED_YEARS,
  isPrimaryVerified,
  getYearParameters,
  stateAndLocalTaxDeduction,
} from './strict.mjs';

const BEFORE = getYearParameters(2026);
const YEAR = getYearParameters(2027);

/**
 * The § 1(f) indexing factor for 2027, as a band.
 *
 * Secondary reports of Rev. Proc. 2026-35 put the adjustment at about 3.2%.
 * The band is deliberately wider than that: it has to hold for a $2,050 figure
 * rounded to $50 as well as for a $768,700 one, and the small figures are where
 * a rounding unit is a large share of the amount.
 */
const FACTOR = 1.0325;
const FACTOR_TOLERANCE = 100;

/** Every figure in 2027 that § 1(f) indexes, against its 2026 value. */
function indexedFigures() {
  const rows = [];
  for (const status of FILING_STATUSES) {
    BEFORE.ordinaryBrackets[status].forEach((bracket, i) => {
      if (!Number.isFinite(bracket.upTo)) return;
      rows.push([`ordinaryBrackets.${status}.${bracket.rate}`, bracket.upTo, YEAR.ordinaryBrackets[status][i].upTo]);
    });
    BEFORE.longTermCapitalGains[status].forEach((bracket, i) => {
      if (!Number.isFinite(bracket.upTo)) return;
      rows.push([
        `longTermCapitalGains.${status}.${bracket.rate}`,
        bracket.upTo,
        YEAR.longTermCapitalGains[status][i].upTo,
      ]);
    });
    rows.push([`standardDeduction.${status}`, BEFORE.standardDeduction[status], YEAR.standardDeduction[status]]);
    rows.push([
      `additionalStandardDeduction.${status}`,
      BEFORE.additionalStandardDeduction[status],
      YEAR.additionalStandardDeduction[status],
    ]);
    rows.push([
      `section199A.thresholdAmount.${status}`,
      BEFORE.section199A.thresholdAmount[status],
      YEAR.section199A.thresholdAmount[status],
    ]);
  }
  BEFORE.earnedIncomeCredit.table.forEach((row, i) => {
    rows.push([
      `earnedIncomeCredit.table.${i}.maximumCredit`,
      row.maximumCredit,
      YEAR.earnedIncomeCredit.table[i].maximumCredit,
    ]);
    for (const status of FILING_STATUSES) {
      rows.push([
        `earnedIncomeCredit.table.${i}.phaseOutStart.${status}`,
        row.phaseOutStart[status],
        YEAR.earnedIncomeCredit.table[i].phaseOutStart[status],
      ]);
    }
  });
  rows.push([
    'earnedIncomeCredit.maximumInvestmentIncome',
    BEFORE.earnedIncomeCredit.maximumInvestmentIncome,
    YEAR.earnedIncomeCredit.maximumInvestmentIncome,
  ]);
  return rows;
}

test('2027 is shipped and is NOT the default, and says so in data', () => {
  assert.ok(SUPPORTED_YEARS.includes(2027), '2027 ships');
  assert.equal(isPrimaryVerified(2027), false, '2027 has not been checked against rp-26-35.pdf');
  assert.ok(!PRIMARY_VERIFIED_YEARS.includes(2027));
  // The sources a caller reads must SAY so. A caveat only a maintainer can see
  // is not a caveat; `getYearParameters(2027).sources` is the thing a consumer
  // of this package actually gets.
  const titles = YEAR.sources.map((source) => source.title);
  assert.ok(
    titles.some((title) => title.includes('TRANSCRIPTION NOT VERIFIED')),
    '2027 must state in its own citation list that the primary document was never opened',
  );
  assert.ok(titles.some((title) => title.includes('Rev. Proc. 2026-35')));
});

test('every indexed figure moved UP, and none sat still', () => {
  // A year file copied from its neighbour and half-edited leaves the untouched
  // figures equal to last year's, which is the single most likely shape of a
  // bad new year and the one nothing else here would see.
  for (const [path, before, after] of indexedFigures()) {
    assert.ok(
      after > before,
      `${path}: 2026 is ${before} and 2027 is ${after}. An indexed figure that did not rise is ` +
        'either a carry-forward or a transcription that stopped early.',
    );
  }
});

test('one indexing factor of about 3.25% explains every indexed figure', () => {
  const rows = indexedFigures();
  assert.ok(rows.length >= 60, `only ${rows.length} indexed figures found — the walk is not reaching the data`);
  let worst = null;
  for (const [path, before, after] of rows) {
    const residual = Math.abs(after - before * FACTOR);
    if (worst === null || residual > worst[1]) worst = [path, residual];
    assert.ok(
      residual <= FACTOR_TOLERANCE,
      `${path}: 2026 x ${FACTOR} is ${(before * FACTOR).toFixed(2)} and 2027 says ${after}, which is ` +
        `${residual.toFixed(2)} away. Every other indexed figure in this year agrees on one factor; ` +
        'this one does not, which is what a digit read off the wrong row looks like.',
    );
  }
  // Pinned, so the tolerance cannot be quietly widened by a figure that drifts
  // toward it. The worst residual today is the head-of-household 35% ceiling.
  assert.ok(worst[1] < 80, `the worst residual is now ${worst[0]} at ${worst[1].toFixed(2)}`);
});

test('the Social Security wage base is NOT on the § 1(f) factor, and that is the point', () => {
  // $184,500 -> $192,300 is 4.23%, against the 3.25% every IRS figure moved by.
  // It is indexed to the national average wage index under 42 U.S.C. § 430 and
  // published by the SSA in October, before the Revenue Procedure exists. A
  // package that indexed it alongside the brackets would be $1,800 of wage base
  // short — $223.20 of OASDI tax on a high earner.
  const ratio = YEAR.socialSecurityWageBase / BEFORE.socialSecurityWageBase;
  assert.ok(ratio > 1.04, `the wage base moved ${((ratio - 1) * 100).toFixed(2)}%, which is suspiciously CPI-like`);
  assert.equal(YEAR.socialSecurityWageBase, 192_300);
});

test('the statutory doubling and halving relations hold', () => {
  const brackets = YEAR.ordinaryBrackets;
  // § 1(j)(2): the joint table is twice the single table at every ceiling
  // EXCEPT the 35% one, where the statute writes its own figure. That exception
  // is the reason this is asserted band by band rather than as a whole table.
  brackets.single.forEach((bracket, i) => {
    if (!Number.isFinite(bracket.upTo)) return;
    const joint = brackets.marriedFilingJointly[i].upTo;
    if (bracket.rate === 0.35) {
      assert.ok(joint < bracket.upTo * 2, '§ 1(j): the joint 35% ceiling is NOT twice the single one');
      assert.equal(
        brackets.marriedFilingSeparately[i].upTo,
        joint / 2,
        'and the separate 35% ceiling is exactly half the joint one',
      );
      return;
    }
    assert.equal(joint, bracket.upTo * 2, `the joint ${bracket.rate} ceiling is twice the single one`);
    assert.equal(
      brackets.marriedFilingSeparately[i].upTo,
      bracket.upTo,
      `the separate ${bracket.rate} ceiling equals the single one`,
    );
  });
  // A surviving spouse takes the joint RATE SCHEDULE under § 1(a).
  assert.deepEqual(brackets.qualifyingSurvivingSpouse, brackets.marriedFilingJointly);
  // § 63(c)(2)(A): the joint standard deduction is twice the single amount.
  assert.equal(YEAR.standardDeduction.marriedFilingJointly, YEAR.standardDeduction.single * 2);
  assert.equal(YEAR.standardDeduction.marriedFilingSeparately, YEAR.standardDeduction.single);
  // § 199A(e)(2)(B): twice the base amount on a joint return.
  assert.equal(YEAR.section199A.thresholdAmount.marriedFilingJointly, YEAR.section199A.thresholdAmount.single * 2);
});

test('THE HEAD-OF-HOUSEHOLD STANDARD DEDUCTION IS NO LONGER 1.5x THE SINGLE ONE', () => {
  // It was exactly that in every year this package has ever shipped:
  //   2024  $21,900 = 1.5 x $14,600
  //   2025  $23,625 = 1.5 x $15,750   (a statutory figure, not an indexed one)
  //   2026  $24,150 = 1.5 x $16,100
  // § 63(c)(7)(B)(ii) indexes the two amounts SEPARATELY, so the ratio was
  // never a rule — it was three years of roundings happening to agree. 2027 is
  // the year they part: 1.5 x $16,600 is $24,900 and the published figure is
  // $24,925.
  //
  // THIS IS A $25 DEDUCTION ERROR FOR EVERY HEAD OF HOUSEHOLD IN THE COUNTRY in
  // any engine that derives one amount from the other, and one of the secondary
  // sources consulted for this year printed $24,900 for exactly that reason.
  // It is pinned here, loudly, because it is the single figure in 2027 most
  // likely to be wrong somewhere else.
  for (const year of [2024, 2026]) {
    const d = getYearParameters(year).standardDeduction;
    assert.equal(d.headOfHousehold, d.single * 1.5, `${year}: the ratio still held`);
  }
  assert.equal(YEAR.standardDeduction.single, 16_600);
  assert.equal(YEAR.standardDeduction.headOfHousehold, 24_925);
  assert.notEqual(
    YEAR.standardDeduction.headOfHousehold,
    YEAR.standardDeduction.single * 1.5,
    'if this ever passes again, somebody has "corrected" $24,925 to $24,900',
  );
  // Both land on a multiple of $25 and only one on a multiple of $50, which is
  // the mechanism: the amounts round down to $25, and $24,900 is what you get
  // by rounding to $50 instead.
  assert.equal(YEAR.standardDeduction.headOfHousehold % 25, 0);
  assert.notEqual(YEAR.standardDeduction.headOfHousehold % 50, 0);
});

test('the head-of-household bracket divergences moved in BOTH directions', () => {
  // 2026: the 22% band was level with single and the 24% and 32% bands were $25
  // below. 2027: the 22% band is $25 below and the 32% band is level. Neither
  // year is a typo; separate roundings of separately indexed amounts do this,
  // and it is why all five statuses are written out in full rather than aliased.
  const ceiling = (params, status, rate) => params.ordinaryBrackets[status].find((b) => b.rate === rate).upTo;
  assert.equal(ceiling(BEFORE, 'headOfHousehold', 0.22), ceiling(BEFORE, 'single', 0.22), '2026: level');
  assert.equal(ceiling(BEFORE, 'headOfHousehold', 0.32), ceiling(BEFORE, 'single', 0.32) - 25, '2026: $25 below');
  assert.equal(ceiling(YEAR, 'headOfHousehold', 0.22), ceiling(YEAR, 'single', 0.22) - 25, '2027: $25 below');
  assert.equal(ceiling(YEAR, 'headOfHousehold', 0.32), ceiling(YEAR, 'single', 0.32), '2027: level');
});

test('the SALT cap is a statutory schedule and is computable without the IRS', () => {
  // § 164(b)(6) as amended by OBBBA § 70120: the cap and the phase-down
  // threshold each rise exactly 1% a year from 2025. Nothing here needs a
  // Revenue Procedure, so this is the one part of 2027 that is as well attested
  // as every other year in the package.
  const round2 = (n) => Math.round(n * 100) / 100;
  assert.equal(YEAR.saltCap.cap.single, round2(BEFORE.saltCap.cap.single * 1.01));
  assert.equal(YEAR.saltCap.cap.single, 40_804);
  assert.equal(YEAR.saltCap.phaseDownThreshold.single, round2(BEFORE.saltCap.phaseDownThreshold.single * 1.01));
  assert.equal(YEAR.saltCap.phaseDownThreshold.single, 510_050);
  assert.equal(YEAR.saltCap.cap.marriedFilingSeparately, YEAR.saltCap.cap.single / 2);
  assert.equal(
    YEAR.saltCap.phaseDownThreshold.marriedFilingSeparately,
    YEAR.saltCap.phaseDownThreshold.single / 2,
  );
  // The floor does NOT rise with the cap, so the phase-down band widens every
  // year of the schedule.
  assert.equal(YEAR.saltCap.floor.single, 10_000);
  assert.equal(YEAR.saltCap.floor.single, BEFORE.saltCap.floor.single);
  assert.equal(YEAR.saltCap.finalYear, 2029);
  // The rate is § 164(b)(6)(B)'s and is not indexed or scheduled.
  assert.equal(YEAR.saltCap.phaseDownRate, BEFORE.saltCap.phaseDownRate);
});

test('the 2027 SALT phase-down is SPENT, not just stored', () => {
  // THIS TEST EXISTS BECAUSE THE MUTATION AUDIT FOUND ITS ABSENCE, ON THE DAY
  // 2027 WAS COMMITTED. The federal package had 716 mutants and no survivors;
  // adding 2027 took it to 964 and left exactly one — `phaseDownRate` in
  // `data/2027.ts`, changed from 0.3 to 0.15 with the whole suite still green.
  //
  // Every other 2027 figure is reachable from a household some test already
  // runs. This one is not: `salt.test.js` drives the phase-down only in 2026,
  // and the assertions above compare 2027's rate to 2026's — which a mutant
  // that changes BOTH files would survive, and which says nothing about
  // whether any dollar of anybody's deduction depends on the figure.
  //
  // So the fix is a household, not another equality. A single filer $89,950
  // above the 2027 threshold:
  //     excess 89,950 x 0.30 = 26,985 of cap withdrawn
  //     40,804 - 26,985      = 13,819 of deduction left
  // At 0.15 the same filer keeps $27,311.50. The pin is the dollar figure.
  const atIncome = (adjustedGrossIncome) =>
    stateAndLocalTaxDeduction({
      filingStatus: 'single',
      year: 2027,
      stateAndLocalTaxesPaid: 50_000,
      adjustedGrossIncome,
    });

  const below = atIncome(510_050);
  assert.equal(below.excessIncome, 0, 'at the threshold itself nothing is withdrawn');
  assert.equal(below.deduction, 40_804);

  const inside = atIncome(600_000);
  assert.equal(inside.excessIncome, 89_950);
  assert.equal(inside.phaseDownReduction, 26_985, '30 cents of cap per dollar of excess');
  assert.equal(inside.deduction, 13_819);

  // And the far end of the band, which is where the rate and the floor meet:
  // the cap stops falling once it reaches $10,000, so the band ends at
  // threshold + (cap - floor) / rate = 510,050 + 30,804 / 0.3 = 612,730.
  // At 0.15 that point would be $715,410, so this pins the rate from the other
  // side — and it is a figure `JOURNAL.md` and `data/2027.ts` both print.
  const bandEnd = 612_730;
  assert.equal(
    YEAR.saltCap.phaseDownThreshold.single +
      (YEAR.saltCap.cap.single - YEAR.saltCap.floor.single) / YEAR.saltCap.phaseDownRate,
    bandEnd,
  );
  assert.equal(atIncome(bandEnd).deduction, 10_000, 'the floor is reached exactly here');
  assert.equal(atIncome(bandEnd - 1).deduction > 10_000, true, 'and not one dollar earlier');
  assert.equal(atIncome(bandEnd + 100_000).deduction, 10_000, 'and never goes below it');
});

test('the EITC table is internally consistent with its own statutory rates', () => {
  // § 32(b): the maximum credit is the credit rate applied to the earned income
  // amount, and the published earned income amounts land on a multiple of $10.
  // So the maximum credit divided by the rate must come back to one — which
  // checks the two columns against each other without any outside figure.
  const EARNED_INCOME_AMOUNT = [8_950, 13_450, 18_880, 18_880];
  YEAR.earnedIncomeCredit.table.forEach((row, i) => {
    assert.equal(
      Math.round(EARNED_INCOME_AMOUNT[i] * row.creditRate),
      row.maximumCredit,
      `${i} children: ${EARNED_INCOME_AMOUNT[i]} x ${row.creditRate} is not ${row.maximumCredit}`,
    );
    assert.equal(EARNED_INCOME_AMOUNT[i] % 10, 0);
    // § 32(b)(2)(B)'s joint add-on, which is applied and THEN rounded, so it is
    // not constant down the table. $7,520 with no children, $7,510 with any.
    const bonus = row.phaseOutStart.marriedFilingJointly - row.phaseOutStart.single;
    assert.equal(bonus, i === 0 ? 7_520 : 7_510, `${i} children: the § 32(b)(2)(B) joint add-on`);
    // A surviving spouse does NOT file a joint return and takes the single
    // figure — the mistake this package made for twenty-five days in 2026.
    assert.equal(row.phaseOutStart.qualifyingSurvivingSpouse, row.phaseOutStart.single);
    assert.equal(row.phaseOutStart.headOfHousehold, row.phaseOutStart.single);
  });
  // Rates are the 1996 statute's and have not moved since.
  assert.deepEqual(
    YEAR.earnedIncomeCredit.table.map((row) => row.creditRate),
    BEFORE.earnedIncomeCredit.table.map((row) => row.creditRate),
  );
  assert.deepEqual(
    YEAR.earnedIncomeCredit.table.map((row) => row.phaseOutRate),
    BEFORE.earnedIncomeCredit.table.map((row) => row.phaseOutRate),
  );
});

test('§ 199A(i) is indexed, and 2027 is the first year anybody could tell', () => {
  // Added by OBBBA § 70105(c) for 2026 and indexed after 2026. In its only
  // prior year it was indistinguishable from a statutory constant, which is
  // exactly how a figure like this gets carried forward for a decade.
  assert.equal(BEFORE.section199A.minimumDeduction.amount, 400);
  assert.equal(BEFORE.section199A.minimumDeduction.activeQualifiedBusinessIncomeFloor, 1_000);
  assert.equal(YEAR.section199A.minimumDeduction.amount, 415);
  assert.equal(YEAR.section199A.minimumDeduction.activeQualifiedBusinessIncomeFloor, 1_030);
  // The phase-in range is NOT indexed: OBBBA states $75,000 / $150,000 flat.
  assert.deepEqual(YEAR.section199A.phaseInRange, BEFORE.section199A.phaseInRange);
});

test('nothing on Schedule 1-A is indexed, in a year when everything else is', () => {
  // The strongest statement this file can make about the four OBBBA deductions,
  // and it is a statement about a year in which almost seventy other figures
  // moved: § 224, § 225, § 151(d)(5) and § 163(h)(4) carry no indexing
  // provision and Rev. Proc. 2026-35 adjusts none of them.
  assert.deepEqual(YEAR.scheduleOneA, BEFORE.scheduleOneA);
  assert.equal(YEAR.scheduleOneA.tips.cap, 25_000);
  assert.equal(YEAR.scheduleOneA.overtime.cap.marriedFilingJointly, 25_000);
  assert.equal(YEAR.scheduleOneA.senior.amountPerEligibleIndividual, 6_000);
  assert.equal(YEAR.scheduleOneA.vehicleLoanInterest.cap, 10_000);
  // And the § 63(f) age amount, which sits beside the senior deduction on the
  // same return, DID move. The two are easy to conflate and only one is indexed.
  assert.equal(YEAR.additionalStandardDeduction.single, 2_100);
  assert.notEqual(YEAR.additionalStandardDeduction.single, BEFORE.additionalStandardDeduction.single);
});

test('the statutory figures nobody indexes did not move', () => {
  assert.deepEqual(YEAR.rates, BEFORE.rates);
  assert.deepEqual(YEAR.niit, BEFORE.niit);
  assert.deepEqual(YEAR.additionalMedicareThreshold, BEFORE.additionalMedicareThreshold);
  assert.equal(YEAR.seNetEarningsFactor, 0.9235);
  assert.equal(YEAR.seMinimumNetEarnings, 400);
  assert.deepEqual(YEAR.childTaxCredit.phaseOut.thresholds, BEFORE.childTaxCredit.phaseOut.thresholds);
  assert.equal(YEAR.childTaxCredit.amountPerOtherDependent, 500);
  assert.equal(YEAR.childTaxCredit.refundable.phaseInThreshold, 2_500);
  assert.deepEqual(YEAR.earnedIncomeCredit.childlessAgeRange, BEFORE.earnedIncomeCredit.childlessAgeRange);
});

test('2027 withholding is a reconstruction and says which half is which', () => {
  // Publication 15-T for 2027 does not exist in November 2026. The three
  // standard deduction amounts are this year's; everything else is 2026's.
  assert.equal(YEAR.withholding.standardDeduction.singleOrMarriedFilingSeparately, YEAR.standardDeduction.single);
  assert.equal(YEAR.withholding.standardDeduction.marriedFilingJointly, YEAR.standardDeduction.marriedFilingJointly);
  assert.equal(YEAR.withholding.standardDeduction.headOfHousehold, YEAR.standardDeduction.headOfHousehold);
  assert.deepEqual(YEAR.withholding.step1gAmount, BEFORE.withholding.step1gAmount);
  assert.equal(YEAR.withholding.allowanceAmount, BEFORE.withholding.allowanceAmount);
  assert.deepEqual(YEAR.withholding.builtInAllowances, BEFORE.withholding.builtInAllowances);
  // And the notes say so, in the object a caller reads rather than in a comment.
  assert.ok(
    YEAR.withholding.notes.some((note) => note.includes('DOES NOT EXIST YET')),
    'the withholding notes must state that there is no 2027 Publication 15-T',
  );
  assert.ok(YEAR.withholding.notes.some((note) => note.includes('CARRIED FORWARD FROM 2026')));
});
