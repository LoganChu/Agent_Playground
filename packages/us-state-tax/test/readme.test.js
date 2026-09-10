// The README is the package's landing page, and a correctness library whose own
// documentation is wrong has no credibility left to trade on. These tests pin
// every number quoted in README.md so it cannot drift silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MICHIGAN_CITIES,
  OHIO_EARNED_INCOME_DISTRICTS,
  OHIO_MUNICIPALITIES,
  OHIO_MUNICIPAL_RATES,
  OHIO_SCHOOL_DISTRICTS,
  OHIO_SCHOOL_DISTRICT_RATES,
  MI_CITY_EXEMPTIONS,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  michiganCities,
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

test('README: 27 states, 2025 and 2026, nine with no income tax', () => {
  assert.equal(SUPPORTED_STATES.length, 27);
  assert.deepEqual(SUPPORTED_YEARS, [2025, 2026]);
  assert.equal(NO_INCOME_TAX_STATES.length, 9);
  // Six graduated, eleven flat, one on a schedule of its own, nine with none.
  const graduated = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).rate.kind === 'brackets',
  );
  const flat = SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2026).rate.kind === 'flat');
  // Ohio is neither. Its schedule charges a flat constant on entering a band and
  // a rate on the excess, which is a `baseAmountSchedule` and not expressible as
  // either of the two above — the whole reason the rule exists.
  const baseAmount = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).rate.kind === 'baseAmountSchedule',
  );
  assert.deepEqual(graduated, ['CA', 'ID', 'MD', 'MS', 'NJ', 'NY']);
  assert.deepEqual(baseAmount, ['OH']);
  assert.equal(flat.length, 11);
  // Idaho is stored as brackets only because of its zero band; its positive rate
  // is single, so the README counts it with the flat-rate states.
  assert.equal(
    graduated.length + flat.length + baseAmount.length + NO_INCOME_TAX_STATES.length,
    27,
  );
  // Eighteen taxing states — the count the README quotes when it says seven of
  // them cut their rate for 2026.
  assert.equal(graduated.length + flat.length + baseAmount.length, 18);
  // Massachusetts counts as flat here and is the reason the label is wrong: its
  // rate rule is one 5% rate, and the statute puts short-term capital gains at
  // 8.5% and collectibles at 12% beside it.
  const classes = getStateDefinition('MA', 2026).separatelyRatedIncome;
  assert.deepEqual(classes.map((c) => c.rate), [0.085, 0.12]);
  assert.equal(
    SUPPORTED_STATES.filter((s) => (getStateDefinition(s, 2026).separatelyRatedIncome ?? []).length > 0)
      .length,
    1,
  );
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
  assert.equal(match('CA', 2025), undefined, 'California computes its own instead');
  // The $1,788 the README quotes: half of the 2025 maximum federal credit for two
  // children, lost when the Colorado match halves.
  money(0.5 * 7_152 - 0.25 * 7_152, 1_788, 'Colorado family with two children');
});

test('README: the CalEITC section', () => {
  const def = getStateDefinition('CA', 2025);
  const rule = def.ownEarnedIncomeCredit;
  const yctc = def.youngChildCredit;

  // "the credit percentages are the federal 7.65% / 34% / 40% / 45%"
  assert.deepEqual(rule.byChildCount.map((b) => b.phaseInRate), [0.0765, 0.34, 0.4, 0.45]);
  // "In 2025 that is $4,661 / $6,998 / $9,823", and each is half the federal 2015
  // ceiling indexed by one factor.
  assert.deepEqual(
    rule.byChildCount.map((b) => b.earnedIncomeAmount),
    [4_661, 6_998, 9_823, 9_823],
  );
  // "subsidised at 28.9%, not 34%"
  money(0.34 * rule.adjustmentFactor, 0.289, 'one-child effective phase-in rate');
  // "the $32,901 cap" and "the $4,814 investment-income limit"
  assert.equal(rule.finalPhaseOutEnd, 32_901);
  assert.equal(rule.investmentIncomeLimit, 4_814);
  // "$1,189, refundable" and "$21.71 per $100"
  assert.equal(yctc.amount, 1_189);
  assert.equal(yctc.phaseOut.amountPerIncrement, 21.71);

  const parent = (earnedIncome) =>
    stateIncomeTax({
      state: 'CA',
      year: 2025,
      filingStatus: 'headOfHousehold',
      federal: {
        adjustedGrossIncome: earnedIncome,
        taxableIncome: Math.max(0, earnedIncome - 22_500),
        deduction: 22_500,
        deductionKind: 'standard',
      },
      earnedIncome,
      dependentAges: [3, 7],
    });
  assert.equal(parent(8_000).marginalRate, -0.34);
  assert.equal(parent(10_000).marginalRate, 0.34);
  assert.equal(parent(25_000).marginalRate, 0.042);
  // "a 68-point swing across the single dollar at $9,823"
  money(parent(10_000).marginalRate - parent(8_000).marginalRate, 0.68, 'the swing');
  // "$1,824 later": the distance from $8,000 to the $9,823 peak, plus the dollar
  // that flips the sign.
  assert.equal(9_823 + 1 - 8_000, 1_824);
  // "add 74 cents to every dollar": the federal 40% two-child phase-in plus
  // California's 34%.
  money(0.4 + 0.34, 0.74, 'the two credits together');
  // "worth $4,528.82 ... at $9,823 of earnings"
  const peak = parent(9_823).tax;
  const disqualified = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'headOfHousehold',
    federal: {
      adjustedGrossIncome: 9_823,
      taxableIncome: 0,
      deduction: 22_500,
      deductionKind: 'standard',
    },
    earnedIncome: 9_823,
    dependentAges: [3, 7],
    investmentIncome: 4_815,
  }).tax;
  money(disqualified - peak, 4_528.82, 'the investment-income cliff');
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
      newJerseyGrossIncome: income,
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

test('README: the Maryland quick-start and county figures', () => {
  const md = stateIncomeTax({
    state: 'MD',
    year: 2025,
    filingStatus: 'single',
    county: 'Montgomery County',
    federal: FEDERAL_2025,
  });
  assert.equal(md.tax, 4386.38);
  assert.equal(md.localTaxes[0].tax, 2990.4);
  assert.equal(md.totalTax, 7376.78);

  const frederick = (taxableIncome) =>
    stateIncomeTax({
      state: 'MD',
      year: 2025,
      filingStatus: 'single',
      county: 'Frederick',
      federal: {
        adjustedGrossIncome: taxableIncome + 3_350,
        taxableIncome,
        deduction: 0,
        deductionKind: 'standard',
      },
    }).localTaxes[0].tax;
  assert.equal(frederick(150_000), 4440);
  assert.equal(frederick(150_001), 4800.03);
  assert.equal(Math.round((frederick(150_001) - frederick(150_000)) * 100) / 100, 360.03);

  const itemizer = stateIncomeTax({
    state: 'MD',
    year: 2025,
    filingStatus: 'single',
    county: 'Howard County',
    stateItemizedDeductions: 40_000,
    federal: {
      adjustedGrossIncome: 300_000,
      taxableIncome: 250_000,
      deduction: 50_000,
      deductionKind: 'itemized',
    },
  });
  assert.equal(itemizer.deduction, 32_500);
  assert.equal(itemizer.totalMarginalRate, 0.0962);
});

test('README: the Indiana county figures', () => {
  const inCounty = (county, year = 2025) =>
    stateIncomeTax({
      state: 'IN',
      year,
      filingStatus: 'single',
      county,
      federal: {
        adjustedGrossIncome: 60_000,
        taxableIncome: 44_250,
        deduction: 15_750,
        deductionKind: 'standard',
      },
    });
  assert.equal(inCounty('Marion').tax, 1770);
  assert.equal(inCounty('Marion').localTaxes[0].tax, 1191.8);
  assert.equal(inCounty('Porter').localTaxes[0].tax, 295);
  assert.equal(inCounty('Randolph').localTaxes[0].tax, 1770);
  // From 2026 the county tax exceeds the state tax in Randolph County.
  const randolph = inCounty('Randolph', 2026);
  assert.ok(randolph.localTaxes[0].tax > randolph.tax);
  // Union County: the state cut is worth $30 and the county rise costs $450.
  const union2025 = inCounty('Union');
  const union2026 = inCounty('Union', 2026);
  assert.equal(union2025.tax - union2026.tax, 29.5);
  assert.equal(union2026.localTaxes[0].tax - union2025.localTaxes[0].tax, 442.5);
  assert.ok(union2026.totalTax / union2025.totalTax > 1.13);
});

test('README: the Michigan city figures', () => {
  const mi = (city, extra = {}) =>
    stateIncomeTax({
      state: 'MI',
      year: 2025,
      filingStatus: 'single',
      city,
      federal: {
        adjustedGrossIncome: 100_000,
        taxableIncome: 84_250,
        deduction: 15_750,
        deductionKind: 'standard',
      },
      ...extra,
    });
  assert.equal(mi('Detroit').tax, 4003.5);
  assert.equal(mi('Detroit').localTaxes[0].tax, 2385.6);
  assert.equal(mi('Highland Park').localTaxes[0].tax, 1988);
  assert.equal(mi('Grand Rapids').localTaxes[0].tax, 1491);
  assert.equal(mi('Lansing').localTaxes[0].tax, 994);
  assert.equal(mi('Grayling').localTaxes[0].tax, 970);
  // "60% of what Michigan itself charges", rounded the way the heading rounds.
  assert.equal(Math.round((2385.6 / 4003.5) * 100), 60);
  // 24 cities, 20 of them at exactly 1%, 16 of them at the $600 floor.
  assert.equal(MICHIGAN_CITIES.length, 24);
  assert.equal(michiganCities(2025).filter((c) => c.rate.rate === 0.01).length, 20);
  assert.equal([...MI_CITY_EXEMPTIONS.values()].filter((v) => v === 600).length, 16);
  assert.equal(MI_CITY_EXEMPTIONS.get('Grayling'), 3000);
  // "$14.40 of tax, per person, per year" and "$6.00".
  assert.equal(Math.round(0.024 * 600 * 100) / 100, 14.4);
  assert.equal(Math.round(0.01 * 600 * 100) / 100, 6);
  // Grayling really is the cheapest city in the state at this income, on the
  // strength of its exemption rather than its rate.
  const cheapest = michiganCities(2025)
    .map((c) => ({ name: String(c.code), tax: mi(String(c.code)).localTaxes[0].tax }))
    .sort((a, b) => a.tax - b.tax)[0];
  assert.equal(cheapest.name, 'Grayling');
});

test('README: the Michigan commute, and the credit that is capped at the home rate', () => {
  const federal60 = {
    adjustedGrossIncome: 60_000,
    taxableIncome: 44_250,
    deduction: 15_750,
    deductionKind: 'standard',
  };
  const commute = stateIncomeTax({
    state: 'MI',
    year: 2025,
    filingStatus: 'single',
    city: 'Lansing',
    workCity: 'Detroit',
    workCityEarnings: 60_000,
    federal: federal60,
  });
  assert.equal(commute.localTaxes[0].tax, 712.8);
  assert.equal(commute.localTaxes[1].tax, 297);
  assert.equal(commute.localTaxes[1].credits[0].amount, 297);
  assert.equal(commute.localTaxes[0].tax + commute.localTaxes[1].tax, 1009.8);

  const atHome = stateIncomeTax({
    state: 'MI',
    year: 2025,
    filingStatus: 'single',
    city: 'Lansing',
    federal: federal60,
  });
  assert.equal(atHome.localTaxes[0].tax, 594);
  assert.equal(Math.round((1009.8 / 594 - 1) * 100), 70);

  const downhill = stateIncomeTax({
    state: 'MI',
    year: 2025,
    filingStatus: 'single',
    city: 'Detroit',
    workCity: 'Grand Rapids',
    workCityEarnings: 60_000,
    federal: federal60,
  });
  assert.equal(downhill.localTaxes[0].tax, 445.5);
  assert.equal(downhill.localTaxes[1].tax, 980.1);
  assert.equal(downhill.localTaxes[0].tax + downhill.localTaxes[1].tax, 1425.6);
});

test('README: the provisional and published lists for 2026', () => {
  const byStatus = (status) =>
    SUPPORTED_STATES.filter((s) => getStateDefinition(s, 2026).status === status);
  assert.deepEqual(byStatus('provisional'), ['CA', 'CO', 'ID', 'IL', 'KY', 'MD', 'MI', 'OH', 'UT']);
  const published = byStatus('published').filter((s) => !NO_INCOME_TAX_STATES.includes(s));
  assert.deepEqual(published, ['AZ', 'GA', 'IN', 'MA', 'MS', 'NC', 'NJ', 'NY', 'PA']);
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
  for (const state of ['VA', 'MN', 'WI', 'OR', 'SC', 'MO', 'AL', 'CT', 'DC']) {
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

  // "More than the entire state income tax of thirteen of the twenty-seven
  // states at the same income" — checked against every one of them rather than
  // asserted. Ohio joined the list on Day 16 without its rate changing: at
  // $100,000 the Ohio STATE tax is $2,323.38, and the Columbus resident paying
  // it also owes their municipality $2,500 that no state rate table reports.
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
      pennsylvaniaTaxableIncome: 100_000,
      newJerseyGrossIncome: 100_000,
      massachusettsFivePercentIncome: 100_000,
    });
    return result.tax < 3174.69;
  });
  assert.equal(cheaper.length, 13);
  assert.deepEqual(
    cheaper.filter((s) => !NO_INCOME_TAX_STATES.includes(s)),
    ['AZ', 'IN', 'OH', 'PA'],
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

test('README: the New Jersey section', () => {
  const federal = FEDERAL_2025;
  const single = (grossIncome) =>
    stateIncomeTax({
      state: 'NJ',
      year: 2025,
      filingStatus: 'single',
      federal,
      newJerseyGrossIncome: grossIncome,
    });
  money(single(10_000).tax, 0);
  money(single(10_001).tax, 126.01);

  const joint = stateIncomeTax({
    state: 'NJ',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    federal,
    newJerseyGrossIncome: 20_001,
  });
  money(joint.tax, 252.01);

  const retiree = (totalIncome) =>
    stateIncomeTax({
      state: 'NJ',
      year: 2025,
      filingStatus: 'marriedFilingJointly',
      federal,
      newJerseyGrossIncome: totalIncome,
      retirementIncome: 100_000,
      filerAge: 70,
    });
  money(retiree(150_000).tax, 3_965.5);
  money(retiree(150_001).tax, 5_346.81);
  money(retiree(150_000).marginalRate, 1_381.3052);

  // "the largest one-dollar cliff in this package", against the two the README
  // names elsewhere: California's investment-income cliff at $4,528.82 is
  // larger, but it is a cliff in a *credit*, not in the tax. Among the cliffs
  // measured as a marginal rate on a dollar of income, this is the biggest.
  assert.ok(retiree(150_000).marginalRate > 1_000);

  // "multiply by .05525 and subtract $1,492.50" — the single filer's fourth band.
  const inThatBand = single(51_000);
  money(inThatBand.taxableIncome, 50_000);
  money(inThatBand.tax, 0.05525 * 50_000 - 1_492.5);

  // The 25% raise, and the $600 / $750 cliffs it turns into.
  const family = (taxableIncome, year) =>
    stateIncomeTax({
      state: 'NJ',
      year,
      filingStatus: 'marriedFilingJointly',
      federal,
      newJerseyGrossIncome: taxableIncome + 2_000 + 3 * 1_500,
      dependentAges: [1, 3, 5],
    }).credits.find((c) => c.name.includes('child tax credit')).amount;
  money(family(30_000, 2025) - family(30_001, 2025), 600);
  money(family(30_000, 2026) - family(30_001, 2026), 750);
  money(family(30_000, 2026), family(30_000, 2025) * 1.25);

  // The derived exclusion percentages.
  const rule = getStateDefinition('NJ', 2025).retirementExclusion;
  money(0.5 * (rule.maximum.single / rule.maximum.marriedFilingJointly), 0.375);
  money(
    0.25 * (rule.maximum.marriedFilingSeparately / rule.maximum.marriedFilingJointly),
    0.125,
  );
});

test('README: Massachusetts is not a 5% flat tax state', () => {
  const ma = (fields) =>
    stateIncomeTax({
      state: 'MA',
      year: 2025,
      filingStatus: 'single',
      federal: FEDERAL_2025,
      ...fields,
    });

  assert.equal(ma({ massachusettsFivePercentIncome: 100_000 }).tax, 4780.0);
  assert.equal(
    ma({ massachusettsFivePercentIncome: 80_000, shortTermCapitalGains: 20_000 }).tax,
    5480.0,
  );
  assert.equal(
    ma({ massachusettsFivePercentIncome: 80_000, collectiblesGains: 20_000 }).tax,
    4980.0,
  );

  // No Tax Status and the Limited Income Credit's 10%.
  assert.equal(ma({ massachusettsFivePercentIncome: 8_000 }).tax, 0);
  assert.equal(ma({ massachusettsFivePercentIncome: 8_001 }).tax, 0.1);
  assert.equal(ma({ massachusettsFivePercentIncome: 10_000 }).marginalRate, 0.1);
  assert.equal(ma({ massachusettsFivePercentIncome: 11_600 }).marginalRate, 0.05);

  // The joint filing requirement, priced.
  const each = ma({
    massachusettsFivePercentIncome: 700_000,
    filingStatus: 'marriedFilingSeparately',
  });
  const both = ma({
    massachusettsFivePercentIncome: 1_400_000,
    filingStatus: 'marriedFilingJointly',
  });
  assert.equal(each.surtaxes.length, 0);
  assert.equal(both.surtaxes[0].amount, 12322.0);
  assert.equal(both.tax - 2 * each.tax, 12322.0);

  // The surtax reached by a capital gain rather than by salary.
  assert.equal(
    ma({ massachusettsFivePercentIncome: 200_000, shortTermCapitalGains: 1_000_000 })
      .surtaxes[0].amount,
    4498.0,
  );
  assert.equal(ma({ massachusettsFivePercentIncome: 1_200_000 }).surtaxes[0].amount, 4498.0);

  // "The entire year-over-year change in Massachusetts income tax is $984."
  const at2m = (year) =>
    stateIncomeTax({
      state: 'MA',
      year,
      filingStatus: 'single',
      federal: FEDERAL_2025,
      massachusettsFivePercentIncome: 2_000_000,
    }).tax;
  assert.equal(at2m(2025) - at2m(2026), 984);
  assert.equal((1_107_750 - 1_083_150) * 0.04, 984);
});

test('README: the Ohio quick-start figures and both discontinuities', () => {
  const oh = (agi, extra = {}) =>
    stateIncomeTax({
      state: 'OH',
      year: 2025,
      filingStatus: 'single',
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: Math.max(0, agi - 15_750),
        deduction: 15_750,
        deductionKind: 'standard',
      },
      ...extra,
    });
  assert.equal(oh(28_450).tax, 0);
  assert.equal(oh(28_450.01).tax, 322.0);
  assert.equal(oh(101_900).tax, 2375.63);
  assert.equal(oh(101_900.01).tax, 2394.32);
  money(oh(101_900.01).tax - oh(101_900).tax, 18.69);
  assert.equal(oh(250_000).tax, 7022.45);
  assert.equal(oh(250_000, { businessIncome: 250_000 }).tax, 0);
  // "$360.69 + 2.75% x $73,950 = $2,394.315" — the chaining that stopped.
  money(360.69 + 0.0275 * 73_950, 2394.315);
});

test('README: Columbus, the crossover, and the $612.50 a deferral does not save', () => {
  const columbus = stateIncomeTax({
    state: 'OH',
    year: 2025,
    filingStatus: 'single',
    city: 'Columbus',
    qualifyingWages: 60_000,
    federal: {
      adjustedGrossIncome: 60_000,
      taxableIncome: 44_250,
      deduction: 15_750,
      deductionKind: 'standard',
    },
  });
  assert.equal(columbus.tax, 1216.5);
  assert.equal(columbus.localTaxes[0].tax, 1500);
  assert.equal(columbus.totalTax, 2716.5);
  // The crossover: below $126,408.32 the municipality takes more than Ohio does.
  const stateAt = (agi) =>
    stateIncomeTax({
      state: 'OH',
      year: 2025,
      filingStatus: 'single',
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: agi - 15_750,
        deduction: 15_750,
        deductionKind: 'standard',
      },
    }).tax;
  assert.ok(stateAt(126_408) < 0.025 * 126_408);
  assert.ok(stateAt(126_409) > 0.025 * 126_409);
  money(0.025 * 24_500, 612.5);
});

test('README: 679 municipalities, the rate distribution, and the commuter symmetry', () => {
  assert.equal(OHIO_MUNICIPALITIES.length, 679);
  const counts = new Map();
  for (const rate of OHIO_MUNICIPAL_RATES.values()) {
    counts.set(rate, (counts.get(rate) ?? 0) + 1);
  }
  assert.equal(counts.get(0.01), 266);
  assert.equal(counts.get(0.015), 122);
  assert.equal(counts.get(0.02), 122);
  assert.equal(counts.get(0.025), 41);
  assert.equal(OHIO_MUNICIPAL_RATES.get('Indian Hill'), 0.0045);
  assert.equal(OHIO_MUNICIPAL_RATES.get('Bedford'), 0.03);

  const live = (city, workCity) =>
    stateIncomeTax({
      state: 'OH',
      year: 2025,
      filingStatus: 'single',
      city,
      workCity,
      workCityEarnings: 60_000,
      qualifyingWages: 60_000,
      federal: {
        adjustedGrossIncome: 60_000,
        taxableIncome: 44_250,
        deduction: 15_750,
        deductionKind: 'standard',
      },
    }).localTaxes.map((l) => l.tax);
  assert.deepEqual(live('Westerville', 'Columbus'), [1500, 0]);
  assert.deepEqual(live('Columbus', 'Westerville'), [1200, 300]);
});

test('README: the three Ohio bases, and the deferral they disagree about', () => {
  const oh = stateIncomeTax({
    state: 'OH',
    year: 2026,
    filingStatus: 'single',
    city: 'Columbus',
    qualifyingWages: 100_000,
    schoolDistrict: '0404',
    earnedIncome: 75_500,
    federal: {
      adjustedGrossIncome: 75_500,
      taxableIncome: 59_750,
      deduction: 15_750,
      deductionKind: 'standard',
    },
  });
  assert.equal(oh.localTaxes[0].baseAmount, 100_000);
  assert.equal(oh.localTaxes[1].baseAmount, 75_500);
  money(0.025 * 24_500, 612.5);
  money(0.0125 * 24_500, 306.25);
  // 214 districts, 68 of them on the earned income base, every rate a quarter point.
  assert.equal(OHIO_SCHOOL_DISTRICTS.length, 214);
  assert.equal(OHIO_EARNED_INCOME_DISTRICTS.length, 68);
  assert.equal(
    OHIO_SCHOOL_DISTRICTS.length - OHIO_EARNED_INCOME_DISTRICTS.length,
    146,
    'the traditional count the README quotes',
  );
  for (const rate of OHIO_SCHOOL_DISTRICT_RATES.values()) {
    assert.ok(Math.abs(rate / 0.0025 - Math.round(rate / 0.0025)) < 1e-9);
  }
});
