/**
 * California — the largest state income tax in the country, and the one whose
 * shape is least like the federal return it starts from.
 *
 * Three things here are routinely got wrong:
 *
 * 1. **The joint schedule is the single schedule doubled, and the Mental Health
 *    Services Tax threshold is not.** Every one of the nine bracket thresholds
 *    doubles for a joint return (R&TC § 17041(a)(2)), so the schedules below are
 *    *derived* from the single one rather than transcribed twice. The 1% tax on
 *    taxable income over $1,000,000 (R&TC § 17043) has no such rule: the
 *    threshold is $1,000,000 per return whatever the status. A couple at
 *    $1,200,000 pays it; two single filers at $600,000 each do not.
 * 2. **California's exemptions are credits, not deductions.** A $153 personal
 *    exemption credit is worth $153 to a 1% filer and $153 to a 12.3% filer. An
 *    engine that models it as a deduction from income overstates its value at the
 *    top of the schedule by an order of magnitude and understates the tax.
 * 3. **The exemption credit phases out in whole $2,500 steps.** "$6 for each
 *    $2,500, or fraction thereof, of federal AGI over the threshold" — one dollar
 *    past a step costs the full $6, multiplied by every exemption on the return.
 *
 * Head of household has its own schedule; it is not derived from anything.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

/**
 * California's 2025 single schedule, as bracket ceilings.
 *
 * These are the figures the Franchise Tax Board published for 2025 after applying
 * the California CPI factor of 1.030 to the 2024 schedule. `test/california.test.js`
 * asserts that one factor reproduces the brackets, the standard deduction and the
 * dependent exemption credit together — indexing all of them by a single number is
 * the rule in R&TC § 17041(h), so a transcription error in any one of them shows up
 * as a disagreement with the other two.
 */
const SINGLE_2025: readonly Bracket[] = [
  { rate: 0.01, upTo: 11079 },
  { rate: 0.02, upTo: 26264 },
  { rate: 0.04, upTo: 41452 },
  { rate: 0.06, upTo: 57542 },
  { rate: 0.08, upTo: 72724 },
  { rate: 0.093, upTo: 371479 },
  { rate: 0.103, upTo: 445771 },
  { rate: 0.113, upTo: 742953 },
  { rate: 0.123, upTo: Infinity },
];

const HEAD_OF_HOUSEHOLD_2025: readonly Bracket[] = [
  { rate: 0.01, upTo: 22173 },
  { rate: 0.02, upTo: 52530 },
  { rate: 0.04, upTo: 67716 },
  { rate: 0.06, upTo: 83805 },
  { rate: 0.08, upTo: 98990 },
  { rate: 0.093, upTo: 505208 },
  { rate: 0.103, upTo: 606251 },
  { rate: 0.113, upTo: 1010417 },
  { rate: 0.123, upTo: Infinity },
];

/** R&TC § 17041(a)(2): the joint thresholds are twice the single ones. */
export function doubled(brackets: readonly Bracket[]): readonly Bracket[] {
  return brackets.map((b) => ({ rate: b.rate, upTo: b.upTo === Infinity ? Infinity : b.upTo * 2 }));
}

function schedules(
  single: readonly Bracket[],
  headOfHousehold: readonly Bracket[],
): ByStatus<readonly Bracket[]> {
  return byStatusOf<readonly Bracket[]>({
    single,
    // Married filing separately uses the single schedule unchanged, which is what
    // makes the joint schedule exactly two separate returns stacked.
    separate: single,
    joint: doubled(single),
    headOfHousehold,
  });
}

/**
 * The CalEITC phase-in ceilings as R&TC § 17052(b)(1) prints them, before
 * indexing — and they are exactly **half** the federal 2015 earned income
 * amounts of `$6,580`, `$9,880` and `$13,870`.
 *
 * California adopted the federal § 32 structure as it stood in 2015, halved the
 * ceiling, and has indexed by the California CPI ever since. The federal credit
 * kept indexing too, so the two have drifted apart by a quarter century of
 * inflation in ten years: the federal phase-in for a childless filer ends at
 * `$8,490` in 2025 and California's at `$4,661`.
 *
 * Storing the 2015 base as well as the indexed amounts makes the relationship
 * checkable — `test/california.test.js` asserts that one factor reproduces all
 * three of a year's amounts from it, which is the same test the brackets, the
 * standard deduction and the dependent exemption credit already get.
 */
export const CALEITC_2015_STATUTORY_AMOUNTS: readonly number[] = [3290, 4940, 6935];

/**
 * The federal § 32 credit percentages, which § 17052 adopts by reference and
 * never restates. California uses them for the phase-in *and* the phase-out.
 */
export const CALEITC_RATES: readonly number[] = [0.0765, 0.34, 0.4, 0.45];

/** R&TC § 17052(a)(2)(B), set by the Budget Act; 85% every year since 2015. */
export const CALEITC_ADJUSTMENT_FACTOR = 0.85;

const CITATIONS: readonly Citation[] = [
  {
    title: 'Cal. Rev. & Tax. Code § 17041 — rates and the joint-schedule doubling rule',
    url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17041',
  },
  {
    title: 'Cal. Rev. & Tax. Code § 17043 — 1% Mental Health Services Tax over $1,000,000',
    url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17043',
  },
  {
    title: 'Cal. Rev. & Tax. Code § 17054 — personal and dependent exemption credits',
    url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17054',
  },
  {
    title: 'FTB 2025 California Tax Rate Schedules and indexing',
    url: 'https://www.ftb.ca.gov/forms/2025/2025-california-tax-rate-schedules.html',
  },
  {
    title: 'Cal. Rev. & Tax. Code § 17052 — California Earned Income Tax Credit',
    url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17052',
  },
  {
    title: 'Cal. Rev. & Tax. Code § 17052.1 — Young Child Tax Credit',
    url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17052.1',
  },
  {
    title: 'FTB Form 3514 — California Earned Income Tax Credit, and its instructions',
    url: 'https://www.ftb.ca.gov/forms/2025/2025-3514-booklet.html',
  },
];

/**
 * CalEITC for 2025.
 *
 * The three indexed ceilings are `CALEITC_2015_STATUTORY_AMOUNTS` carried
 * forward by the California CPI; `finalPhaseOutStartCredit` is the one figure no
 * California release states, read off the kink in the published lookup table and
 * checked against twelve of that table's values in `test/california.test.js`.
 */
const CALEITC_2025 = {
  name: 'California Earned Income Tax Credit (CalEITC)',
  adjustmentFactor: CALEITC_ADJUSTMENT_FACTOR,
  byChildCount: [
    { children: 0, phaseInRate: 0.0765, earnedIncomeAmount: 4661, finalPhaseOutStartCredit: 251 },
    { children: 1, phaseInRate: 0.34, earnedIncomeAmount: 6998, finalPhaseOutStartCredit: 635 },
    { children: 2, phaseInRate: 0.4, earnedIncomeAmount: 9823, finalPhaseOutStartCredit: 635 },
    { children: 3, phaseInRate: 0.45, earnedIncomeAmount: 9823, finalPhaseOutStartCredit: 635 },
  ],
  finalPhaseOutEnd: 32901,
  investmentIncomeLimit: 4814,
  minimumAgeWithoutChildren: 18,
  qualifyingChildMaxAge: 18,
} as const;

/**
 * The Young Child Tax Credit for 2025.
 *
 * `amountPerIncrement` is not transcribed — it is
 * `amount / ((finalPhaseOutEnd - start) / increment)` truncated to the cent,
 * which is the rule the Franchise Tax Board applies from 2024 and which happens
 * to reproduce the legislated figure in 2021 and 2022 as well.
 */
const YCTC_2025 = {
  name: 'Young Child Tax Credit',
  amount: 1189,
  ineligibleAge: 6,
  phaseOut: {
    start: 27425,
    increment: 100,
    amountPerIncrement:
      Math.floor((1189 / ((32901 - 27425) / 100)) * 100) / 100,
  },
} as const;

const SHARED_NOTES: readonly string[] = [
  'California exemptions are credits, not deductions: the personal exemption credit is worth the same dollar amount at every rate. Modelling it as a deduction from income understates the tax.',
  'The 1% Mental Health Services Tax threshold of $1,000,000 is per return and is NOT doubled for a joint return, even though every bracket threshold is. A married couple at $1,200,000 of taxable income owes it; two single filers at $600,000 each do not.',
  'California does not conform to the federal QBI deduction, to bonus depreciation, or to the four OBBBA Schedule 1-A deductions, and it taxes health savings account contributions. Those are additions and subtractions on Schedule CA (540); this package does not enumerate them — supply them via `additions` and `subtractions`.',
  'CalEITC is not a percentage of the federal credit and cannot be approximated as one. It has no plateau: the credit peaks at a single dollar of earned income — $4,661 with no children, $9,823 with two — and falls at the same rate it climbed. Below the peak the California marginal rate is NEGATIVE (minus 34% for a two-child filer, on top of the federal minus 40%); one dollar past it the rate is plus 34%. A 68-point swing across one dollar of income, and no rate table anywhere shows it.',
  'CalEITC then stops falling and crawls. Once it reaches $251 (no children) or $635, the rest is spread in a straight line to zero at $32,901 of earned income — 4.2 cents on the dollar for a two-child filer across $15,000 of income, and 0.9 cents for a childless one across $27,000. The $32,901 is a cliff for federal AGI as well: a filer whose AGI is over it gets nothing however small their earnings.',
  'The Young Child Tax Credit is one credit per return, not one per child: a family with one child under 6 and a family with three both get $1,189. It is gated on receiving CalEITC, so the CalEITC investment-income limit of $4,814 costs a young family $1,189 more than it appears to.',
  'The $4,814 investment-income limit is a cliff, not a phase-out. One dollar of interest over it costs the whole CalEITC and, because that credit gates it, the whole Young Child Tax Credit — $4,528.82 at the worst point, a single parent of two young children with $9,823 of earnings, which is exactly where CalEITC peaks.',
  'NOT MODELLED — the Foster Youth Tax Credit (R&TC § 17052.2), which is worth exactly the same $1,189 as the Young Child Tax Credit and phases out on the same schedule, for a CalEITC-eligible filer aged 18 to 25 who was in California foster care at 13 or older. It needs a foster-care history this package has no input for. A former foster youth computed here is too high by up to $1,189, and the credit is among the least claimed in California.',
  'NOT MODELLED — the renter credit, the California AMT, and the itemized deduction limitation for high incomes.',
];

export function california(year: number): StateIncomeTaxDefinition | undefined {
  if (year === 2025) {
    return {
      code: 'CA',
      name: 'California',
      year,
      status: 'published',
      base: 'federalAdjustedGrossIncome',
      rate: { kind: 'brackets', byStatus: schedules(SINGLE_2025, HEAD_OF_HOUSEHOLD_2025) },
      deduction: {
        kind: 'table',
        amounts: byStatus({
          single: 5706,
          separate: 5706,
          joint: 11412,
          headOfHousehold: 11412,
        }),
      },
      surtax: {
        name: 'Mental Health Services Tax',
        brackets: [
          { rate: 0, upTo: 1_000_000 },
          { rate: 0.01, upTo: Infinity },
        ],
        thresholdNotDoubledForJoint: true,
      },
      exemptionCredit: {
        name: 'Personal and dependent exemption credits',
        perFiler: byStatus({ single: 153, separate: 153, joint: 306, headOfHousehold: 153 }),
        perDependent: 475,
        phaseOut: {
          amountPerIncrement: 6,
          increment: byStatus({
            single: 2500,
            // Married filing separately halves the step as well as the threshold,
            // so a separate return loses the credit at the same rate per dollar as
            // half a joint one.
            separate: 1250,
            joint: 2500,
            headOfHousehold: 2500,
          }),
          start: byStatus({
            single: 252203,
            separate: 252203,
            joint: 504411,
            headOfHousehold: 378310,
          }),
        },
      },
      ownEarnedIncomeCredit: CALEITC_2025,
      youngChildCredit: YCTC_2025,
      notes: SHARED_NOTES,
      citations: CITATIONS,
    };
  }
  if (year === 2026) {
    const published = california(2025)!;
    return {
      ...published,
      year,
      status: 'provisional',
      notes: [
        'PROVISIONAL: the 2026 bracket thresholds, standard deduction, exemption credits, CalEITC amounts and Young Child Tax Credit below are the published 2025 figures carried forward. California indexes all of them by the California CPI factor, which the Franchise Tax Board publishes late in the tax year; this package could not reach ftb.ca.gov to confirm the 2026 factor. The rates themselves are statutory and are correct. Expect the computed tax to be slightly HIGH — carrying thresholds forward leaves income in higher bands than the indexed schedule would, and carrying the CalEITC ceilings forward understates the credit for a filer on the phase-in.',
        ...SHARED_NOTES,
      ],
      citations: CITATIONS,
    };
  }
  return undefined;
}
