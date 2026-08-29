import assert from 'node:assert/strict';
import test from 'node:test';

import {
  childTaxCredit,
  childTaxCreditParameters,
  earnedIncomeCredit,
  earnedIncomeCreditParameters,
  earnedIncomeCreditRow,
  earnedIncomeForCredits,
  estimateFederalTax,
  selfEmploymentTax,
} from '../dist/esm/index.js';

const ctc = (over) =>
  childTaxCredit({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    qualifyingChildren: 2,
    adjustedGrossIncome: 120_000,
    incomeTaxBeforeCredits: 20_000,
    earnedIncome: 120_000,
    ...over,
  });

const eitc = (over) =>
  earnedIncomeCredit({
    filingStatus: 'single',
    year: 2026,
    qualifyingChildren: 1,
    earnedIncome: 20_000,
    adjustedGrossIncome: 20_000,
    ...over,
  });

// ==========================================================================
// Parameters
// ==========================================================================

test('2026 child tax credit parameters', () => {
  const p = childTaxCreditParameters(2026);
  assert.equal(p.amountPerChild, 2_200);
  assert.equal(p.amountPerOtherDependent, 500);
  assert.equal(p.maximumChildAge, 17);
  assert.equal(p.refundable.maximumPerChild, 1_700);
  assert.equal(p.refundable.phaseInRate, 0.15);
  assert.equal(p.refundable.phaseInThreshold, 2_500);
  assert.equal(p.refundable.minimumChildrenForSocialSecurityAlternative, 3);
  assert.equal(p.requiresTaxpayerSocialSecurityNumber, true);
});

test('the § 24 phase-out threshold is $200,000 for everyone but joint filers', () => {
  const t = childTaxCreditParameters(2026).phaseOut.thresholds;
  assert.equal(t.marriedFilingJointly, 400_000);
  assert.equal(t.qualifyingSurvivingSpouse, 400_000);
  assert.equal(t.single, 200_000);
  assert.equal(t.headOfHousehold, 200_000);
  // Not halved to $200,000-from-$400,000 by some other route: § 24(b)(2)(B)
  // simply gives $200,000 to every filer who is not filing jointly. Married
  // filing separately gets the same figure as single, not half of joint.
  assert.equal(t.marriedFilingSeparately, 200_000);
});

test('the § 24 phase-out counts a partial $1,000 in full', () => {
  const p = childTaxCreditParameters(2026).phaseOut;
  assert.equal(p.amountPerIncrement, 50);
  assert.equal(p.increment, 1_000);
  // "or fraction thereof" — the opposite of the tips and overtime phase-outs.
  assert.equal(p.rounding, 'up');
});

test('2026 earned income credit table', () => {
  const p = earnedIncomeCreditParameters(2026);
  assert.equal(p.table.length, 4);
  assert.deepEqual(
    p.table.map((r) => r.maximumCredit),
    [664, 4_427, 7_316, 8_231],
  );
  // Statutory since 1996; not indexed.
  assert.deepEqual(
    p.table.map((r) => r.creditRate),
    [0.0765, 0.34, 0.4, 0.45],
  );
  assert.deepEqual(
    p.table.map((r) => r.phaseOutRate),
    [0.0765, 0.1598, 0.2106, 0.2106],
  );
  assert.equal(p.maximumInvestmentIncome, 12_200);
  assert.equal(p.childlessAgeRange.minimum, 25);
  assert.equal(p.childlessAgeRange.maximum, 64);
});

test('three or more children share one table row', () => {
  const three = earnedIncomeCreditRow(3, 2026);
  for (const n of [4, 7, 12]) {
    assert.deepEqual(earnedIncomeCreditRow(n, 2026), three);
  }
});

test('two and three children share an earned income amount but not a credit rate', () => {
  const two = earnedIncomeCreditRow(2, 2026);
  const three = earnedIncomeCreditRow(3, 2026);
  // § 32(b)(2)(A) gives both $18,290; the maxima differ only because the credit
  // percentage steps from 40% to 45%.
  assert.equal(Math.round(two.maximumCredit / two.creditRate / 10) * 10, 18_290);
  assert.equal(Math.round(three.maximumCredit / three.creditRate / 10) * 10, 18_290);
  assert.equal(two.phaseOutRate, three.phaseOutRate);
  assert.equal(two.phaseOutStart.single, three.phaseOutStart.single);
});

// --------------------------------------------------------------------------
// The joint-return add-on is not a constant, and the published completed
// phase-out amounts are what prove it.
// --------------------------------------------------------------------------

test('the EITC joint add-on differs between the childless and with-children tables', () => {
  const table = earnedIncomeCreditParameters(2026).table;
  const addOn = (row) => row.phaseOutStart.marriedFilingJointly - row.phaseOutStart.single;

  // § 32(b)(2)(B) adds one inflation-adjusted amount, but the IRS rounds the
  // *sum* to the nearest $10 rather than the addend, so the effective add-on
  // comes out $10 apart between the two tables.
  assert.equal(table[0].phaseOutStart.single, 10_860);
  assert.equal(table[0].phaseOutStart.marriedFilingJointly, 18_140);
  assert.equal(addOn(table[0]), 7_280);

  for (const row of table.slice(1)) {
    assert.equal(row.phaseOutStart.single, 23_890);
    assert.equal(row.phaseOutStart.marriedFilingJointly, 31_160);
    assert.equal(addOn(row), 7_270);
  }

  // The divergence is real, not a transcription slip: it is $10 in one
  // direction here and $10 in the other direction in 2025 ($7,110 childless,
  // $7,120 with children).
  assert.notEqual(addOn(table[0]), addOn(table[1]));
});

test('derived completed phase-out amounts match the published figures', () => {
  // The IRS publishes these as a convenience; this package derives them from
  // the phase-out start and the maximum credit. Agreement in both directions is
  // the cross-check that the stored parameters are right.
  const cases = [
    { children: 0, filingStatus: 'single', published: 19_540 },
    { children: 0, filingStatus: 'marriedFilingJointly', published: 26_820 },
    { children: 1, filingStatus: 'single', published: 51_593 },
    { children: 1, filingStatus: 'marriedFilingJointly', published: 58_863 },
    { children: 2, filingStatus: 'single', published: 58_629 },
    { children: 2, filingStatus: 'marriedFilingJointly', published: 65_899 },
    { children: 3, filingStatus: 'single', published: 62_974 },
    // Rev. Proc. 2025-32 as originally released on 2025-10-09 said $70,224
    // here. The 2025-10-17 reissue corrected it to $70,244. Anything
    // transcribed from the first release is $20 low on this one cell.
    { children: 3, filingStatus: 'marriedFilingJointly', published: 70_244 },
  ];

  for (const { children, filingStatus, published } of cases) {
    const result = eitc({ filingStatus, qualifyingChildren: children, age: 30 });
    assert.equal(
      Math.round(result.completedPhaseOut),
      published,
      `${children} children, ${filingStatus}`,
    );
  }
});

test('the credit really is zero at the completed phase-out amount', () => {
  for (const children of [0, 1, 2, 3]) {
    const at = eitc({
      qualifyingChildren: children,
      age: 30,
      earnedIncome: 80_000,
      adjustedGrossIncome: 80_000,
    }).completedPhaseOut;

    const justBelow = eitc({
      qualifyingChildren: children,
      age: 30,
      earnedIncome: at - 100,
      adjustedGrossIncome: at - 100,
    });
    const atPoint = eitc({
      qualifyingChildren: children,
      age: 30,
      earnedIncome: at,
      adjustedGrossIncome: at,
    });

    assert.ok(justBelow.credit > 0, `${children} children: credit remains just below`);
    assert.equal(atPoint.credit, 0, `${children} children: credit is gone at the limit`);
  }
});

// ==========================================================================
// § 32 — the earned income credit
// ==========================================================================

test('the phase-in is the credit percentage of earned income', () => {
  // One child, 34% of $10,000.
  const r = eitc({ earnedIncome: 10_000, adjustedGrossIncome: 10_000 });
  assert.equal(r.credit, 3_400);
  assert.equal(r.phasedInCredit, 3_400);
  assert.equal(r.phaseOutReduction, 0);
});

test('the credit plateaus at the maximum', () => {
  // The plateau runs from $13,020 (where 34% first reaches $4,427) to $23,890.
  for (const income of [13_100, 18_000, 23_890]) {
    const r = eitc({ earnedIncome: income, adjustedGrossIncome: income });
    assert.equal(r.credit, 4_427, `plateau at ${income}`);
  }
});

test('the phase-out is the phase-out percentage of the excess', () => {
  // One child, single: $30,000 is $6,110 over the $23,890 start.
  // 15.98% x 6,110 = $976.38, leaving 4,427 - 976.38 = $3,450.62.
  const r = eitc({ earnedIncome: 30_000, adjustedGrossIncome: 30_000 });
  assert.equal(r.phaseOutStart, 23_890);
  assert.equal(r.phaseOutIncome, 30_000);
  assert.equal(r.phaseOutReduction, 976.38);
  assert.equal(r.credit, 3_450.62);
});

test('the phase-out runs on AGI when AGI is higher than earned income', () => {
  // § 32(a)(2)(B): "adjusted gross income (or, if greater, the earned income)".
  // Same $20,000 of wages, but $40,000 of AGI because of investment income.
  const earnedOnly = eitc({ earnedIncome: 20_000, adjustedGrossIncome: 20_000 });
  const withAgi = eitc({ earnedIncome: 20_000, adjustedGrossIncome: 40_000 });

  assert.equal(earnedOnly.credit, 4_427); // on the plateau
  assert.equal(withAgi.phaseOutIncome, 40_000);
  // 15.98% x (40,000 - 23,890) = $2,574.38.
  assert.equal(withAgi.phaseOutReduction, 2_574.38);
  assert.equal(withAgi.credit, 1_852.62);
});

test('a lower AGI than earned income does not raise the credit', () => {
  // The `max` is symmetric: an above-the-line deduction that drops AGI below
  // earned income cannot buy back credit, because earned income then governs.
  const r = eitc({ earnedIncome: 30_000, adjustedGrossIncome: 5_000 });
  assert.equal(r.phaseOutIncome, 30_000);
  assert.equal(r.credit, 3_450.62);
});

test('§ 32(a) takes the lesser of the phase-in and the phase-out limitation', () => {
  // Still climbing on earned income ($9,000 x 34% = $3,060) but AGI of $45,000
  // has already destroyed most of the credit: 4,427 - 15.98% x 21,110 = $1,053.62.
  // The statute takes the smaller, which is the limitation, not the phase-in.
  const r = eitc({ earnedIncome: 9_000, adjustedGrossIncome: 45_000 });
  assert.equal(r.phasedInCredit, 3_060);
  assert.equal(r.credit, 1_053.62);
});

test('the § 32(i) investment income limit is a cliff, not a phase-out', () => {
  const under = eitc({ investmentIncome: 12_200 });
  const over = eitc({ investmentIncome: 12_200.01 });

  assert.equal(under.credit, 4_427);
  assert.equal(over.credit, 0);
  assert.equal(over.ineligibleReason, 'investmentIncomeTooHigh');
  // The result still reports what would have been due, so the cliff is visible.
  assert.equal(over.phasedInCredit, 4_427);
});

test('married filing separately is barred unless § 32(d)(2) is met', () => {
  const barred = eitc({ filingStatus: 'marriedFilingSeparately' });
  assert.equal(barred.credit, 0);
  assert.equal(barred.ineligibleReason, 'filingSeparately');

  const separated = eitc({ filingStatus: 'marriedFilingSeparately', separatedFromSpouse: true });
  assert.equal(separated.credit, 4_427);

  // § 32(d)(2) requires a qualifying child, so the exception cannot rescue a
  // childless separate filer however they answer.
  const childless = eitc({
    filingStatus: 'marriedFilingSeparately',
    separatedFromSpouse: true,
    qualifyingChildren: 0,
    age: 40,
  });
  assert.equal(childless.credit, 0);
  assert.equal(childless.ineligibleReason, 'filingSeparately');
});

test('the childless credit is limited to ages 25 through 64', () => {
  const at = (age) => eitc({ qualifyingChildren: 0, age, earnedIncome: 9_000, adjustedGrossIncome: 9_000 });

  assert.equal(at(24).credit, 0);
  assert.equal(at(24).ineligibleReason, 'ageOutsideChildlessRange');
  assert.equal(at(25).credit, 664);
  assert.equal(at(64).credit, 664);
  assert.equal(at(65).credit, 0);
  assert.equal(at(65).ineligibleReason, 'ageOutsideChildlessRange');
});

test('the age test does not apply once there is a qualifying child', () => {
  // § 32(c)(1)(A)(ii)(II) is written only for a filer with no qualifying child.
  for (const age of [19, 70]) {
    assert.equal(eitc({ qualifyingChildren: 1, age }).credit, 4_427);
  }
});

test('no earned income means no credit even with an eligible AGI', () => {
  const r = eitc({ earnedIncome: 0, adjustedGrossIncome: 5_000 });
  assert.equal(r.credit, 0);
  assert.equal(r.ineligibleReason, 'noEarnedIncome');
});

// --------------------------------------------------------------------------
// § 32(c)(2)(A)(ii) — earned income is net of half of self-employment tax
// --------------------------------------------------------------------------

test('self-employment earned income is reduced by the § 164(f) deduction', () => {
  const se = selfEmploymentTax({ netProfit: 30_000, year: 2026 });
  const earned = earnedIncomeForCredits({
    selfEmploymentNetEarnings: se.netEarnings,
    deductibleHalfOfSelfEmploymentTax: se.deductibleHalf,
  });

  // $30,000 of profit is $27,705 of net earnings less $2,119.43 of deduction.
  assert.equal(se.netEarnings, 27_705);
  assert.equal(se.deductibleHalf, 2_119.43);
  assert.equal(earned, 25_585.57);

  // Wages of $30,000 would be $30,000 of earned income. The same $30,000 of
  // business profit is $4,414.43 less, and none of that gap is visible in AGI,
  // which subtracts only the $2,119.43 deduction.
  assert.equal(30_000 - earned, 4_414.43);
});

test('using gross profit as earned income overstates the credit while it phases in', () => {
  const profit = 15_000;
  const se = selfEmploymentTax({ netProfit: profit, year: 2026 });
  const earned = earnedIncomeForCredits({
    selfEmploymentNetEarnings: se.netEarnings,
    deductibleHalfOfSelfEmploymentTax: se.deductibleHalf,
  });

  const correct = eitc({
    qualifyingChildren: 3,
    earnedIncome: earned,
    adjustedGrossIncome: profit - se.deductibleHalf,
  });
  const naive = eitc({
    qualifyingChildren: 3,
    earnedIncome: profit,
    adjustedGrossIncome: profit,
  });

  // Still climbing at 45%, so $2,207.22 of phantom earned income is worth
  // $993.25 of phantom credit.
  assert.equal(correct.credit, 5_756.75);
  assert.equal(naive.credit, 6_750);
  assert.equal(Math.round((naive.credit - correct.credit) * 100) / 100, 993.25);
});

test('above the plateau the same mistake understates the credit instead', () => {
  // Worth stating because it makes the error hard to spot by sampling: once the
  // filer is past the phase-out start, an inflated earned income figure raises
  // the income the phase-out runs on and the credit falls. The sign of the bug
  // flips at the top of the plateau.
  const profit = 30_000;
  const se = selfEmploymentTax({ netProfit: profit, year: 2026 });
  const earned = earnedIncomeForCredits({
    selfEmploymentNetEarnings: se.netEarnings,
    deductibleHalfOfSelfEmploymentTax: se.deductibleHalf,
  });

  const correct = eitc({
    qualifyingChildren: 3,
    earnedIncome: earned,
    adjustedGrossIncome: profit - se.deductibleHalf,
  });
  const naive = eitc({
    qualifyingChildren: 3,
    earnedIncome: profit,
    adjustedGrossIncome: profit,
  });

  assert.equal(correct.credit, 7_390.59);
  assert.equal(naive.credit, 6_944.23);
  assert.ok(naive.credit < correct.credit);
});

test('wages count in full and self-employment does not', () => {
  const wagesOnly = earnedIncomeForCredits({ wages: 25_000 });
  assert.equal(wagesOnly, 25_000);

  const mixed = earnedIncomeForCredits({
    wages: 25_000,
    selfEmploymentNetEarnings: 10_000,
    deductibleHalfOfSelfEmploymentTax: 765,
  });
  assert.equal(mixed, 34_235);
});

// ==========================================================================
// § 24 — the child tax credit
// ==========================================================================

test('the credit is $2,200 a child and $500 an other dependent', () => {
  const r = ctc({ qualifyingChildren: 3, otherDependents: 2 });
  assert.equal(r.childCredit, 6_600);
  assert.equal(r.otherDependentCredit, 1_000);
  assert.equal(r.maximumCredit, 7_600);
});

test('a partial $1,000 over the threshold costs the full $50', () => {
  // The single most commonly mis-implemented line in Schedule 8812.
  const at = ctc({ adjustedGrossIncome: 400_000 });
  const oneDollarOver = ctc({ adjustedGrossIncome: 400_001 });

  assert.equal(at.phaseOutReduction, 0);
  assert.equal(oneDollarOver.excessIncome, 1);
  assert.equal(oneDollarOver.phaseOutReduction, 50);
  assert.equal(oneDollarOver.creditAfterPhaseOut, 4_350);

  // A flat 5% of the excess — what most implementations do — would be 5 cents.
  assert.notEqual(oneDollarOver.phaseOutReduction, 0.05);
});

test('the phase-out steps rather than sloping', () => {
  const reduction = (agi) => ctc({ adjustedGrossIncome: agi }).phaseOutReduction;
  // Flat across each $1,000, then a $50 jump at every boundary.
  assert.equal(reduction(400_001), 50);
  assert.equal(reduction(400_999), 50);
  assert.equal(reduction(401_000), 50);
  assert.equal(reduction(401_001), 100);
  assert.equal(reduction(402_000), 100);
});

test('the phase-out erodes the child credit and the dependent credit together', () => {
  // Schedule 8812 line 8 adds them before line 10 phases them out, so the $500
  // credit is not sheltered by having claimed the child credit first.
  const r = ctc({
    qualifyingChildren: 1,
    otherDependents: 1,
    adjustedGrossIncome: 430_000,
  });
  assert.equal(r.maximumCredit, 2_700);
  // 30 increments x $50.
  assert.equal(r.phaseOutReduction, 1_500);
  assert.equal(r.creditAfterPhaseOut, 1_200);
});

test('the phase-out cannot push the credit below zero', () => {
  const r = ctc({ qualifyingChildren: 1, adjustedGrossIncome: 600_000 });
  assert.equal(r.creditAfterPhaseOut, 0);
  assert.equal(r.phaseOutReduction, 2_200);
  assert.equal(r.refundableCredit, 0);
});

test('modified AGI adds back excluded foreign income', () => {
  const plain = ctc({ adjustedGrossIncome: 395_000 });
  const withExclusion = ctc({
    adjustedGrossIncome: 395_000,
    foreignEarnedIncomeExclusion: 20_000,
  });

  assert.equal(plain.modifiedAdjustedGrossIncome, 395_000);
  assert.equal(plain.phaseOutReduction, 0);
  // § 24(b)(1) phases out on modified AGI, so the exclusion does not shelter
  // the credit: $415,000 is 15 increments over the threshold.
  assert.equal(withExclusion.modifiedAdjustedGrossIncome, 415_000);
  assert.equal(withExclusion.phaseOutReduction, 750);
});

// --------------------------------------------------------------------------
// The non-refundable / refundable split
// --------------------------------------------------------------------------

test('the non-refundable credit stops at income tax', () => {
  const r = ctc({ qualifyingChildren: 2, incomeTaxBeforeCredits: 1_000 });
  assert.equal(r.creditAfterPhaseOut, 4_400);
  assert.equal(r.nonRefundableCredit, 1_000);
});

test('the refundable part is capped at $1,700 a child', () => {
  // Plenty of earned income to phase it in, no tax to absorb it.
  const r = ctc({
    qualifyingChildren: 2,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 60_000,
  });
  assert.equal(r.nonRefundableCredit, 0);
  assert.equal(r.refundableCap, 3_400);
  assert.equal(r.refundableCredit, 3_400);
  // $4,400 of credit, $3,400 refunded, $1,000 simply lost.
  assert.equal(r.unusedCredit, 1_000);
});

test('the refundable part phases in at 15% of earned income over $2,500', () => {
  const r = ctc({
    qualifyingChildren: 2,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 12_500,
  });
  // 15% x (12,500 - 2,500) = $1,500, well under the $3,400 cap.
  assert.equal(r.refundablePhaseIn, 1_500);
  assert.equal(r.refundableCredit, 1_500);
});

test('earned income at or below $2,500 produces no refundable credit at all', () => {
  const r = ctc({
    qualifyingChildren: 2,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 2_500,
  });
  assert.equal(r.refundableCredit, 0);
  assert.equal(r.unusedCredit, 4_400);
});

test('the credit for other dependents is never refundable', () => {
  const r = ctc({
    qualifyingChildren: 0,
    otherDependents: 2,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 60_000,
  });
  assert.equal(r.creditAfterPhaseOut, 1_000);
  assert.equal(r.refundableCap, 0);
  assert.equal(r.refundableCredit, 0);
  assert.equal(r.unusedCredit, 1_000);
});

// --------------------------------------------------------------------------
// § 24(d)(1)(B)(ii) — the social security alternative for three or more children
// --------------------------------------------------------------------------

test('three children may use social security taxes less the EITC', () => {
  // Earned income of $12,500 phases in only $1,500 under the 15% rule. A family
  // that paid $3,500 of payroll tax and received $1,000 of EITC gets $2,500
  // instead — the provision that actually delivers the credit to large families
  // with low earnings, and the one most implementations skip.
  const withAlternative = ctc({
    qualifyingChildren: 3,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 12_500,
    socialSecurityTaxes: 3_500,
    earnedIncomeCredit: 1_000,
  });

  assert.equal(withAlternative.refundablePhaseIn, 1_500);
  assert.equal(withAlternative.socialSecurityAlternative, 2_500);
  assert.equal(withAlternative.refundableCredit, 2_500);
});

test('the alternative is unavailable below three children', () => {
  const two = ctc({
    qualifyingChildren: 2,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 12_500,
    socialSecurityTaxes: 3_500,
    earnedIncomeCredit: 1_000,
  });
  assert.equal(two.socialSecurityAlternative, null);
  assert.equal(two.refundableCredit, 1_500);
});

test('the alternative is the greater of the two, not a replacement', () => {
  // Same family, but earning enough that the 15% rule is the better route.
  const r = ctc({
    qualifyingChildren: 3,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 40_000,
    socialSecurityTaxes: 3_060,
    earnedIncomeCredit: 2_000,
  });
  assert.equal(r.refundablePhaseIn, 5_625);
  assert.equal(r.socialSecurityAlternative, 1_060);
  // Capped at 3 x $1,700 regardless.
  assert.equal(r.refundableCredit, 5_100);
});

test('a large EITC can wipe out the social security alternative', () => {
  const r = ctc({
    qualifyingChildren: 3,
    incomeTaxBeforeCredits: 0,
    earnedIncome: 12_500,
    socialSecurityTaxes: 956,
    earnedIncomeCredit: 4_500,
  });
  // Floored at zero, so the 15% rule governs.
  assert.equal(r.socialSecurityAlternative, 0);
  assert.equal(r.refundableCredit, 1_500);
});

// --------------------------------------------------------------------------
// OBBBA § 70104(c) — the taxpayer SSN requirement
// --------------------------------------------------------------------------

test('without a work-authorized SSN the child credit is lost but the $500 survives', () => {
  const r = ctc({
    qualifyingChildren: 2,
    otherDependents: 1,
    taxpayerHasWorkAuthorizedSocialSecurityNumber: false,
  });
  assert.equal(r.qualifyingChildren, 0);
  assert.equal(r.childCredit, 0);
  assert.equal(r.otherDependentCredit, 500);
  assert.equal(r.maximumCredit, 500);
  // No credited children means no refundable capacity either.
  assert.equal(r.refundableCap, 0);
});

test('the SSN requirement defaults to satisfied', () => {
  assert.equal(ctc({ qualifyingChildren: 2 }).childCredit, 4_400);
});

// ==========================================================================
// End-to-end through estimateFederalTax
// ==========================================================================

test('supplying no dependents and no age leaves credits uncomputed', () => {
  // The guarantee that adding credits changed nothing for existing callers.
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 80_000,
  });
  assert.equal(r.credits.childTaxCredit, null);
  assert.equal(r.credits.earnedIncomeCredit, null);
  assert.equal(r.credits.totalNonRefundable, 0);
  assert.equal(r.credits.totalRefundable, 0);
  assert.equal(r.totalTax, r.totalTaxBeforeCredits);
});

test('a joint family with two children pays $4,400 less income tax', () => {
  const base = {
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    w2Wages: 120_000,
  };
  const without = estimateFederalTax(base);
  const with2 = estimateFederalTax({ ...base, qualifyingChildren: 2 });

  assert.equal(with2.credits.childTaxCredit.creditAfterPhaseOut, 4_400);
  assert.equal(with2.credits.totalNonRefundable, 4_400);
  assert.equal(with2.totalTaxBeforeCredits, without.totalTax);
  assert.equal(with2.totalTax, without.totalTax - 4_400);
});

// --------------------------------------------------------------------------
// The point of separating the § 26(a) limit from total tax
// --------------------------------------------------------------------------

test('the child tax credit does not reduce self-employment tax', () => {
  // $30,000 of Schedule C profit: SE tax is $4,238.87 and, after the standard
  // deduction, income tax is only $373.06. A credit that could reach the SE tax
  // would wipe the whole liability out. It cannot.
  const r = estimateFederalTax({
    filingStatus: 'headOfHousehold',
    year: 2026,
    selfEmploymentNetProfit: 30_000,
    qualifyingChildren: 1,
  });

  assert.equal(r.selfEmployment.total, 4_238.87);
  assert.equal(r.incomeTaxBeforeCredits, 373.06);
  // The § 26(a) ceiling is the income tax alone.
  assert.equal(r.incomeTaxBeforeCredits, r.ordinaryIncomeTax + r.capitalGainsTax);
  assert.ok(r.incomeTaxBeforeCredits < r.selfEmployment.total);
  assert.equal(r.credits.totalNonRefundable, r.incomeTaxBeforeCredits);
  // Income tax is gone; every cent of SE tax remains.
  assert.equal(r.totalTax, r.selfEmployment.total);
});

test('refundable credits are payments, not reductions in tax', () => {
  const r = estimateFederalTax({
    filingStatus: 'headOfHousehold',
    year: 2026,
    w2Wages: 22_000,
    qualifyingChildren: 2,
    federalWithholding: 0,
  });

  // Well below the standard deduction plus brackets, so no income tax at all.
  assert.equal(r.incomeTaxBeforeCredits, 0);
  assert.equal(r.totalTax, 0);
  assert.ok(r.credits.totalRefundable > 0);
  // A refund, produced entirely by refundable credits.
  assert.equal(r.balanceDue, -r.credits.totalRefundable);
  assert.ok(r.balanceDue < 0);
});

test('a single parent on modest wages gets both credits', () => {
  const r = estimateFederalTax({
    filingStatus: 'headOfHousehold',
    year: 2026,
    w2Wages: 28_000,
    qualifyingChildren: 2,
  });

  const eic = r.credits.earnedIncomeCredit;
  // Past the $23,890 start: 21.06% x $4,110 = $865.57 off the $7,316 maximum.
  assert.equal(eic.phaseOutStart, 23_890);
  assert.equal(eic.phaseOutReduction, 865.57);
  assert.equal(eic.credit, 6_450.43);

  const child = r.credits.childTaxCredit;
  assert.equal(child.creditAfterPhaseOut, 4_400);
  // $28,000 less the $24,150 head-of-household standard deduction is $3,850 of
  // taxable income, taxed at 10% — so $385 of income tax to absorb.
  assert.equal(r.incomeTaxBeforeCredits, 385);
  assert.equal(child.nonRefundableCredit, 385);
  // The rest is refundable up to $3,400, and 15% x $25,500 = $3,825 phases it
  // in comfortably.
  assert.equal(child.refundableCredit, 3_400);
  assert.equal(child.unusedCredit, 615);

  assert.equal(r.totalTax, 0);
  assert.equal(r.credits.totalRefundable, 6_450.43 + 3_400);
});

test('the EITC is computed for a childless filer only once age is known', () => {
  const base = {
    filingStatus: 'single',
    year: 2026,
    w2Wages: 12_000,
  };
  assert.equal(estimateFederalTax(base).credits.earnedIncomeCredit, null);

  const aged = estimateFederalTax({ ...base, age: 30 });
  // Past the $10,860 start: 7.65% x $1,140 = $87.21 off $664.
  assert.equal(aged.credits.earnedIncomeCredit.credit, 576.79);
});

test('capital gains can disqualify a filer from the EITC entirely', () => {
  const base = {
    filingStatus: 'headOfHousehold',
    year: 2026,
    w2Wages: 20_000,
    qualifyingChildren: 1,
  };
  const modest = estimateFederalTax({ ...base, longTermCapitalGains: 5_000 });
  const large = estimateFederalTax({ ...base, longTermCapitalGains: 15_000 });

  assert.ok(modest.credits.earnedIncomeCredit.credit > 0);
  assert.equal(large.credits.earnedIncomeCredit.credit, 0);
  assert.equal(large.credits.earnedIncomeCredit.ineligibleReason, 'investmentIncomeTooHigh');
  // The child tax credit is unaffected — § 24 has no investment income test.
  assert.equal(large.credits.childTaxCredit.creditAfterPhaseOut, 2_200);
});

test('disqualified investment income can be supplied explicitly', () => {
  // Interest inside `otherOrdinaryIncome` is invisible to the default, which is
  // exactly why the input exists.
  const base = {
    filingStatus: 'headOfHousehold',
    year: 2026,
    w2Wages: 20_000,
    otherOrdinaryIncome: 15_000,
    qualifyingChildren: 1,
  };
  assert.ok(estimateFederalTax(base).credits.earnedIncomeCredit.credit > 0);

  const declared = estimateFederalTax({ ...base, disqualifiedInvestmentIncome: 15_000 });
  assert.equal(declared.credits.earnedIncomeCredit.credit, 0);
  assert.equal(
    declared.credits.earnedIncomeCredit.ineligibleReason,
    'investmentIncomeTooHigh',
  );
});

test('a self-employed parent has the EITC computed on earned income net of § 164(f)', () => {
  const r = estimateFederalTax({
    filingStatus: 'headOfHousehold',
    year: 2026,
    selfEmploymentNetProfit: 30_000,
    qualifyingChildren: 2,
  });
  const se = selfEmploymentTax({ netProfit: 30_000, year: 2026 });

  assert.equal(r.credits.earnedIncomeCredit.earnedIncome, 25_585.57);
  assert.equal(r.credits.earnedIncomeCredit.earnedIncome, se.netEarnings - se.deductibleHalf);
  // AGI is profit less the same deduction, so the two differ — earned income is
  // net earnings (92.35% of profit) less the deduction, AGI is full profit less
  // the deduction.
  assert.equal(r.adjustedGrossIncome, 30_000 - se.deductibleHalf);
  assert.ok(r.credits.earnedIncomeCredit.earnedIncome < r.adjustedGrossIncome);
  assert.equal(r.credits.earnedIncomeCredit.phaseOutIncome, r.adjustedGrossIncome);
});

test('the EITC ordering feeds the § 24(d) social security alternative', () => {
  // Three children, low wages: the EITC is computed first because § 24(d)(1)(B)(ii)
  // subtracts it.
  const r = estimateFederalTax({
    filingStatus: 'headOfHousehold',
    year: 2026,
    w2Wages: 10_000,
    qualifyingChildren: 3,
  });

  const eic = r.credits.earnedIncomeCredit;
  const child = r.credits.childTaxCredit;
  assert.equal(eic.credit, 4_500); // 45% of $10,000, still phasing in
  // Employee FICA on $10,000 is $765; that is far less than the EITC, so the
  // alternative is zero and the 15% rule governs.
  assert.equal(child.socialSecurityAlternative, 0);
  assert.equal(child.refundablePhaseIn, 1_125);
  assert.equal(child.refundableCredit, 1_125);
});

// --------------------------------------------------------------------------
// Marginal rates
// --------------------------------------------------------------------------

test('the EITC phase-out is the whole marginal rate when the CTC shelters the bracket', () => {
  const at = (wages) =>
    estimateFederalTax({
      filingStatus: 'headOfHousehold',
      year: 2026,
      w2Wages: wages,
      qualifyingChildren: 2,
    });

  const a = at(30_000);
  const b = at(31_000);

  // The bracket says 10%, and the filer never feels it: $4,400 of child tax
  // credit absorbs the whole income tax at both incomes, so `totalTax` is zero
  // either way.
  assert.equal(a.marginalRate, 0.1);
  assert.equal(a.totalTax, 0);
  assert.equal(b.totalTax, 0);

  // What the extra $1,000 actually costs is the EITC phase-out and nothing
  // else: 21.06% of $1,000.
  const cost = b.balanceDue - a.balanceDue;
  assert.equal(Math.round(cost * 100) / 100, 210.6);
  assert.equal(
    Math.round((a.credits.earnedIncomeCredit.credit - b.credits.earnedIncomeCredit.credit) * 100) /
      100,
    210.6,
  );
});

test('the EITC phase-out stacks on the bracket once the CTC runs out', () => {
  const at = (wages) =>
    estimateFederalTax({
      filingStatus: 'headOfHousehold',
      year: 2026,
      w2Wages: wages,
      qualifyingChildren: 1,
    });

  const a = at(45_000);
  const b = at(46_000);

  // 12% bracket, and by $46,000 the income tax ($2,268) has outgrown the
  // $2,200 credit, so the bracket bites for the first time.
  assert.equal(a.marginalRate, 0.12);
  assert.equal(a.totalTax, 0);
  assert.equal(b.totalTax, 68);

  // 12% of income tax plus 15.98% of EITC: an effective 27.98% on a filer whose
  // bracket says 12%.
  const cost = b.balanceDue - a.balanceDue;
  assert.equal(Math.round(cost * 100) / 100, 279.8);
  assert.equal(Math.round((cost / 1_000) * 10_000) / 10_000, 0.2798);
});

test('the § 24 phase-out produces a sawtooth marginal rate', () => {
  // Unlike the SALT phase-down, which is continuous, this one steps: within a
  // $1,000 band an extra dollar of income costs only the bracket, and at the
  // boundary it costs a whole $50 more.
  //
  // Income is `otherOrdinaryIncome` rather than wages so that Additional
  // Medicare Tax stays out of the comparison — at $400,000 a wage-earner is
  // well past its $250,000 threshold, and 0.9% of the increment would muddy
  // what this test is measuring.
  const at = (agi) =>
    estimateFederalTax({
      filingStatus: 'marriedFilingJointly',
      year: 2026,
      otherOrdinaryIncome: agi,
      qualifyingChildren: 2,
    });

  assert.equal(at(410_500).marginalRate, 0.24);

  // $100 more inside a band: just the bracket, 24% of $100. The credit does not
  // move, because ceil(10.4) and ceil(10.5) are both 11 increments.
  const insideBand = at(410_500).totalTax - at(410_400).totalTax;
  assert.equal(Math.round(insideBand * 100) / 100, 24);

  // $2 across a boundary: 24% of $2, plus a whole $50 as the eleventh increment
  // becomes the twelfth. A $2 raise costs $50.48.
  const acrossBoundary = at(411_001).totalTax - at(410_999).totalTax;
  assert.equal(Math.round(acrossBoundary * 100) / 100, 50.48);
});
