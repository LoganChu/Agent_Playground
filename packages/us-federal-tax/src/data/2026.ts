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

  // Section 199A. Two things changed for 2026 and both are easy to miss.
  //
  // 1. OBBBA § 70105(b) widened the phase-in range from $50,000/$100,000 to
  //    $75,000/$150,000, effective for tax years beginning after 2025. A 2025
  //    implementation carried forward to 2026 will phase the limitations in
  //    50% too fast.
  // 2. OBBBA § 70105(c) added § 199A(i), a $400 floor for filers with at least
  //    $1,000 of QBI from a business they materially participate in. New; nothing
  //    written before mid-2025 has it.
  //
  // Also note the threshold for married filing separately is $25 *higher* than
  // single, not equal to it. § 1(f)(7) rounds the inflation adjustment down to a
  // multiple of $50 in general but to a multiple of $25 for a separate return,
  // and the 2026 unrounded figure lands between $201,750 and $201,800. The same
  // $25 split appears in Rev. Proc. 2020-45 for 2021 ($164,900 / $164,925), so
  // this is the rule working as written rather than a one-off.
  section199A: {
    deductionRate: 0.2,

    thresholdAmount: {
      single: 201_750,
      marriedFilingJointly: 403_500,
      marriedFilingSeparately: 201_775,
      headOfHousehold: 201_750,
      // Not stated separately in the Revenue Procedure, which distinguishes only
      // joint returns, separate returns, and "all other" filers. § 199A(e)(2)(A)
      // doubles the amount "in the case of a joint return", and a surviving
      // spouse does not file one — but § 1(a) applies the joint rate schedule to
      // surviving spouses, and that is how this is treated in practice. Kept as
      // data so the other reading is a one-line change.
      qualifyingSurvivingSpouse: 403_500,
    },

    phaseInRange: {
      single: 75_000,
      marriedFilingJointly: 150_000,
      // $75,000, matching single — it is *not* half the joint range.
      marriedFilingSeparately: 75_000,
      headOfHousehold: 75_000,
      qualifyingSurvivingSpouse: 150_000,
    },

    w2WageRate: 0.5,
    w2WageAlternativeRate: 0.25,
    qualifiedPropertyRate: 0.025,

    minimumDeduction: {
      amount: 400,
      activeQualifiedBusinessIncomeFloor: 1_000,
    },
  },

  // § 164(b)(6), as amended by OBBBA § 70120. The cap rises 1% a year through
  // 2029 ($40,804 / $41,212 / $41,624) and then falls back to $10,000 in 2030.
  //
  // The phase-down is the part that is new and the part that bites: 30 cents of
  // cap per dollar of MAGI above $505,000, stopping at $10,000. For a joint
  // filer that band runs from $505,000 to $606,333.33, and inside it the
  // marginal rate on ordinary income is roughly 10.5 points above the bracket
  // rate — then drops back down again once the floor is reached.
  saltCap: {
    finalYear: 2029,

    cap: {
      single: 40_400,
      marriedFilingJointly: 40_400,
      // Halved for a separate return, as are the threshold and the floor.
      marriedFilingSeparately: 20_200,
      headOfHousehold: 40_400,
      qualifyingSurvivingSpouse: 40_400,
    },

    phaseDownRate: 0.3,

    phaseDownThreshold: {
      single: 505_000,
      marriedFilingJointly: 505_000,
      marriedFilingSeparately: 252_500,
      headOfHousehold: 505_000,
      qualifyingSurvivingSpouse: 505_000,
    },

    floor: {
      single: 10_000,
      marriedFilingJointly: 10_000,
      marriedFilingSeparately: 5_000,
      headOfHousehold: 10_000,
      qualifyingSurvivingSpouse: 10_000,
    },
  },

  // § 24, as amended by OBBBA § 70104. The credit is now permanent at $2,200 and
  // indexed after 2025, but the indexing rounds *down* to a multiple of $100, so
  // the 2026 figure is unchanged from 2025 and will stay at $2,200 until the
  // unrounded amount clears $2,300. Same story for the $1,700 refundable cap.
  //
  // The two thresholds are not indexed at all: § 24(b)(2) fixes them at $200,000
  // and $400,000 in the statute, with no adjustment provision.
  childTaxCredit: {
    amountPerChild: 2_200,
    // § 24(h)(4). Never indexed, and never refundable.
    amountPerOtherDependent: 500,
    // "Under 17" — § 24(c)(1) requires the child not to have attained age 17.
    maximumChildAge: 17,

    phaseOut: {
      amountPerIncrement: 50,
      increment: 1_000,
      // § 24(b)(1): "$50 for each $1,000 (or fraction thereof)". Schedule 8812
      // line 10 says to increase a partial excess to the next whole $1,000, so
      // one dollar over the threshold costs the full $50. Modelling this as a
      // flat 5% of the excess is wrong by up to $50 for every filer in the range.
      rounding: 'up',
      thresholds: {
        single: 200_000,
        marriedFilingJointly: 400_000,
        // Not halved. § 24(b)(2)(B) gives $200,000 to everyone who is not filing
        // jointly, which is one of the few places the code does not halve a joint
        // figure for a separate return.
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

    // OBBBA § 70104(c), first effective 2025. Before that only the *child* needed
    // a work-authorized SSN; now the taxpayer does too.
    requiresTaxpayerSocialSecurityNumber: true,
  },

  // § 32. The credit and phase-out percentages are statutory and have not moved
  // since 1996; the dollar amounts are indexed annually.
  //
  // Two things about this table are easy to get wrong.
  //
  // 1. The joint-return add-on under § 32(b)(2)(B) is applied and *then* the sum
  //    is rounded to the nearest $10, so the effective add-on is not constant
  //    across the table. In 2026 it is $7,280 with no children ($18,140 −
  //    $10,860) but $7,270 with children ($31,160 − $23,890). In 2025 the split
  //    ran the other way: $7,110 and $7,120. Storing a single add-on therefore
  //    misplaces one of the two tables by $10 of income every year.
  // 2. Rev. Proc. 2025-32 was reissued on 2025-10-17 with a correction to this
  //    table: the completed phase-out amount for a joint return with three or
  //    more children became $70,244, up from the $70,224 published on 2025-10-09.
  //    Anything transcribed from the original release carries the old figure.
  //
  // The completed phase-out amounts are *derived* here rather than stored —
  // `phaseOutStart + maximumCredit / phaseOutRate` — and `test/credits.test.js`
  // pins the derived values against the published ones.
  earnedIncomeCredit: {
    table: [
      // No qualifying children. Max credit $664 at $8,680 of earned income.
      {
        creditRate: 0.0765,
        phaseOutRate: 0.0765,
        maximumCredit: 664,
        phaseOutStart: {
          single: 10_860,
          marriedFilingJointly: 18_140,
          marriedFilingSeparately: 10_860,
          headOfHousehold: 10_860,
          qualifyingSurvivingSpouse: 18_140,
        },
      },
      // One qualifying child. Max credit $4,427 at $13,020 of earned income.
      {
        creditRate: 0.34,
        phaseOutRate: 0.1598,
        maximumCredit: 4_427,
        phaseOutStart: {
          single: 23_890,
          marriedFilingJointly: 31_160,
          marriedFilingSeparately: 23_890,
          headOfHousehold: 23_890,
          qualifyingSurvivingSpouse: 31_160,
        },
      },
      // Two qualifying children. Max credit $7,316 at $18,290 of earned income.
      {
        creditRate: 0.4,
        phaseOutRate: 0.2106,
        maximumCredit: 7_316,
        phaseOutStart: {
          single: 23_890,
          marriedFilingJointly: 31_160,
          marriedFilingSeparately: 23_890,
          headOfHousehold: 23_890,
          qualifyingSurvivingSpouse: 31_160,
        },
      },
      // Three or more. Same $18,290 earned income amount as two children, but a
      // 45% credit rate, so the maximum is $8,231.
      {
        creditRate: 0.45,
        phaseOutRate: 0.2106,
        maximumCredit: 8_231,
        phaseOutStart: {
          single: 23_890,
          marriedFilingJointly: 31_160,
          marriedFilingSeparately: 23_890,
          headOfHousehold: 23_890,
          qualifyingSurvivingSpouse: 31_160,
        },
      },
    ],

    // § 32(i). A hard cliff, not a phase-out: one dollar of disqualified income
    // over this and the entire credit is gone.
    maximumInvestmentIncome: 12_200,

    // § 32(c)(1)(A)(ii)(II). Applies only when there are no qualifying children.
    // ARPA suspended both ends for 2021 only; they are back.
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
    // Back in step with `standardDeduction`: Rev. Proc. 2025-32 indexes the
    // post-OBBBA amounts, so 2026's tables and 2026's return agree again.
    standardDeduction: {
      singleOrMarriedFilingSeparately: 16_100,
      marriedFilingJointly: 32_200,
      headOfHousehold: 24_150,
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
      'The 2026 schedules here are derived from the published 2026 rate schedules and ' +
        'standard deduction by the same identity that reproduces every 2024 and 2025 ' +
        'published threshold exactly. Publication 15-T for 2026 was not available to ' +
        'check them against directly.',
      'Withholding takes no account of the Schedule 1-A deductions for tips, overtime, ' +
        'seniors or car loan interest. An employee who expects them should claim them ' +
        'on Form W-4 Step 4(b) rather than wait for the refund.',
    ],
  },

  sources: [
    {
      title: 'IRS Publication 15-T — Federal Income Tax Withholding Methods',
      url: 'https://www.irs.gov/forms-pubs/about-publication-15-t',
    },
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
    {
      title: '26 U.S.C. § 199A — qualified business income',
      url: 'https://www.law.cornell.edu/uscode/text/26/199A',
    },
    {
      title: '26 U.S.C. § 1(f)(7) — rounding of inflation adjustments ($50, or $25 on a separate return)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
    },
    {
      title: 'Pub. L. 119-21 § 70105 — § 199A made permanent, wider phase-in range, § 199A(i) minimum deduction',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: 'IRS Form 8995 — qualified business income deduction, simplified computation',
      url: 'https://www.irs.gov/pub/irs-pdf/f8995.pdf',
    },
    {
      title: 'IRS Form 8995-A and Schedule A — QBI deduction with the wage/UBIA cap and the SSTB phase-out',
      url: 'https://www.irs.gov/pub/irs-pdf/f8995a.pdf',
    },
    {
      title:
        'IRS — corrections to the 2025 Form 8995-A instructions: taxable income before the QBI deduction is Form 1040 line 11a less lines 12e and 13b',
      url: 'https://www.irs.gov/forms-pubs/corrections-to-the-instructions-on-how-to-calculate-the-taxable-income-before-qbi-deduction-for-form-8995-a',
    },
    {
      title: '26 C.F.R. § 1.199A-1(d)(2)(iii) — netting negative QBI and the loss carryforward',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.199A-1',
    },
    {
      title:
        '26 U.S.C. § 164(b)(6) — state and local tax cap, its phase-down, and the modified AGI definition',
      url: 'https://www.law.cornell.edu/uscode/text/26/164',
    },
    {
      title: 'Pub. L. 119-21 § 70120 — the raised SALT cap for 2025-2029 and its phase-down',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: '26 U.S.C. § 24 — child tax credit, the $50-per-$1,000 phase-out, and § 24(d) refundability',
      url: 'https://www.law.cornell.edu/uscode/text/26/24',
    },
    {
      title:
        'Pub. L. 119-21 § 70104 — § 24 made permanent at $2,200, indexed, with the new taxpayer SSN requirement',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: 'IRS Schedule 8812 (Form 1040) — credits for qualifying children and other dependents',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s8.pdf',
    },
    {
      title: '26 U.S.C. § 32 — earned income credit, including § 32(c)(2) earned income and the § 32(i) investment income limit',
      url: 'https://www.law.cornell.edu/uscode/text/26/32',
    },
    {
      title:
        'IRS Rev. Proc. 2025-32 as reissued 2025-10-17 — corrects the EITC completed phase-out for a joint return with three or more children to $70,244',
      url: 'https://www.irs.gov/irb/2025-45_IRB',
    },
  ],
};
