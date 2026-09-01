import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAY_PERIODS,
  PAY_PERIODS_PER_YEAR,
  WITHHOLDING_COLUMNS,
  computePaycheck,
  computeWithholding,
  federalIncomeTax,
  getYearParameters,
  standardDeduction,
  withholdingColumn,
  withholdingMarginalRateAt,
  withholdingPlan,
  withholdingRateSchedule,
} from '../dist/esm/index.js';

const thresholds = (column, year, multipleJobsCheckbox = false) =>
  withholdingRateSchedule({ column, year, multipleJobsCheckbox })
    .map((b) => b.upTo)
    .filter((t) => Number.isFinite(t));

const annual = (over) =>
  computeWithholding({
    wagesThisPeriod: 100_000,
    filingStatus: 'single',
    payPeriod: 'annual',
    year: 2026,
    ...over,
  });

// --------------------------------------------------------------------------
// The published tables
//
// These are the thresholds printed in Publication 15-T, transcribed here and
// cross-checked against a second, independent implementation of the same tables
// (`@molecule/api-payroll-tax-us`, Apache-2.0, which stores them as data).
//
// Nothing in `src/` stores them. They are derived from the year's ordinary rate
// schedule and standard deduction, so these assertions are testing an identity
// rather than a transcription — which is exactly the point. If the identity
// holds for every column of both published years, it is sound for 2026 too.
// --------------------------------------------------------------------------

test('2024 standard withholding rate schedules match Publication 15-T', () => {
  assert.deepEqual(
    thresholds('singleOrMarriedFilingSeparately', 2024),
    [6_000, 17_600, 53_150, 106_525, 197_950, 249_725, 615_350],
  );
  assert.deepEqual(
    thresholds('marriedFilingJointly', 2024),
    [16_300, 39_500, 110_600, 217_350, 400_200, 503_750, 747_500],
  );
  assert.deepEqual(
    thresholds('headOfHousehold', 2024),
    [13_300, 29_850, 76_400, 113_800, 205_250, 257_000, 622_650],
  );
});

test('2025 standard withholding rate schedules match Publication 15-T', () => {
  assert.deepEqual(
    thresholds('singleOrMarriedFilingSeparately', 2025),
    [6_400, 18_325, 54_875, 109_750, 203_700, 256_925, 632_750],
  );
  assert.deepEqual(
    thresholds('marriedFilingJointly', 2025),
    [17_100, 40_950, 114_050, 223_800, 411_700, 518_150, 768_700],
  );
  assert.deepEqual(
    thresholds('headOfHousehold', 2025),
    [13_900, 30_900, 78_750, 117_250, 211_200, 264_400, 640_250],
  );
});

test('2026 standard withholding rate schedules, derived', () => {
  assert.deepEqual(
    thresholds('singleOrMarriedFilingSeparately', 2026),
    [7_500, 19_900, 57_900, 113_200, 209_275, 263_725, 648_100],
  );
  assert.deepEqual(
    thresholds('marriedFilingJointly', 2026),
    [19_300, 44_100, 120_100, 230_700, 422_850, 531_750, 788_000],
  );
  assert.deepEqual(
    thresholds('headOfHousehold', 2026),
    [15_550, 33_250, 83_000, 121_250, 217_300, 271_750, 656_150],
  );
});

test('the Step 2 checkbox schedule is the standard one at half scale', () => {
  for (const year of [2024, 2025, 2026]) {
    for (const column of WITHHOLDING_COLUMNS) {
      const p = getYearParameters(year);
      const standard = p.withholding.standardDeduction[column];
      const checkbox = thresholds(column, year, true);
      assert.equal(checkbox[0], standard / 2, `${year} ${column} zero band`);
      const taxable = thresholds(column, year)
        .slice(1)
        .map((t) => t - (standard - p.withholding.step1gAmount[column]));
      assert.deepEqual(
        checkbox.slice(1),
        taxable.map((t) => (t + standard) / 2),
        `${year} ${column}`,
      );
    }
  }
});

test('2024 checkbox schedules, pinned', () => {
  // Unlike the standard schedules above, these are pinned to the derivation
  // rather than to a second source — the comparison implementation does not
  // carry the checkbox tables, and Publication 15-T itself was not reachable.
  // What the halving identity is corroborated by is the two zero-rate bands,
  // which are half the standard deduction exactly as the published tables show.
  // The half-dollar thresholds are a consequence, not a transcription.
  assert.deepEqual(
    thresholds('singleOrMarriedFilingSeparately', 2024, true),
    [7_300, 13_100, 30_875, 57_562.5, 103_275, 129_162.5, 311_975],
  );
  assert.deepEqual(
    thresholds('marriedFilingJointly', 2024, true),
    [14_600, 26_200, 61_750, 115_125, 206_550, 258_325, 380_200],
  );
});

test('the Step 1(g) add-back is the pre-2020 form default allowances', () => {
  for (const year of [2024, 2025, 2026]) {
    const w = getYearParameters(year).withholding;
    assert.equal(w.allowanceAmount, 4_300);
    for (const column of WITHHOLDING_COLUMNS) {
      assert.equal(
        w.step1gAmount[column],
        w.builtInAllowances[column] * w.allowanceAmount,
        `${year} ${column}`,
      );
    }
    assert.equal(w.step1gAmount.marriedFilingJointly, 12_900);
    assert.equal(w.step1gAmount.singleOrMarriedFilingSeparately, 8_600);
  }
});

// --------------------------------------------------------------------------
// 2025 is the year the tables and the return disagree
// --------------------------------------------------------------------------

test('2025 withholds on the pre-OBBBA standard deduction and the return does not', () => {
  const w = getYearParameters(2025).withholding.standardDeduction;
  assert.equal(w.singleOrMarriedFilingSeparately, 15_000);
  assert.equal(w.marriedFilingJointly, 30_000);
  assert.equal(w.headOfHousehold, 22_500);

  // The return uses the retroactively raised figures.
  assert.equal(standardDeduction({ filingStatus: 'single', year: 2025 }), 15_750);
  assert.equal(standardDeduction({ filingStatus: 'marriedFilingJointly', year: 2025 }), 31_500);
  assert.equal(standardDeduction({ filingStatus: 'headOfHousehold', year: 2025 }), 23_625);

  // Which is worth exactly one bracket's worth of the $750 gap to a single
  // filer in the 22% band: $165 of over-withholding across the year.
  const withheld = annual({ year: 2025 }).annualizedWithholding;
  const actual = federalIncomeTax({
    taxableIncome: 100_000 - 15_750,
    filingStatus: 'single',
    year: 2025,
  }).tax;
  assert.equal(Math.round((withheld - actual) * 100) / 100, 165);
});

test('2024 and 2026 tables and returns agree', () => {
  for (const year of [2024, 2026]) {
    const w = getYearParameters(year);
    assert.equal(
      w.withholding.standardDeduction.singleOrMarriedFilingSeparately,
      w.standardDeduction.single,
    );
    assert.equal(
      w.withholding.standardDeduction.marriedFilingJointly,
      w.standardDeduction.marriedFilingJointly,
    );
    assert.equal(
      w.withholding.standardDeduction.headOfHousehold,
      w.standardDeduction.headOfHousehold,
    );
  }
});

test('the 2025 notes say why, and 2024 has nothing to say', () => {
  assert.match(annual({ year: 2025 }).notes.join(' '), /never reissued/);
  assert.equal(getYearParameters(2024).withholding.notes.length, 0);
});

// --------------------------------------------------------------------------
// The invariant that ties withholding to the return
// --------------------------------------------------------------------------

test('a blank W-4 on wage-only income withholds exactly the tax on the return', () => {
  for (const year of [2024, 2026]) {
    for (const [filingStatus, wages] of [
      ['single', 85_000],
      ['marriedFilingJointly', 140_000],
      ['headOfHousehold', 62_000],
    ]) {
      const withheld = computeWithholding({
        wagesThisPeriod: wages,
        filingStatus,
        payPeriod: 'annual',
        year,
      }).withholding;
      const owed = federalIncomeTax({
        taxableIncome: wages - standardDeduction({ filingStatus, year }),
        filingStatus,
        year,
      }).tax;
      assert.equal(withheld, owed, `${year} ${filingStatus}`);
    }
  }
});

test('two checkbox jobs withhold what one household return owes', () => {
  // The whole purpose of the Step 2 checkbox. Each job sees only its own wage
  // and neither knows the other exists, yet they sum to the right number.
  for (const year of [2024, 2025, 2026]) {
    for (const [filingStatus, each] of [
      ['marriedFilingJointly', 70_000],
      ['single', 45_000],
      ['headOfHousehold', 51_000],
    ]) {
      const perJob = computeWithholding({
        wagesThisPeriod: each,
        filingStatus,
        payPeriod: 'annual',
        year,
        w4: { multipleJobsCheckbox: true },
      }).withholding;
      const column = withholdingColumn(filingStatus);
      const taxable =
        2 * each - getYearParameters(year).withholding.standardDeduction[column];
      const owed = federalIncomeTax({
        taxableIncome: taxable,
        filingStatus: filingStatus === 'headOfHousehold' ? 'headOfHousehold' : filingStatus,
        year,
      }).tax;
      assert.equal(Math.round(2 * perJob * 100) / 100, owed, `${year} ${filingStatus}`);
    }
  }
});

test('a legacy W-4 with the default allowances equals a blank modern one', () => {
  // 2 allowances for single and 3 for married is precisely what Step 1(g) adds
  // back, so the two worksheets have to meet. If they ever stop meeting, one of
  // `step1gAmount` and `allowanceAmount` has drifted.
  const modernSingle = annual().withholding;
  const legacySingle = annual({
    w4: { revision: '2019OrEarlier', allowances: 2 },
  }).withholding;
  assert.equal(legacySingle, modernSingle);

  const modernJoint = annual({ filingStatus: 'marriedFilingJointly' }).withholding;
  const legacyJoint = annual({
    filingStatus: 'marriedFilingJointly',
    w4: { revision: '2019OrEarlier', allowances: 3 },
  }).withholding;
  assert.equal(legacyJoint, modernJoint);
});

test('each legacy allowance is worth $4,300 of wages', () => {
  const four = annual({ w4: { revision: '2019OrEarlier', allowances: 4 } });
  const two = annual({ w4: { revision: '2019OrEarlier', allowances: 2 } });
  assert.equal(four.adjustedAnnualWage, two.adjustedAnnualWage - 2 * 4_300);
  // At a 22% marginal rate, two extra allowances are worth $1,892 of withholding.
  assert.equal(two.withholding - four.withholding, 0.22 * 2 * 4_300);
});

test('a legacy W-4 cannot reach the head-of-household schedule', () => {
  const r = annual({
    filingStatus: 'headOfHousehold',
    w4: { revision: '2019OrEarlier', allowances: 2 },
  });
  assert.equal(r.column, 'singleOrMarriedFilingSeparately');
  assert.match(r.notes.join(' '), /no head-of-household box/);
  assert.ok(r.withholding > annual({ filingStatus: 'headOfHousehold' }).withholding);
});

test('"withhold at higher single rate" moves a married filer to the single column', () => {
  const r = annual({
    filingStatus: 'marriedFilingJointly',
    w4: { revision: '2019OrEarlier', allowances: 3, withholdAtHigherSingleRate: true },
  });
  assert.equal(r.column, 'singleOrMarriedFilingSeparately');
  assert.match(r.notes.join(' '), /higher single rate/);
});

// --------------------------------------------------------------------------
// Worksheet 1A, line by line
// --------------------------------------------------------------------------

test('a biweekly paycheck, worked through Worksheet 1A', () => {
  // $3,000 biweekly, single, 2026, blank W-4.
  //   1c  3,000 x 26                        = 78,000
  //   1g  single add-back                    =  8,600
  //   1i  adjusted annual wage               = 69,400
  //   2   through the single schedule: 0% to 7,500, 10% to 19,900,
  //       12% to 57,900, 22% above
  //       1,240.00 + 4,560.00 + 2,530.00     =  8,330.00
  //   per period 8,330 / 26                  =    320.38
  const r = computeWithholding({
    wagesThisPeriod: 3_000,
    filingStatus: 'single',
    payPeriod: 'biweekly',
    year: 2026,
  });
  assert.equal(r.adjustedAnnualWage, 69_400);
  assert.equal(r.tentativeAnnualWithholding, 8_330);
  assert.equal(r.withholding, 320.38);
  assert.equal(r.column, 'singleOrMarriedFilingSeparately');
  assert.equal(r.schedule, 'standard');
  assert.equal(r.payPeriodsPerYear, 26);
  assert.equal(r.marginalRate, 0.22);
});

test('Step 4(a) other income and Step 4(b) deductions move the adjusted wage', () => {
  const base = annual().adjustedAnnualWage;
  assert.equal(annual({ w4: { otherIncome: 5_000 } }).adjustedAnnualWage, base + 5_000);
  assert.equal(annual({ w4: { deductions: 5_000 } }).adjustedAnnualWage, base - 5_000);
  // And they cancel, which is the only reason both lines exist on the form.
  assert.equal(
    annual({ w4: { otherIncome: 5_000, deductions: 5_000 } }).adjustedAnnualWage,
    base,
  );
});

test('Step 3 credits come off the annual withholding dollar for dollar', () => {
  const base = annual({ payPeriod: 'monthly', wagesThisPeriod: 8_000 });
  const withCredit = annual({
    payPeriod: 'monthly',
    wagesThisPeriod: 8_000,
    w4: { dependentsCredit: 4_400 },
  });
  assert.equal(withCredit.annualCreditsApplied, 4_400);
  // Step 3 does not change the tentative withholding — it is subtracted from it.
  assert.equal(base.tentativeAnnualWithholding, withCredit.tentativeAnnualWithholding);
  // And the whole $4,400 reaches the paycheck, up to the cent of rounding that
  // twelve paychecks spread four cents of error across.
  assert.ok(
    Math.abs((base.withholdingBeforeExtra - withCredit.withholdingBeforeExtra) * 12 - 4_400) < 0.1,
  );
});

test('Step 3 credits cannot make withholding negative, and the note says so', () => {
  const r = computeWithholding({
    wagesThisPeriod: 2_500,
    filingStatus: 'marriedFilingJointly',
    payPeriod: 'monthly',
    year: 2026,
    w4: { dependentsCredit: 6_600 },
  });
  assert.equal(r.withholding, 0);
  assert.equal(r.marginalRate, 0);
  assert.ok(r.annualCreditsApplied < 6_600);
  assert.match(r.notes.join(' '), /exceed the tentative withholding/);
});

test('Step 4(c) extra withholding is added after everything else', () => {
  const base = annual({ payPeriod: 'biweekly', wagesThisPeriod: 3_000 });
  const extra = annual({
    payPeriod: 'biweekly',
    wagesThisPeriod: 3_000,
    w4: { extraWithholding: 50 },
  });
  assert.equal(extra.withholding, base.withholding + 50);
  assert.equal(extra.withholdingBeforeExtra, base.withholdingBeforeExtra);
});

test('whole-dollar rounding is offered because Publication 15-T offers it', () => {
  const r = annual({ payPeriod: 'biweekly', wagesThisPeriod: 3_000, roundToWholeDollars: true });
  assert.equal(r.withholding, 320);
});

test('the marginal rate is measured, not read off the schedule', () => {
  // Sitting inside the 12% band, one more dollar of biweekly wage costs 12 cents.
  const r = computeWithholding({
    wagesThisPeriod: 1_500,
    filingStatus: 'single',
    payPeriod: 'biweekly',
    year: 2026,
  });
  assert.equal(r.marginalRate, 0.12);
  assert.equal(
    withholdingMarginalRateAt({
      adjustedAnnualWage: r.adjustedAnnualWage,
      column: 'singleOrMarriedFilingSeparately',
      year: 2026,
    }),
    0.12,
  );
  // Inside the zero band nothing is withheld and nothing more is either.
  const low = computeWithholding({
    wagesThisPeriod: 200,
    filingStatus: 'single',
    payPeriod: 'weekly',
    year: 2026,
  });
  assert.equal(low.withholding, 0);
  assert.equal(low.marginalRate, 0);
});

// --------------------------------------------------------------------------
// Pay periods and filing statuses
// --------------------------------------------------------------------------

test('every pay period annualises to the same withholding', () => {
  const salary = 96_000;
  const results = PAY_PERIODS.map((payPeriod) =>
    computeWithholding({
      wagesThisPeriod: salary / PAY_PERIODS_PER_YEAR[payPeriod],
      filingStatus: 'single',
      payPeriod,
      year: 2026,
    }),
  );
  for (const r of results) {
    assert.equal(r.tentativeAnnualWithholding, results[0].tentativeAnnualWithholding, r.payPeriod);
    // Per-period rounding to cents is real money once you multiply it back up:
    // 260 daily paychecks can each be half a cent off. Half a dollar is the
    // honest tolerance, and the pre-rounding annual figure above is exact.
    assert.ok(
      Math.abs(r.annualizedWithholding - results[0].annualizedWithholding) < 0.75,
      `${r.payPeriod} ${r.annualizedWithholding}`,
    );
  }
  assert.equal(PAY_PERIODS_PER_YEAR.daily, 260);
});

test('an unknown pay period throws rather than guessing', () => {
  assert.throws(
    () => computeWithholding({ wagesThisPeriod: 100, filingStatus: 'single', payPeriod: 'fortnightly' }),
    /Unknown pay period/,
  );
});

test('the five filing statuses collapse into the three W-4 columns', () => {
  assert.equal(withholdingColumn('single'), 'singleOrMarriedFilingSeparately');
  assert.equal(withholdingColumn('marriedFilingSeparately'), 'singleOrMarriedFilingSeparately');
  assert.equal(withholdingColumn('marriedFilingJointly'), 'marriedFilingJointly');
  assert.equal(withholdingColumn('qualifyingSurvivingSpouse'), 'marriedFilingJointly');
  assert.equal(withholdingColumn('headOfHousehold'), 'headOfHousehold');
  assert.throws(() => withholdingColumn('sole'), /Unknown filing status/);
});

test('a surviving spouse withholds exactly as a joint filer does', () => {
  assert.equal(
    annual({ filingStatus: 'qualifyingSurvivingSpouse' }).withholding,
    annual({ filingStatus: 'marriedFilingJointly' }).withholding,
  );
});

test('married filing separately is withheld on the single schedule, and is told so', () => {
  const r = annual({ filingStatus: 'marriedFilingSeparately' });
  assert.equal(r.column, 'singleOrMarriedFilingSeparately');
  assert.equal(r.withholding, annual({ filingStatus: 'single' }).withholding);
  assert.match(r.notes.join(' '), /37% band begins at \$640,600/);

  // The gap is real: at $700,000 of wages an MFS return is in the 37% band and
  // the tables are still withholding 35%.
  const high = annual({ filingStatus: 'marriedFilingSeparately', wagesThisPeriod: 700_000 });
  const owed = federalIncomeTax({
    taxableIncome: 700_000 - 16_100,
    filingStatus: 'marriedFilingSeparately',
    year: 2026,
  }).tax;
  assert.ok(owed - high.withholding > 2_900);
});

// --------------------------------------------------------------------------
// The whole paycheck
// --------------------------------------------------------------------------

test('a paycheck: federal withholding plus employee FICA', () => {
  const p = computePaycheck({
    wagesThisPeriod: 3_000,
    filingStatus: 'single',
    payPeriod: 'biweekly',
    year: 2026,
  });
  assert.equal(p.federalIncomeTax.withholding, 320.38);
  assert.equal(p.socialSecurity, 186); // 3,000 x 6.2%
  assert.equal(p.medicare, 43.5); // 3,000 x 1.45%
  assert.equal(p.additionalMedicare, 0);
  assert.equal(p.ficaTotal, 229.5);
  assert.equal(p.totalWithheld, 549.88);
  assert.equal(p.takeHomeAfterFederal, 2_450.12);
  // The employer matches OASDI and Medicare and never the 0.9%.
  assert.equal(p.employerFica.total, 229.5);
});

test('a 401(k) deferral reduces income tax withholding but not FICA', () => {
  const p = computePaycheck({
    wagesThisPeriod: 2_700, // after a $300 pre-tax deferral
    ficaWagesThisPeriod: 3_000,
    filingStatus: 'single',
    payPeriod: 'biweekly',
    year: 2026,
  });
  assert.equal(p.socialSecurity, 186);
  assert.equal(p.medicare, 43.5);
  assert.ok(p.federalIncomeTax.withholding < 320.38);
});

test('the Social Security wage base is applied per employer, year to date', () => {
  const p = computePaycheck({
    wagesThisPeriod: 20_000,
    filingStatus: 'single',
    payPeriod: 'semimonthly',
    year: 2026,
    yearToDateSocialSecurityWages: 175_000,
  });
  // Only $9,500 of the $20,000 is still under the $184,500 base.
  assert.equal(p.socialSecurityWagesThisPeriod, 9_500);
  assert.equal(p.socialSecurity, 589);
  assert.equal(p.medicare, 290); // uncapped
  assert.match(p.notes.join(' '), /crosses the Social Security wage base/);

  const after = computePaycheck({
    wagesThisPeriod: 20_000,
    filingStatus: 'single',
    payPeriod: 'semimonthly',
    year: 2026,
    yearToDateSocialSecurityWages: 190_000,
  });
  assert.equal(after.socialSecurity, 0);
  assert.match(after.notes.join(' '), /wage base with this employer/);
});

test('Additional Medicare withholding ignores filing status, and both errors are real', () => {
  // Over-withheld: one $230,000 earner with a non-earning spouse. The employer
  // must withhold on $30,000; the couple owes nothing on Form 8959.
  const single = computePaycheck({
    wagesThisPeriod: 30_000,
    filingStatus: 'marriedFilingJointly',
    payPeriod: 'annual',
    year: 2026,
    yearToDateMedicareWages: 200_000,
  });
  assert.equal(single.additionalMedicare, 270);

  // Under-withheld: two $150,000 earners. Neither employer withholds a cent and
  // the couple owes $450.
  const each = computePaycheck({
    wagesThisPeriod: 150_000,
    filingStatus: 'marriedFilingJointly',
    payPeriod: 'annual',
    year: 2026,
  });
  assert.equal(each.additionalMedicare, 0);
  assert.equal(
    getYearParameters(2026).withholding.additionalMedicareWithholdingThreshold,
    200_000,
  );
});

test('a paycheck that straddles $200,000 of year-to-date Medicare wages', () => {
  const p = computePaycheck({
    wagesThisPeriod: 25_000,
    filingStatus: 'single',
    payPeriod: 'monthly',
    year: 2026,
    yearToDateMedicareWages: 190_000,
  });
  // Only $15,000 of the $25,000 is above the threshold.
  assert.equal(p.additionalMedicare, 135);
  assert.match(p.notes.join(' '), /regardless of filing status/);
});

// --------------------------------------------------------------------------
// Planning
// --------------------------------------------------------------------------

test('a plan that is already on target asks for nothing', () => {
  const target = federalIncomeTax({
    taxableIncome: 100_000 - 16_100,
    filingStatus: 'single',
    year: 2026,
  }).tax;
  const plan = withholdingPlan({
    wagesThisPeriod: 100_000 / 26,
    filingStatus: 'single',
    payPeriod: 'biweekly',
    year: 2026,
    targetAnnualTax: target,
  });
  assert.ok(Math.abs(plan.shortfall) < 0.5);
  assert.equal(plan.extraWithholdingPerPeriod, 0);
  assert.equal(plan.payPeriodsRemaining, 26);
});

test('a plan closes a shortfall over the periods that are left', () => {
  const plan = withholdingPlan({
    wagesThisPeriod: 4_000,
    filingStatus: 'single',
    payPeriod: 'monthly',
    year: 2026,
    targetAnnualTax: 12_000,
    payPeriodsRemaining: 5,
    withheldToDate: 3_500,
  });
  const perPeriod = computeWithholding({
    wagesThisPeriod: 4_000,
    filingStatus: 'single',
    payPeriod: 'monthly',
    year: 2026,
  }).withholding;
  assert.equal(plan.projectedAnnualWithholding, Math.round((3_500 + 5 * perPeriod) * 100) / 100);
  assert.equal(plan.shortfall, Math.round((12_000 - plan.projectedAnnualWithholding) * 100) / 100);
  assert.equal(
    plan.extraWithholdingPerPeriod,
    Math.round((plan.shortfall / 5) * 100) / 100,
  );
  assert.match(plan.notes.join(' '), /6654\(g\)/);
});

test('a plan with no periods left says so instead of dividing by zero', () => {
  const plan = withholdingPlan({
    wagesThisPeriod: 4_000,
    filingStatus: 'single',
    payPeriod: 'monthly',
    year: 2026,
    targetAnnualTax: 12_000,
    payPeriodsRemaining: 0,
    withheldToDate: 3_500,
  });
  assert.equal(plan.extraWithholdingPerPeriod, 0);
  assert.equal(plan.shortfall, 8_500);
  assert.match(plan.notes.join(' '), /No pay periods remain/);
});

// --------------------------------------------------------------------------
// Edges
// --------------------------------------------------------------------------

test('zero and negative wages withhold nothing', () => {
  for (const wagesThisPeriod of [0, -500]) {
    const r = annual({ wagesThisPeriod, payPeriod: 'weekly' });
    assert.equal(r.withholding, 0);
    assert.equal(r.adjustedAnnualWage, 0);
  }
});

test('an unsupported year throws', () => {
  assert.throws(() => annual({ year: 2019 }), /not supported/);
  assert.throws(
    () => withholdingRateSchedule({ column: 'single', year: 2026 }),
    /Unknown withholding column/,
  );
});

test('withholding rises monotonically with wages in every column and year', () => {
  for (const year of [2024, 2025, 2026]) {
    for (const filingStatus of ['single', 'marriedFilingJointly', 'headOfHousehold']) {
      let previous = -1;
      for (let wage = 0; wage <= 400_000; wage += 2_500) {
        const w = computeWithholding({
          wagesThisPeriod: wage,
          filingStatus,
          payPeriod: 'annual',
          year,
        }).withholding;
        assert.ok(w >= previous, `${year} ${filingStatus} at ${wage}`);
        previous = w;
      }
    }
  }
});
