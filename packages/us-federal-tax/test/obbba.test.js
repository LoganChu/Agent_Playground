// The four OBBBA temporary deductions (Schedule 1-A, Form 1040).
//
// Every expectation below is hand-computed from the statute and the Schedule 1-A
// worksheets rather than from a run of the code, so a regression in the code
// cannot quietly rewrite the expected answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  additionalDeductions,
  estimateFederalTax,
  qualifiedOvertimeDeduction,
  qualifiedTipsDeduction,
  scheduleOneAParameters,
  seniorDeduction,
  vehicleLoanInterestDeduction,
} from '../dist/esm/index.js';

const Y = 2026;

// ---------------------------------------------------------------------------
// § 224 — qualified tips
// ---------------------------------------------------------------------------

test('tips: below the phase-out threshold, the full amount is deductible', () => {
  const r = qualifiedTipsDeduction({
    qualifiedTips: 8_000,
    modifiedAdjustedGrossIncome: 60_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(r.deduction, 8_000);
  assert.equal(r.phaseOutReduction, 0);
  assert.equal(r.excessIncome, 0);
  assert.equal(r.ineligible, false);
});

test('tips: the $25,000 cap applies before the phase-out', () => {
  // Claimed 40,000 -> capped to 25,000. MAGI 200,000 is 50,000 over the
  // 150,000 threshold, so 50 full increments x $100 = $5,000 of reduction.
  const r = qualifiedTipsDeduction({
    qualifiedTips: 40_000,
    modifiedAdjustedGrossIncome: 200_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(r.cappedAmount, 25_000);
  assert.equal(r.phaseOutReduction, 5_000);
  assert.equal(r.deduction, 20_000);
});

test('tips: a partial $1,000 increment is dropped, not prorated', () => {
  // This is the detail that separates §224 from §163(h)(4). $999 of excess
  // produces zero reduction, because the statute reduces "$100 for each $1,000".
  const justUnder = qualifiedTipsDeduction({
    qualifiedTips: 10_000,
    modifiedAdjustedGrossIncome: 150_999,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(justUnder.excessIncome, 999);
  assert.equal(justUnder.phaseOutReduction, 0);
  assert.equal(justUnder.deduction, 10_000);

  // One more dollar of income completes the increment and costs $100.
  const justOver = qualifiedTipsDeduction({
    qualifiedTips: 10_000,
    modifiedAdjustedGrossIncome: 151_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(justOver.phaseOutReduction, 100);
  assert.equal(justOver.deduction, 9_900);
});

test('tips: the cap is NOT doubled on a joint return, but the threshold is', () => {
  const joint = qualifiedTipsDeduction({
    qualifiedTips: 40_000,
    modifiedAdjustedGrossIncome: 100_000,
    filingStatus: 'marriedFilingJointly',
    year: Y,
  });
  assert.equal(joint.deduction, 25_000, 'cap stays at $25,000 per return');

  // Threshold is 300,000 for a joint return: 310,500 leaves 10,500 of excess,
  // which is 10 full increments -> $1,000.
  const phased = qualifiedTipsDeduction({
    qualifiedTips: 30_000,
    modifiedAdjustedGrossIncome: 310_500,
    filingStatus: 'marriedFilingJointly',
    year: Y,
  });
  assert.equal(phased.cappedAmount, 25_000);
  assert.equal(phased.phaseOutReduction, 1_000);
  assert.equal(phased.deduction, 24_000);
});

test('tips: a self-employed filer is limited to the business net income', () => {
  const r = qualifiedTipsDeduction({
    qualifiedTips: 20_000,
    modifiedAdjustedGrossIncome: 40_000,
    filingStatus: 'single',
    year: Y,
    selfEmploymentIncomeLimit: 12_000,
  });
  assert.equal(r.cappedAmount, 12_000);
  assert.equal(r.deduction, 12_000);
});

test('tips: fully phased out at high income', () => {
  // 400,000 MAGI is 250,000 over -> 250 increments x $100 = $25,000, the whole cap.
  const r = qualifiedTipsDeduction({
    qualifiedTips: 25_000,
    modifiedAdjustedGrossIncome: 400_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(r.phaseOutReduction, 25_000);
  assert.equal(r.deduction, 0);
});

test('tips: married filing separately is barred outright', () => {
  const r = qualifiedTipsDeduction({
    qualifiedTips: 10_000,
    modifiedAdjustedGrossIncome: 40_000,
    filingStatus: 'marriedFilingSeparately',
    year: Y,
  });
  assert.equal(r.deduction, 0);
  assert.equal(r.ineligible, true);
});

// ---------------------------------------------------------------------------
// § 225 — qualified overtime compensation
// ---------------------------------------------------------------------------

test('overtime: cap is $12,500, and $25,000 on a joint return', () => {
  const single = qualifiedOvertimeDeduction({
    qualifiedOvertimeCompensation: 20_000,
    modifiedAdjustedGrossIncome: 80_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(single.deduction, 12_500);

  const joint = qualifiedOvertimeDeduction({
    qualifiedOvertimeCompensation: 30_000,
    modifiedAdjustedGrossIncome: 100_000,
    filingStatus: 'marriedFilingJointly',
    year: Y,
  });
  assert.equal(joint.deduction, 25_000);
});

test('overtime: phase-out drops the partial increment', () => {
  // MAGI 190,500 -> 40,500 of excess -> 40 increments (40.5 rounded down)
  // -> $4,000 of reduction against a $12,500 cap.
  const r = qualifiedOvertimeDeduction({
    qualifiedOvertimeCompensation: 15_000,
    modifiedAdjustedGrossIncome: 190_500,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(r.cappedAmount, 12_500);
  assert.equal(r.excessIncome, 40_500);
  assert.equal(r.phaseOutReduction, 4_000);
  assert.equal(r.deduction, 8_500);
});

test('overtime: married filing separately is barred outright', () => {
  const r = qualifiedOvertimeDeduction({
    qualifiedOvertimeCompensation: 5_000,
    modifiedAdjustedGrossIncome: 50_000,
    filingStatus: 'marriedFilingSeparately',
    year: Y,
  });
  assert.equal(r.deduction, 0);
  assert.equal(r.ineligible, true);
});

// ---------------------------------------------------------------------------
// Enhanced deduction for seniors
// ---------------------------------------------------------------------------

test('senior: $6,000 below the threshold, 6% of the excess above it', () => {
  const under = seniorDeduction({
    modifiedAdjustedGrossIncome: 50_000,
    filingStatus: 'single',
    year: Y,
    age65OrOlder: true,
  });
  assert.equal(under.deduction, 6_000);

  // 100,000 - 75,000 = 25,000 of excess; 6% of that is 1,500.
  const phased = seniorDeduction({
    modifiedAdjustedGrossIncome: 100_000,
    filingStatus: 'single',
    year: Y,
    age65OrOlder: true,
  });
  assert.equal(phased.phaseOutReduction, 1_500);
  assert.equal(phased.deduction, 4_500);
});

test('senior: gone entirely at $175,000 single / $250,000 joint', () => {
  const single = seniorDeduction({
    modifiedAdjustedGrossIncome: 175_000,
    filingStatus: 'single',
    year: Y,
    age65OrOlder: true,
  });
  assert.equal(single.deduction, 0);

  const joint = seniorDeduction({
    modifiedAdjustedGrossIncome: 250_000,
    filingStatus: 'marriedFilingJointly',
    year: Y,
    age65OrOlder: true,
    spouseAge65OrOlder: true,
  });
  assert.equal(joint.deduction, 0, 'both spouses phase out at the same point');
});

test('senior: the phase-out is figured per eligible individual', () => {
  // Joint, both 65+, MAGI 200,000. Excess is 50,000; 6% is 3,000 per person.
  // Each $6,000 becomes $3,000, so the pair get $6,000 — not $12,000 - $3,000.
  const both = seniorDeduction({
    modifiedAdjustedGrossIncome: 200_000,
    filingStatus: 'marriedFilingJointly',
    year: Y,
    age65OrOlder: true,
    spouseAge65OrOlder: true,
  });
  assert.equal(both.cappedAmount, 12_000);
  assert.equal(both.deduction, 6_000);

  // Only one spouse qualifying halves it.
  const one = seniorDeduction({
    modifiedAdjustedGrossIncome: 200_000,
    filingStatus: 'marriedFilingJointly',
    year: Y,
    age65OrOlder: true,
  });
  assert.equal(one.deduction, 3_000);
});

test('senior: joint return with both spouses 65+ starts at $12,000', () => {
  const r = seniorDeduction({
    modifiedAdjustedGrossIncome: 150_000,
    filingStatus: 'marriedFilingJointly',
    year: Y,
    age65OrOlder: true,
    spouseAge65OrOlder: true,
  });
  assert.equal(r.deduction, 12_000);
});

test('senior: a qualifying surviving spouse counts one individual, not two', () => {
  // The joint standard deduction applies, but the deceased spouse is not a
  // second eligible individual and the threshold is the non-joint $75,000.
  const r = seniorDeduction({
    modifiedAdjustedGrossIncome: 80_000,
    filingStatus: 'qualifyingSurvivingSpouse',
    year: Y,
    age65OrOlder: true,
    spouseAge65OrOlder: true,
  });
  assert.equal(r.excessIncome, 5_000);
  assert.equal(r.deduction, 5_700); // 6,000 - 6% of 5,000
});

test('senior: under 65, or filing separately, gets nothing', () => {
  const young = seniorDeduction({
    modifiedAdjustedGrossIncome: 50_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(young.deduction, 0);
  assert.equal(young.ineligible, true);

  const separate = seniorDeduction({
    modifiedAdjustedGrossIncome: 50_000,
    filingStatus: 'marriedFilingSeparately',
    year: Y,
    age65OrOlder: true,
  });
  assert.equal(separate.deduction, 0);
  assert.equal(separate.ineligible, true);
});

// ---------------------------------------------------------------------------
// § 163(h)(4) — qualified passenger vehicle loan interest
// ---------------------------------------------------------------------------

test('vehicle loan interest: capped at $10,000', () => {
  const r = vehicleLoanInterestDeduction({
    qualifiedInterest: 15_000,
    modifiedAdjustedGrossIncome: 50_000,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(r.cappedAmount, 10_000);
  assert.equal(r.deduction, 10_000);
});

test('vehicle loan interest: a single dollar of excess costs a full $200', () => {
  // "$200 for each $1,000 (or portion thereof)" — the opposite rounding from
  // tips and overtime, and the most expensive dollar in the OBBBA.
  const r = vehicleLoanInterestDeduction({
    qualifiedInterest: 10_000,
    modifiedAdjustedGrossIncome: 100_001,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(r.excessIncome, 1);
  assert.equal(r.phaseOutReduction, 200);
  assert.equal(r.deduction, 9_800);
});

test('vehicle loan interest: joint threshold and partial increment rounded up', () => {
  // 220,500 - 200,000 = 20,500 of excess -> 21 increments (20.5 rounded UP)
  // -> $4,200 of reduction.
  const r = vehicleLoanInterestDeduction({
    qualifiedInterest: 10_000,
    modifiedAdjustedGrossIncome: 220_500,
    filingStatus: 'marriedFilingJointly',
    year: Y,
  });
  assert.equal(r.phaseOutReduction, 4_200);
  assert.equal(r.deduction, 5_800);
});

test('vehicle loan interest: gone at $150,000 single / $250,000 joint', () => {
  assert.equal(
    vehicleLoanInterestDeduction({
      qualifiedInterest: 10_000,
      modifiedAdjustedGrossIncome: 150_000,
      filingStatus: 'single',
      year: Y,
    }).deduction,
    0,
  );
  assert.equal(
    vehicleLoanInterestDeduction({
      qualifiedInterest: 10_000,
      modifiedAdjustedGrossIncome: 250_000,
      filingStatus: 'marriedFilingJointly',
      year: Y,
    }).deduction,
    0,
  );
});

test('vehicle loan interest: married filing separately is barred outright', () => {
  const r = vehicleLoanInterestDeduction({
    qualifiedInterest: 5_000,
    modifiedAdjustedGrossIncome: 50_000,
    filingStatus: 'marriedFilingSeparately',
    year: Y,
  });
  assert.equal(r.deduction, 0);
  assert.equal(r.ineligible, true);
});

// ---------------------------------------------------------------------------
// The two phase-outs disagree — this is the whole point
// ---------------------------------------------------------------------------

test('the same $999 of excess costs $0 under §224 and $200 under §163(h)(4)', () => {
  const tips = qualifiedTipsDeduction({
    qualifiedTips: 10_000,
    modifiedAdjustedGrossIncome: 150_999,
    filingStatus: 'single',
    year: Y,
  });
  const vehicle = vehicleLoanInterestDeduction({
    qualifiedInterest: 10_000,
    modifiedAdjustedGrossIncome: 100_999,
    filingStatus: 'single',
    year: Y,
  });
  assert.equal(tips.phaseOutReduction, 0);
  assert.equal(vehicle.phaseOutReduction, 200);
});

// ---------------------------------------------------------------------------
// Schedule 1-A as a whole
// ---------------------------------------------------------------------------

test('additionalDeductions: sums the four parts into the line 13b total', () => {
  const r = additionalDeductions({
    filingStatus: 'marriedFilingJointly',
    year: Y,
    adjustedGrossIncome: 160_000,
    qualifiedTips: 4_000,
    qualifiedOvertimeCompensation: 6_000,
    qualifiedVehicleLoanInterest: 3_000,
    age65OrOlder: true,
    spouseAge65OrOlder: true,
  });

  // Tips and overtime: MAGI 160,000 is under the 300,000 joint threshold.
  assert.equal(r.tips.deduction, 4_000);
  assert.equal(r.overtime.deduction, 6_000);
  // Vehicle: under the 200,000 joint threshold.
  assert.equal(r.vehicleLoanInterest.deduction, 3_000);
  // Senior: 160,000 - 150,000 = 10,000 excess; 6% = 600 off each $6,000.
  assert.equal(r.senior.deduction, 10_800);
  assert.equal(r.total, 23_800);
});

test('additionalDeductions: MAGI adds back excluded foreign income', () => {
  // AGI alone is under the threshold; the § 911 exclusion pushes MAGI over it.
  const r = additionalDeductions({
    filingStatus: 'single',
    year: Y,
    adjustedGrossIncome: 140_000,
    foreignEarnedIncomeExclusion: 20_000,
    qualifiedTips: 10_000,
  });
  assert.equal(r.modifiedAdjustedGrossIncome, 160_000);
  assert.equal(r.tips.phaseOutReduction, 1_000);
  assert.equal(r.tips.deduction, 9_000);
});

test('scheduleOneAParameters: 2026 is in effect and sunsets after 2028', () => {
  const p = scheduleOneAParameters(Y);
  assert.ok(p, '2026 has Schedule 1-A parameters');
  assert.equal(p.finalYear, 2028);
  assert.equal(p.tips.cap, 25_000);
  assert.equal(p.vehicleLoanInterest.phaseOut.rounding, 'up');
  assert.equal(p.tips.phaseOut.rounding, 'down');
});

// ---------------------------------------------------------------------------
// End to end through estimateFederalTax
// ---------------------------------------------------------------------------

test('estimate: a server deducts tips out of an otherwise ordinary return', () => {
  // $52,000 of W-2 wages, $18,000 of it qualified tips.
  //   AGI                 52,000
  //   standard deduction  16,100
  //   Schedule 1-A        18,000
  //   taxable income      17,900
  //   tax = 10% x 12,400 + 12% x 5,500 = 1,240 + 660 = 1,900
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: Y,
    w2Wages: 52_000,
    qualifiedTips: 18_000,
  });
  assert.equal(r.adjustedGrossIncome, 52_000);
  assert.equal(r.additionalDeductions.total, 18_000);
  assert.equal(r.taxableIncome, 17_900);
  assert.equal(r.ordinaryIncomeTax, 1_900);
});

test('estimate: the senior deduction stacks on the age standard deduction', () => {
  //   AGI                                     60,000
  //   standard deduction 16,100 + 2,050 (65+) 18,150
  //   senior deduction                         6,000
  //   taxable income                          35,850
  //   tax = 1,240 + 12% x 23,450 = 4,054
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: Y,
    otherOrdinaryIncome: 60_000,
    age65OrOlder: true,
  });
  assert.equal(r.deduction, 18_150);
  assert.equal(r.additionalDeductions.senior.deduction, 6_000);
  assert.equal(r.taxableIncome, 35_850);
  assert.equal(r.ordinaryIncomeTax, 4_054);
});

test('estimate: Schedule 1-A does not reduce AGI, so the NIIT base is unchanged', () => {
  // The deductions sit below AGI. A filer whose MAGI is over the NIIT threshold
  // still owes NIIT on the same base after claiming them.
  const withOvertime = estimateFederalTax({
    filingStatus: 'single',
    year: Y,
    w2Wages: 220_000,
    longTermCapitalGains: 30_000,
    qualifiedOvertimeCompensation: 12_500,
  });
  const without = estimateFederalTax({
    filingStatus: 'single',
    year: Y,
    w2Wages: 220_000,
    longTermCapitalGains: 30_000,
  });
  assert.equal(withOvertime.adjustedGrossIncome, without.adjustedGrossIncome);
  assert.equal(withOvertime.netInvestmentIncomeTax, without.netInvestmentIncomeTax);
  assert.ok(withOvertime.taxableIncome < without.taxableIncome);
});

test('estimate: a 65+ filer separately gets no senior deduction', () => {
  const r = estimateFederalTax({
    filingStatus: 'marriedFilingSeparately',
    year: Y,
    otherOrdinaryIncome: 60_000,
    age65OrOlder: true,
  });
  // The ordinary additional standard deduction for age is unaffected.
  assert.equal(r.deduction, 16_100 + 1_650);
  assert.equal(r.additionalDeductions.total, 0);
});
