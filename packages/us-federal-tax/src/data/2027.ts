import type { YearParameters } from '../types.js';
import { SOCIAL_SECURITY_TAXABILITY } from './social-security.js';
import { CODE_SOURCES, SCHEDULE_ONE_A_CODE_SOURCES } from './sources.js';
import {
  OVERTIME_SEPARATE_RETURN,
  SENIOR_SEPARATE_RETURN,
  TIPS_SEPARATE_RETURN,
  VEHICLE_LOAN_INTEREST_SEPARATE_RETURN,
} from './schedule-one-a.js';

/**
 * Tax year 2027 federal parameters.
 *
 * The indexed figures below are those of **Rev. Proc. 2026-35**, released
 * 2026-11-05 and scheduled for I.R.B. 2026-48 on 2026-11-23.
 *
 * ## READ THIS BEFORE THE NUMBERS: WHAT WAS AND WAS NOT READ
 *
 * **`rp-26-35.pdf` was not opened here.** `irs.gov` is outside this sandbox's
 * network allowlist — the same limitation the 2026 withholding block records,
 * and the reason `src/data/2026.ts` carries a comment about a worksheet it
 * could not read. Every other year in this package was transcribed from the
 * Revenue Procedure itself. **This one was not**, and that difference is the
 * single most important fact on this page.
 *
 * What stands behind each figure instead is three independent chains that agree:
 *
 * 1. **A machine-readable transcription with per-figure page citations.**
 *    `policyengine-us` 2.138.2, installed from PyPI, carries 2027 values whose
 *    metadata names the page of `rp-26-35.pdf` each came from — the brackets at
 *    page 4, capital gains at 7, the credits at 8 and 10, AMT at 11-12, the
 *    standard deduction at 13, § 199A at 17. Day 27 of this project established
 *    that **a second model agreeing is not a source**, and that rule is not
 *    repealed here: what is being used is their *citation*, checked against
 *    other chains, and the citation is what makes it checkable.
 * 2. **Independent secondary transcriptions.** KPMG's TaxNewsFlash on
 *    Rev. Proc. 2026-35, the Journal of Accountancy and The Tax Adviser reports
 *    of 2026-11-05, and the IRS newsroom release IR-2026-133. Where these print
 *    a figure it agrees with chain 1 — the $16,600 / $33,200 / $24,925 standard
 *    deductions, the 35% band opening at $264,550 and $529,100, the $8,496 and
 *    $7,552 earned income credits, the $2,300 child credit and its $1,800
 *    refundable cap.
 * 3. **The statute's own arithmetic.** § 1(f) indexing applied to the 2026 base
 *    reproduces every bracket ceiling in this file to the dollar at a 3.25%
 *    factor with § 1(f)(7) rounding, and §§ 164(b)(6) and 199A(i) are scheduled
 *    rather than indexed, so their 2027 values are computable from the Code
 *    alone. `test/year-2027.test.js` performs that derivation and fails on a
 *    figure that does not survive it.
 *
 * **That is a weaker claim than every other year in this package makes**, and it
 * is why `LATEST_YEAR` is still 2026: a caller gets 2027 by asking for it, never
 * by default. `PRIMARY_VERIFIED_YEARS` in `core.ts` states it in data rather
 * than in this comment, and flipping it is a one-line change once somebody can
 * open the PDF.
 *
 * ## THE THREE THINGS THAT WOULD SURPRISE A CAREFUL READER
 *
 * **1. Head of household is no longer 1.5x single.** It has been exactly that
 * in every year this package covers — $21,900 / $14,600, $23,625 / $15,750,
 * $24,150 / $16,100 — because § 63(c)(2) sets the two amounts in that ratio and
 * the rounding happened to preserve it. For 2027 the single amount is $16,600
 * and head of household is **$24,925**, not the $24,900 the ratio gives. The two
 * amounts are indexed separately under § 63(c)(7)(B)(ii) and 2027 is the first
 * year their roundings part. **Any engine that derives one from the other is
 * $25 of deduction wrong for every head of household in the country**, and one
 * of the secondary sources consulted here printed $24,900 for exactly that
 * reason.
 *
 * **2. The head-of-household bracket divergences moved, in both directions.**
 * In 2026 the head-of-household 22% band ended level with single ($105,700) and
 * its 24% and 32% bands ended $25 below. In 2027 the 22% band ends **$25 below**
 * single ($109,100 against $109,125) and the 32% band ends **level** with it
 * ($264,550). These are not typos in either year; they are what separate
 * roundings of separate indexed amounts do, and they are why this file writes
 * all five filing statuses out rather than aliasing them.
 *
 * **3. § 199A(i) is indexed, and 2027 is the first year it moves.** OBBBA added
 * the $400 minimum deduction for a filer with at least $1,000 of active QBI,
 * effective 2026. Both figures are indexed: for 2027 they are **$415** and
 * **$1,030**. Anything that treated them as statutory constants — as they
 * appeared to be in their only prior year — is wrong for 2027.
 *
 * ## WHAT IS NOT HERE
 *
 * `withholding` is the same reconstruction the 2026 block is, one year further
 * from a document: **Publication 15-T for 2027 does not exist yet** (it is
 * published in December), so the figures that come from it rather than from the
 * rate schedules are carried forward from 2026 and marked as carried forward in
 * the provenance ledger. See `withholding.notes` on this object.
 */
export const YEAR_2027: YearParameters = {
  year: 2027,

  // Rev. Proc. 2026-35 § 3.01, Tables 1-5. Ceilings, in taxable income.
  ordinaryBrackets: {
    single: [
      { rate: 0.1, upTo: 12_800 },
      { rate: 0.12, upTo: 52_025 },
      { rate: 0.22, upTo: 109_125 },
      { rate: 0.24, upTo: 208_325 },
      { rate: 0.32, upTo: 264_550 },
      { rate: 0.35, upTo: 661_375 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0.1, upTo: 25_600 },
      { rate: 0.12, upTo: 104_050 },
      { rate: 0.22, upTo: 218_250 },
      { rate: 0.24, upTo: 416_650 },
      { rate: 0.32, upTo: 529_100 },
      { rate: 0.35, upTo: 793_650 },
      { rate: 0.37, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0.1, upTo: 12_800 },
      { rate: 0.12, upTo: 52_025 },
      { rate: 0.22, upTo: 109_125 },
      { rate: 0.24, upTo: 208_325 },
      { rate: 0.32, upTo: 264_550 },
      // Exactly half the joint 35% ceiling, as in every year: 793,650 / 2.
      { rate: 0.35, upTo: 396_825 },
      { rate: 0.37, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0.1, upTo: 18_250 },
      { rate: 0.12, upTo: 69_650 },
      // $25 BELOW single. In 2026 these two were equal. See the header.
      { rate: 0.22, upTo: 109_100 },
      { rate: 0.24, upTo: 208_300 },
      // LEVEL with single. In 2026 this one was $25 below.
      { rate: 0.32, upTo: 264_550 },
      { rate: 0.35, upTo: 661_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0.1, upTo: 25_600 },
      { rate: 0.12, upTo: 104_050 },
      { rate: 0.22, upTo: 218_250 },
      { rate: 0.24, upTo: 416_650 },
      { rate: 0.32, upTo: 529_100 },
      { rate: 0.35, upTo: 793_650 },
      { rate: 0.37, upTo: Infinity },
    ],
  },

  // § 63(c)(7)(B)(ii). NOTE head of household: $24,925, not 1.5 x $16,600.
  standardDeduction: {
    single: 16_600,
    marriedFilingJointly: 33_200,
    marriedFilingSeparately: 16_600,
    headOfHousehold: 24_925,
    qualifyingSurvivingSpouse: 33_200,
  },

  // § 63(f). Per qualifying condition: a single filer 65+ and blind gets 2 x 2,100.
  additionalStandardDeduction: {
    single: 2_100,
    marriedFilingJointly: 1_700,
    marriedFilingSeparately: 1_700,
    headOfHousehold: 2_100,
    qualifyingSurvivingSpouse: 1_700,
  },

  // 42 U.S.C. § 430. SSA, announced 2026-10-14 with the 3.6% COLA; up $7,800
  // from $184,500. Not an IRS figure and not in the Revenue Procedure.
  socialSecurityWageBase: 192_300,

  rates: {
    socialSecurityEmployee: 0.062,
    socialSecurityEmployer: 0.062,
    medicareEmployee: 0.0145,
    medicareEmployer: 0.0145,
    additionalMedicare: 0.009,
    seSocialSecurity: 0.124,
    seMedicare: 0.029,
  },

  // Form 8959. § 3101(b)(2) states these; no adjustment provision moves them.
  additionalMedicareThreshold: {
    single: 200_000,
    marriedFilingJointly: 250_000,
    marriedFilingSeparately: 125_000,
    headOfHousehold: 200_000,
    qualifyingSurvivingSpouse: 200_000,
  },

  seNetEarningsFactor: 0.9235,
  seMinimumNetEarnings: 400,

  // § 1(h), as indexed. Rev. Proc. 2026-35 § 3.03.
  longTermCapitalGains: {
    single: [
      { rate: 0, upTo: 51_050 },
      { rate: 0.15, upTo: 563_200 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingJointly: [
      { rate: 0, upTo: 102_100 },
      { rate: 0.15, upTo: 633_600 },
      { rate: 0.2, upTo: Infinity },
    ],
    marriedFilingSeparately: [
      { rate: 0, upTo: 51_050 },
      { rate: 0.15, upTo: 316_800 },
      { rate: 0.2, upTo: Infinity },
    ],
    headOfHousehold: [
      { rate: 0, upTo: 68_350 },
      { rate: 0.15, upTo: 598_400 },
      { rate: 0.2, upTo: Infinity },
    ],
    qualifyingSurvivingSpouse: [
      { rate: 0, upTo: 102_100 },
      { rate: 0.15, upTo: 633_600 },
      { rate: 0.2, upTo: Infinity },
    ],
  },

  // § 1411. Never indexed — the statute states these and has since 2013.
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
  // IDENTICAL TO 2026, AND THAT IS A FINDING RATHER THAN A CARRY-FORWARD.
  // None of these four amounts carries an indexing provision, and
  // Rev. Proc. 2026-35 adjusts none of them: the $25,000 tips cap, the
  // $12,500/$25,000 overtime caps, the $6,000 senior deduction and the $10,000
  // vehicle-loan-interest cap are the same figures in 2027 as in 2025, as are
  // all four phase-out thresholds. Their third year is 2027 and their last is
  // 2028.
  scheduleOneA: {
    finalYear: 2028,

    // § 224. Cap is per return and is *not* doubled on a joint return.
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
      separateReturn: TIPS_SEPARATE_RETURN,
    },

    // § 225. Here the cap *is* doubled on a joint return, unlike tips.
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
      separateReturn: OVERTIME_SEPARATE_RETURN,
    },

    // OBBBA § 70103. On top of the § 63(f) additional standard deduction, which
    // DID move this year ($2,050 -> $2,100 unmarried). The $6,000 did not.
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
      separateReturn: SENIOR_SEPARATE_RETURN,
    },

    // § 163(h)(4)(C). Phase-out rounds the *other* way from tips/overtime.
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
      separateReturn: VEHICLE_LOAN_INTEREST_SEPARATE_RETURN,
    },
  },

  // Section 199A.
  //
  // The $25 split between single and married-filing-separately survives into a
  // second year: § 1(f)(7) rounds the separate figure to a multiple of $25 and
  // every other status to a multiple of $50, and the 2027 unrounded amount again
  // lands between the two. $208,300 / $208,325, as $201,750 / $201,775 in 2026.
  //
  // AND THE MINIMUM DEDUCTION MOVED FOR THE FIRST TIME. § 199A(i), added by
  // OBBBA § 70105(c) and effective 2026, is indexed: the deduction floor is
  // $415 for 2027 (from $400) and the active-QBI floor that unlocks it is
  // $1,030 (from $1,000). In 2026 both looked like statutory constants because
  // 2026 was their only year.
  section199A: {
    deductionRate: 0.2,

    thresholdAmount: {
      single: 208_300,
      marriedFilingJointly: 416_600,
      marriedFilingSeparately: 208_325,
      headOfHousehold: 208_300,
      // THE SINGLE FIGURE — see the long note in `2026.ts`. § 199A(e)(2) reaches
      // only "a joint return", and a surviving spouse does not file one. The
      // Revenue Procedure gives this provision three rows and puts a surviving
      // spouse in "all other returns".
      qualifyingSurvivingSpouse: 208_300,
    },

    // Not indexed: OBBBA § 70105(b) states $75,000 / $150,000 flat.
    phaseInRange: {
      single: 75_000,
      marriedFilingJointly: 150_000,
      marriedFilingSeparately: 75_000,
      headOfHousehold: 75_000,
      qualifyingSurvivingSpouse: 75_000,
    },

    w2WageRate: 0.5,
    w2WageAlternativeRate: 0.25,
    qualifiedPropertyRate: 0.025,

    minimumDeduction: {
      amount: 415,
      activeQualifiedBusinessIncomeFloor: 1_030,
    },
  },

  // § 164(b)(6), as amended by OBBBA § 70120. Scheduled, not indexed: the cap
  // and the phase-down threshold each rise exactly 1% a year from their 2025
  // values, so 2027 is computable from the Code with no Revenue Procedure at
  // all — $40,400 x 1.01 = $40,804 and $505,000 x 1.01 = $510,050. 2028 is
  // $41,212 / $515,150.50 and 2029 is $41,624 / $520,302.01; in 2030 the cap
  // falls back to $10,000.
  //
  // The floor does NOT rise. It is $10,000 in every year of the schedule, so
  // the phase-down band widens each year: for a joint filer it runs from
  // $510,050 to $612,730 in 2027.
  saltCap: {
    finalYear: 2029,

    cap: {
      single: 40_804,
      marriedFilingJointly: 40_804,
      marriedFilingSeparately: 20_402,
      headOfHousehold: 40_804,
      qualifyingSurvivingSpouse: 40_804,
    },

    phaseDownRate: 0.3,

    phaseDownThreshold: {
      single: 510_050,
      marriedFilingJointly: 510_050,
      marriedFilingSeparately: 255_025,
      headOfHousehold: 510_050,
      qualifyingSurvivingSpouse: 510_050,
    },

    floor: {
      single: 10_000,
      marriedFilingJointly: 10_000,
      marriedFilingSeparately: 5_000,
      headOfHousehold: 10_000,
      qualifyingSurvivingSpouse: 10_000,
    },
  },

  // § 24, as amended by OBBBA § 70104. BOTH indexed amounts moved this year for
  // the first time: the credit is $2,300 (from $2,200) and the refundable cap is
  // $1,800 (from $1,700). The indexing rounds down to a multiple of $100, which
  // is why 2026 sat still and 2027 jumps a full $100 at once — a product that
  // inferred "this is not really indexed" from 2026 is $100 a child short.
  //
  // The two phase-out thresholds are still not indexed at all: § 24(b)(2) fixes
  // them at $200,000 and $400,000 with no adjustment provision.
  childTaxCredit: {
    amountPerChild: 2_300,
    // § 24(h)(4). Never indexed, and never refundable.
    amountPerOtherDependent: 500,
    maximumChildAge: 17,

    phaseOut: {
      amountPerIncrement: 50,
      increment: 1_000,
      // § 24(b)(1): "$50 for each $1,000 (or fraction thereof)" — one dollar
      // over the threshold costs the full $50.
      rounding: 'up',
      thresholds: {
        single: 200_000,
        marriedFilingJointly: 400_000,
        marriedFilingSeparately: 200_000,
        headOfHousehold: 200_000,
        // The SINGLE figure for a surviving spouse — § 24(b)(2): "$400,000 in
        // the case of a joint return, and $200,000 in any other case."
        qualifyingSurvivingSpouse: 200_000,
      },
    },

    refundable: {
      maximumPerChild: 1_800,
      phaseInRate: 0.15,
      phaseInThreshold: 2_500,
      minimumChildrenForSocialSecurityAlternative: 3,
    },

    requiresTaxpayerSocialSecurityNumber: true,
  },

  // § 32. Credit and phase-out percentages are statutory; dollar amounts indexed.
  //
  // The joint add-on under § 32(b)(2)(B) splits again, and the other way round
  // from 2026: $7,520 with no children ($18,730 - $11,210) and $7,510 with
  // children ($32,170 - $24,660). In 2026 it was $7,280 and $7,270; in 2025,
  // $7,110 and $7,120. A single stored add-on misplaces one of the two tables
  // by $10 of income in every year so far.
  //
  // A QUALIFYING SURVIVING SPOUSE TAKES THE SINGLE FIGURE HERE — § 32(b)(2)(B)
  // reaches only "a joint return". See the long note in `2026.ts`.
  earnedIncomeCredit: {
    table: [
      // No qualifying children. Max credit $685 at $8,950 of earned income.
      {
        creditRate: 0.0765,
        phaseOutRate: 0.0765,
        maximumCredit: 685,
        phaseOutStart: {
          single: 11_210,
          marriedFilingJointly: 18_730,
          marriedFilingSeparately: 11_210,
          headOfHousehold: 11_210,
          qualifyingSurvivingSpouse: 11_210,
        },
      },
      // One qualifying child. Max credit $4,573 at $13,450 of earned income.
      {
        creditRate: 0.34,
        phaseOutRate: 0.1598,
        maximumCredit: 4_573,
        phaseOutStart: {
          single: 24_660,
          marriedFilingJointly: 32_170,
          marriedFilingSeparately: 24_660,
          headOfHousehold: 24_660,
          qualifyingSurvivingSpouse: 24_660,
        },
      },
      // Two qualifying children. Max credit $7,552 at $18,880 of earned income.
      {
        creditRate: 0.4,
        phaseOutRate: 0.2106,
        maximumCredit: 7_552,
        phaseOutStart: {
          single: 24_660,
          marriedFilingJointly: 32_170,
          marriedFilingSeparately: 24_660,
          headOfHousehold: 24_660,
          qualifyingSurvivingSpouse: 24_660,
        },
      },
      // Three or more. Same $18,880 earned income amount as two children, but a
      // 45% credit rate, so the maximum is $8,496.
      {
        creditRate: 0.45,
        phaseOutRate: 0.2106,
        maximumCredit: 8_496,
        phaseOutStart: {
          single: 24_660,
          marriedFilingJointly: 32_170,
          marriedFilingSeparately: 24_660,
          headOfHousehold: 24_660,
          qualifyingSurvivingSpouse: 24_660,
        },
      },
    ],

    // § 32(i). A hard cliff, not a phase-out: one dollar of disqualified income
    // over this and the entire credit is gone. $12,200 in 2026.
    maximumInvestmentIncome: 12_600,

    // § 32(c)(1)(A)(ii)(II). Applies only when there are no qualifying children.
    childlessAgeRange: {
      minimum: 25,
      maximum: 64,
    },
  },

  // § 86. Not a per-year figure at all: see `social-security.ts`.
  socialSecurity: SOCIAL_SECURITY_TAXABILITY,

  withholding: {
    // Derived from this year's rate schedules and standard deduction by the
    // identity in `src/withholding.ts`, which reproduces 2024 and 2025 exactly.
    standardDeduction: {
      singleOrMarriedFilingSeparately: 16_600,
      marriedFilingJointly: 33_200,
      headOfHousehold: 24_925,
    },
    // These four are Publication 15-T's own figures, not the Revenue
    // Procedure's. They have not moved since the 2020 Form W-4 was introduced.
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
      'PUBLICATION 15-T FOR 2027 DOES NOT EXIST YET. It is published in December, ' +
        'so at the time these figures were written there was no 2027 withholding ' +
        'document of any kind. The three standard deduction amounts are derived ' +
        'from the 2027 rate schedules by the identity that reproduces 2024 and ' +
        '2025 exactly; the Step 1g amounts, the allowance amount and the built-in ' +
        'allowance counts are CARRIED FORWARD FROM 2026, which is a guess that ' +
        'has been right every year since 2020 and is still a guess. See ' +
        'figureProvenance() for the carriedForwardFrom marker on each.',
      'No withholding table accounts for the Schedule 1-A deductions (tips, overtime, ' +
        'senior, car loan interest). Claim them on Form W-4 Step 4(b), not in April.',
    ],
  },

  sources: [
    // The Code, shared by every year: see `sources.ts`.
    ...CODE_SOURCES,
    ...SCHEDULE_ONE_A_CODE_SOURCES,
    {
      title:
        'TRANSCRIPTION NOT VERIFIED AGAINST THE PRIMARY DOCUMENT — rp-26-35.pdf was not opened; see the header of src/data/2027.ts and PRIMARY_VERIFIED_YEARS in core.ts',
      url: 'https://www.irs.gov/pub/irs-drop/rp-26-35.pdf',
    },
    {
      title: 'IRS Rev. Proc. 2026-35 — inflation adjustments for tax year 2027, released 2026-11-05',
      url: 'https://www.irs.gov/pub/irs-drop/rp-26-35.pdf',
    },
    {
      title:
        'IRS newsroom IR-2026-133 — tax inflation adjustments for tax year 2027',
      url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2027-taxpayers-continue-to-benefit-from-the-working-families-tax-cuts',
    },
    {
      title:
        'KPMG TaxNewsFlash — Rev. Proc. 2026-35: inflation adjustments for tax year 2027 (second transcription chain)',
      url: 'https://kpmg.com/us/en/taxnewsflash/news/2026/11/rev-proc-2026-35-inflation-adjustments-2027.html',
    },
    {
      title:
        'policyengine-us 2.138.2 — 2027 parameter values carrying per-figure page citations into rp-26-35.pdf (third transcription chain)',
      url: 'https://pypi.org/project/policyengine-us/2.138.2/',
    },
    {
      title: 'IRS Publication 15-T — Federal Income Tax Withholding Methods',
      url: 'https://www.irs.gov/forms-pubs/about-publication-15-t',
    },
    {
      title: 'SSA — 2027 Social Security wage base ($192,300), announced 2026-10-14',
      url: 'https://www.ssa.gov/oact/cola/cbb.html',
    },
    {
      title: 'IRS Schedule 1-A (Form 1040) — Additional Deductions',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf',
    },
    {
      title:
        'Pub. L. 119-21 § 70105 — § 199A made permanent, wider phase-in range, § 199A(i) minimum deduction',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title: 'Pub. L. 119-21 § 70120 — the raised SALT cap for 2025-2029 and its phase-down',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title:
        'Pub. L. 119-21 § 70104 — § 24 made permanent at $2,200, indexed, with the new taxpayer SSN requirement',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    },
    {
      title:
        'Pub. L. 119-21 §§ 70201, 70202, 70103 and 70203 — the four Schedule 1-A deductions, for 2025 through 2028',
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
      title: '26 C.F.R. § 1.199A-1(d)(2)(iii) — netting negative QBI and the loss carryforward',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.199A-1',
    },
    {
      title: 'IRS Schedule 8812 (Form 1040) — credits for qualifying children and other dependents',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s8.pdf',
    },
  ],
};
