// Utah, Pennsylvania and Illinois are all described as flat-rate states. None of
// them charges its statutory rate at the margin over the incomes most of their
// filers have, and no rate schedule can show that. These are the numbers that
// come out of running the whole computation one dollar higher.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const close = (actual, expected, tolerance, msg) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${msg ?? 'value'}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );

const utah = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'UT',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    dependents: opts.dependents ?? 0,
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - (opts.deduction ?? 16_100)),
      deduction: opts.deduction ?? 16_100,
      deductionKind: 'standard',
    },
  });

test('Utah charges 4.45% and a $25,000 single filer faces 5.75%', () => {
  //   Utah taxable income                        25,000.00
  //   tax at 4.45%                                1,112.50
  //   Taxpayer Tax Credit, 6% x $16,100             966.00
  //   less 1.3% x (25,000 - 18,213)                 -88.23
  //   credit allowed                                877.77
  //   Utah tax                                      234.73
  const r = utah(25_000);
  money(r.taxBeforeCredits, 1_112.5);
  money(r.credits[0].amount, 877.769);
  money(r.tax, 234.731);
  money(r.marginalRate, 0.0575, 'the statutory 4.45% plus the 1.3% phase-out');
  assert.equal(getStateDefinition('UT', 2026).rate.rate, 0.0445);
});

test('above the phase-out the Utah marginal rate falls back to the statutory rate', () => {
  // The credit runs out at $966 / 0.013 = $74,307.69 above the threshold.
  const exhausted = 18_213 + 966 / 0.013;
  const below = utah(Math.floor(exhausted) - 1_000);
  const above = utah(Math.ceil(exhausted) + 1_000);
  money(below.marginalRate, 0.0575);
  money(above.marginalRate, 0.0445);
  money(above.credits[0].amount, 0);
  money(above.tax, (Math.ceil(exhausted) + 1_000) * 0.0445);
});

test('the Utah credit is built on the FEDERAL deduction, so OBBBA cut Utah tax too', () => {
  // Utah starts from federal AGI and so should be indifferent to a change below
  // it — except that the credit reaches under AGI and picks the deduction up.
  const after = utah(60_000, { year: 2025, deduction: 15_750 });
  const before = utah(60_000, { year: 2025, deduction: 14_600 });
  money(before.tax - after.tax, 69.0, '6% of the $1,150 increase');
});

const pennsylvania = (income, opts = {}) =>
  stateIncomeTax({
    state: 'PA',
    year: 2026,
    filingStatus: opts.filingStatus ?? 'single',
    dependents: opts.dependents ?? 0,
    federal: { adjustedGrossIncome: 0, taxableIncome: 0, deduction: 0, deductionKind: 'standard' },
    pennsylvaniaTaxableIncome: income,
  });

test('Pennsylvania forgives the whole tax up to the allowance and nothing $2,500 later', () => {
  money(pennsylvania(6_500).tax, 0, 'full forgiveness at the allowance');
  money(pennsylvania(9_000).tax, 276.3, 'no forgiveness $2,500 later');
  money(pennsylvania(9_000).credits[0].amount, 0);
  money(pennsylvania(50_000).tax, 1_535.0, 'and 3.07% flat above it');
  money(pennsylvania(50_000).marginalRate, 0.0307);
});

test('Pennsylvania forgiveness is a staircase: nothing between steps, then a jump', () => {
  //   $6,750 -> 90% forgiven -> $20.72 of tax
  //   $7,000 -> 80% forgiven -> $42.98 of tax
  // Inside a step the marginal rate is 0.307% — a tenth of the statutory rate.
  // At the boundary one dollar costs about $22.
  money(pennsylvania(6_750).tax, 20.7225);
  money(pennsylvania(7_000).tax, 42.98);
  money(pennsylvania(6_600).marginalRate, 0.00307, 'inside a step');
  close(pennsylvania(6_750).marginalRate, 20.75, 0.05, 'at a step boundary');
});

test('the cost of the Pennsylvania staircase grows with the household', () => {
  // Each step forgives ten points less of the *whole* tax, so a household with
  // more tax to forgive loses more per step. Averaged across the $2,500 band:
  const single = (pennsylvania(9_000).tax - pennsylvania(6_500).tax) / 2_500;
  close(single, 0.1105, 0.0001, 'a childless single filer faces about 11%');

  // A single parent of two: the allowance is $6,500 + 2 x $9,500 = $25,500.
  const parentLow = pennsylvania(25_500, { dependents: 2 });
  const parentHigh = pennsylvania(28_000, { dependents: 2 });
  money(parentLow.tax, 0);
  money(parentHigh.tax, 859.6);
  close((parentHigh.tax - parentLow.tax) / 2_500, 0.34384, 0.0001, 'about 34%');
});

test('Illinois loses its exemption at a cliff, not a phase-out', () => {
  const at = (agi, filingStatus = 'single') =>
    stateIncomeTax({
      state: 'IL',
      year: 2025,
      filingStatus,
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: agi - 15_750,
        deduction: 15_750,
        deductionKind: 'standard',
      },
    });

  const under = at(250_000);
  const over = at(250_001);
  money(under.exemptions, 2_850);
  money(over.exemptions, 0, 'the whole allowance, on one dollar');
  money(under.tax, 12_233.93);
  money(over.tax, 12_375.05);
  close(under.marginalRate, 141.1245, 0.0001, 'one dollar of income, $141 of tax');

  // Joint filers hit the same cliff at twice the income.
  money(at(500_000, 'marriedFilingJointly').exemptions, 5_700);
  money(at(500_001, 'marriedFilingJointly').exemptions, 0);
});

test('a state with no credits has a marginal rate equal to its statutory rate', () => {
  // Michigan is the control case: flat rate, fixed exemption, no phase-out
  // anywhere. If this one ever disagrees with 4.25%, the measurement is broken.
  const r = stateIncomeTax({
    state: 'MI',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    dependents: 3,
    federal: {
      adjustedGrossIncome: 120_000,
      taxableIncome: 88_500,
      deduction: 31_500,
      deductionKind: 'standard',
    },
  });
  money(r.exemptions, 5_800 * 5);
  money(r.taxableIncome, 120_000 - 29_000);
  money(r.tax, 91_000 * 0.0425);
  money(r.marginalRate, 0.0425);
});
