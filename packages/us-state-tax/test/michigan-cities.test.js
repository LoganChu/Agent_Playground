// Michigan's 24 city income taxes.
//
// Three claims are worth testing rather than asserting, and each of them is a
// number this package would otherwise be storing on faith:
//
//   * the nonresident rate is HALF the resident rate, in every city, because
//     MCL 141.611 says so — so it is derived here, and checked against the four
//     cities that publish theirs separately;
//   * the personal exemption is the $600 the Legislature set in 1964 and never
//     indexed, which at the highest rate in the state is $14.40 of tax; and
//   * the credit a home city gives for tax paid to a work city is capped at the
//     HOME city's nonresident rate, so it is complete in one direction and
//     short in the other — and the direction it is short in is the one people
//     commute.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  stateIncomeTax,
  michiganCities,
  michiganCity,
  michiganNonresidentRate,
  MICHIGAN_CITIES,
  MI_CITY_EXEMPTIONS,
  MI_CITY_EXEMPTION_FLOOR,
  MI_CITY_ORDINARY_RATE_CEILING,
  MI_PUBLISHED_NONRESIDENT_RATES,
} from '../dist/esm/index.js';

const federal = (agi, deduction = 15750) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});

const single = (agi, extra = {}) => ({
  state: 'MI',
  year: 2025,
  filingStatus: 'single',
  federal: federal(agi),
  ...extra,
});

const cityTax = (input) => {
  const result = stateIncomeTax(input);
  const resident = result.localTaxes.find((l) => l.basis === 'resident');
  return { result, resident };
};

test('all 24 taxing cities are present, and nothing else resolves', () => {
  assert.equal(MICHIGAN_CITIES.length, 24);
  assert.equal(michiganCities(2025).length, 24);
  assert.equal(michiganCities(2026).length, 24);
  // Michigan's largest cities that do NOT levy an income tax. Each one is a
  // plausible guess by a caller who knows Michigan has city income taxes and
  // does not know which cities have them, and each has to be an error rather
  // than a zero.
  for (const notTaxing of ['Ann Arbor', 'Warren', 'Sterling Heights', 'Kalamazoo', 'Dearborn']) {
    assert.throws(() => michiganCity(notTaxing, 2025), /not a MI taxing jurisdiction/);
  }
  // Matching ignores case, and the error does not offer a suffix that does not
  // exist — "Detroit County" is not a thing and the message must not say it is.
  assert.equal(michiganCity('grand rapids', 2025).code, 'Grand Rapids');
  assert.equal(michiganCity('DETROIT', 2025).code, 'Detroit');
  // The error must not offer a suffix that does not exist: "Detroit County" is
  // not a thing, and a model that reads the message will try it if told to.
  assert.throws(() => michiganCity('Nowhere', 2025), (e) => {
    assert.match(e.message, /Matching ignores case/);
    assert.doesNotMatch(e.message, /County/);
    return true;
  });
});

test('the nonresident rate is half the resident rate, in all 24 cities', () => {
  // MCL 141.611 fixes the ratio, so this package stores one rate per city and
  // halves it. The four cities levying above the ordinary 1% ceiling publish
  // their nonresident rate separately, which is what makes this a check rather
  // than a restatement of the derivation.
  assert.equal(MI_PUBLISHED_NONRESIDENT_RATES.size, 4);
  for (const [city, published] of MI_PUBLISHED_NONRESIDENT_RATES) {
    assert.equal(michiganNonresidentRate(michiganCity(city, 2025).rate.rate), published, city);
  }
  for (const def of michiganCities(2025)) {
    assert.equal(def.nonresidentEarningsRate, def.rate.rate / 2, def.name);
    // Above the ordinary ceiling only under a city-specific enabling act; the
    // other twenty are exactly at it.
    if (def.rate.rate > MI_CITY_ORDINARY_RATE_CEILING) {
      assert.ok(MI_PUBLISHED_NONRESIDENT_RATES.has(String(def.code)), def.name);
    } else {
      assert.equal(def.rate.rate, MI_CITY_ORDINARY_RATE_CEILING, def.name);
    }
  }
});

test('the exemption is the 1964 statutory floor in two thirds of the cities, and never below it', () => {
  const atFloor = [...MI_CITY_EXEMPTIONS.values()].filter((v) => v === MI_CITY_EXEMPTION_FLOOR);
  assert.equal(MI_CITY_EXEMPTION_FLOOR, 600);
  assert.equal(atFloor.length, 16);
  for (const [city, amount] of MI_CITY_EXEMPTIONS) {
    assert.ok(amount >= MI_CITY_EXEMPTION_FLOOR, `${city} is below the MCL 141.631(1) floor`);
  }
  // Grayling is five times the floor and the highest in the state.
  assert.equal(Math.max(...MI_CITY_EXEMPTIONS.values()), 3000);
  assert.equal(MI_CITY_EXEMPTIONS.get('Grayling'), 3000);
});

test('the exemption is worth $14.40 of tax in Detroit and $6.00 in a 1% city', () => {
  // The whole point of the number, and the reason the per-city variations in
  // WHICH extra exemptions a city allows are not modelled: each one is bounded
  // by this. Michigan's own personal exemption is $5,800 and is indexed
  // annually; the city one has been $600 since Act 284 of 1964.
  const worth = (city) => {
    const def = michiganCity(city, 2025);
    return Math.round(def.rate.rate * def.exemptionAmount * 100) / 100;
  };
  assert.equal(worth('Detroit'), 14.4);
  assert.equal(worth('Lansing'), 6);
  assert.equal(worth('Grand Rapids'), 9);

  // And it is measurable end to end: one more dependent is worth exactly that.
  const one = cityTax(single(100000, { city: 'Detroit', dependents: 1 }));
  const none = cityTax(single(100000, { city: 'Detroit' }));
  assert.equal(Math.round((none.resident.tax - one.resident.tax) * 100) / 100, 14.4);

  const MI_STATE_EXEMPTION = 5800;
  assert.equal(MI_CITY_EXEMPTION_FLOOR / MI_STATE_EXEMPTION < 0.104, true);
});

test('a Detroit resident at $100,000 owes $2,385.60 to the city and $4,003.50 to the state', () => {
  const { result, resident } = cityTax(single(100000, { city: 'Detroit' }));
  // (100,000 - 600) x 2.4%, by hand.
  assert.equal(resident.baseAmount, 99400);
  assert.equal(resident.tax, 2385.6);
  assert.equal(result.tax, 4003.5);
  assert.equal(result.totalTax, 6389.1);
  // The city takes 59.6% of what the state takes, on the same paycheck, and no
  // table of state income tax rates contains any of it.
  assert.equal(Math.round((resident.tax / result.tax) * 1000) / 10, 59.6);
  // Both rates are on the marginal rate, because the derived city income moves
  // with federal AGI.
  assert.equal(result.totalMarginalRate, 0.0665);
});

test('the same $100,000 costs six different city taxes, and the spread is not the rate spread', () => {
  const at = (city) => cityTax(single(100000, { city })).resident.tax;
  assert.equal(at('Detroit'), 2385.6);
  assert.equal(at('Highland Park'), 1988);
  assert.equal(at('Grand Rapids'), 1491);
  assert.equal(at('Saginaw'), 1488.75);
  assert.equal(at('Lansing'), 994);
  assert.equal(at('Grayling'), 970);

  // Grand Rapids and Saginaw share a rate and differ by $2.25 of exemption;
  // Lansing and Grayling share a rate and differ by $24. So the cheapest city
  // in Michigan is not one of the twenty at the lowest rate generally — it is
  // the one at the lowest rate with the largest exemption.
  assert.equal(Math.round((at('Grand Rapids') - at('Saginaw')) * 100) / 100, 2.25);
  assert.equal(at('Grayling'), Math.min(...michiganCities(2025).map((c) => at(String(c.code)))));
});

test('a city taxes no part of a pension, where the state is still working out the tier', () => {
  // The Uniform City Income Tax Ordinance excludes pensions, annuities and IRA
  // distributions entirely, for every city. Michigan reaches a similar place
  // for a retiree only through the four-tier deduction of MCL 206.30(9).
  const retiree = single(50000, { city: 'Detroit', retirementIncome: 40000 });
  const { resident } = cityTax(retiree);
  assert.equal(resident.baseAmount, 9400); // 50,000 - 40,000 - 600
  assert.equal(resident.tax, 225.6);

  // Supplying the city's own figure gives the same answer here and stops the
  // engine deriving it — which is visible in the marginal rate, because a
  // supplied figure does not move with federal AGI.
  const supplied = cityTax(single(50000, { city: 'Detroit', cityIncome: 10000 }));
  assert.equal(supplied.resident.tax, 225.6);
  assert.equal(supplied.resident.marginalRate, 0);
  assert.equal(resident.marginalRate, 0.024);
});

test('the derivation says which way it errs when cityIncome is missing', () => {
  const { result } = cityTax(single(100000, { city: 'Detroit' }));
  const note = result.notes.find((n) => n.startsWith('cityIncome was not supplied'));
  assert.ok(note, 'a derived city income has to say so');
  assert.match(note, /TOO HIGH/);
  assert.match(note, /Social Security/);
  // And it disappears once the caller supplies the figure.
  const supplied = cityTax(single(100000, { city: 'Detroit', cityIncome: 100000 }));
  assert.equal(
    supplied.result.notes.some((n) => n.startsWith('cityIncome was not supplied')),
    false,
  );
});

test('a Michigan return with no city says what the two extremes would cost', () => {
  const result = stateIncomeTax(single(100000));
  assert.equal(result.localTaxes.length, 0);
  const note = result.notes.find((n) => n.startsWith('No city was supplied'));
  assert.ok(note);
  assert.match(note, /\$970\.00 \(Grayling, Michigan\)/);
  assert.match(note, /\$2,385\.60 \(Detroit, Michigan\)/);
  // Unlike the Maryland and Indiana county notes, this one does not claim the
  // filer owes anything: most Michigan residents live in none of the 24.
  assert.match(note, /Most Michigan residents live in none/);
});

test('the credit for tax paid to another city is complete downhill and short uphill', () => {
  const wages = 60000;
  const atHome = cityTax(single(wages, { city: 'Lansing' }));
  assert.equal(atHome.resident.tax, 594); // (60,000 - 600) x 1%

  const commuting = stateIncomeTax(
    single(wages, { city: 'Lansing', workCity: 'Detroit', workCityEarnings: wages }),
  );
  const detroit = commuting.localTaxes.find((l) => l.basis === 'nonresidentEarnings');
  const lansing = commuting.localTaxes.find((l) => l.basis === 'resident');
  assert.equal(detroit.tax, 712.8); // (60,000 - 600) x 1.2%
  // Lansing would charge $594 and credits only its own 0.5% — $297 — of the
  // $712.80 Detroit took.
  assert.equal(lansing.credits[0].amount, 297);
  assert.equal(lansing.tax, 297);
  const commutingTotal = detroit.tax + lansing.tax;
  assert.equal(commutingTotal, 1009.8);
  // Working in Detroit costs a Lansing resident 70% more city tax than working
  // at home, on the same wage.
  assert.equal(Math.round((commutingTotal / atHome.resident.tax - 1) * 100), 70);

  // The other direction is exactly whole. A Detroit resident working in Grand
  // Rapids pays Grand Rapids 0.75% and Detroit the rest, and the two together
  // are the same $1,425.60 they would owe if they never left Detroit.
  const downhill = stateIncomeTax(
    single(wages, { city: 'Detroit', workCity: 'Grand Rapids', workCityEarnings: wages }),
  );
  const gr = downhill.localTaxes.find((l) => l.basis === 'nonresidentEarnings');
  const home = downhill.localTaxes.find((l) => l.basis === 'resident');
  assert.equal(gr.tax, 445.5);
  assert.equal(home.credits[0].amount, 445.5);
  assert.equal(gr.tax + home.tax, cityTax(single(wages, { city: 'Detroit' })).resident.tax);
  assert.equal(gr.tax + home.tax, 1425.6);
});

test('a nonresident claims the work city\'s exemptions, and no home city is needed', () => {
  const result = stateIncomeTax(
    single(60000, { workCity: 'Detroit', workCityEarnings: 60000, dependents: 2 }),
  );
  const detroit = result.localTaxes.find((l) => l.basis === 'nonresidentEarnings');
  // Three exemptions of $600 against Detroit-source wages: (60,000 - 1,800) x 1.2%.
  assert.equal(detroit.baseAmount, 58200);
  assert.equal(detroit.tax, 698.4);
  assert.equal(detroit.marginalRate, 0);
  assert.equal(result.localTaxes.length, 1);
});

test('the work city is apportioned wages, not the whole wage', () => {
  // Form DW-4's day count: half the year inside Detroit halves the base.
  const half = stateIncomeTax(single(60000, { workCity: 'Detroit', workCityEarnings: 30000 }));
  const detroit = half.localTaxes.find((l) => l.basis === 'nonresidentEarnings');
  assert.equal(detroit.baseAmount, 29400);
  assert.equal(detroit.tax, 352.8);
});

test('city and workCity are rejected where they cannot mean anything', () => {
  assert.throws(
    () => stateIncomeTax({ ...single(60000), state: 'IL', city: 'Chicago' }),
    /city applies to a Michigan or Ohio return; state is IL/,
  );
  assert.throws(
    () => stateIncomeTax({ ...single(60000), state: 'NY', workCity: 'Detroit' }),
    /workCity applies to a Michigan or Ohio return/,
  );
  // The same city on both sides is a contradiction, not a double charge: a
  // resident pays the resident rate on everything and never the nonresident
  // rate as well.
  assert.throws(
    () => stateIncomeTax(single(60000, { city: 'Detroit', workCity: 'detroit', workCityEarnings: 1 })),
    /A resident pays the resident tax on everything/,
  );
  assert.throws(() => stateIncomeTax(single(60000, { city: 'Toledo' })), /not a MI taxing/);
});

test('a city rate is fixed by ordinance, so 2026 is 2025 and neither is provisional', () => {
  // Unlike an indexed state parameter there is nothing unpublished waiting to
  // arrive: a rate or an exemption changes only when a council, and in most
  // cases the city's voters, change it.
  for (const def of michiganCities(2025)) {
    const next = michiganCity(String(def.code), 2026);
    assert.equal(next.rate.rate, def.rate.rate, def.name);
    assert.equal(next.exemptionAmount, def.exemptionAmount, def.name);
    assert.equal(next.status, 'published', def.name);
    assert.equal(def.status, 'published', def.name);
  }
  assert.throws(() => michiganCity('Detroit', 2024), /supported for 2025 and 2026/);
});

test('the city tax is untouched by every Michigan deduction, exemption and credit', () => {
  // The point of the `cityIncome` base: a Michigan city is not downstream of the
  // MI-1040, so a filer whose Michigan tax is zeroed by the state earned income
  // credit still owes Detroit in full.
  const family = {
    state: 'MI',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    dependents: 2,
    federal: {
      adjustedGrossIncome: 28000,
      taxableIncome: 0,
      deduction: 31500,
      deductionKind: 'standard',
      earnedIncomeCredit: 6000,
    },
    city: 'Detroit',
  };
  const result = stateIncomeTax(family);
  assert.ok(result.tax < 0, 'the state credit makes this a refund');
  const detroit = result.localTaxes.find((l) => l.basis === 'resident');
  // (28,000 - 4 x 600) x 2.4%. The 30% state earned income credit does not
  // reach it, and neither does the $5,800-per-person state exemption.
  assert.equal(detroit.baseAmount, 25600);
  assert.equal(detroit.tax, 614.4);
  assert.ok(result.totalTax > result.tax);
});
