// The README is the package's landing page, and a correctness library whose own
// documentation is wrong has no credibility left to trade on. These tests pin every
// number quoted in README.md so it cannot drift silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateFederalTax,
  getYearParameters,
  longTermCapitalGainsTax,
  qbiDeduction,
  qualifiedTipsDeduction,
  quarterlyEstimatedPayments,
  saltCapParameters,
  scheduleOneAParameters,
  section199AParameters,
  selfEmploymentTax,
  stateAndLocalTaxDeduction,
  seniorDeduction,
  vehicleLoanInterestDeduction,
} from '../dist/esm/index.js';

test('README: quick start figures', () => {
  const estimate = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });
  assert.equal(estimate.totalTax, 32_660.36);
  assert.equal(estimate.marginalRate, 0.22);
  assert.equal(estimate.selfEmployment.total, 16_955.46);
  assert.equal(estimate.adjustedGrossIncome, 111_522.27);

  const plan = quarterlyEstimatedPayments(estimate, {
    priorYearTotalTax: 20_000,
    priorYearAdjustedGrossIncome: 100_000,
  });
  assert.equal(plan.basis, 'priorYearSafeHarbor');
  assert.equal(plan.requiredAnnualPayment, 20_000);
  assert.equal(plan.installments.length, 4);
});

test('README: shared wage base example', () => {
  const se = selfEmploymentTax({
    netProfit: 80_000,
    w2SocialSecurityWages: 170_000,
    year: 2026,
  });
  assert.equal(se.socialSecurity, 1_798);
  // The figure the README contrasts it against: what an unaware implementation returns.
  assert.equal(Number((80_000 * 0.9235 * 0.124).toFixed(2)), 9_161.12);
});

test('README: stacked capital gains example', () => {
  const cg = longTermCapitalGainsTax({
    ordinaryTaxableIncome: 40_000,
    longTermGains: 20_000,
    filingStatus: 'single',
    year: 2026,
  });
  assert.equal(cg.tax, 1_582.5);
});

test('README: the two phase-outs round in opposite directions', () => {
  assert.equal(
    qualifiedTipsDeduction({
      qualifiedTips: 10_000,
      modifiedAdjustedGrossIncome: 150_999,
      filingStatus: 'single',
    }).deduction,
    10_000,
  );
  assert.equal(
    vehicleLoanInterestDeduction({
      qualifiedInterest: 10_000,
      modifiedAdjustedGrossIncome: 100_001,
      filingStatus: 'single',
    }).deduction,
    9_800,
  );
});

test('README: OBBBA parameter table', () => {
  const p = scheduleOneAParameters(2026);
  assert.equal(p.tips.cap, 25_000);
  assert.equal(p.tips.phaseOut.thresholds.single, 150_000);
  assert.equal(p.tips.phaseOut.thresholds.marriedFilingJointly, 300_000);
  assert.equal(p.tips.phaseOut.amountPerIncrement, 100);

  assert.equal(p.overtime.cap.single, 12_500);
  assert.equal(p.overtime.cap.marriedFilingJointly, 25_000);
  assert.equal(p.overtime.phaseOut.thresholds.single, 150_000);
  assert.equal(p.overtime.phaseOut.amountPerIncrement, 100);

  assert.equal(p.vehicleLoanInterest.cap, 10_000);
  assert.equal(p.vehicleLoanInterest.phaseOut.thresholds.single, 100_000);
  assert.equal(p.vehicleLoanInterest.phaseOut.thresholds.marriedFilingJointly, 200_000);
  assert.equal(p.vehicleLoanInterest.phaseOut.amountPerIncrement, 200);

  assert.equal(p.senior.amountPerEligibleIndividual, 6_000);
  assert.equal(p.senior.phaseOutThreshold.single, 75_000);
  assert.equal(p.senior.phaseOutThreshold.marriedFilingJointly, 150_000);
  assert.equal(p.senior.phaseOutRate, 0.06);
});

test('README: the senior phase-out runs per person', () => {
  // The README contrasts $6,000 with the naive $12,000 - $3,000 = $9,000.
  assert.equal(
    seniorDeduction({
      modifiedAdjustedGrossIncome: 200_000,
      filingStatus: 'marriedFilingJointly',
      age65OrOlder: true,
      spouseAge65OrOlder: true,
    }).deduction,
    6_000,
  );
});

test('README: the tips example through estimateFederalTax', () => {
  const estimate = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 52_000,
    qualifiedTips: 18_000,
  });
  assert.equal(estimate.additionalDeductions.total, 18_000);
  assert.equal(estimate.taxableIncome, 17_900);
  assert.equal(estimate.ordinaryIncomeTax, 1_900);
});

test('README: the § 199A phase-in example', () => {
  assert.equal(
    qbiDeduction({
      filingStatus: 'single',
      year: 2026,
      taxableIncomeBeforeQbiDeduction: 239_250,
      businesses: [{ qualifiedBusinessIncome: 150_000, w2Wages: 20_000 }],
    }).deduction,
    20_000,
  );
});

test('README: the widened 2026 joint range, and what the old one would have given', () => {
  const input = {
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 478_500,
    businesses: [{ qualifiedBusinessIncome: 200_000 }],
  };
  assert.equal(qbiDeduction(input).deduction, 20_000);
  // The contrast the README draws: under the pre-2026 $100,000 range the excess
  // of $75,000 would have been three quarters phased in, not one half.
  const tentative = 40_000;
  assert.equal(tentative - (75_000 / 100_000) * tentative, 10_000);
});

test('README: the § 199A(i) minimum deduction example', () => {
  assert.equal(
    qbiDeduction({
      filingStatus: 'single',
      year: 2026,
      taxableIncomeBeforeQbiDeduction: 800,
      businesses: [{ qualifiedBusinessIncome: 1_200 }],
    }).deduction,
    400,
  );
});

test('README: § 199A threshold and range figures', () => {
  const p = section199AParameters(2026);
  assert.equal(p.thresholdAmount.single, 201_750);
  assert.equal(p.thresholdAmount.marriedFilingJointly, 403_500);
  assert.equal(p.thresholdAmount.marriedFilingSeparately, 201_775);
  assert.equal(p.phaseInRange.single, 75_000);
  assert.equal(p.phaseInRange.marriedFilingSeparately, 75_000);
  assert.equal(p.phaseInRange.marriedFilingJointly, 150_000);
  assert.equal(p.minimumDeduction.amount, 400);
  assert.equal(p.minimumDeduction.activeQualifiedBusinessIncomeFloor, 1_000);
});

test('README: the SALT phase-down example', () => {
  assert.equal(
    stateAndLocalTaxDeduction({
      filingStatus: 'marriedFilingJointly',
      year: 2026,
      stateAndLocalTaxesPaid: 60_000,
      adjustedGrossIncome: 545_000,
    }).cap,
    28_400,
  );
});

test('README: the SALT marginal-rate table', () => {
  const at = (agi, saltPaid) =>
    estimateFederalTax({
      filingStatus: 'marriedFilingJointly',
      year: 2026,
      otherOrdinaryIncome: agi,
      stateAndLocalTaxesPaid: saltPaid,
      otherItemizedDeductions: 20_000,
    }).totalTax;
  assert.equal((at(580_000, 8_000) - at(570_000, 8_000)) / 10_000, 0.35);
  assert.equal((at(580_000, 45_000) - at(570_000, 45_000)) / 10_000, 0.455);
  assert.equal((at(710_000, 45_000) - at(700_000, 45_000)) / 10_000, 0.35);

  // The point at which the floor is reached, quoted in the README.
  const p = saltCapParameters(2026);
  const floorReachedAt =
    p.phaseDownThreshold.marriedFilingJointly +
    (p.cap.marriedFilingJointly - p.floor.marriedFilingJointly) / p.phaseDownRate;
  assert.equal(Math.round(floorReachedAt * 100) / 100, 606_333.33);
});

test('README: the SALT figures quoted in prose', () => {
  const p = saltCapParameters(2026);
  assert.equal(p.cap.single, 40_400);
  assert.equal(p.phaseDownThreshold.single, 505_000);
  assert.equal(p.phaseDownRate, 0.3);
  assert.equal(p.floor.single, 10_000);
  assert.equal(p.cap.marriedFilingSeparately, 20_200);
  assert.equal(p.phaseDownThreshold.marriedFilingSeparately, 252_500);
  assert.equal(p.floor.marriedFilingSeparately, 5_000);
});

test('README: the estimateFederalTax SALT example', () => {
  const estimate = estimateFederalTax({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    w2Wages: 300_000,
    stateAndLocalTaxesPaid: 55_000,
    otherItemizedDeductions: 18_000,
  });
  assert.equal(estimate.stateAndLocalTax.deduction, 40_400);
  assert.equal(estimate.deduction, 58_400);
  assert.equal(estimate.deductionKind, 'itemized');
});

test('README: the § 68 gap is bounded at 2/37 of itemized deductions', () => {
  // The README says "up to 5.4%". That is 2/37.
  assert.equal(Math.round((2 / 37) * 1000) / 10, 5.4);
});

test('README: sources are present and well formed', () => {
  const sources = getYearParameters(2026).sources;
  assert.ok(sources.length >= 3, 'parameters must cite their origin');
  for (const s of sources) {
    assert.ok(s.title && s.title.length > 0);
    assert.match(s.url, /^https:\/\//);
  }
});
