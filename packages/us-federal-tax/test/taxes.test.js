import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  YEAR_2026,
  additionalMedicareTax,
  federalIncomeTax,
  ficaTax,
  getYearParameters,
  longTermCapitalGainsTax,
  netInvestmentIncomeTax,
  selfEmploymentTax,
  standardDeduction,
  UnsupportedYearError,
} from '../dist/esm/index.js';

/** Assert two dollar amounts agree to the cent. */
const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

test('single filer, $100,000 taxable income (hand-computed)', () => {
  // 10% x 12,400            =  1,240.00
  // 12% x (50,400 - 12,400) =  4,560.00
  // 22% x (100,000 - 50,400) = 10,912.00
  //                          -----------
  //                            16,712.00
  const r = federalIncomeTax({ taxableIncome: 100_000, filingStatus: 'single', year: 2026 });
  money(r.tax, 16_712, 'tax');
  assert.equal(r.marginalRate, 0.22);
  money(r.effectiveRate * 100, 16.712, 'effective rate %');
  assert.equal(r.brackets.length, 3);
});

test('married filing jointly, $200,000 taxable income (hand-computed)', () => {
  // 10% x 24,800             =  2,480.00
  // 12% x (100,800 - 24,800) =  9,120.00
  // 22% x (200,000 - 100,800)= 21,824.00
  //                           -----------
  //                             33,424.00
  const r = federalIncomeTax({
    taxableIncome: 200_000,
    filingStatus: 'marriedFilingJointly',
    year: 2026,
  });
  money(r.tax, 33_424, 'tax');
  assert.equal(r.marginalRate, 0.22);
});

test('top bracket is reached and taxed at 37%', () => {
  const r = federalIncomeTax({ taxableIncome: 1_000_000, filingStatus: 'single', year: 2026 });
  assert.equal(r.marginalRate, 0.37);
  // Last band: 37% x (1,000,000 - 640,600) = 132,978
  const top = r.brackets[r.brackets.length - 1];
  assert.equal(top.rate, 0.37);
  money(top.tax, 132_978, 'top band tax');
});

test('marginal rate at an exact bracket boundary is the next dollar rate', () => {
  const r = federalIncomeTax({ taxableIncome: 12_400, filingStatus: 'single', year: 2026 });
  money(r.tax, 1_240, 'tax');
  assert.equal(r.marginalRate, 0.12, 'the next dollar is taxed at 12%');
});

test('zero and negative taxable income produce no tax', () => {
  for (const amount of [0, -5000]) {
    const r = federalIncomeTax({ taxableIncome: amount, filingStatus: 'single', year: 2026 });
    money(r.tax, 0);
    assert.equal(r.effectiveRate, 0);
  }
});

test('head of household brackets diverge from single above the 22% band', () => {
  const hoh = getYearParameters(2026).ordinaryBrackets.headOfHousehold;
  const single = getYearParameters(2026).ordinaryBrackets.single;
  // The IRS publishes HoH $25 below single at the 24% and 32% ceilings.
  assert.equal(hoh[3].upTo, 201_750);
  assert.equal(single[3].upTo, 201_775);
  assert.equal(hoh[0].upTo, 17_700);
});

test('married filing separately caps the 35% band at half the joint figure', () => {
  const p = getYearParameters(2026).ordinaryBrackets;
  assert.equal(p.marriedFilingSeparately[5].upTo, 384_350);
  assert.equal(p.marriedFilingJointly[5].upTo, 768_700);
});

test('self-employment tax on $100,000 net profit (hand-computed)', () => {
  // net earnings = 100,000 x 0.9235 = 92,350
  // OASDI        = 92,350 x 0.124   = 11,451.40
  // Medicare     = 92,350 x 0.029   =  2,678.15
  //                                   ----------
  //                                    14,129.55
  const r = selfEmploymentTax({ netProfit: 100_000, year: 2026 });
  money(r.netEarnings, 92_350, 'net earnings');
  money(r.socialSecurity, 11_451.4, 'oasdi');
  money(r.medicare, 2_678.15, 'medicare');
  money(r.total, 14_129.55, 'total');
  money(r.deductibleHalf, 7_064.78, 'deductible half');
  assert.equal(r.belowThreshold, false);
});

test('SE Social Security is capped at the wage base', () => {
  // Independently published figure: the maximum 2026 SE Social Security tax is
  // 184,500 x 12.4% = $22,878.00 exactly.
  const r = selfEmploymentTax({ netProfit: 250_000, year: 2026 });
  money(r.socialSecurity, 22_878, 'capped oasdi');
  // 230,875 x 2.9% = 6,695.375, which rounds up to the cent.
  money(r.medicare, 6_695.38, 'uncapped medicare');
});

test('W-2 wages consume the Social Security wage base before SE income', () => {
  // $150,000 of wages leaves 184,500 - 150,000 = 34,500 of base for SE income.
  const r = selfEmploymentTax({
    netProfit: 100_000,
    w2SocialSecurityWages: 150_000,
    year: 2026,
  });
  money(r.socialSecurity, 34_500 * 0.124, 'oasdi on remaining base');
  money(r.medicare, 92_350 * 0.029, 'medicare unaffected');
});

test('wages above the base leave no room for SE Social Security tax', () => {
  const r = selfEmploymentTax({
    netProfit: 50_000,
    w2SocialSecurityWages: 200_000,
    year: 2026,
  });
  money(r.socialSecurity, 0, 'no oasdi left');
  assert.ok(r.medicare > 0, 'medicare still applies');
});

test('the $400 net earnings floor suppresses SE tax', () => {
  // 400 x 0.9235 = 369.40, below the floor.
  const under = selfEmploymentTax({ netProfit: 400, year: 2026 });
  assert.equal(under.belowThreshold, true);
  money(under.total, 0);

  // 500 x 0.9235 = 461.75, above the floor.
  const over = selfEmploymentTax({ netProfit: 500, year: 2026 });
  assert.equal(over.belowThreshold, false);
  assert.ok(over.total > 0);
});

test('deductibleHalf excludes Additional Medicare Tax', () => {
  const r = selfEmploymentTax({ netProfit: 400_000, year: 2026 });
  // Exactly half of the Schedule SE total, with no 0.9% component mixed in.
  money(r.deductibleHalf, r.total / 2, 'half of schedule SE only');
  const extra = additionalMedicareTax({
    filingStatus: 'single',
    selfEmploymentEarnings: r.netEarnings,
    year: 2026,
  });
  assert.ok(extra > 0, 'additional medicare is owed at this income');
  assert.ok(r.total < r.total + extra, 'and is tracked separately');
});

test('additional Medicare tax thresholds by filing status', () => {
  money(
    additionalMedicareTax({ filingStatus: 'single', wages: 230_875, year: 2026 }),
    (230_875 - 200_000) * 0.009,
    'single',
  );
  money(
    additionalMedicareTax({ filingStatus: 'marriedFilingJointly', wages: 230_875, year: 2026 }),
    0,
    'joint threshold not reached',
  );
  money(
    additionalMedicareTax({ filingStatus: 'marriedFilingSeparately', wages: 200_000, year: 2026 }),
    (200_000 - 125_000) * 0.009,
    'separate',
  );
});

test('additional Medicare combines wages and self-employment earnings', () => {
  const r = additionalMedicareTax({
    filingStatus: 'single',
    wages: 150_000,
    selfEmploymentEarnings: 100_000,
    year: 2026,
  });
  money(r, (250_000 - 200_000) * 0.009, 'combined excess');
});

test('FICA on $200,000 of wages (hand-computed)', () => {
  // OASDI    = min(200,000, 184,500) x 6.2% = 11,439.00
  // Medicare = 200,000 x 1.45%              =  2,900.00
  // Additional Medicare: excess over 200,000 is zero.
  const r = ficaTax({ wages: 200_000, filingStatus: 'single', year: 2026 });
  money(r.employee.socialSecurity, 11_439, 'employee oasdi');
  money(r.employee.medicare, 2_900, 'employee medicare');
  money(r.employee.additionalMedicare, 0, 'no additional medicare at exactly the threshold');
  money(r.employee.total, 14_339, 'employee total');
});

test('employers match FICA but never pay Additional Medicare Tax', () => {
  const r = ficaTax({ wages: 300_000, filingStatus: 'single', year: 2026 });
  money(r.employer.socialSecurity, r.employee.socialSecurity, 'oasdi matched');
  money(r.employer.medicare, r.employee.medicare, 'medicare matched');
  assert.ok(r.employee.additionalMedicare > 0, 'employee owes the 0.9%');
  money(r.employer.total, r.employer.socialSecurity + r.employer.medicare, 'employer excludes 0.9%');
});

test('long-term capital gains stack on top of ordinary income', () => {
  // Ordinary taxable 40,000; gain 20,000. The 0% ceiling for a single filer is
  // 49,450, so 9,450 of gain is free and the remaining 10,550 is taxed at 15%.
  const r = longTermCapitalGainsTax({
    ordinaryTaxableIncome: 40_000,
    longTermGains: 20_000,
    filingStatus: 'single',
    year: 2026,
  });
  money(r.tax, 10_550 * 0.15, 'stacked gain tax');
  assert.equal(r.brackets[0].rate, 0);
  money(r.brackets[0].incomeInBracket, 9_450, '0% portion');
});

test('a gain entirely below the 0% ceiling is untaxed', () => {
  const r = longTermCapitalGainsTax({
    ordinaryTaxableIncome: 10_000,
    longTermGains: 20_000,
    filingStatus: 'single',
    year: 2026,
  });
  money(r.tax, 0, 'fully in the 0% band');
});

test('a gain stacked above the 20% threshold reaches 20%', () => {
  const r = longTermCapitalGainsTax({
    ordinaryTaxableIncome: 600_000,
    longTermGains: 100_000,
    filingStatus: 'single',
    year: 2026,
  });
  // 545,500 is the 15% ceiling, so the first 0 dollars are at 15%... ordinary
  // income already exceeds it, meaning the whole gain sits in the 20% band.
  money(r.tax, 100_000 * 0.2, 'entirely 20%');
});

test('net investment income tax takes the lesser of NII and MAGI excess', () => {
  // MAGI excess = 20,000; NII = 50,000 -> 3.8% x 20,000
  money(
    netInvestmentIncomeTax({
      modifiedAdjustedGrossIncome: 220_000,
      netInvestmentIncome: 50_000,
      filingStatus: 'single',
      year: 2026,
    }),
    20_000 * 0.038,
    'limited by MAGI excess',
  );
  // MAGI excess = 100,000; NII = 10,000 -> 3.8% x 10,000
  money(
    netInvestmentIncomeTax({
      modifiedAdjustedGrossIncome: 300_000,
      netInvestmentIncome: 10_000,
      filingStatus: 'single',
      year: 2026,
    }),
    10_000 * 0.038,
    'limited by NII',
  );
  // Below the threshold entirely.
  money(
    netInvestmentIncomeTax({
      modifiedAdjustedGrossIncome: 100_000,
      netInvestmentIncome: 50_000,
      filingStatus: 'single',
      year: 2026,
    }),
    0,
    'below threshold',
  );
});

test('qualifying surviving spouse uses different NIIT and Form 8959 thresholds', () => {
  const p = getYearParameters(2026);
  assert.equal(p.additionalMedicareThreshold.qualifyingSurvivingSpouse, 200_000);
  assert.equal(p.niit.thresholds.qualifyingSurvivingSpouse, 250_000);
});

test('standard deduction with age and blindness additions', () => {
  money(standardDeduction({ filingStatus: 'single', year: 2026 }), 16_100);
  money(standardDeduction({ filingStatus: 'marriedFilingJointly', year: 2026 }), 32_200);
  money(standardDeduction({ filingStatus: 'headOfHousehold', year: 2026 }), 24_150);

  // Single, 65+: 16,100 + 2,050
  money(standardDeduction({ filingStatus: 'single', year: 2026, age65OrOlder: true }), 18_150);
  // Single, 65+ and blind: two additions.
  money(
    standardDeduction({ filingStatus: 'single', year: 2026, age65OrOlder: true, blind: true }),
    20_200,
  );
  // Joint, both spouses 65+: 32,200 + 2 x 1,650
  money(
    standardDeduction({
      filingStatus: 'marriedFilingJointly',
      year: 2026,
      age65OrOlder: true,
      spouseAge65OrOlder: true,
    }),
    35_500,
  );
});

test('spouse additions are ignored when not filing jointly', () => {
  money(
    standardDeduction({ filingStatus: 'single', year: 2026, spouseAge65OrOlder: true }),
    16_100,
  );
});

test('unsupported years throw rather than silently using the wrong brackets', () => {
  assert.throws(
    () => federalIncomeTax({ taxableIncome: 50_000, filingStatus: 'single', year: 1999 }),
    UnsupportedYearError,
  );
});

test('every bracket table is monotonic and ends at Infinity', () => {
  for (const [status, brackets] of Object.entries(YEAR_2026.ordinaryBrackets)) {
    let prev = 0;
    for (const b of brackets) {
      assert.ok(b.upTo > prev, `${status}: thresholds must strictly increase`);
      assert.ok(b.rate > 0 && b.rate < 1, `${status}: rate out of range`);
      prev = b.upTo;
    }
    assert.equal(brackets[brackets.length - 1].upTo, Infinity, `${status}: must end open-ended`);
  }
  for (const [status, brackets] of Object.entries(YEAR_2026.longTermCapitalGains)) {
    assert.equal(brackets[brackets.length - 1].upTo, Infinity, `${status}: LTCG must end open-ended`);
  }
});

test('bracket detail sums back to the reported total', () => {
  for (const income of [1, 12_400, 60_000, 250_000, 900_000]) {
    const r = federalIncomeTax({ taxableIncome: income, filingStatus: 'single', year: 2026 });
    const summed = r.brackets.reduce((acc, b) => acc + b.tax, 0);
    money(summed, r.tax, `bracket details sum at ${income}`);
    const incomeSum = r.brackets.reduce((acc, b) => acc + b.incomeInBracket, 0);
    money(incomeSum, income, `bracket income sums at ${income}`);
  }
});
