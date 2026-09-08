// Indiana's state rate is 3.00%, and the average county rate is 1.914% of the
// same figure. So about 39% of an Indiana income tax bill is levied by a county,
// and no table of state income tax rates contains any of it. These tests are
// about that half of the return.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COUNTY_TAX_STATES,
  INDIANA_COUNTIES,
  IN_COUNTY_RATE_CEILING,
  countyDefinition,
  getStateDefinition,
  indianaCounties,
  indianaCounty,
  stateIncomeTax,
} from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
});

const indiana = (opts = {}) =>
  stateIncomeTax({
    state: 'IN',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    federal: federal(opts.agi ?? 60_000),
    ...opts,
  });

const localOf = (result) => result.localTaxes[0];

test('a single filer in Marion County, computed by hand', () => {
  const r = indiana({ agi: 60_000, county: 'Marion' });
  // $60,000 less one $1,000 exemption. Indiana has no standard deduction.
  money(r.taxableIncome, 59_000);
  money(r.tax, 59_000 * 0.03);
  // Schedule CT-40 line 1 is IT-40 line 7 — the same taxable income, so the
  // exemption is inside the county tax too.
  money(localOf(r).baseAmount, 59_000);
  money(localOf(r).tax, 59_000 * 0.0202);
  money(r.totalTax, 2_961.8);
  // Two fifths of the bill, from a tax no state rate table reports.
  assert.ok(localOf(r).tax / r.totalTax > 0.4);
});

test('the spread across the 92 counties is six to one', () => {
  const at = (county) => localOf(indiana({ agi: 60_000, county })).tax;
  money(at('Porter'), 59_000 * 0.005, 'the lowest rate in the state');
  money(at('Randolph'), 59_000 * 0.03, 'and the statutory maximum');
  assert.equal(at('Randolph') / at('Porter'), 6);
  // Same income, same state, same everything else: $1,475 apart.
  money(at('Randolph') - at('Porter'), 1_475);
});

test('in 2026 a Randolph County filer pays their county more than their state', () => {
  const r = indiana({ agi: 60_000, county: 'Randolph County', year: 2026 });
  money(r.tax, 59_000 * 0.0295);
  money(localOf(r).tax, 59_000 * 0.03);
  assert.ok(localOf(r).tax > r.tax, 'the county tax should exceed the state tax');
  // Cass County is exactly level with the state in 2026.
  const cass = indiana({ agi: 60_000, county: 'Cass', year: 2026 });
  money(localOf(cass).tax, cass.tax);
});

test('the state cut its rate for 2026 and six counties raised theirs by more', () => {
  // Indiana's rate steps down 3.00% -> 2.95%. Carroll, Grant, Greene, Howard,
  // Shelby and Union all raised their county rate on the same day.
  const changed = ['Carroll', 'Grant', 'Greene', 'Howard', 'Shelby', 'Union'];
  for (const county of changed) {
    const before = indiana({ agi: 60_000, county, year: 2025 });
    const after = indiana({ agi: 60_000, county, year: 2026 });
    assert.ok(after.tax < before.tax, `${county}: the state rate fell`);
    assert.ok(
      after.totalTax > before.totalTax,
      `${county}: the county rise should outweigh the state cut`,
    );
  }
  // Union is the extreme: 2.00% to 2.75%, against a state cut of 0.05 points.
  const union2025 = indiana({ agi: 60_000, county: 'Union', year: 2025 });
  const union2026 = indiana({ agi: 60_000, county: 'Union', year: 2026 });
  money(union2025.totalTax, 2_950);
  money(union2026.totalTax, 3_363);
  money(union2026.totalTax - union2025.totalTax, 413);
  // And a county that did not move sees the cut, which is the comparison that
  // makes the point: the same state law, two opposite answers.
  const marion2025 = indiana({ agi: 60_000, county: 'Marion', year: 2025 });
  const marion2026 = indiana({ agi: 60_000, county: 'Marion', year: 2026 });
  assert.ok(marion2026.totalTax < marion2025.totalTax);
});

test('every county rate is inside the statutory maximum, and four are computed', () => {
  const rates = [];
  for (const year of [2025, 2026]) {
    for (const def of indianaCounties(year)) {
      assert.equal(def.rate.kind, 'flat', `${def.code} ${year}`);
      assert.ok(
        def.rate.rate > 0 && def.rate.rate <= IN_COUNTY_RATE_CEILING + 1e-12,
        `${def.code} ${year} rate ${def.rate.rate} is outside (0, ${IN_COUNTY_RATE_CEILING}]`,
      );
      rates.push(def.rate.rate);
    }
  }
  assert.equal(INDIANA_COUNTIES.length, 92);
  assert.equal(indianaCounties(2025).length, 92);
  money(Math.max(...rates), IN_COUNTY_RATE_CEILING, 'Randolph sits exactly on the maximum');
  money(Math.min(...rates), 0.005);

  // Four counties have a rate with more than four decimal places, which is what
  // a rate assembled from IC 6-3.6 components looks like rather than one chosen.
  const computed = indianaCounties(2025)
    .filter((def) => String(def.rate.rate).split('.')[1].length > 4)
    .map((def) => def.code);
  assert.deepEqual(computed.sort(), [
    'Brown County',
    'Carroll County',
    'Jasper County',
    'Whitley County',
  ]);
});

test('the average county rate, and the share of the bill it is', () => {
  // Both figures are claims in the README, the package description and the
  // Indiana notes, so they are computed here rather than remembered.
  const mean = (year) => {
    const rates = indianaCounties(year).map((def) => def.rate.rate);
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  };
  assert.equal(Number(mean(2025).toFixed(6)), 0.019143);
  assert.equal(Number((mean(2025) * 100).toFixed(3)), 1.914);
  // Against a 3.00% state rate, that is 39% of the bill — and 39.6% in 2026,
  // because the state rate fell while the county average rose.
  const share = (m, stateRate) => m / (stateRate + m);
  assert.equal(Number((share(mean(2025), 0.03) * 100).toFixed(1)), 39.0);
  assert.equal(Number((share(mean(2026), 0.0295) * 100).toFixed(1)), 39.6);
});

test('omitting the county says what the range costs this filer', () => {
  const r = indiana({ agi: 60_000 });
  assert.equal(r.localTaxes.length, 0);
  const note = r.notes.find((n) => n.startsWith('No county was supplied'));
  assert.ok(note, 'the missing-county note is not there');
  assert.ok(note.includes('all 92'), note);
  assert.ok(note.includes('$295.00'), note);
  assert.ok(note.includes('$1,770.00'), note);
});

test('a county name is resolved on its own state\'s table', () => {
  // Montgomery County exists in both states, with different rates, and the state
  // decides which table the name is looked up in.
  const inMd = stateIncomeTax({
    state: 'MD',
    year: 2025,
    filingStatus: 'single',
    county: 'Montgomery',
    federal: federal(60_000),
  });
  const inIn = indiana({ agi: 60_000, county: 'Montgomery' });
  assert.equal(localOf(inMd).locality, 'Montgomery County');
  assert.equal(localOf(inIn).locality, 'Montgomery County');
  assert.notEqual(localOf(inMd).tax, localOf(inIn).tax);
  money(localOf(inIn).tax, 59_000 * 0.0265);

  // Loose matching, and an unknown name lists the 92 rather than returning zero.
  for (const name of ['st joseph', 'St. Joseph County', 'ST JOSEPH CO.']) {
    assert.equal(indianaCounty(name, 2025).code, 'St. Joseph County', name);
  }
  assert.equal(indianaCounty('laporte', 2025).code, 'LaPorte County');
  assert.throws(() => indianaCounty('Cook County', 2025), /not a IN taxing jurisdiction/);
  assert.throws(() => indianaCounty('Cook County', 2025), /Tippecanoe/);
  assert.throws(() => indianaCounty('Marion', 2024), /2025 and 2026/);

  // Indiana's Ohio County is a county, not a state.
  assert.equal(indianaCounty('Ohio', 2025).code, 'Ohio County');
});

test('a county on a state with no county income tax names the two that have one', () => {
  assert.deepEqual([...COUNTY_TAX_STATES], ['IN', 'MD']);
  assert.throws(
    () => countyDefinition('OH', 'Franklin County', 2025),
    /county applies to a return in IN or MD/,
  );
  assert.throws(
    () =>
      stateIncomeTax({
        state: 'CA',
        year: 2025,
        filingStatus: 'single',
        federal: federal(60_000),
        county: 'Marion County',
      }),
    /county applies to a return in IN or MD/,
  );
});

test('the Indiana county tax is on the state\'s own taxable income', () => {
  // Which is what makes an exemption worth more than its face value: the $1,000
  // exemption saves the state rate AND the county rate, so in Randolph County it
  // is worth 6% rather than 3%.
  const def = getStateDefinition('IN', 2025);
  assert.equal(def.exemption.perDependent, 1_000);
  const one = indiana({ agi: 60_000, county: 'Randolph', dependents: 0 });
  const two = indiana({ agi: 60_000, county: 'Randolph', dependents: 1 });
  money(one.totalTax - two.totalTax, 1_000 * (0.03 + 0.03));
  assert.equal(indianaCounty('Randolph', 2025).base, 'stateTaxableIncome');
});
