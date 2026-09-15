import type { SocialSecurityTaxabilityParameters } from '../types.js';

/**
 * § 86 thresholds and fractions — **shared by every year in this package, on
 * purpose.**
 *
 * Every other parameter file here is per-year because every other figure moves.
 * These do not. `$25,000` and `$32,000` were fixed by § 121(a) of the Social
 * Security Amendments of 1983 (Pub. L. 98-21) and have not changed since benefits
 * first became taxable in 1984. `$34,000` and `$44,000` were fixed by § 13215 of
 * the Omnibus Budget Reconciliation Act of 1993 (Pub. L. 103-66) and have not
 * changed since. § 86 contains no cross-reference to § 1(f), so there is no
 * mechanism by which they could.
 *
 * Holding them in one object rather than copying them into `2024.ts`, `2025.ts`
 * and `2026.ts` is the point: three copies would suggest three independently
 * sourced figures that happen to agree, when in fact there is one figure that has
 * outlived four decades of indexation of everything around it. `test/social-
 * security.test.js` asserts that all three years resolve to this exact object, so
 * a future year cannot quietly fork it without the test saying so.
 *
 * What that immobility costs, in this package's own numbers: a single filer whose
 * entire income is a `$30,000` benefit plus `$25,000` of pension pays federal tax
 * on `$9,350` of that benefit in 2026. The same filer in 1994 — `$30,000` of
 * benefit and `$25,000` of pension being roughly `$11,200` and `$9,300` in 1994
 * dollars — was below the base amount and paid nothing on any of it.
 */
export const SOCIAL_SECURITY_TAXABILITY: SocialSecurityTaxabilityParameters = {
  // § 86(c)(1). Note that head of household and qualifying surviving spouse get
  // the *single* figure, not a larger one — § 86 knows only "a joint return",
  // "a separate return" and everything else, so the status that doubles the
  // standard deduction buys nothing at all here.
  baseAmount: {
    single: 25_000,
    marriedFilingJointly: 32_000,
    marriedFilingSeparately: 25_000,
    headOfHousehold: 25_000,
    qualifyingSurvivingSpouse: 25_000,
  },
  // § 86(c)(2).
  adjustedBaseAmount: {
    single: 34_000,
    marriedFilingJointly: 44_000,
    marriedFilingSeparately: 34_000,
    headOfHousehold: 34_000,
    qualifyingSurvivingSpouse: 34_000,
  },
  // § 86(c)(1)(C) and § 86(c)(2)(C). The `marriedFilingSeparately` entries above
  // apply only to a separate filer who lived apart from their spouse for the
  // *entire* year. One day of cohabitation replaces both with these.
  separateCohabitingBaseAmount: 0,
  separateCohabitingAdjustedBaseAmount: 0,

  benefitFractionInCombinedIncome: 0.5, // § 86(b)(1)
  firstTierBenefitFraction: 0.5, // § 86(a)(1)(A)
  firstTierExcessFraction: 0.5, // § 86(a)(1)(B)
  secondTierExcessFraction: 0.85, // § 86(a)(2)(A)(i)
  secondTierBracketFraction: 0.5, // § 86(a)(2)(A)(ii)
  maximumBenefitFraction: 0.85, // § 86(a)(2)(B)
};
