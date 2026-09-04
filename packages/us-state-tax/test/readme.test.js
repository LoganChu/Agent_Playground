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
  nycRate,
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
  assert.equal(at('NY'), 4951.75);
  assert.equal(at('CO'), 3707.0);
  assert.equal(at('AZ'), 2106.25);
  assert.equal(at('TX'), 0);
});

test('README: 23 states, 2025 and 2026, nine with no income tax', () => {
  assert.equal(SUPPORTED_STATES.length, 23);
  assert.deepEqual(SUPPORTED_YEARS, [2025, 2026]);
  assert.equal(NO_INCOME_TAX_STATES.length, 9);
  // Three graduated, eleven flat, nine with none.
  const graduated = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).rate.kind === 'brackets',
  );
  const flat = SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2026).rate.kind === 'flat');
  assert.deepEqual(graduated, ['CA', 'ID', 'MS', 'NY']);
  assert.equal(flat.length, 10);
  // Idaho is stored as brackets only because of its zero band; its positive rate
  // is single, so the README counts it with the flat-rate states.
  assert.equal(graduated.length + flat.length + NO_INCOME_TAX_STATES.length, 23);
  // Fourteen taxing states — the count the README quotes when it says seven of
  // them cut their rate for 2026.
  assert.equal(graduated.length + flat.length, 14);
});

test('README: New York recaptures the brackets, and the identity that says so', () => {
  const ny = (agi) =>
    stateIncomeTax({
      state: 'NY',
      year: 2025,
      filingStatus: 'single',
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: agi - 8_000,
        deduction: 8_000,
        deductionKind: 'standard',
      },
    });
  money(ny(300_000).taxBeforeCredits, 17_602.85, 'what a bracket table gives you');
  money(ny(300_000).tax, 20_002, 'what New York charges');
  assert.equal(ny(6_008_000).tax, 0.103 * 6_000_000);
  money(ny(130_000).marginalRate, 0.0714, '6% plus the phase-in of the supplemental tax');

  // The 2026 rate cut and the recapture rise cancel to the cent at $300,000.
  const ny2026 = stateIncomeTax({
    state: 'NY',
    year: 2026,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: 300_000,
      taxableIncome: 292_000,
      deduction: 8_000,
      deductionKind: 'standard',
    },
  });
  money(ny(300_000).taxBeforeCredits - ny2026.taxBeforeCredits, 215.4, 'bracket tax saved');
  money(ny2026.tax - ny(300_000).tax, 0, 'net change of zero');
});

test('README: the six earned income credit states and their match rates', () => {
  const match = (state, year) => getStateDefinition(state, year).earnedIncomeCredit;
  assert.equal(match('CO', 2025).matchRate, 0.5);
  assert.equal(match('CO', 2026).matchRate, 0.25);
  assert.equal(match('IL', 2025).matchRate, 0.2);
  assert.equal(match('IN', 2025).matchRate, 0.1);
  assert.equal(match('MI', 2025).matchRate, 0.3);
  assert.equal(match('NY', 2025).matchRate, 0.3);
  assert.equal(match('UT', 2025).matchRate, 0.2);
  assert.equal(match('UT', 2025).refundable, false, 'Utah alone cannot pay it out');
  assert.equal(match('NY', 2025).reducedByHouseholdCredit, true);
  assert.equal(match('CA', 2025), undefined, 'CalEITC is deliberately not modelled');
  // The $1,788 the README quotes: half of the 2025 maximum federal credit for two
  // children, lost when the Colorado match halves.
  money(0.5 * 7_152 - 0.25 * 7_152, 1_788, 'Colorado family with two children');
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

test('README: the seven 2026 rate cuts, quoted exactly', () => {
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
  // New York is the seventh, and it is the only one that cut the BOTTOM of its
  // schedule rather than the top: the four highest rates are unchanged, which is
  // why its high earners see no cut at all.
  const nyRates = (year) =>
    getStateDefinition('NY', year).rate.byStatus.single.map((b) => b.rate);
  assert.deepEqual(nyRates(2025).slice(0, 5), [0.04, 0.045, 0.0525, 0.055, 0.06]);
  assert.deepEqual(nyRates(2026).slice(0, 5), [0.039, 0.044, 0.0515, 0.054, 0.059]);
  assert.deepEqual(nyRates(2025).slice(5), nyRates(2026).slice(5));
});

test('README: the provisional and published lists for 2026', () => {
  const byStatus = (status) =>
    SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2026).status === status);
  assert.deepEqual(byStatus('provisional'), ['CA', 'CO', 'ID', 'IL', 'KY', 'MI', 'UT']);
  const published = byStatus('published').filter((s) => !NO_INCOME_TAX_STATES.includes(s));
  assert.deepEqual(published, ['AZ', 'GA', 'IN', 'MS', 'NC', 'NY', 'PA']);
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
  for (const state of ['NJ', 'MA', 'OH', 'VA', 'MD', 'MN', 'WI', 'OR', 'SC', 'MO', 'AL', 'CT', 'DC']) {
    assert.throws(
      () => stateIncomeTax({ state, year: 2026, filingStatus: 'single', federal: FEDERAL_2025 }),
      /not supported/,
      `${state} should throw`,
    );
  }
});

test('README: the New York City quick-start figures', () => {
  const nyc = stateIncomeTax({
    state: 'NY',
    year: 2025,
    filingStatus: 'single',
    locality: 'NYC',
    federal: {
      adjustedGrossIncome: 100_000,
      taxableIncome: 92_000,
      deduction: 8_000,
      deductionKind: 'standard',
    },
  });
  assert.equal(nyc.tax, 4951.75);
  assert.equal(nyc.localTaxes[0].tax, 3174.69);
  assert.equal(nyc.totalTax, 8126.44);
  assert.equal(nyc.totalMarginalRate, 0.0965);

  // "More than the entire state income tax of twelve of the twenty-three states
  // at the same income" — checked against every one of them rather than asserted.
  const federal = {
    adjustedGrossIncome: 100_000,
    taxableIncome: 85_000,
    deduction: 15_000,
    deductionKind: 'standard',
  };
  const cheaper = SUPPORTED_STATES.filter((state) => {
    const result = stateIncomeTax({
      state,
      year: 2025,
      filingStatus: 'single',
      federal,
      ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 100_000 } : {}),
    });
    return result.tax < 3174.69;
  });
  assert.equal(cheaper.length, 12);
  assert.deepEqual(
    cheaper.filter((s) => !NO_INCOME_TAX_STATES.includes(s)),
    ['AZ', 'IN', 'PA'],
  );
});

test('README: the city rate identity and the Yonkers ordering', () => {
  assert.equal(nycRate(0.027), 0.03078);
  assert.equal(nycRate(0.033), 0.03762);
  assert.equal(nycRate(0.0335), 0.03819);
  assert.equal(nycRate(0.034), 0.03876);

  const y = stateIncomeTax({
    state: 'NY',
    year: 2025,
    filingStatus: 'headOfHousehold',
    dependents: 2,
    locality: 'YONKERS',
    federal: {
      adjustedGrossIncome: 20_000,
      taxableIncome: 8_800,
      deduction: 11_200,
      deductionKind: 'standard',
      earnedIncomeCredit: 6_000,
    },
  });
  assert.equal(y.tax, -1528);
  assert.equal(y.localTaxes[0].tax, 30.49);
  money(y.tax * 0.1675, -255.94, 'what netting refundable credits first would give');
});

test('README: the Empire State child credit phase-out table', () => {
  const joint = (agi, ages) =>
    stateIncomeTax({
      state: 'NY',
      year: 2025,
      filingStatus: 'marriedFilingJointly',
      dependentAges: ages,
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: Math.max(0, agi - 16_050),
        deduction: 16_050,
        deductionKind: 'standard',
      },
    }).credits.find((c) => c.name === 'Empire State child credit').amount;

  assert.ok(joint(170_000, [2]) > 0 && joint(170_001, [2]) === 0, 'one child ends at $170,000');
  assert.ok(
    joint(291_000, [1, 2, 3]) > 0 && joint(291_001, [1, 2, 3]) === 0,
    'three children end at $291,000',
  );
  assert.equal(getStateDefinition('NY', 2025).childCredit.phaseOut.amountPerIncrement, 50 * 0.33);

  const hoh = (agi) =>
    stateIncomeTax({
      state: 'NY',
      year: 2025,
      filingStatus: 'headOfHousehold',
      dependentAges: [2],
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: agi - 11_200,
        deduction: 11_200,
        deductionKind: 'standard',
      },
    }).marginalRate;
  assert.equal(hoh(75_000), 16.555);
  assert.equal(hoh(75_001), 0.055);
});
