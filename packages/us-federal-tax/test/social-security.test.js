import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOCIAL_SECURITY_TAXABILITY,
  YEAR_2024,
  YEAR_2025,
  YEAR_2026,
  estimateFederalTax,
  socialSecurityTaxability,
} from '../dist/esm/index.js';

const ss = (over) =>
  socialSecurityTaxability({
    filingStatus: 'single',
    year: 2026,
    socialSecurityBenefits: 30_000,
    adjustedGrossIncomeExcludingSocialSecurity: 0,
    ...over,
  });

// --------------------------------------------------------------------------
// Parameters — the point of which is that they never change
// --------------------------------------------------------------------------

test('the § 86 thresholds are literally the same object in every year', () => {
  // Not "equal to" — the *same* object. Three copies would imply three
  // independently sourced figures that happen to agree, when in fact there is
  // one figure that has not moved since 1993 while everything around it has
  // been indexed annually. If a future year ever has to fork this, the fork
  // should break this test and be explained in the journal.
  assert.equal(YEAR_2024.socialSecurity, SOCIAL_SECURITY_TAXABILITY);
  assert.equal(YEAR_2025.socialSecurity, SOCIAL_SECURITY_TAXABILITY);
  assert.equal(YEAR_2026.socialSecurity, SOCIAL_SECURITY_TAXABILITY);
});

test('§ 86(c) base and adjusted base amounts', () => {
  const p = SOCIAL_SECURITY_TAXABILITY;
  assert.equal(p.baseAmount.single, 25_000);
  assert.equal(p.baseAmount.marriedFilingJointly, 32_000);
  // Head of household and qualifying surviving spouse get the *single* figure.
  // § 86 knows only "a joint return", "a separate return" and everything else,
  // so the status that doubles the standard deduction is worth nothing here.
  assert.equal(p.baseAmount.headOfHousehold, 25_000);
  assert.equal(p.baseAmount.qualifyingSurvivingSpouse, 25_000);
  assert.equal(p.adjustedBaseAmount.single, 34_000);
  assert.equal(p.adjustedBaseAmount.marriedFilingJointly, 44_000);
  assert.equal(p.adjustedBaseAmount.headOfHousehold, 34_000);
  // § 86(a)(2)(A)(ii) is half the gap: $4,500 single, $6,000 joint.
  assert.equal(
    p.secondTierBracketFraction * (p.adjustedBaseAmount.single - p.baseAmount.single),
    4_500,
  );
  assert.equal(
    p.secondTierBracketFraction *
      (p.adjustedBaseAmount.marriedFilingJointly - p.baseAmount.marriedFilingJointly),
    6_000,
  );
});

// --------------------------------------------------------------------------
// Cross-check: PolicyEngine-US 2.3.0's own test fixtures, reproduced exactly
// --------------------------------------------------------------------------
//
// Six cases lifted from that project's `taxable_social_security_tier_1.yaml`,
// `taxable_social_security_tier_2.yaml` and `taxable_social_security.yaml`.
// PolicyEngine's `employment_income` produces no above-the-line deduction, so
// its AGI equals the wage figure and maps straight onto this package's
// `adjustedGrossIncomeExcludingSocialSecurity`.

test('PolicyEngine-US fixtures — single filer, 2024', () => {
  const at = (benefits, other) =>
    ss({
      year: 2024,
      socialSecurityBenefits: benefits,
      adjustedGrossIncomeExcludingSocialSecurity: other,
    }).taxableBenefits;

  // Combined $20,000 < $25,000 base.
  assert.equal(at(20_000, 10_000), 0);
  // Combined $30,000: tier 1. min(0.5 × 20,000, 0.5 × 5,000) = 2,500.
  assert.equal(at(20_000, 20_000), 2_500);
  // Combined $65,000: tier 2, and the 85% ceiling binds. 0.85 × 30,000.
  assert.equal(at(30_000, 50_000), 25_500);
});

test('PolicyEngine-US fixtures — joint filers, 2024', () => {
  const at = (benefits, other) =>
    ss({
      year: 2024,
      filingStatus: 'marriedFilingJointly',
      socialSecurityBenefits: benefits,
      adjustedGrossIncomeExcludingSocialSecurity: other,
    }).taxableBenefits;

  // Combined income exactly $32,000 — at the base amount, not over it.
  assert.equal(at(24_000, 20_000), 0);
  assert.equal(at(24_000, 25_000), 2_500);
  // 0.85 × 40,000 = 34,000, the ceiling.
  assert.equal(at(40_000, 60_000), 34_000);
});

// --------------------------------------------------------------------------
// The shape of the provision
// --------------------------------------------------------------------------

test('a single filer with a $30,000 benefit, across the whole range', () => {
  const row = (other) => {
    const r = ss({ adjustedGrossIncomeExcludingSocialSecurity: other });
    return [r.combinedIncome, r.taxableBenefits, r.tier];
  };
  // Exactly at the base amount: paragraph (1) applies and yields nothing.
  assert.deepEqual(row(10_000), [25_000, 0, 1]);
  assert.deepEqual(row(20_000), [35_000, 5_350, 2]);
  assert.deepEqual(row(30_000), [45_000, 13_850, 2]);
  assert.deepEqual(row(40_000), [55_000, 22_350, 2]);
  // The § 86(a)(2)(B) ceiling. $40,000 more of other income has dragged
  // $25,500 of benefit into taxable income behind it.
  assert.deepEqual(row(50_000), [65_000, 25_500, 2]);
  assert.equal(ss({ adjustedGrossIncomeExcludingSocialSecurity: 50_000 }).atMaximumInclusion, true);
  assert.equal(ss({ adjustedGrossIncomeExcludingSocialSecurity: 40_000 }).atMaximumInclusion, false);
});

test('the benefit is never more than 85% taxable, however large the income', () => {
  const r = ss({ adjustedGrossIncomeExcludingSocialSecurity: 10_000_000 });
  assert.equal(r.taxableBenefits, 25_500);
  assert.equal(r.inclusionRate, 0.85);
});

test('married filing separately is not half of joint — it is zero', () => {
  // § 86(c)(1)(C): a separate filer who lived with their spouse at any time in
  // the year has a base amount of $0, so 85% of the benefit is taxable from the
  // first dollar of income.
  const together = ss({
    filingStatus: 'marriedFilingSeparately',
    socialSecurityBenefits: 20_000,
    adjustedGrossIncomeExcludingSocialSecurity: 10_000,
  });
  assert.equal(together.baseAmount, 0);
  assert.equal(together.adjustedBaseAmount, 0);
  assert.equal(together.cohabitingSeparate, true);
  assert.equal(together.taxableBenefits, 17_000);

  // Living apart for the entire year restores the single figures, and the same
  // filer owes nothing on the benefit. One fact, $17,000 of taxable income.
  const apart = ss({
    filingStatus: 'marriedFilingSeparately',
    livedWithSpouse: false,
    socialSecurityBenefits: 20_000,
    adjustedGrossIncomeExcludingSocialSecurity: 10_000,
  });
  assert.equal(apart.baseAmount, 25_000);
  assert.equal(apart.cohabitingSeparate, false);
  assert.equal(apart.taxableBenefits, 0);
});

test('the default for a separate filer is the expensive one', () => {
  // Not stated, so assumed to be cohabiting. This package does not guess in the
  // taxpayer's favour on a fact it was not told.
  assert.equal(
    ss({ filingStatus: 'marriedFilingSeparately', socialSecurityBenefits: 1, adjustedGrossIncomeExcludingSocialSecurity: 0 })
      .cohabitingSeparate,
    true,
  );
  // And `livedWithSpouse` is ignored by every other status.
  assert.equal(ss({ livedWithSpouse: true }).baseAmount, 25_000);
  assert.equal(
    ss({ filingStatus: 'marriedFilingJointly', livedWithSpouse: false }).baseAmount,
    32_000,
  );
});

test('tax-exempt interest is counted in full — a municipal bond is not tax-free here', () => {
  const taxable = ss({
    socialSecurityBenefits: 30_000,
    adjustedGrossIncomeExcludingSocialSecurity: 30_000,
  });
  const municipal = ss({
    socialSecurityBenefits: 30_000,
    adjustedGrossIncomeExcludingSocialSecurity: 20_000,
    taxExemptInterest: 10_000,
  });
  // Identical combined income, identical benefit inclusion. The $10,000 of
  // exempt interest stayed out of gross income and still pulled $8,500 of
  // benefit in behind it, exactly as $10,000 of taxable interest would have.
  assert.equal(municipal.combinedIncome, taxable.combinedIncome);
  assert.equal(municipal.taxableBenefits, taxable.taxableBenefits);
  assert.equal(
    municipal.taxableBenefits -
      ss({ socialSecurityBenefits: 30_000, adjustedGrossIncomeExcludingSocialSecurity: 20_000 })
        .taxableBenefits,
    8_500,
  );
});

// --------------------------------------------------------------------------
// End to end, and the part that is the actual product
// --------------------------------------------------------------------------

test('estimateFederalTax puts only the taxable part into gross income', () => {
  const r = estimateFederalTax({
    filingStatus: 'single',
    year: 2026,
    otherOrdinaryIncome: 30_000,
    socialSecurityBenefits: 30_000,
    age65OrOlder: true,
  });
  assert.equal(r.socialSecurity.taxableBenefits, 13_850);
  assert.equal(r.socialSecurity.untaxedBenefits, 16_150);
  // Form 1040 line 9 contains line 6b, not box 5 of the SSA-1099.
  assert.equal(r.grossIncome, 43_850);
  assert.equal(r.adjustedGrossIncome, 43_850);
});

test('no socialSecurityBenefits means no § 86 computation at all, not a zero', () => {
  const r = estimateFederalTax({ filingStatus: 'single', year: 2026, w2Wages: 50_000 });
  assert.equal(r.socialSecurity, null);
});

test('THE TAX TORPEDO: 40.70% marginal in the 22% bracket, from § 86 alone', () => {
  // 2024, before OBBBA. A couple both 65 with a $90,000 benefit and $80,000 of
  // other income. Each extra dollar of ordinary income drags 85 cents of
  // previously untaxed benefit into taxable income with it, so taxable income
  // rises by $1.85 and the 22% bracket bites 1.85 times.
  const at = (other) =>
    estimateFederalTax({
      filingStatus: 'marriedFilingJointly',
      year: 2024,
      age65OrOlder: true,
      spouseAge65OrOlder: true,
      socialSecurityBenefits: 90_000,
      otherOrdinaryIncome: other,
    });
  const a = at(80_000);
  const b = at(81_000);
  assert.equal(a.marginalRate, 0.22);
  assert.equal(b.taxableIncome - a.taxableIncome, 1_850);
  assert.equal(Number((((b.totalTax - a.totalTax) / 1_000) * 100).toFixed(2)), 40.7);
});

test('OBBBA takes $3,898 off this couple and adds 4.88 points to their marginal rate', () => {
  const at = (year, other) =>
    estimateFederalTax({
      filingStatus: 'marriedFilingJointly',
      year,
      age65OrOlder: true,
      spouseAge65OrOlder: true,
      socialSecurityBenefits: 90_000,
      otherOrdinaryIncome: other,
    });
  const marginal = (year) =>
    Number((((at(year, 81_000).totalTax - at(year, 80_000).totalTax) / 1_000) * 100).toFixed(2));

  // The relief is real: the senior deduction is worth $11,418 of deduction here.
  assert.equal(at(2024, 80_000).totalTax, 17_067);
  assert.equal(at(2026, 80_000).totalTax, 13_169.04);
  assert.equal(at(2026, 80_000).additionalDeductions.total, 11_418);

  // And the next dollar costs more than it did. The senior deduction phases out
  // at 6% of the MAGI excess *per eligible person*, so a couple both 65 lose
  // 12 cents of deduction per dollar of MAGI — and MAGI itself is rising by
  // $1.85 per dollar because of § 86. Taxable income rises by $2.072.
  assert.equal(marginal(2024), 40.7);
  assert.equal(marginal(2026), 45.58);
  assert.equal(at(2026, 81_000).taxableIncome - at(2026, 80_000).taxableIncome, 2_072);

  // 45.58% is above the 37% top federal rate, in the 22% bracket.
  assert.ok(marginal(2026) > 37);
});

test('the marginal rate reverses direction four times on one income profile', () => {
  // Same couple, 2026, sweeping other ordinary income. Nothing here is a
  // bracket: they never leave 22% and 24%.
  const at = (other) =>
    estimateFederalTax({
      filingStatus: 'marriedFilingJointly',
      year: 2026,
      age65OrOlder: true,
      spouseAge65OrOlder: true,
      socialSecurityBenefits: 90_000,
      otherOrdinaryIncome: other,
    });
  const marginal = (other) =>
    Number((((at(other + 1_000).totalTax - at(other).totalTax) / 1_000) * 100).toFixed(2));

  assert.equal(marginal(75_000), 22.2); // § 86 tier 1: $1.50 of taxable income
  assert.equal(marginal(78_000), 45.58); // both phase-ins at once — the peak
  assert.equal(marginal(82_000), 24.64); // § 86 ceiling reached; senior phase-out alone
  assert.equal(marginal(171_000), 26.88); // the 24% bracket arrives, still phasing out
  assert.equal(marginal(174_000), 24.0); // senior deduction gone; the bracket at last

  // Up, then down: the rate at $78,000 is higher than at $171,000 although the
  // bracket at $171,000 is higher. Reading a bracket table gets this backwards.
  assert.ok(marginal(78_000) > marginal(171_000));
  assert.ok(at(78_000).marginalRate < at(171_000).marginalRate);
});

test('a filer under 65 has the torpedo without the senior phase-out on top', () => {
  const at = (other, age65) =>
    estimateFederalTax({
      filingStatus: 'single',
      year: 2026,
      age65OrOlder: age65,
      socialSecurityBenefits: 60_000,
      otherOrdinaryIncome: other,
    });
  const marginal = (other, age65) =>
    Number((((at(other + 1_000, age65).totalTax - at(other, age65).totalTax) / 1_000) * 100).toFixed(2));

  // 1.85 × 22% = 40.70%. With the senior deduction phasing out on top of it,
  // 1.961 × 22% = 43.14%. Being 65 makes the next dollar more expensive.
  assert.equal(marginal(40_000, false), 40.7);
  assert.equal(marginal(40_000, true), 43.14);
  // But the year's tax is still lower with it, by the whole senior deduction.
  assert.ok(at(40_000, true).totalTax < at(40_000, false).totalTax);
});
