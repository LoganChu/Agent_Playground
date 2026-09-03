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
];

const SHARED_NOTES: readonly string[] = [
  'California exemptions are credits, not deductions: the personal exemption credit is worth the same dollar amount at every rate. Modelling it as a deduction from income understates the tax.',
  'The 1% Mental Health Services Tax threshold of $1,000,000 is per return and is NOT doubled for a joint return, even though every bracket threshold is. A married couple at $1,200,000 of taxable income owes it; two single filers at $600,000 each do not.',
  'California does not conform to the federal QBI deduction, to bonus depreciation, or to the four OBBBA Schedule 1-A deductions, and it taxes health savings account contributions. Those are additions and subtractions on Schedule CA (540); this package does not enumerate them — supply them via `additions` and `subtractions`.',
  'NOT MODELLED — CalEITC, and it is deliberate. Six other states in this package set their earned income credit as a flat percentage of the federal one, so passing `federal.earnedIncomeCredit` is enough. California does not: R&TC § 17052 defines its own credit with its own phase-in rate, its own phase-out, an adjustment factor, and a completed phase-out near $32,000 of California earned income — nowhere near the federal one. Applying any percentage to the federal credit gives a wrong California answer, so this package gives none. The Young Child Tax Credit, the Foster Youth Tax Credit and the renter credit are also absent.',
  'Not modelled: the California AMT and the itemized deduction limitation for high incomes. A low-income California return computed here will be too high.',
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
        'PROVISIONAL: the 2026 bracket thresholds, standard deduction and exemption credits below are the published 2025 figures carried forward. California indexes all of them by the California CPI factor, which the Franchise Tax Board publishes late in the tax year; this package could not reach ftb.ca.gov to confirm the 2026 factor. The rates themselves are statutory and are correct. Expect the computed tax to be slightly HIGH — carrying thresholds forward leaves income in higher bands than the indexed schedule would.',
        ...SHARED_NOTES,
      ],
      citations: CITATIONS,
    };
  }
  return undefined;
}
