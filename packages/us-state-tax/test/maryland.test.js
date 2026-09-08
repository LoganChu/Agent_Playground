// Maryland is two income taxes on one taxable income, and the second one is
// missing from every table of state income tax rates. These tests are about the
// second one, about the four cliffs the 2025 legislation left in the first, and
// about the three figures this package derives rather than stores.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MARYLAND_COUNTIES,
  MD_COUNTY_RATE_CEILING,
  MD_COUNTY_RATE_FLOOR,
  MD_LOCAL_EITC_RATE_MULTIPLE,
  getStateDefinition,
  marylandCounties,
  marylandCounty,
  stateIncomeTax,
} from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** Within a cent, for a comparison between two figures the result has rounded. */
const cent = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) <= 0.011,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi, opts = {}) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - (opts.deduction ?? 15_750)),
  deduction: opts.deduction ?? 15_750,
  deductionKind: opts.deductionKind ?? 'standard',
  ...(opts.earnedIncomeCredit === undefined
    ? {}
    : { earnedIncomeCredit: opts.earnedIncomeCredit }),
});

const md = (opts = {}) =>
  stateIncomeTax({
    state: 'MD',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    federal: federal(opts.agi ?? 100_000, opts),
    ...opts,
  });

const localOf = (result) => result.localTaxes[0];

test('a single filer at $100,000 in Montgomery County, computed by hand', () => {
  const r = md({ agi: 100_000, county: 'Montgomery County' });
  // $100,000 - $3,350 standard deduction - $3,200 exemption.
  money(r.deduction, 3_350);
  money(r.exemptions, 3_200);
  money(r.taxableIncome, 93_450);
  // 2% of $1,000 + 3% of $1,000 + 4% of $1,000 + 4.75% of the remaining $90,450,
  // which is $4,386.375 before the result rounds it to the cent.
  money(r.tax, Math.round((20 + 30 + 40 + 90_450 * 0.0475) * 100) / 100);
  money(r.tax, 4_386.38);
  // The county charges its 3.20% on the same taxable income.
  money(localOf(r).baseAmount, 93_450);
  money(localOf(r).tax, 2_990.4);
  money(r.totalTax, 7_376.78);
});

test('the county tax is a third to two fifths of a Maryland bill', () => {
  // The claim the README and the package description make. It is a claim about
  // the whole return, so it is measured on the whole return.
  const rich = md({ agi: 100_000, county: 'Montgomery County' });
  const modest = md({ agi: 60_000, county: 'Worcester County' });
  const share = (r) => localOf(r).tax / r.totalTax;
  assert.ok(share(rich) > 0.4 && share(rich) < 0.41, `Montgomery share ${share(rich)}`);
  assert.ok(share(modest) > 0.32 && share(modest) < 0.33, `Worcester share ${share(modest)}`);
  // And it is not a rounding error against other states: $2,990.40 of county tax
  // is more than the entire state income tax of Arizona or Indiana at the same
  // income, let alone the nine states that levy none.
  const other = (state) =>
    stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal: federal(100_000) }).tax;
  assert.ok(localOf(rich).tax > other('AZ'));
  assert.ok(localOf(rich).tax > other('IN'));
});

test('omitting the county says what it costs, at both ends of the range', () => {
  const r = md({ agi: 100_000 });
  assert.equal(r.localTaxes.length, 0);
  const note = r.notes.find((n) => n.startsWith('No county was supplied'));
  assert.ok(note, 'the missing-county note is not there');
  // Quantified rather than hedged: the cheapest and dearest counties, run through
  // the same engine on this filer's own figures.
  assert.ok(note.includes('2,102.63'), note); // Worcester, 2.25% of $93,450
  assert.ok(note.includes('3,083.85'), note); // Dorchester, 3.30%
});

test('Frederick County charges one rate on the whole income, and it is a cliff', () => {
  // The single most consequential difference between the two Maryland counties
  // with more than one rate. A bracket table would cost three cents here.
  const at = (taxableIncome) =>
    md({ agi: taxableIncome + 3_350, deduction: 0, county: 'Frederick County', filerAge: 40 });
  const below = at(150_000);
  const above = at(150_001);
  money(localOf(below).tax, 150_000 * 0.0296);
  money(localOf(above).tax, 150_001 * 0.032);
  money(localOf(above).tax - localOf(below).tax, 360.03);
  money(localOf(below).marginalRate, 360.032);
  // One band in the detail, because one rate is what was charged.
  assert.equal(localOf(below).brackets.length, 1);
  money(localOf(below).brackets[0].rate, 0.0296);
  money(localOf(below).brackets[0].incomeInBracket, 150_000);
});

test('Anne Arundel County is marginal, and the same dollar costs three cents', () => {
  // $3,350 of standard deduction and one $3,200 exemption sit between AGI and the
  // taxable income the county charges.
  const at = (taxableIncome) =>
    md({ agi: taxableIncome + 3_350 + 3_200, deduction: 0, county: 'Anne Arundel', filerAge: 40 });
  const below = at(50_000);
  const above = at(50_001);
  money(localOf(below).tax, 50_000 * 0.027);
  money(localOf(above).tax, 50_000 * 0.027 + 0.0294);
  assert.ok(localOf(above).tax - localOf(below).tax < 0.03);
  // Three bands in the schedule and two of them used above $50,000.
  assert.equal(localOf(above).brackets.length, 2);
});

test('the personal exemption is a staircase, and every exemption falls at once', () => {
  const single = (agi) => md({ agi, county: 'Howard County' });
  money(single(100_000).exemptions, 3_200);
  money(single(100_001).exemptions, 1_600);
  money(single(125_001).exemptions, 800);
  money(single(150_001).exemptions, 0);

  // A joint return with four dependents claims six exemptions, so the step at
  // $150,000 removes $9,600 at once — $763.28 of state and county tax on one
  // dollar of income, in a 3.20% county.
  const family = (agi) =>
    md({
      agi,
      deduction: 6_700,
      filingStatus: 'marriedFilingJointly',
      dependents: 4,
      county: 'Howard County',
    });
  money(family(150_000).exemptions, 6 * 3_200);
  money(family(150_001).exemptions, 6 * 1_600);
  money(family(150_001).totalTax - family(150_000).totalTax, 763.28);
  money(family(150_000).totalMarginalRate, 763.2795);
});

test('the stored exemption table and the steps that generate it agree', () => {
  // `perFiler` and `perDependent` are the top step. Storing both is a duplication
  // and this is the test that keeps it honest.
  const def = getStateDefinition('MD', 2025);
  const rule = def.exemption;
  const filers = { single: 1, marriedFilingJointly: 2, marriedFilingSeparately: 1, headOfHousehold: 1, qualifyingSurvivingSpouse: 1 };
  for (const [status, count] of Object.entries(filers)) {
    money(rule.perFiler[status], rule.perExemptionSteps[status][0].amount * count, status);
    assert.equal(rule.filersClaimed[status], count, status);
  }
  money(rule.perDependent, rule.perExemptionSteps.single[0].amount);
  // Married filing separately reads the SINGLE column, which is the detail that
  // is easy to get wrong because Maryland halves nothing else for that status.
  assert.deepEqual(rule.perExemptionSteps.marriedFilingSeparately, rule.perExemptionSteps.single);
  assert.deepEqual(rule.perExemptionSteps.headOfHousehold, rule.perExemptionSteps.marriedFilingJointly);
});

test('a qualifying surviving spouse gets one exemption on the joint chart', () => {
  // The joint rate schedule and the joint AGI thresholds, but there is no spouse
  // to claim an exemption for.
  const qss = md({ agi: 140_000, filingStatus: 'qualifyingSurvivingSpouse', county: 'Kent County' });
  const joint = md({ agi: 140_000, filingStatus: 'marriedFilingJointly', county: 'Kent County' });
  money(qss.exemptions, 3_200);
  money(joint.exemptions, 6_400);
  // Both are on the joint chart, so both keep the full $3,200 step at $140,000 —
  // where a single filer is already down to $800.
  money(md({ agi: 140_000, county: 'Kent County' }).exemptions, 800);
});

test('the capital gains surtax is a test, not a floor', () => {
  const at = (agi) =>
    md({ agi, deduction: 0, netCapitalGain: agi, county: 'Howard County', filerAge: 40 });
  assert.deepEqual(at(350_000).surtaxes, []);
  const above = at(350_001);
  money(above.surtaxes[0].amount, (350_001 - 3_350) * 0.02);
  money(above.surtaxes[0].amount, 6_933.02);
  // The largest single-dollar step in this package: larger than CalEITC's
  // $4,528.82 investment-income cliff and New Jersey's $1,381 retirement wall.
  money(at(350_000).marginalRate, 6_933.0775);
  assert.ok(at(350_000).marginalRate > 4_528.82);
});

test('the surtax reaches only the gain that got into taxable income', () => {
  // A filer whose deductions consumed part of the gain is not surtaxed on the
  // part that never reached the state's base — which is also what caps the cliff
  // above at 2% of the threshold rather than 2% of an unbounded gain.
  const r = md({ agi: 400_000, deduction: 0, netCapitalGain: 400_000, county: 'Howard County' });
  money(r.surtaxes[0].amount, r.taxableIncome * 0.02);
  const bigger = md({ agi: 1_050_000, deduction: 0, netCapitalGain: 1_000_000, county: 'Howard County' });
  money(bigger.surtaxes[0].amount, 20_000, 'well above the threshold it is simply 2%');
});

test('the surtax threshold is per return, so two spouses pay what two singles do not', () => {
  const each = 200_000;
  const single = () =>
    md({ agi: each, deduction: 0, netCapitalGain: 50_000, county: 'Howard County' });
  const couple = md({
    agi: each * 2,
    deduction: 0,
    filingStatus: 'marriedFilingJointly',
    netCapitalGain: 100_000,
    county: 'Howard County',
  });
  assert.deepEqual(single().surtaxes, []);
  money(couple.surtaxes[0].amount, 100_000 * 0.02);
  assert.equal(getStateDefinition('MD', 2025).capitalGainsSurtax.thresholdNotDoubledForJoint, true);
});

test('Maryland itemized deductions are gated on the federal election', () => {
  // The conformity story one level down: the OBBBA's larger federal standard
  // deduction took the Maryland itemized deduction away from filers whose
  // Maryland deductions never moved.
  const itemized = md({
    agi: 300_000,
    deduction: 50_000,
    deductionKind: 'itemized',
    stateItemizedDeductions: 40_000,
    county: 'Howard County',
  });
  const standard = md({
    agi: 300_000,
    deduction: 50_000,
    deductionKind: 'standard',
    stateItemizedDeductions: 40_000,
    county: 'Howard County',
  });
  // $40,000 less 7.5% of the $100,000 of AGI above $200,000.
  money(itemized.deduction, 32_500);
  money(standard.deduction, 3_350);
});

test('the itemized phase-out adds two thirds of a point to the marginal rate', () => {
  const r = md({
    agi: 300_000,
    deduction: 50_000,
    deductionKind: 'itemized',
    stateItemizedDeductions: 40_000,
    county: 'Howard County',
  });
  // 5.75% state and 3.20% county, each charged on 1.075 dollars of income for
  // every dollar earned.
  money(r.marginalRate, 0.0575 * 1.075);
  money(r.totalMarginalRate, (0.0575 + 0.032) * 1.075);
  money(r.totalMarginalRate - (0.0575 + 0.032), 0.0067125);
});

test('the itemized phase-out stops where the deduction meets the standard one', () => {
  // The band is (itemized - standard) / 0.075 dollars wide, which for $40,000 of
  // deductions is $488,666.67 — so it ends at $688,666.67 of AGI and not before.
  const deduction = (agi) =>
    md({
      agi,
      deduction: 60_000,
      deductionKind: 'itemized',
      stateItemizedDeductions: 40_000,
      county: 'Howard County',
    }).deduction;
  const end = 200_000 + (40_000 - 3_350) / 0.075;
  const justInside = Math.floor(end) - 1;
  money(deduction(justInside), 40_000 - 0.075 * (justInside - 200_000) + 0.005, 'just inside the band');
  assert.ok(deduction(justInside) > 3_350);
  money(deduction(Math.ceil(end) + 1_000), 3_350, 'past it the standard deduction takes over');
  // Married filing separately gets half the threshold, and a joint return gets
  // the same $200,000 as a single filer — a marriage penalty in a limitation.
  const rule = getStateDefinition('MD', 2025).itemizedDeduction;
  assert.equal(rule.phaseOutThreshold.marriedFilingJointly, rule.phaseOutThreshold.single);
  assert.equal(rule.phaseOutThreshold.marriedFilingSeparately, 100_000);
});

test('the two published earned income credits are one credit with a floor', () => {
  // 50% capped at the tax, and 45% paid where the cap bit. So the EFFECTIVE match
  // rises from 45% to 50% of the federal credit as the filer's tax rises — the
  // opposite of a phase-out — and adding the two published rates to get 95% is
  // wrong by most of the state tax.
  const run = (agi) =>
    md({
      agi,
      deduction: 0,
      filingStatus: 'marriedFilingJointly',
      dependents: 2,
      earnedIncomeCredit: 4_000,
      county: 'Worcester County',
    });
  // What the credit was actually worth: the state tax without it, less the state
  // tax with it. A refund counts, which is the whole point of the refundable half.
  const effectiveMatch = (agi) => (run(agi).taxBeforeCredits - run(agi).tax) / 4_000;

  money(effectiveMatch(9_000), 0.45, 'a filer with no tax keeps 45%');
  money(effectiveMatch(120_000), 0.5, 'a filer with enough tax keeps 50%');
  const middle = effectiveMatch(60_000);
  assert.ok(middle > 0.45 && middle < 0.5, `in between it is the tax itself: ${middle}`);
  const points = [9_000, 30_000, 50_000, 60_000, 70_000, 120_000].map(effectiveMatch);
  for (let i = 1; i < points.length; i += 1) {
    assert.ok(points[i] >= points[i - 1] - 1e-9, `match fell at point ${i}: ${points}`);
  }
  // And the two halves never overlap: where one pays, the other is zero.
  const rich = run(120_000);
  money(rich.credits.find((c) => c.name.endsWith('(refundable half)')).amount, 0);
  money(rich.credits.find((c) => c.name === 'Maryland earned income credit').amount, 2_000);
});

test('an unmarried childless filer is matched at 100% and paid in full', () => {
  // The largest state match of the federal childless credit in the country, and
  // the tax does not cap it: the refundable half pays whatever the non-refundable
  // half could not.
  const r = md({ agi: 12_000, deduction: 0, earnedIncomeCredit: 600, county: 'Talbot County' });
  const eitc = r.credits.filter((c) => c.name.includes('earned income'));
  money(eitc[0].amount, 600, 'the match is the whole federal credit');
  cent(eitc[1].amount, Math.max(0, 600 - r.taxBeforeCredits), 'and the rest is refunded');
  money(r.taxBeforeCredits - r.tax, 600, 'so the filer keeps all of it');
  // One dependent turns the same filer into the 50% schedule.
  const withChild = md({
    agi: 12_000,
    deduction: 0,
    dependents: 1,
    earnedIncomeCredit: 600,
    county: 'Talbot County',
  });
  money(withChild.credits.find((c) => c.name === 'Maryland earned income credit').amount, 300);
  money(withChild.taxBeforeCredits - withChild.tax, 270, 'and the 45% floor under it');
});

test('the local earned income credit is ten times the county rate', () => {
  // Twenty-four counties, twenty-four different earned income credits, and not
  // one credit parameter anywhere in the county table.
  assert.equal(MD_LOCAL_EITC_RATE_MULTIPLE, 10);
  const run = (county) =>
    md({
      agi: 70_000,
      deduction: 0,
      filingStatus: 'marriedFilingJointly',
      dependents: 2,
      earnedIncomeCredit: 3_000,
      county,
    });
  const credit = (r) => localOf(r).credits.find((c) => c.name === 'Local earned income credit').amount;
  money(credit(run('Worcester County')), 10 * 0.0225 * 3_000);
  money(credit(run('Dorchester County')), 10 * 0.033 * 3_000);
  // Anne Arundel uses its lowest marginal rate; Frederick uses the rate its
  // bracket selects. Both readings follow PolicyEngine-US, and the difference the
  // second one makes is exactly the five percentage points the locality's note
  // bounds it at — $825 here against the $675 the lowest-rate reading would pay.
  money(credit(run('Anne Arundel County')), 10 * 0.027 * 3_000);
  money(credit(run('Frederick County')), 10 * 0.0275 * 3_000);
  money(credit(run('Frederick County')) - 10 * 0.0225 * 3_000, 0.05 * 3_000);
  // It is capped at the county tax: § 10-704(d) never pays a county credit larger
  // than the county charged.
  const poor = md({
    agi: 40_000,
    deduction: 0,
    filingStatus: 'marriedFilingJointly',
    dependents: 2,
    earnedIncomeCredit: 3_000,
    county: 'Worcester County',
  });
  money(credit(poor), localOf(poor).taxBeforeCredits);
  money(localOf(poor).tax, 0, 'so a county tax can be wiped out but never reversed');
});

test('the senior tax credit is a cliff on federal AGI', () => {
  const at = (agi) => md({ agi, filerAge: 70, county: 'Talbot County' });
  const named = (r) => r.credits.find((c) => c.name === 'Senior tax credit').amount;
  money(named(at(100_000)), 1_000);
  money(named(at(100_001)), 0);
  // A joint return with two qualifying spouses gets $1,750 and a $150,000 limit.
  const couple = (agi) =>
    md({
      agi,
      deduction: 6_700,
      filingStatus: 'marriedFilingJointly',
      filerAge: 70,
      spouseAge: 68,
      county: 'Talbot County',
    });
  money(named(couple(150_000)), 1_750);
  money(named(couple(150_001)), 0);
  // One spouse over 65 is worth $1,000, not $1,750.
  const one = md({
    agi: 150_000,
    deduction: 6_700,
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 60,
    county: 'Talbot County',
  });
  money(named(one), 1_000);
});

test('the child credit ceiling is right for one child and wrong for two', () => {
  // $500 per child under 6, less $50 for each $1,000 of AGI over $15,000 — on the
  // RETURN, not per child. So the published $24,001 ceiling holds only for a
  // one-child family.
  const family = (agi, children) =>
    md({
      agi,
      deduction: 0,
      filingStatus: 'marriedFilingJointly',
      dependentAges: Array(children).fill(3),
      county: 'Worcester County',
    });
  const credit = (r) => r.credits.find((c) => c.name === 'Maryland child tax credit').amount;
  money(credit(family(15_000, 1)), 500);
  money(credit(family(24_000, 1)), 50, 'one increment left at the published ceiling');
  money(credit(family(24_001, 1)), 0);
  money(credit(family(24_001, 2)), 500);
  money(credit(family(34_001, 2)), 0, 'two children reach zero $10,000 later');
  money(credit(family(44_001, 3)), 0);
  assert.ok(credit(family(44_000, 3)) > 0);
  // A dependent aged 6 is worth nothing, which is why ages rather than a count.
  const older = md({
    agi: 15_000,
    deduction: 0,
    filingStatus: 'marriedFilingJointly',
    dependentAges: [6],
    county: 'Worcester County',
  });
  money(credit(older), 0);
});

test('a dependent aged 65 or over doubles the dependent exemption', () => {
  const parent = md({ agi: 80_000, dependentAges: [70], county: 'Garrett County' });
  const child = md({ agi: 80_000, dependentAges: [7], county: 'Garrett County' });
  money(child.exemptions, 3_200 * 2);
  money(parent.exemptions, 3_200 * 2 + 3_200);
  // The filer's own age and blindness are worth $1,000 each and are NOT stepped
  // down by income the way the $3,200 exemptions are.
  const old = md({ agi: 200_000, filerAge: 70, blindOrDisabled: 1, county: 'Garrett County' });
  money(old.exemptions, 1_000 + 1_000);
});

test('every county rate sits inside the band the statute allows', () => {
  // A typo'd rate is otherwise indistinguishable from a rate change, and this is
  // the cheapest check that catches one.
  const rates = [];
  for (const year of [2025, 2026]) {
    for (const def of marylandCounties(year)) {
      const kinds = def.rate.kind === 'flat' ? [def.rate.rate] : Object.values(def.rate.byStatus).flat().map((b) => b.rate);
      for (const rate of kinds) {
        assert.ok(
          rate >= MD_COUNTY_RATE_FLOOR - 1e-12 && rate <= MD_COUNTY_RATE_CEILING + 1e-12,
          `${def.code} ${year} rate ${rate} is outside [${MD_COUNTY_RATE_FLOOR}, ${MD_COUNTY_RATE_CEILING}]`,
        );
        rates.push(rate);
      }
    }
  }
  // The special nonresident tax rate is not stored: § 10-106.1 sets it to the
  // lowest county rate in the state, and this is that figure.
  money(Math.min(...rates), 0.0225);
  money(Math.min(...rates), MD_COUNTY_RATE_FLOOR);
  assert.equal(MARYLAND_COUNTIES.length, 24);
  assert.equal(marylandCounties(2025).length, 24);
});

test('county names are matched loosely, except where the answer would differ', () => {
  for (const name of ['Montgomery', 'montgomery county', 'MONTGOMERY COUNTY', ' Montgomery Co. ']) {
    assert.equal(marylandCounty(name, 2025).code, 'Montgomery County', name);
  }
  assert.equal(marylandCounty("prince georges", 2025).code, "Prince George's County");
  assert.equal(marylandCounty('st marys', 2025).code, "St. Mary's County");
  // Baltimore City and Baltimore County are different jurisdictions. A bare
  // "Baltimore" is an error rather than a guess.
  assert.throws(() => marylandCounty('Baltimore', 2025), /ambiguous/);
  assert.equal(marylandCounty('Baltimore City', 2025).code, 'Baltimore City');
  assert.equal(marylandCounty('Baltimore County', 2025).code, 'Baltimore County');
  // An unknown name lists the twenty-four rather than returning zero.
  assert.throws(() => marylandCounty('Fairfax County', 2025), /not a Maryland taxing jurisdiction/);
  assert.throws(() => marylandCounty('Fairfax County', 2025), /Worcester County/);
  assert.throws(() => marylandCounty('Montgomery', 2024), /2025 and 2026/);
});

test('a county on a return that is not Maryland is an error', () => {
  assert.throws(
    () => stateIncomeTax({ state: 'NY', year: 2025, filingStatus: 'single', federal: federal(80_000), county: 'Montgomery County' }),
    /county applies to a Maryland return/,
  );
  // And the locality codes say where the counties went.
  assert.throws(
    () => stateIncomeTax({ state: 'MD', year: 2025, filingStatus: 'single', federal: federal(80_000), locality: 'NYC' }),
    /NYC is in NY, not MD/,
  );
});

test('two counties changed for 2026 and the state schedule did not', () => {
  const rate = (county, year) => marylandCounty(county, year).rate.rate;
  money(rate('Allegany County', 2025), 0.0303);
  money(rate('Allegany County', 2026), 0.032);
  money(rate('Kent County', 2025), 0.032);
  money(rate('Kent County', 2026), 0.033);
  money(rate('Montgomery County', 2026), 0.032);
  // Every threshold in § 10-105 is a fixed dollar figure, so 2026 is 2025 as a
  // matter of law rather than as a carry-forward.
  assert.deepEqual(
    getStateDefinition('MD', 2026).rate.byStatus.single,
    getStateDefinition('MD', 2025).rate.byStatus.single,
  );
  // The one 2026 figure that is indexed, and the reason the year is provisional.
  assert.equal(getStateDefinition('MD', 2026).status, 'provisional');
  assert.ok(getStateDefinition('MD', 2026).notes[0].startsWith('PROVISIONAL:'));
  assert.ok(getStateDefinition('MD', 2026).notes[0].includes('standard deduction'));
  assert.equal(getStateDefinition('MD', 2025).status, 'published');
});

test('the 2025 brackets go to 6.5%, and the joint column is not doubled below', () => {
  const single = getStateDefinition('MD', 2025).rate.byStatus.single;
  const joint = getStateDefinition('MD', 2025).rate.byStatus.marriedFilingJointly;
  assert.deepEqual(single.map((b) => b.rate), joint.map((b) => b.rate));
  assert.equal(single[single.length - 1].rate, 0.065);
  // The 4.75% band ends at $100,000 single and $150,000 joint — one and a half
  // times, not twice — and married filing separately reads the single column.
  assert.equal(single[3].upTo, 100_000);
  assert.equal(joint[3].upTo, 150_000);
  assert.deepEqual(
    getStateDefinition('MD', 2025).rate.byStatus.marriedFilingSeparately,
    single,
  );
});
