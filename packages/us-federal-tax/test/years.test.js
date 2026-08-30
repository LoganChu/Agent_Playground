import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FILING_STATUSES,
  SUPPORTED_YEARS,
  UnsupportedYearError,
  YEARS,
  additionalDeductions,
  earnedIncomeCredit,
  estimateFederalTax,
  federalIncomeTax,
  getYearParameters,
  scheduleOneAParameters,
  selfEmploymentTax,
  stateAndLocalTaxDeduction,
} from '../dist/esm/index.js';

// ---------------------------------------------------------------------------
// Structural invariants, applied to every year the package ships.
//
// These are the tests that scale. Each new tax year is several hundred
// transcribed figures, and the failure mode is not "the formula is wrong" but
// "one number was typed twice, or into the wrong status". A generic assertion
// that runs against every year catches that class of error the day the year is
// added, without anyone hand-computing anything.
// ---------------------------------------------------------------------------

const ORDINARY_RATES = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const CAPITAL_GAINS_RATES = [0, 0.15, 0.2];

test('SUPPORTED_YEARS matches the registry and is ascending', () => {
  assert.deepEqual(SUPPORTED_YEARS, [2024, 2025, 2026]);
  assert.deepEqual(
    SUPPORTED_YEARS,
    Object.keys(YEARS)
      .map(Number)
      .sort((a, b) => a - b),
  );
  for (const year of SUPPORTED_YEARS) {
    assert.equal(getYearParameters(year).year, year, `${year} is self-identifying`);
  }
});

test('an unsupported year throws rather than falling back', () => {
  for (const year of [2023, 2027, 1999]) {
    assert.throws(() => getYearParameters(year), UnsupportedYearError);
  }
  // The message names the years that *are* available, because the alternative
  // — silently computing 2027 tax on 2026 brackets — is the expensive kind of
  // wrong.
  assert.match(
    (() => {
      try {
        getYearParameters(2027);
      } catch (error) {
        return error.message;
      }
    })(),
    /2024, 2025, 2026/,
  );
});

for (const year of [2024, 2025, 2026]) {
  const params = getYearParameters(year);

  test(`${year}: every status-keyed table covers all five filing statuses`, () => {
    const tables = {
      ordinaryBrackets: params.ordinaryBrackets,
      standardDeduction: params.standardDeduction,
      additionalStandardDeduction: params.additionalStandardDeduction,
      additionalMedicareThreshold: params.additionalMedicareThreshold,
      longTermCapitalGains: params.longTermCapitalGains,
      niitThresholds: params.niit.thresholds,
      section199AThreshold: params.section199A.thresholdAmount,
      section199APhaseIn: params.section199A.phaseInRange,
      saltCap: params.saltCap.cap,
      saltThreshold: params.saltCap.phaseDownThreshold,
      saltFloor: params.saltCap.floor,
      ctcPhaseOut: params.childTaxCredit.phaseOut.thresholds,
    };

    for (const [name, table] of Object.entries(tables)) {
      assert.deepEqual(
        Object.keys(table).sort(),
        [...FILING_STATUSES].sort(),
        `${name} is missing a filing status`,
      );
      for (const status of FILING_STATUSES) {
        assert.notEqual(table[status], undefined, `${name}.${status}`);
      }
    }
  });

  test(`${year}: ordinary bracket tables are well formed`, () => {
    for (const status of FILING_STATUSES) {
      const brackets = params.ordinaryBrackets[status];
      assert.deepEqual(
        brackets.map((b) => b.rate),
        ORDINARY_RATES,
        `${status} rates`,
      );
      assert.equal(brackets.at(-1).upTo, Infinity, `${status} ends at Infinity`);
      for (let i = 1; i < brackets.length; i += 1) {
        assert.ok(
          brackets[i].upTo > brackets[i - 1].upTo,
          `${status} band ${i} must exceed band ${i - 1}`,
        );
      }
    }
  });

  test(`${year}: capital gains tables are well formed`, () => {
    for (const status of FILING_STATUSES) {
      const brackets = params.longTermCapitalGains[status];
      assert.deepEqual(
        brackets.map((b) => b.rate),
        CAPITAL_GAINS_RATES,
        `${status} rates`,
      );
      assert.equal(brackets.at(-1).upTo, Infinity);
      assert.ok(brackets[1].upTo > brackets[0].upTo);
    }
  });

  test(`${year}: the status relationships that hold in every year`, () => {
    const o = params.ordinaryBrackets;

    // A qualifying surviving spouse uses the joint rate schedule (§ 1(a)) and
    // the joint standard deduction, but *not* the joint Form 8959 threshold.
    assert.deepEqual(o.qualifyingSurvivingSpouse, o.marriedFilingJointly);
    assert.deepEqual(
      params.longTermCapitalGains.qualifyingSurvivingSpouse,
      params.longTermCapitalGains.marriedFilingJointly,
    );
    assert.equal(
      params.standardDeduction.qualifyingSurvivingSpouse,
      params.standardDeduction.marriedFilingJointly,
    );
    assert.equal(params.additionalMedicareThreshold.qualifyingSurvivingSpouse, 200_000);
    assert.equal(params.niit.thresholds.qualifyingSurvivingSpouse, 250_000);

    // Married filing separately: the same schedule as single up to the 35%
    // band, which is capped at exactly half the joint figure.
    assert.deepEqual(o.marriedFilingSeparately.slice(0, 5), o.single.slice(0, 5));
    assert.equal(o.marriedFilingSeparately[5].upTo, o.marriedFilingJointly[5].upTo / 2);
    assert.equal(params.standardDeduction.marriedFilingSeparately, params.standardDeduction.single);

    // Head of household never exceeds single at any band, and the 24% ceiling
    // is either equal or exactly $25 lower — never anything else.
    // Bands 0 and 1 are genuinely wider for HoH; the last band is Infinity in
    // both, and Infinity - Infinity is NaN.
    for (let i = 2; i < ORDINARY_RATES.length - 1; i += 1) {
      const gap = o.single[i].upTo - o.headOfHousehold[i].upTo;
      assert.ok(gap === 0 || gap === 25, `${year} HoH band ${i} differs from single by ${gap}`);
    }
  });

  test(`${year}: statutory rates and floors are unchanged`, () => {
    assert.deepEqual(params.rates, {
      socialSecurityEmployee: 0.062,
      socialSecurityEmployer: 0.062,
      medicareEmployee: 0.0145,
      medicareEmployer: 0.0145,
      additionalMedicare: 0.009,
      seSocialSecurity: 0.124,
      seMedicare: 0.029,
    });
    assert.equal(params.seNetEarningsFactor, 0.9235);
    assert.equal(params.seMinimumNetEarnings, 400);
    assert.equal(params.niit.rate, 0.038);
    assert.deepEqual(params.additionalMedicareThreshold, {
      single: 200_000,
      marriedFilingJointly: 250_000,
      marriedFilingSeparately: 125_000,
      headOfHousehold: 200_000,
      qualifyingSurvivingSpouse: 200_000,
    });
  });

  test(`${year}: every figure is traceable to a cited source`, () => {
    assert.ok(params.sources.length > 0);
    for (const source of params.sources) {
      assert.ok(source.title.length > 0);
      assert.match(source.url, /^https:\/\//);
    }
  });

  test(`${year}: the SALT floor never exceeds the cap`, () => {
    for (const status of FILING_STATUSES) {
      assert.ok(
        params.saltCap.floor[status] <= params.saltCap.cap[status],
        `${status}: floor above cap`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// The 2024 published rate schedule contains a typo. This engine cannot
// reproduce it, and that is the point.
// ---------------------------------------------------------------------------

test('2024: the corrected married-filing-separately rate schedule figure', () => {
  // The IRS corrected page 109 of the 2024 Instructions for Form 1040 on
  // 2025-01-08: for married filing separately with taxable income over
  // $365,600, the tax is $98,334.75 + 37% of the excess — not the $99,334.75
  // that was printed. Every copy downloaded before 2025-01-06 has the wrong
  // figure, and an implementation that transcribed that column overstates the
  // tax of every top-bracket separate filer by exactly $1,000.
  //
  // This package stores no base-tax column; it walks the bands. So the figure
  // is *derived*, and the derivation agrees with the correction to the cent.
  const atBoundary = federalIncomeTax({
    taxableIncome: 365_600,
    filingStatus: 'marriedFilingSeparately',
    year: 2024,
  });
  assert.equal(atBoundary.tax, 98_334.75);
  assert.notEqual(atBoundary.tax, 99_334.75);

  // And the 37% band really does start there.
  const oneDollarMore = federalIncomeTax({
    taxableIncome: 365_601,
    filingStatus: 'marriedFilingSeparately',
    year: 2024,
  });
  assert.equal(oneDollarMore.tax, 98_335.12);
  assert.equal(oneDollarMore.marginalRate, 0.37);
});

// ---------------------------------------------------------------------------
// The EITC endpoint cross-check, now across three years.
//
// The IRS publishes a "completed phase-out amount" column. This package does
// not store it — it falls out as `phaseOutStart + maximumCredit / phaseOutRate`.
// So each published value is an independent test of two stored parameters, and
// 24 of them across three years is a strong check that nothing was mistyped.
// ---------------------------------------------------------------------------

const PUBLISHED_COMPLETED_PHASE_OUT = {
  2024: { 0: [18_591, 25_511], 1: [49_084, 56_004], 2: [55_768, 62_688], 3: [59_899, 66_819] },
  2025: { 0: [19_104, 26_214], 1: [50_434, 57_554], 2: [57_310, 64_430], 3: [61_555, 68_675] },
  // The 3-child joint cell is the one Rev. Proc. 2025-32 corrected on
  // 2025-10-17, from $70,224 to $70,244.
  2026: { 0: [19_540, 26_820], 1: [51_593, 58_863], 2: [58_629, 65_899], 3: [62_974, 70_244] },
};

test('published EITC completed phase-out amounts are reproduced in all three years', () => {
  let checked = 0;
  for (const [year, byChildren] of Object.entries(PUBLISHED_COMPLETED_PHASE_OUT)) {
    for (const [children, [unmarried, joint]] of Object.entries(byChildren)) {
      const cases = [
        ['single', unmarried],
        ['headOfHousehold', unmarried],
        ['marriedFilingJointly', joint],
      ];
      for (const [filingStatus, published] of cases) {
        const result = earnedIncomeCredit({
          filingStatus,
          year: Number(year),
          qualifyingChildren: Number(children),
          age: 30,
          earnedIncome: 1_000,
          adjustedGrossIncome: 1_000,
        });
        assert.equal(
          Math.round(result.completedPhaseOut),
          published,
          `${year}, ${children} children, ${filingStatus}`,
        );
        checked += 1;
      }
    }
  }
  assert.equal(checked, 36);
});

test('the EITC joint add-on splits differently in each year, in both directions', () => {
  const addOns = (year) => {
    const table = getYearParameters(year).earnedIncomeCredit.table;
    const addOn = (row) => row.phaseOutStart.marriedFilingJointly - row.phaseOutStart.single;
    return [addOn(table[0]), addOn(table[1])];
  };

  // § 32(b)(2)(B) adds a single inflation-adjusted amount, but the IRS rounds
  // the resulting *sum* to the nearest $10 — so the effective add-on differs
  // between the childless and with-children tables, and not by a fixed sign.
  assert.deepEqual(addOns(2024), [6_920, 6_920]); // coincide
  assert.deepEqual(addOns(2025), [7_110, 7_120]); // childless is lower
  assert.deepEqual(addOns(2026), [7_280, 7_270]); // childless is higher

  // All three rows above the first share one start in every year.
  for (const year of SUPPORTED_YEARS) {
    const table = getYearParameters(year).earnedIncomeCredit.table;
    for (const row of table.slice(2)) {
      assert.deepEqual(row.phaseOutStart, table[1].phaseOutStart, `${year}`);
    }
  }
});

// ---------------------------------------------------------------------------
// What changed between the years, asserted as behaviour rather than prose.
// ---------------------------------------------------------------------------

test('the 2025 standard deduction is the OBBBA figure, not the Revenue Procedure one', () => {
  // Rev. Proc. 2024-40 published $15,000 / $30,000 / $22,500 in October 2024.
  // OBBBA § 70102 superseded it retroactively in July 2025. A parameter set
  // built from the Revenue Procedure alone overstates 2025 taxable income.
  const d = getYearParameters(2025).standardDeduction;
  assert.equal(d.single, 15_750);
  assert.equal(d.marriedFilingJointly, 31_500);
  assert.equal(d.headOfHousehold, 23_625);

  for (const stale of [15_000, 30_000, 22_500]) {
    assert.ok(!Object.values(d).includes(stale), `stale Rev. Proc. figure ${stale}`);
  }

  // Standard deductions rise every year in this window.
  const single = SUPPORTED_YEARS.map((y) => getYearParameters(y).standardDeduction.single);
  assert.deepEqual(single, [14_600, 15_750, 16_100]);
});

test('the Schedule 1-A deductions exist in 2025 and 2026 but not 2024', () => {
  assert.equal(scheduleOneAParameters(2024), null);
  assert.notEqual(scheduleOneAParameters(2025), null);
  assert.notEqual(scheduleOneAParameters(2026), null);

  // None of the four amounts is inflation-indexed, so 2025 and 2026 must be
  // identical. Asserting deep equality turns any future drift into a failure
  // rather than a silently divergent copy.
  assert.deepEqual(scheduleOneAParameters(2025), scheduleOneAParameters(2026));
});

test('a tipped worker gets the deduction in 2025 and nothing in 2024', () => {
  const input = {
    filingStatus: 'single',
    adjustedGrossIncome: 60_000,
    qualifiedTips: 15_000,
  };

  assert.equal(additionalDeductions({ ...input, year: 2025 }).total, 15_000);

  // 2024 returns a zeroed result rather than throwing, so the same call site
  // works across the sunset in both directions.
  const before = additionalDeductions({ ...input, year: 2024 });
  assert.equal(before.total, 0);
  assert.equal(before.tips.deduction, 0);
});

test('§ 199A: the phase-in range widens and the $400 floor appears only in 2026', () => {
  const range = (year) => getYearParameters(year).section199A.phaseInRange;
  const floor = (year) => getYearParameters(year).section199A.minimumDeduction;

  // OBBBA § 70105(b) applies to years beginning after 2025 — so 2025 keeps the
  // original TCJA range. Carrying the 2026 range back phases the W-2/UBIA cap
  // and the SSTB haircut in twice as fast as the statute allows.
  assert.equal(range(2024).single, 50_000);
  assert.equal(range(2025).single, 50_000);
  assert.equal(range(2026).single, 75_000);
  assert.equal(range(2024).marriedFilingJointly, 100_000);
  assert.equal(range(2025).marriedFilingJointly, 100_000);
  assert.equal(range(2026).marriedFilingJointly, 150_000);

  // § 199A(i), added by OBBBA § 70105(c), is likewise a 2026 provision.
  assert.equal(floor(2024), null);
  assert.equal(floor(2025), null);
  assert.equal(floor(2026).amount, 400);

  // A high earner with a small wageless side business well above the
  // threshold: the W-2/UBIA cap bites in full and zeroes the deduction, so the
  // § 199A(i) floor is the entire deduction in 2026 and there is none in 2025.
  const sideBusiness = (year) =>
    estimateFederalTax({
      filingStatus: 'single',
      year,
      otherOrdinaryIncome: 400_000,
      qualifiedBusinesses: [{ qualifiedBusinessIncome: 2_000 }],
    }).section199A.deduction;

  assert.equal(sideBusiness(2025), 0);
  assert.equal(sideBusiness(2026), 400);

  // The floor does *not* rescue a specified service business above the range,
  // because above the phase-out an SSTB is not a qualified trade or business at
  // all under § 199A(d)(1)(A) — so there is no active QBI to clear the $1,000
  // gate. This is the one place the floor is easy to over-apply.
  const consultant = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    otherOrdinaryIncome: 400_000,
    qualifiedBusinesses: [
      { qualifiedBusinessIncome: 2_000, isSpecifiedServiceTradeOrBusiness: true },
    ],
  }).section199A.deduction;
  assert.equal(consultant, 0);
});

test('the SALT cap: flat in 2024, raised with a phase-down from 2025', () => {
  const salt = (year, agi) =>
    stateAndLocalTaxDeduction({
      filingStatus: 'marriedFilingJointly',
      year,
      stateAndLocalTaxesPaid: 60_000,
      adjustedGrossIncome: agi,
    });

  // 2024: $10,000 and no phase-down at any income at all.
  for (const agi of [50_000, 500_000, 5_000_000]) {
    const r = salt(2024, agi);
    assert.equal(r.deduction, 10_000);
    assert.equal(r.phaseDownReduction, 0);
  }

  // 2025: $40,000, phasing down 30 cents per dollar above $500,000 and fully
  // gone to the $10,000 floor at $600,000.
  assert.equal(salt(2025, 400_000).deduction, 40_000);
  assert.equal(salt(2025, 550_000).deduction, 25_000);
  assert.equal(salt(2025, 600_000).deduction, 10_000);
  assert.equal(salt(2025, 900_000).deduction, 10_000);

  // 2026: the 1%-a-year escalator has started on both the cap and the
  // threshold, so the same filer at $550,000 keeps $1,900 more.
  assert.equal(salt(2026, 400_000).deduction, 40_400);
  assert.equal(salt(2026, 550_000).deduction, 26_900);
});

test('the child tax credit rises to $2,200 in 2025, and so does the SSN requirement', () => {
  const p = (year) => getYearParameters(year).childTaxCredit;

  assert.equal(p(2024).amountPerChild, 2_000);
  assert.equal(p(2025).amountPerChild, 2_200);
  assert.equal(p(2026).amountPerChild, 2_200);

  // The refundable cap and the never-indexed thresholds hold across all three.
  for (const year of SUPPORTED_YEARS) {
    assert.equal(p(year).refundable.maximumPerChild, 1_700);
    assert.equal(p(year).amountPerOtherDependent, 500);
    assert.equal(p(year).phaseOut.thresholds.marriedFilingJointly, 400_000);
    assert.equal(p(year).phaseOut.thresholds.marriedFilingSeparately, 200_000);
    assert.equal(p(year).phaseOut.rounding, 'up');
  }

  // OBBBA § 70104(c) first applies in 2025.
  assert.equal(p(2024).requiresTaxpayerSocialSecurityNumber, false);
  assert.equal(p(2025).requiresTaxpayerSocialSecurityNumber, true);
  assert.equal(p(2026).requiresTaxpayerSocialSecurityNumber, true);
});

test('the Social Security wage base, and the maximum SE tax it implies', () => {
  const bases = SUPPORTED_YEARS.map((y) => getYearParameters(y).socialSecurityWageBase);
  assert.deepEqual(bases, [168_600, 176_100, 184_500]);

  // A high earner pays 12.4% of the whole base plus 2.9% of everything. The
  // OASDI half is the part that moves, and it is a clean independent check
  // that the base was transcribed correctly.
  for (const [year, expected] of [
    [2024, 20_906.4],
    [2025, 21_836.4],
    [2026, 22_878.0],
  ]) {
    const se = selfEmploymentTax({ netProfit: 500_000, year });
    assert.equal(se.socialSecurity, expected, `${year}`);
  }
});

// ---------------------------------------------------------------------------
// One household, three years. This is the comparison the package exists to
// make possible, and it exercises every subsystem through the public entry
// point in a year where each is configured differently.
// ---------------------------------------------------------------------------

test('the same household across 2024, 2025 and 2026', () => {
  const household = {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 120_000,
    qualifyingChildren: 2,
    stateAndLocalTaxesPaid: 25_000,
    otherItemizedDeductions: 8_000,
  };

  const results = SUPPORTED_YEARS.map((year) => estimateFederalTax({ ...household, year }));
  const [y2024, y2025, y2026] = results;

  // 2024: the $10,000 SALT cap means $18,000 of itemized deductions, which
  // loses to the $29,200 standard deduction. 2025 and 2026 flip that — the
  // raised cap makes itemizing worth $33,000 and $33,000, beating the standard
  // deduction for the first time.
  assert.equal(y2024.stateAndLocalTax.cap, 10_000);
  assert.equal(y2024.deduction, 29_200);
  assert.equal(y2024.deductionKind, 'standard');
  assert.equal(y2025.stateAndLocalTax.cap, 40_000);
  assert.equal(y2025.deduction, 33_000);
  assert.equal(y2025.deductionKind, 'itemized');
  assert.equal(y2026.deductionKind, 'itemized');

  // The child tax credit follows the statute, not the year's brackets.
  assert.equal(y2024.credits.childTaxCredit.creditAfterPhaseOut, 4_000);
  assert.equal(y2025.credits.childTaxCredit.creditAfterPhaseOut, 4_400);
  assert.equal(y2026.credits.childTaxCredit.creditAfterPhaseOut, 4_400);

  // Every year is internally consistent: total tax is never negative, and the
  // credit ceiling is the § 26(a) regular tax liability rather than total tax.
  for (const r of results) {
    assert.ok(r.totalTax >= 0);
    assert.ok(r.incomeTaxBeforeCredits >= r.totalTax);
    assert.ok(r.taxableIncome >= 0);
  }

  // Tax falls every year for this family, and the biggest single step is
  // 2024 → 2025: the standard-deduction increase, the raised SALT cap and the
  // larger credit all land at once.
  assert.ok(y2025.totalTax < y2024.totalTax);
  assert.ok(y2026.totalTax < y2025.totalTax);
  assert.ok(y2024.totalTax - y2025.totalTax > y2025.totalTax - y2026.totalTax);
});

test('a 2024 estimate never reports OBBBA-era figures', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2024,
    w2Wages: 90_000,
    qualifiedTips: 10_000,
    age65OrOlder: true,
  });

  // No Schedule 1-A of any kind, including the senior deduction — a 70-year-old
  // in 2024 gets the ordinary additional standard deduction ($1,950) and
  // nothing else.
  assert.equal(r.additionalDeductions.total, 0);
  assert.equal(r.deduction, 14_600 + 1_950);
  assert.equal(r.deductionKind, 'standard');
  assert.equal(r.year, 2024);
});
