/**
 * Oregon — the third state in this package that deducts the federal income tax,
 * and the one where the deduction's **placement** matters as much as its size.
 *
 * Alabama deducts the whole federal bill at a flat 5%. Missouri deducts a SHARE
 * of it chosen by a cliff chart read against Missouri AGI. Oregon deducts the
 * whole of it up to a CEILING chosen by a cliff chart read against **federal**
 * AGI — and unlike the other two it is an income subtraction rather than a
 * deduction, which puts it inside Oregon AGI, which is the figure the Oregon
 * Kids Credit is withdrawn against.
 *
 * | state | the chart varies | read against | sits |
 * | --- | --- | --- | --- |
 * | Alabama | nothing | — | below the deduction |
 * | Missouri | the share | Missouri AGI | below the deduction |
 * | Oregon | the ceiling | **federal** AGI | **inside Oregon AGI** |
 *
 * **Three states, three shapes, and no two of them subtract the same federal
 * credits.** Alabama's worksheet takes off the earned income credit, the
 * refundable child tax credit and the refundable American Opportunity credit;
 * Missouri's takes the first and third; Oregon's takes the second and third and
 * **deliberately leaves the earned income credit in**. Publication OR-17 says it
 * in a sentence — the subtraction is the federal tax "after all credits other
 * than the earned income tax credit" — and the carve-out is the reason the
 * federal EITC moves the answer in three different directions in this one
 * package:
 *
 * - in the six states that match it, down;
 * - in Alabama and Missouri, **up**, because it comes off the deduction;
 * - in Oregon, down only, because Oregon matches it AND refuses to claw it back.
 *
 * Missouri reads the federal earned income credit twice in opposite directions.
 * Oregon reads it twice in the same direction, and that is a drafting choice
 * rather than an accident.
 *
 * ## Five cliffs where the top rate starts
 *
 * The ceiling falls in five equal steps, and the income at which it starts
 * falling is **the same income at which Oregon's top 9.9% rate begins** —
 * `$125,000` single, `$250,000` joint, in every filing status. So the two
 * steepest things in the Oregon schedule are aimed at the same dollar.
 *
 * Each step is the whole difference at once — `$1,750` of lost subtraction for a
 * 2026 single filer, which is `$1,750` more Oregon taxable income. Measured, for
 * a single filer with the standard deduction and a federal bill above every
 * ceiling:
 *
 * ```text
 * federal AGI   ceiling          one more dollar costs
 *   $125,000    8,750 -> 7,000        $153.22
 *   $130,000    7,000 -> 5,250        $153.21
 *   $135,000    5,250 -> 3,500        $173.35
 *   $140,000    3,500 -> 1,750        $173.35
 *   $145,000    1,750 ->     0        $173.35
 * ```
 *
 * **The first two cost less than the last three, and the reason is the
 * subtraction itself.** The lost `$1,750` is charged at whatever Oregon rate the
 * filer is on, and the subtraction — up to `$8,750` of it — holds them BELOW the
 * `$125,000` where 9.9% starts. So the first two steps are charged at 8.75% and
 * only the last three at 9.9%.
 *
 * Which produces the fact that is worth more than the cliffs: **Oregon's top
 * rate nominally begins at `$125,000` and does not reach a single filer until
 * `$133,161` of federal AGI**, because the state's own subtraction keeps their
 * Oregon taxable income under the threshold until then. The two steepest things
 * in the Oregon schedule are aimed at the same dollar and never meet there.
 *
 * Missouri's one cliff is bigger — `$61.94`, because 10% of a `$13,000` federal
 * bill is `$1,310` of income at a 4.7% rate — but Oregon's happen **five times**,
 * at incomes a great many people have, and they are read against a figure the
 * caller already holds.
 *
 * **And the chart is exactly marriage-neutral**, which is rare enough here to be
 * worth the arithmetic. A separate return gets half the ceiling at the SAME
 * income thresholds rather than half the thresholds. Since the single schedule
 * at `x` is the joint schedule at `2x`, two separate returns at `x` each are
 * worth precisely what one joint return at `2x` is — `2 x sep(x) = single(x) =
 * joint(2x)` at every income. No other chart in this package balances.
 *
 * ## A credit withdrawn over a width, not at a rate
 *
 * The Oregon Kids Credit (HB 3235, 2023) is `$1,050` for each dependent under
 * six, up to **five** of them, and the whole of it is withdrawn across `$5,000`
 * of Oregon AGI above `$26,550`. A width and not a rate, which makes the implied
 * marginal rate proportional to the family:
 *
 * ```text
 * 1 child    $1,050 over $5,000    21%
 * 3 children $3,150 over $5,000    63%
 * 5 children $5,250 over $5,000   105%
 * ```
 *
 * At the statutory maximum the withdrawal is **steeper than the income that
 * causes it**: a family with five children under six is strictly worse off with
 * `$31,550` of Oregon AGI than with `$26,550`, before Oregon's own rate and
 * before anything federal. It sunsets after 2028.
 *
 * ## The kicker, which exists in one of the two years this package covers
 *
 * Oregon's surplus refund is not a phase-in or a sunset; it is a **biennium**.
 * Article IX § 14 returns the excess when revenue beats the close-of-session
 * forecast by 2%, and the biennium ends on 30 June of odd years — so the credit
 * lands on odd tax years and no others.
 *
 * ```text
 * 2019  17.171%     2023  44.280%
 * 2021  17.341%     2025   9.863%
 * 2020, 2022, 2024, 2026       none
 * ```
 *
 * It is **not modelled**, and the reason is a missing input rather than a
 * missing rule: the credit is a percentage of the filer's own PRIOR-YEAR Oregon
 * tax before credits, and nothing in this package's input carries a 2024 Oregon
 * return. On 2025 wages of `$60,000` it is worth about `$280`, so an Oregon 2025
 * answer here is high by that, and the note says so on every 2025 return rather
 * than only in the documentation.
 *
 * ## A retirement credit that the average retiree cannot reach
 *
 * ORS 316.157 is 9% of the lesser of the pension and a base of `$7,500` — and
 * the base is reduced **dollar for dollar by the GROSS Social Security
 * benefit**. The average benefit is larger than the whole single base, so the
 * usual answer is zero. What is left is aimed, by arithmetic rather than by
 * words, at retirees with little or no Social Security — and the group that
 * reaches it is defined by the credit's own age test rather than by anything
 * about Oregon. The credit opens at 62; full retirement age is 67 and a deferred
 * benefit grows until 70. So the filers it reaches are mostly those **drawing a
 * pension and not yet claiming Social Security**, and it closes for them on the
 * day they claim. (An earlier draft of this comment said Oregon PERS members
 * were often outside Social Security. That is wrong — the GAO puts participation
 * among Oregon state and local employees at 97% — and it was an invented fact
 * rather than a read one. The age window is the real answer and it is checkable.)
 *
 * The second reduction reads the same benefit differently — household income is
 * federal AGI plus tax-exempt interest LESS the TAXABLE part of the benefit — so
 * a dollar of Social Security costs a dollar of base once and is then kept out
 * of the income that would cost it a second. Maryland charges the gross benefit
 * against its pension exclusion and Missouri against its public pension
 * deduction; this is the same construction reached from a third direction.
 */
import type { ConditionalNote, StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf, perPerson } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

/**
 * ORS 316.037(1)(a) — four rates, and only the first three boundaries move.
 *
 * **The 9.9% threshold has been `$125,000` since 1993** and is the one figure in
 * the Oregon schedule the statute does not index. Thirty-three years of
 * inflation have therefore walked the top bracket down the income distribution
 * on their own, with no Oregon legislature involved — the opposite of Alabama,
 * where nothing moves at all, and the opposite of the three brackets below it,
 * which move every year.
 *
 * The joint column is exactly twice the single one at every indexed boundary and
 * **head of household and qualifying surviving spouse file on the JOINT
 * schedule** while married filing separately uses the single one. So in Oregon a
 * single parent is taxed on the couple's table and a separated spouse on the
 * single's, which is the reverse of the pattern in most of this package.
 */
function schedules(year: number): Record<'single' | 'joint', readonly Bracket[]> {
  // One indexed figure per boundary, and the joint column generated from the
  // single one rather than transcribed, because the doubling IS the provision
  // and a second table of four numbers can drift from it by a dollar in a way
  // nothing would catch. Missouri's bracket generator exists for the same
  // reason.
  const [first, second] = year >= 2026 ? [4_550, 11_400] : [4_400, 11_100];
  const rates = [0.0475, 0.0675, 0.0875, 0.099] as const;
  const build = (a: number, b: number, top: number): readonly Bracket[] => [
    { rate: rates[0], upTo: a },
    { rate: rates[1], upTo: b },
    { rate: rates[2], upTo: top },
    { rate: rates[3], upTo: Infinity },
  ];
  return {
    single: build(first, second, 125_000),
    joint: build(first * 2, second * 2, 250_000),
  };
}

/**
 * Table 4 — the ceiling on the federal tax subtraction, by federal AGI.
 *
 * `from` is the step's INCLUSIVE lower bound. Form OR-40's own table prints the
 * rows as "$125,000–$130,000", which is ambiguous at both ends and is the third
 * time this package has met that question on a state's own table. The
 * Department of Revenue's 2026 withholding formula settles it in words — "wages
 * greater than or equal to $125,000 and less than $130,000" — and it settles it
 * the OPPOSITE way from Missouri's statute: the filer standing exactly on a
 * boundary takes the SMALLER ceiling here and the LARGER share there.
 *
 * **A separate return gets half the ceiling at the same thresholds**, not half
 * the thresholds, which is what makes the chart marriage-neutral. The halving is
 * generated rather than transcribed for the same reason the joint bracket column
 * is.
 */
function capSteps(year: number) {
  // 2026 from the Department of Revenue's 2026 withholding formula
  // (150-206-436, Rev. 12-31-25), which publishes the whole table; 2025 from the
  // 2025 Form OR-40 instructions. The five rows are NOT fifths of the maximum as
  // a matter of law — each is indexed on its own and rounded, and in 2023 and
  // 2024 they came out unequal — so they are stored and not generated.
  const amounts: readonly [number, number, number, number, number] =
    year >= 2026
      ? [8_750, 7_000, 5_250, 3_500, 1_750]
      : [8_500, 6_800, 5_100, 3_400, 1_700];
  const singleThresholds = [125_000, 130_000, 135_000, 140_000] as const;
  const jointThresholds = [250_000, 260_000, 270_000, 280_000] as const;
  const rows = (thresholds: readonly number[], end: number) => [
    { from: 0, amount: amounts[0] },
    ...thresholds.map((from, i) => ({ from, amount: amounts[i + 1] ?? 0 })),
    { from: end, amount: 0 },
  ];
  const single = rows(singleThresholds, 145_000);
  const joint = rows(jointThresholds, 290_000);
  // Half the ceiling, the SINGLE thresholds. Two separate returns at x each are
  // therefore worth exactly what one joint return at 2x is.
  const separate = single.map((step) => ({ from: step.from, amount: step.amount / 2 }));
  return byStatusOf<readonly { readonly from: number; readonly amount: number }[]>({
    single,
    joint,
    separate,
    headOfHousehold: joint,
  });
}

const CITATIONS: readonly Citation[] = [
  {
    title:
      'ORS 316.037 — the rate schedule: 4.75%, 6.75%, 8.75% and 9.9%. The first three boundaries are indexed under ORS 316.012; the 9.9% threshold is $125,000 ($250,000 joint) and has not moved since 1993',
    url: 'https://oregon.public.law/statutes/ors_316.037',
  },
  {
    title:
      'ORS 316.695 — Oregon additional modifications: subsection (1)(d) is the federal income tax subtraction and subsection (8) the aged-or-blind addition to the standard deduction',
    url: 'https://oregon.public.law/statutes/ors_316.695',
  },
  {
    title:
      'ORS 316.085 — the personal exemption credit, $256 for 2025 and $263 for 2026, allowed where federal adjusted gross income "does not exceed" $100,000 ($200,000 joint)',
    url: 'https://oregon.public.law/statutes/ors_316.085',
  },
  {
    title:
      'ORS 316.157 — the credit for retirement income: 9% of the lesser of the pension and a base of $7,500 ($15,000 joint) reduced by the gross Social Security benefit and again by household income above $15,000 ($30,000)',
    url: 'https://oregon.public.law/statutes/ors_316.157',
  },
  {
    title:
      'ORS 315.266 — the Oregon earned income credit, 9% of the federal credit and 12% where a dependent is under three, raised to 14% and 17% by SB 1507 (2026) for tax years beginning on or after 1 January 2026',
    url: 'https://oregon.public.law/statutes/ors_315.266',
  },
  {
    title:
      'HB 3235 (2023) — the Oregon Kids Credit: $1,000 indexed ($1,050 for 2025) for each of up to five dependents under six, withdrawn across $5,000 of Oregon adjusted gross income above an indexed threshold, refundable, and limited to tax years beginning before 1 January 2029',
    url: 'https://olis.oregonlegislature.gov/liz/2023R1/Downloads/MeasureDocument/HB3235/Enrolled',
  },
  {
    title:
      'SB 1507 (2026) — raises the ORS 315.266 earned income credit from 9% to 14% of the federal credit, and from 12% to 17% for a taxpayer with a dependent under the age of three',
    url: 'https://olis.oregonlegislature.gov/liz/2026R1/Downloads/MeasureDocument/SB1507',
  },
  {
    title:
      'Oregon Withholding Tax Formulas, 150-206-436 (Rev. 12-31-25) — the 2026 standard deduction ($2,910 single, $5,820 married), the $8,750 federal tax subtraction maximum with its whole phase-out table written as "greater than or equal to X and less than Y", the $263 allowance value and the 2026 bracket boundaries',
    url: 'https://www.oregon.gov/dor/forms/FormsPubs/withholding-tax-formulas_206-436_2026.pdf',
  },
  {
    title:
      '2025 Publication OR-40-FY, Oregon Income Tax Full-Year Resident Instructions — Table 4, the federal tax subtraction limit of $8,500 ($4,250 separate) and its AGI phase-out, and the statement that the subtraction is the federal tax "after all credits other than the earned income tax credit"',
    url: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2025.pdf',
  },
  {
    title:
      '2025 Publication OR-17, Oregon Individual Income Tax Guide — the twelve-line retirement income credit worksheet and the federal tax subtraction',
    url: 'https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf',
  },
  {
    title:
      'Or. Const. Art. IX § 14 — the "kicker": where General Fund revenue exceeds the close-of-session estimate by 2% the excess is returned as a credit on the following year\'s return, measured over a biennium ending 30 June of odd years. 9.863% of 2024 tax before credits for tax year 2025; none for 2026',
    url: 'https://oregon.public.law/constitution/art._IX,_section_14',
  },
  {
    title:
      '2026 Oregon Combined Payroll Tax Report Instructions, 150-211-155-2 — the 2026 standard deduction for head of household',
    url: 'https://www.oregon.gov/dor/forms/FormsPubs/combined-payroll_211-155-2_2026.pdf',
  },
];

/**
 * The 2025 kicker, as a STATIC note on the 2025 definition rather than a
 * conditional one.
 *
 * It was a conditional note predicated on `input.year === 2025` for about an
 * hour, and `notes.test.js` was right to reject it: a conditional note that
 * fires for every household in the battery is a static note with extra
 * machinery, and it costs the caller a predicate evaluation to learn something
 * the year alone decides. The year is part of the definition, so the note is
 * part of the definition too.
 */
/**
 * The 2026 provisional note, which is deliberately narrow.
 *
 * Oregon's 2026 is provisional for TWO figures out of forty-odd, which is
 * unusual in this package — California's 2026 is provisional for most of its
 * schedule — and the note says which two rather than warning about the year as
 * a whole. The reason the rest is published is worth the sentence: an agency
 * does not issue a withholding formula for figures it has not settled.
 */
const PROVISIONAL_2026 =
  'PROVISIONAL, for two figures and not for the year: the Oregon Kids Credit amount ($1,050) and its phase-out threshold ($26,550) below are the 2025 figures carried forward, because HB 3235 indexes both and the Department of Revenue publishes a year\'s Kids Credit figures in the January after it. Carrying them forward understates the credit and withdraws it earlier than the indexed figures would, so the error is against the filer in both directions. EVERYTHING ELSE IN 2026 IS PUBLISHED AND READ — the brackets, the standard deduction, the federal tax subtraction ceiling and its whole phase-out table and the $263 exemption credit are all in the Department of Revenue\'s 2026 withholding formula, published 31 December 2025, and the 14% and 17% earned income credit rates are statutory under SB 1507.';

const KICKER_2025 =
  'TAX YEAR 2025 HAS A KICKER AND THIS FIGURE DOES NOT INCLUDE IT. The Oregon surplus credit for 2025 is 9.863% of the filer\'s own 2024 Oregon tax before credits — roughly $280 for a single filer on $60,000 of wages — and it is refundable, so an Oregon 2025 liability here is too high by that amount for every filer who filed in 2024. It needs a prior-year return this package is never given. There is no 2026 kicker: the credit lands on odd tax years only, because the biennium it measures ends on 30 June of odd years.';

const NOTES: readonly string[] = [
  'Oregon does not tax Social Security or Tier 1 railroad retirement benefits, and subtracts the whole of `taxableSocialSecurity` here (ORS 316.054).',
  'THE KICKER IS NOT MODELLED, and for tax year 2025 it is the largest single figure missing from an Oregon answer. Or. Const. Art. IX § 14 returns 9.863% of the filer\'s OWN 2024 Oregon tax before credits as a refundable credit on the 2025 return — about $280 for a single filer on $60,000 of wages. It is not modelled because the input does not exist rather than because the rule is hard: it is a percentage of a prior-year return this package is never given. There is no 2026 kicker, because the credit lands on odd tax years only. Pass it through as a credit you compute yourself if you hold the 2024 figure.',
  'Not modelled, and each is a credit rather than a rate: the Working Family Household and Dependent Care credit (ORS 315.264, a percentage of care expenses that falls with income and is the largest credit on many working parents\' returns); the additional exemption credit for a filer with a severe disability and the one for a dependent child with a disability (ORS 316.099, both an extra exemption at $256/$263 and the second with an income limit of its own); the 529/ABLE contribution credit (ORS 315.650); the political contribution credit; and the Oregon surplus "kicker" above. Pass any of these through as credits you compute yourself.',
  'The FEDERAL PENSION SUBTRACTION is not modelled. ORS 316.680(1)(d) lets a federal retiree subtract the share of their pension earned by service before 1 October 1991, and Publication OR-17\'s retirement credit worksheet subtracts that figure from the pension the credit is computed on. So for a federal retiree with pre-1991 service this package reports an Oregon retirement income credit that is TOO LARGE, and an Oregon AGI that is too large as well. The month-count inputs this package carries are for Kentucky\'s 1998 cutoff and do not fit Oregon\'s 1991 one.',
  'Oregon\'s federal tax subtraction is the federal income tax after non-refundable credits, LESS the refundable child tax credit and the refundable American Opportunity credit, and NOT less the earned income credit — Publication OR-17 says the subtraction is the federal tax "after all credits other than the earned income tax credit". Alabama\'s worksheet subtracts all three and Missouri\'s subtracts the earned income credit and not the child one, so the three states that deduct federal tax subtract three different sets of credits, and `federal.earnedIncomeCredit` therefore raises an Alabama and a Missouri answer and lowers an Oregon one.',
  'Publication OR-17 takes the subtraction from the federal income tax "before other taxes", which excludes the Form 8960 net investment income tax that `federal.incomeTaxBeforeRefundableCredits` includes. The difference cannot reach a SINGLE filer at all — the subtraction is already zero above $145,000 of AGI and the net investment income tax begins at $200,000 — and elsewhere it is bounded by 9.9% of that tax and needs itemized deductions large enough to push the federal income tax below the ceiling. A joint filer at $255,000 of AGI with $200,000 of charitable deductions and $55,000 of investment income is about $19 too low here. Named rather than hidden.',
  'The Oregon Kids Credit is withdrawn against OREGON adjusted gross income, which this engine computes with the federal tax subtraction already taken out of it — the placement Schedule OR-ASC uses. That is why the subtraction is an income subtraction here and a deduction in Alabama and Missouri: in Oregon the federal tax a family paid can buy back part of a credit, and in the other two it cannot.',
  'THE RETIREMENT CREDIT NEEDS THE GROSS SOCIAL SECURITY BENEFIT, not the taxable part. ORS 316.157 reduces its $7,500 base by the GROSS benefit while the household-income test on the same worksheet subtracts only the TAXABLE part, so the two halves read one benefit two ways. A return that supplies `taxableSocialSecurity` and no `retirement.filer.socialSecurityBenefits` gives the engine the smaller figure, which reduces the base too little and makes this credit TOO LARGE — up to 9% of the difference, or $675 where the whole base survives that should have been cancelled. This is a static note rather than a conditional one because no household in the package\'s own battery can reach the fallback, so nothing here would warn a caller who hit it.',
  'Oregon has no personal exemption that reduces income: ORS 316.085 makes it a CREDIT, so it is worth the same $263 to a filer in the 4.75% band and one in the 9.9% band. The aged-or-blind amount is the other way round — ORS 316.695(8) puts it inside the STANDARD DEDUCTION, so it is worth more to a higher-rate filer and nothing at all to one who itemizes.',
];

const CONDITIONAL_NOTES: readonly ConditionalNote[] = [
  {
    relevantWhen: (input) => (input.federal.incomeTaxBeforeRefundableCredits ?? 0) <= 0,
    text:
      'NO FEDERAL INCOME TAX WAS SUPPLIED, so the Oregon federal tax subtraction was taken as zero and this Oregon figure is TOO HIGH — by up to 9.9% of the ceiling, which is $866.25 in 2026. Pass `federal.incomeTaxBeforeRefundableCredits`: Form 1040 line 22, the tax after non-refundable credits. A filer who genuinely owes no federal tax can ignore this note; the engine cannot tell the two apart.',
  },
  {
    // ONE note for both credits rather than two, because both say the same
    // thing — pass `dependentAges` — and because a note split in two was a note
    // nobody could read. `notes.test.js` rejected the Kids Credit half: its
    // predicate wanted a return with dependents and no ages, and every
    // household in the battery that has dependents has their ages, so the note
    // fired for nobody. Merged, it fires for the household that has an earned
    // income credit and no ages, and it tells that caller about both rates.
    relevantWhen: (input) =>
      input.dependentAges === undefined &&
      ((input.federal.earnedIncomeCredit ?? 0) > 0 || (input.dependents ?? 0) > 0),
    text:
      'TWO OREGON CREDITS NEED `dependentAges` AND THIS RETURN HAS ONLY A COUNT. The earned income credit is 14% of the federal credit and 17% where a dependent is under three (9% and 12% for 2025), so the LOWER rate was used — $129.84 a year on the $4,328 federal credit for one child. And the Oregon Kids Credit is $1,050 for each dependent UNDER SIX, up to five of them, so NOTHING was allowed for it: for a family with two children under six below $26,550 of Oregon AGI that is $2,100 of refundable credit not reported. A count of dependents cannot reach either figure.',
  },
];

export function oregon(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const bands = schedules(year);
  const is2026 = year >= 2026;
  return {
    code: 'OR',
    name: 'Oregon',
    // 2026 is provisional for TWO figures and only two. The brackets, the
    // standard deduction, the federal tax subtraction ceiling and the exemption
    // credit were all published before the year began — the Department of
    // Revenue's 2026 withholding formula carries them — and SB 1507's earned
    // income credit rates are statutory. The Oregon Kids Credit is the
    // exception: HB 3235 indexes it and the 2026 figure is not out.
    status: is2026 ? 'provisional' : 'published',
    provisionalFigures: is2026
      ? [
          {
            path: 'childCredit.amountByAge.0.amount',
            reason: 'awaiting-publication' as const,
            carriedForwardFrom: 2025,
            resolvedBy:
              "the Department of Revenue's 2026 Oregon Kids Credit guidance and the 2026 Form OR-40 instructions, published January 2027. The figure has risen every year ($1,000 for 2023 and 2024, $1,050 for 2025), so carrying 2025 forward understates the credit rather than overstating it",
          },
          ...(
            [
              'single',
              'marriedFilingJointly',
              'marriedFilingSeparately',
              'headOfHousehold',
              'qualifyingSurvivingSpouse',
            ] as const
          ).map((status) => ({
            path: `childCredit.phaseOut.threshold.${status}`,
            reason: 'awaiting-publication' as const,
            carriedForwardFrom: 2025,
            resolvedBy:
              "the Department of Revenue's 2026 Oregon Kids Credit guidance, published January 2027 — the threshold is indexed ($25,000 for 2023, $25,750 for 2024, $26,550 for 2025) and carrying 2025 forward withdraws the credit from a family EARLIER than the indexed figure would, so the error is against the filer",
          })),
        ]
      : undefined,
    year,
    base: 'federalAdjustedGrossIncome',
    rate: {
      kind: 'brackets',
      byStatus: byStatusOf<readonly Bracket[]>({
        single: bands.single,
        joint: bands.joint,
        // ORS 316.037(1)(b)–(c): a separate return uses the single schedule and
        // head of household the joint one. The reverse of most of this package.
        separate: bands.single,
        headOfHousehold: bands.joint,
      }),
    },
    deduction: {
      kind: 'table',
      amounts: byStatus(
        is2026
          ? { single: 2_910, joint: 5_820, separate: 2_910, headOfHousehold: 4_685 }
          : { single: 2_835, joint: 5_670, separate: 2_835, headOfHousehold: 4_560 },
      ),
    },
    standardDeductionAgedOrBlindAddition: {
      // $1,200 on a single or head of household return and $1,000 on a joint,
      // separate or surviving spouse one — the only figure in this package where
      // a single filer's allowance EXCEEDS a joint filer's per person, so two
      // single 65-year-olds deduct $2,400 and the same two married deduct
      // $2,000. Not indexed; these are the 2021 figures.
      amount: byStatus({ single: 1_200, joint: 1_000, separate: 1_000, headOfHousehold: 1_200 }),
      age: 65,
      cite: 'ORS 316.695(8) — an addition to the standard deduction of $1,200 for a single or head of household filer and $1,000 each on a joint, separate or surviving spouse return, for each filer who has reached 65 and again for each who is blind. It is inside the standard deduction, so a filer who itemizes loses it.',
    },
    itemizedDeduction: {
      name: 'Oregon itemized deductions (Schedule OR-A)',
      // ORS 316.695(1) lets an Oregon filer itemize whether or not they did
      // federally, and the common case is a filer who took the federal standard
      // deduction and still has Oregon itemized deductions worth more than
      // $2,910.
      requiresFederalItemizing: false,
      payrollTaxIsItemized: false,
      phaseOutRate: 0,
      phaseOutThreshold: byStatus({
        single: Infinity,
        joint: Infinity,
        separate: Infinity,
        headOfHousehold: Infinity,
      }),
    },
    federalIncomeTaxDeduction: {
      name: 'Federal tax liability subtraction',
      cite: 'ORS 316.695(1)(d), Form OR-40 line 10 — a subtraction for the federal income tax liability, limited to the ceiling in the instructions\' Table 4 and taken as an INCOME subtraction on Schedule OR-ASC rather than as a deduction.',
      // The carve-out that makes this a list rather than a constant, for the
      // third time and with a third answer. Oregon leaves the earned income
      // credit IN the federal tax, which is the one credit Alabama and Missouri
      // both take out.
      refundableCredits: ['additionalChildTaxCredit', 'refundableAmericanOpportunityCredit'],
      refundableCreditsCite:
        'Publication OR-17 and the Form OR-40 instructions: the subtraction is the federal income tax "after all credits other than the earned income tax credit", so the refundable child tax credit and the refundable American Opportunity credit come off it and the earned income credit does not. Alabama subtracts all three; Missouri subtracts the earned income credit and not the child one.',
      capSteps: capSteps(year),
      capStepsBasis: 'federalAdjustedGrossIncome',
      capStepsCite:
        'Table 4 of the Form OR-40 instructions, read against FEDERAL adjusted gross income. The table prints its rows as "$125,000–$130,000"; the Department of Revenue\'s 2026 withholding formula writes the same rows as "greater than or equal to $125,000 and less than $130,000", so the lower bound is inclusive and a filer standing exactly on a boundary takes the SMALLER ceiling — the opposite convention from Missouri\'s § 143.171.2, whose boundaries are inclusive at the top.',
      reducesStateAdjustedGrossIncome: true,
    },
    exemptionCredit: {
      name: 'Oregon exemption credit',
      // A CREDIT and not an exemption, so it is worth the same to a 4.75% filer
      // and a 9.9% one — and it is switched off by a cliff rather than tapered.
      perFiler: perPerson(is2026 ? 263 : 256),
      perDependent: is2026 ? 263 : 256,
      incomeLimitByStatus: byStatus({
        single: 100_000,
        joint: 200_000,
        separate: 100_000,
        headOfHousehold: 200_000,
      }),
      separateReturnSpouse: {
        spouse: 'claimed',
        cite: 'The Form OR-40 instructions for the exemption boxes: a filer who is "married and filing a joint return (or filing separately but your spouse has no income)" whose spouse "can\'t be claimed as a dependent on someone else\'s return" checks the Regular exemption box for the spouse. So a separate Oregon return with a no-income spouse claims TWO exemption credits, not one — $526 for 2026.',
      },
      // ORS 316.085(5) grants it where federal AGI "does not exceed" the figure,
      // so the filer standing exactly on it KEEPS the credit — the opposite of
      // Ohio's § 5747.022, which allows its credit only below the figure. A
      // family of four at exactly $200,000 is $1,052 apart under the two
      // readings.
      incomeLimitIsInclusive: true,
    },
    earnedIncomeCredit: {
      name: 'Oregon earned income credit',
      matchRate: is2026 ? 0.14 : 0.09,
      youngChildMatchRate: is2026 ? 0.17 : 0.12,
      // "under the age of three" — stored as the inclusive age, so 0, 1 and 2.
      youngChildMaxAge: 2,
      refundable: true,
    },
    childCredit: {
      name: 'Oregon Kids Credit',
      // Under six, one amount, and the ages are the only way to see it.
      amountByAge: [{ maxAge: 5, amount: 1_050 }],
      maxChildren: 5,
      phaseOut: {
        kind: 'overWidth',
        threshold: byStatus({
          single: 26_550,
          joint: 26_550,
          separate: 26_550,
          headOfHousehold: 26_550,
        }),
        width: 5_000,
        income: 'stateAdjustedGrossIncome',
      },
      refundable: true,
    },
    reducedBaseRetirementCredit: {
      name: 'Oregon retirement income credit',
      rate: 0.09,
      base: byStatus({ single: 7_500, joint: 15_000, separate: 7_500, headOfHousehold: 7_500 }),
      householdIncomeThreshold: byStatus({
        single: 15_000,
        joint: 30_000,
        separate: 15_000,
        headOfHousehold: 15_000,
      }),
      minimumAge: 62,
      cite: 'ORS 316.157 and the twelve-line worksheet in Publication OR-17 — 9% of the lesser of the filer\'s and spouse\'s pension income at 62 or over and a base of $7,500 ($15,000 joint) reduced by the GROSS Social Security benefit and again, dollar for dollar, by household income above $15,000 ($30,000). Household income is federal AGI plus tax-exempt interest less the TAXABLE part of the benefit, so a dollar of Social Security reduces the base once and not twice. None of the five figures has moved since 2018.',
    },
    subtractsTaxableSocialSecurity: true,
    notes: is2026 ? [PROVISIONAL_2026, ...NOTES] : [KICKER_2025, ...NOTES],
    conditionalNotes: CONDITIONAL_NOTES,
    citations: CITATIONS,
  };
}
