// The README is the package's landing page, and a correctness library whose own
// documentation is wrong has no credibility left to trade on. These tests pin
// every number quoted in README.md so it cannot drift silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  stateIncomeTax,
} from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const FEDERAL_2025 = {
  adjustedGrossIncome: 100_000,
  taxableIncome: 84_250,
  deduction: 15_750,
  deductionKind: 'standard',
};

test('README: the four quick-start figures', () => {
  const at = (state) =>
    stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal: FEDERAL_2025 }).tax;
  assert.equal(at('CA'), 5054.98);
  assert.equal(at('CO'), 3707.0);
  assert.equal(at('AZ'), 2106.25);
  assert.equal(at('TX'), 0);
});

test('README: 22 states, 2025 and 2026, nine with no income tax', () => {
  assert.equal(SUPPORTED_STATES.length, 22);
  assert.deepEqual(SUPPORTED_YEARS, [2025, 2026]);
  assert.equal(NO_INCOME_TAX_STATES.length, 9);
  // Two graduated, eleven flat, nine with none.
  const graduated = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).rate.kind === 'brackets',
  );
  const flat = SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2026).rate.kind === 'flat');
  assert.deepEqual(graduated, ['CA', 'ID', 'MS']);
  assert.equal(flat.length, 10);
  // Idaho is stored as brackets only because of its zero band; its positive rate
  // is single, so the README counts it with the flat-rate states.
  assert.equal(graduated.length + flat.length + NO_INCOME_TAX_STATES.length, 22);
  // Thirteen taxing states — the count the README quotes when it says six of them
  // cut their rate for 2026.
  assert.equal(graduated.length + flat.length, 13);
});

test('README: the OBBBA pass-through table', () => {
  const preObbba = { ...FEDERAL_2025, taxableIncome: 85_400, deduction: 14_600 };
  const cut = (state) =>
    stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal: preObbba }).tax -
    stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal: FEDERAL_2025 }).tax;
  money(cut('AZ'), 28.75);
  money(cut('CO'), 50.6);
  money(cut('ID'), 60.95);

  // Utah's is measured at $60,000 because the credit is fully phased out at
  // $100,000, where a change to the credit would be worth nothing.
  const utah = (deduction) =>
    stateIncomeTax({
      state: 'UT',
      year: 2025,
      filingStatus: 'single',
      federal: { adjustedGrossIncome: 60_000, taxableIncome: 60_000 - deduction, deduction, deductionKind: 'standard' },
    }).tax;
  money(utah(14_600) - utah(15_750), 69.0);

  for (const state of ['IL', 'MI']) {
    money(cut(state), 0, `${state} is on federal AGI and got nothing`);
  }
});

test('README: Colorado adds the QBI deduction back and Idaho does not', () => {
  const withQbi = (state) =>
    stateIncomeTax({
      state,
      year: 2025,
      filingStatus: 'single',
      federal: { ...FEDERAL_2025, taxableIncome: 74_250 },
      federalDeductions: { qualifiedBusinessIncome: 10_000 },
    }).tax;
  assert.equal(withQbi('CO'), 3707.0);
  const idNoQbi = stateIncomeTax({
    state: 'ID',
    year: 2025,
    filingStatus: 'single',
    federal: FEDERAL_2025,
  }).tax;
  money(idNoQbi - withQbi('ID'), 530.0);
});

test('README: the marginal rates that a rate schedule cannot show', () => {
  const utah = stateIncomeTax({
    state: 'UT',
    year: 2026,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: 25_000,
      taxableIncome: 8_900,
      deduction: 16_100,
      deductionKind: 'standard',
    },
  });
  money(utah.marginalRate, 0.0575);
  assert.equal(getStateDefinition('UT', 2026).rate.rate, 0.0445);

  const illinois = stateIncomeTax({
    state: 'IL',
    year: 2025,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 250_000, taxableIncome: 234_250, deduction: 15_750, deductionKind: 'standard' },
  });
  assert.ok(Math.abs(illinois.marginalRate - 141.1245) < 0.0001);

  const pa = (income, dependents = 0) =>
    stateIncomeTax({
      state: 'PA',
      year: 2026,
      filingStatus: 'single',
      dependents,
      federal: { adjustedGrossIncome: 0, taxableIncome: 0, deduction: 0, deductionKind: 'standard' },
      pennsylvaniaTaxableIncome: income,
    }).tax;
  assert.ok(Math.abs((pa(9_000) - pa(6_500)) / 2_500 - 0.1105) < 0.0005, 'about 11%');
  assert.ok(
    Math.abs((pa(28_000, 2) - pa(25_500, 2)) / 2_500 - 0.34384) < 0.0005,
    'about 34%',
  );

  const ca = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 252_203, taxableIncome: 236_453, deduction: 15_750, deductionKind: 'standard' },
  });
  money(ca.marginalRate, 6.093);
});

test('README: the three California facts', () => {
  const caFed = (agi, deduction) => ({
    adjustedGrossIncome: agi,
    taxableIncome: agi - deduction,
    deduction,
    deductionKind: 'standard',
  });
  const couple = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    federal: caFed(1_211_412, 11_412),
  });
  money(couple.surtaxes[0].amount, 2_000);
  const oneSingle = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: caFed(605_706, 5_706),
  });
  assert.equal(oneSingle.surtaxes.length, 0);

  const low = stateIncomeTax({ state: 'CA', year: 2025, filingStatus: 'single', federal: caFed(15_706, 5_706) });
  const high = stateIncomeTax({ state: 'CA', year: 2025, filingStatus: 'single', federal: caFed(205_706, 5_706) });
  money(low.credits[0].amount, 153);
  money(high.credits[0].amount, 153);

  const step = (dependents) =>
    stateIncomeTax({
      state: 'CA',
      year: 2025,
      filingStatus: 'single',
      dependents,
      federal: caFed(252_203, 5_706),
    }).credits[0].amount -
    stateIncomeTax({
      state: 'CA',
      year: 2025,
      filingStatus: 'single',
      dependents,
      federal: caFed(252_204, 5_706),
    }).credits[0].amount;
  money(step(0), 6);
  money(step(2), 18);
});

test('README: the six 2026 rate cuts, quoted exactly', () => {
  const rateOf = (state, year) => {
    const rate = getStateDefinition(state, year).rate;
    if (rate.kind === 'flat') return rate.rate;
    const bands = rate.byStatus.single;
    return bands[bands.length - 1].rate;
  };
  assert.deepEqual(
    [
      [rateOf('GA', 2025), rateOf('GA', 2026)],
      [rateOf('IN', 2025), rateOf('IN', 2026)],
      [rateOf('KY', 2025), rateOf('KY', 2026)],
      [rateOf('MS', 2025), rateOf('MS', 2026)],
      [rateOf('NC', 2025), rateOf('NC', 2026)],
      [rateOf('UT', 2025), rateOf('UT', 2026)],
    ],
    [
      [0.0519, 0.0499],
      [0.03, 0.0295],
      [0.04, 0.035],
      [0.044, 0.04],
      [0.0425, 0.0399],
      [0.045, 0.0445],
    ],
  );
});

test('README: the provisional and published lists for 2026', () => {
  const byStatus = (status) =>
    SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2026).status === status);
  assert.deepEqual(byStatus('provisional'), ['CA', 'CO', 'ID', 'IL', 'KY', 'MI', 'UT']);
  const published = byStatus('published').filter((s) => !NO_INCOME_TAX_STATES.includes(s));
  assert.deepEqual(published, ['AZ', 'GA', 'IN', 'MS', 'NC', 'PA']);
  assert.equal(SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2025).status === 'provisional').length, 0);
});

test('README: Mississippi zero bracket, and Pennsylvania refusing federal AGI', () => {
  const def = getStateDefinition('MS', 2026);
  assert.equal(def.rate.byStatus.single[0].rate, 0);
  assert.equal(def.rate.byStatus.single[0].upTo, 10_000);
  assert.deepEqual(def.rate.byStatus.marriedFilingJointly, def.rate.byStatus.single);
  assert.throws(
    () => stateIncomeTax({ state: 'PA', year: 2026, filingStatus: 'single', federal: FEDERAL_2025 }),
    /pennsylvaniaTaxableIncome/,
  );
});

test('README: asking for an unsupported state throws rather than returning zero', () => {
  for (const state of ['NY', 'NJ', 'MA', 'OH', 'VA', 'MD', 'MN', 'WI', 'OR', 'SC', 'MO', 'AL', 'CT', 'DC']) {
    assert.throws(
      () => stateIncomeTax({ state, year: 2026, filingStatus: 'single', federal: FEDERAL_2025 }),
      /not supported/,
      `${state} should throw`,
    );
  }
});
