import type { YearParameters } from '../types.js';

/**
 * Tax year 2025 federal parameters.
 *
 * 2025 is the awkward year, and it is the reason this file exists rather than a
 * naive interpolation between 2024 and 2026.
 *
 * The IRS published the 2025 inflation adjustments in **Rev. Proc. 2024-40** on
 * 2024-10-22. Then, on 2025-07-04, the One Big Beautiful Bill Act (Pub. L.
 * 119-21) was enacted and **retroactively changed 2025**, superseding some of
 * those published figures and adding provisions that did not exist when the
 * Revenue Procedure was written. So a 2025 parameter set assembled from Rev.
 * Proc. 2024-40 alone is wrong, and wrong in the direction of overstating tax:
 *
 * - The **standard deduction** is `$15,750` / `$31,500` / `$23,625`
 *   (OBBBA § 70102). Rev. Proc. 2024-40 said `$15,000` / `$30,000` / `$22,500`.
 * - The four **Schedule 1-A deductions** — tips, overtime, senior, vehicle loan
 *   interest — are all live for 2025. None of them is in the Revenue Procedure.
 * - The **SALT cap** is `$40,000`, not `$10,000`, with a phase-down above
 *   `$500,000` of modified AGI (OBBBA § 70120).
 * - The **child tax credit** is `$2,200`, not `$2,000` (OBBBA § 70104), and
 *   2025 is the first year the *taxpayer* needs a work-authorized SSN.
 *
 * Two OBBBA changes that are *not* retroactive to 2025 and are the most likely
 * thing to get wrong in the other direction:
 *
 * - The § 199A **phase-in range is still `$50,000` / `$100,000`** in 2025.
 *   OBBBA § 70105(b) widened it to `$75,000` / `$150,000` only "for taxable
 *   years beginning after December 31, 2025".
 * - The § 199A(i) **`$400` minimum deduction does not exist in 2025**, for the
 *   same reason. It is `null` below.
 *
 * The Social Security wage base is set by SSA and was `$176,100` for 2025.
 */
export const YEAR_2025: YearParameters = {
  year: 2025,

  ordinaryBrackets: {
    single: [
      { rate: 0.1, upTo: 11_925 },
      { rate: 0.12, upTo: 48_475 },
      { rate: 0.22, upTo: 103_350 },
      { rate: 0.24, upTo: 197_300 },
      { rate: 0.32, upTo: 250_525 },
      { rate: 0.35, upTo: 626_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0.1, upTo: 23_850 },
      { rate: 0.12, upTo: 96_950 },
      { rate: 0.22, upTo: 206_700 },
      { rate: 0.24, upTo: 394_600 },
      { rate: 0.32, upTo: 501_050 },
      { rate: 0.35, upTo: 751_600 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0.1, upTo: 11_925 },
      { rate: 0.12, upTo: 48_475 },
      { rate: 0.22, upTo: 103_350 },
      { rate: 0.24, upTo: 197_300 },
      { rate: 0.32, upTo: 250_525 },
      // Exactly half the joint figure, as always for this band.
      { rate: 0.35, upTo: 375_800 },
      { rate: 0.37, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0.1, upTo: 17_000 },
      { rate: 0.12, upTo: 64_850 },
      // Note 2025 has the head-of-household 22% band ending at the *same*
      // $103,350 as single, unlike 2024 ($100,500 vs $100,525) and 2026
      // ($105,700 for both). Only the 32% ceiling diverges this year.
      { rate: 0.22, upTo: 103_350 },
      { rate: 0.24, upTo: 197_300 },
      { rate: 0.32, upTo: 250_500 },
      { rate: 0.35, upTo: 626_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0.1, upTo: 23_850 },
      { rate: 0.12, upTo: 96_950 },
      { rate: 0.22, upTo: 206_700 },
      { rate: 0.24, upTo: 394_600 },
      { rate: 0.32, upTo: 501_050 },
      { rate: 0.35, upTo: 751_600 },
      { rate: 0.37, upTo: Infinity },
    ],
  },

  // OBBBA § 70102. These are *not* the Rev. Proc. 2024-40 figures — see the
  // header comment. A 2025 return prepared with $15,000 / $30,000 / $22,500
  // overstates taxable income by $750 / $1,500 / $1,125.
  standardDeduction: {
    single: 15_750,
    marriedFilingJointly: 31_500,
    marriedFilingSeparately: 15_750,
    headOfHousehold: 23_625,
    qualifyingSurvivingSpouse: 31_500,
  },

  additionalStandardDeduction: {
    single: 2_000,
    marriedFilingJointly: 1_600,
    marriedFilingSeparately: 1_600,
    headOfHousehold: 2_000,
    qualifyingSurvivingSpouse: 1_600,
  },

  socialSecurityWageBase: 176_100,

  rates: {
    socialSecurityEmployee: 0.062,
    socialSecurityEmployer: 0.062,
    medicareEmployee: 0.0145,
    medicareEmployer: 0.0145,
    additionalMedicare: 0.009,
    seSocialSecurity: 0.124,
    seMedicare: 0.029,
  },

  // Statutory (§ 3101(b)(2)) and never inflation-adjusted, so identical in every
  // year this package covers.
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
      { rate: 0, upTo: 48_350 },
      { rate: 0.15, upTo: 533_400 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0, upTo: 96_700 },
      { rate: 0.15, upTo: 600_050 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0, upTo: 48_350 },
      // $300,000, not $300,025. The separate-return figure is rounded on its own
      // rather than derived from the joint one, so it is $25 *below* half of
      // $600,050. The same thing happens in 2024 ($291,850 against a joint
      // $583,750, half of which is $291,875) — but not in 2026, where
      // $306,850 is exactly half of $613,700.
      { rate: 0.15, upTo: 300_000 },
      { rate: 0.2, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0, upTo: 64_750 },
      { rate: 0.15, upTo: 566_700 },
      { rate: 0.2, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0, upTo: 96_700 },
      { rate: 0.15, upTo: 600_050 },
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

  // All four Schedule 1-A deductions are retroactive to 2025, and none of the
  // amounts is inflation-indexed — so this block is byte-for-byte identical to
  // the 2026 one. That is a fact worth a test rather than a coincidence worth
  // a shrug: `test/years.test.js` asserts the two are deep-equal, which turns
  // any future drift between them into a failure.
  scheduleOneA: {
    finalYear: 2028,

    tips: {
      cap: 25_000,
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

    senior: {
      amountPerEligibleIndividual: 6_000,
      ageThreshold: 65,
      phaseOutRate: 0.06,
      phaseOutThreshold: {
        single: 75_000,
        marriedFilingJointly: 150_000,
        marriedFilingSeparately: 75_000,
        headOfHousehold: 75_000,
        qualifyingSurvivingSpouse: 75_000,
      },
    },

    vehicleLoanInterest: {
      cap: 10_000,
      phaseOut: {
        amountPerIncrement: 200,
        increment: 1_000,
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

    ineligibleFilingStatuses: ['marriedFilingSeparately'],
  },

  // The two OBBBA § 199A changes are the ones that are *not* retroactive.
  //
  // 1. The phase-in range is still the original TCJA $50,000 / $100,000. OBBBA
  //    § 70105(b) applies "to taxable years beginning after December 31, 2025",
  //    so using the 2026 range here would phase the W-2/UBIA cap and the SSTB
  //    haircut in half as fast as the law requires.
  // 2. § 199A(i) does not exist yet, hence `minimumDeduction: null`.
  //
  // Unlike 2026, the separate-return threshold is *not* $25 above single this
  // year: $197,300 is a multiple of $50, so the § 1(f)(7) split has nothing to
  // split. The $25 divergence only appears in a year where the unrounded
  // adjustment lands strictly between two multiples of $50.
  section199A: {
    deductionRate: 0.2,

    thresholdAmount: {
      single: 197_300,
      marriedFilingJointly: 394_600,
      marriedFilingSeparately: 197_300,
      headOfHousehold: 197_300,
      qualifyingSurvivingSpouse: 394_600,
    },

    phaseInRange: {
      single: 50_000,
      marriedFilingJointly: 100_000,
      marriedFilingSeparately: 50_000,
      headOfHousehold: 50_000,
      qualifyingSurvivingSpouse: 100_000,
    },

    w2WageRate: 0.5,
    w2WageAlternativeRate: 0.25,
    qualifiedPropertyRate: 0.025,

    // § 199A(i) is effective for tax years beginning after 2025.
    minimumDeduction: null,
  },

  // OBBBA § 70120, first effective 2025. The cap is $40,000 flat this year; the
  // 1%-a-year escalator starts in 2026 ($40,400). Phase-down and floor are
  // otherwise the same mechanism: 30 cents of cap per dollar of modified AGI
  // above $500,000, stopping at $10,000, so the cap is fully phased down at
  // $600,000 ($300,000 on a separate return).
  saltCap: {
    finalYear: 2029,

    cap: {
      single: 40_000,
      marriedFilingJointly: 40_000,
      marriedFilingSeparately: 20_000,
      headOfHousehold: 40_000,
      qualifyingSurvivingSpouse: 40_000,
    },

    phaseDownRate: 0.3,

    phaseDownThreshold: {
      single: 500_000,
      marriedFilingJointly: 500_000,
      marriedFilingSeparately: 250_000,
      headOfHousehold: 500_000,
      qualifyingSurvivingSpouse: 500_000,
    },

    floor: {
      single: 10_000,
      marriedFilingJointly: 10_000,
      marriedFilingSeparately: 5_000,
      headOfHousehold: 10_000,
      qualifyingSurvivingSpouse: 10_000,
    },
  },

  // OBBBA § 70104 raised the credit to $2,200 *for 2025*, not from 2026. The
  // refundable cap stayed at $1,700, which is where it has been since 2024.
  //
  // 2025 is also the first year the taxpayer's own SSN is required, not just
  // the child's — § 70104(c).
  childTaxCredit: {
    amountPerChild: 2_200,
    amountPerOtherDependent: 500,
    maximumChildAge: 17,

    phaseOut: {
      amountPerIncrement: 50,
      increment: 1_000,
      rounding: 'up',
      thresholds: {
        single: 200_000,
        marriedFilingJointly: 400_000,
        marriedFilingSeparately: 200_000,
        headOfHousehold: 200_000,
        qualifyingSurvivingSpouse: 400_000,
      },
    },

    refundable: {
      maximumPerChild: 1_700,
      phaseInRate: 0.15,
      phaseInThreshold: 2_500,
      minimumChildrenForSocialSecurityAlternative: 3,
    },

    requiresTaxpayerSocialSecurityNumber: true,
  },

  // § 32. Note the joint-return add-on splits the *other* way from 2026:
  // $7,110 with no children ($17,730 − $10,620) and $7,120 with children
  // ($30,470 − $23,350). In 2026 it is $7,280 and $7,270. Storing a single
  // add-on therefore gets one table wrong in every year, and which table it
  // gets wrong is not even stable.
  //
  // 2025 is also the year that breaks the "derive the completed phase-out"
  // invariant that holds in 2024 and 2026 — see `test/years.test.js` and the
  // README. Two of the eight published endpoints cannot be reproduced from the
  // published (rounded) parameters, because the IRS computes them from the
  // unrounded inflation adjustments.
  earnedIncomeCredit: {
    table: [
      // No qualifying children. Max credit $649 at $8,490 of earned income.
      {
        creditRate: 0.0765,
        phaseOutRate: 0.0765,
        maximumCredit: 649,
        phaseOutStart: {
          single: 10_620,
          marriedFilingJointly: 17_730,
          marriedFilingSeparately: 10_620,
          headOfHousehold: 10_620,
          qualifyingSurvivingSpouse: 17_730,
        },
      },
      // One qualifying child. Max credit $4,328 at $12,730 of earned income.
      {
        creditRate: 0.34,
        phaseOutRate: 0.1598,
        maximumCredit: 4_328,
        phaseOutStart: {
          single: 23_350,
          marriedFilingJointly: 30_470,
          marriedFilingSeparately: 23_350,
          headOfHousehold: 23_350,
          qualifyingSurvivingSpouse: 30_470,
        },
      },
      // Two qualifying children. Max credit $7,152 at $17,880 of earned income.
      {
        creditRate: 0.4,
        phaseOutRate: 0.2106,
        maximumCredit: 7_152,
        phaseOutStart: {
          single: 23_350,
          marriedFilingJointly: 30_470,
          marriedFilingSeparately: 23_350,
          headOfHousehold: 23_350,
          qualifyingSurvivingSpouse: 30_470,
        },
      },
      // Three or more. Same $17,880 earned income amount, 45% credit rate.
      {
        creditRate: 0.45,
        phaseOutRate: 0.2106,
        maximumCredit: 8_046,
        phaseOutStart: {
          single: 23_350,
          marriedFilingJointly: 30_470,
          marriedFilingSeparately: 23_350,
          headOfHousehold: 23_350,
          qualifyingSurvivingSpouse: 30_470,
        },
      },
    ],

    maximumInvestmentIncome: 11_950,

    childlessAgeRange: {
      minimum: 25,
      maximum: 64,
    },
  },

  // Publication 15-T percentage method. The tables themselves are not stored:
  // `src/withholding.ts` derives all eight rate schedules from `ordinaryBrackets`
  // and the figures below. See that file for the identity and why it is preferred
  // to transcribing the printed tables.
  withholding: {
    // NOT `standardDeduction`, which is the post-OBBBA figure the *return* uses.
    // Publication 15-T for 2025 was published in December 2024 and was never
    // reissued after OBBBA raised the standard deduction in July 2025, so 2025
    // withholding still runs on $15,000 / $30,000 / $22,500. Every published
    // threshold in the 2025 tables confirms it: the single column's zero-rate
    // band ends at $6,400, which is $15,000 - $8,600 and not $15,750 - $8,600.
    standardDeduction: {
      singleOrMarriedFilingSeparately: 15_000,
      marriedFilingJointly: 30_000,
      headOfHousehold: 22_500,
    },
    step1gAmount: {
      singleOrMarriedFilingSeparately: 8_600,
      marriedFilingJointly: 12_900,
      headOfHousehold: 8_600,
    },
    allowanceAmount: 4_300,
    builtInAllowances: {
      singleOrMarriedFilingSeparately: 2,
      marriedFilingJointly: 3,
      headOfHousehold: 2,
    },
    additionalMedicareWithholdingThreshold: 200_000,
    notes: [
      'The 2025 withholding tables predate the One Big Beautiful Bill Act and were ' +
        'never reissued. They still build in the pre-OBBBA standard deduction of ' +
        '$15,000 / $30,000 / $22,500, and they take no account of the new deductions ' +
        'for tips, overtime, seniors or car loan interest. A 2025 employee who ' +
        'qualifies for those is over-withheld and gets the difference back on the return.',
    ],
  },

  sources: [
    {
      title: 'IRS Publication 15-T (2025) — Federal Income Tax Withholding Methods',
      url: 'https://www.irs.gov/pub/irs-prior/p15t--2025.pdf',
    },
    {
      title:
        'IRS — no change to 2025 withholding tables or Form W-4 for the OBBBA deductions',
      url: 'https://www.irs.gov/newsroom/one-big-beautiful-bill-act-provisions',
    },
    {
      title: 'IRS Rev. Proc. 2024-40 — inflation adjustments for tax year 2025',
      url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf',
    },
    {
      title:
        'Pub. L. 119-21 § 70102 — standard deduction raised to $15,750 / $31,500 / $23,625 retroactively for 2025',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title:
        'Pub. L. 119-21 § 70105(b) — § 199A phase-in range widened to $75,000 / $150,000 only for years beginning after 2025',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: 'Pub. L. 119-21 § 70120 — SALT cap $40,000 for 2025 with a 30% phase-down above $500,000',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: 'Pub. L. 119-21 § 70104 — child tax credit raised to $2,200 for 2025',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: 'SSA — 2025 Social Security wage base ($176,100)',
      url: 'https://www.ssa.gov/oact/cola/cbb.html',
    },
    {
      title: 'IRS — 2025 earned income tax credit income limits and maximum credit amounts',
      url: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-tax-credit-income-limits-and-maximum-credit-amounts',
    },
    {
      title: '26 U.S.C. § 1(j) — tax rate tables',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
    },
  ],
};
