/**
 * § 86 — how much of a Social Security benefit is taxable.
 *
 * This is the one federal computation a retiree cannot avoid and cannot do in
 * their head, and it is the last large piece of an ordinary return that this
 * package did not model. Without it, a retiree's adjusted gross income cannot be
 * derived from what they actually receive: `otherOrdinaryIncome` has to be handed
 * the *already-taxable* part of the benefit, which is a figure almost nobody knows
 * and which is itself a function of everything else on the return.
 *
 * Three facts make it worth a module of its own rather than a line in
 * `estimate.ts`.
 *
 * **The thresholds have never been indexed.** `$25,000` and `$32,000` were set by
 * the 1983 Social Security Amendments and have not moved in forty-three years;
 * `$34,000` and `$44,000` were set by OBRA 1993 and have not moved in thirty-three.
 * Every other dollar figure in this package is adjusted annually under § 1(f).
 * These four are the exception, and the exception is the policy: the share of
 * beneficiaries paying tax on benefits was designed to be about a tenth and is now
 * most of them, purely by the passage of time. A model that indexes them — or that
 * assumes any published threshold must be current — is wrong in a direction that
 * grows every year.
 *
 * **It is not a rate, it is an inclusion.** § 86 does not tax the benefit at 50% or
 * 85%. It puts up to 85% of the benefit *into* taxable income, where it is then
 * taxed at whatever the filer's bracket is. So a dollar of other income inside the
 * phase-in band drags up to 85 cents of previously untaxed benefit in behind it,
 * and the filer's real marginal rate is up to 1.85 times their bracket. See
 * {@link socialSecurityTaxability} for the composed figures.
 *
 * **Married filing separately is not half of joint — it is zero.** § 86(c)(1)(C)
 * gives a separate filer who lived with their spouse at any time during the year a
 * base amount of `$0`, so 85% of the benefit is taxable from the first dollar. A
 * separate filer who lived apart for the *whole* year uses the single figures. The
 * two cases differ by thousands of dollars and differ on a fact — cohabitation —
 * that appears nowhere else on the return.
 *
 * @see https://www.law.cornell.edu/uscode/text/26/86
 */

import type { FilingStatus, SocialSecurityTaxabilityResult } from './types.js';
import { getYearParameters, nonNegative, roundCents } from './core.js';

function byStatus(
  values: Readonly<Record<FilingStatus, number>>,
  filingStatus: FilingStatus,
): number {
  const value = values[filingStatus];
  if (value === undefined) {
    throw new RangeError(`unknown filing status: ${String(filingStatus)}`);
  }
  return value;
}

export interface SocialSecurityTaxabilityOptions {
  /**
   * **Total** Social Security and tier 1 railroad retirement benefits received in
   * the year — box 5 of Form SSA-1099, the net of benefits paid less benefits
   * repaid. Not the taxable part; that is what this function returns.
   *
   * Supplemental Security Income is not a Social Security benefit under
   * § 86(d)(1) and does not belong here.
   */
  readonly socialSecurityBenefits: number;
  /**
   * Adjusted gross income computed **without** any Social Security in it —
   * everything else on Form 1040 line 11.
   *
   * There is no circularity to break: nothing above the line depends on how much
   * of the benefit is taxable, so this figure is knowable before § 86 runs. The
   * one exception is the student loan interest deduction, which § 86(b)(2)(A)
   * disallows for this purpose and which this package does not model.
   */
  readonly adjustedGrossIncomeExcludingSocialSecurity: number;
  /**
   * Tax-exempt interest — Form 1040 line 2a. § 86(b)(2)(B) puts it back.
   *
   * This is the reason a municipal bond is not tax-free for a retiree near the
   * threshold: the interest is excluded from gross income and then counted in
   * full when deciding how much of the benefit to tax, so it can cost more in
   * benefit inclusion than a taxable bond would have cost in tax.
   */
  readonly taxExemptInterest?: number;
  /** Income excluded under § 911, § 931 or § 933 — § 86(b)(2)(B) adds it back. */
  readonly foreignEarnedIncomeExclusion?: number;
  readonly filingStatus: FilingStatus;
  /**
   * For a married filer filing separately: did they live with their spouse at any
   * time during the tax year?
   *
   * § 86(c)(1)(C) and § 86(c)(2)(C) drop both thresholds to `$0` when they did, so
   * 85% of the benefit is taxable from the first dollar of income. Living apart
   * for the entire year restores the single figures.
   *
   * Defaults to `true`, which is the common case and the expensive one. A model
   * that defaults it the other way understates the tax for most separate filers,
   * and this package does not guess in the taxpayer's favour.
   */
  readonly livedWithSpouse?: boolean;
  readonly year?: number;
}

/**
 * The taxable portion of a Social Security benefit, with every intermediate
 * figure of the § 86 computation.
 *
 * Worked, for a single filer in 2026 with a `$30,000` benefit:
 *
 * ```text
 * other income   combined income   taxable benefit   inclusion rate
 *      $10,000           $25,000             $0.00             0%
 *      $20,000           $35,000        $5,350.00          17.8%
 *      $30,000           $45,000       $13,850.00          46.2%
 *      $40,000           $55,000       $22,350.00          74.5%
 *      $50,000           $65,000       $25,500.00          85.0%   (the cap)
 * ```
 *
 * Between `$10,000` and `$50,000` of other income the filer's taxable income
 * rises by `$65,500` — `$40,000` of it earned and `$25,500` of it benefit that was
 * tax-free at the bottom of the range. **That is the whole of the "tax torpedo":**
 * inside the band each dollar of ordinary income adds `$1.50` or `$1.85` of
 * taxable income, so a filer in the 12% bracket pays a marginal 18% or 22.2% and
 * one in the 22% bracket pays 40.7%.
 *
 * From 2025 to 2028 it composes with something else. The OBBBA senior deduction
 * phases out at 6% of the MAGI excess **per eligible person**, and § 86 is what
 * makes MAGI move: for a couple both 65, one dollar of ordinary income raises AGI
 * by `$1.85` and therefore costs `$0.222` of senior deduction, so taxable income
 * rises by `$2.072` and the 22% bracket bites **45.58%**. That is above the 37%
 * top rate, on a couple who are in the 22% bracket, and it is 4.88 points higher
 * than the same couple faced in 2024 — the year before they were given the
 * deduction. `test/social-security.test.js` pins all of it.
 */
export function socialSecurityTaxability(
  options: SocialSecurityTaxabilityOptions,
): SocialSecurityTaxabilityResult {
  const params = getYearParameters(options.year);
  const p = params.socialSecurity;
  const benefits = nonNegative(options.socialSecurityBenefits, 'socialSecurityBenefits');
  const otherAgi = nonNegative(
    options.adjustedGrossIncomeExcludingSocialSecurity,
    'adjustedGrossIncomeExcludingSocialSecurity',
  );
  const taxExempt = nonNegative(options.taxExemptInterest, 'taxExemptInterest');
  const excluded = nonNegative(
    options.foreignEarnedIncomeExclusion,
    'foreignEarnedIncomeExclusion',
  );

  // § 86(c)(1)(C) / (c)(2)(C). The cohabitation test applies only to a separate
  // return; every other status ignores `livedWithSpouse` entirely.
  const cohabitingSeparate =
    options.filingStatus === 'marriedFilingSeparately' && (options.livedWithSpouse ?? true);

  const baseAmount = cohabitingSeparate
    ? p.separateCohabitingBaseAmount
    : byStatus(p.baseAmount, options.filingStatus);
  const adjustedBaseAmount = cohabitingSeparate
    ? p.separateCohabitingAdjustedBaseAmount
    : byStatus(p.adjustedBaseAmount, options.filingStatus);

  // § 86(b)(2): modified AGI. § 86(b)(1): combined income adds half the benefit.
  const modifiedAdjustedGrossIncome = otherAgi + taxExempt + excluded;
  const combinedIncome = modifiedAdjustedGrossIncome + p.benefitFractionInCombinedIncome * benefits;

  const excessOverBase = Math.max(0, combinedIncome - baseAmount);
  const excessOverAdjustedBase = Math.max(0, combinedIncome - adjustedBaseAmount);

  // § 86(a)(1): the lesser of half the benefit or half the excess over the base.
  const amountUnderParagraph1 = Math.min(
    p.firstTierBenefitFraction * benefits,
    p.firstTierExcessFraction * excessOverBase,
  );

  // § 86(a)(2)(A)(ii): "the lesser of the amount determined under paragraph (1)
  // or one-half of the difference between the adjusted base amount and the base
  // amount". For a cohabiting separate filer the two amounts are both zero, so
  // this term vanishes and the answer is simply 85% of the benefit.
  const bracketAmount = Math.min(
    amountUnderParagraph1,
    p.secondTierBracketFraction * (adjustedBaseAmount - baseAmount),
  );

  // § 86(a)(2): the lesser of (A) 85% of the excess plus that bracket amount, or
  // (B) 85% of the benefit. (B) is the ceiling everybody has heard of; (A) is why
  // reaching it takes so much income.
  const amountUnderParagraph2 = Math.min(
    p.secondTierExcessFraction * excessOverAdjustedBase + bracketAmount,
    p.maximumBenefitFraction * benefits,
  );

  let taxable: number;
  let tier: 0 | 1 | 2;
  if (combinedIncome < baseAmount) {
    taxable = 0;
    tier = 0;
  } else if (combinedIncome < adjustedBaseAmount) {
    taxable = amountUnderParagraph1;
    tier = 1;
  } else {
    taxable = amountUnderParagraph2;
    tier = 2;
  }

  taxable = roundCents(Math.max(0, Math.min(taxable, benefits)));

  return {
    year: params.year,
    filingStatus: options.filingStatus,
    benefits: roundCents(benefits),
    modifiedAdjustedGrossIncome: roundCents(modifiedAdjustedGrossIncome),
    combinedIncome: roundCents(combinedIncome),
    baseAmount,
    adjustedBaseAmount,
    cohabitingSeparate,
    tier,
    taxableBenefits: taxable,
    untaxedBenefits: roundCents(benefits - taxable),
    inclusionRate: benefits === 0 ? 0 : taxable / benefits,
    atMaximumInclusion: benefits > 0 && taxable >= roundCents(p.maximumBenefitFraction * benefits),
  };
}
