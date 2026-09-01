import type { YearParameters } from '../types.js';

/**
 * Tax year 2024 federal parameters.
 *
 * Every figure comes from **Rev. Proc. 2023-34** (published 2023-11-09), except
 * the Social Security wage base, which SSA set at `$168,600`. Nothing in OBBBA
 * reaches back this far, so 2024 is the clean pre-OBBBA baseline and the year
 * this package's newer subsystems mostly switch *off*:
 *
 * - `scheduleOneA` is **`null`** — the tips, overtime, senior and vehicle loan
 *   interest deductions did not exist. `additionalDeductions()` returns a zeroed
 *   result rather than throwing, so a caller can compute 2024 and 2026 through
 *   the same code path.
 * - `section199A.minimumDeduction` is **`null`** — § 199A(i) is a 2026 provision.
 * - The SALT cap is the flat TCJA `$10,000` (`$5,000` separate) with **no
 *   phase-down**, expressed as a zero rate and an infinite threshold so that
 *   `stateAndLocalTaxDeduction()` needs no year-specific branch.
 * - The child tax credit is `$2,000`, and only the *child* needs an SSN valid
 *   for employment; the taxpayer SSN requirement arrives in 2025.
 *
 * ## The 2024 rate schedules carry a published typo, and this package cannot
 * ## reproduce it
 *
 * The IRS issued a correction on 2025-01-08 to page 109 of the 2024 Instructions
 * for Form 1040: for married filing separately with taxable income over
 * `$365,600`, the tax should read **`$98,334.75` + 37%**, not `$99,334.75`. Any
 * implementation that transcribed the "base tax" column from a copy printed
 * before 2025-01-06 overstates the tax of every top-bracket separate filer by
 * exactly `$1,000`.
 *
 * This engine walks the bracket table and never stores a base-tax column, so the
 * error is not expressible here. `test/years.test.js` asserts the corrected
 * figure explicitly — the arithmetic over the six lower bands comes to
 * `$98,334.75` to the cent.
 */
export const YEAR_2024: YearParameters = {
  year: 2024,

  ordinaryBrackets: {
    single: [
      { rate: 0.1, upTo: 11_600 },
      { rate: 0.12, upTo: 47_150 },
      { rate: 0.22, upTo: 100_525 },
      { rate: 0.24, upTo: 191_950 },
      { rate: 0.32, upTo: 243_725 },
      { rate: 0.35, upTo: 609_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0.1, upTo: 23_200 },
      { rate: 0.12, upTo: 94_300 },
      { rate: 0.22, upTo: 201_050 },
      { rate: 0.24, upTo: 383_900 },
      { rate: 0.32, upTo: 487_450 },
      { rate: 0.35, upTo: 731_200 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0.1, upTo: 11_600 },
      { rate: 0.12, upTo: 47_150 },
      { rate: 0.22, upTo: 100_525 },
      { rate: 0.24, upTo: 191_950 },
      { rate: 0.32, upTo: 243_725 },
      // Half of $731,200. This is the boundary the corrected rate schedule
      // refers to — see the header comment.
      { rate: 0.35, upTo: 365_600 },
      { rate: 0.37, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0.1, upTo: 16_550 },
      { rate: 0.12, upTo: 63_100 },
      // $25 below single, as is the 32% ceiling below. In 2025 the 22% ceilings
      // coincide and only the 32% one diverges; in 2026 neither does. The
      // divergence is § 1(f)(7) rounding, not a stable structural rule.
      { rate: 0.22, upTo: 100_500 },
      { rate: 0.24, upTo: 191_950 },
      { rate: 0.32, upTo: 243_700 },
      { rate: 0.35, upTo: 609_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0.1, upTo: 23_200 },
      { rate: 0.12, upTo: 94_300 },
      { rate: 0.22, upTo: 201_050 },
      { rate: 0.24, upTo: 383_900 },
      { rate: 0.32, upTo: 487_450 },
      { rate: 0.35, upTo: 731_200 },
      { rate: 0.37, upTo: Infinity },
    ],
  },

  standardDeduction: {
    single: 14_600,
    marriedFilingJointly: 29_200,
    marriedFilingSeparately: 14_600,
    headOfHousehold: 21_900,
    qualifyingSurvivingSpouse: 29_200,
  },

  additionalStandardDeduction: {
    single: 1_950,
    marriedFilingJointly: 1_550,
    marriedFilingSeparately: 1_550,
    headOfHousehold: 1_950,
    qualifyingSurvivingSpouse: 1_550,
  },

  socialSecurityWageBase: 168_600,

  rates: {
    socialSecurityEmployee: 0.062,
    socialSecurityEmployer: 0.062,
    medicareEmployee: 0.0145,
    medicareEmployer: 0.0145,
    additionalMedicare: 0.009,
    seSocialSecurity: 0.124,
    seMedicare: 0.029,
  },

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
      { rate: 0, upTo: 47_025 },
      { rate: 0.15, upTo: 518_900 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0, upTo: 94_050 },
      { rate: 0.15, upTo: 583_750 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0, upTo: 47_025 },
      // $291,850 — $25 below half of the joint $583,750, because the separate
      // figure is rounded on its own. Same quirk in 2025; absent in 2026.
      { rate: 0.15, upTo: 291_850 },
      { rate: 0.2, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0, upTo: 63_000 },
      { rate: 0.15, upTo: 551_350 },
      { rate: 0.2, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0, upTo: 94_050 },
      { rate: 0.15, upTo: 583_750 },
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

  // None of the OBBBA deductions existed in 2024.
  scheduleOneA: null,

  // The original TCJA § 199A: a $50,000 / $100,000 phase-in range and no
  // minimum deduction. Note the separate-return threshold equals single here
  // ($191,950 is a multiple of $50), so there is no § 1(f)(7) $25 split this
  // year — that appears in 2026.
  section199A: {
    deductionRate: 0.2,

    thresholdAmount: {
      single: 191_950,
      marriedFilingJointly: 383_900,
      marriedFilingSeparately: 191_950,
      headOfHousehold: 191_950,
      qualifyingSurvivingSpouse: 383_900,
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

    minimumDeduction: null,
  },

  // The flat TCJA cap. There is no phase-down, which is modelled as a zero rate
  // and an infinite threshold rather than as a nullable sub-object: it keeps
  // `stateAndLocalTaxDeduction()` free of year branches, and the reported
  // `phaseDownReduction` correctly comes back as 0 at every income.
  //
  // `finalYear: 2024` is accurate for this parameter block — OBBBA § 70120
  // replaced this cap starting in 2025.
  saltCap: {
    finalYear: 2024,

    cap: {
      single: 10_000,
      marriedFilingJointly: 10_000,
      marriedFilingSeparately: 5_000,
      headOfHousehold: 10_000,
      qualifyingSurvivingSpouse: 10_000,
    },

    phaseDownRate: 0,

    phaseDownThreshold: {
      single: Infinity,
      marriedFilingJointly: Infinity,
      marriedFilingSeparately: Infinity,
      headOfHousehold: Infinity,
      qualifyingSurvivingSpouse: Infinity,
    },

    floor: {
      single: 10_000,
      marriedFilingJointly: 10_000,
      marriedFilingSeparately: 5_000,
      headOfHousehold: 10_000,
      qualifyingSurvivingSpouse: 10_000,
    },
  },

  // The TCJA § 24(h) credit: $2,000 per child, $1,700 of it refundable for 2024
  // (it was $1,600 in 2023), the $500 credit for other dependents, and the same
  // never-indexed $200,000 / $400,000 thresholds.
  childTaxCredit: {
    amountPerChild: 2_000,
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

    // § 24(h)(7) required a work-authorized SSN for the *child* only. OBBBA
    // § 70104(c) extended it to the taxpayer from 2025.
    requiresTaxpayerSocialSecurityNumber: false,
  },

  // § 32. The joint-return add-on is $6,920 for *both* the childless and the
  // with-children tables this year ($17,250 − $10,330 and $29,640 − $22,720),
  // which is the only year of the three where the two coincide. 2025 splits
  // $7,110 / $7,120 and 2026 splits $7,280 / $7,270 — opposite directions.
  earnedIncomeCredit: {
    table: [
      // No qualifying children. Max credit $632 at $8,260 of earned income.
      {
        creditRate: 0.0765,
        phaseOutRate: 0.0765,
        maximumCredit: 632,
        phaseOutStart: {
          single: 10_330,
          marriedFilingJointly: 17_250,
          marriedFilingSeparately: 10_330,
          headOfHousehold: 10_330,
          qualifyingSurvivingSpouse: 17_250,
        },
      },
      // One qualifying child. Max credit $4,213 at $12,390 of earned income.
      {
        creditRate: 0.34,
        phaseOutRate: 0.1598,
        maximumCredit: 4_213,
        phaseOutStart: {
          single: 22_720,
          marriedFilingJointly: 29_640,
          marriedFilingSeparately: 22_720,
          headOfHousehold: 22_720,
          qualifyingSurvivingSpouse: 29_640,
        },
      },
      // Two qualifying children. Max credit $6,960 at $17,400 of earned income.
      {
        creditRate: 0.4,
        phaseOutRate: 0.2106,
        maximumCredit: 6_960,
        phaseOutStart: {
          single: 22_720,
          marriedFilingJointly: 29_640,
          marriedFilingSeparately: 22_720,
          headOfHousehold: 22_720,
          qualifyingSurvivingSpouse: 29_640,
        },
      },
      // Three or more. Same $17,400 earned income amount, 45% credit rate.
      {
        creditRate: 0.45,
        phaseOutRate: 0.2106,
        maximumCredit: 7_830,
        phaseOutStart: {
          single: 22_720,
          marriedFilingJointly: 29_640,
          marriedFilingSeparately: 22_720,
          headOfHousehold: 22_720,
          qualifyingSurvivingSpouse: 29_640,
        },
      },
    ],

    maximumInvestmentIncome: 11_600,

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
    // Identical to `standardDeduction` this year — 2025 is the year they diverge.
    standardDeduction: {
      singleOrMarriedFilingSeparately: 14_600,
      marriedFilingJointly: 29_200,
      headOfHousehold: 21_900,
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
    notes: [],
  },

  sources: [
    {
      title: 'IRS Publication 15-T (2024) — Federal Income Tax Withholding Methods',
      url: 'https://www.irs.gov/pub/irs-prior/p15t--2024.pdf',
    },
    {
      title: 'IRS Rev. Proc. 2023-34 — inflation adjustments for tax year 2024',
      url: 'https://www.irs.gov/pub/irs-drop/rp-23-34.pdf',
    },
    {
      title:
        'IRS — correction to the tax rate schedules in the 2024 Instructions for Form 1040 (married filing separately over $365,600: $98,334.75, not $99,334.75)',
      url: 'https://www.irs.gov/forms-pubs/correction-to-the-tax-rate-schedules-in-the-2024-instructions-for-form-1040',
    },
    {
      title: 'SSA — 2024 Social Security wage base ($168,600)',
      url: 'https://www.ssa.gov/oact/cola/cbb.html',
    },
    {
      title: 'IRS — 2024 earned income tax credit income limits and maximum credit amounts',
      url: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-tax-credit-income-limits-and-maximum-credit-amounts',
    },
    {
      title: '26 U.S.C. § 1(j) — tax rate tables',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
    },
    {
      title: '26 U.S.C. § 164(b)(6) — the $10,000 state and local tax cap before OBBBA',
      url: 'https://www.law.cornell.edu/uscode/text/26/164',
    },
    {
      title: '26 U.S.C. § 24(h) — the TCJA child tax credit at $2,000',
      url: 'https://www.law.cornell.edu/uscode/text/26/24',
    },
  ],
};
