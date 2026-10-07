/**
 * Wisconsin — the state where the standard deduction is a rate.
 *
 * Every other state in this package gives a standard deduction that is a
 * figure: a table by filing status, or the federal amount, or nothing. Three
 * withdraw one as income rises and all three do it in whole steps at
 * boundaries. Wisconsin's § 71.05(22)(dp) withdraws it **continuously, as a
 * percentage of every dollar above a threshold** — 12% for a single filer,
 * 19.778% on a joint or separate return, 22.515% for a head of household — and
 * a percentage of income subtracted from a deduction is not a step in the
 * marginal rate. It is a multiplier on it.
 *
 * ```text
 * single, inside the band, 4.4% bracket      4.400% x 1.12000  =  4.928%
 * single, inside the band, 5.3% bracket      5.300% x 1.12000  =  5.936%
 * joint,  inside the band, 4.4% bracket      4.400% x 1.19778  =  5.270%
 * joint,  inside the band, 5.3% bracket      5.300% x 1.19778  =  6.348%
 * head of household, inside the first tier   4.400% x 1.22515  =  5.391%
 * ```
 *
 * None of those five numbers appears in any rate table, and the band they
 * describe is not a corner of the distribution: for a single filer it runs from
 * `$20,120` to `$136,453.33` of Wisconsin AGI in 2026, which is most of the
 * state's wage earners.
 *
 * ## The marginal rate is not monotonic, and for a head of household it turns twice
 *
 * The withdrawal ENDS, and the statutory rate is lower on the other side of it
 * than the withdrawal-inflated rate was on this one. So a Wisconsin filer's
 * marginal rate **falls** as income rises — once for a single or joint filer,
 * and twice for a head of household, who also meets the tier change at the
 * crossover below.
 *
 * ```text
 * head of household, no dependents, 2026 — every boundary located by bisection
 * Wisconsin AGI       rate
 *      $18,729        the first dollar of Wisconsin tax
 *      $20,120        3.500% -> 4.290%   3.500% x 1.22515
 *      $31,318        4.290% -> 5.391%   4.400% x 1.22515
 *      $58,826.61     5.391% -> 4.930%   FALLS: the tier changes to 12%
 *      $61,629        4.930% -> 5.936%   5.300% x 1.12
 *     $136,453.33     5.936% -> 5.300%   FALLS: the deduction is gone
 *     $333,420        5.300% -> 7.650%
 * ```
 *
 * Up, up, **down**, up, **down**, up. Every figure in that column was located
 * by bisecting this engine rather than computed by hand, and
 * `test/wisconsin.test.js` drives all six transitions.
 *
 * **And Wisconsin's published top rate is 7.65% while the highest marginal rate
 * an ordinary Wisconsin wage earner meets is 6.348%, at `$69,260` of joint
 * taxable income — `$374,370` of taxable income below the `$443,630` where the
 * 7.65% begins.**
 *
 * ## The head of household scale has two tiers and the second one is an identity
 *
 * A head of household starts with more deduction and loses it faster. The two
 * are tuned: at 22.515% the head-of-household figure catches the single figure
 * exactly, and from there the statute withdraws both at 12% so that a head of
 * household never deducts less than a single filer on the same income. The
 * income where that happens is **not a parameter** —
 *
 * ```text
 * crossover = threshold + (maxHeadOfHousehold - maxSingle) / (0.22515 - 0.12)
 * 2025:   19,550 + 3,960 / 0.10515  =  57,210.48
 * 2026:   20,120 + 4,070 / 0.10515  =  58,826.61
 * ```
 *
 * — and the only source that carries the 2025 figure records `$57,210`, which
 * is the identity rounded. So this package computes it (see
 * {@link slidingScaleCrossover}) and `test/wisconsin.test.js` asserts the
 * agreement, rather than storing a fifth figure that can disagree with the four
 * it is derived from.
 *
 * **The consequence is that the whole head-of-household premium is withdrawn
 * inside one band.** `$4,070` of extra deduction in 2026, gone between `$20,120`
 * and `$58,827`, after which a head of household and a single filer have the
 * same standard deduction to the dollar.
 *
 * ## The election: a subtraction that costs every credit on the return
 *
 * 2025 Act 15 created Wis. Stat. § 71.05(6)(b)54m — `$24,000` of retirement
 * income subtracted at 67, `$48,000` where both spouses on a joint return
 * qualify. Subdivision 54m.b is the whole of why it is interesting:
 *
 * > An individual who claims the subtraction under this subdivision for a
 * > taxable year may not claim any credit, including any eligible carryover of
 * > such credit, listed under s. 71.07 for the same taxable year.
 *
 * **Not a limitation — an election, and the only one of its kind here.** Every
 * other mutually exclusive provision in this package trades one credit for
 * another, or a deduction for a credit covering the same expense. This one
 * trades a subtraction against *everything else on the form*: the married
 * couple credit, the school property tax credit, the itemized deduction credit,
 * the earned income credit, the homestead credit, and any carryover of any of
 * them. So the engine computes the whole return twice and keeps the lower tax,
 * which is what the Schedule SB line 16 instructions tell the filer to do.
 *
 * And the crossover is a real income rather than a formality, because the
 * subtraction is worth **more than its face value**: the standard deduction is
 * a sliding scale read against Wisconsin AGI, so removing `$24,000` of pension
 * also buys back `$4,746.72` of deduction on a joint return inside the band.
 * The election is worth the rate on `$28,746.72`, not on `$24,000` — and that is
 * the half of it no summary of Act 15 states.
 *
 * Measured: a joint return at 68 and 68 with `$80,000` of other income and
 * `$4,000` of property tax is better off keeping its credits up to
 * **`$5,692.35`** of pension and better off electing above it. The whole `$300`
 * school property tax credit goes at once on the dollar that tips it.
 *
 * ## Itemizing is a credit, and the credit is regressive in the rate
 *
 * Wisconsin has no itemized deduction. § 71.07(5) gives a **credit of 5%** of
 * the excess of eligible itemized deductions over the standard deduction, and
 * 5% is below every Wisconsin rate:
 *
 * ```text
 * $10,000 of excess, 5.30% bracket   credit $500   a deduction would be worth $530
 * $10,000 of excess, 7.65% bracket   credit $500   a deduction would be worth $765
 * ```
 *
 * **The higher the bracket, the less Wisconsin's itemized relief is worth
 * relative to a deduction.** And the eligible total is not the federal one:
 * state and local taxes, the largest line on most Schedule As, are excluded
 * outright.
 *
 * ## The earned income credit is four rates, not one
 *
 * § 71.07(9e): 0% with no children, 4% with one, 11% with two, 34% with
 * three or more — the largest spread by family size of any state match in this
 * package. The RATE ratio is 8.5; the ratio in dollars is larger still, because
 * the federal credit the rate multiplies also grows with the family:
 *
 * ```text
 * children   federal maximum (2026)   Wisconsin
 *    1              $4,427             $177.08
 *    2              $7,316             $804.76
 *    3+             $8,231           $2,798.54
 * ```
 *
 * A parent of three keeps **15.8 times** what a parent of one keeps. "Wisconsin
 * matches 4% to 34% of the federal EITC" is true and useless: either end is
 * wrong by most of an order of magnitude.
 *
 * ## Thirty per cent of a long-term gain is not in the base at all
 *
 * § 71.05(6)(b)9 and Schedule WD line 25 exclude 30% of the net long-term
 * capital gain — bounded by the net gain as a whole, so a short-term loss eats
 * the exclusion and a short-term gain cannot create one. Wisconsin's top rate
 * on a long-term gain is therefore 7.65% x 70% = **5.355%**, and the exclusion
 * lands inside Wisconsin AGI, which is the figure the sliding-scale standard
 * deduction is read against: so a dollar of long-term gain costs 70 cents of
 * base and buys back 12 to 22.5 cents of deduction on top.
 *
 * ## What 2026 is, and how it is known
 *
 * The 2026 rate schedules are published — the Department of Revenue's 2026 Form
 * 1-ES instructions carry all four — and they pin the indexation factor hard
 * enough to settle the standard deduction schedule that is NOT published until
 * January 2027. See `test/wisconsin-indexation.test.js`, which does the interval
 * arithmetic: the three top-bracket thresholds are indexed off statutory bases
 * of `$225,000`, `$300,000` and `$150,000`, which fixes the 2026 factor to
 * within 0.0008%, and that in turn determines four of the seven 2026 standard
 * deduction figures uniquely. Three are left choosing between adjacent multiples
 * of `$10`, which is `$10` of deduction and at most **77 cents** of tax; all
 * three are in `provisionalFigures` with the alternative named, and each stores
 * the value the interval's own midpoint rounds to.
 */
import type { StateIncomeTaxDefinition, SlidingScaleTier } from '../definition.js';
import { slidingScaleCrossover } from '../definition.js';
import { byStatus, byStatusOf, whenAgedAtLeast } from './helpers.js';
import type { ByStatus, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'Wis. Stat. § 71.06 — the four rate schedules and the bracket indexing provision. Cited at SECTION level deliberately: § 71.06(2e) is written "for taxable years beginning after December 31, 2009, and before January 1, 2025" and 2025 Act 118 repealed § 71.06(1m), (1n), (1p) and (2)(c) to (h), so the subsection that indexes a 2026 bracket is not one this package has read',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/06',
  },
  {
    title: 'Wis. Stat. § 71.05(22)(dp) — the sliding scale standard deduction, its maxima, thresholds and withdrawal rates',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/05/22/dp',
  },
  {
    title: 'Wis. Stat. § 71.05(23) — the $700 exemption and the $250 addition at 65',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/05/23',
  },
  {
    title: 'Wis. Stat. § 71.05(6)(b)54m — the retirement income subtraction, and 54m.b, which forfeits every credit under s. 71.07',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/05/6/b/54m',
  },
  {
    title: 'Wis. Stat. § 71.05(6)(b)9 — the 30% long-term capital gain exclusion',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/05/6/b/9',
  },
  {
    title: 'Wis. Stat. § 71.07(5) — the itemized deduction credit, 5% of the excess over the standard deduction',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/07/5',
  },
  {
    title: 'Wis. Stat. § 71.07(6) — the married couple credit, 3% of the lesser earned income to a $480 cap',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/07/6',
  },
  {
    title: 'Wis. Stat. § 71.07(9) — the school property tax credit, 12% to a $300 cap',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/07/9',
  },
  {
    title: 'Wis. Stat. § 71.07(9e) — the Wisconsin earned income credit, 4% / 11% / 34% of the federal credit by child count',
    url: 'https://docs.legis.wisconsin.gov/statutes/statutes/71/i/07/9e',
  },
  {
    title: '2025 Wisconsin Act 15 — the 4.4% bracket expansion and the retirement income subtraction, both retroactive to 1 January 2025',
    url: 'https://docs.legis.wisconsin.gov/2025/related/acts/15',
  },
  {
    title: 'Wisconsin DOR, 2026 Form 1-ES instructions — the published 2026 rate schedules for all four filing statuses',
    url: 'https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf',
  },
  {
    title: 'Wisconsin DOR, 2025 Form 1 instructions — the 2025 rate schedules and the Standard Deduction Table',
    url: 'https://www.revenue.wi.gov/TaxForms2025/2025-Form1-inst.pdf',
  },
  {
    title: 'Wisconsin Legislative Fiscal Bureau, Individual Income Tax (Informational Paper 2) — the structure of the sliding scale and of each credit',
    url: 'https://docs.legis.wisconsin.gov/misc/lfb/informational_papers',
  },
];

/** The four rates of § 71.06, unchanged since 2023 Act 19 cut the first two. */
export const WI_RATES: readonly number[] = [0.035, 0.044, 0.053, 0.0765];

/**
 * The bracket thresholds, by year and by status.
 *
 * **2025 is not an indexed year for the middle threshold and that is the one
 * figure here where a widely used reference model is wrong.** 2025 Act 15 set
 * the top of the 4.4% band at `$50,480` single, `$67,300` joint and `$33,650`
 * separate, retroactive to 1 January 2025; indexation resumes in 2026. The
 * arithmetic settles it rather than the citation alone: `$50,480 x 1.029141`
 * rounds to the published 2026 figure of `$51,950`, `$67,300` to `$69,260` and
 * `$33,650` to `$34,630`, all three to the dollar. Indexing the Act 15 figures a
 * year early — which is what PolicyEngine-US 2.15.3 does, carrying `$51,130`,
 * `$68,170` and `$34,090` for 2025 — cannot reach the 2026 figures the same
 * model also carries: `$51,130 x 1.029141` is `$52,620`, not `$51,950`.
 */
const THRESHOLDS: Readonly<Record<number, ByStatus<readonly number[]>>> = {
  2025: byStatusOf<readonly number[]>({
    single: [0, 14_680, 50_480, 323_290],
    joint: [0, 19_580, 67_300, 431_060],
    separate: [0, 9_790, 33_650, 215_530],
    headOfHousehold: [0, 14_680, 50_480, 323_290],
  }),
  2026: byStatusOf<readonly number[]>({
    single: [0, 15_110, 51_950, 332_720],
    joint: [0, 20_150, 69_260, 443_630],
    separate: [0, 10_080, 34_630, 221_820],
    headOfHousehold: [0, 15_110, 51_950, 332_720],
  }),
};

/**
 * The statutory bases the top threshold is indexed off, set by 2013 Act 20 and
 * unchanged since.
 *
 * They are here because they are what makes 2026's unpublished standard
 * deduction knowable: `published / base` is the cumulative indexation factor,
 * and three independent statuses agreeing on it to seven figures is a tighter
 * bound than any single ratio of rounded figures can give. See
 * `test/wisconsin-indexation.test.js`.
 */
export const WI_TOP_BRACKET_BASE: ByStatus = byStatus({
  single: 225_000,
  joint: 300_000,
  separate: 150_000,
  headOfHousehold: 225_000,
});

/** The maximum standard deduction, before the sliding scale takes any of it. */
const STANDARD_MAX: Readonly<Record<number, ByStatus>> = {
  2025: byStatus({ single: 13_560, joint: 25_110, separate: 11_930, headOfHousehold: 17_520 }),
  2026: byStatus({ single: 13_960, joint: 25_840, separate: 12_280, headOfHousehold: 18_030 }),
};

/** Wisconsin AGI above which the withdrawal begins. Single and head of household share it. */
const STANDARD_THRESHOLD: Readonly<Record<number, ByStatus>> = {
  2025: byStatus({ single: 19_550, joint: 28_210, separate: 13_390, headOfHousehold: 19_550 }),
  2026: byStatus({ single: 20_120, joint: 29_040, separate: 13_780, headOfHousehold: 20_120 }),
};

/**
 * The withdrawal rates of § 71.05(22)(dp), which are statutory and unindexed.
 *
 * `19.778%` is not a rounding of anything — it is the figure the statute prints:
 * § 71.05(22)(dp) reads "subtracting from $19,010 **19.778 percent** of aggregate
 * Wisconsin adjusted gross income in excess of $21,360", those two dollar figures
 * being the base-year amounts the indexing starts from rather than the ones in
 * force.
 */
export const WI_WITHDRAWAL_RATE = {
  single: 0.12,
  joint: 0.19778,
  separate: 0.19778,
  /** The FIRST tier only; above the crossover a head of household is withdrawn at 12%. */
  headOfHouseholdFirstTier: 0.22515,
} as const;

function tiers(year: number): ByStatus<readonly SlidingScaleTier[]> {
  const max = STANDARD_MAX[year]!;
  const start = STANDARD_THRESHOLD[year]!;
  return byStatusOf<readonly SlidingScaleTier[]>({
    single: [{ above: start.single, rate: WI_WITHDRAWAL_RATE.single }],
    joint: [{ above: start.marriedFilingJointly, rate: WI_WITHDRAWAL_RATE.joint }],
    separate: [{ above: start.marriedFilingSeparately, rate: WI_WITHDRAWAL_RATE.separate }],
    headOfHousehold: [
      { above: start.headOfHousehold, rate: WI_WITHDRAWAL_RATE.headOfHouseholdFirstTier },
      {
        // Derived, not stored. The income at which the head-of-household
        // deduction has fallen to the single one, after which the statute
        // withdraws both together at 12%.
        above: slidingScaleCrossover(
          start.headOfHousehold,
          max.headOfHousehold,
          max.single,
          WI_WITHDRAWAL_RATE.headOfHouseholdFirstTier,
          WI_WITHDRAWAL_RATE.single,
        ),
        rate: WI_WITHDRAWAL_RATE.single,
      },
    ],
  });
}

/**
 * The four rates against the thresholds, as the engine's bracket list.
 *
 * Built from {@link WI_RATES} and the threshold table rather than written out,
 * because Wisconsin's four statuses share one set of rates and differ only in
 * where the rates change — so a transcription would be the same four rates
 * written sixteen times.
 */
function brackets(year: number): ByStatus<readonly { upTo: number; rate: number }[]> {
  const t = THRESHOLDS[year]!;
  const list = (edges: readonly number[]): readonly { upTo: number; rate: number }[] =>
    edges.map((_, i) => ({ upTo: edges[i + 1] ?? Infinity, rate: WI_RATES[i]! }));
  return byStatusOf<readonly { upTo: number; rate: number }[]>({
    single: list(t.single),
    joint: list(t.marriedFilingJointly),
    separate: list(t.marriedFilingSeparately),
    headOfHousehold: list(t.headOfHousehold),
  });
}

/** The income at which the sliding scale has taken the whole deduction, by status. */
export function wisconsinStandardDeductionEndsAt(year: number, status: keyof ByStatus): number {
  const max = STANDARD_MAX[year]!;
  const all = tiers(year);
  const list = all[status];
  let remaining = max[status];
  for (let i = 0; i < list.length; i += 1) {
    const tier = list[i]!;
    const next = list[i + 1]?.above ?? Infinity;
    const width = next - tier.above;
    const takeable = tier.rate * width;
    if (remaining <= takeable) return tier.above + remaining / tier.rate;
    remaining -= takeable;
  }
  return Infinity;
}

const NOTES: readonly string[] = [
  'Wisconsin\'s standard deduction is a SLIDING SCALE and the withdrawal is a RATE, not a step: § 71.05(22)(dp) takes 12% of every dollar of Wisconsin AGI above the threshold for a single filer, 19.778% on a joint or separate return and 22.515% for a head of household. So inside the phase-out band the filer\'s marginal rate is the statutory rate MULTIPLIED by one plus the withdrawal rate — a single filer in the 4.4% bracket pays 4.928% on their next dollar and a joint filer in the 5.3% bracket pays 6.348%. Neither figure is in any rate table, and the band covers most of the state\'s wage earners.',
  'Wisconsin\'s highest marginal rate for an ordinary wage earner is NOT 7.65%. The 7.65% bracket begins at $332,720 of taxable income (single, 2026); the 6.348% produced by the 5.3% rate inside the joint phase-out band begins at $69,260 of taxable income. A model that reports Wisconsin\'s top rate as 7.65% and its rate at $100,000 of joint income as 5.3% is wrong about the second figure in the direction that matters for every planning decision.',
  'The standard deduction is read against WISCONSIN AGI — Form 1 line 7 — and not against federal AGI. Every Wisconsin subtraction therefore does two things: a dollar of Social Security, of the 30% long-term capital gain exclusion, or of the § 71.05(6)(b)54m retirement subtraction comes out of the base AND buys back 12 to 22.515 cents of standard deduction.',
  'A head of household has TWO withdrawal tiers and the second one is an identity rather than a parameter. At 22.515% the head-of-household deduction catches the single deduction, and from there both are withdrawn at 12%, so a head of household never deducts less than a single filer on the same income. The whole head-of-household premium is therefore withdrawn inside one band — $4,070 of it in 2026, gone between $20,120 and $58,826.61 — and above that income the two statuses have identical standard deductions. The tier change is also a FALL in the marginal rate, from 5.391% to 4.930%, which makes a Wisconsin head of household the one filer in this package whose marginal rate turns downward twice as income rises.',
  'THE ELECTION, and it is the largest thing on a Wisconsin retiree\'s return: § 71.05(6)(b)54m subtracts up to $24,000 of retirement income at age 67 ($48,000 where both spouses on a joint return have reached it), and subd. 54m.b provides that a filer who claims it "may not claim any credit, including any eligible carryover of such credit, listed under s. 71.07 for the same taxable year". That is EVERY credit on the form — married couple, school property tax, itemized deduction, earned income, homestead. This engine computes the whole return both ways and returns the lower tax, which is what the Schedule SB line 16 instructions tell the filer to do, and the credit lines on the elected return are kept with their amounts zeroed so a caller can see what was given up.',
  'The retirement income subtraction is worth more than its face value, for the reason the sliding scale gives: removing $24,000 of pension from Wisconsin AGI also buys back up to 19.778% of it in standard deduction on a joint return. So the election is worth the filer\'s rate on about $28,747, not on $24,000 — and no published summary of 2025 Act 15 says so.',
  'Wisconsin has NO itemized deduction. § 71.07(5) gives a CREDIT of 5% of the excess of eligible itemized deductions over the standard deduction, and 5% is below every Wisconsin rate — so the credit is worth less than a deduction for the same expense would be, and the gap WIDENS with the bracket: $10,000 of excess is worth $500 against $530 of deduction value at 5.3% and against $765 at 7.65%. Pass stateItemizedDeductions, which is the Schedule 1 figure and NOT the federal Schedule A total: Wisconsin excludes state and local taxes, the largest line on most Schedule As, and counts only medical and dental above the federal AGI floor, investment and home mortgage interest, charitable contributions and casualty losses.',
  'The Wisconsin earned income credit is FOUR rates and not one: 0% with no qualifying children, 4% with one, 11% with two and 34% with three or more (§ 71.07(9e)). On the 2026 federal maximums that is $177.08, $804.76 and $2,798.54, so a parent of three keeps 15.8 times in dollars what a parent of one keeps, against a rate ratio of 8.5. It is refundable. The child count this engine uses is `dependents`, which is not the same question § 32 asks — a dependent parent is a dependent and not a qualifying child — so a household whose dependents are not all qualifying children is overstated and should pass the qualifying-child count instead.',
  'Wisconsin excludes 30% of the net LONG-TERM capital gain (§ 71.05(6)(b)9, Schedule WD line 25), bounded by the net gain as a whole: a short-term loss eats the exclusion and a short-term gain cannot create one. Pass shortTermCapitalGains alongside netCapitalGain to split the line; absent, the whole net gain is treated as long-term, which OVERSTATES the exclusion for a filer with short-term gains. Wisconsin\'s top rate on a long-term gain is 7.65% x 70% = 5.355%.',
  'Wisconsin does not tax Social Security or Tier 1 railroad retirement benefits at all, and this engine subtracts the taxable part from `taxableSocialSecurity`. It does not tax U.S. military retired pay either — § 71.05(1)(a), (am) and (an), of which only (a) is the closed 31 December 1963 cohort and (am) is the general exemption — which is NOT modelled here — pass military retired pay through `subtractions` or it is taxed.',
  'The married couple credit is 3% of the LESSER of the two spouses\' qualifying earned income, capped at $480 (§ 71.07(6)), and it needs a figure no federal return carries: Form 1040 does not split earned income between the two people on a joint return. Pass lesserSpouseIncome. Absent, the credit is computed as zero, which is right for a single-earner couple and wrong for most joint returns — two spouses on $50,000 each are worth $480 and one spouse on $100,000 is worth nothing, on identical joint income.',
  'The school property tax credit is 12% of property tax paid plus 12% of 20% of rent, capped at $300 (§ 71.07(9)). The cap binds at $2,500 of property tax, which is below the median Wisconsin property tax bill, so for most Wisconsin homeowners this credit is a flat $300 and the only question is whether they reach it. Pass propertyTaxPaid or rentPaid. The 20% is the "heat included" share; where heat is not included the statute uses a higher one, which this package does not ask about because the cap binds either way above $12,500 of annual rent.',
  'Not modelled: the child and dependent care credit, which from 2024 is 100% of the federal credit on up to $10,000 of expenses ($20,000 for two or more) — several times the federal credit itself and the largest omission here for a working parent; the homestead credit (§ 71.54); the tuition and fees subtraction; the medical care insurance subtraction; the 529 contribution subtraction; the unemployment compensation subtraction and its 50% phase-out; the Wisconsin AMT; and part-year and nonresident returns, which apportion on Form 1NPR rather than computing the full-year figure here.',
  'Whether Wisconsin\'s $700 exemption may be claimed for a spouse with no gross income on a SEPARATE return has not been read. § 71.05(23) is the section to read and the Form 1 exemption worksheet is the thing that settles it. The field is declared `unresolved` rather than guessed, and it is worth $700 of exemption — about $31 to $54 of tax.',
];

const NOTES_2026: readonly string[] = [
  'PROVISIONAL, three figures (four paths) out of a seven-figure standard deduction schedule, and the other four are KNOWN rather than published. The 2026 RATE SCHEDULES are published — the Department of Revenue\'s 2026 Form 1-ES instructions carry all four — and the 2026 STANDARD DEDUCTION schedule is not, because the Form 1 instructions that carry it appear in January 2027. Four of its seven figures are nonetheless known rather than guessed: the three top-bracket thresholds are indexed off statutory bases of $225,000, $300,000 and $150,000, which pins the 2026 cumulative factor to within 0.0008%, and that determines those four uniquely. See test/wisconsin-indexation.test.js, which does the interval arithmetic. The three it does not settle are in provisionalFigures; each is a choice between adjacent multiples of $10 and this package stores the value the interval\'s own midpoint rounds to, so the error, if any, is $10 of deduction and at most 77 cents of tax.',
];

export function wisconsin(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const thresholds = THRESHOLDS[year]!;
  return {
    code: 'WI',
    name: 'Wisconsin',
    year,
    status: year >= 2026 ? 'provisional' : 'published',
    provisionalFigures:
      year >= 2026
        ? [
            // Each of the three is a choice between two adjacent multiples of
            // $10 that the interval arithmetic in
            // `test/wisconsin-indexation.test.js` cannot separate, and each
            // stores the value the interval's own MIDPOINT rounds to. The other
            // four figures of the 2026 schedule are not here because the same
            // arithmetic settles them uniquely, which is why this flag names
            // three figures and not seven.
            {
              path: 'deduction.maximum.marriedFilingSeparately',
              reason: 'bounded-derivation',
              resolvedBy:
                'the 2026 Wisconsin Form 1 instructions, Standard Deduction Table, published January 2027. The indexation interval derived from the published 2026 rate schedules is $12,274.90 to $12,277.60, which admits $12,270 and $12,280 and no other value; this package carries $12,280, which the interval midpoint of $12,276.25 rounds to. The error, if any, is $10 of deduction and at most 77 cents of tax.',
            },
            {
              path: 'deduction.tiers.single.0.above',
              reason: 'bounded-derivation',
              resolvedBy:
                'the same table. The interval is $20,124.00 to $20,125.60, which admits $20,120 and $20,130; this package carries $20,120, which the midpoint of $20,124.80 rounds to. The same figure is the head of household threshold, so one unresolved figure covers two statuses — and it also moves the derived head-of-household crossover by $10 of income.',
            },
            {
              // The SAME unresolved figure as the entry above: § 71.05(22)(dp)
              // gives single and head of household one threshold and two
              // withdrawal rates, and `deduction.tiers` holds it once per
              // status. Day 42's rule, which cost Ohio five flags for three
              // figures: a byStatus table turns one unread number into one flag
              // per column, and an entry written for one column flags a
              // fraction of the problem.
              path: 'deduction.tiers.headOfHousehold.0.above',
              reason: 'bounded-derivation',
              resolvedBy:
                'the same table and the same figure as deduction.tiers.single.0.above. The interval is $20,124.00 to $20,125.60, which admits $20,120 and $20,130; this package carries $20,120. It also moves the DERIVED head-of-household crossover by $10 of income, from $58,826.61 to $58,836.61.',
            },
            {
              path: 'deduction.tiers.marriedFilingSeparately.0.above',
              reason: 'bounded-derivation',
              resolvedBy:
                'the same table. The interval is $13,779.60 to $13,785.90, which admits $13,780 and $13,790; this package carries $13,780, which the midpoint of $13,782.75 rounds to. Starting the withdrawal $10 of income early or late costs at most two cents of tax.',
            },
          ]
        : undefined,
    base: 'federalAdjustedGrossIncome',
    subtractsTaxableSocialSecurity: true,
    outOfStateMunicipalInterestAddition: {
      cite: 'Wisconsin Schedule AD line 1, "State and municipal interest" — the Form 1 instructions say this is generally the tax-exempt interest on federal Form 1040 line 2a. Wis. Stat. § 71.05(1) works the other way round from most states\' add-backs: paragraphs (b) and (c) ENUMERATE the Wisconsin obligations whose interest is exempt, so another state\'s bond is in the Wisconsin base because it is not on that list rather than because a provision adds it back. Cited at section level; (1)(c) alone is the exemption list and naming it for the addition is the error this cite used to make',
      measure: 'interest',
      netOfExpenses: false,
    },
    rate: { kind: 'brackets', byStatus: brackets(year) },
    deduction: {
      kind: 'slidingScale',
      maximum: STANDARD_MAX[year]!,
      tiers: tiers(year),
      cite: 'Wis. Stat. § 71.05(22)(dp) and the Standard Deduction Table in the Form 1 instructions — a withdrawal at 12% (single), 19.778% (joint and separate) or 22.515% then 12% (head of household) of Wisconsin adjusted gross income above the threshold',
    },
    capitalGainsSubtraction: {
      name: 'Long-term capital gain exclusion (30%)',
      share: 0.3,
      includesShortTerm: false,
      cite: 'Wis. Stat. § 71.05(6)(b)9 — "on assets held more than one year and on all assets acquired from a decedent, 30 percent of the capital gain as computed under the Internal Revenue Code", and "the capital gains and capital losses for all assets shall be netted before application of the percentage", which is the sentence this engine implements as min(net gain, long-term gain); Schedule WD line 25',
    },
    exemption: {
      perFiler: byStatus({ single: 700, joint: 1_400, separate: 700, headOfHousehold: 700 }),
      perDependent: 700,
      // § 71.05(23) — $250 more for the taxpayer and for the spouse at 65, per
      // person and not per return. Section level: the paragraph is not one this
      // package has read, and a subsection is where a citation goes wrong.
      perSeniorFiler: 250,
      seniorAge: 65,
      separateReturnSpouse: {
        spouse: 'unresolved',
        agedAndBlind: 'notApplicable',
        cite: 'Wis. Stat. § 71.05(23) and the Form 1 exemption worksheet — read whether a separate filer may count a spouse with no gross income. Worth $700 of exemption, about $31 to $54 of tax.',
      },
      // A qualifying surviving spouse files on the joint schedule and has one
      // person on the return, so one $700 and one chance at the $250.
      filersClaimed: byStatus({
        single: 1,
        joint: 2,
        separate: 1,
        headOfHousehold: 1,
        qualifyingSurvivingSpouse: 1,
      }),
    },
    itemizedDeductionCredit: {
      name: 'Itemized deduction credit',
      rate: 0.05,
      excludes: 'state and local taxes',
      cite: 'Wis. Stat. § 71.07(5) — 5% of the amount by which the eligible itemized deductions exceed the standard deduction; Wisconsin Form 1 Schedule 1',
    },
    schoolPropertyTaxCredit: {
      name: 'School property tax credit',
      rate: 0.12,
      max: 300,
      rentShare: 0.2,
      cite: 'Wis. Stat. § 71.07(9) — 12% of property taxes on a principal dwelling, or of 20% of rent where heat is included, to a $300 maximum',
    },
    marriedCoupleCredit: {
      name: 'Married couple credit',
      rate: 0.03,
      max: 480,
      cite: 'Wis. Stat. § 71.07(6) — 3% of the qualified earned income of the spouse with the lesser qualified earned income, not to exceed $480; Wisconsin Form 1 Schedule 2',
    },
    earnedIncomeCredit: {
      name: 'Wisconsin earned income credit',
      matchRate: 0,
      refundable: true,
      matchRateByChildCount: [
        { children: 1, rate: 0.04 },
        { children: 2, rate: 0.11 },
        { children: 3, rate: 0.34 },
      ],
    },
    retirementIncomeExclusionElection:
      year >= 2025
        ? {
            name: 'Retirement income subtraction',
            minimumAge: 67,
            perPerson: 24_000,
            jointBothEligible: 48_000,
            forfeits:
              'every credit listed under Wis. Stat. § 71.07 is forfeited for the year, including any carryover',
            cite: 'Wis. Stat. § 71.05(6)(b)54m, created by 2025 Wisconsin Act 15 — up to $24,000 of payments from a plan qualified under IRC § 401(a), § 403 or § 457(b) or from an IRA, at age 67, and 54m.b, which bars every s. 71.07 credit for the same year; Schedule SB line 16',
          }
        : undefined,
    notes: year >= 2026 ? [...NOTES_2026, ...NOTES] : NOTES,
    conditionalNotes: [
      {
        relevantWhen: whenAgedAtLeast(67),
        text: 'This return reaches the § 71.05(6)(b)54m election. The engine has computed the Wisconsin tax BOTH ways — with the retirement income subtraction and every credit forfeited, and without it and every credit allowed — and returned the lower. Read the credit lines to see which way it went: on the elected return every credit is present with an amount of zero and its name says "forfeited by the retirement income subtraction".',
      },
    ],
    citations: CITATIONS,
  };
}
