import type { YearParameters } from '../types.js';

/**
 * Tax year 2026 federal parameters.
 *
 * Every figure below was taken from the IRS inflation-adjustment release for tax
 * year 2026 (Rev. Proc. 2025-32, published 2025-10-09) and independently
 * cross-checked against a second source before being committed. Statutory rates
 * (OASDI 12.4%, Medicare 2.9%, Additional Medicare 0.9%, NIIT 3.8%) come from the
 * Internal Revenue Code and are not inflation-adjusted.
 *
 * The Social Security wage base is set by SSA, not the IRS, and rose to $184,500
 * for 2026 (from $176,100 in 2025).
 *
 * Bracket values are the *upper* bound of each band, expressed in taxable income.
 * Note the small but real divergences the IRS publishes: head-of-household 24% and
 * 32% bands top out $25 below the single bands, and married-filing-separately caps
 * the 35% band at exactly half the joint figure.
 */
export const YEAR_2026: YearParameters = {
  year: 2026,

  ordinaryBrackets: {
    single: [
      { rate: 0.1, upTo: 12_400 },
      { rate: 0.12, upTo: 50_400 },
      { rate: 0.22, upTo: 105_700 },
      { rate: 0.24, upTo: 201_775 },
      { rate: 0.32, upTo: 256_225 },
      { rate: 0.35, upTo: 640_600 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0.1, upTo: 24_800 },
      { rate: 0.12, upTo: 100_800 },
      { rate: 0.22, upTo: 211_400 },
      { rate: 0.24, upTo: 403_550 },
      { rate: 0.32, upTo: 512_450 },
      { rate: 0.35, upTo: 768_700 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0.1, upTo: 12_400 },
      { rate: 0.12, upTo: 50_400 },
      { rate: 0.22, upTo: 105_700 },
      { rate: 0.24, upTo: 201_775 },
      { rate: 0.32, upTo: 256_225 },
      { rate: 0.35, upTo: 384_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0.1, upTo: 17_700 },
      { rate: 0.12, upTo: 67_450 },
      { rate: 0.22, upTo: 105_700 },
      { rate: 0.24, upTo: 201_750 },
      { rate: 0.32, upTo: 256_200 },
      { rate: 0.35, upTo: 640_600 },
      { rate: 0.37, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0.1, upTo: 24_800 },
      { rate: 0.12, upTo: 100_800 },
      { rate: 0.22, upTo: 211_400 },
      { rate: 0.24, upTo: 403_550 },
      { rate: 0.32, upTo: 512_450 },
      { rate: 0.35, upTo: 768_700 },
      { rate: 0.37, upTo: Infinity },
    ],
  },

  standardDeduction: {
    single: 16_100,
    marriedFilingJointly: 32_200,
    marriedFilingSeparately: 16_100,
    headOfHousehold: 24_150,
    qualifyingSurvivingSpouse: 32_200,
  },

  // Per qualifying condition. A single filer who is both 65+ and blind gets 2 x 2,050.
  additionalStandardDeduction: {
    single: 2_050,
    marriedFilingJointly: 1_650,
    marriedFilingSeparately: 1_650,
    headOfHousehold: 2_050,
    qualifyingSurvivingSpouse: 1_650,
  },

  socialSecurityWageBase: 184_500,

  rates: {
    socialSecurityEmployee: 0.062,
    socialSecurityEmployer: 0.062,
    medicareEmployee: 0.0145,
    medicareEmployer: 0.0145,
    additionalMedicare: 0.009,
    seSocialSecurity: 0.124,
    seMedicare: 0.029,
  },

  // Form 8959. Note qualifying surviving spouse is $200,000 here but $250,000 for NIIT.
  additionalMedicareThreshold: {
    single: 200_000,
    marriedFilingJointly: 250_000,
    marriedFilingSeparately: 125_000,
    headOfHousehold: 200_000,
    qualifyingSurvivingSpouse: 200_000,
  },

  seNetEarningsFactor: 0.9235,
  seMinimumNetEarnings: 400,

  longTermCapitalGains: {
    single: [
      { rate: 0, upTo: 49_450 },
      { rate: 0.15, upTo: 545_500 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0, upTo: 98_900 },
      { rate: 0.15, upTo: 613_700 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0, upTo: 49_450 },
      { rate: 0.15, upTo: 306_850 },
      { rate: 0.2, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0, upTo: 66_200 },
      { rate: 0.15, upTo: 579_600 },
      { rate: 0.2, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0, upTo: 98_900 },
      { rate: 0.15, upTo: 613_700 },
      { rate: 0.2, upTo: Infinity },
    ],
  },

  niit: {
    rate: 0.038,
    thresholds: {
      single: 200_000,
      marriedFilingJointly: 250_000,
      marriedFilingSeparately: 125_000,
      headOfHousehold: 200_000,
      qualifyingSurvivingSpouse: 250_000,
    },
  },

  // OBBBA (Pub. L. 119-21) temporary deductions, reported on Schedule 1-A.
  //
  // None of these amounts is inflation-adjusted: the statutes carry no indexing
  // provision and Rev. Proc. 2025-32 makes no adjustment to them, so the 2026
  // figures are identical to the 2025 ones.
  scheduleOneA: {
    finalYear: 2028,

    // §224. Cap is per return and is *not* doubled on a joint return.
    tips: {
      cap: 25_000,
      phaseOut: {
        amountPerIncrement: 100,
        increment: 1_000,
        // "$100 for each $1,000" — Schedule 1-A directs the filer to decrease a
        // fractional result to the next lower whole number.
        rounding: 'down',
        thresholds: {
          single: 150_000,
          marriedFilingJointly: 300_000,
          marriedFilingSeparately: 150_000,
          headOfHousehold: 150_000,
          qualifyingSurvivingSpouse: 150_000,
        },
      },
    },

    // §225. Here the cap *is* doubled on a joint return, unlike tips.
    overtime: {
      cap: {
        single: 12_500,
        marriedFilingJointly: 25_000,
        marriedFilingSeparately: 12_500,
        headOfHousehold: 12_500,
        qualifyingSurvivingSpouse: 12_500,
      },
      phaseOut: {
        amountPerIncrement: 100,
        increment: 1_000,
        rounding: 'down',
        thresholds: {
          single: 150_000,
          marriedFilingJointly: 300_000,
          marriedFilingSeparately: 150_000,
          headOfHousehold: 150_000,
          qualifyingSurvivingSpouse: 150_000,
        },
      },
    },

    // OBBBA § 70103, amending 26 U.S.C. § 151. This is *on top of* the existing
    // additional standard deduction for age, which is unchanged.
    senior: {
      amountPerEligibleIndividual: 6_000,
      ageThreshold: 65,
      // A flat 6% of the MAGI excess, with no rounding — so it is fully gone at
      // $175,000 (single) or $250,000 (joint).
      phaseOutRate: 0.06,
      phaseOutThreshold: {
        single: 75_000,
        marriedFilingJointly: 150_000,
        marriedFilingSeparately: 75_000,
        headOfHousehold: 75_000,
        qualifyingSurvivingSpouse: 75_000,
      },
    },

    // §163(h)(4). Note the phase-out rounds the *other* way from tips/overtime.
    vehicleLoanInterest: {
      cap: 10_000,
      phaseOut: {
        amountPerIncrement: 200,
        increment: 1_000,
        // "$200 for each $1,000 (or portion thereof)" — one dollar of excess
        // costs a full $200.
        rounding: 'up',
        thresholds: {
          single: 100_000,
          marriedFilingJointly: 200_000,
          marriedFilingSeparately: 100_000,
          headOfHousehold: 100_000,
          qualifyingSurvivingSpouse: 100_000,
        },
      },
    },

    // The thresholds above are still listed for marriedFilingSeparately because
    // they are what the statute says; this is the rule that actually zeroes the
    // deduction out for that status.
    ineligibleFilingStatuses: ['marriedFilingSeparately'],
  },

  sources: [
    {
      title: 'IRS Rev. Proc. 2025-32 — inflation adjustments for tax year 2026',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    },
    {
      title: 'IRS newsroom — 2026 inflation adjustments, including OBBBA amendments',
      url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
    },
    {
      title: 'SSA — 2026 Social Security wage base ($184,500)',
      url: 'https://www.ssa.gov/oact/cola/cbb.html',
    },
    {
      title: '26 U.S.C. § 1(j) — tax rate tables',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
    },
    {
      title: '26 U.S.C. § 1411 — net investment income tax',
      url: 'https://www.law.cornell.edu/uscode/text/26/1411',
    },
    {
      title: '26 U.S.C. § 224 — qualified tips deduction',
      url: 'https://www.law.cornell.edu/uscode/text/26/224',
    },
    {
      title: '26 U.S.C. § 225 — qualified overtime compensation deduction',
      url: 'https://www.law.cornell.edu/uscode/text/26/225',
    },
    {
      title: '26 U.S.C. § 163(h)(4) — qualified passenger vehicle loan interest',
      url: 'https://www.law.cornell.edu/uscode/text/26/163',
    },
    {
      title: 'IRS Schedule 1-A (Form 1040) — Additional Deductions',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf',
    },
    {
      title: 'IRS — Schedule 1-A, Additional Deductions: what to know about the new form',
      url: 'https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form',
    },
  ],
};
