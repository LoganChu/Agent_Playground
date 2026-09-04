/**
 * New York City and Yonkers — the two localities that levy an income tax on a
 * New York State return.
 *
 * New York City's is the largest local income tax in the United States by a wide
 * margin. A single filer at $100,000 owes the city $3,174.69 — more than the
 * *entire* state income tax of twelve of the twenty-three states this package
 * covers, at the same income — and it is invisible in every table of state tax
 * rates because it is not a state tax.
 *
 * ## The rate a New Yorker pays is not the rate in the code
 *
 * N.Y.C. Admin. Code § 11-1701 imposes 2.7% / 3.3% / 3.35% / 3.4%. Nobody has
 * ever paid those rates. § 11-1704.1 imposes an "additional tax" of 14% *of the
 * § 11-1701 tax*, and the published schedule is the product:
 *
 * ```text
 * 2.7%  x 1.14 = 3.078%      3.35% x 1.14 = 3.819%
 * 3.3%  x 1.14 = 3.762%      3.4%  x 1.14 = 3.876%
 * ```
 *
 * All four to the last digit. This package stores the four statutory rates and
 * the one additional-tax rate and multiplies, which is five numbers instead of
 * four, and it is the right five: when Albany renews the additional tax at a
 * different percentage — it has been renewed at 14% since 1991 — one number
 * changes rather than four, and the four cannot drift out of step with the
 * statute they are derived from.
 *
 * ## Most of the tax is temporary, and has been for thirty-five years
 *
 * The § 11-1701 rates above are themselves the *higher* of two schedules. The
 * permanent schedule underneath them is 1.18% / 1.435% / 1.455% / 1.48%, and the
 * higher rates rest on a State authorisation that has been re-enacted on a
 * rolling basis since 1991 and currently lapses for tax years beginning on or
 * after 1 January 2027.
 *
 * If it is allowed to lapse, the top city rate falls from 3.876% to 1.6872% — a
 * 56% cut in the largest local income tax in the country, by inaction. It will
 * almost certainly be renewed again. But a package that projected 2027 by
 * carrying 2026 forward would be asserting a renewal that has not happened yet,
 * which is why this package covers 2025 and 2026 and says this instead.
 *
 * ## Yonkers taxes the tax
 *
 * A Yonkers resident owes 16.75% of their New York State tax — not of their
 * income. Every state deduction, every state credit and the whole state rate
 * schedule are already inside it, so the Yonkers surcharge moves when the *state*
 * changes and never when Yonkers does. And it is measured before refundable state
 * credits, which are claimed further down the return: netting them first produces
 * a negative city tax for a Yonkers family whose state earned income credit
 * exceeds their state tax.
 */
import { byStatusOf } from '../states/helpers.js';
import type { CreditStep } from '../definition.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { Bracket, Citation } from '../types.js';

const NYC_CITATIONS: readonly Citation[] = [
  {
    title: 'N.Y.C. Admin. Code § 11-1701 — imposition of the city resident income tax',
    url: 'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-13463',
  },
  {
    title: 'N.Y.C. Admin. Code § 11-1704.1 — the additional tax of 14% of the § 11-1701 tax',
    url: 'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-13565',
  },
  {
    title:
      'N.Y.C. Admin. Code § 11-1706 — the city household credit, school tax credit and earned income credit',
    url: 'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-13608',
  },
  {
    title:
      'Form IT-201-I, Instructions for Form IT-201 — New York City tax rate schedule, the household credit tables, and the school tax credit worksheets',
    url: 'https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf',
  },
  {
    title:
      'Form IT-215-I, Instructions for Form IT-215 — the New York City earned income credit rate worksheet and rate table',
    url: 'https://www.tax.ny.gov/forms/current-forms/it/it215i.htm',
  },
];

const YONKERS_CITATIONS: readonly Citation[] = [
  {
    title:
      'Form IT-201-I, Instructions for Form IT-201 — Yonkers resident income tax surcharge worksheet (16.75% of net state tax)',
    url: 'https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf',
  },
  {
    title:
      'Form Y-203-I, Instructions for Form Y-203 — Yonkers nonresident earnings tax, 0.5% of Yonkers-source wages',
    url: 'https://www.tax.ny.gov/pdf/current_forms/it/y203i.pdf',
  },
  {
    title: 'New York State Department of Taxation and Finance — New York City and Yonkers tax',
    url: 'https://www.tax.ny.gov/pit/file/nyc_yonkers_residents.htm',
  },
];

/**
 * The § 11-1704.1 additional tax: 14% of the § 11-1701 tax, since 1991.
 *
 * It is not a surtax on income and it is not a separate line on the return. It
 * multiplies the rate schedule, which is why the published rates are the odd
 * three-decimal figures they are.
 */
export const NYC_ADDITIONAL_TAX_RATE = 0.14;

/** N.Y.C. Admin. Code § 11-1701, before the additional tax. */
const NYC_STATUTORY_RATES: readonly number[] = [0.027, 0.033, 0.0335, 0.034];

/**
 * The permanent § 11-1701 schedule, which applies if the higher rates above are
 * allowed to lapse. Not used in any computed year; kept because the difference
 * between the two is the single largest thing that could happen to this tax.
 */
export const NYC_PERMANENT_RATES: readonly number[] = [0.0118, 0.01435, 0.01455, 0.0148];

/**
 * The rate a New York City resident actually pays in a band: the statutory rate
 * times one plus the additional tax.
 *
 * Rounded to eight places so the product is bit-identical to the three-decimal
 * percentage the Department of Taxation and Finance publishes — see the test
 * that asserts exactly that.
 */
export function nycRate(statutoryRate: number, additionalTaxRate = NYC_ADDITIONAL_TAX_RATE): number {
  return Math.round(statutoryRate * (1 + additionalTaxRate) * 1e8) / 1e8;
}

/** Bracket tops, N.Y.C. Admin. Code § 11-1701(a). The four rates are shared. */
const NYC_THRESHOLDS = {
  single: [12_000, 25_000, 50_000],
  joint: [21_600, 45_000, 90_000],
  headOfHousehold: [14_400, 30_000, 60_000],
} as const;

function nycBrackets(tops: readonly number[]): readonly Bracket[] {
  return [
    { rate: nycRate(NYC_STATUTORY_RATES[0] as number), upTo: tops[0] as number },
    { rate: nycRate(NYC_STATUTORY_RATES[1] as number), upTo: tops[1] as number },
    { rate: nycRate(NYC_STATUTORY_RATES[2] as number), upTo: tops[2] as number },
    { rate: nycRate(NYC_STATUTORY_RATES[3] as number), upTo: Infinity },
  ];
}

/**
 * The city household credit for a single filer — a flat amount, not per person.
 * IT-201-I Table 4. The amounts have not moved since 1987.
 */
const NYC_HOUSEHOLD_SINGLE: readonly CreditStep[] = [
  { upTo: 10_000, amount: 15 },
  { upTo: 12_500, amount: 10 },
  { upTo: Infinity, amount: 0 },
];

/**
 * The per-person amount every other status gets, IT-201-I Table 5. Counted
 * people are the filer, the spouse on a joint return, and each dependent — so a
 * childless couple at $15,000 of federal AGI gets $60, not $30.
 */
const NYC_HOUSEHOLD_PER_PERSON: readonly CreditStep[] = [
  { upTo: 15_000, amount: 30 },
  { upTo: 17_500, amount: 25 },
  { upTo: 20_000, amount: 15 },
  { upTo: 22_500, amount: 10 },
  { upTo: Infinity, amount: 0 },
];

const NYC_NOTES: readonly string[] = [
  'The New York City rates in this result are the N.Y.C. Admin. Code § 11-1701 statutory rates (2.7%, 3.3%, 3.35%, 3.4%) multiplied by 1.14 — the § 11-1704.1 "additional tax" of 14% of the § 11-1701 tax. The product is the 3.078% / 3.762% / 3.819% / 3.876% schedule the Department of Taxation and Finance publishes. This package derives the four published rates rather than storing them.',
  'The higher § 11-1701 rate schedule rests on a State authorisation that is renewed on a rolling basis and currently lapses for tax years beginning on or after 1 January 2027. The permanent schedule underneath it is 1.18% / 1.435% / 1.455% / 1.48%, so if the authorisation were allowed to lapse the top city rate would fall from 3.876% to 1.6872%. It has been renewed every time since 1991. Do not carry a 2026 city figure forward into 2027 without checking that it was renewed again.',
  'New York City taxable income is New York State taxable income — the same standard deduction, the same $1,000 dependent exemption. The city does NOT have the state supplemental tax (the § 601(d) benefit recapture), so a high earner faces the flat 3.876% top city rate on income above $50,000 ($90,000 joint) with no recapture on top of it.',
  'The school tax credit has two parts with two different income tests and both are cliffs, not phase-outs. The fixed amount ($63, or $125 on a joint return) is lost entirely above $250,000 of recomputed federal AGI. The rate reduction amount is lost entirely above $500,000 of city taxable income, which costs a single filer $1,133.64 on one dollar of income — the largest single-dollar cliff in this package.',
  'The city earned income credit has been a sliding 30% to 10% of the federal credit since 2022, not the flat 5% it was before. It starts at 30%, and falls by 5 percentage points across each of four $2,500-wide windows of New York AGI beginning at $5,000, $15,000, $20,000 and $40,000. Anything still using 5% understates a low-income city family by up to six times.',
  'Inside one of those four windows the city takes back 0.002 percentage points of match per dollar of New York AGI. For a family with a $7,800 federal credit that averages 15.6 percentage points of marginal rate on top of everything else — from a city whose top statutory rate is 3.876%. Supply federalOneDollarHigher to see it in marginalRate.',
  'That phase-down is a staircase, not a slope, because the worksheet rounds the match to four decimal places. The credit holds flat across five dollars of New York AGI and then falls a whole basis point at once, so the city marginal rate reported here is zero on four dollars in five and, for a family with a $7,800 federal credit, 78 cents on the dollar on the fifth. Both figures are correct; the 15.6-point average is the one to plan with.',
  'NOT MODELLED — the city child and dependent care credit (75% of the state credit, for children under 4, phasing out between $25,000 and $30,000), the city unincorporated business tax credit, and the school tax credit exclusion for filers claimed as a dependent on someone else’s return. The school tax credit income test uses recomputed federal AGI less IRA distributions; this package uses federal AGI, which overstates the income of a filer with IRA distributions near the $250,000 limit.',
  'NOT MODELLED — part-year city residency (Form IT-360.1). This result taxes the whole year at city rates, which is right for a full-year resident and too high for anyone who moved in or out.',
];

const YONKERS_NOTES: readonly string[] = [
  'The Yonkers resident income tax surcharge is 16.75% of the New York State tax, not of income. Every state deduction, every state credit and the whole state rate schedule are already inside it, so it moves when the state changes and never when Yonkers does — the FY2026 state rate cut cut the Yonkers surcharge by 16.75% of the state cut, with no action by Yonkers.',
  'The surcharge is measured on state tax after the state’s NON-refundable credits and before its refundable ones, because refundable credits are claimed in the payments section of the return, below the surcharge line. Netting refundable credits first would give a Yonkers family whose state earned income credit exceeds their state tax a negative city tax — a refund from Yonkers of 16.75% of a state refund.',
  'A Yonkers resident pays the surcharge and never the nonresident earnings tax. A non-resident who works in Yonkers pays 0.5% of Yonkers-source wages instead — supply yonkersNonresidentEarnings. This package applies that rate to the earnings figure as given: it does not compute the Form Y-203 allowable exclusion or the in-Yonkers/out-of-Yonkers allocation, so a filer entitled to either is overstated.',
  'NOT MODELLED — part-year Yonkers residency (Form IT-360.1, Part 5).',
];

/** New York City, for a year this package supports. */
export function newYorkCity(year: number): LocalIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'NYC',
    name: 'New York City',
    state: 'NY',
    year,
    // Nothing in the city computation is indexed. The rates, the bracket tops,
    // the credit tables and both school-tax-credit limits are all fixed amounts.
    status: 'published',
    base: 'stateTaxableIncome',
    rate: {
      kind: 'brackets',
      byStatus: byStatusOf<readonly Bracket[]>({
        single: nycBrackets(NYC_THRESHOLDS.single),
        // Married filing separately uses the single schedule, as it does at state level.
        separate: nycBrackets(NYC_THRESHOLDS.single),
        joint: nycBrackets(NYC_THRESHOLDS.joint),
        headOfHousehold: nycBrackets(NYC_THRESHOLDS.headOfHousehold),
      }),
    },
    householdCredit: {
      name: 'New York City household credit',
      single: NYC_HOUSEHOLD_SINGLE,
      perPerson: NYC_HOUSEHOLD_PER_PERSON,
      halvedForSeparate: true,
    },
    schoolTaxCredit: {
      name: 'New York City school tax credit',
      fixed: {
        amounts: byStatusOf<number>({ single: 63, separate: 63, headOfHousehold: 63, joint: 125 }),
        incomeLimit: 250_000,
      },
      rateReduction: {
        lowerRate: 0.00171,
        upperRate: 0.00228,
        threshold: byStatusOf<number>({
          single: 12_000,
          separate: 12_000,
          headOfHousehold: 14_400,
          joint: 21_600,
        }),
        incomeLimit: 500_000,
      },
    },
    earnedIncomeCredit: {
      name: 'New York City earned income credit',
      topMatch: 0.3,
      stepDown: 0.05,
      reductionRate: 0.00002,
      windowStarts: [5_000, 15_000, 20_000, 40_000],
      matchDecimals: 4,
    },
    notes: NYC_NOTES,
    citations: NYC_CITATIONS,
  };
}

/** Yonkers, for a year this package supports. */
export function yonkers(year: number): LocalIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'YONKERS',
    name: 'Yonkers',
    state: 'NY',
    year,
    status: 'published',
    base: 'stateNetTax',
    rate: { kind: 'flat', rate: 0.1675 },
    nonresidentEarningsRate: 0.005,
    notes: YONKERS_NOTES,
    citations: YONKERS_CITATIONS,
  };
}
