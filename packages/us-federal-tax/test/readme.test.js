// The README is the package's landing page, and a correctness library whose own
// documentation is wrong has no credibility left to trade on. These tests pin every
// number quoted in README.md so it cannot drift silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateFederalTax,
  getYearParameters,
  longTermCapitalGainsTax,
  quarterlyEstimatedPayments,
  selfEmploymentTax,
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

test('README: sources are present and well formed', () => {
  const sources = getYearParameters(2026).sources;
  assert.ok(sources.length >= 3, 'parameters must cite their origin');
  for (const s of sources) {
    assert.ok(s.title && s.title.length > 0);
    assert.match(s.url, /^https:\/\//);
  }
});
