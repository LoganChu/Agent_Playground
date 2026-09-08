/**
 * Maryland — the state where the rate table is not merely incomplete but is the
 * smaller half of the answer.
 *
 * Every Maryland resident pays two income taxes on the same taxable income: the
 * state's, at 2% to 6.5%, and their county's, at 2.25% to 3.30%. The county tax
 * is roughly a third of the bill, it is charged on the state's own line 20, and
 * it appears in no table of state income tax rates because it is not a state
 * tax. A single filer at `$100,000` in Montgomery County owes `$4,386.38` of
 * state tax and `$2,990.40` of county tax, and a table that reports
 * "Maryland: 4.75%" has told you about neither — the county half alone is more
 * than the whole state income tax of eleven of the twenty-six states here.
 *
 * ## 2025 is the largest change to this return in a decade
 *
 * The Budget Reconciliation and Financing Act of 2025 (HB 352, Chapter 604) did
 * four things at once, all applying to tax years beginning after 31 December
 * 2024:
 *
 * ```text
 * two new top brackets  6.25% over $500,000 and 6.5% over $1,000,000
 *                       ($600,000 / $1,200,000 joint)
 * a capital gains       2% of net capital gain, for a filer whose FEDERAL AGI
 *   surtax              exceeds $350,000 — a test, not a floor
 * itemized deductions   reduced by 7.5% of federal AGI over $200,000
 * the standard          the old 15%-of-AGI formula with a floor and a ceiling
 *   deduction           replaced by flat amounts, indexed from here on
 * ```
 *
 * The third of those is § 68 — the federal "Pease" limitation — revived by a
 * state seven years after Congress suspended the federal one, and the second is
 * the sharpest single-dollar cliff anywhere in this package.
 *
 * ## The cliffs
 *
 * Maryland's return is built out of steps rather than tapers, and there are four
 * of them:
 *
 * ```text
 * $350,000 federal AGI   the whole 2% capital gains surtax arrives at once —
 *                        $6,933.08 on one dollar for a single filer whose
 *                        $350,000 is all gain, the largest step in this package
 * $100,000 / $150,000    the $3,200 personal exemption drops to $1,600, then to
 * $125,000 / $175,000    $800, then to nothing — times every exemption on the
 * $150,000 / $200,000    return: a family of six loses $9,600 at one step, which is
 *                        $763.28 of state and county tax on one dollar
 * $100,000 / $150,000    the senior tax credit's income limit: $1,000 or $1,750,
 *                        gone entirely one dollar over
 * $150,000 (Frederick)   the county rate steps from 2.96% to 3.20% on the WHOLE
 *                        income — $360.03 on one dollar
 * ```
 *
 * ## The earned income credit is one credit, not two
 *
 * Maryland is published everywhere as having a 50% non-refundable earned income
 * credit and a 45% refundable one. They are the same credit with a floor: the
 * 50% is capped at the tax, and the 45% pays whatever the cap withheld. The
 * effective match therefore *rises* from 45% to 50% as the filer's tax rises, and
 * a model that adds the two published percentages is wrong by most of the state
 * tax. For an unmarried childless filer the match is **100%**, the largest in the
 * country, and it is computed on a federal credit the filer may not have received
 * — § 10-704(c)(3) disregards the federal minimum age of 25.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf, uniform } from './helpers.js';
import type { CreditStep } from '../definition.js';
import type { Bracket, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'Md. Code, Tax-Gen. § 10-105 — state income tax rates, including the 6.25% and 6.5% brackets added by HB 352',
    url: 'https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-1/section-10-105/',
  },
  {
    title: 'Md. Code, Tax-Gen. § 10-211 — exemptions, and § 10-211(c), the exemption amount chart by federal AGI',
    url: 'https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-2/part-iii/section-10-211/',
  },
  {
    title: 'Md. Code, Tax-Gen. § 10-217 — the standard deduction, flat and indexed from tax year 2025',
    url: 'https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-2/part-iv/section-10-217/',
  },
  {
    title: 'Md. Code, Tax-Gen. § 10-704 — the earned income credit, state and county',
    url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-704&enactments=false',
  },
  {
    title: 'Md. Code, Tax-Gen. § 10-754 — the senior tax credit',
    url: 'https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-7/section-10-754/',
  },
  {
    title: 'Chapter 604 of the 2025 Laws of Maryland (HB 352) — new brackets, the capital gains surtax, the itemized deduction limit and the flat standard deduction',
    url: 'https://mgaleg.maryland.gov/2025RS/Chapters_noln/CH_604_hb0352e.pdf',
  },
  {
    title: 'Comptroller of Maryland — tax alert on the 2025 changes to the standard and itemized deductions and to state and local rates',
    url: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/tax-alert-changes-to-standard-and-itemized-deductions-and-to-state-and-local-income-tax-rates-from-the-2025-legislative-session.pdf',
  },
  {
    title: 'Maryland 2025 Resident Tax Forms and Instructions — Form 502, the exemption chart, the local rate chart and the credit worksheets',
    url: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/2025/resident-booklet.pdf',
  },
];

/**
 * The state rate schedule. Two columns, and the top of the fourth bracket is the
 * only place they differ before the new HB 352 brackets: `$100,000` on the
 * single column and `$150,000` on the joint one.
 *
 * Note what is *not* here: indexation. Every threshold in Md. Code, Tax-Gen.
 * § 10-105 is a fixed dollar figure, unchanged since 2008 apart from the two
 * brackets added in 2025 — so unlike almost every other state in this package,
 * Maryland's 2026 schedule is its 2025 schedule as a matter of law rather than
 * as a carry-forward. The `4.75%` bracket has covered `$3,000` to `$100,000`
 * for seventeen years of inflation.
 */
const SINGLE_BRACKETS: readonly Bracket[] = [
  { upTo: 1_000, rate: 0.02 },
  { upTo: 2_000, rate: 0.03 },
  { upTo: 3_000, rate: 0.04 },
  { upTo: 100_000, rate: 0.0475 },
  { upTo: 125_000, rate: 0.05 },
  { upTo: 150_000, rate: 0.0525 },
  { upTo: 250_000, rate: 0.055 },
  { upTo: 500_000, rate: 0.0575 },
  { upTo: 1_000_000, rate: 0.0625 },
  { upTo: Infinity, rate: 0.065 },
];

const JOINT_BRACKETS: readonly Bracket[] = [
  { upTo: 1_000, rate: 0.02 },
  { upTo: 2_000, rate: 0.03 },
  { upTo: 3_000, rate: 0.04 },
  { upTo: 150_000, rate: 0.0475 },
  { upTo: 175_000, rate: 0.05 },
  { upTo: 225_000, rate: 0.0525 },
  { upTo: 300_000, rate: 0.055 },
  { upTo: 600_000, rate: 0.0575 },
  { upTo: 1_200_000, rate: 0.0625 },
  { upTo: Infinity, rate: 0.065 },
];

/**
 * The exemption amount chart of § 10-211(c), as the staircase it is.
 *
 * The published chart is four rows of dollar amounts against four AGI bands.
 * Married filing separately reads the *single* column — the statute limits
 * "an individual other than one described in paragraph (2)", and paragraph (2)
 * is the joint, head of household and surviving spouse case — which is easy to
 * miss because Maryland halves nothing else for a separate filer.
 */
const SINGLE_EXEMPTION_STEPS: readonly CreditStep[] = [
  { upTo: 100_000, amount: 3_200 },
  { upTo: 125_000, amount: 1_600 },
  { upTo: 150_000, amount: 800 },
  { upTo: Infinity, amount: 0 },
];

const JOINT_EXEMPTION_STEPS: readonly CreditStep[] = [
  { upTo: 150_000, amount: 3_200 },
  { upTo: 175_000, amount: 1_600 },
  { upTo: 200_000, amount: 800 },
  { upTo: Infinity, amount: 0 },
];

const NOTES_2026: readonly string[] = [
  'PROVISIONAL: the 2026 Maryland standard deduction is carried forward at $3,350 / $6,700. HB 352 replaced the old 15%-of-AGI formula with flat amounts and directed that they be indexed by the chained CPI from tax year 2026, and the sources reachable here disagree on the result — some report $3,350 unchanged and some $3,400 (with $6,800 joint, since the joint amount is exactly twice the single one). Everything else in the Maryland computation is a fixed dollar figure in statute, including every rate threshold, the exemption chart, the capital gains surtax threshold and the itemized deduction limit, so this is the only 2026 figure at risk. A $50 error in the deduction is worth about $4 of state and county tax.',
];

const NOTES: readonly string[] = [
  'Maryland is two income taxes, not one. Every resident also owes a county income tax of 2.25% to 3.30% on the SAME Maryland taxable income — 23 counties plus Baltimore City, each setting its own rate — and for a middle-income filer it is about a third of the total bill. Pass `county`. There is no county-free jurisdiction in Maryland, so a Maryland return without one is incomplete rather than merely approximate.',
  'Two counties have more than one rate and they are different kinds of schedule. Anne Arundel\'s are marginal brackets; Frederick\'s bracket selects ONE rate that applies to the whole Maryland taxable income, so a Frederick filer crossing $150,000 pays 3.20% on all of it instead of 2.96% — $360.03 of tax on one dollar of income. A model that reads the state\'s local rate chart as a bracket table is wrong about Frederick at three thresholds.',
  'The 2% capital gains surtax (new for 2025) is a cliff and its threshold is a TEST, not a floor: a filer whose federal AGI exceeds $350,000 owes 2% of their whole net capital gain, and a filer one dollar below owes nothing. For a single filer whose $350,000 of AGI is all capital gain that is $6,933.08 of tax on one dollar of income, the largest single-dollar step in this package; well above the threshold it is simply 2%, or $20,000 on a $1,000,000 gain. Only the gain that reached Maryland taxable income is surtaxed, which is what caps that cliff. The threshold is per return and is not doubled for a joint return, so two spouses with $200,000 each pay it and two single filers with the same incomes do not. Pass netCapitalGain, net of the exempt classes: a principal residence sold for $1.5 million or less, IRC § 179 property, and gains inside 401(k), 403(b), IRA and Roth accounts.',
  'Maryland itemized deductions are the federal Schedule A total LESS the state and local income taxes in it, and they are available only to a filer who itemized federally (§ 10-218(b)) — so the OBBBA\'s larger federal standard deduction removed the Maryland itemized deduction from filers whose Maryland deductions never changed. From 2025 they are then reduced by 7.5% of federal AGI over $200,000 ($100,000 married filing separately, and NOT doubled for a joint return), which adds about 0.67 points to the marginal rate of every Maryland itemizer above the threshold until the deduction is exhausted. Pass stateItemizedDeductions; this package cannot derive it from federal.deduction, which still contains the state income tax.',
  'The $3,200 personal exemption is a staircase on federal AGI, not a phase-out: $3,200 up to $100,000 ($150,000 joint), then $1,600, then $800, then nothing above $150,000 ($200,000 joint) — and it applies to EVERY exemption on the return. A joint return with four dependents loses $9,600 of exemption on the dollar that crosses $150,000 — $763.28 of state and county tax on one dollar of income, in a 3.20% county. The additional $1,000 exemptions for a filer or spouse aged 65 or over or blind, and the $3,200 for a dependent aged 65 or over, are not reduced by income; supply filerAge, spouseAge, blindOrDisabled and dependentAges to get them.',
  'Maryland\'s earned income credit is ONE credit, not the two it is published as. The non-refundable half is 50% of the federal credit capped at the Maryland tax; the refundable half pays 45% of the federal credit less that tax. So the total is 45% of the federal credit for a filer with no tax and 50% for a filer with enough — an effective match that RISES with income across that band — and adding the two published percentages to get 95% is wrong by roughly the whole state tax.',
  'For an unmarried filer with no qualifying child the Maryland match is 100% of the federal credit and it is paid in full whatever the tax — the largest state match of the federal childless credit in the country. Maryland also computes it on a federal credit the filer may never have received: § 10-704(c)(3) disregards the federal minimum age of 25, so a 21-year-old with no federal credit has a Maryland one. This package cannot recompute the federal credit; pass the pro forma amount as federal.earnedIncomeCredit for such a filer. It also reads "no qualifying child" as "no dependents", so a filer whose only dependent is a dependent parent is matched here at 50% where Maryland would match 100%.',
  'The county earned income credit is not a separate parameter: § 10-704(d) makes it the lesser of the county tax and TEN TIMES the county rate times the federal credit, so it is 22.5% of the federal credit in Worcester and 33% in Dorchester, and it follows each county\'s rate automatically.',
  'The senior tax credit is $1,000 for a filer aged 65 or over ($1,750 where both spouses on a joint return are, and $1,750 for a head of household or surviving spouse), and its income limit is a cliff: $100,000 of federal AGI for a single filer, $150,000 on a joint return. One dollar over costs the whole credit.',
  'The refundable child tax credit is $500 per dependent under 6, and the phase-out is on the RETURN rather than per child — $50 for each $1,000 of federal AGI over $15,000, or any fraction of $1,000. So the $24,001 ceiling published for it is the right answer only for a one-child family: a family with two young children keeps some credit to $34,001 and one with three to $44,001. A dependent of any age who is disabled also qualifies (under 17), which this package cannot see.',
  'Maryland does not tax Social Security or railroad retirement benefits at all, and allows a pension exclusion of up to $41,200 (2025) for a filer aged 65 or over or disabled, reduced dollar for dollar by Social Security benefits received. Neither is modelled here: pass them through `subtractions`. The pension exclusion is the largest single subtraction on a Maryland retiree\'s return and omitting it can overstate the tax by roughly $3,300 of state and county tax.',
  'Not modelled: the poverty level credit (5% of earned income for a filer below the federal poverty guideline, against both the state and the county tax); the two-income subtraction of up to $1,200 for a joint return where both spouses have income; the child and dependent care credit; the 529 contribution subtraction; and the special nonresident tax of § 10-106.1, which a nonresident pays in place of a county tax and which the statute sets to the lowest county rate in the state — 2.25%, Worcester\'s. This package computes a full-year resident return.',
];

export function maryland(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const brackets = byStatusOf<readonly Bracket[]>({
    single: SINGLE_BRACKETS,
    joint: JOINT_BRACKETS,
    // Married filing separately reads the SINGLE column, not half the joint one.
    separate: SINGLE_BRACKETS,
    headOfHousehold: JOINT_BRACKETS,
    qualifyingSurvivingSpouse: JOINT_BRACKETS,
  });
  return {
    code: 'MD',
    name: 'Maryland',
    year,
    // Only the standard deduction is indexed, and only from 2026 — see NOTES_2026.
    status: year >= 2026 ? 'provisional' : 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'brackets', byStatus: brackets },
    deduction: {
      kind: 'table',
      amounts: byStatus({ single: 3_350, joint: 6_700, separate: 3_350, headOfHousehold: 6_700 }),
    },
    itemizedDeduction: {
      name: 'Maryland itemized deductions',
      requiresFederalItemizing: true,
      phaseOutRate: 0.075,
      phaseOutThreshold: byStatus({
        single: 200_000,
        joint: 200_000,
        separate: 100_000,
        headOfHousehold: 200_000,
      }),
    },
    exemption: {
      // The top step, stored so it can be checked against the chart rather than
      // used: `perExemptionSteps` is what the engine reads.
      perFiler: byStatus({ single: 3_200, joint: 6_400, separate: 3_200, headOfHousehold: 3_200, qualifyingSurvivingSpouse: 3_200 }),
      perDependent: 3_200,
      perExemptionSteps: byStatusOf<readonly CreditStep[]>({
        single: SINGLE_EXEMPTION_STEPS,
        joint: JOINT_EXEMPTION_STEPS,
        separate: SINGLE_EXEMPTION_STEPS,
        headOfHousehold: JOINT_EXEMPTION_STEPS,
        qualifyingSurvivingSpouse: JOINT_EXEMPTION_STEPS,
      }),
      // A qualifying surviving spouse files on the joint schedule and reads the
      // joint exemption chart, but has no spouse to claim an exemption for.
      filersClaimed: byStatus({ single: 1, joint: 2, separate: 1, headOfHousehold: 1, qualifyingSurvivingSpouse: 1 }),
      perSeniorFiler: 1_000,
      seniorAge: 65,
      perBlindOrDisabledFiler: 1_000,
      perSeniorDependent: 3_200,
    },
    capitalGainsSurtax: {
      name: '2% surtax on net capital gain (federal AGI over $350,000)',
      rate: 0.02,
      agiThreshold: 350_000,
      thresholdNotDoubledForJoint: true,
    },
    seniorCredit: {
      name: 'Senior tax credit',
      minimumAge: 65,
      amount: byStatus({ single: 1_000, joint: 1_000, separate: 1_000, headOfHousehold: 1_750, qualifyingSurvivingSpouse: 1_750 }),
      amountBothSpouses: byStatus({ single: 1_000, joint: 1_750, separate: 1_000, headOfHousehold: 1_750, qualifyingSurvivingSpouse: 1_750 }),
      incomeLimit: byStatus({ single: 100_000, joint: 150_000, separate: 100_000, headOfHousehold: 150_000 }),
    },
    earnedIncomeCredit: {
      name: 'Maryland earned income credit',
      matchRate: 0.5,
      refundable: false,
      refundableMatchRate: 0.45,
      childlessMatchRate: 1,
    },
    childCredit: {
      name: 'Maryland child tax credit',
      amountByAge: [{ maxAge: 5, amount: 500 }],
      phaseOut: {
        // The same $15,000 for every filing status — another threshold that is
        // not doubled for a joint return.
        threshold: uniform(15_000),
        amountPerIncrement: 50,
        increment: 1_000,
      },
      refundable: true,
    },
    notes: year >= 2026 ? [...NOTES_2026, ...NOTES] : NOTES,
    citations: CITATIONS,
  };
}

export { SINGLE_BRACKETS as MD_SINGLE_BRACKETS, JOINT_BRACKETS as MD_JOINT_BRACKETS };
