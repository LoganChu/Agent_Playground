// The claim this package is built on: the starting point decides the answer.
// These tests are the evidence for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** A single filer with $100,000 of wages, 2025 federal figures post-OBBBA. */
const OBBBA_2025 = {
  adjustedGrossIncome: 100_000,
  taxableIncome: 84_250,
  deduction: 15_750,
  deductionKind: 'standard',
};

/** The same filer as the pre-OBBBA 2025 standard deduction would have left them. */
const PRE_OBBBA_2025 = {
  adjustedGrossIncome: 100_000,
  taxableIncome: 85_400,
  deduction: 14_600,
  deductionKind: 'standard',
};

test('Arizona inherits the federal standard deduction, so OBBBA cut Arizona tax', () => {
  // A.R.S. § 43-1041(A) defines the Arizona standard deduction as equal to the
  // federal one. Nothing in Arizona law changed in 2025; the bill still fell.
  const after = stateIncomeTax({
    state: 'AZ',
    year: 2025,
    filingStatus: 'single',
    federal: OBBBA_2025,
  });
  const before = stateIncomeTax({
    state: 'AZ',
    year: 2025,
    filingStatus: 'single',
    federal: PRE_OBBBA_2025,
  });
  money(after.deduction, 15_750, 'AZ deduction follows the federal figure');
  money(after.taxableIncome, 84_250);
  money(after.tax, 2106.25);
  money(before.tax, 2135.0);
  money(before.tax - after.tax, 28.75, 'the OBBBA increase is worth 2.5% of $1,150');
});

test('Colorado and Idaho start below the federal deduction and inherited it too', () => {
  const co = stateIncomeTax({ state: 'CO', year: 2025, filingStatus: 'single', federal: OBBBA_2025 });
  const coBefore = stateIncomeTax({
    state: 'CO',
    year: 2025,
    filingStatus: 'single',
    federal: PRE_OBBBA_2025,
  });
  assert.equal(co.conformity.base, 'federalTaxableIncome');
  money(co.conformity.amount, 84_250, 'Colorado starts from taxable income, not AGI');
  money(co.deduction, 0, 'Colorado has no deduction of its own');
  money(co.tax, 3707.0);
  money(coBefore.tax - co.tax, 50.6, '4.4% of the $1,150 increase');

  const id = stateIncomeTax({ state: 'ID', year: 2025, filingStatus: 'single', federal: OBBBA_2025 });
  const idBefore = stateIncomeTax({
    state: 'ID',
    year: 2025,
    filingStatus: 'single',
    federal: PRE_OBBBA_2025,
  });
  // 0% on the first $4,811, then 5.3%.
  money(id.tax, (84_250 - 4811) * 0.053);
  money(idBefore.tax - id.tax, 60.95, '5.3% of the $1,150 increase');
});

test('Illinois and Michigan start from AGI, so OBBBA did nothing to them', () => {
  for (const state of ['IL', 'MI']) {
    const after = stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal: OBBBA_2025 });
    const before = stateIncomeTax({
      state,
      year: 2025,
      filingStatus: 'single',
      federal: PRE_OBBBA_2025,
    });
    assert.equal(after.conformity.base, 'federalAdjustedGrossIncome');
    assert.equal(after.tax, before.tax, `${state} should be indifferent to the federal deduction`);
  }
});

test('Colorado adds back the QBI deduction, so a pass-through owner gains nothing there', () => {
  // Same $100,000 of income; the second filer took a $10,000 § 199A deduction.
  const noQbi = stateIncomeTax({
    state: 'CO',
    year: 2025,
    filingStatus: 'single',
    federal: OBBBA_2025,
  });
  const withQbi = stateIncomeTax({
    state: 'CO',
    year: 2025,
    filingStatus: 'single',
    federal: { ...OBBBA_2025, taxableIncome: 74_250 },
    federalDeductions: { qualifiedBusinessIncome: 10_000 },
  });
  money(withQbi.conformity.amount, 74_250, 'the federal figure is lower');
  money(withQbi.additions, 10_000, 'and Colorado puts it straight back');
  assert.equal(withQbi.addBacks.length, 1);
  assert.match(withQbi.addBacks[0].name, /199A/);
  assert.equal(withQbi.tax, noQbi.tax, 'so the Colorado bill is identical');

  // Idaho, on the same base, allows it — a $530 difference on the same facts.
  const idWithQbi = stateIncomeTax({
    state: 'ID',
    year: 2025,
    filingStatus: 'single',
    federal: { ...OBBBA_2025, taxableIncome: 74_250 },
    federalDeductions: { qualifiedBusinessIncome: 10_000 },
  });
  const idNoQbi = stateIncomeTax({
    state: 'ID',
    year: 2025,
    filingStatus: 'single',
    federal: OBBBA_2025,
  });
  assert.equal(idWithQbi.addBacks.length, 0);
  money(idNoQbi.tax - idWithQbi.tax, 530.0, '5.3% of the $10,000 deduction');
});

test('Colorado adds back overtime from 2026 but never tips, on the same federal schedule', () => {
  // Both deductions live on Schedule 1-A and are indistinguishable federally.
  // HB25-1296 reaches one and not the other, from tax year 2026 only.
  const federal = {
    adjustedGrossIncome: 100_000,
    taxableIncome: 74_250,
    deduction: 15_750,
    deductionKind: 'standard',
  };
  const federalDeductions = { tips: 5_000, overtime: 5_000 };

  const y2025 = stateIncomeTax({ state: 'CO', year: 2025, filingStatus: 'single', federal, federalDeductions });
  assert.equal(y2025.addBacks.length, 0, 'Colorado allowed both in 2025');
  money(y2025.tax, 74_250 * 0.044);

  const y2026 = stateIncomeTax({ state: 'CO', year: 2026, filingStatus: 'single', federal, federalDeductions });
  assert.equal(y2026.addBacks.length, 1);
  assert.match(y2026.addBacks[0].name, /overtime/i);
  money(y2026.addBacks[0].amount, 5_000);
  money(y2026.tax, 79_250 * 0.044, 'the tips deduction survives and the overtime one does not');
  money(y2026.tax - y2025.tax, 220.0);
});

test('Pennsylvania refuses to guess a base it does not have', () => {
  // Federal AGI is not a Pennsylvania number: Pennsylvania taxes 401(k) deferrals
  // in the year contributed, so accepting AGI here would understate the tax for
  // anyone saving for retirement. Better to demand the figure than to invent it.
  assert.throws(
    () =>
      stateIncomeTax({
        state: 'PA',
        year: 2026,
        filingStatus: 'single',
        federal: OBBBA_2025,
      }),
    /pennsylvaniaTaxableIncome/,
  );
});

test('the conformity base is declared for every state, and only Pennsylvania is its own', () => {
  const bases = {};
  for (const state of ['AZ', 'CA', 'GA', 'IL', 'IN', 'KY', 'MI', 'MS', 'NC', 'UT']) {
    bases[state] = getStateDefinition(state, 2026).base;
  }
  for (const [state, base] of Object.entries(bases)) {
    assert.equal(base, 'federalAdjustedGrossIncome', `${state}`);
  }
  assert.equal(getStateDefinition('CO', 2026).base, 'federalTaxableIncome');
  assert.equal(getStateDefinition('ID', 2026).base, 'federalTaxableIncome');
  assert.equal(getStateDefinition('PA', 2026).base, 'stateDefined');
});
