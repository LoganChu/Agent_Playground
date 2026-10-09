/**
 * Minnesota — the twenty-fifth taxing state in this package, and the first whose
 * **2026 figures are published rather than carried forward**.
 *
 * Every other state-year marked 2026 here is `provisional` in at least one
 * figure, because most states publish an indexed rate schedule late in the year
 * it applies to or early in the next. Minnesota publishes its for the year
 * AHEAD: Minn. Stat. § 270C.22 requires the commissioner to announce the
 * adjusted amounts by 1 December of the preceding year, and the Department of
 * Revenue's release of 16 December 2025 carries all of 2026's brackets, the
 * standard deduction, the dependent exemption and every threshold the two
 * limitations are read against. So both years in this file are read figures and
 * neither carries a `provisionalFigures` entry — which is a first here and is
 * worth noticing for a reason beyond Minnesota: it means the thing that makes
 * most of this package's 2026 provisional is a PUBLICATION CALENDAR and not the
 * difficulty of the figures.
 *
 * ## What Minnesota is, structurally
 *
 * Federal AGI, then **three** subtractions below it that most states put in one
 * place or none:
 *
 * 1. a standard deduction that is **limited** as income rises — 3% of the excess
 *    over one threshold, 10% over a second, and never more than 80% of the
 *    deduction taken away (§ 290.0123, subd. 5);
 * 2. a **dependent-only** exemption — Minnesota is the only state in this
 *    package with no exemption for the filer at all — withdrawn 2% at a time for
 *    each `$2,500` of federal AGI "or fraction thereof" (§ 290.0121, subd. 2);
 * 3. a Social Security subtraction that takes the WHOLE federally taxable
 *    benefit below a threshold and withdraws it a tenth at a time above
 *    (§ 290.0132, subd. 26).
 *
 * All three are read against **federal** AGI and not against any Minnesota
 * figure, and that is not a detail. It makes them independent of each other —
 * the Social Security subtraction cannot buy back a dollar of the standard
 * deduction or of the dependent exemption, however large it is — and it is why
 * a Minnesota return can be computed in one pass.
 *
 * ## The rate schedule is the second-most progressive here, and the top rate is
 * ## reached sooner than the headline suggests
 *
 * Four brackets, 5.35% / 6.80% / 7.85% / 9.85%, and the 9.85% begins at
 * `$203,150` of taxable income for a single filer in 2026. That is the
 * third-highest top rate of any state and it arrives at a fifth of the income
 * California's does.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf, uniform } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title:
      'Minn. Stat. § 290.06, subd. 2c — schedules of rates for individuals, estates and trusts',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.06#stat.290.06.2c',
  },
  {
    title: 'Minn. Stat. § 290.06, subd. 2d — inflation adjustment of brackets',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.06#stat.290.06.2d',
  },
  {
    title:
      'Minn. Stat. § 290.0123 — standard deduction, including subd. 5 (deduction limited) and subd. 6 (inflation adjustment)',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.0123',
  },
  {
    title:
      'Minn. Stat. § 290.0121 — dependent exemption, including subd. 2 (disallowed exemption amount)',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.0121',
  },
  {
    title: 'Minn. Stat. § 290.0132, subd. 26 — Social Security benefits subtraction',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.0132',
  },
  {
    title: 'Minn. Stat. § 270C.22 — the inflation adjustment, and its 1 December deadline',
    url: 'https://www.revisor.mn.gov/statutes/cite/270C.22',
  },
  {
    title:
      'Minnesota Department of Revenue, 16 December 2024 — brackets, standard deduction and dependent exemption for tax year 2025',
    url: 'https://www.revenue.state.mn.us/press-release/2024-12-16/minnesota-income-tax-brackets-standard-deduction-and-dependent-exemption',
  },
  {
    title:
      'Minnesota Department of Revenue, 16 December 2025 — brackets, standard deduction and dependent exemption for tax year 2026',
    url: 'https://www.revenue.state.mn.us/press-release/2025-12-16/minnesota-income-tax-brackets-standard-deduction-and-dependent-exemption',
  },
  {
    title: 'Minnesota Department of Revenue — tax year 2026 inflation-adjusted amounts',
    url: 'https://www.revenue.state.mn.us/sites/default/files/2025-12/inflation-adjusted-amounts-2026.pdf',
  },
  {
    title: 'Minn. Stat. § 290.091 — alternative minimum tax (NOT modelled; see the notes)',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.091',
  },
  {
    title:
      'Minn. Stat. § 290.0661 — child credit and working family credit (NOT modelled; see the notes)',
    url: 'https://www.revisor.mn.gov/statutes/cite/290.0661',
  },
];

/** The top of each band; the 9.85% rate applies above the last of them. */
interface BracketTops {
  readonly single: readonly [number, number, number];
  readonly joint: readonly [number, number, number];
  readonly separate: readonly [number, number, number];
  readonly headOfHousehold: readonly [number, number, number];
}

const TOPS_2025: BracketTops = {
  single: [32_570, 106_990, 198_630],
  joint: [47_620, 189_180, 330_410],
  separate: [23_810, 94_590, 165_205],
  headOfHousehold: [40_100, 161_130, 264_050],
};

const TOPS_2026: BracketTops = {
  single: [33_310, 109_430, 203_150],
  joint: [48_700, 193_480, 337_930],
  separate: [24_350, 96_740, 168_965],
  headOfHousehold: [41_010, 164_800, 270_060],
};

/**
 * The four statutory rates, § 290.06 subd. 2c. They have not moved since 2013
 * and only the thresholds are indexed, which is why they are written once here
 * rather than once per year.
 */
const RATES: readonly [number, number, number, number] = [0.0535, 0.068, 0.0785, 0.0985];

function bands(tops: readonly [number, number, number]): readonly Bracket[] {
  return [
    { rate: RATES[0], upTo: tops[0] },
    { rate: RATES[1], upTo: tops[1] },
    { rate: RATES[2], upTo: tops[2] },
    { rate: RATES[3], upTo: Infinity },
  ];
}

function brackets(year: number) {
  const tops = year === 2026 ? TOPS_2026 : TOPS_2025;
  return byStatusOf<readonly Bracket[]>({
    single: bands(tops.single),
    joint: bands(tops.joint),
    separate: bands(tops.separate),
    headOfHousehold: bands(tops.headOfHousehold),
    // § 290.06 subd. 2c(1) names "married individuals filing joint returns and
    // surviving spouses" in one schedule, so Minnesota HAS the status and the
    // joint column here is Minnesota's own rather than a default — which is why
    // this state carries no `survivingSpouseFilesAs`.
    qualifyingSurvivingSpouse: bands(tops.joint),
  });
}

const NOTES: readonly string[] = [
  'Minnesota starts from federal adjusted gross income and subtracts its own standard deduction, a dependent exemption and a list of subtractions. It does NOT start from federal taxable income, so the federal standard deduction does not reach a Minnesota return — the One Big Beautiful Bill Act raised the federal deduction in July 2025 and cut Colorado and Idaho tax by doing so, and changed nothing in Minnesota.',
  'THE STANDARD DEDUCTION IS LIMITED FOR HIGHER EARNERS, and the limitation has three pieces (Minn. Stat. § 290.0123, subd. 5): 3% of federal AGI above the lower threshold, then 10% of federal AGI above the higher one, and a cap saying the limitation may never remove more than 80% of the deduction. So a Minnesota filer keeps a fifth of the deduction at every income there is, and the marginal rate RISES through the band and then falls back to the statutory rate once the cap binds.',
  'Minnesota gives NO exemption for the filer — it is the only state in this package with none at all. The only exemption is $5,200 (2025) or $5,300 (2026) per dependent, and it is withdrawn 2% for each $2,500 of federal AGI "or fraction thereof" above a threshold (§ 290.0121, subd. 2). Fifty steps of 2%, and the "or fraction thereof" makes the staircase one step SHORTER than fifty times $2,500: the exemption is gone once federal AGI exceeds the threshold by $122,500 ($61,250 on a separate return), not by $125,000, because the fiftieth step takes the last 2% and arrives on the first dollar past the forty-ninth. One dollar over any boundary costs a whole 2% step, and a step is 2% of the WHOLE exemption, so it costs a parent of four twice what it costs a parent of two.',
  'Minnesota is one of the few states that taxes Social Security benefits at all. Since 2023 it subtracts the WHOLE federally taxable benefit below a threshold on federal AGI and withdraws the subtraction 10% for each $4,000 above it or fraction thereof — so it is gone once federal AGI exceeds the threshold by $36,000 ($18,000 on a separate return) and not by the $40,000 that ten steps of $4,000 suggests, for the same reason as the exemption staircase. This package models that simplified subtraction, § 290.0132, subd. 26(c).',
  'NOT MODELLED, and it is the largest gap for a Minnesota family: the child credit and working family credit of § 290.0661, which are one combined refundable credit. The child credit is $1,750 per child under 18 and the working family credit phases in at 4% of earned income; the pair is then phased out at 12% of income above $37,910 joint / $31,950 other (2025). A Minnesota parent of two children at $40,000 is roughly $3,000 further into refund than this package says. It is omitted deliberately rather than overlooked: the Department of Revenue published a 2026 threshold for the non-joint column ($32,680) and not for the joint one, and a May 2026 departmental analysis of a governor\'s bill would change the phase-out from a maximum-credit adjustment to a credit-percentage one retroactive to 1 January 2026, so the 2026 figures are not settled. Supply the credit yourself until they are.',
  'NOT MODELLED, AND IT IS THE LARGEST GAP IN THIS STATE FOR A HIGH EARNER: the Minnesota alternative minimum tax, § 290.091 — 6.75% of alternative minimum taxable income less an exemption of $95,390 joint and surviving spouse / $71,540 single and head of household / $47,700 separate for 2025, and $97,470 / $73,100 / $48,740 for 2026, payable only to the extent it exceeds the ordinary tax. THE PHASE-OUT RATE IS A FEDERAL FIGURE: subd. 3 states no rate of its own and makes the exemption "subject to the phase out under section 55(d)(2) of the Internal Revenue Code" with Minnesota AMTI substituted, and the One Big Beautiful Bill Act raised that rate from 25% to 50% for tax years beginning after 31 December 2025. At 50% the AMT reaches a Minnesota filer WITH NO DEPENDENTS AT ALL: a 2026 head of household is caught from $202,224 to $315,533 of wages, a joint return or a surviving spouse from $290,580 to $380,947, a separate return from $145,307 to $190,473, and a single filer from $222,680 once there are two dependents. It binds on a BAND and not a half-line, because the exemption it withdraws is itself phased out and the 9.85% top rate eventually overtakes 6.75%. The largest shortfall measured is $4,735.905, for a 2026 head of household with eight dependents and a filer over 65 at $258,750. `test/minnesota-amt.test.js` measures all of it, and measured TWO earlier versions of this note wrong. WHETHER MINNESOTA CONFORMS TO THE AMENDED § 55(d)(2) FOR 2026 TURNS ON ITS IRC REFERENCE DATE IN § 290.01, subd. 19, WHICH THIS PACKAGE HAS NOT READ — at the pre-OBBBA 25% nothing with two dependents or fewer is caught in either year. PolicyEngine-US takes the conforming reading and charges the grid\'s surviving spouse with one child at $300,000 $598.63 of Minnesota AMT. A filer with the preference items the AMT exists for (incentive stock options, depletion, intangible drilling costs, accelerated depreciation) can owe much more again, and this package takes none of them as inputs.',
  'NOT MODELLED, each needing an input this package does not take: the marriage credit (§ 290.0675, which needs each spouse\'s earned income separately), the K-12 education credit and subtraction, the renter\'s credit, the child and dependent care credit, the charitable contribution subtraction for non-itemizers, the 529 contribution subtraction, the public pension and military pension subtractions, and the subtraction for the elderly and disabled. A Minnesota return computed here will be TOO HIGH for a filer who qualifies for any of them; supply them through `subtractions` or against the computed tax.',
  'NOT READ, and it is the one claim in this state that rests on an absence: whether the additional standard deduction of § 290.0123, subd. 2 follows a separate filer\'s spouse who has no gross income, the way 26 U.S.C. § 63(f) does for the federal amount. This package counts only the people on the return, which is the answer that does not flatter the filer, and the same gap exists for Oregon\'s ORS 316.695(8) addition. THE DIFFERENTIAL GRID HAS NOW PRICED IT: on a separate filer of 68 with a 68-year-old spouse and $55,000 of pension, counting the spouse is worth $1,600 of deduction and $108.80 of tax, and PolicyEngine-US counts the spouse where this package does not. At the 9.85% top rate the question is worth at most $157.60. One sentence of the Form M1 instructions settles it, and mn.gov is refused by this run\'s egress proxy.',
  'NOT MODELLED: Minnesota itemized deductions (§ 290.0122), which have a limitation of their own at the same thresholds as the standard deduction. This package compares nothing to the standard deduction in Minnesota, so a Minnesota itemizer is computed on the standard deduction and will be too high.',
];

export function minnesota(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const y2026 = year === 2026;
  return {
    code: 'MN',
    name: 'Minnesota',
    year,
    // BOTH years are published. § 270C.22 subd. 1 requires the adjusted amounts
    // to be announced by 1 December of the preceding year, and the Department of
    // Revenue met the deadline for 2026 on 16 December 2025.
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'brackets', byStatus: brackets(year) },
    deduction: {
      kind: 'limitedTable',
      amounts: byStatus({
        single: y2026 ? 15_300 : 14_950,
        joint: y2026 ? 30_600 : 29_900,
        separate: y2026 ? 15_300 : 14_950,
        headOfHousehold: y2026 ? 23_000 : 22_500,
      }),
      limitation: {
        tiers: byStatusOf<readonly { above: number; rate: number }[]>({
          single: [
            { above: y2026 ? 244_400 : 238_950, rate: 0.03 },
            { above: y2026 ? 337_800 : 330_300, rate: 0.1 },
          ],
          joint: [
            { above: y2026 ? 244_400 : 238_950, rate: 0.03 },
            { above: y2026 ? 337_800 : 330_300, rate: 0.1 },
          ],
          // Halved, exactly, on both thresholds — unlike Alabama's staircase,
          // where the separate column's reduction was rounded up and the halves
          // do not reconcile.
          separate: [
            { above: y2026 ? 122_200 : 119_475, rate: 0.03 },
            { above: y2026 ? 168_900 : 165_150, rate: 0.1 },
          ],
          headOfHousehold: [
            { above: y2026 ? 244_400 : 238_950, rate: 0.03 },
            { above: y2026 ? 337_800 : 330_300, rate: 0.1 },
          ],
        }),
        maxReductionShare: 0.8,
        measuredOn: 'federalAdjustedGrossIncome',
        cite: 'Minn. Stat. § 290.0123, subd. 5 ("Deduction limited") — (a)(1) the 3% and 10% tiers, (a)(2) the 80% cap on the reduction. Thresholds from the Department of Revenue releases of 16 December 2024 and 16 December 2025.',
      },
    },
    standardDeductionAgedOrBlindAddition: {
      // § 290.0123 subd. 2, and it follows § 63(f)'s shape: the UNMARRIED
      // amount is the larger one. Claimed per qualifying person and the two
      // conditions stack, so a blind Minnesota single filer of 65 adds $4,000.
      //
      // It sits inside the figure the limitation is computed on, so a senior's
      // extra deduction is withdrawn along with the rest of it — see the
      // `limitedTable` case in `engine.ts`.
      amount: byStatus({
        single: 2_000,
        joint: y2026 ? 1_600 : 1_550,
        separate: y2026 ? 1_600 : 1_550,
        headOfHousehold: 2_000,
      }),
      age: 65,
      cite: 'Minn. Stat. § 290.0123, subd. 2 — additional amount for seniors or blind taxpayers, indexed under subd. 6.',
    },
    exemption: {
      // ZERO for every status, and it is not a placeholder: Minnesota abolished
      // the personal exemption when it conformed to the Tax Cuts and Jobs Act
      // and replaced it with a dependent exemption alone. § 290.0121 subd. 1
      // allows the amount "for each individual who is a dependent", and there is
      // no corresponding allowance for the taxpayer or the spouse.
      perFiler: uniform(0),
      separateReturnSpouse: {
        // PROVED rather than asserted: `separate-return-spouse.test.js` fails if
        // any status has a non-zero `perFiler`, and every status here is zero.
        spouse: 'noFilerExemption',
        // Minnesota's aged and blind addition is on the STANDARD DEDUCTION and
        // not on the exemption, so there is no exemption addition for a spouse
        // to follow. Whether the deduction addition follows one is a separate
        // question and is in the notes as unread.
        agedAndBlind: 'notApplicable',
        cite: 'Minn. Stat. § 290.0121, subd. 1 allows an exemption only "for each individual who is a dependent", with no allowance for the taxpayer or the spouse, so a separate return has no spouse exemption to claim or to lose.',
      },
      perDependent: y2026 ? 5_300 : 5_200,
      proportionalStepPhaseOut: {
        start: byStatus({
          single: y2026 ? 244_500 : 239_050,
          joint: y2026 ? 366_700 : 358_550,
          separate: y2026 ? 183_350 : 179_275,
          headOfHousehold: y2026 ? 305_600 : 298_800,
        }),
        increment: byStatus({
          single: 2_500,
          joint: 2_500,
          separate: 1_250,
          headOfHousehold: 2_500,
        }),
        sharePerStep: 0.02,
        cite: 'Minn. Stat. § 290.0121, subd. 2 — 2% of the exemption disallowed "for each $2,500, or fraction thereof," of federal adjusted gross income above the threshold ($1,250 on a separate return). Fifty steps, and the ceil() puts the last of them $122,500 above the threshold rather than $125,000.',
      },
    },
    socialSecuritySubtraction: {
      name: 'Minnesota Social Security benefit subtraction',
      fullSubtractionAtOrBelow: byStatus({
        single: y2026 ? 86_410 : 84_490,
        joint: y2026 ? 110_780 : 108_320,
        separate: y2026 ? 55_390 : 54_160,
        headOfHousehold: y2026 ? 86_410 : 84_490,
      }),
      increment: byStatus({
        single: 4_000,
        joint: 4_000,
        separate: 2_000,
        headOfHousehold: 4_000,
      }),
      sharePerStep: 0.1,
      cite: 'Minn. Stat. § 290.0132, subd. 26(c) — the simplified subtraction, reduced by 10% "for each $4,000, or fraction thereof," of adjusted gross income in excess of the threshold ($2,000 on a separate return). Thresholds indexed under subd. 26(j).',
    },
    notes: NOTES,
    citations: CITATIONS,
  };
}
