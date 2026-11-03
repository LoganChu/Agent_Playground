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

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

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
  // THE EXCLUSION has no age test and that is what this test is about, so it is
  // the EXCLUSION the two are compared on. The TAX differs by $40 from v0.61.0,
  // and the whole of the difference is the personal tax credit for age — which
  // is asserted here rather than tolerated, because this assertion is the one
  // that used to say the two taxes were equal and was right only because a
  // credit was missing.
  money(excluded(old), 31_110);
  money(young.totalTax - old.totalTax, 40, 'the only thing age buys in Kentucky is the $40 credit');
  // And with no age supplied at all the engine cannot know, so it charges the
  // credit to nobody: an ageless call matches the 45-year-old and NOT the
  // 75-year-old. Before the credit existed it matched both, which is exactly
  // why an unread `filerAge` was invisible here.
  const ageless = ky(50_000, { retirement: { filer: { employerPlanPension: 50_000 } } });
  money(ageless.totalTax, young.totalTax);
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
  // $74.70, and it was $154.70 until v0.61.0 added the personal tax credit for
  // age: two filers at 65, $40 each. The claim the test is named for is
  // unharmed — Kentucky is still the only one of the three charging anything at
  // 65 — and it is now charging $80 less.
  money(atAge('KY', 65).totalTax, 74.7);
  money(atAge('GA', 65).totalTax, 0);
  money(atAge('MD', 65, { county: 'Montgomery' }).totalTax, 0);
});

test("Kentucky's answer steps ONCE, at 65, and the step is the $40 a head it had been missing", () => {
  // THIS TEST SAID THE OPPOSITE UNTIL v0.61.0: "Kentucky's answer does not move
  // with age at all", asserting that the set of taxes across six ages had
  // exactly one member. It did, and the reason was that this package had never
  // implemented KRS 141.020(3). A property stated as a feature of the state was
  // a property of the gap, and the test defended it for fifty-three days.
  //
  //   A TEST THAT PINS AN ABSENCE CANNOT TELL A STATUTE THAT IS SILENT FROM A
  //   RULE THAT WAS NEVER WRITTEN. What found it was `tools/anchors`, whose
  //   right answers come from outside this repository.
  const kyTax = [55, 60, 62, 64, 65, 70].map((age) => atAge('KY', age).totalTax);
  assert.deepEqual(new Set(kyTax).size, 2, 'Kentucky now has exactly two answers across these ages');
  money(atAge('KY', 64).totalTax, 154.7);
  money(atAge('KY', 65).totalTax, 74.7);
  money(atAge('KY', 64).totalTax - atAge('KY', 65).totalTax, 80, 'two filers, $40 each');
  // And it is a CLIFF of $80 with nothing either side of it: 70 is 65's answer
  // and 62 is 55's, so the step is at 65 and nowhere else.
  money(atAge('KY', 70).totalTax, atAge('KY', 65).totalTax);
  money(atAge('KY', 62).totalTax, atAge('KY', 55).totalTax);

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

// ---------------------------------------------------------------------------
// THE PERSONAL TAX CREDIT FOR AGE — KRS 141.020(3), Schedule ITC.
//
// Added in v0.61.0, and found by `tools/anchors` rather than by reading a
// statute: a `policyengine-us` fixture asserted $40 of aged personal credit on
// a 2025 Kentucky return and this package charged the $40. No Kentucky primary
// document resolves from this sandbox — revenue.ky.gov and
// apps.legislature.ky.gov both refuse — so what stands behind the figure is the
// Department's own summary of the credit, the 2016 text of KRS 141.020, and the
// fixture this package now reproduces.
//
// THE PART WORTH WRITING DOWN IS HOW IT HID. The engine's unread-input report
// had been naming `filerAge` as "supplied and spent on nothing" on EVERY
// Kentucky return, which is precisely the shape of a missing age credit, and
// `kentucky-retirement.test.js` asserted that Kentucky's answer "does not move
// with age at all" — a true statement about this package and a false one about
// Kentucky, defended by a passing test.
// ---------------------------------------------------------------------------

const AGE_CREDIT = 'personal tax credit for age';
const ageCredit = (result) =>
  (result.credits ?? [])
    .filter((c) => c.name.toLowerCase().includes(AGE_CREDIT))
    .reduce((sum, c) => sum + c.amount, 0);

test('the rule is $40 a filer at 65, not refundable, in both years', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('KY', year).agedFilerCredit;
    assert.equal(rule.minimumAge, 65);
    assert.equal(rule.amountPerFiler, 40);
    assert.equal(rule.refundable, false);
  }
});

test('$40 for one filer and $80 for two, and there is NO income test', () => {
  // The claim is "no income test", so it is checked across four orders of
  // magnitude rather than at one income. Day 66: a claim about a set is checked
  // by walking the set.
  for (const agi of [20_000, 60_000, 200_000, 2_000_000, 20_000_000]) {
    money(ageCredit(ky(agi, { filerAge: 67 })), 40, `single at ${agi}`);
    money(
      ageCredit(ky(agi, { filingStatus: 'marriedFilingJointly', filerAge: 67, spouseAge: 70 })),
      80,
      `joint at ${agi}`,
    );
  }
});

test('65 is a cliff and 64 gets nothing', () => {
  money(ageCredit(ky(50_000, { filerAge: 64 })), 0);
  money(ageCredit(ky(50_000, { filerAge: 65 })), 40);
  money(ky(50_000, { filerAge: 64 }).totalTax - ky(50_000, { filerAge: 65 }).totalTax, 40);
});

test('one spouse at 65 is $40 and not $80', () => {
  money(
    ageCredit(ky(80_000, { filingStatus: 'marriedFilingJointly', filerAge: 66, spouseAge: 60 })),
    40,
  );
});

test('a surviving spouse claims ONE credit, however old the dead spouse was', () => {
  // `seniorFilers` counts through `livingFilerCount`, so a `spouseAge` on this
  // return is ignored. The engine had this property already and this is the
  // assertion that it reaches the new rule: a widow is one person.
  money(
    ageCredit(
      ky(50_000, {
        filingStatus: 'qualifyingSurvivingSpouse',
        filerAge: 70,
        spouseAge: 72,
        dependents: 1,
        dependentAges: [10],
      }),
    ),
    40,
  );
});

test('it is NOT refundable: a filer with no tax gets nothing back', () => {
  const r = ky(3_000, { filerAge: 80 });
  money(r.taxBeforeCredits, 0);
  money(r.totalTax, 0, 'no tax and no refund');
});

test('it cannot take the tax below zero', () => {
  // $3,400 of AGI in 2026 is $40 of income over the $3,360 deduction, which is
  // $1.40 of tax against a $40 credit. The credit is worth $1.40 here and the
  // other $38.60 is lost, which is what non-refundable means.
  const r = ky(3_400, { filerAge: 80 });
  money(r.taxBeforeCredits, 1.4);
  money(r.totalTax, 0);
});

test('the credit survives the rate cut unchanged, so it is worth MORE in income', () => {
  // $40 is $1,000 of Kentucky income at 2025's 4.0% and $1,142.86 at 2026's
  // 3.5%. A credit fixed in dollars gains real value when a rate falls, which
  // is the opposite of what happens to the pension exclusion beside it.
  money(ageCredit(ky(60_000, { year: 2025, filerAge: 70 })), 40);
  money(ageCredit(ky(60_000, { year: 2026, filerAge: 70 })), 40);
  money(40 / 0.04, 1_000);
  money(40 / 0.035, 1_142.857142857, 'the same $40 is $142.86 more income in 2026');
});

test('it stacks with the pension exclusion rather than being reduced by it', () => {
  // A retiree at 70 with a $31,110 pension excludes the whole pension AND takes
  // the $40. Nothing in either rule looks at the other, and a model that
  // treated the credit as an alternative to the exclusion would charge $40 more.
  const r = ky(31_110, {
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 31_110 } },
  });
  money(excluded(r), 31_110);
  money(r.taxBeforeCredits, 0);
  money(ageCredit(r), 40);
  money(r.totalTax, 0);
});

test('the anchored household: a 67-year-old on $40,000 of wages owes $1,429.20 in 2025', () => {
  // `tools/anchors` 2025-KY-ky-11, whose expected value is PolicyEngine's own
  // TAXSIM-cross-checked fixture: `ky_aged_personal_tax_credits: [40]`,
  // `ky_personal_tax_credits: 40`, `ky_income_tax: 1429.2`. This package
  // charged $1,469.20 until v0.61.0 — the whole $40.
  const r = ky(40_000, { year: 2025, filerAge: 67 });
  money(r.taxBeforeCredits, (40_000 - 3_270) * 0.04);
  money(r.taxBeforeCredits, 1_469.2);
  money(ageCredit(r), 40);
  money(r.totalTax, 1_429.2);
});
