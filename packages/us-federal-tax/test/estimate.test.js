import { test } from 'node:test';
import assert from 'node:assert/strict';

import { estimateFederalTax, quarterlyEstimatedPayments } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

test('single freelancer with $120,000 net profit (fully hand-computed)', () => {
  // net earnings   = 120,000 x 0.9235      = 110,820.00
  // SE OASDI       = 110,820 x 0.124       =  13,741.68
  // SE Medicare    = 110,820 x 0.029       =   3,213.78
  // SE total                               =  16,955.46
  // half of SE                             =   8,477.73
  // AGI            = 120,000 - 8,477.73    = 111,522.27
  // taxable        = AGI - 16,100          =  95,422.27
  // income tax     = 1,240 + 4,560
  //                  + 0.22 x 45,022.27    =  15,704.90
  // total tax      = 15,704.90 + 16,955.46 =  32,660.36
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });

  money(r.selfEmployment.netEarnings, 110_820, 'net earnings');
  money(r.selfEmployment.total, 16_955.46, 'SE tax');
  money(r.selfEmployment.deductibleHalf, 8_477.73, 'half SE deduction');
  money(r.adjustedGrossIncome, 111_522.27, 'AGI');
  assert.equal(r.deductionKind, 'standard');
  money(r.deduction, 16_100, 'standard deduction');
  money(r.taxableIncome, 95_422.27, 'taxable income');
  money(r.ordinaryIncomeTax, 15_704.9, 'ordinary income tax');
  money(r.additionalMedicareTax, 0, 'no additional medicare');
  money(r.totalTax, 32_660.36, 'total tax');
  assert.equal(r.marginalRate, 0.22);
  money(r.effectiveRate * 100, 27.2169666, 'effective rate %');
  money(r.balanceDue, 32_660.36, 'nothing withheld, so all is due');
});

test('quarterly plan defaults to 90% of the current year', () => {
  const est = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });
  const plan = quarterlyEstimatedPayments(est);

  money(plan.currentYearTarget, 29_394.32, '90% of 32,660.36');
  assert.equal(plan.basis, 'currentYear90');
  assert.equal(plan.priorYearTarget, null);
  assert.equal(plan.installments.length, 4);
  money(plan.installments[0].amount, 7_348.58, 'first installment');

  const summed = plan.installments.reduce((a, i) => a + i.amount, 0);
  money(summed, plan.totalEstimatedPayments, 'installments sum exactly');
  assert.deepEqual(
    plan.installments.map((i) => i.dueDate),
    ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'],
  );
});

test('prior-year safe harbor is used when it is cheaper', () => {
  const est = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });

  const plan = quarterlyEstimatedPayments(est, {
    priorYearTotalTax: 20_000,
    priorYearAdjustedGrossIncome: 100_000,
  });
  assert.equal(plan.basis, 'priorYearSafeHarbor');
  assert.equal(plan.usedHigherPriorYearRate, false);
  money(plan.requiredAnnualPayment, 20_000, '100% of prior year');
});

test('prior-year AGI above $150,000 triggers the 110% safe harbor', () => {
  const est = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });
  const plan = quarterlyEstimatedPayments(est, {
    priorYearTotalTax: 20_000,
    priorYearAdjustedGrossIncome: 200_000,
  });
  assert.equal(plan.usedHigherPriorYearRate, true);
  money(plan.requiredAnnualPayment, 22_000, '110% of prior year');
});

test('a large prior-year tax falls back to the 90% current-year target', () => {
  const est = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });
  const plan = quarterlyEstimatedPayments(est, { priorYearTotalTax: 500_000 });
  assert.equal(plan.basis, 'currentYear90');
  money(plan.requiredAnnualPayment, plan.currentYearTarget, 'cheaper of the two');
});

test('withholding reduces the estimated payments required', () => {
  const est = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
    federalWithholding: 29_394.32,
  });
  const plan = quarterlyEstimatedPayments(est);
  money(plan.totalEstimatedPayments, 0, 'withholding already satisfies the safe harbor');
  for (const i of plan.installments) money(i.amount, 0, 'no payment needed');
});

test('wages plus capital gains, with gains stacked correctly', () => {
  // gross 70,000; AGI 70,000; taxable 53,900 after the 16,100 standard deduction.
  // ordinary taxable 33,900 -> 1,240 + 0.12 x 21,500 = 3,820
  // gain of 20,000 stacked from 33,900: 15,550 fits under the 49,450 0% ceiling,
  // the remaining 4,450 is taxed at 15% = 667.50
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 50_000,
    longTermCapitalGains: 20_000,
  });
  money(r.taxableIncome, 53_900, 'taxable income');
  money(r.capitalGainsTaxableIncome, 20_000, 'gain portion');
  money(r.ordinaryTaxableIncome, 33_900, 'ordinary portion');
  money(r.ordinaryIncomeTax, 3_820, 'ordinary tax');
  money(r.capitalGainsTax, 667.5, 'stacked gains tax');
  money(r.totalTax, 4_487.5, 'total');
  money(r.selfEmployment.total, 0, 'no SE tax on wages');
});

test('employee FICA is excluded from the Form 1040 liability', () => {
  const r = estimateFederalTax({ filingStatus: 'single', year: 2026, w2Wages: 100_000 });
  // taxable 83,900 -> 1,240 + 4,560 + 0.22 x 33,500 = 13,170
  money(r.totalTax, 13_170, 'income tax only, no FICA');
});

test('itemized deductions are used only when they beat the standard deduction', () => {
  const smaller = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 100_000,
    itemizedDeductions: 10_000,
  });
  assert.equal(smaller.deductionKind, 'standard');
  money(smaller.deduction, 16_100);

  const larger = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 100_000,
    itemizedDeductions: 25_000,
  });
  assert.equal(larger.deductionKind, 'itemized');
  money(larger.deduction, 25_000);
  assert.ok(larger.totalTax < smaller.totalTax, 'a bigger deduction lowers tax');
});

test('the QBI deduction reduces taxable income but not AGI', () => {
  const without = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  });
  const with199a = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
    qualifiedBusinessIncomeDeduction: 20_000,
  });
  money(with199a.adjustedGrossIncome, without.adjustedGrossIncome, 'AGI unchanged');
  money(with199a.taxableIncome, without.taxableIncome - 20_000, 'taxable income reduced');
  assert.ok(with199a.totalTax < without.totalTax);
  money(with199a.selfEmployment.total, without.selfEmployment.total, 'SE tax unaffected');
});

test('high earner with both wages and self-employment shares the wage base', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 170_000,
    selfEmploymentNetProfit: 80_000,
  });
  // Only 184,500 - 170,000 = 14,500 of the base is left for SE income.
  money(r.selfEmployment.socialSecurity, 14_500 * 0.124, 'OASDI on the remaining base');
  // Combined wages + net earnings = 170,000 + 73,880 = 243,880, over the 200,000 threshold.
  money(r.additionalMedicareTax, (243_880 - 200_000) * 0.009, 'additional medicare');
});

test('an empty household owes nothing', () => {
  const r = estimateFederalTax({ filingStatus: 'single', year: 2026 });
  money(r.totalTax, 0);
  money(r.taxableIncome, 0);
  assert.equal(r.effectiveRate, 0);
});

test('net investment income tax appears for a high earner with gains', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 300_000,
    longTermCapitalGains: 50_000,
  });
  // AGI 350,000, threshold 200,000 -> excess 150,000; NII defaults to the 50,000 gain.
  money(r.netInvestmentIncomeTax, 50_000 * 0.038, 'NIIT on the gain');
});
