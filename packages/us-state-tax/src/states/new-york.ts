/**
 * New York — the state where walking the bracket table is not merely incomplete,
 * it is the wrong computation.
 *
 * Every other state in this package can be got roughly right by finding the right
 * schedule and walking it. New York cannot, because of N.Y. Tax Law § 601(d): the
 * **supplemental tax**, or "tax table benefit recapture". Above $107,650 of New
 * York adjusted gross income the state claws back the benefit of every bracket
 * below the filer's top one, in steps, until a high earner is paying their top
 * rate on their *whole* income rather than on the last band of it.
 *
 * A single New Yorker with $300,000 of AGI owes $2,399 more than the rate
 * schedule alone says. At $6,000,000 it is $65,071. Over $25,050,000 it is
 * $215,071, and that tier is missing from every reference dataset checked here.
 *
 * ## The recapture is an identity, not a table
 *
 * The statute prints the recapture as tables of dollar amounts — four brackets
 * times five filing statuses times a base and an increment, forty numbers a year
 * that a library has to transcribe and then re-transcribe every time Albany
 * changes a rate. This package stores none of them, because they are generated
 * by the rate schedule three subsections earlier:
 *
 * ```text
 * recapture at bracket threshold T = (rate above T) x T - (tax on T)
 * ```
 *
 * That is exactly "what the top rate would have collected on the income below the
 * top rate, less what the graduated rates actually collected", which is what a
 * benefit recapture *is*. Deriving it reproduces all thirteen distinct published
 * 2025 figures — twenty-two across the five filing statuses — to the dollar, with
 * round-half-up. See `test/new-york.test.js`.
 *
 * This is the Day 5 rule of this project applied to a state: prefer the
 * representation the tables were derived from, not the tables.
 *
 * ## What changed for 2026
 *
 * The FY2026 enacted budget (S.3009-C, Part A) cut the bottom five rates —
 * 4.0%→3.9%, 4.5%→4.4%, 5.25%→5.15%, 5.5%→5.4%, 6.0%→5.9% — with a further cut
 * scheduled for 2027. The top four rates are untouched, so the *recapture rises*
 * for high earners in 2026 even though nobody's rate went up: there is more
 * graduated-rate benefit below the top bracket to claw back. A single filer over
 * $1,127,550 sees the recapture go from $32,571 to $32,786.
 *
 * New York does not index its brackets, its standard deduction or its dependent
 * exemption; all three are fixed in statute. So unlike most states here, the 2026
 * figures are published rather than carried forward.
 */
import type { CreditStep, StateIncomeTaxDefinition } from '../definition.js';
import { byStatusOf, uniform } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'N.Y. Tax Law § 601 — imposition of tax, and (d) the tax table benefit recapture',
    url: 'https://www.nysenate.gov/legislation/laws/TAX/601',
  },
  {
    title: 'N.Y. Tax Law § 606(b) — household credit; § 606(d) — earned income credit',
    url: 'https://www.nysenate.gov/legislation/laws/TAX/606',
  },
  {
    title: 'N.Y. Tax Law § 614 — standard deduction; § 616 — New York exemptions',
    url: 'https://www.nysenate.gov/legislation/laws/TAX/614',
  },
  {
    title: 'New York FY2026 Enacted Budget, S.3009-C — rate reductions for 2026 and 2027',
    url: 'https://legislation.nysenate.gov/pdf/bills/2025/S3009C',
  },
  {
    title: 'Form IT-201-I, Instructions for Form IT-201 — rate schedules and the tax computation worksheets',
    url: 'https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf',
  },
];

/**
 * The rate schedule, N.Y. Tax Law § 601(a)–(c).
 *
 * Only the first five rates move between 2025 and 2026. The 9.65% / 10.30% /
 * 10.90% top rates were enacted in 2021 and are scheduled to expire after 2032,
 * at which point the top rate reverts to 8.82%.
 */
function brackets(year: number) {
  const cut = year >= 2026;
  const r1 = cut ? 0.039 : 0.04;
  const r2 = cut ? 0.044 : 0.045;
  const r3 = cut ? 0.0515 : 0.0525;
  const r4 = cut ? 0.054 : 0.055;
  const r5 = cut ? 0.059 : 0.06;
  const top = (from: number, next: number): readonly Bracket[] => [
    { rate: 0.0685, upTo: from },
    { rate: 0.0965, upTo: next },
    { rate: 0.103, upTo: 25_000_000 },
    { rate: 0.109, upTo: Infinity },
  ];
  const single: readonly Bracket[] = [
    { rate: r1, upTo: 8_500 },
    { rate: r2, upTo: 11_700 },
    { rate: r3, upTo: 13_900 },
    { rate: r4, upTo: 80_650 },
    { rate: r5, upTo: 215_400 },
    ...top(1_077_550, 5_000_000),
  ];
  const joint: readonly Bracket[] = [
    { rate: r1, upTo: 17_150 },
    { rate: r2, upTo: 23_600 },
    { rate: r3, upTo: 27_900 },
    { rate: r4, upTo: 161_550 },
    { rate: r5, upTo: 323_200 },
    ...top(2_155_350, 5_000_000),
  ];
  const headOfHousehold: readonly Bracket[] = [
    { rate: r1, upTo: 12_800 },
    { rate: r2, upTo: 17_650 },
    { rate: r3, upTo: 20_900 },
    { rate: r4, upTo: 107_650 },
    { rate: r5, upTo: 269_300 },
    ...top(1_616_450, 5_000_000),
  ];
  return byStatusOf<readonly Bracket[]>({
    single,
    // Married filing separately uses the single schedule unchanged, so a New York
    // couple filing separately is taxed exactly as two single people would be —
    // including two separate runs up the recapture ladder.
    separate: single,
    joint,
    headOfHousehold,
  });
}

/** § 606(b), Table 1. Single filers get no per-person addition. */
const HOUSEHOLD_SINGLE: readonly CreditStep[] = [
  { upTo: 5_000, amount: 75 },
  { upTo: 6_000, amount: 60 },
  { upTo: 7_000, amount: 50 },
  { upTo: 20_000, amount: 45 },
  { upTo: 25_000, amount: 40 },
  { upTo: 28_000, amount: 20 },
  { upTo: Infinity, amount: 0 },
];

/** § 606(b), Table 2 — the amount for a one-person household. */
const HOUSEHOLD_BASE: readonly CreditStep[] = [
  { upTo: 5_000, amount: 90 },
  { upTo: 6_000, amount: 75 },
  { upTo: 7_000, amount: 65 },
  { upTo: 22_000, amount: 60 },
  { upTo: 25_000, amount: 50 },
  { upTo: 28_000, amount: 40 },
  { upTo: 32_000, amount: 20 },
  { upTo: Infinity, amount: 0 },
];

/**
 * § 606(b), Table 2 — the amount added for each household member after the first.
 *
 * Its steps do not line up with the base amount's: the per-person addition falls
 * at $20,000 while the base holds to $22,000. That is not a transcription slip,
 * it is why Table 2 in the instructions has eight income rows rather than seven.
 */
const HOUSEHOLD_ADDITIONAL: readonly CreditStep[] = [
  { upTo: 20_000, amount: 15 },
  { upTo: 25_000, amount: 10 },
  { upTo: 32_000, amount: 5 },
  { upTo: Infinity, amount: 0 },
];

const NOTES: readonly string[] = [
  'New York adds a supplemental tax above $107,650 of New York AGI (Tax Law § 601(d)) that recaptures the benefit of the lower brackets, so a high earner pays their top rate on their whole income. Walking the rate schedule alone understates a $300,000 single filer by $2,399 and a $6,000,000 one by $65,071. This package derives the recapture from the rate schedule rather than storing the statutory table.',
  'The FY2026 enacted budget cut the bottom five rates for 2026 and cuts them again for 2027. The top four rates are unchanged, so the recapture owed by high earners RISES in 2026 — there is more graduated-rate benefit below the top bracket to claw back.',
  'The recapture also claws back the benefit of the filing-status schedules. Past the first phase-in — above $157,650 of New York AGI — a head of household and a single filer with the same New York taxable income in the 6% band pay exactly the same tax, because both schedules have been undone. The head-of-household schedule is worth $120.37 at $88,000 of taxable income and nothing at all above $157,650 of AGI.',
  'New York does not index its brackets, standard deduction or dependent exemption. All three are fixed in statute, which is why the 2026 figures here are published rather than carried forward.',
  'New York City and Yonkers are modelled, but only when asked for: pass locality: "NYC" or "YONKERS" and the city tax appears in localTaxes, with totalTax and totalMarginalRate covering both levels. Neither is a state tax and neither is in the state figures above.',
  'NOT MODELLED — the Empire State child credit. For 2025 and 2026 it is $1,000 per child under 4 and $330 (2025) or $500 (2026) per child aged 4 to 16, phased out above $110,000 of AGI on a joint return and $75,000 otherwise. It is refundable and it is large: a New York family return computed here is too high by up to $1,000 per young child.',
  'NOT MODELLED — the New York itemized deduction limitation, which reduces itemized deductions above $100,000 of AGI and, above $10,000,000, allows only 25% of charitable contributions. A high-income New York itemizer computed here is too low.',
  "NOT MODELLED — the college tuition credit, the real property tax credit, the child and dependent care credit, and the noncustodial parent earned income credit. New York's credit list is long; only the household credit and the earned income credit are computed here.",
  'The New York earned income credit is 30% of the federal credit LESS the New York household credit (§ 606(d)(1)) — the two are not additive. It is refundable.',
  'Married filing separately uses the single rate schedule unchanged, so a separate return climbs the recapture ladder on its own income. New York computes the household credit for separate filers on the couple’s combined income and splits it; this package has only one filer’s figures and halves the credit computed on that filer alone, so a separate filer with a working spouse is overstated by up to $45.',
];

export function newYork(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'NY',
    name: 'New York',
    year,
    // Nothing in the New York computation is indexed, so there is no figure being
    // carried forward and nothing to flag.
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'brackets', byStatus: brackets(year) },
    deduction: {
      kind: 'table',
      amounts: byStatusOf<number>({
        single: 8_000,
        joint: 16_050,
        separate: 8_000,
        headOfHousehold: 11_200,
      }),
    },
    // § 616(a): New York kept a $1,000 dependent exemption when the federal
    // personal exemption went to zero, and gives nothing for the filer or spouse.
    exemption: { perFiler: uniform(0), perDependent: 1_000 },
    recapture: {
      name: 'New York supplemental tax (tax table benefit recapture)',
      minAgi: 107_650,
      phaseInLength: 50_000,
    },
    householdCredit: {
      name: 'New York household credit',
      base: byStatusOf<readonly CreditStep[]>({
        single: HOUSEHOLD_SINGLE,
        joint: HOUSEHOLD_BASE,
        separate: HOUSEHOLD_BASE,
        headOfHousehold: HOUSEHOLD_BASE,
      }),
      perAdditionalPerson: HOUSEHOLD_ADDITIONAL,
      halvedForSeparate: true,
    },
    earnedIncomeCredit: {
      name: 'New York earned income credit',
      matchRate: 0.3,
      refundable: true,
      reducedByHouseholdCredit: true,
    },
    notes: NOTES,
    citations: CITATIONS,
  };
}
