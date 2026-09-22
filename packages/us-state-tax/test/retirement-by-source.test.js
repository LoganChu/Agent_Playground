// Illinois, Mississippi, Michigan, New York — and North Carolina, which is here
// because it is the one of the five that turned out not to belong.
//
// All four of the first group say, in one form or another, that they do not tax
// retirement income. Until v0.19.0 this package said so too — in a NOTE, which
// told the caller to pass the pension through `subtractions` and then taxed it
// if they did not. The differential run of Day 23 measured what that was worth
// and called the class CALLER-SUPPLIED; this file is what closed it.
//
// The interesting part is that the four states agree on the headline and on
// nothing else, and every disagreement is worth money to a real household:
//
//   Illinois     no cap, NO AGE TEST — a 40-year-old's pension is exempt
//   Mississippi  no cap, but 59½, because an early distribution is taxable
//   Michigan     one cap FOR THE RETURN, keyed to the OLDER spouse, phased in
//   New York     $20,000 PER PERSON with unused room lost — and a government
//                pension exempt in full, at any age, over and above it
//
// North Carolina is in the same sentence in every summary of "states that are
// good to retirees" and taxes a pension in full at 3.99%. The test that says so
// is at the bottom, and it is the most useful one in the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/**
 * A return with `agi` of federal AGI, of which `retirement` is the split.
 *
 * `taxableSocialSecurity` is left at zero throughout so that every figure below
 * is about the pension rule and nothing else. The states here all exempt the
 * benefit as well, and `social-security.test.js` is where that is pinned.
 */
const run = (state, agi, opts = {}) =>
  stateIncomeTax({
    state,
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { adjustedGrossIncome: agi },
    ...opts,
  });

const subtracted = (result, fragment) =>
  result.computedSubtractions
    .filter((s) => s.name.toLowerCase().includes(fragment.toLowerCase()))
    .reduce((sum, s) => sum + s.amount, 0);

// ---------------------------------------------------------------------------
// Illinois — the largest exemption of retirement income in the country, and the
// only one with no age test at any point
// ---------------------------------------------------------------------------

test('Illinois exempts a pension in full, and does not ask how old you are', () => {
  for (const age of [40, 58, 67, 90]) {
    const result = run('IL', 200_000, {
      filerAge: age,
      retirement: { filer: { employerPlanPension: 200_000 } },
    });
    money(subtracted(result, 'Illinois retirement'), 200_000, `age ${age}`);
    money(result.tax, 0, `Illinois tax at age ${age}`);
  }
});

test('Illinois counts an IRA distribution and a government pension alike', () => {
  const result = run('IL', 120_000, {
    filerAge: 66,
    retirement: {
      filer: { employerPlanPension: 40_000, iraDistributions: 40_000, governmentPension: 40_000 },
    },
  });
  money(subtracted(result, 'Illinois retirement'), 120_000);
});

// The comparison that every "states that don't tax retirement income" table
// hides. Both states exempt the whole pension at 67; only one of them does at
// 52, and it is the difference between retiring early in Illinois and retiring
// early in Mississippi.
test('at 52 Illinois exempts everything and Mississippi exempts nothing', () => {
  const early = { filerAge: 52, retirement: { filer: { employerPlanPension: 80_000 } } };
  money(run('IL', 80_000, early).tax, 0, 'Illinois at 52');
  assert.ok(run('MS', 80_000, early).tax > 2_000, 'Mississippi at 52 is a full bill');

  const later = { filerAge: 67, retirement: { filer: { employerPlanPension: 80_000 } } };
  money(run('IL', 80_000, later).tax, 0, 'Illinois at 67');
  money(run('MS', 80_000, later).tax, 0, 'Mississippi at 67');
});

// ---------------------------------------------------------------------------
// Mississippi — uncapped, and gated on retirement age
// ---------------------------------------------------------------------------

test('Mississippi exempts qualified retirement income in full at 60', () => {
  const result = run('MS', 90_000, {
    filerAge: 60,
    retirement: { filer: { employerPlanPension: 50_000, iraDistributions: 40_000 } },
  });
  money(subtracted(result, 'Mississippi retirement'), 90_000);
  money(result.tax, 0);
});

test('Mississippi applies the age test per person, not per return', () => {
  // One spouse 65, one 55. Only the older one's pension comes out.
  const result = run('MS', 100_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 65,
    spouseAge: 55,
    retirement: {
      filer: { employerPlanPension: 50_000 },
      spouse: { employerPlanPension: 50_000 },
    },
  });
  money(subtracted(result, 'Mississippi retirement'), 50_000);
});

// ---------------------------------------------------------------------------
// Michigan — one cap for the return, keyed to the older spouse, phased in
// ---------------------------------------------------------------------------

test('the Michigan cap is the published tier one amount in both years', () => {
  const rules = (year) => getStateDefinition('MI', year).retirementIncomeSubtractions;
  assert.equal(rules(2025)[0].cap.single, 65_897);
  assert.equal(rules(2025)[0].cap.marriedFilingJointly, 131_794);
  assert.equal(rules(2026)[0].cap.single, 67_610);
  assert.equal(rules(2026)[0].cap.marriedFilingJointly, 135_220);
  // A surviving spouse takes the single amount: MCL 206.30(1)(f) sets the larger
  // figure for a joint return and there is one person on this one.
  assert.equal(rules(2026)[0].cap.qualifyingSurvivingSpouse, 67_610);
});

test('Michigan is 75% of the cap in 2025 and the whole of it in 2026', () => {
  const household = {
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 150_000 } },
  };
  money(subtracted(run('MI', 150_000, { ...household, year: 2025 }), 'Michigan'), 65_897 * 0.75);
  money(subtracted(run('MI', 150_000, { ...household, year: 2026 }), 'Michigan'), 67_610);
});

// The axis that separates Michigan from New York, and it runs the other way
// from every other per-person retirement rule in this package.
test('Michigan qualifies the whole return on the OLDER spouse, and shares one cap', () => {
  const result = run('MI', 200_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 58,
    spouseAge: 66,
    year: 2025,
    retirement: {
      // Every dollar of it belongs to the 58-year-old, who would qualify for
      // nothing on their own.
      filer: { employerPlanPension: 200_000 },
    },
  });
  money(subtracted(result, 'Michigan'), 131_794 * 0.75);
});

test('in 2025 Michigan asks a birth year, so a 58-year-old alone gets nothing', () => {
  const result = run('MI', 100_000, {
    filerAge: 58,
    year: 2025,
    retirement: { filer: { employerPlanPension: 100_000 } },
  });
  money(subtracted(result, 'Michigan'), 0);
});

test('from 2026 the Michigan phase-in is over and the age test is gone', () => {
  const result = run('MI', 100_000, {
    filerAge: 45,
    year: 2026,
    retirement: { filer: { employerPlanPension: 100_000 } },
  });
  money(subtracted(result, 'Michigan'), 67_610);
});

// Form 4884 Worksheet 3.3: line 3 takes military pay off the cap and line 4
// applies the phase-in percentage to what is LEFT. Scaling first and subtracting
// after would give a military retiree a larger deduction than the form does —
// and only them, which is exactly the error a grid of households with no veteran
// in it never finds.
test('Michigan military pay is exempt in full AND comes off the shared cap', () => {
  const mixed = run('MI', 200_000, {
    filerAge: 70,
    year: 2025,
    retirement: { filer: { militaryRetirement: 30_000, employerPlanPension: 170_000 } },
  });
  money(subtracted(mixed, 'Michigan'), 30_000 + (65_897 - 30_000) * 0.75);

  // All of it military: exempt in full, cap or no cap.
  const allMilitary = run('MI', 200_000, {
    filerAge: 70,
    year: 2026,
    retirement: { filer: { militaryRetirement: 200_000 } },
  });
  money(subtracted(allMilitary, 'Michigan'), 200_000);
  money(allMilitary.tax, 0);
});

test('a taxpayer born before 1946 takes tier one, and public pay is outside the cap', () => {
  const result = run('MI', 300_000, {
    filerAge: 85,
    year: 2026,
    retirement: { filer: { governmentPension: 200_000, employerPlanPension: 100_000 } },
  });
  // The whole public pension, plus the cap against the private one.
  money(subtracted(result, 'born before 1946'), 200_000 + 67_610);
});

// ---------------------------------------------------------------------------
// New York — $20,000 per person, unused room lost, government pay exempt in full
// ---------------------------------------------------------------------------

test('New York excludes $20,000 per person and loses the unused room', () => {
  const shared = {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
  };
  const even = run('NY', 90_000, {
    ...shared,
    retirement: {
      filer: { employerPlanPension: 20_000 },
      spouse: { employerPlanPension: 20_000 },
    },
  });
  const concentrated = run('NY', 90_000, {
    ...shared,
    retirement: { filer: { employerPlanPension: 40_000 } },
  });
  money(subtracted(even, 'New York pension'), 40_000, 'split evenly');
  money(subtracted(concentrated, 'New York pension'), 20_000, 'one plan');
  // Identical income, identical ages, $1,080 apart — decided by whose name is on
  // the plan, which no ranking of state retirement taxes can show.
  money(concentrated.tax - even.tax, 1_080);
});

test('a New York government pension is exempt in full, over and above the $20,000', () => {
  const result = run('NY', 110_000, {
    filerAge: 70,
    retirement: { filer: { governmentPension: 90_000, employerPlanPension: 20_000 } },
  });
  money(subtracted(result, 'New York pension'), 110_000);
  money(result.tax, 0);
});

// The retired police officer, and the reason `cappedMinimumAge` exists at all.
test('New York exempts a government pension at 45 and gives nothing else until 59½', () => {
  const officer = run('NY', 70_000, {
    filerAge: 45,
    retirement: { filer: { governmentPension: 70_000 } },
  });
  money(subtracted(officer, 'New York pension'), 70_000);
  money(officer.tax, 0);

  const privateSector = run('NY', 70_000, {
    filerAge: 45,
    retirement: { filer: { employerPlanPension: 70_000 } },
  });
  money(subtracted(privateSector, 'New York pension'), 0);
  assert.ok(privateSector.tax > 2_500);
});

test('New York military retired pay is federal service and is exempt in full', () => {
  const result = run('NY', 60_000, {
    filerAge: 55,
    retirement: { filer: { militaryRetirement: 60_000 } },
  });
  money(subtracted(result, 'New York pension'), 60_000);
});

// ---------------------------------------------------------------------------
// North Carolina — the state that does not belong in the list
// ---------------------------------------------------------------------------

test('North Carolina taxes a pension in full, and this is deliberate', () => {
  const pension = run('NC', 55_000, {
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 55_000 } },
  });
  // 3.99% of (55,000 - 12,750) in 2026. Nothing is subtracted.
  money(pension.tax, Math.round((55_000 - 12_750) * 0.0399 * 100) / 100);
  money(subtracted(pension, 'military'), 0);
});

test('North Carolina military retired pay is deducted in full, at any age', () => {
  for (const age of [45, 70]) {
    const result = run('NC', 55_000, {
      filerAge: age,
      retirement: { filer: { militaryRetirement: 55_000 } },
    });
    money(subtracted(result, 'military'), 55_000, `age ${age}`);
    money(result.tax, 0, `age ${age}`);
  }
});

// The number that makes the preference legible: against a state that taxes every
// other pension in full, a military pension is worth more in North Carolina than
// anywhere else in this package.
test('the North Carolina military deduction is worth the whole bill', () => {
  const civilian = run('NC', 55_000, {
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 55_000 } },
  });
  const veteran = run('NC', 55_000, {
    filerAge: 70,
    retirement: { filer: { militaryRetirement: 55_000 } },
  });
  money(civilian.tax - veteran.tax, 1_685.78);
});

// ---------------------------------------------------------------------------
// The fallback, and the thing a caller has to be told
// ---------------------------------------------------------------------------

test('a caller who passes only `retirementIncome` gets the subtraction too', () => {
  const result = run('IL', 90_000, { filerAge: 70, retirementIncome: 90_000 });
  money(subtracted(result, 'Illinois retirement'), 90_000);
});

// Where the answer depends on who received what, a caller who supplied a total
// is told which assumption was used — because the assumption is the expensive
// one, and silently taking it is what this whole file is a correction of.
test('a New York total without a split says so in the subtraction name', () => {
  const result = run('NY', 40_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    retirementIncome: 40_000,
  });
  money(subtracted(result, 'New York pension'), 20_000);
  const name = result.computedSubtractions.find((s) => s.name.includes('New York pension')).name;
  assert.match(name, /assumed/);
});

test('Illinois has no such caveat, because nothing about it depends on the split', () => {
  const result = run('IL', 40_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    retirementIncome: 40_000,
  });
  const name = result.computedSubtractions.find((s) => s.name.includes('Illinois')).name;
  assert.doesNotMatch(name, /assumed/);
});

// ---------------------------------------------------------------------------
// The figures the README prints, and the Illinois child tax credit
// ---------------------------------------------------------------------------

// A README claim is a claim, and this file is where the four in the v0.19.0
// notice are checked. The household is the site's: a couple both 70, $60,000 of
// pension and $40,000 of Social Security, of which $34,000 is federally taxable.
const RETIRED_COUPLE = {
  filingStatus: 'marriedFilingJointly',
  filerAge: 70,
  spouseAge: 70,
  taxableSocialSecurity: 34_000,
};
const EVEN_SPLIT = {
  filer: { employerPlanPension: 30_000, socialSecurityBenefits: 20_000 },
  spouse: { employerPlanPension: 30_000, socialSecurityBenefits: 20_000 },
};

test('the four corrections are worth what the README says they are', () => {
  const before = (state) => run(state, 94_000, RETIRED_COUPLE).tax;
  const after = (state) => run(state, 94_000, { ...RETIRED_COUPLE, retirement: EVEN_SPLIT }).tax;

  // Before: the caller supplied a `retirement` split with nothing in it, which
  // is what every caller who did not read the note was doing.
  // Illinois's README figure is $2,588.85 and this engine now says $2,581.43
  // for the same household, and BOTH are right about their own version — the
  // same story as Mississippi below, for a different reason. v0.19.0 computed
  // $2,588.85 against the $2,850 exemption allowance of 2025, which this
  // package carried into 2026 and flagged provisional; Illinois has since
  // published $2,925, so two exemptions are $150 larger and the tax $7.42
  // smaller. Recomputing a historical claim with today's parameters does not
  // pin history, it produces today's answer wearing a date.
  money(before('IL'), 2_581.43, 'Illinois before, as this engine computes it');
  money(2_588.85 - 2_581.43, 2 * 75 * 0.0495, 'and the difference is the indexation of two exemptions');
  // And Michigan is the same story a THIRD time, on Day 28. The README's figure
  // for this household was $2,057.00 against the $5,800 personal exemption of
  // 2025, which this package carried into 2026 and flagged provisional;
  // Michigan's 2026 withholding guide publishes $5,900, so two exemptions are
  // $200 larger and the tax $8.50 smaller. Three states, three releases, one
  // rule: a test that recomputes a historical claim with today's parameters
  // produces today's answer wearing a date.
  money(before('MI'), 2_048.5, 'Michigan before, as this engine computes it');
  money(2_057.0 - 2_048.5, 2 * 100 * 0.0425, 'and the difference is the indexation of two exemptions');
  money(before('NY'), 2_040.8, 'New York before');

  // Mississippi's README figure is $1,336.00 and this engine now says
  // $1,216.00 for the same household, and BOTH are right about their own
  // version. v0.18.0 charged $1,336.00 because it was missing two things at
  // once: the retirement subtraction this test is about, and Mississippi's
  // $1,500 aged exemption for each filer at 65 (§ 27-7-21(f)), which v0.23.0
  // added. The gap is exactly those two exemptions at the 2026 rate.
  money(before('MS'), 1_216.0, 'Mississippi before, as this engine computes it');
  money(1_336 - 1_216, 3_000 * 0.04, 'and the difference is the two aged exemptions at 4.0%');

  money(after('IL'), 0, 'Illinois after');
  money(after('MI'), 0, 'Michigan after');
  money(after('MS'), 0, 'Mississippi after');
  // New York's is capped, so it is the only one of the four that still charges
  // something — and the only one whose answer depends on the split.
  money(after('NY'), 79.05, 'New York after');
});

test('the Illinois child tax credit is 40% of the Illinois earned income credit', () => {
  const family = {
    filingStatus: 'headOfHousehold',
    filerAge: 35,
    dependents: 2,
    dependentAges: [8, 10],
    earnedIncome: 30_000,
  };
  const result = run('IL', 30_000, { ...family, federal: { adjustedGrossIncome: 30_000, earnedIncomeCredit: 5_000 } });
  const eic = result.credits.find((c) => c.name === 'Illinois earned income credit');
  const ctc = result.credits.find((c) => c.name === 'Illinois child tax credit');
  money(eic.amount, 1_000, 'the Illinois earned income credit is 20% of the federal one');
  money(ctc.amount, 400, 'and the child credit is 40% of that');
  assert.equal(ctc.refundable, true);
});

test('one child and four children are worth the same, and a 12-year-old nothing', () => {
  const base = {
    filingStatus: 'headOfHousehold',
    filerAge: 35,
    earnedIncome: 30_000,
    federal: { adjustedGrossIncome: 30_000, earnedIncomeCredit: 5_000 },
  };
  const credit = (ages) =>
    run('IL', 30_000, { ...base, dependents: ages.length, dependentAges: ages }).credits.find(
      (c) => c.name === 'Illinois child tax credit',
    ).amount;
  // The child is a switch, not a multiplier — the amount is a percentage of the
  // earned income credit, and the family does not enter it.
  money(credit([3]), 400, 'one child');
  money(credit([3, 5, 8, 10]), 400, 'four children');
  // Under 12, and the boundary is where a count cannot help: $400 and nothing.
  money(credit([11]), 400, 'eleven');
  money(credit([12]), 0, 'twelve');
});

test('Illinois adds $1,000 of exemption at 65, and it has not been indexed since 2004', () => {
  const single = (age) => run('IL', 60_000, { filerAge: age }).tax;
  // $2,850 + $1,000, against $2,850 alone: $49.50 of tax.
  money(single(64) - single(65), 49.5);
  const rule = getStateDefinition('IL', 2026).exemption;
  assert.equal(rule.perSeniorFiler, 1_000);
  assert.equal(rule.perBlindOrDisabledFiler, 1_000);
});

// ---------------------------------------------------------------------------
// The addition that runs the other way
// ---------------------------------------------------------------------------

// Every other difference this project has found against an independent model had
// it charging TOO MUCH. This is the first one the other way, and it only became
// visible the moment the Illinois retirement subtraction took a retiree's base to
// zero: until then something else was always left to be wrong about.
test('Illinois taxes another state’s municipal bonds, and its own not at all', () => {
  const retiree = {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 34_000,
    retirement: EVEN_SPLIT,
  };
  // The whole pension and the whole benefit come out, so the base is nothing but
  // the bond interest — income that reached no line of the federal return.
  const own = run('IL', 94_000, retiree);
  money(own.tax, 0, 'Illinois bonds, or none at all');

  const elsewhere = run('IL', 94_000, { ...retiree, outOfStateMunicipalInterest: 10_000 });
  // $10,000, less two $2,925 exemptions and two $1,000 senior exemptions.
  // The $2,925 is Illinois's published 2026 allowance; it was $2,850 here until
  // v0.25.0, carried forward from 2025 and flagged provisional.
  money(elsewhere.tax, (10_000 - 2 * 2_925 - 2 * 1_000) * 0.0495);
  const addition = elsewhere.addBacks.find((a) => a.name.includes('municipal'));
  money(addition.amount, 10_000);
});

test('`taxExemptInterest` is not the figure, and is not read as one', () => {
  // Taking the total would tax an Illinois resident on Illinois bonds, which
  // Illinois exempts by name. The two fields are asked for separately because
  // the split exists on no federal form.
  const withTotal = run('IL', 60_000, { filerAge: 70, taxExemptInterest: 10_000 });
  const without = run('IL', 60_000, { filerAge: 70 });
  money(withTotal.tax, without.tax);
});

test('no other state reads it, because this package will not assert a list of 28', () => {
  for (const state of ['MI', 'MS', 'NC', 'NY', 'GA', 'KY']) {
    const plain = run(state, 60_000, { filerAge: 70 });
    const bonds = run(state, 60_000, { filerAge: 70, outOfStateMunicipalInterest: 10_000 });
    money(bonds.tax, plain.tax, `${state} should ignore it until it is verified`);
  }
});
