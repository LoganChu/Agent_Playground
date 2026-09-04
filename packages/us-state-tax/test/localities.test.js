// New York City and Yonkers — the two localities on a New York State return, and
// the first local income taxes in this package.
//
// Three of the four tables the Department of Taxation and Finance publishes for
// New York City turn out to be generated rather than given:
//
//   * the rate schedule is the § 11-1701 statutory rates times 1.14;
//   * the school tax credit's base column is 0.171% of the bracket threshold,
//     rounded to a dollar;
//   * the married-filing-separately household credit table is the joint table
//     halved and rounded to a dollar;
//   * and the earned income credit's rate table is a 30% match shedding five
//     points across each of four $2,500 windows.
//
// These tests are the proof that each derivation is the same computation as the
// table it replaces.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateIncomeTax, nycRate, NYC_ADDITIONAL_TAX_RATE } from '../dist/esm/index.js';
import { newYorkCity } from '../dist/esm/localities/new-york.js';
import {
  localHouseholdCredit,
  roundHalfUp,
  schoolTaxCreditRateReduction,
  slidingEarnedIncomeMatch,
} from '../dist/esm/localities/engine.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const DEDUCTION = {
  single: 8_000,
  marriedFilingJointly: 16_050,
  marriedFilingSeparately: 8_000,
  headOfHousehold: 11_200,
  qualifyingSurvivingSpouse: 16_050,
};

const ny = (agi, opts = {}) => {
  const status = opts.filingStatus ?? 'single';
  const deduction = DEDUCTION[status];
  return stateIncomeTax({
    state: 'NY',
    year: opts.year ?? 2025,
    filingStatus: status,
    dependents: opts.dependents ?? 0,
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - deduction),
      deduction,
      deductionKind: 'standard',
      earnedIncomeCredit: opts.earnedIncomeCredit,
    },
    ...(opts.locality ? { locality: opts.locality } : {}),
    ...(opts.yonkersNonresidentEarnings !== undefined
      ? { yonkersNonresidentEarnings: opts.yonkersNonresidentEarnings }
      : {}),
    ...(opts.federalOneDollarHigher ? { federalOneDollarHigher: opts.federalOneDollarHigher } : {}),
  });
};

const localNamed = (result, code) => result.localTaxes.find((l) => l.locality === code);
const cityCredit = (result, prefix) =>
  localNamed(result, 'NYC').credits.find((c) => c.name.startsWith(prefix))?.amount ?? 0;

const DEF = newYorkCity(2025);

// ---------------------------------------------------------------------------
// The rate schedule is the statutory rates times the additional tax
// ---------------------------------------------------------------------------

// N.Y.C. Admin. Code § 11-1701 imposes 2.7% / 3.3% / 3.35% / 3.4%. Nobody has
// ever paid those: § 11-1704.1 adds a tax of 14% OF THAT TAX, and the schedule
// the Department of Taxation and Finance publishes is the product. Not "close
// to" the product — bit-identical to the published three-decimal percentages,
// which is what makes storing five numbers instead of four the right choice.
test('the four published New York City rates are the statutory rates times 1.14, exactly', () => {
  assert.equal(NYC_ADDITIONAL_TAX_RATE, 0.14);
  assert.equal(nycRate(0.027), 0.03078);
  assert.equal(nycRate(0.033), 0.03762);
  assert.equal(nycRate(0.0335), 0.03819);
  assert.equal(nycRate(0.034), 0.03876);

  const rates = DEF.rate.byStatus.single.map((b) => b.rate);
  assert.deepEqual(rates, [0.03078, 0.03762, 0.03819, 0.03876]);
});

// The published rates are not derivable from any other clean additional-tax
// percentage, so the 14% is doing real work rather than being fitted.
test('no other whole-percent additional tax reproduces the published schedule', () => {
  for (let pct = 1; pct <= 40; pct += 1) {
    if (pct === 14) continue;
    assert.notEqual(nycRate(0.027, pct / 100), 0.03078, `${pct}% must not reproduce 3.078%`);
  }
});

// If the State authorisation for the higher § 11-1701 schedule is ever allowed
// to lapse, the top city rate falls to the permanent schedule's 1.48% x 1.14.
// The package covers 2025 and 2026 and says so in a note rather than projecting.
test('the permanent schedule underneath the temporary one is 56% lower at the top', () => {
  const permanentTop = nycRate(0.0148);
  assert.equal(permanentTop, 0.016872);
  assert.ok(permanentTop / 0.03876 < 0.44);
});

// ---------------------------------------------------------------------------
// The bracket walk
// ---------------------------------------------------------------------------

test('hand-computed New York City tax for a single filer at $100,000', () => {
  const result = ny(100_000, { locality: 'NYC' });
  const city = localNamed(result, 'NYC');

  // City taxable income is state taxable income: $100,000 - $8,000.
  assert.equal(city.baseAmount, 92_000);
  assert.equal(city.base, 'stateTaxableIncome');

  const expected =
    12_000 * 0.03078 + 13_000 * 0.03762 + 25_000 * 0.03819 + 42_000 * 0.03876;
  money(city.taxBeforeCredits, expected, 'tax before credits');
  money(city.taxBeforeCredits, 3_441.09, 'tax before credits, to the cent');
});

test('the joint and head-of-household schedules are the single one with wider bands', () => {
  const single = DEF.rate.byStatus.single.map((b) => b.upTo);
  const joint = DEF.rate.byStatus.marriedFilingJointly.map((b) => b.upTo);
  const hoh = DEF.rate.byStatus.headOfHousehold.map((b) => b.upTo);
  assert.deepEqual(single, [12_000, 25_000, 50_000, Infinity]);
  assert.deepEqual(joint, [21_600, 45_000, 90_000, Infinity]);
  assert.deepEqual(hoh, [14_400, 30_000, 60_000, Infinity]);
  // Married filing separately uses the single schedule, as it does at state level.
  assert.deepEqual(DEF.rate.byStatus.marriedFilingSeparately, DEF.rate.byStatus.single);
});

// The state's § 601(d) supplemental tax is a state tax. The city does not have
// one, so a high earner faces a flat 3.876% on everything over $50,000 and the
// city's effective rate approaches its top rate from below and stops there.
test('New York City has no benefit recapture, so its top rate is its ceiling', () => {
  const city = localNamed(ny(10_000_000, { locality: 'NYC' }), 'NYC');
  assert.equal(city.brackets.at(-1).rate, 0.03876);
  assert.ok(city.taxBeforeCredits / 9_992_000 < 0.03876);
  assert.ok(city.taxBeforeCredits / 9_992_000 > 0.0387);
  // And the state result still carries its recapture, so the two are independent.
  const state = ny(10_000_000, { locality: 'NYC' });
  assert.ok(state.surtaxes.some((s) => s.name.startsWith('New York supplemental')));
});

// ---------------------------------------------------------------------------
// The school tax credit's base column is a rounded derivation
// ---------------------------------------------------------------------------

// The instructions print "$21 plus .228% of the excess" for a single filer, "$37"
// for a joint one and "$25" for a head of household. All three are 0.171% of the
// bracket threshold rounded to the nearest dollar. This package stores the two
// rates and the three thresholds and derives the base, so there is no fourth
// column to re-key — and it reproduces all three published figures.
test('the school tax credit base column is round(0.171% x threshold)', () => {
  assert.equal(roundHalfUp(0.00171 * 12_000), 21); // 20.52
  assert.equal(roundHalfUp(0.00171 * 21_600), 37); // 36.936
  assert.equal(roundHalfUp(0.00171 * 14_400), 25); // 24.624
});

// The published amounts at the top of the credit's range, from the Form IT-201
// instructions' worksheet. Three independent checks of the same derivation.
test('the rate reduction amount at $500,000 of city taxable income matches the form', () => {
  const at = (status) =>
    schoolTaxCreditRateReduction(DEF, { filingStatus: status }, 500_000);
  money(at('single'), 1_133.64, 'single');
  money(at('marriedFilingJointly'), 1_127.75, 'joint');
  money(at('headOfHousehold'), 1_132.17, 'head of household');
});

// The rounding is not cosmetic, and this is the test that says why. Using the
// unrounded 0.171% x $12,000 = $20.52 as the base is 48 cents low for every
// single filer above $12,000 of city taxable income, forever. It is a small
// error that never goes away and never gets bigger, which is the kind that
// survives in a reference dataset for years.
test('rounding the base makes a 48-cent step at the threshold, and the form has it', () => {
  const at = (income) => schoolTaxCreditRateReduction(DEF, { filingStatus: 'single' }, income);
  money(at(12_000), 20.52, 'at the threshold, the lower rate applies to the whole amount');
  money(at(12_001), 21 + 0.00228, 'one dollar later, the rounded base applies');
  assert.ok(at(12_001) - at(12_000) > 0.47);
  // And the unrounded alternative is exactly 48 cents short at the top.
  money(0.00171 * 12_000 + 0.00228 * 488_000, 1_133.16, 'unrounded');
  money(at(500_000) - (0.00171 * 12_000 + 0.00228 * 488_000), 0.48, 'the gap');
});

// ---------------------------------------------------------------------------
// Both halves of the school tax credit are cliffs
// ---------------------------------------------------------------------------

test('the rate reduction amount is a $1,133.64 cliff at $500,000 of city taxable income', () => {
  const under = ny(508_000, { locality: 'NYC' });
  const over = ny(508_001, { locality: 'NYC' });
  assert.equal(under.taxableIncome, 500_000);
  money(cityCredit(under, 'New York City school tax credit (rate reduction'), 1_133.64);
  money(cityCredit(over, 'New York City school tax credit (rate reduction'), 0);
  // One dollar of income costs the whole credit plus the tax on the dollar. The
  // engine measures it by running the computation a dollar higher, so the cliff
  // shows up in the marginal rate rather than having to be known about.
  money(localNamed(under, 'NYC').marginalRate, 1_133.64 + 0.03876, 'local marginal rate');
  assert.ok(under.totalMarginalRate > 1_133);
  assert.ok(over.totalMarginalRate < 0.11);
});

test('the fixed amount is a $63 cliff at $250,000 of federal AGI', () => {
  money(cityCredit(ny(250_000, { locality: 'NYC' }), 'New York City school tax credit (fixed'), 63);
  money(cityCredit(ny(250_001, { locality: 'NYC' }), 'New York City school tax credit (fixed'), 0);
  const joint = ny(250_000, { locality: 'NYC', filingStatus: 'marriedFilingJointly' });
  money(cityCredit(joint, 'New York City school tax credit (fixed'), 125);
});

// ---------------------------------------------------------------------------
// The household credit, and the separate table that is the joint table halved
// ---------------------------------------------------------------------------

test('the New York City household credit is flat for a single filer and per person otherwise', () => {
  const hh = (filingStatus, dependents, agi) =>
    localHouseholdCredit(DEF, { filingStatus, dependents }, agi);

  assert.equal(hh('single', 0, 0), 15);
  assert.equal(hh('single', 0, 10_000), 15);
  assert.equal(hh('single', 0, 11_000), 10);
  assert.equal(hh('single', 0, 12_501), 0);

  // A childless couple is two counted people, so the $30 row is worth $60.
  assert.equal(hh('marriedFilingJointly', 0, 15_000), 60);
  assert.equal(hh('marriedFilingJointly', 2, 15_000), 120);
  assert.equal(hh('marriedFilingJointly', 2, 21_000), 40);
  assert.equal(hh('marriedFilingJointly', 2, 22_501), 0);
  assert.equal(hh('headOfHousehold', 1, 15_000), 60);
});

// The instructions print a separate table for married filing separately —
// $15 / $13 / $8 / $5 — and every entry is half the joint table's
// $30 / $25 / $15 / $10 with round-half-up. $12.50 becomes $13 and $7.50
// becomes $8, which is what makes it a rounding rule rather than a coincidence.
test('the married-filing-separately table is the joint table halved and rounded', () => {
  const perPerson = DEF.householdCredit.perPerson.map((s) => s.amount);
  assert.deepEqual(perPerson, [30, 25, 15, 10, 0]);
  assert.deepEqual(perPerson.map(roundHalfUp2), [15, 13, 8, 5, 0]);

  const hh = (dependents, agi) =>
    localHouseholdCredit(DEF, { filingStatus: 'marriedFilingSeparately', dependents }, agi);
  assert.equal(hh(1, 15_000), 30); // two people at $15 each
  assert.equal(hh(3, 18_000), 32); // four people at $8 each
  assert.equal(hh(5, 21_000), 30); // six people at $5 each
});

function roundHalfUp2(amount) {
  return roundHalfUp(amount / 2);
}

// ---------------------------------------------------------------------------
// The earned income credit is a sliding match, and the table is an identity
// ---------------------------------------------------------------------------

// Since 2022 the city's match is not one number. It is 30% falling to 10% across
// four windows, published as a long table of income ranges and decimals. Six
// stored numbers reproduce every row, and the schedule is continuous at all four
// joins — which is the check that the windows are the right width, because a
// window even a dollar off would leave a step.
test('the New York City earned income credit match is continuous at every join', () => {
  const match = (agi) => slidingEarnedIncomeMatch(DEF, agi);
  for (const [start, before, after] of [
    [5_000, 0.3, 0.25],
    [15_000, 0.25, 0.2],
    [20_000, 0.2, 0.15],
    [40_000, 0.15, 0.1],
  ]) {
    money(match(start - 1), before, `flat below ${start}`);
    money(match(start), before, `no reduction on the first dollar of the ${start} window`);
    money(match(start + 2_499), after, `fully stepped down at the end of the ${start} window`);
    money(match(start + 2_500), after, `flat above ${start + 2_500}`);
  }
  money(match(0), 0.3);
  money(match(1_000_000), 0.1);
});

// The two worked examples in the Form IT-215 rate worksheet, including the
// instruction to round the computed decimal to four places. Without the rounding
// the second one is 0.17998 and the answer is a cent light.
test('the published rate worksheet examples reproduce exactly', () => {
  money(slidingEarnedIncomeMatch(DEF, 18_000), 0.2, 'the flat row');
  money(slidingEarnedIncomeMatch(DEF, 21_000), 0.18, 'the worked reduction');
  assert.equal(slidingEarnedIncomeMatch(DEF, 21_000), 0.18);
});

// The pre-2022 credit was a flat 5% of the federal one. Anything still carrying
// that figure understates a city family with young children by six times.
test('the sliding match is worth up to six times the 5% the city used to pay', () => {
  const federalCredit = 7_800;
  const family = ny(20_000, {
    locality: 'NYC',
    filingStatus: 'headOfHousehold',
    dependents: 3,
    earnedIncomeCredit: federalCredit,
  });
  const credit = cityCredit(family, 'New York City earned income credit');
  money(credit, 0.2 * federalCredit, 'the match at $20,000 of New York AGI');
  money(credit / (0.05 * federalCredit), 4, 'four times the old flat 5%');
  money(slidingEarnedIncomeMatch(DEF, 0) / 0.05, 6, 'six times it at the bottom');
});

// The finding nobody models, and it is stranger than it first looks. Inside a
// window the city takes back 0.00002 of the federal credit per dollar of income —
// 15.6 cents on the dollar for a family with a $7,800 federal credit, from a city
// whose top statutory rate is 3.876%. But the worksheet's four-decimal rounding
// turns that into a STAIRCASE: the match holds flat for five dollars of income
// and then drops a full basis point, so the true marginal rate is zero four
// dollars in five and 78 cents on the dollar on the fifth.
const cityEitcFamily = (agi, federalCredit) => {
  const status = 'headOfHousehold';
  const deduction = DEDUCTION[status];
  const federal = (a) => ({
    adjustedGrossIncome: a,
    taxableIncome: Math.max(0, a - deduction),
    deduction,
    deductionKind: 'standard',
    earnedIncomeCredit: federalCredit,
  });
  // Hold the federal credit constant so the city's own reduction is the only
  // thing moving; this is the state engine's federalOneDollarHigher contract.
  return stateIncomeTax({
    state: 'NY',
    year: 2025,
    filingStatus: status,
    dependents: 3,
    federal: federal(agi),
    federalOneDollarHigher: federal(agi + 1),
    locality: 'NYC',
  });
};

test('the city earned income credit falls in $5 steps, not smoothly', () => {
  const federalCredit = 7_800;
  const credit = (agi) =>
    localNamed(cityEitcFamily(agi, federalCredit), 'NYC').credits.find((c) =>
      c.name.startsWith('New York City earned income credit'),
    ).amount;

  money(credit(21_001), 0.18 * federalCredit, 'flat across the tread');
  money(credit(21_002), 0.1799 * federalCredit, 'and then a whole basis point at once');
  money(credit(21_001) - credit(21_002), 0.78, 'the step');
  money(credit(21_002), credit(21_006), 'flat again for five dollars');

  // Averaged over the window it is exactly the 0.00002 the worksheet states.
  money((credit(21_002) - credit(21_007)) / 5, 0.00002 * federalCredit, 'the average rate');
});

test('so the measured city marginal rate is zero on a tread and 78 cents on a riser', () => {
  const tread = localNamed(cityEitcFamily(21_000, 7_800), 'NYC').marginalRate;
  const riser = localNamed(cityEitcFamily(21_001, 7_800), 'NYC').marginalRate;
  // On the tread only the rate schedule moves: 3.078% less the 0.171% the school
  // tax credit gives back at this income.
  money(tread, 0.03078 - 0.00171, 'on a tread');
  money(riser, 0.03078 - 0.00171 + 0.78, 'on a riser');
  assert.ok(riser > 0.8, `expected a marginal rate above 80 points, got ${riser}`);
  // And the combined figure carries it, because that is the number a filer feels.
  assert.ok(cityEitcFamily(21_001, 7_800).totalMarginalRate > 0.8);
});

// ---------------------------------------------------------------------------
// Yonkers taxes the tax
// ---------------------------------------------------------------------------

test('the Yonkers resident surcharge is 16.75% of the state tax', () => {
  const result = ny(100_000, { locality: 'YONKERS' });
  const yonkers = localNamed(result, 'YONKERS');
  assert.equal(yonkers.base, 'stateNetTax');
  money(yonkers.baseAmount, result.tax, 'the base is the state tax itself');
  money(yonkers.tax, result.tax * 0.1675, 'the surcharge');
  money(result.totalTax, result.tax * 1.1675, 'total');
  // The surcharge inherits the state's marginal rate at 16.75 cents on the dollar.
  money(yonkers.marginalRate, result.marginalRate * 0.1675, 'marginal rate');
});

// Because the surcharge is a share of the state tax, a state rate cut cuts it
// with no action by Yonkers — and the FY2026 state rate cut is worth exactly
// zero to a high earner, so the Yonkers surcharge is unchanged for them too.
test('the FY2026 state rate cut passes straight through to Yonkers, including its zero', () => {
  const lower = [ny(60_000, { locality: 'YONKERS', year: 2025 }), ny(60_000, { locality: 'YONKERS', year: 2026 })];
  assert.ok(lower[1].localTaxes[0].tax < lower[0].localTaxes[0].tax);
  money(
    lower[0].localTaxes[0].tax - lower[1].localTaxes[0].tax,
    (lower[0].tax - lower[1].tax) * 0.1675,
    'the Yonkers share of the state cut',
  );

  // Past the first recapture phase-in the state cut is worth nothing, so neither
  // is the Yonkers share of it. Same figure to the cent in both years.
  const high = [ny(300_000, { locality: 'YONKERS', year: 2025 }), ny(300_000, { locality: 'YONKERS', year: 2026 })];
  money(high[0].tax, high[1].tax, 'state tax unchanged');
  money(high[0].localTaxes[0].tax, high[1].localTaxes[0].tax, 'Yonkers surcharge unchanged');
});

// The ordering test, and the one that separates this from the reference
// implementations. Refundable state credits are claimed in the payments section
// of the return, below the surcharge line, so they cannot reduce it. A model
// that nets them first hands this family a NEGATIVE city tax — a refund from
// Yonkers of 16.75% of a state refund.
test('a refundable state credit larger than the state tax does not make Yonkers negative', () => {
  const result = ny(20_000, {
    locality: 'YONKERS',
    filingStatus: 'headOfHousehold',
    dependents: 2,
    earnedIncomeCredit: 6_000,
  });
  assert.ok(result.tax < 0, 'the state owes this family a refund');
  money(result.tax, -1_528, 'state tax after the refundable earned income credit');

  const yonkers = localNamed(result, 'YONKERS');
  money(yonkers.baseAmount, 182, 'state tax after non-refundable credits only');
  money(yonkers.tax, 30.49, 'the surcharge is positive');
  assert.ok(yonkers.tax > 0);
  // What the other computation would give, for the record.
  money(result.tax * 0.1675, -255.94, 'the wrong answer');
});

test('a Yonkers resident pays the surcharge and never the nonresident earnings tax', () => {
  const result = ny(100_000, { locality: 'YONKERS', yonkersNonresidentEarnings: 40_000 });
  assert.equal(result.localTaxes.length, 1);
  assert.equal(result.localTaxes[0].basis, 'resident');
});

test('a non-resident who works in Yonkers pays 0.5% of Yonkers-source wages', () => {
  const result = ny(100_000, { yonkersNonresidentEarnings: 40_000 });
  assert.equal(result.localTaxes.length, 1);
  const yonkers = localNamed(result, 'YONKERS');
  assert.equal(yonkers.basis, 'nonresidentEarnings');
  assert.equal(yonkers.base, 'wages');
  money(yonkers.tax, 200);
  // Its base is a wage figure this engine does not vary, so it contributes
  // nothing to the marginal rate on the next dollar of state income.
  assert.equal(yonkers.marginalRate, 0);
  money(result.totalMarginalRate, result.marginalRate);
});

// Living in one taxing locality and working in another is why the result carries
// a list. New York City resident tax and the Yonkers earnings tax, same return.
test('a New York City resident who works in Yonkers owes both', () => {
  const result = ny(100_000, { locality: 'NYC', yonkersNonresidentEarnings: 40_000 });
  assert.equal(result.localTaxes.length, 2);
  assert.deepEqual(
    result.localTaxes.map((l) => [l.locality, l.basis]),
    [
      ['NYC', 'resident'],
      ['YONKERS', 'nonresidentEarnings'],
    ],
  );
  money(result.totalTax, result.tax + 3_174.69 + 200);
});

// ---------------------------------------------------------------------------
// The totals, and what the result says when the locality is missing
// ---------------------------------------------------------------------------

test('totalTax and totalMarginalRate are the state plus every local figure', () => {
  const result = ny(100_000, { locality: 'NYC' });
  money(result.totalTax, result.tax + result.localTaxes[0].tax);
  money(result.totalMarginalRate, result.marginalRate + result.localTaxes[0].marginalRate);
  // 6.00% state plus 3.876% city less the 0.228% the school tax credit gives back.
  money(result.marginalRate, 0.06, 'state');
  money(result.localTaxes[0].marginalRate, 0.03876 - 0.00228, 'city');
  money(result.totalMarginalRate, 0.0965, 'combined');
});

test('a state with no locality supplied says so, and says what it costs', () => {
  const result = ny(100_000);
  assert.deepEqual(result.localTaxes, []);
  money(result.totalTax, result.tax);
  const note = result.notes.find((n) => n.startsWith('No locality was supplied'));
  assert.ok(note, 'expected a note naming the missing locality');
  assert.ok(note.includes('$3,174.69'), `expected the quantified cost, got: ${note}`);
});

test('every other state is unaffected: no locality, totals equal to the state figures', () => {
  const federal = {
    adjustedGrossIncome: 100_000,
    taxableIncome: 85_000,
    deduction: 15_000,
    deductionKind: 'standard',
  };
  for (const state of ['CA', 'IL', 'TX']) {
    const result = stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal });
    assert.deepEqual(result.localTaxes, [], state);
    assert.equal(result.totalTax, result.tax, state);
    assert.equal(result.totalMarginalRate, result.marginalRate, state);
  }
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test('a locality outside the state on the return is an error, not a silent zero', () => {
  assert.throws(
    () =>
      stateIncomeTax({
        state: 'CA',
        year: 2025,
        filingStatus: 'single',
        locality: 'NYC',
        federal: {
          adjustedGrossIncome: 100_000,
          taxableIncome: 85_000,
          deduction: 15_000,
          deductionKind: 'standard',
        },
      }),
    /NYC is in NY, not CA/,
  );
});

test('an unsupported locality-year is an error, and names the years that work', () => {
  assert.throws(() => ny(100_000, { locality: 'NYC', year: 2027 }), /tax year 2027/);
});
