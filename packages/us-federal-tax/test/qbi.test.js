import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateFederalTax,
  getYearParameters,
  qbiDeduction,
  section199AParameters,
} from '../dist/esm/index.js';

/** Shorthand: one non-SSTB business with no wages and no property. */
const business = (qualifiedBusinessIncome, extra = {}) => ({
  qualifiedBusinessIncome,
  ...extra,
});

// --------------------------------------------------------------------------
// Parameters
// --------------------------------------------------------------------------

test('2026 threshold amounts, including the $25 split for a separate return', () => {
  const p = section199AParameters(2026);
  assert.equal(p.thresholdAmount.single, 201_750);
  assert.equal(p.thresholdAmount.headOfHousehold, 201_750);
  assert.equal(p.thresholdAmount.marriedFilingJointly, 403_500);
  assert.equal(p.thresholdAmount.qualifyingSurvivingSpouse, 403_500);
  // Not a typo: § 1(f)(7) rounds a separate return's adjustment to $25 and
  // everyone else's to $50, and 2026 lands between the two.
  assert.equal(p.thresholdAmount.marriedFilingSeparately, 201_775);
  assert.equal(
    p.thresholdAmount.marriedFilingSeparately - p.thresholdAmount.single,
    25,
  );
});

test('2026 uses the widened OBBBA phase-in range, not the old $50k/$100k', () => {
  const p = section199AParameters(2026);
  assert.equal(p.phaseInRange.single, 75_000);
  assert.equal(p.phaseInRange.headOfHousehold, 75_000);
  // Separate returns get the single-filer range, not half the joint range.
  assert.equal(p.phaseInRange.marriedFilingSeparately, 75_000);
  assert.equal(p.phaseInRange.marriedFilingJointly, 150_000);
  assert.equal(p.phaseInRange.qualifyingSurvivingSpouse, 150_000);
});

test('the § 199A(i) minimum deduction exists in 2026', () => {
  const p = section199AParameters(2026);
  assert.equal(p.minimumDeduction.amount, 400);
  assert.equal(p.minimumDeduction.activeQualifiedBusinessIncomeFloor, 1_000);
});

test('section199A parameters are reachable from the year parameters', () => {
  assert.equal(getYearParameters(2026).section199A.deductionRate, 0.2);
});

// --------------------------------------------------------------------------
// Below the threshold: a flat 20%, and none of the limitations bite
// --------------------------------------------------------------------------

test('below the threshold the deduction is a flat 20% of QBI', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 100_000,
    businesses: [business(80_000)],
  });
  assert.equal(r.reductionRatio, 0);
  assert.equal(r.qbiComponent, 16_000);
  assert.equal(r.deduction, 16_000);
  assert.equal(r.limitedByTaxableIncome, false);
});

test('below the threshold, paying no wages costs nothing', () => {
  const withWages = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 100_000,
    businesses: [business(80_000, { w2Wages: 60_000 })],
  });
  const withoutWages = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 100_000,
    businesses: [business(80_000)],
  });
  assert.equal(withWages.deduction, withoutWages.deduction);
  assert.equal(withoutWages.deduction, 16_000);
});

test('below the threshold, being an SSTB costs nothing', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 100_000,
    businesses: [business(80_000, { isSpecifiedServiceTradeOrBusiness: true })],
  });
  assert.equal(r.applicablePercentage, 1);
  assert.equal(r.businesses[0].applicablePercentage, 1);
  assert.equal(r.deduction, 16_000);
});

// --------------------------------------------------------------------------
// Above the range: the wage / property cap binds in full
// --------------------------------------------------------------------------

test('above the range the 50%-of-wages cap binds', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [business(300_000, { w2Wages: 40_000 })],
  });
  assert.equal(r.reductionRatio, 1);
  const [b] = r.businesses;
  assert.equal(b.tentativeDeduction, 60_000);
  assert.equal(b.wageAndPropertyLimit, 20_000); // max(50% × 40k, 25% × 40k + 0)
  assert.equal(b.phaseInReduction, 40_000);
  assert.equal(r.deduction, 20_000);
});

test('the 25%-plus-2.5%-of-property alternative cap can win', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [
      business(300_000, { w2Wages: 40_000, unadjustedBasisOfQualifiedProperty: 2_000_000 }),
    ],
  });
  // max(20,000, 10,000 + 50,000) = 60,000, which is not below 20% of QBI.
  assert.equal(r.businesses[0].wageAndPropertyLimit, 60_000);
  assert.equal(r.businesses[0].phaseInReduction, 0);
  assert.equal(r.deduction, 60_000);
});

test('an SSTB above the range is worth nothing at all', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 300_000,
    businesses: [
      business(200_000, { w2Wages: 100_000, isSpecifiedServiceTradeOrBusiness: true }),
    ],
  });
  assert.equal(r.applicablePercentage, 0);
  assert.equal(r.businesses[0].includedQualifiedBusinessIncome, 0);
  assert.equal(r.businesses[0].includedW2Wages, 0);
  assert.equal(r.deduction, 0);
});

// --------------------------------------------------------------------------
// Inside the phase-in range
// --------------------------------------------------------------------------

test('halfway through the range, half the excess over the cap is taken back', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    // 201,750 + 37,500 — exactly half of the $75,000 range.
    taxableIncomeBeforeQbiDeduction: 239_250,
    businesses: [business(150_000, { w2Wages: 20_000 })],
  });
  assert.equal(r.reductionRatio, 0.5);
  const [b] = r.businesses;
  assert.equal(b.tentativeDeduction, 30_000);
  assert.equal(b.wageAndPropertyLimit, 10_000);
  assert.equal(b.phaseInReduction, 10_000); // 0.5 × (30,000 − 10,000)
  assert.equal(r.deduction, 20_000);
});

test('an SSTB in the range loses its wages and property, not just its income', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 239_250,
    businesses: [
      business(150_000, { w2Wages: 20_000, isSpecifiedServiceTradeOrBusiness: true }),
    ],
  });
  const [b] = r.businesses;
  assert.equal(b.applicablePercentage, 0.5);
  assert.equal(b.includedQualifiedBusinessIncome, 75_000);
  assert.equal(b.includedW2Wages, 10_000);
  assert.equal(b.tentativeDeduction, 15_000);
  assert.equal(b.wageAndPropertyLimit, 5_000);
  assert.equal(b.phaseInReduction, 5_000); // 0.5 × (15,000 − 5,000)
  assert.equal(r.deduction, 10_000);
});

test('the joint range is $150,000 in 2026 — the old $100,000 would halve this', () => {
  const r = qbiDeduction({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    // 403,500 + 75,000: halfway under the new range, three-quarters under the old.
    taxableIncomeBeforeQbiDeduction: 478_500,
    businesses: [business(200_000)],
  });
  assert.equal(r.reductionRatio, 0.5);
  assert.equal(r.deduction, 20_000); // 40,000 − 0.5 × 40,000; the old range gave 10,000
});

test('a separate return uses the $75,000 range, not half the joint range', () => {
  const r = qbiDeduction({
    filingStatus: 'marriedFilingSeparately',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 239_275, // 201,775 + 37,500
    businesses: [business(200_000)],
  });
  assert.equal(r.reductionRatio, 0.5);
});

test('the $25 threshold gap between single and separate is worth real money', () => {
  const input = {
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 201_760,
    businesses: [business(100_000)],
  };
  const single = qbiDeduction({ ...input, filingStatus: 'single' });
  const separate = qbiDeduction({ ...input, filingStatus: 'marriedFilingSeparately' });

  // Single is $10 over its threshold; a separate return is $15 under its own.
  assert.equal(single.excessOverThreshold, 10);
  assert.equal(separate.excessOverThreshold, 0);
  assert.equal(single.deduction, 19_997.33); // 20,000 − (10/75,000) × 20,000
  assert.equal(separate.deduction, 20_000);
});

test('a qualifying surviving spouse uses the joint threshold', () => {
  const r = qbiDeduction({
    filingStatus: 'qualifyingSurvivingSpouse',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 300_000,
    businesses: [business(100_000)],
  });
  assert.equal(r.thresholdAmount, 403_500);
  assert.equal(r.reductionRatio, 0);
  assert.equal(r.deduction, 20_000);
});

// --------------------------------------------------------------------------
// Netting losses across businesses
// --------------------------------------------------------------------------

test('a loss is spread across profitable businesses in proportion to their income', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [
      business(60_000, { name: 'A' }),
      business(40_000, { name: 'B' }),
      business(-50_000, { name: 'C' }),
    ],
  });
  const byName = Object.fromEntries(r.businesses.map((b) => [b.name, b]));
  assert.equal(byName.A.netQualifiedBusinessIncome, 30_000); // 60,000 × 50/100
  assert.equal(byName.B.netQualifiedBusinessIncome, 20_000); // 40,000 × 50/100
  assert.equal(byName.C.netQualifiedBusinessIncome, 0);
  assert.equal(r.qualifiedBusinessNetLossCarryforward, 0);
});

test('proportional netting changes the answer when the wage cap binds', () => {
  // Both profitable businesses earn the same; only one pays wages. Netting the
  // loss against them proportionately halves each. Charging the whole loss to
  // the wageless business instead would double the deduction.
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [
      business(100_000, { name: 'no wages' }),
      business(100_000, { name: 'pays wages', w2Wages: 200_000 }),
      business(-100_000, { name: 'loss' }),
    ],
  });
  const byName = Object.fromEntries(r.businesses.map((b) => [b.name, b]));
  assert.equal(byName['no wages'].netQualifiedBusinessIncome, 50_000);
  assert.equal(byName['no wages'].component, 0); // capped at 50% of zero wages
  assert.equal(byName['pays wages'].netQualifiedBusinessIncome, 50_000);
  assert.equal(byName['pays wages'].component, 10_000);
  assert.equal(r.deduction, 10_000);
});

test('a net business loss zeroes the deduction and carries forward', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [business(50_000), business(-80_000)],
  });
  assert.equal(r.qbiComponent, 0);
  assert.equal(r.deduction, 0);
  assert.equal(r.qualifiedBusinessNetLossCarryforward, -30_000);
});

test('a prior-year loss carryforward brings no wages or property with it', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [business(200_000, { w2Wages: 500_000 })],
    qualifiedBusinessNetLossCarryforward: -50_000,
  });
  assert.equal(r.businesses[0].netQualifiedBusinessIncome, 150_000);
  assert.equal(r.deduction, 30_000);
});

test('a carryforward is a loss however the caller signs it', () => {
  const signed = (v) =>
    qbiDeduction({
      filingStatus: 'single',
      year: 2026,
      taxableIncomeBeforeQbiDeduction: 400_000,
      businesses: [business(200_000, { w2Wages: 500_000 })],
      qualifiedBusinessNetLossCarryforward: v,
    }).deduction;
  assert.equal(signed(-50_000), signed(50_000));
  assert.equal(signed(50_000), 30_000);
});

// --------------------------------------------------------------------------
// REIT and PTP income
// --------------------------------------------------------------------------

test('REIT dividends get 20% with no wage or property cap, even above the range', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    qualifiedReitDividends: 50_000,
  });
  assert.equal(r.reductionRatio, 1);
  assert.equal(r.reitPtpComponent, 10_000);
  assert.equal(r.deduction, 10_000);
});

test('negative PTP income carries forward rather than reducing the QBI component', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 400_000,
    businesses: [business(100_000, { w2Wages: 400_000 })],
    qualifiedReitDividends: 10_000,
    qualifiedPtpIncome: -30_000,
  });
  assert.equal(r.qbiComponent, 20_000);
  assert.equal(r.reitPtpComponent, 0);
  assert.equal(r.reitPtpLossCarryforward, -20_000);
  assert.equal(r.deduction, 20_000);
});

// --------------------------------------------------------------------------
// The taxable income limit
// --------------------------------------------------------------------------

test('the deduction is capped at 20% of taxable income less net capital gain', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 50_000,
    netCapitalGain: 30_000,
    businesses: [business(60_000)],
  });
  assert.equal(r.combinedQualifiedBusinessIncomeAmount, 12_000);
  assert.equal(r.taxableIncomeLimit, 4_000); // 20% × (50,000 − 30,000)
  assert.equal(r.limitedByTaxableIncome, true);
  assert.equal(r.deduction, 4_000);
});

test('negative taxable income leaves no room under the limit', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: -5_000,
    businesses: [business(900)],
  });
  assert.equal(r.taxableIncomeLimit, 0);
  assert.equal(r.deduction, 0);
});

// --------------------------------------------------------------------------
// § 199A(i), the minimum deduction — new for 2026
// --------------------------------------------------------------------------

test('$1,000 of active QBI guarantees $400 even when the income limit is lower', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 800,
    businesses: [business(1_200)],
  });
  assert.equal(r.taxableIncomeLimit, 160);
  assert.equal(r.minimumDeduction, 400);
  assert.equal(r.appliedMinimumDeduction, true);
  assert.equal(r.deduction, 400);
});

test('the minimum does not apply below $1,000 of QBI', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 5_000,
    businesses: [business(900)],
  });
  assert.equal(r.minimumDeduction, 0);
  assert.equal(r.deduction, 180);
});

test('the minimum counts only businesses the taxpayer materially participates in', () => {
  const passive = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 1_000,
    businesses: [business(5_000, { materiallyParticipates: false })],
  });
  const active = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 1_000,
    businesses: [business(5_000)],
  });
  assert.equal(passive.minimumDeduction, 0);
  assert.equal(passive.deduction, 200); // 20% × 1,000, the taxable income limit
  assert.equal(active.deduction, 400);
});

test('the minimum applies to a small SSTB too, since it is not income-limited', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 40_000,
    businesses: [business(2_000, { isSpecifiedServiceTradeOrBusiness: true })],
  });
  assert.equal(r.deduction, 400); // the floor beats 20% × 2,000
});

// --------------------------------------------------------------------------
// Input handling
// --------------------------------------------------------------------------

test('no businesses at all produces a zero deduction, not a crash', () => {
  const r = qbiDeduction({
    filingStatus: 'single',
    year: 2026,
    taxableIncomeBeforeQbiDeduction: 100_000,
  });
  assert.equal(r.deduction, 0);
  assert.deepEqual(r.businesses, []);
});

test('an unknown filing status throws', () => {
  assert.throws(
    () =>
      qbiDeduction({
        filingStatus: 'martian',
        year: 2026,
        taxableIncomeBeforeQbiDeduction: 100_000,
      }),
    TypeError,
  );
});

test('a non-finite input throws rather than producing NaN', () => {
  assert.throws(
    () =>
      qbiDeduction({
        filingStatus: 'single',
        year: 2026,
        taxableIncomeBeforeQbiDeduction: Infinity,
      }),
    RangeError,
  );
  assert.throws(
    () =>
      qbiDeduction({
        filingStatus: 'single',
        year: 2026,
        taxableIncomeBeforeQbiDeduction: 100_000,
        businesses: [business('lots')],
      }),
    TypeError,
  );
});

// --------------------------------------------------------------------------
// Integration with estimateFederalTax
// --------------------------------------------------------------------------

test('Schedule 1-A reduces the income the § 199A phase-in is measured against', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    w2Wages: 220_000,
    otherOrdinaryIncome: 40_000,
    qualifiedTips: 20_000,
    qualifiedBusinesses: [{ qualifiedBusinessIncome: 60_000 }],
  });

  assert.equal(r.adjustedGrossIncome, 260_000);
  // Tips: min(20,000, 25,000 cap) less $100 per full $1,000 over $150,000.
  assert.equal(r.additionalDeductions.total, 9_000);

  // 260,000 − 16,100 standard − 9,000 Schedule 1-A. Skipping the last term
  // would give 243,900 and phase the deduction out faster than it should.
  assert.equal(r.section199A.taxableIncomeBeforeDeduction, 234_900);
  assert.equal(r.section199A.excessOverThreshold, 33_150);
  assert.equal(r.section199A.reductionRatio, 0.442);
  assert.equal(r.section199A.deduction, 6_696); // 12,000 − 0.442 × 12,000
  assert.equal(r.qualifiedBusinessIncomeDeduction, 6_696);
  assert.equal(r.taxableIncome, 228_204);
});

test('a supplied deduction is still honoured, and reports no Form 8995 detail', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 100_000,
    qualifiedBusinessIncomeDeduction: 17_000,
  });
  assert.equal(r.section199A, null);
  assert.equal(r.qualifiedBusinessIncomeDeduction, 17_000);
});

test('supplying businesses overrides a supplied deduction', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 100_000,
    qualifiedBusinessIncomeDeduction: 999_999,
    qualifiedBusinesses: [{ qualifiedBusinessIncome: 50_000 }],
  });
  assert.equal(r.qualifiedBusinessIncomeDeduction, 10_000);
});

test('the QBI deduction reduces taxable income and therefore tax', () => {
  const base = {
    filingStatus: 'single',
    year: 2026,
    selfEmploymentNetProfit: 120_000,
  };
  const without = estimateFederalTax(base);
  assert.equal(without.selfEmployment.deductibleHalf, 8_477.73);

  const with199A = estimateFederalTax({
    ...base,
    // QBI is net of the deductible half of SE tax: 120,000 − 8,477.73.
    qualifiedBusinesses: [{ qualifiedBusinessIncome: 111_522.27 }],
  });

  // 20% of QBI would be 22,304.45, but taxable income before the deduction is
  // only 111,522.27 − 16,100 = 95,422.27, and 20% of that is less. The taxable
  // income limit is the binding one for a sole proprietor with no other income,
  // which is the usual case and easy to miss.
  assert.equal(with199A.section199A.combinedQualifiedBusinessIncomeAmount, 22_304.45);
  assert.equal(with199A.section199A.taxableIncomeLimit, 19_084.45);
  assert.equal(with199A.section199A.limitedByTaxableIncome, true);
  assert.equal(with199A.qualifiedBusinessIncomeDeduction, 19_084.45);
  assert.equal(
    with199A.taxableIncome,
    Math.round((without.taxableIncome - 19_084.45) * 100) / 100,
  );
  assert.ok(with199A.totalTax < without.totalTax);
});
