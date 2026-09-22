// Kentucky's pension income exclusion — KRS 141.019(1), Schedule P.
//
// This is the third construction of the same idea in this package and it is
// built on a third axis. Georgia's exclusion asks what CHARACTER the income has.
// Maryland's asks what FORM OF ACCOUNT it came out of. Kentucky's asks who the
// employer was and WHEN THE SERVICE WAS PERFORMED — a fact about the retiree's
// working life rather than their portfolio, and the only one of the three that
// no decision taken after retirement can change.
//
// Two things fall out of that and neither is on any table of state pension
// exclusions. The $31,110 is not Kentucky's maximum: pre-1998 government service
// is exempt in full, with no ceiling, AND does not consume the $31,110. And
// there is no age test at all, so of the three states Kentucky has the smallest
// headline figure and is the only one an early retiree can use.
//
// The last group of tests is the three-way comparison, because the ranking of
// the three states reverses at 65 and neither end of it is guessable from the
// published numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const ky = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'KY',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { adjustedGrossIncome: agi },
    ...opts,
  });

const excluded = (result, fragment = 'pension income exclusion') =>
  result.computedSubtractions
    .filter((s) => s.name.toLowerCase().includes(fragment))
    .reduce((sum, s) => sum + s.amount, 0);

// 2026: 3.5% flat (HB 1 of 2025), $3,360 standard deduction — KRS 141.081,
// indexed, and announced by the Department of Revenue for 2026. This package
// carried $3,270 forward until Day 28, which cost every Kentucky filer $3.15.
const RATE_2026 = 0.035;
const DEDUCTION = 3_360;
/** What a rate table gives you: the rate on AGI less the standard deduction. */
const rateTable = (agi) => Math.max(0, agi - DEDUCTION) * RATE_2026;

// ---------------------------------------------------------------------------
// The parameters
// ---------------------------------------------------------------------------

test('the cap is $31,110 and the uncapped cutoff is 1998, in both years', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('KY', year).pensionIncomeExclusion;
    assert.equal(rule.cap, 31_110);
    assert.equal(rule.uncappedServiceBefore, 1998);
  }
});

test('Kentucky subtracts taxable Social Security as a matter of course', () => {
  for (const year of [2025, 2026]) {
    assert.equal(getStateDefinition('KY', year).subtractsTaxableSocialSecurity, true);
  }
});

// ---------------------------------------------------------------------------
// The cap, and the absence of an age test
// ---------------------------------------------------------------------------

test('the exclusion is capped at $31,110 for a private pension', () => {
  const r = ky(55_000, { retirement: { filer: { employerPlanPension: 55_000 } } });
  money(excluded(r), 31_110);
  money(r.totalTax, (55_000 - 31_110 - DEDUCTION) * RATE_2026);
});

test('IRA and 401(k) distributions are in the same pool as a pension', () => {
  // Kentucky asks nothing about the form of the account, so the rollover that
  // costs a Maryland retiree $3,428.03 a year costs a Kentuckian nothing.
  const inPlan = ky(60_000, { retirement: { filer: { employerPlanPension: 60_000 } } });
  const rolled = ky(60_000, { retirement: { filer: { iraDistributions: 60_000 } } });
  money(excluded(inPlan), 31_110);
  money(excluded(rolled), 31_110);
  money(rolled.totalTax, inPlan.totalTax, 'the rollover is free in Kentucky');
});

test('there is NO age test — a 45-year-old excludes the same $31,110 as a 75-year-old', () => {
  const young = ky(50_000, { filerAge: 45, retirement: { filer: { employerPlanPension: 50_000 } } });
  const old = ky(50_000, { filerAge: 75, retirement: { filer: { employerPlanPension: 50_000 } } });
  money(excluded(young), 31_110);
  money(young.totalTax, old.totalTax);
  // And it holds with no age supplied at all, which is the commonest call.
  const ageless = ky(50_000, { retirement: { filer: { employerPlanPension: 50_000 } } });
  money(ageless.totalTax, old.totalTax);
});

test('the exclusion is per person, so a couple has $62,220', () => {
  const split = ky(62_220, {
    filingStatus: 'marriedFilingJointly',
    retirement: {
      filer: { employerPlanPension: 31_110 },
      spouse: { employerPlanPension: 31_110 },
    },
  });
  money(excluded(split), 62_220);
  money(split.totalTax, 0);

  // The same household total on one name reaches only one cap. Kentucky is the
  // third state here whose tax depends on whose name the income is in.
  const concentrated = ky(62_220, {
    filingStatus: 'marriedFilingJointly',
    retirement: { filer: { employerPlanPension: 62_220 } },
  });
  money(excluded(concentrated), 31_110);
  money(concentrated.totalTax, (62_220 - 31_110 - DEDUCTION) * RATE_2026);
  money(concentrated.totalTax - split.totalTax, 971.25, 'cost of one name');
});

// ---------------------------------------------------------------------------
// Schedule P Part I: the part that has no ceiling
// ---------------------------------------------------------------------------

test('pre-1998 government service is exempt in full AND leaves the $31,110 intact', () => {
  // A Kentucky teacher, service 1975-2005: 276 months before 1998, 84 after.
  // $70,000 of TRS pension and $40,000 of IRA distributions.
  const r = ky(110_000, {
    retirement: {
      filer: {
        governmentPension: 70_000,
        serviceMonthsBefore1998: 276,
        serviceMonthsAfter1997: 84,
        iraDistributions: 40_000,
      },
    },
  });
  // 276/360 = 76.666…% of $70,000 = $53,666.67, uncapped — plus the whole
  // $31,110 against the IRA and the post-1997 remainder.
  money(excluded(r), 53_666.666_67 + 31_110);
  money(r.totalTax, 765.22);

  // On a return whose published exclusion is $31,110.
  assert.ok(excluded(r) > 84_000, 'the headline figure is not the maximum');
});

test('two teachers with identical pensions pay $1,878.33 apart on the decade they worked', () => {
  const base = { governmentPension: 70_000, iraDistributions: 40_000 };
  const early = ky(110_000, {
    retirement: {
      filer: { ...base, serviceMonthsBefore1998: 276, serviceMonthsAfter1997: 84 },
    },
  });
  const late = ky(110_000, {
    retirement: { filer: { ...base, serviceMonthsAfter1997: 360 } },
  });
  money(early.totalTax, 765.22);
  money(late.totalTax, 2_643.55);
  money(late.totalTax - early.totalTax, 1_878.33);
});

test('a person who retired before 1998 has no post-1997 months, so the whole pension is exempt', () => {
  const r = ky(90_000, {
    retirement: { filer: { governmentPension: 90_000, serviceMonthsBefore1998: 360 } },
  });
  money(excluded(r), 90_000);
  money(r.totalTax, 0);
  // $3,032.40 of tax that a rate table charges and the Commonwealth does not.
  money(rateTable(90_000), 3_032.4);
});

test('the exempt DOLLARS hold as service lengthens even though the percentage falls', () => {
  // A pension earned over more months is larger. Hold the accrual rate fixed at
  // $250 a month and lengthen the career: the exempt percentage collapses from
  // 100% to 25% and the exempt dollars do not move at all. Every summary of
  // Schedule P reports the percentage.
  const preMonths = 120;
  const perMonth = 250;
  for (const postMonths of [0, 120, 240, 360]) {
    const pension = (preMonths + postMonths) * perMonth;
    const r = ky(pension, {
      retirement: {
        filer: {
          governmentPension: pension,
          serviceMonthsBefore1998: preMonths,
          serviceMonthsAfter1997: postMonths,
        },
      },
    });
    const exempt = preMonths * perMonth;
    money(excluded(r), exempt + Math.min(31_110, pension - exempt));
  }
});

test('deferred compensation is not Part I income, so it is capped like any other', () => {
  const partI = ky(80_000, {
    retirement: {
      filer: { governmentPension: 80_000, serviceMonthsBefore1998: 360 },
    },
  });
  const partII = ky(80_000, {
    retirement: { filer: { employerPlanPension: 80_000 } },
  });
  money(excluded(partI), 80_000);
  money(excluded(partII), 31_110);
});

// ---------------------------------------------------------------------------
// Social Security
// ---------------------------------------------------------------------------

test('Kentucky exempts Social Security outright and does NOT charge it against the exclusion', () => {
  // The Maryland contrast: there the whole benefit received comes off the
  // exclusion dollar for dollar, so the exemption is worth nothing at the cap.
  const r = ky(51_000, {
    filingStatus: 'marriedFilingJointly',
    taxableSocialSecurity: 11_000,
    retirement: {
      filer: { employerPlanPension: 40_000, socialSecurityBenefits: 60_000 },
    },
  });
  money(excluded(r), 31_110);
  money(r.totalTax, (51_000 - 11_000 - 31_110 - DEDUCTION) * RATE_2026);
  money(r.totalTax, 193.55);
});

// ---------------------------------------------------------------------------
// The three-way comparison. The ranking reverses at 65.
// ---------------------------------------------------------------------------

const atAge = (state, age, extra = {}) =>
  stateIncomeTax({
    state,
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: { adjustedGrossIncome: 70_000 },
    filerAge: age,
    spouseAge: age,
    retirement: {
      filer: { employerPlanPension: 35_000 },
      spouse: { employerPlanPension: 35_000 },
    },
    ...extra,
  });

test('at 55 Kentucky is the cheapest of the three by a factor of twenty-eight', () => {
  money(atAge('KY', 55).totalTax, 154.7);
  money(atAge('GA', 55).totalTax, 1_996);
  money(atAge('MD', 55, { county: 'Montgomery' }).totalTax, 4_471.05);
});

test('at 65 the ranking reverses and Kentucky is the only one that charges anything', () => {
  money(atAge('KY', 65).totalTax, 154.7);
  money(atAge('GA', 65).totalTax, 0);
  money(atAge('MD', 65, { county: 'Montgomery' }).totalTax, 0);
});

test("Kentucky's answer does not move with age at all, and the other two step", () => {
  const kyTax = [55, 60, 62, 64, 65, 70].map((age) => atAge('KY', age).totalTax);
  assert.deepEqual(new Set(kyTax).size, 1, 'Kentucky is flat across every age');

  // Georgia steps once, at 62. Maryland steps once, at 65.
  assert.ok(atAge('GA', 61).totalTax > 0 && atAge('GA', 62).totalTax === 0);
  const md = (age) => atAge('MD', age, { county: 'Montgomery' }).totalTax;
  assert.ok(md(64) > 0 && md(65) === 0);
});

// ---------------------------------------------------------------------------
// Parity with the reference model
// ---------------------------------------------------------------------------

test('matches PolicyEngine-US on its own Schedule P fixtures', () => {
  const one = (person) => excluded(ky(400_000, { retirement: { filer: person } }));
  // "Not eligible for exemption, exclusion capped at $31,110."
  money(one({ employerPlanPension: 31_111 }), 31_110);
  // "…pension and other income capped at $31,110."
  money(one({ employerPlanPension: 31_111, iraDistributions: 1 }), 31_110);
  // "…pension income not capped but other income capped." 31_111 + 31_110.
  money(
    one({ governmentPension: 31_111, serviceMonthsBefore1998: 120, iraDistributions: 31_114 }),
    62_221,
  );
  // "Eligible for exemption and 50% of months worked pre-1998." 35_000 + 31_110.
  money(
    one({ governmentPension: 70_000, serviceMonthsBefore1998: 180, serviceMonthsAfter1997: 180 }),
    66_110,
  );
});

// ---------------------------------------------------------------------------
// What a rate table charges a Kentucky retiree
// ---------------------------------------------------------------------------

test('a Kentucky rate table overstates every retiree here', () => {
  const cases = [
    [55_000, { employerPlanPension: 55_000 }, 718.55],
    [31_110, { employerPlanPension: 31_110 }, 0],
    [110_000, {
      governmentPension: 70_000,
      serviceMonthsBefore1998: 276,
      serviceMonthsAfter1997: 84,
      iraDistributions: 40_000,
    }, 765.22],
    [90_000, { governmentPension: 90_000, serviceMonthsBefore1998: 360 }, 0],
  ];
  for (const [agi, person, expected] of cases) {
    const r = ky(agi, { retirement: { filer: person } });
    money(r.totalTax, expected, `AGI ${agi}`);
    assert.ok(rateTable(agi) > r.totalTax, `AGI ${agi}: the rate table should be higher`);
  }
});
